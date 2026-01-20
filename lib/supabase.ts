import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";

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

// ============================================
// TYPE DEFINITIONS
// ============================================

export type UserRole = "security" | "supervisor";

export interface NotificationSettings {
  shiftReminders: boolean;
  shiftStart: boolean;
  shiftEnd: boolean;
  incidentAlerts: boolean;
  announcementAlerts: boolean;
  customAlerts: boolean;
}

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
  notes?: string;
  push_token?: string;
  notification_settings?: NotificationSettings;
  is_active?: boolean;
  last_seen_at?: string;
  created_at: string;
  created_by?: string;
  updated_at?: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  shift_id?: string;
  date: string;
  check_in_time?: string;
  check_in_location?: string;
  check_in_latitude?: number;
  check_in_longitude?: number;
  check_in_photo_url?: string;
  check_out_time?: string;
  check_out_location?: string;
  check_out_latitude?: number;
  check_out_longitude?: number;
  check_out_photo?: string;
  status: "pending" | "checked_in" | "checked_out" | "absent" | "late";
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface AttendanceWithUser extends Attendance {
  user?: User;
}

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
  reporter_name?: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  created_by: string;
  priority: "urgent" | "normal";
  target_audience: "all" | "individual" | "supervisors" | "guards";
  target_user_id?: string;
  is_active: boolean;
  expires_at?: string;
  push_sent: boolean;
  push_sent_at?: string;
  created_at: string;
}

export interface AnnouncementWithUser extends Announcement {
  creator?: User;
}

export interface NotificationLog {
  id: string;
  user_id?: string;
  type: "shift_reminder" | "shift_start" | "shift_end" | "incident" | "announcement" | "custom";
  title: string;
  body: string;
  data?: Record<string, unknown>;
  push_token?: string;
  sent_at: string;
  delivered: boolean;
  delivered_at?: string;
  read_at?: string;
  error?: string;
  expo_receipt_id?: string;
}

export interface Shift {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  location_name?: string;
  location_address?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface ShiftWithUser extends Shift {
  user?: User;
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

export interface PushSubscription {
  id: string;
  user_id: string;
  push_token: string;
  device_name?: string;
  platform?: "ios" | "android" | "web";
  is_active: boolean;
  last_used_at: string;
  created_at: string;
  updated_at?: string;
}

export interface AppSettings {
  id: string;
  user_id: string;
  dark_mode: boolean;
  language: string;
  notification_sound: boolean;
  vibration: boolean;
  auto_check_in_reminder: boolean;
  created_at: string;
  updated_at?: string;
}

// ============================================
// STORAGE BUCKET NAMES
// ============================================

export const STORAGE_BUCKETS = {
  INCIDENTS_PHOTOS: "incidents-photos",
  ATTENDANCE_PHOTOS: "attendance-photos",
  AVATARS: "avatars",
} as const;

// ============================================
// STORAGE HELPER FUNCTIONS
// ============================================

/**
 * Convert a local file URI to a Blob for upload
 */
const uriToBlob = async (uri: string): Promise<Blob> => {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    return response.blob();
  }

  // For native platforms, use FileSystem to read the file
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Convert base64 to blob
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: "image/jpeg" });
};

/**
 * Convert base64 string to Blob
 */
