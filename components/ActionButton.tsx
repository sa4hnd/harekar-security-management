import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from "react-native";
import { Colors } from "@/constants/colors";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

interface ActionButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "success" | "warning" | "danger" | "ghost";
  size?: "small" | "medium" | "large";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function ActionButton({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}: ActionButtonProps) {
  const handlePress = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const getBackgroundColor = () => {
    if (disabled) return Colors.fillQuaternary;
    switch (variant) {
      case "success": return Colors.success;
      case "warning": return Colors.warning;
      case "danger": return Colors.error;
      case "secondary": return Colors.secondary;
      case "ghost": return "transparent";
      default: return Colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return Colors.textTertiary;
    if (variant === "ghost") return Colors.primary;
    return Colors.white;
  };

  const getPadding = () => {
    switch (size) {
      case "small": return { paddingVertical: 10, paddingHorizontal: 16 };
      case "large": return { paddingVertical: 18, paddingHorizontal: 28 };
      default: return { paddingVertical: 14, paddingHorizontal: 20 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case "small": return 14;
      case "large": return 18;
      default: return 16;
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: getBackgroundColor() },
        getPadding(),
        variant === "ghost" && styles.ghost,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: getTextColor(), fontSize: getFontSize() }, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    gap: 8,
    minHeight: 44,
  },
  ghost: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  text: {
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
