-- Harekar Group Security Management App - Supabase Schema
-- Execute this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for employees (security guards and supervisors)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('security', 'supervisor')),
  avatar_url TEXT,
  -- Shift times for security guards (assigned by supervisor)
  shift_start_time TIME DEFAULT '08:00:00',
  shift_end_time TIME DEFAULT '16:00:00',
  -- Location assignment
  location_name TEXT,
  location_address TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance table for tracking check-ins and check-outs
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Check-in data
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_in_location TEXT,
  check_in_latitude DOUBLE PRECISION,
  check_in_longitude DOUBLE PRECISION,
  -- Check-out data
  check_out_time TIMESTAMP WITH TIME ZONE,
  check_out_location TEXT,
  check_out_latitude DOUBLE PRECISION,
  check_out_longitude DOUBLE PRECISION,
  check_out_photo TEXT, -- URL to the photo taken during check-out
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'checked_in', 'checked_out', 'absent', 'late')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure one attendance record per user per day
  UNIQUE(user_id, date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by);
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_attendance_updated_at ON attendance;
CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert a default supervisor account (password: admin123)
INSERT INTO users (email, password_hash, full_name, phone, role)
VALUES (
  'supervisor@harekar.com',
  'admin123',
  'سەرپەرشتیار',
  '+964750123456',
  'supervisor'
) ON CONFLICT (email) DO NOTHING;

-- Insert sample security guards for testing
INSERT INTO users (email, password_hash, full_name, phone, role, shift_start_time, shift_end_time, location_name, location_address, created_by)
SELECT
  'guard1@harekar.com',
  'guard123',
  'ئەحمەد خان',
  '+964750123457',
  'security',
  '08:00:00',
  '16:00:00',
  'بینای سەرەکی',
  'شەقامی ئەمنیەت ١٢٣، ناوەند',
  (SELECT id FROM users WHERE email = 'supervisor@harekar.com')
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'guard1@harekar.com');

INSERT INTO users (email, password_hash, full_name, phone, role, shift_start_time, shift_end_time, location_name, location_address, created_by)
SELECT
  'guard2@harekar.com',
  'guard123',
  'محەمەد عەلی',
  '+964750123458',
  'security',
  '16:00:00',
  '00:00:00',
  'دەروازەی ڕۆژئاوا',
  'شەقامی ڕۆژئاوا ٤٥٦، ناوچەی پیشەسازی',
  (SELECT id FROM users WHERE email = 'supervisor@harekar.com')
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'guard2@harekar.com');

INSERT INTO users (email, password_hash, full_name, phone, role, shift_start_time, shift_end_time, location_name, location_address, created_by)
SELECT
  'guard3@harekar.com',
  'guard123',
  'یوسف حەسەن',
  '+964750123459',
  'security',
  '00:00:00',
  '08:00:00',
  'پارکینگ',
  'هێڵی پارکینگ ٧٨٩، ناوچەی باکوور',
  (SELECT id FROM users WHERE email = 'supervisor@harekar.com')
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'guard3@harekar.com');

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies (simplified for demo - in production, use proper auth)
CREATE POLICY "Allow all users operations" ON users FOR ALL USING (true);
CREATE POLICY "Allow all attendance operations" ON attendance FOR ALL USING (true);
