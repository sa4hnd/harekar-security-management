import { useState, useEffect } from "react";
import createContextHook from "@nkzw/create-context-hook";
import { supabase, User } from "@/lib/supabase";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setOnboardingComplete: () => Promise<void>;
  resetAllData: () => Promise<void>;
}

type AuthContextType = AuthState & AuthActions;

const isWeb = typeof window !== "undefined" && typeof document !== "undefined";
const memoryStorage: { [key: string]: string } = {};

const getStorageItem = async (key: string): Promise<string | null> => {
  if (isWeb) {
    try {
      return window.localStorage?.getItem(key) ?? memoryStorage[key] ?? null;
    } catch {
      return memoryStorage[key] ?? null;
    }
  }
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    return await AsyncStorage.getItem(key);
  } catch {
    return memoryStorage[key] ?? null;
  }
};

const setStorageItem = async (key: string, value: string): Promise<void> => {
  if (isWeb) {
    try {
      window.localStorage?.setItem(key, value);
    } catch {
      memoryStorage[key] = value;
    }
    return;
  }
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem(key, value);
  } catch {
    memoryStorage[key] = value;
  }
};

const removeStorageItem = async (key: string): Promise<void> => {
  if (isWeb) {
    try {
      window.localStorage?.removeItem(key);
    } catch {
      delete memoryStorage[key];
    }
    return;
  }
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.removeItem(key);
  } catch {
    delete memoryStorage[key];
  }
};

export const [AuthProvider, useAuth] = createContextHook<AuthContextType>(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [storedUser, onboardingFlag] = await Promise.all([
        getStorageItem("harekar_user"),
        getStorageItem("harekar_onboarding_complete"),
      ]);

      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      setHasSeenOnboarding(onboardingFlag === "true");
    } catch (error) {
      console.error("Error loading stored auth:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email.toLowerCase().trim())
        .eq("password_hash", password)
        .single();

      if (error || !data) {
        return { success: false, error: "Invalid email or password" };
      }

      const userData: User = {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        phone: data.phone,
        role: data.role,
        avatar_url: data.avatar_url,
        created_at: data.created_at,
        created_by: data.created_by,
      };

      await setStorageItem("harekar_user", JSON.stringify(userData));
      setUser(userData);
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "Network error. Please try again." };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await removeStorageItem("harekar_user");
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const setOnboardingComplete = async () => {
    try {
      await setStorageItem("harekar_onboarding_complete", "true");
      setHasSeenOnboarding(true);
    } catch (error) {
      console.error("Error setting onboarding complete:", error);
    }
  };

  const resetAllData = async () => {
    try {
      // Clear all stored data
      await removeStorageItem("harekar_user");
      await removeStorageItem("harekar_onboarding_complete");
      await removeStorageItem("app_settings");

      // Reset state
      setUser(null);
      setHasSeenOnboarding(false);
    } catch (error) {
      console.error("Error resetting data:", error);
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    hasSeenOnboarding,
    login,
    logout,
    setOnboardingComplete,
    resetAllData,
  };
});
