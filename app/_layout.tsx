import { Stack } from "expo-router";
import { AuthProvider, useAuth } from "@/state/auth";
import { I18nManager, Platform } from "react-native";
import { useEffect } from "react";
import {
  requestNotificationPermissions,
  getExpoPushToken,
  scheduleShiftReminders,
  scheduleShiftEndReminders,
  addNotificationResponseListener,
} from "@/lib/notifications/notificationService";
import { registerDevicePushToken } from "@/lib/notifications/pushService";
import { useNotificationStore } from "@/state/notifications";

// Enable RTL for Kurdish/Arabic
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

function NotificationInitializer() {
  const { user } = useAuth();
  const { settings, setPushToken, pushToken, isInitialized, setInitialized } = useNotificationStore();

  // Initialize notifications and get push token
  useEffect(() => {
    const initializeNotifications = async () => {
      if (Platform.OS === "web" || isInitialized) return;

      const hasPermission = await requestNotificationPermissions();
      if (hasPermission) {
        const token = await getExpoPushToken();
        if (token) {
          setPushToken(token);
        }
      }
      setInitialized(true);
    };

    initializeNotifications();
  }, []);

  // Register push token with database when user logs in
  useEffect(() => {
    const registerToken = async () => {
      if (Platform.OS === "web" || !user || !pushToken) return;

      // Register the push token with the database
      const success = await registerDevicePushToken(user.id, pushToken);
      if (success) {
        console.log("Push token registered with database");
      }
    };

    registerToken();
  }, [user?.id, pushToken]);

  // Schedule shift reminders when user is logged in and has shift times
  useEffect(() => {
    const setupShiftNotifications = async () => {
      if (
        Platform.OS === "web" ||
        !user ||
        user.role === "supervisor" ||
        !settings.shiftReminders
      ) {
        return;
      }

      if (user.shift_start_time && settings.shiftStart) {
        await scheduleShiftReminders(user.shift_start_time, user.id);
      }

      if (user.shift_end_time && settings.shiftEnd) {
        await scheduleShiftEndReminders(user.shift_end_time, user.id);
      }
    };

    setupShiftNotifications();
  }, [user, settings.shiftReminders, settings.shiftStart, settings.shiftEnd]);

  // Handle notification tap
  useEffect(() => {
    const subscription = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      // Handle notification tap based on type
      if (data.type === "incident") {
        // Navigate to incidents screen
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <NotificationInitializer />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="exit-camera" options={{ presentation: "fullScreenModal" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
