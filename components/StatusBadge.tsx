import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { t } from "@/constants/translations";

type StatusType = "pending" | "checked_in" | "checked_out" | "absent" | "late";

interface StatusBadgeProps {
  status?: StatusType | string;
  size?: "small" | "medium" | "large";
}

export default function StatusBadge({ status, size = "medium" }: StatusBadgeProps) {
  const getStatusColor = () => {
    switch (status) {
      case "checked_in": return Colors.success;
      case "checked_out": return Colors.secondary;
      case "late": return Colors.warning;
      case "absent": return Colors.error;
      default: return Colors.textTertiary;
    }
  };

  const getStatusBg = () => {
    switch (status) {
      case "checked_in": return Colors.successLight;
      case "checked_out": return Colors.tint.purple;
      case "late": return Colors.warningLight;
      case "absent": return Colors.errorLight;
      default: return Colors.fillQuaternary;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "checked_in": return t.onDuty;
      case "checked_out": return t.completed;
      case "late": return t.late;
      case "absent": return t.absent;
      default: return t.pending;
    }
  };

  const color = getStatusColor();
  const bgColor = getStatusBg();
  const fontSize = size === "small" ? 11 : size === "large" ? 14 : 12;
  const paddingH = size === "small" ? 10 : size === "large" ? 16 : 12;
  const paddingV = size === "small" ? 5 : size === "large" ? 10 : 7;
  const dotSize = size === "small" ? 6 : size === "large" ? 10 : 8;
  const borderRadius = size === "small" ? 10 : size === "large" ? 16 : 12;

  return (
    <View style={[styles.badge, { backgroundColor: bgColor, paddingHorizontal: paddingH, paddingVertical: paddingV, borderRadius }]}>
      <Text style={[styles.text, { color, fontSize }]}>{getStatusText()}</Text>
      <View style={[styles.dot, { backgroundColor: color, width: dotSize, height: dotSize, borderRadius: dotSize / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {},
  text: {
    fontWeight: "600",
  },
});
