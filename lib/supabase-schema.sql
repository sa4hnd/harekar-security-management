-- ============================================
-- HAREKAR SECURITY MANAGEMENT SYSTEM
-- Complete Supabase Database Schema
-- DROPS ALL EXISTING TABLES AND RECREATES
-- Last Updated: 2026-01-16
-- ============================================

-- IMPORTANT: Run this schema in Supabase SQL Editor
-- This will DROP all existing tables and recreate them

-- ============================================
-- DROP ALL EXISTING TABLES (CASCADE)
-- ============================================
DROP TABLE IF EXISTS notification_log CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS incidents CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS push_subscriptions CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS send_push_notification(UUID, TEXT, TEXT, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS notify_all_users(TEXT, TEXT, TEXT, JSONB, UUID) CASCADE;
DROP FUNCTION IF EXISTS notify_supervisors(TEXT, TEXT, TEXT, JSONB) CASCADE;

-- Drop existing storage buckets policies (storage bucket itself managed via Supabase dashboard)
-- Note: Storage buckets must be created via Supabase Dashboard:
-- 1. incidents-photos
-- 2. attendance-photos
-- 3. avatars

-- ============================================
-- USERS TABLE
-- ============================================
-- Stores all users (security guards and supervisors)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'security' CHECK (role IN ('security', 'supervisor')),
  avatar_url TEXT,
  shift_start_time TIME, -- e.g., '08:00:00'
  shift_end_time TIME,   -- e.g., '16:00:00'
  location_name TEXT,
  location_address TEXT,
  notes TEXT, -- Additional notes about the user
  push_token TEXT,       -- Expo push notification token
  notification_settings JSONB DEFAULT '{
    "shiftReminders": true,
    "shiftStart": true,
    "shiftEnd": true,
    "incidentAlerts": true,
    "announcementAlerts": true,
    "customAlerts": true
  }'::JSONB,
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for users
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_push_token ON users(push_token) WHERE push_token IS NOT NULL;

-- ============================================
-- SHIFTS TABLE (must be before attendance)
-- ============================================
-- Stores shift schedules for guards
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location_name TEXT,
  location_address TEXT, -- Full address for the location
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Indexes for shifts
CREATE INDEX idx_shifts_user_id ON shifts(user_id);
CREATE INDEX idx_shifts_date ON shifts(date);

-- ============================================
-- ATTENDANCE TABLE
-- ============================================
-- Tracks daily attendance records for security guards
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL, -- Optional link to shift
  date DATE NOT NULL,
  check_in_time TIMESTAMPTZ,
  check_in_location TEXT,
  check_in_latitude DOUBLE PRECISION,
  check_in_longitude DOUBLE PRECISION,
  check_in_photo_url TEXT, -- Supabase Storage URL
  check_out_time TIMESTAMPTZ,
  check_out_location TEXT,
  check_out_latitude DOUBLE PRECISION,
  check_out_longitude DOUBLE PRECISION,
  check_out_photo TEXT,  -- Supabase Storage URL or base64
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'checked_in', 'checked_out', 'absent', 'late')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)  -- One attendance record per user per day
);

-- Indexes for attendance
CREATE INDEX idx_attendance_user_id ON attendance(user_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_status ON attendance(status);
CREATE INDEX idx_attendance_user_date ON attendance(user_id, date);
CREATE INDEX idx_attendance_shift_id ON attendance(shift_id) WHERE shift_id IS NOT NULL;

-- ============================================
-- INCIDENTS TABLE
-- ============================================
-- Stores incident reports from security guards with image support
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('security_breach', 'suspicious_activity', 'equipment_issue', 'other')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal')),
  description TEXT NOT NULL,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  photo_url TEXT, -- Supabase Storage URL for incident photo
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for incidents
CREATE INDEX idx_incidents_user_id ON incidents(user_id);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_type ON incidents(type);
CREATE INDEX idx_incidents_priority ON incidents(priority);
CREATE INDEX idx_incidents_created_at ON incidents(created_at DESC);

-- ============================================
-- ANNOUNCEMENTS TABLE
-- ============================================
-- Stores announcements from supervisors to guards
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal')),
  target_audience TEXT DEFAULT 'all' CHECK (target_audience IN ('all', 'individual', 'supervisors', 'guards')),
  target_user_id UUID REFERENCES users(id), -- For individual notifications
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  push_sent BOOLEAN DEFAULT false,
  push_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for announcements
CREATE INDEX idx_announcements_created_by ON announcements(created_by);
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX idx_announcements_is_active ON announcements(is_active);
CREATE INDEX idx_announcements_target_audience ON announcements(target_audience);

-- ============================================
-- NOTIFICATION_LOG TABLE
-- ============================================
-- Logs all notifications sent for audit and tracking
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('shift_reminder', 'shift_start', 'shift_end', 'incident', 'announcement', 'custom')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  push_token TEXT, -- Token used for sending
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered BOOLEAN DEFAULT false,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error TEXT,
  expo_receipt_id TEXT -- Expo push notification receipt ID
);

