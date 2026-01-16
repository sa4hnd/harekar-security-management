import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

interface NotificationSettings {
  shiftReminders: boolean;
  shiftStart: boolean;
  shiftEnd: boolean;
  incidentAlerts: boolean;
  announcementAlerts: boolean;
  customAlerts: boolean;
}

interface NotificationState {
  settings: NotificationSettings;
  pushToken: string | null;
  isInitialized: boolean;
  userId: string | null;
  setSettings: (settings: Partial<NotificationSettings>) => void;
  setPushToken: (token: string | null, userId?: string) => void;
  setInitialized: (initialized: boolean) => void;
  setUserId: (userId: string | null) => void;
  loadFromSupabase: (userId: string) => Promise<void>;
  saveToSupabase: () => Promise<void>;
  reset: () => void;
}

const defaultSettings: NotificationSettings = {
  shiftReminders: true,
  shiftStart: true,
  shiftEnd: true,
  incidentAlerts: true,
  announcementAlerts: true,
  customAlerts: true,
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      pushToken: null,
      isInitialized: false,
      userId: null,

      setSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
        // Sync to Supabase
        get().saveToSupabase();
      },

      setPushToken: async (token, userId) => {
        set({ pushToken: token });

        const currentUserId = userId || get().userId;
        if (token && currentUserId) {
          try {
            // Update user's push_token in Supabase
            await supabase
              .from("users")
              .update({ push_token: token })
              .eq("id", currentUserId);

            // Also upsert into push_subscriptions for tracking
            await supabase.from("push_subscriptions").upsert(
              {
                user_id: currentUserId,
                push_token: token,
                platform: "ios",
                is_active: true,
                last_used_at: new Date().toISOString(),
              },
              { onConflict: "user_id,push_token" }
            );
          } catch (error) {
            console.error("Error saving push token to Supabase:", error);
          }
        }
      },

      setInitialized: (initialized) => set({ isInitialized: initialized }),

      setUserId: (userId) => set({ userId }),

      loadFromSupabase: async (userId: string) => {
        try {
          set({ userId });

          // Load notification settings from user record
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("notification_settings, push_token")
            .eq("id", userId)
            .single();

          if (userData && !userError) {
            if (userData.notification_settings) {
              set({
                settings: { ...defaultSettings, ...userData.notification_settings },
              });
            }
            if (userData.push_token) {
              set({ pushToken: userData.push_token });
            }
          }
        } catch (error) {
          console.error("Error loading notification settings from Supabase:", error);
        }
      },

      saveToSupabase: async () => {
        const state = get();
        if (!state.userId) return;

        try {
          await supabase
            .from("users")
            .update({
              notification_settings: state.settings,
              updated_at: new Date().toISOString(),
            })
            .eq("id", state.userId);
        } catch (error) {
          console.error("Error saving notification settings to Supabase:", error);
        }
      },

      reset: () =>
        set({
          settings: defaultSettings,
          pushToken: null,
          isInitialized: false,
          userId: null,
        }),
    }),
    {
      name: "notification-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        settings: state.settings,
        pushToken: state.pushToken,
        userId: state.userId,
      }),
    }
  )
);
