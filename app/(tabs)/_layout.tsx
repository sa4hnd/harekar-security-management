import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/state/auth";
import { t } from "@/constants/translations";
import { Colors } from "@/constants/colors";
import { Platform, View, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { BarChart3, AlertTriangle, Settings } from "lucide-react-native";

function TabBarBackground() {
  if (Platform.OS === "ios") {
    return (
      <BlurView
        intensity={80}
        tint="light"
        style={StyleSheet.absoluteFill}
      />
    );
  }
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.backgroundSecondary }]} />;
}

export default function TabsLayout() {
  const { user } = useAuth();
  const isSupervisor = user?.role === "supervisor";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === "ios" ? 88 : 70,
          paddingTop: 8,
          backgroundColor: "transparent",
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 2,
          letterSpacing: 0.2,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: t.home,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={26}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: t.history,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "time" : "time-outline"}
              size={26}
              color={color}
            />
          ),
          href: isSupervisor ? null : "/(tabs)/history",
        }}
      />

      <Tabs.Screen
        name="incidents"
        options={{
          title: t.incidents,
          tabBarIcon: ({ color }) => (
            <AlertTriangle size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="employees"
        options={{
          title: t.employees,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "people" : "people-outline"}
              size={26}
              color={color}
            />
          ),
          href: isSupervisor ? "/(tabs)/employees" : null,
        }}
      />

      <Tabs.Screen
        name="reports"
        options={{
          title: t.reports,
          tabBarIcon: ({ color }) => (
            <BarChart3 size={24} color={color} />
          ),
          href: isSupervisor ? "/(tabs)/reports" : null,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t.profile,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "person-circle" : "person-circle-outline"}
              size={28}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: t.settings,
          tabBarIcon: ({ color }) => (
            <Settings size={24} color={color} />
          ),
          href: null,
        }}
      />

      <Tabs.Screen
        name="shifts"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