-- Indexes for notification_log
CREATE INDEX idx_notification_log_user_id ON notification_log(user_id);
CREATE INDEX idx_notification_log_type ON notification_log(type);
CREATE INDEX idx_notification_log_sent_at ON notification_log(sent_at DESC);
CREATE INDEX idx_notification_log_delivered ON notification_log(delivered);

-- ============================================
-- REPORTS TABLE
-- ============================================
-- Stores generated reports for historical access
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'custom')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  data JSONB NOT NULL,  -- Stores the report data as JSON
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for reports
CREATE INDEX idx_reports_generated_by ON reports(generated_by);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);

-- ============================================
-- PUSH_SUBSCRIPTIONS TABLE
-- ============================================
-- Stores Expo push tokens for each device
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL,
  device_name TEXT,
  platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, push_token)
);

-- Indexes for push_subscriptions
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_token ON push_subscriptions(push_token);
CREATE INDEX idx_push_subscriptions_active ON push_subscriptions(is_active);

-- ============================================
-- APP_SETTINGS TABLE
-- ============================================
-- Stores user-specific app settings
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  dark_mode BOOLEAN DEFAULT false,
  language TEXT DEFAULT 'ku', -- Kurdish, English, Arabic
  notification_sound BOOLEAN DEFAULT true,
  vibration BOOLEAN DEFAULT true,
  auto_check_in_reminder BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for app_settings
