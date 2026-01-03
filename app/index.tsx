import { useEffect } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/state/auth";
import { Colors } from "@/constants/colors";

export default function Index() {
  const { isLoading, isAuthenticated, hasSeenOnboarding } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!hasSeenOnboarding) {
      router.replace("/onboarding");
    } else if (isAuthenticated) {
      router.replace("/(tabs)");
    } else {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, hasSeenOnboarding]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.white,
  },
});
