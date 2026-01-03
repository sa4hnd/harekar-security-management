import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Shield, Mail, Phone, LogOut, ChevronLeft, Calendar, Users, Clock, Sparkles } from "lucide-react-native";
import { Colors } from "@/constants/colors";
import { t } from "@/constants/translations";
import { useAuth } from "@/state/auth";
import * as Haptics from "expo-haptics";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await logout();
    router.replace("/login");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatShiftTime = (time?: string) => {
    if (!time) return "--:--";
    return time.slice(0, 5);
  };

  const isSupervisor = user?.role === "supervisor";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarGlow} />
            <View style={[styles.avatar, isSupervisor && styles.avatarSupervisor]}>
              <Text style={styles.avatarText}>{user?.full_name ? getInitials(user.full_name) : "U"}</Text>
            </View>
          </View>
          <Text style={styles.userName}>{user?.full_name || "User"}</Text>
          <View style={[styles.roleBadge, isSupervisor && styles.roleBadgeSupervisor]}>
            {isSupervisor ? <Users size={16} color={Colors.white} /> : <Shield size={16} color={Colors.white} />}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Sparkles size={14} color={Colors.primary} />
            <Text style={styles.sectionTitle}>{t.accountInfo}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>{user?.email || t.notSet}</Text>
                <Text style={styles.infoLabel}>{t.email}</Text>
              </View>
              <View style={[styles.infoIcon, { backgroundColor: Colors.tint.blue }]}>
                <Mail size={18} color={Colors.primary} />
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>{user?.phone || t.notSet}</Text>
                <Text style={styles.infoLabel}>{t.phone}</Text>
              </View>
              <View style={[styles.infoIcon, { backgroundColor: Colors.tint.green }]}>
                <Phone size={18} color={Colors.success} />
              </View>
            </View>

            {!isSupervisor && (user?.shift_start_time || user?.shift_end_time) && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoValue}>
                      {formatShiftTime(user?.shift_start_time)} - {formatShiftTime(user?.shift_end_time)}
                    </Text>
                    <Text style={styles.infoLabel}>{t.shiftTime}</Text>
                  </View>
                  <View style={[styles.infoIcon, { backgroundColor: Colors.tint.orange }]}>
                    <Clock size={18} color={Colors.warning} />
                  </View>
                </View>
              </>
            )}

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>{user?.created_at ? formatDate(user.created_at) : t.notSet}</Text>
                <Text style={styles.infoLabel}>{t.memberSince}</Text>
              </View>
              <View style={[styles.infoIcon, { backgroundColor: Colors.tint.purple }]}>
                <Calendar size={18} color={Colors.secondary} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
            onPress={handleLogout}
          >
            <ChevronLeft size={18} color={Colors.error} />
            <Text style={styles.logoutText}>{t.logout}</Text>
            <View style={styles.logoutIcon}>
              <LogOut size={18} color={Colors.error} />
            </View>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t.appName}</Text>
          <Text style={styles.versionText}>{t.version} 1.0.0</Text>
        </View>

        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    paddingVertical: 32,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 20,
  },
  avatarGlow: {
    position: "absolute",
    top: -15,
    left: -15,
    right: -15,
    bottom: -15,
    backgroundColor: Colors.primary,
    opacity: 0.15,
    borderRadius: 75,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: Colors.glassBorder,
  },
  avatarSupervisor: {
    backgroundColor: Colors.secondary,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: "700",
    color: Colors.white,
  },
  userName: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  roleBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  roleBadgeSupervisor: {
    backgroundColor: Colors.secondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    justifyContent: "flex-end",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  card: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 14,
  },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  infoContent: {
    flex: 1,
    alignItems: "flex-end",
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.separator,
    marginHorizontal: 14,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.errorLight,
    borderRadius: 18,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.error + "30",
  },
  logoutButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  logoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.error + "25",
    justifyContent: "center",
    alignItems: "center",
  },
  logoutText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: Colors.error,
    textAlign: "right",
  },
  footer: {
    alignItems: "center",
    paddingTop: 24,
  },
  footerText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  versionText: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 4,
  },
});