CREATE INDEX idx_app_settings_user_id ON app_settings(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for the app (since we use custom auth)
-- In production, use Supabase Auth and proper RLS policies

-- Users policies (allow all for anon key since we manage auth ourselves)
CREATE POLICY "Allow all operations on users" ON users
  FOR ALL USING (true) WITH CHECK (true);

-- Attendance policies
CREATE POLICY "Allow all operations on attendance" ON attendance
  FOR ALL USING (true) WITH CHECK (true);

-- Incidents policies
CREATE POLICY "Allow all operations on incidents" ON incidents
  FOR ALL USING (true) WITH CHECK (true);

-- Announcements policies
CREATE POLICY "Allow all operations on announcements" ON announcements
  FOR ALL USING (true) WITH CHECK (true);

-- Notification log policies
CREATE POLICY "Allow all operations on notification_log" ON notification_log
  FOR ALL USING (true) WITH CHECK (true);

-- Shifts policies
CREATE POLICY "Allow all operations on shifts" ON shifts
  FOR ALL USING (true) WITH CHECK (true);

-- Reports policies
CREATE POLICY "Allow all operations on reports" ON reports
  FOR ALL USING (true) WITH CHECK (true);

-- Push subscriptions policies
CREATE POLICY "Allow all operations on push_subscriptions" ON push_subscriptions
  FOR ALL USING (true) WITH CHECK (true);

-- App settings policies
CREATE POLICY "Allow all operations on app_settings" ON app_settings
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at
  BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS FOR PUSH NOTIFICATIONS
-- ============================================

-- Function to log a notification
CREATE OR REPLACE FUNCTION log_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT NULL,
  p_push_token TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notification_log (user_id, type, title, body, data, push_token)
  VALUES (p_user_id, p_type, p_title, p_body, p_data, p_push_token)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get all active push tokens for notifications
CREATE OR REPLACE FUNCTION get_active_push_tokens(p_target_type TEXT DEFAULT 'all', p_target_user_id UUID DEFAULT NULL)
RETURNS TABLE (user_id UUID, push_token TEXT) AS $$
BEGIN
  IF p_target_type = 'individual' AND p_target_user_id IS NOT NULL THEN
    RETURN QUERY
    SELECT ps.user_id, ps.push_token
    FROM push_subscriptions ps
    JOIN users u ON u.id = ps.user_id
    WHERE ps.user_id = p_target_user_id
      AND ps.is_active = true
      AND u.is_active = true
      AND (u.notification_settings->>'customAlerts')::boolean = true;
  ELSIF p_target_type = 'supervisors' THEN
    RETURN QUERY
    SELECT ps.user_id, ps.push_token
    FROM push_subscriptions ps
    JOIN users u ON u.id = ps.user_id
    WHERE u.role = 'supervisor'
      AND ps.is_active = true
      AND u.is_active = true
      AND (u.notification_settings->>'customAlerts')::boolean = true;
  ELSE
    -- 'all' - send to everyone
    RETURN QUERY
    SELECT ps.user_id, ps.push_token
    FROM push_subscriptions ps
    JOIN users u ON u.id = ps.user_id
    WHERE ps.is_active = true
      AND u.is_active = true
      AND (u.notification_settings->>'customAlerts')::boolean = true;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get users who should receive incident alerts
CREATE OR REPLACE FUNCTION get_incident_alert_tokens()
RETURNS TABLE (user_id UUID, push_token TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT ps.user_id, ps.push_token
  FROM push_subscriptions ps
  JOIN users u ON u.id = ps.user_id
  WHERE ps.is_active = true
    AND u.is_active = true
    AND (u.notification_settings->>'incidentAlerts')::boolean = true;
END;
$$ LANGUAGE plpgsql;

-- Function to get users who should receive announcement alerts
CREATE OR REPLACE FUNCTION get_announcement_alert_tokens()
RETURNS TABLE (user_id UUID, push_token TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT ps.user_id, ps.push_token
  FROM push_subscriptions ps
  JOIN users u ON u.id = ps.user_id
  WHERE ps.is_active = true
    AND u.is_active = true
    AND (u.notification_settings->>'announcementAlerts')::boolean = true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STORAGE BUCKET CONFIGURATION
-- ============================================
-- NOTE: Create these buckets in Supabase Dashboard > Storage
--
-- 1. incidents-photos (public: false)
--    - For storing incident report photos
--    - Max file size: 5MB
--    - Allowed types: image/jpeg, image/png, image/webp
--
-- 2. attendance-photos (public: false)
--    - For storing check-out photos
--    - Max file size: 5MB
--    - Allowed types: image/jpeg, image/png, image/webp
--
-- 3. avatars (public: true)
--    - For user profile pictures
--    - Max file size: 2MB
--    - Allowed types: image/jpeg, image/png, image/webp

-- ============================================
-- SAMPLE DATA (For Testing)
-- ============================================

-- Insert sample supervisor
INSERT INTO users (email, password_hash, full_name, phone, role, is_active)
VALUES ('supervisor@harekar.com', 'admin123', 'Main Supervisor', '07501234567', 'supervisor', true)
ON CONFLICT (email) DO NOTHING;

-- Insert sample security guard
INSERT INTO users (email, password_hash, full_name, phone, role, shift_start_time, shift_end_time, is_active)
VALUES ('guard1@harekar.com', 'guard123', 'Test Guard', '07507654321', 'security', '08:00:00', '16:00:00', true)
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- NOTES
-- ============================================
--
-- IMPORTANT: After running this schema, you must:
--
-- 1. Create Storage Buckets in Supabase Dashboard:
--    - incidents-photos
--    - attendance-photos
--    - avatars
--
-- 2. Set up Storage Policies for each bucket:
--    - Allow authenticated users to upload
--    - Allow public read for avatars
--    - Allow authenticated read for other buckets
--
-- 3. Enable Realtime for tables that need live updates:
--    - incidents (for live incident alerts)
--    - announcements (for live announcement updates)
--    - attendance (for supervisor dashboard)
--
-- 4. Set up Edge Functions for push notifications:
--    - Create an Edge Function to handle Expo push notifications
--    - Use the notification_log table to track sent notifications
--
-- Features stored in Supabase:
-- - Users and authentication
-- - Attendance records with photos
-- - Incidents with photos
-- - Announcements
-- - Push notification logs
-- - Shifts/schedules
-- - Reports
-- - App settings
-- - Push subscriptions
--
