import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Platform } from "react-native";
import { useState, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Settings, Bell, Moon, Sun, Globe, Shield, ChevronRight, Info, MessageSquare, FileText, HelpCircle, Trash2 } from "lucide-react-native";
import { Colors } from "@/constants/colors";
import { t } from "@/constants/translations";
import { useAuth } from "@/state/auth";
import { supabase } from "@/lib/supabase";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import ConfirmationModal from "@/components/ConfirmationModal";

interface AppSettings {
  notificationsEnabled: boolean;
  lateAlertsEnabled: boolean;
  dailySummaryEnabled: boolean;
  darkMode: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  notificationsEnabled: true,
  lateAlertsEnabled: true,
  dailySummaryEnabled: false,
  darkMode: true,
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, resetAllData } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const isSupervisor = user?.role === "supervisor";

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      // Load settings from Supabase app_settings table
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data && !error) {
        setSettings({
          notificationsEnabled: data.notification_sound ?? DEFAULT_SETTINGS.notificationsEnabled,
          lateAlertsEnabled: data.auto_check_in_reminder ?? DEFAULT_SETTINGS.lateAlertsEnabled,
          dailySummaryEnabled: DEFAULT_SETTINGS.dailySummaryEnabled,
          darkMode: data.dark_mode ?? DEFAULT_SETTINGS.darkMode,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const updateSetting = async (key: keyof AppSettings, value: boolean) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    if (!user) return;

    try {
      // Map local settings to database columns
      const dbUpdate: Record<string, boolean> = {};
      if (key === "notificationsEnabled") dbUpdate.notification_sound = value;
      if (key === "lateAlertsEnabled") dbUpdate.auto_check_in_reminder = value;
      if (key === "darkMode") dbUpdate.dark_mode = value;

      // Upsert settings to Supabase
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          user_id: user.id,
          ...dbUpdate,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        });

      if (error) {
        console.error("Error saving settings:", error);
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const handleClearData = async () => {
    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    await resetAllData();
    setShowClearDataModal(false);
    router.replace("/onboarding");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Settings size={24} color={Colors.white} />
        </View>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>{t.settings}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Bell size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>{t.notifications}</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={(value) => updateSetting("notificationsEnabled", value)}
                trackColor={{ false: Colors.fillTertiary, true: Colors.primary }}
                thumbColor={Colors.white}
              />
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{t.enableNotifications}</Text>
              </View>
              <View style={[styles.settingIcon, { backgroundColor: Colors.tint.blue }]}>
                <Bell size={18} color={Colors.primary} />
              </View>
            </View>

            {isSupervisor && (
              <>
                <View style={styles.divider} />
                <View style={styles.settingRow}>
                  <Switch
                    value={settings.lateAlertsEnabled}
                    onValueChange={(value) => updateSetting("lateAlertsEnabled", value)}
                    trackColor={{ false: Colors.fillTertiary, true: Colors.warning }}
                    thumbColor={Colors.white}
                    disabled={!settings.notificationsEnabled}
                  />
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingLabel, !settings.notificationsEnabled && styles.settingDisabled]}>
                      {t.lateAlerts}
                    </Text>
                    <Text style={styles.settingDescription}>
                      {t.lateAlertsDesc || "Get notified when employees are late"}
                    </Text>
                  </View>
                  <View style={[styles.settingIcon, { backgroundColor: Colors.warningLight }]}>
                    <Bell size={18} color={Colors.warning} />
                  </View>
                </View>

                <View style={styles.divider} />
                <View style={styles.settingRow}>
                  <Switch
                    value={settings.dailySummaryEnabled}
                    onValueChange={(value) => updateSetting("dailySummaryEnabled", value)}
                    trackColor={{ false: Colors.fillTertiary, true: Colors.success }}
                    thumbColor={Colors.white}
                    disabled={!settings.notificationsEnabled}
                  />
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingLabel, !settings.notificationsEnabled && styles.settingDisabled]}>
                      {t.dailySummary}
                    </Text>
                    <Text style={styles.settingDescription}>
                      {t.dailySummaryDesc || "Receive daily attendance summary"}
                    </Text>
                  </View>
                  <View style={[styles.settingIcon, { backgroundColor: Colors.successLight }]}>
                    <FileText size={18} color={Colors.success} />
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Moon size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>{t.appearance}</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <Switch
                value={settings.darkMode}
                onValueChange={(value) => updateSetting("darkMode", value)}
                trackColor={{ false: Colors.fillTertiary, true: Colors.secondary }}
                thumbColor={Colors.white}
              />
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{settings.darkMode ? t.darkMode : t.lightMode}</Text>
              </View>
              <View style={[styles.settingIcon, { backgroundColor: Colors.tint.purple }]}>
                {settings.darkMode ? (
                  <Moon size={18} color={Colors.secondary} />
                ) : (
                  <Sun size={18} color={Colors.warning} />
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Info size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>{t.about}</Text>
          </View>
          <View style={styles.card}>
            <Pressable style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}>
              <ChevronRight size={18} color={Colors.textTertiary} style={styles.chevron} />
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{t.privacy}</Text>
              </View>
              <View style={[styles.settingIcon, { backgroundColor: Colors.tint.green }]}>
                <Shield size={18} color={Colors.success} />
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}>
              <ChevronRight size={18} color={Colors.textTertiary} style={styles.chevron} />
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{t.terms}</Text>
              </View>
              <View style={[styles.settingIcon, { backgroundColor: Colors.tint.blue }]}>
                <FileText size={18} color={Colors.primary} />
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}>
              <ChevronRight size={18} color={Colors.textTertiary} style={styles.chevron} />
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{t.help}</Text>
              </View>
              <View style={[styles.settingIcon, { backgroundColor: Colors.tint.orange }]}>
                <HelpCircle size={18} color={Colors.warning} />
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}>
              <ChevronRight size={18} color={Colors.textTertiary} style={styles.chevron} />
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{t.feedback}</Text>
              </View>
              <View style={[styles.settingIcon, { backgroundColor: Colors.tint.purple }]}>
                <MessageSquare size={18} color={Colors.secondary} />
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Trash2 size={16} color={Colors.error} />
            <Text style={styles.sectionTitle}>{t.clearData}</Text>
          </View>
          <View style={styles.card}>
            <Pressable
              style={({ pressed }) => [styles.clearDataRow, pressed && styles.linkRowPressed]}
              onPress={() => setShowClearDataModal(true)}
            >
              <ChevronRight size={18} color={Colors.error} style={styles.chevron} />
              <View style={styles.settingInfo}>
                <Text style={styles.clearDataLabel}>{t.clearData}</Text>
                <Text style={styles.clearDataDescription}>
                  {(t as Record<string, string>).clearDataDesc || "Clear all data and show onboarding"}
                </Text>
              </View>
              <View style={[styles.settingIcon, { backgroundColor: Colors.errorLight }]}>
                <Trash2 size={18} color={Colors.error} />
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t.appName}</Text>
          <Text style={styles.versionText}>{t.version} 1.0.0</Text>
        </View>

        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      <ConfirmationModal
        visible={showClearDataModal}
        onClose={() => setShowClearDataModal(false)}
        onConfirm={handleClearData}
        title={t.clearData}
        message={(t as Record<string, string>).clearDataConfirm || "Are you sure you want to clear all data?"}
        confirmText={t.confirm}
        cancelText={t.cancel}
        variant="danger"
      />
    </View>
  );
}

(t as Record<string, string>).lateAlertsDesc = "ئاگادارکردنەوە کاتێک کارمەند دوادەکەوێت";
(t as Record<string, string>).dailySummaryDesc = "وەرگرتنی پوختەی ئامادەبوونی ڕۆژانە";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitles: {
    alignItems: "flex-end",
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.textPrimary,
  },
  card: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 14,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 14,
  },
  linkRowPressed: {
    opacity: 0.7,
  },
  chevron: {
    transform: [{ scaleX: -1 }],
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  settingInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: Colors.textPrimary,
  },
  settingDescription: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
    textAlign: "right",
  },
  settingDisabled: {
    color: Colors.textTertiary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.separator,
    marginHorizontal: 14,
  },
  footer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  versionText: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  clearDataRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 14,
  },
  clearDataLabel: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: Colors.error,
  },
  clearDataDescription: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
    textAlign: "right",
  },
});
