import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = "https://hecyfnjahvmcegtunvdq.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlY3lmbmphaHZtY2VndHVudmRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMzY1MjcsImV4cCI6MjA3NjgxMjUyN30.p9r2XHdgZ51WumLTEfDJdobWZhBGS3qIejF2UvTij80";

const isWeb = typeof window !== "undefined" && typeof document !== "undefined";

const memoryStorage: { [key: string]: string } = {};

const createStorage = () => {
  if (isWeb) {
    return {
      getItem: (key: string) => {
        try {
          return window.localStorage?.getItem(key) ?? memoryStorage[key] ?? null;
        } catch {
          return memoryStorage[key] ?? null;
        }
      },
      setItem: (key: string, value: string) => {
        try {
          window.localStorage?.setItem(key, value);
        } catch {
          memoryStorage[key] = value;
        }
      },
      removeItem: (key: string) => {
        try {
          window.localStorage?.removeItem(key);
        } catch {
          delete memoryStorage[key];
        }
      },
    };
  }

  return {
    getItem: (key: string) => memoryStorage[key] ?? null,
    setItem: (key: string, value: string) => { memoryStorage[key] = value; },
    removeItem: (key: string) => { delete memoryStorage[key]; },
  };
};

let _supabase: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: createStorage(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return _supabase;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type UserRole = "security" | "supervisor";

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: UserRole;
  avatar_url?: string;
  shift_start_time?: string;
  shift_end_time?: string;
  location_name?: string;
  location_address?: string;
  created_at: string;
  created_by?: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  date: string;
  check_in_time?: string;
  check_in_location?: string;
  check_in_latitude?: number;
  check_in_longitude?: number;
  check_out_time?: string;
  check_out_location?: string;
  check_out_latitude?: number;
  check_out_longitude?: number;
  check_out_photo?: string;
  status: "pending" | "checked_in" | "checked_out" | "absent" | "late";
  notes?: string;
  created_at: string;
}

export interface AttendanceWithUser extends Attendance {
  user?: User;
}

// ============================================
// NEW TABLE INTERFACES
// ============================================

export interface Incident {
  id: string;
  user_id: string;
  type: "security_breach" | "suspicious_activity" | "equipment_issue" | "other";
  priority: "urgent" | "normal";
  description: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  photo_url?: string;
  status: "pending" | "in_progress" | "resolved";
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface IncidentWithUser extends Incident {
  user?: User;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  sent_by: string;
  priority: "urgent" | "normal";
  is_active: boolean;
  expires_at?: string;
  created_at: string;
}

export interface AnnouncementWithUser extends Announcement {
  sender?: User;
}

export interface NotificationLog {
  id: string;
  user_id?: string;
  type: "shift_reminder" | "shift_start" | "shift_end" | "incident" | "announcement" | "custom";
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sent_at: string;
  delivered: boolean;
  read_at?: string;
  error?: string;
}

export interface Shift {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  location_name?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface Report {
  id: string;
  generated_by: string;
  report_type: "daily" | "weekly" | "monthly" | "custom";
  period_start: string;
  period_end: string;
  data: Record<string, unknown>;
  created_at: string;
}
