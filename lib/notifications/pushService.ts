import { Platform } from "react-native";
import { supabase, logNotification, getActivePushTokens } from "@/lib/supabase";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushNotificationPayload {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  priority?: "default" | "normal" | "high";
  channelId?: string;
}

export interface PushNotificationResult {
  success: boolean;
  totalSent: number;
  totalFailed: number;
  errors?: string[];
}

/**
 * Send a push notification to a single Expo push token
 */
export const sendPushNotification = async (
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<boolean> => {
  try {
    if (!pushToken || !pushToken.startsWith("ExponentPushToken")) {
      console.log("Invalid push token:", pushToken);
      return false;
    }

    const message: PushNotificationPayload = {
      to: pushToken,
      title,
      body,
      data: data || {},
      sound: "default",
      priority: "high",
    };

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (result.data?.status === "ok") {
      return true;
    }

    console.error("Push notification failed:", result);
    return false;
  } catch (error) {
    console.error("Error sending push notification:", error);
    return false;
  }
};

/**
 * Send push notifications to multiple users and log to Supabase
 * @param tokens - Array of { user_id, push_token }
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Optional data payload
 * @param senderId - Optional sender user ID for logging
 */
export const sendPushNotificationsToUsers = async (
  tokens: Array<{ user_id: string; push_token: string }>,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  senderId?: string
): Promise<PushNotificationResult> => {
  const result: PushNotificationResult = {
    success: true,
    totalSent: 0,
    totalFailed: 0,
    errors: [],
  };

  if (!tokens || tokens.length === 0) {
    return result;
  }

  // Filter valid Expo push tokens
  const validTokens = tokens.filter(
    (t) => t.push_token && t.push_token.startsWith("ExponentPushToken")
  );

  if (validTokens.length === 0) {
    result.errors?.push("No valid Expo push tokens found");
    return result;
  }

  // Batch send notifications (Expo supports up to 100 per request)
  const batchSize = 100;
  const batches: PushNotificationPayload[][] = [];

  for (let i = 0; i < validTokens.length; i += batchSize) {
    const batchTokens = validTokens.slice(i, i + batchSize);
    const batchMessages = batchTokens.map((t) => ({
      to: t.push_token,
      title,
      body,
      data: data || {},
      sound: "default" as const,
      priority: "high" as const,
    }));
    batches.push(batchMessages);
  }

  // Send all batches
  for (const batch of batches) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });

      const responseData = await response.json();

      if (responseData.data && Array.isArray(responseData.data)) {
        for (const item of responseData.data) {
          if (item.status === "ok") {
            result.totalSent++;
          } else {
            result.totalFailed++;
            if (item.message) {
              result.errors?.push(item.message);
            }
          }
        }
      }
    } catch (error) {
      result.totalFailed += batch.length;
      result.errors?.push(String(error));
    }
  }

  result.success = result.totalFailed === 0;
  return result;
};

/**
 * Send notification to all users
 */
export const sendNotificationToAll = async (
  title: string,
  body: string,
  data?: Record<string, unknown>,
  senderId?: string
): Promise<PushNotificationResult> => {
  const tokens = await getActivePushTokens("all");
  const result = await sendPushNotificationsToUsers(tokens, title, body, data, senderId);

  // Log to Supabase for each recipient
  for (const token of tokens) {
    await logNotification(
      token.user_id,
      title,
      body,
      data?.type as string || "announcement",
      senderId
    );
  }

  return result;
};

/**
 * Send notification to supervisors only
 */
export const sendNotificationToSupervisors = async (
  title: string,
  body: string,
  data?: Record<string, unknown>,
  senderId?: string
): Promise<PushNotificationResult> => {
  const tokens = await getActivePushTokens("supervisors");
  const result = await sendPushNotificationsToUsers(tokens, title, body, data, senderId);

  // Log to Supabase for each recipient
  for (const token of tokens) {
    await logNotification(
      token.user_id,
      title,
      body,
      data?.type as string || "supervisor_alert",
      senderId
    );
  }

  return result;
};

/**
 * Send notification to a specific user
 */
export const sendNotificationToUser = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  senderId?: string
): Promise<PushNotificationResult> => {
  const tokens = await getActivePushTokens("individual", userId);
  const result = await sendPushNotificationsToUsers(tokens, title, body, data, senderId);

  // Log to Supabase
  await logNotification(
    userId,
    title,
    body,
    data?.type as string || "direct_message",
    senderId
  );

  return result;
};

/**
 * Send incident notification to all users
 */
export const sendIncidentNotification = async (
  incidentId: string,
  incidentType: string,
  reporterName: string,
  location?: string,
  senderId?: string
): Promise<PushNotificationResult> => {
  const title = "New Incident Reported";
  const body = location
    ? `${reporterName} reported a ${incidentType.replace(/_/g, " ")} at ${location}`
    : `${reporterName} reported a ${incidentType.replace(/_/g, " ")}`;

  const data = {
    type: "incident",
    incidentId,
    incidentType,
  };

  return sendNotificationToAll(title, body, data, senderId);
};

/**
 * Send announcement notification
 */
export const sendAnnouncementNotification = async (
  announcementId: string,
  title: string,
  message: string,
  targetType: "all" | "supervisors" | "guards",
  senderId?: string,
  priority?: "normal" | "urgent"
): Promise<PushNotificationResult> => {
  const priorityEmoji = priority === "urgent" ? "🚨 " : "";
  const notificationTitle = priorityEmoji + "New Announcement";
  const notificationBody = `${title}: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`;

  const data = {
    type: "announcement",
    announcementId,
    priority,
  };

  if (targetType === "supervisors") {
    return sendNotificationToSupervisors(notificationTitle, notificationBody, data, senderId);
  }

  // For "all" and "guards", send to everyone
  return sendNotificationToAll(notificationTitle, notificationBody, data, senderId);
};

/**
 * Send attendance reminder notification
 */
export const sendAttendanceReminder = async (
  userId: string,
  reminderType: "check_in" | "check_out",
  shiftTime: string,
  senderId?: string
): Promise<PushNotificationResult> => {
  const title = reminderType === "check_in" ? "Check-In Reminder" : "Check-Out Reminder";
  const body =
    reminderType === "check_in"
      ? `Your shift starts at ${shiftTime}. Please check in.`
      : `Your shift ends at ${shiftTime}. Please check out.`;

  const data = {
    type: "attendance_reminder",
    reminderType,
    shiftTime,
  };

  return sendNotificationToUser(userId, title, body, data, senderId);
};

/**
 * Register device push token with Supabase
 */
export const registerDevicePushToken = async (
  userId: string,
  pushToken: string
): Promise<boolean> => {
  try {
    const platform = Platform.OS as "ios" | "android" | "web";

    // Update user's push_token field
    const { error: userError } = await supabase
      .from("users")
      .update({ push_token: pushToken })
      .eq("id", userId);

    if (userError) {
      console.error("Error updating user push token:", userError);
    }

    // Upsert into push_subscriptions for tracking multiple devices
    const { error: subError } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          push_token: pushToken,
          platform,
          is_active: true,
          last_used_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,push_token",
        }
      );

    if (subError) {
      console.error("Error upserting push subscription:", subError);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error registering push token:", error);
    return false;
  }
};

/**
 * Unregister device push token
 */
export const unregisterDevicePushToken = async (
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
      console.error("Error unregistering push token:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error unregistering push token:", error);
    return false;
  }
};
