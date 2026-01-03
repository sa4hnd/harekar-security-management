import { View, Text, StyleSheet, Pressable, ViewStyle } from "react-native";
import { Colors } from "@/constants/colors";

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  elevated?: boolean;
}

export function Card({ children, onPress, style, elevated = false }: CardProps) {
  const content = (
    <View style={[styles.card, elevated && styles.elevated, style]}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }

  return content;
}

interface StatCardProps {
  value: number | string;
  label: string;
  color?: string;
  backgroundColor?: string;
  onPress?: () => void;
}

export function StatCard({ value, label, color = Colors.textPrimary, backgroundColor, onPress }: StatCardProps) {
  const content = (
    <View style={[styles.statCard, backgroundColor && { backgroundColor }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.statCardWrapper, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.statCardWrapper}>{content}</View>;
}

interface InfoRowProps {
  icon?: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}

export function InfoRow({ icon, label, value, valueColor = Colors.textPrimary }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      {icon && <View style={styles.infoIcon}>{icon}</View>}
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 16,
  },
  elevated: {
    backgroundColor: Colors.cardBackgroundElevated,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  statCardWrapper: {
    flex: 1,
  },
  statCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    minWidth: 70,
  },
  statValue: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  infoIcon: {
    width: 28,
    alignItems: "center",
    marginRight: 12,
  },
  infoLabel: {
    flex: 1,
    fontSize: 15,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "right",
  },
});
