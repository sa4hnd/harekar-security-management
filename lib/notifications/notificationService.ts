import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const NOTIFICATION_STORAGE_KEY = "@harekar_notifications";
const PUSH_TOKEN_KEY = "@harekar_push_token";

export interface ScheduledNotification {
  id: string;
  identifier: string;
  type: "shift_reminder" | "shift_start" | "shift_end" | "incident" | "custom";
  scheduledTime: string;
  title: string;
  body: string;
}

/**
 * Request notification permissions
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (Platform.OS === "web") {
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === "granted";
};

/**
 * Get the Expo push token for this device
 */
export const getExpoPushToken = async (): Promise<string | null> => {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return null;
    }

    // In development/preview mode, projectId may not be available
    // We'll still allow local notifications to work without push tokens
    try {
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: undefined, // Will use projectId from app.json/app.config.js if available
      });
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token.data);
      return token.data;
    } catch (tokenError) {
      // Push tokens require a projectId which isn't available in preview mode
      // Local notifications will still work without a push token
      console.log("Push token not available (preview mode) - local notifications still work");
      return null;
    }
  } catch (error) {
    console.error("Error in notification setup:", error);
    return null;
  }
};

/**
 * Schedule a local notification
 */
export const scheduleNotification = async (
  title: string,
  body: string,
  triggerDate: Date,
  data?: Record<string, unknown>
): Promise<string | null> => {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    return identifier;
  } catch (error) {
    console.error("Error scheduling notification:", error);
    return null;
  }
};

/**
 * Schedule shift reminder notifications
 * @param shiftStartTime - The shift start time in HH:MM:SS format
 * @param userId - The user ID for tracking
 */
export const scheduleShiftReminders = async (
  shiftStartTime: string,
  userId: string
): Promise<void> => {
  if (Platform.OS === "web") {
    return;
  }

  // Cancel any existing shift reminders
  await cancelShiftReminders(userId);

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const [hours, minutes] = shiftStartTime.split(":");
  const shiftStart = new Date(`${today}T${shiftStartTime}`);

  // If shift has already passed today, schedule for tomorrow
  if (shiftStart <= now) {
    shiftStart.setDate(shiftStart.getDate() + 1);
  }

  const scheduledNotifications: ScheduledNotification[] = [];

  // 30 minutes before
  const thirtyMinBefore = new Date(shiftStart.getTime() - 30 * 60 * 1000);
  if (thirtyMinBefore > now) {
    const id30 = await scheduleNotification(
      "Shift Reminder",
      "Your shift starts in 30 minutes. Please prepare to check in.",
      thirtyMinBefore,
      { type: "shift_reminder", minutes: 30, userId }
    );
    if (id30) {
      scheduledNotifications.push({
        id: `${userId}_30min`,
        identifier: id30,
        type: "shift_reminder",
        scheduledTime: thirtyMinBefore.toISOString(),
        title: "Shift Reminder",
        body: "Your shift starts in 30 minutes",
      });
    }
  }

  // 10 minutes before
  const tenMinBefore = new Date(shiftStart.getTime() - 10 * 60 * 1000);
  if (tenMinBefore > now) {
    const id10 = await scheduleNotification(
      "Shift Starting Soon",
      "Your shift starts in 10 minutes. Please check in soon!",
      tenMinBefore,
      { type: "shift_reminder", minutes: 10, userId }
    );
    if (id10) {
      scheduledNotifications.push({
        id: `${userId}_10min`,
        identifier: id10,
        type: "shift_reminder",
        scheduledTime: tenMinBefore.toISOString(),
        title: "Shift Starting Soon",
        body: "Your shift starts in 10 minutes",
      });
    }
  }

  // At shift start time
  if (shiftStart > now) {
    const idStart = await scheduleNotification(
      "Shift Started",
      "Your shift has started. Please check in now!",
      shiftStart,
      { type: "shift_start", userId }
    );
    if (idStart) {
      scheduledNotifications.push({
        id: `${userId}_start`,
        identifier: idStart,
        type: "shift_start",
        scheduledTime: shiftStart.toISOString(),
        title: "Shift Started",
        body: "Please check in now",
      });
    }
  }

  // Save scheduled notifications
  await saveScheduledNotifications(userId, scheduledNotifications);
};

/**
 * Schedule shift end reminder
 * @param shiftEndTime - The shift end time in HH:MM:SS format
 * @param userId - The user ID for tracking
 */
export const scheduleShiftEndReminders = async (
  shiftEndTime: string,
  userId: string
): Promise<void> => {
  if (Platform.OS === "web") {
    return;
  }

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const shiftEnd = new Date(`${today}T${shiftEndTime}`);

  // If shift end has already passed today, schedule for tomorrow
  if (shiftEnd <= now) {
    shiftEnd.setDate(shiftEnd.getDate() + 1);
  }

  // 10 minutes before shift end
  const tenMinBefore = new Date(shiftEnd.getTime() - 10 * 60 * 1000);
  if (tenMinBefore > now) {
    await scheduleNotification(
      "Shift Ending Soon",
      "Your shift ends in 10 minutes. Please prepare to check out.",
      tenMinBefore,
      { type: "shift_end_reminder", minutes: 10, userId }
    );
  }

  // At shift end time
  if (shiftEnd > now) {
    await scheduleNotification(
      "Shift Ended",
      "Your shift has ended. Please check out now!",
      shiftEnd,
      { type: "shift_end", userId }
    );
  }
};

/**
 * Cancel all shift reminders for a user
 */
export const cancelShiftReminders = async (userId: string): Promise<void> => {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (stored) {
      const allNotifications: Record<string, ScheduledNotification[]> = JSON.parse(stored);
      const userNotifications = allNotifications[userId] || [];

      for (const notification of userNotifications) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }

      delete allNotifications[userId];
      await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(allNotifications));
    }
  } catch (error) {
    console.error("Error canceling shift reminders:", error);
  }
};

/**
 * Save scheduled notifications to storage
 */
const saveScheduledNotifications = async (
  userId: string,
  notifications: ScheduledNotification[]
): Promise<void> => {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
    const allNotifications: Record<string, ScheduledNotification[]> = stored
      ? JSON.parse(stored)
      : {};

    allNotifications[userId] = notifications;
    await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(allNotifications));
  } catch (error) {
    console.error("Error saving scheduled notifications:", error);
  }
};

/**
 * Send an immediate local notification
 */
export const sendImmediateNotification = async (
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> => {
  if (Platform.OS === "web") {
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null, // Immediate
    });
  } catch (error) {
    console.error("Error sending immediate notification:", error);
  }
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem(NOTIFICATION_STORAGE_KEY);
  } catch (error) {
    console.error("Error canceling all notifications:", error);
  }
};

/**
 * Get all scheduled notifications
 */
export const getScheduledNotifications = async (): Promise<Notifications.NotificationRequest[]> => {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error("Error getting scheduled notifications:", error);
    return [];
  }
};

/**
 * Add a notification response listener
 */
export const addNotificationResponseListener = (
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

/**
 * Add a notification received listener (foreground)
 */
export const addNotificationReceivedListener = (
  callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription => {
  return Notifications.addNotificationReceivedListener(callback);
};