const base64ToBlob = (base64: string, mimeType: string = "image/jpeg"): Blob => {
  // Remove data URL prefix if present
  const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

/**
 * Upload an image to Supabase Storage
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @param imageUri - The local image URI or base64 string
 * @returns The public URL of the uploaded image, or null if failed
 */
export const uploadImage = async (
  bucket: string,
  path: string,
  imageUri: string
): Promise<string | null> => {
  try {
    let blob: Blob;

    // Check if it's a base64 string
    if (imageUri.startsWith("data:")) {
      blob = base64ToBlob(imageUri);
    } else {
      blob = await uriToBlob(imageUri);
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (error) {
    console.error("Error uploading image:", error);
    return null;
  }
};

/**
 * Upload an incident photo
 */
export const uploadIncidentPhoto = async (
  incidentId: string,
  imageUri: string
): Promise<string | null> => {
  const fileName = `${incidentId}_${Date.now()}.jpg`;
  const path = `incidents/${fileName}`;
  return uploadImage(STORAGE_BUCKETS.INCIDENTS_PHOTOS, path, imageUri);
};

/**
 * Upload an attendance check-out photo
 */
export const uploadAttendancePhoto = async (
  userId: string,
  date: string,
  imageUri: string
): Promise<string | null> => {
  const fileName = `${userId}_${date}_${Date.now()}.jpg`;
  const path = `checkout/${fileName}`;
  return uploadImage(STORAGE_BUCKETS.ATTENDANCE_PHOTOS, path, imageUri);
};

/**
 * Upload a user avatar
 */
export const uploadAvatar = async (
  userId: string,
  imageUri: string
): Promise<string | null> => {
  const fileName = `${userId}_${Date.now()}.jpg`;
  const path = `avatars/${fileName}`;
  return uploadImage(STORAGE_BUCKETS.AVATARS, path, imageUri);
};

/**
 * Delete an image from Supabase Storage
 */
export const deleteImage = async (
  bucket: string,
  path: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      console.error("Delete error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error deleting image:", error);
    return false;
  }
};

/**
 * Get signed URL for private bucket access
 */
export const getSignedUrl = async (
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error("Signed URL error:", error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error("Error getting signed URL:", error);
    return null;
  }
};

// ============================================
// DATABASE HELPER FUNCTIONS
// ============================================

/**
 * Register or update push token for a user
 */
export const registerPushToken = async (
  userId: string,
  pushToken: string,
  platform?: "ios" | "android" | "web",
  deviceName?: string
): Promise<boolean> => {
  try {
    // Update user's push_token field
    await supabase
      .from("users")
      .update({ push_token: pushToken })
      .eq("id", userId);

    // Upsert into push_subscriptions
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert({
        user_id: userId,
        push_token: pushToken,
        platform,
        device_name: deviceName,
        is_active: true,
        last_used_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,push_token",
      });

    if (error) {
      console.error("Error registering push token:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error registering push token:", error);
    return false;
  }
};

/**
 * Deactivate a push token
 */
export const deactivatePushToken = async (
  userId: string,
  pushToken: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from("push_subscriptions")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("push_token", pushToken);

    if (error) {
      console.error("Error deactivating push token:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deactivating push token:", error);
    return false;
  }
};

/**
 * Get all active push tokens for sending notifications
 */
export const getActivePushTokens = async (
  targetType: "all" | "individual" | "supervisors" = "all",
  targetUserId?: string
): Promise<Array<{ user_id: string; push_token: string }>> => {
  try {
    let query = supabase
      .from("push_subscriptions")
      .select("user_id, push_token, users!inner(role, is_active, notification_settings)")
      .eq("is_active", true)
      .eq("users.is_active", true);

    if (targetType === "individual" && targetUserId) {
      query = query.eq("user_id", targetUserId);
    } else if (targetType === "supervisors") {
      query = query.eq("users.role", "supervisor");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching push tokens:", error);
      return [];
    }

    return (data || []).map((item: any) => ({
      user_id: item.user_id,
      push_token: item.push_token,
    }));
  } catch (error) {
    console.error("Error fetching push tokens:", error);
    return [];
  }
};

/**
 * Log a notification to the database
 */
export const logNotification = async (
  userId: string,
  title: string,
  body: string,
  type: NotificationLog["type"],
  senderId?: string,
  data?: Record<string, unknown>,
  pushToken?: string
): Promise<string | null> => {
  try {
    const { data: result, error } = await supabase
      .from("notification_log")
      .insert({
        user_id: userId,
        title,
        body,
        type,
        data: data || null,
        push_token: pushToken || null,
        delivered: false,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error logging notification:", error);
      return null;
    }

    return result.id;
  } catch (error) {
    console.error("Error logging notification:", error);
    return null;
  }
};

/**
 * Update notification delivery status
 */
export const updateNotificationStatus = async (
  notificationId: string,
  delivered: boolean,
  error?: string
): Promise<boolean> => {
  try {
    const { error: updateError } = await supabase
      .from("notification_log")
      .update({
        delivered,
        delivered_at: delivered ? new Date().toISOString() : undefined,
        error,
      })
      .eq("id", notificationId);

    if (updateError) {
      console.error("Error updating notification status:", updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error updating notification status:", error);
    return false;
  }
};

/**
 * Get or create user's app settings
 */
export const getAppSettings = async (userId: string): Promise<AppSettings | null> => {
  try {
    let { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code === "PGRST116") {
      // No settings found, create default
      const { data: newData, error: insertError } = await supabase
        .from("app_settings")
        .insert({
          user_id: userId,
          dark_mode: false,
          language: "ku",
          notification_sound: true,
          vibration: true,
          auto_check_in_reminder: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating app settings:", insertError);
        return null;
      }

      return newData;
    }

    if (error) {
      console.error("Error fetching app settings:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error fetching app settings:", error);
    return null;
  }
};

/**
 * Update user's app settings
 */
export const updateAppSettings = async (
  userId: string,
  settings: Partial<Omit<AppSettings, "id" | "user_id" | "created_at" | "updated_at">>
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from("app_settings")
      .update(settings)
      .eq("user_id", userId);

    if (error) {
      console.error("Error updating app settings:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error updating app settings:", error);
    return false;
  }
};

/**
 * Create an announcement and optionally send push notifications
 */
export const createAnnouncement = async (
  announcement: Omit<Announcement, "id" | "created_at" | "push_sent" | "push_sent_at">
): Promise<{ id: string; success: boolean }> => {
  try {
    const { data, error } = await supabase
      .from("announcements")
      .insert(announcement)
      .select("id")
      .single();

    if (error) {
      console.error("Error creating announcement:", error);
      return { id: "", success: false };
    }

    return { id: data.id, success: true };
  } catch (error) {
    console.error("Error creating announcement:", error);
    return { id: "", success: false };
  }
};

/**
 * Mark announcement push as sent
 */
export const markAnnouncementPushSent = async (announcementId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from("announcements")
      .update({
        push_sent: true,
        push_sent_at: new Date().toISOString(),
      })
      .eq("id", announcementId);

    if (error) {
      console.error("Error marking announcement push sent:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error marking announcement push sent:", error);
    return false;
  }
};

// ============================================
// INCIDENT HELPER FUNCTIONS
// ============================================

/**
 * Create a new incident with optional photo
 */
export const createIncident = async (
  incident: Omit<Incident, "id" | "created_at" | "updated_at">,
  photoUri?: string
): Promise<{ id: string; success: boolean }> => {
  try {
    // First create the incident to get the ID
    const { data, error } = await supabase
      .from("incidents")
      .insert({
        ...incident,
        photo_url: null, // Will update after photo upload
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating incident:", error);
      return { id: "", success: false };
    }

    // If there's a photo, upload it and update the incident
    if (photoUri && data.id) {
      const photoUrl = await uploadIncidentPhoto(data.id, photoUri);
      if (photoUrl) {
        await supabase
          .from("incidents")
          .update({ photo_url: photoUrl })
          .eq("id", data.id);
      }
    }

    return { id: data.id, success: true };
  } catch (error) {
    console.error("Error creating incident:", error);
    return { id: "", success: false };
  }
};

/**
 * Get incidents with user information
 */
export const getIncidentsWithUsers = async (
  options?: {
    status?: Incident["status"];
    type?: Incident["type"];
    limit?: number;
    offset?: number;
  }
): Promise<IncidentWithUser[]> => {
  try {
    let query = supabase
      .from("incidents")
      .select("*, users!incidents_user_id_fkey(full_name, email, avatar_url)")
      .order("created_at", { ascending: false });

    if (options?.status) {
      query = query.eq("status", options.status);
    }
    if (options?.type) {
      query = query.eq("type", options.type);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching incidents:", error);
      return [];
    }

    return (data || []).map((incident: any) => ({
      ...incident,
      user: incident.users,
      reporter_name: incident.users?.full_name,
    }));
  } catch (error) {
    console.error("Error fetching incidents:", error);
    return [];
  }
};

/**
 * Update incident status
 */
export const updateIncidentStatus = async (
  incidentId: string,
  status: Incident["status"],
  resolvedBy?: string,
  resolutionNotes?: string
): Promise<boolean> => {
  try {
    const updateData: Partial<Incident> = {
      status,
    };

    if (status === "resolved") {
      updateData.resolved_at = new Date().toISOString();
      updateData.resolved_by = resolvedBy;
      updateData.resolution_notes = resolutionNotes;
    }

    const { error } = await supabase
      .from("incidents")
      .update(updateData)
      .eq("id", incidentId);

    if (error) {
      console.error("Error updating incident status:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error updating incident status:", error);
    return false;
  }
};

// ============================================
// ATTENDANCE HELPER FUNCTIONS
// ============================================

/**
 * Check out with photo upload to Supabase Storage
 */
export const checkOutWithPhoto = async (
  attendanceId: string,
  userId: string,
  photoUri: string,
  location: {
    address: string;
    latitude: number;
    longitude: number;
  }
): Promise<boolean> => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Upload photo to Supabase Storage
    const photoUrl = await uploadAttendancePhoto(userId, today, photoUri);

    const { error } = await supabase
      .from("attendance")
      .update({
        check_out_time: new Date().toISOString(),
        check_out_location: location.address,
        check_out_latitude: location.latitude,
        check_out_longitude: location.longitude,
        check_out_photo: photoUrl || photoUri, // Fallback to original URI if upload fails
        status: "checked_out",
      })
      .eq("id", attendanceId);

    if (error) {
      console.error("Error checking out:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error checking out:", error);
    return false;
  }
};
