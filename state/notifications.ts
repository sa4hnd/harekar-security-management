import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface NotificationSettings {
  shiftReminders: boolean;
  shiftStart: boolean;
  shiftEnd: boolean;
  incidentAlerts: boolean;
  customAlerts: boolean;
}

interface NotificationState {
  settings: NotificationSettings;
  pushToken: string | null;
  isInitialized: boolean;
  setSettings: (settings: Partial<NotificationSettings>) => void;
  setPushToken: (token: string | null) => void;
  setInitialized: (initialized: boolean) => void;
  reset: () => void;
}

const defaultSettings: NotificationSettings = {
  shiftReminders: true,
  shiftStart: true,
  shiftEnd: true,
  incidentAlerts: true,
  customAlerts: true,
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      pushToken: null,
      isInitialized: false,
      setSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      setPushToken: (token) => set({ pushToken: token }),
      setInitialized: (initialized) => set({ isInitialized: initialized }),
      reset: () => set({ settings: defaultSettings, pushToken: null, isInitialized: false }),
    }),
    {
      name: "notification-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        settings: state.settings,
        pushToken: state.pushToken,
      }),
    }
  )
);
