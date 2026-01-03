-- Harekar Security Management System
-- Complete Supabase Database Schema
-- Last Updated: 2026-01-03

-- ============================================
-- USERS TABLE
-- ============================================
-- Stores all users (security guards and supervisors)
CREATE TABLE IF NOT EXISTS users (
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
  push_token TEXT,       -- Expo push notification token
  notification_settings JSONB DEFAULT '{"shiftReminders": true, "shiftStart": true, "shiftEnd": true, "incidentAlerts": true, "customAlerts": true}'::JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================================
-- ATTENDANCE TABLE
-- ============================================
-- Tracks daily attendance records for security guards
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_time TIMESTAMPTZ,
  check_in_location TEXT,
  check_in_latitude DOUBLE PRECISION,
  check_in_longitude DOUBLE PRECISION,
  check_out_time TIMESTAMPTZ,
  check_out_location TEXT,
  check_out_latitude DOUBLE PRECISION,
  check_out_longitude DOUBLE PRECISION,
  check_out_photo TEXT,  -- URL to stored photo
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'checked_in', 'checked_out', 'absent', 'late')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)  -- One attendance record per user per day
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);

-- ============================================
-- INCIDENTS TABLE
-- ============================================
-- Stores incident reports from security guards
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('security_breach', 'suspicious_activity', 'equipment_issue', 'other')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal')),
  description TEXT NOT NULL,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_incidents_user_id ON incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(type);
CREATE INDEX IF NOT EXISTS idx_incidents_priority ON incidents(priority);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at DESC);

-- ============================================
-- ANNOUNCEMENTS TABLE
-- ============================================
-- Stores announcements from supervisors to all guards
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal')),
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_announcements_sent_by ON announcements(sent_by);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);

-- ============================================
-- NOTIFICATION_LOG TABLE
-- ============================================
-- Logs all notifications sent for audit and tracking
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('shift_reminder', 'shift_start', 'shift_end', 'incident', 'announcement', 'custom')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  error TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_log_user_id ON notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log(type);
CREATE INDEX IF NOT EXISTS idx_notification_log_sent_at ON notification_log(sent_at DESC);

-- ============================================
-- SHIFTS TABLE (Optional - for future scheduling feature)
-- ============================================
-- Stores shift schedules for more complex scheduling
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location_name TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);

-- ============================================
-- REPORTS TABLE (Optional - for saved reports)
-- ============================================
-- Stores generated reports for historical access
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'custom')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  data JSONB NOT NULL,  -- Stores the report data as JSON
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_generated_by ON reports(generated_by);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

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

-- Users policies
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Supervisors can view all users" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'supervisor')
  );

CREATE POLICY "Supervisors can create security guards" ON users
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'supervisor')
  );

CREATE POLICY "Supervisors can update users" ON users
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'supervisor')
  );

CREATE POLICY "Supervisors can delete users" ON users
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'supervisor')
  );

-- Attendance policies
CREATE POLICY "Users can view their own attendance" ON attendance
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Supervisors can view all attendance" ON attendance
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'supervisor')
  );

CREATE POLICY "Users can create their own attendance" ON attendance
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own attendance" ON attendance
  FOR UPDATE USING (user_id = auth.uid());

-- Incidents policies
CREATE POLICY "All users can view incidents" ON incidents
  FOR SELECT USING (true);

CREATE POLICY "Users can create incidents" ON incidents
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Supervisors can update incidents" ON incidents
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'supervisor')
  );

-- Announcements policies
CREATE POLICY "All users can view announcements" ON announcements
  FOR SELECT USING (is_active = true);

CREATE POLICY "Supervisors can create announcements" ON announcements
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'supervisor')
  );

-- Notification log policies
CREATE POLICY "Users can view their own notifications" ON notification_log
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Supervisors can view all notifications" ON notification_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'supervisor')
  );

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

-- ============================================
-- SAMPLE DATA (For Testing - Remove in Production)
-- ============================================

-- Insert sample supervisor
-- INSERT INTO users (email, password_hash, full_name, phone, role)
-- VALUES ('supervisor@harekar.com', 'hashed_password_here', 'سەرپەرشتیار', '07501234567', 'supervisor');

-- Insert sample security guard
-- INSERT INTO users (email, password_hash, full_name, phone, role, shift_start_time, shift_end_time)
-- VALUES ('guard1@harekar.com', 'hashed_password_here', 'پاسەوان ١', '07507654321', 'security', '08:00:00', '16:00:00');

-- ============================================
-- NOTES
-- ============================================
--
-- Current Features Implemented:
-- 1. User Management (security guards and supervisors)
-- 2. Attendance Tracking (check-in/check-out with GPS)
-- 3. Incident Reporting (all guards can see all incidents)
-- 4. Push Notifications (shift reminders, incident alerts)
-- 5. Announcements (supervisor to all guards)
-- 6. Reports/Analytics (weekly/monthly stats)
--
-- Features stored in AsyncStorage (client-side only):
-- - Incidents (currently using AsyncStorage, migrate to this table)
-- - Notification settings
--
-- To migrate from AsyncStorage to Supabase:
-- 1. Create the incidents table using this schema
-- 2. Migrate existing incidents from AsyncStorage
-- 3. Update the app to use Supabase instead of AsyncStorage
