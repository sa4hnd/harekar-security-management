import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Platform, Modal, TextInput, KeyboardAvoidingView, Keyboard } from "react-native";
import { useEffect, useState, useCallback } from "react";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapPin, Clock, LogIn, LogOut, Shield, Users, ChevronRight, Calendar, Sparkles, BarChart3, AlertTriangle, Bell, X, Check, Send } from "lucide-react-native";
import { Colors } from "@/constants/colors";
import { t } from "@/constants/translations";
import { useAuth } from "@/state/auth";
import { supabase, Attendance, User, AttendanceWithUser } from "@/lib/supabase";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import AttendanceDetails from "@/components/AttendanceDetails";
import StatusBadge from "@/components/StatusBadge";
import { formatTime12h } from "@/lib/utils/time";
import { sendImmediateNotification } from "@/lib/notifications/notificationService";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [recentHistory, setRecentHistory] = useState<Attendance[]>([]);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceWithUser | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [todayAttendances, setTodayAttendances] = useState<AttendanceWithUser[]>([]);
  const [stats, setStats] = useState({ total: 0, onShift: 0, attended: 0, exited: 0, late: 0 });
  const [allSecurities, setAllSecurities] = useState<User[]>([]);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);

  const isSupervisor = user?.role === "supervisor";

  const isOnShiftToday = (guard: User) => {
    if (!guard.shift_start_time || !guard.shift_end_time) return true;
    return true;
  };

  const fetchData = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split("T")[0];

      if (isSupervisor) {
        const { data: securities } = await supabase
          .from("users")
          .select("*")
          .eq("role", "security");

        setAllSecurities(securities || []);

        const guardsOnShift = (securities || []).filter(isOnShiftToday);

        const { data: attendances } = await supabase
          .from("attendance")
          .select("*")
          .eq("date", today)
          .order("check_in_time", { ascending: false });

        const attendancesWithUsers = (attendances || []).map(att => ({
          ...att,
          user: (securities || []).find(s => s.id === att.user_id)
        }));

        setTodayAttendances(attendancesWithUsers);

        const attended = (attendances || []).filter(a =>
          a.status === "checked_in" || a.status === "checked_out" || a.status === "late"
        ).length;
        const exited = (attendances || []).filter(a => a.status === "checked_out").length;
        const late = (attendances || []).filter(a => a.status === "late").length;

        setStats({
          total: (securities || []).length,
          onShift: guardsOnShift.length,
          attended,
          exited,
          late,
        });
      } else {
        // Get the most recent attendance record for today (there can be multiple)
        const { data: todayData } = await supabase
          .from("attendance")
          .select("*")
          .eq("user_id", user.id)
          .eq("date", today)
          .order("check_in_time", { ascending: false })
          .limit(1)
          .single();

        setTodayAttendance(todayData);

        const { data: historyData } = await supabase
          .from("attendance")
          .select("*")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .order("check_in_time", { ascending: false })
          .limit(10);

        // Filter out the current active attendance from history
        const filteredHistory = (historyData || []).filter(h =>
          todayData ? h.id !== todayData.id : true
        );

        setRecentHistory(filteredHistory.slice(0, 5));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Refetch data when screen comes into focus (e.g., after returning from exit-camera)
  useFocusEffect(
    useCallback(() => {
      // Always refetch when screen gains focus
      fetchData();
    }, [user])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [user]);

  const getLocationAddress = async (latitude: number, longitude: number): Promise<string> => {
    try {
      if (Platform.OS === "web") {
        return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      }
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addresses.length > 0) {
        const addr = addresses[0];
        return `${addr.street || ""}, ${addr.city || ""}, ${addr.region || ""}`.replace(/^, |, $/g, "");
      }
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    } catch {
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
  };

  const handleAttend = async () => {
    if (!user || attendanceLoading) return;
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setAttendanceLoading(true);

    try {
      let latitude = 0;
      let longitude = 0;
      let locationAddress = t.locationUnavailable;

      if (Platform.OS !== "web") {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({});
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
          locationAddress = await getLocationAddress(latitude, longitude);
        }
      }

      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const shiftStart = user.shift_start_time ? new Date(`${today}T${user.shift_start_time}`) : null;
      const isLate = shiftStart ? now > new Date(shiftStart.getTime() + 15 * 60 * 1000) : false;

      // Try to create a new attendance record
      // If the unique constraint still exists, it will fall back to updating existing record
      const { error: insertError } = await supabase
        .from("attendance")
        .insert({
          user_id: user.id,
          date: today,
          check_in_time: now.toISOString(),
          check_in_location: locationAddress,
          check_in_latitude: latitude,
          check_in_longitude: longitude,
          status: isLate ? "late" : "checked_in",
        });

      // If insert fails due to unique constraint, update existing record instead
      if (insertError) {
        if (insertError.code === "23505") {
          // Unique constraint violation - update the existing record
          const { error: updateError } = await supabase
            .from("attendance")
            .update({
              check_in_time: now.toISOString(),
              check_in_location: locationAddress,
              check_in_latitude: latitude,
              check_in_longitude: longitude,
              check_out_time: null,
              check_out_location: null,
              check_out_latitude: null,
              check_out_longitude: null,
              check_out_photo: null,
              status: isLate ? "late" : "checked_in",
            })
            .eq("user_id", user.id)
            .eq("date", today);

          if (updateError) throw updateError;
        } else {
          throw insertError;
        }
      }

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await fetchData();
    } catch (error) {
      console.error("Check-in error:", error);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleExit = () => {
    router.push("/exit-camera");
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t.goodMorning;
    if (hour < 17) return t.goodAfternoon;
    return t.goodEvening;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return t.today;
    if (date.toDateString() === yesterday.toDateString()) return t.yesterday;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleSendAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementMessage.trim()) return;

    dismissKeyboard();
    setIsSendingAnnouncement(true);

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      await sendImmediateNotification(
        announcementTitle.trim(),
        announcementMessage.trim(),
        { type: "announcement", from: user?.full_name }
      );

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setAnnouncementTitle("");
      setAnnouncementMessage("");
      setShowAnnouncementModal(false);
    } catch (error) {
      console.error("Error sending announcement:", error);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsSendingAnnouncement(false);
    }
  };

  // Can check in if no attendance today OR if the latest one is checked_out
  const canCheckIn = !todayAttendance || todayAttendance.status === "checked_out";
  // Can check out only if currently checked in (or late)
  const canCheckOut = todayAttendance && (todayAttendance.status === "checked_in" || todayAttendance.status === "late");

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (isSupervisor) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.roleBadgeSupervisor}>
                <Users size={16} color={Colors.white} />
              </View>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.userName}>{user?.full_name}</Text>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, styles.statCardSmall]}>
                <View style={[styles.statIconWrapper, { backgroundColor: Colors.tint.green }]}>
                  <LogIn size={18} color={Colors.success} />
                </View>
                <Text style={styles.statValue}>{stats.attended}</Text>
                <Text style={styles.statLabel}>{t.attended}</Text>
              </View>

              <View style={[styles.statCard, styles.statCardSmall]}>
                <View style={[styles.statIconWrapper, { backgroundColor: Colors.tint.purple }]}>
                  <LogOut size={18} color={Colors.secondary} />
                </View>
                <Text style={styles.statValue}>{stats.exited}</Text>
                <Text style={styles.statLabel}>{t.exited}</Text>
              </View>

              <View style={[styles.statCard, styles.statCardSmall]}>
                <View style={[styles.statIconWrapper, { backgroundColor: Colors.tint.orange }]}>
                  <Clock size={18} color={Colors.warning} />
                </View>
                <Text style={styles.statValue}>{stats.late}</Text>
                <Text style={styles.statLabel}>{t.late}</Text>
              </View>

              <View style={[styles.statCard, styles.statCardSmall]}>
                <View style={[styles.statIconWrapper, { backgroundColor: Colors.tint.blue }]}>
                  <Users size={18} color={Colors.primary} />
                </View>
                <Text style={styles.statValue}>{stats.onShift}</Text>
                <Text style={styles.statLabel}>{t.onShiftToday}</Text>
              </View>
            </View>
          </View>

          <View style={styles.quickActions}>
            <Pressable
              style={({ pressed }) => [styles.quickActionBtn, pressed && styles.quickActionBtnPressed]}
              onPress={() => router.push("/(tabs)/reports")}
            >
              <BarChart3 size={20} color={Colors.primary} />
              <Text style={styles.quickActionText}>{t.reports}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.quickActionBtn, pressed && styles.quickActionBtnPressed]}
              onPress={() => router.push("/(tabs)/incidents")}
            >
              <AlertTriangle size={20} color={Colors.warning} />
              <Text style={styles.quickActionText}>{t.incidents}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.quickActionBtn, styles.quickActionBtnAnnounce, pressed && styles.quickActionBtnPressed]}
              onPress={() => setShowAnnouncementModal(true)}
            >
              <Bell size={20} color={Colors.white} />
              <Text style={[styles.quickActionText, { color: Colors.white }]}>{t.announce}</Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t.today}</Text>
            </View>

            {todayAttendances.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrapper}>
                  <Calendar size={32} color={Colors.textTertiary} />
                </View>
                <Text style={styles.emptyText}>{t.noRecentAttendance}</Text>
              </View>
            ) : (
              <View style={styles.attendanceList}>
                {todayAttendances.map((attendance) => (
                  <Pressable
                    key={attendance.id}
                    style={({ pressed }) => [styles.attendanceCard, pressed && styles.cardPressed]}
                    onPress={() => {
                      setSelectedAttendance(attendance);
                      setShowDetails(true);
                    }}
                  >
                    <View style={styles.attendanceCardContent}>
                      <View style={styles.attendanceCardLeft}>
                        <StatusBadge status={attendance.status} size="small" />
                        <View style={styles.attendanceTimeMeta}>
                          <Clock size={12} color={Colors.textTertiary} />
                          <Text style={styles.attendanceTimeText}>
                            {formatTime12h(attendance.check_in_time)}
                            {attendance.check_out_time && ` ← ${formatTime12h(attendance.check_out_time)}`}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.attendanceCardRight}>
                        <Text style={styles.attendanceName}>{attendance.user?.full_name || t.security}</Text>
                        <ChevronRight size={16} color={Colors.textTertiary} style={{ transform: [{ scaleX: -1 }] }} />
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={{ height: insets.bottom + 100 }} />
        </ScrollView>

        <AttendanceDetails
          visible={showDetails}
          onClose={() => {
            setShowDetails(false);
            setSelectedAttendance(null);
          }}
          attendance={selectedAttendance}
          employeeName={selectedAttendance?.user?.full_name}
          employeeShiftStart={selectedAttendance?.user?.shift_start_time}
          employeeShiftEnd={selectedAttendance?.user?.shift_end_time}
          date={selectedAttendance?.date}
        />

        <Modal
          visible={showAnnouncementModal}
          animationType="slide"
          transparent
          onRequestClose={() => {
            dismissKeyboard();
            setShowAnnouncementModal(false);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalOverlay}
          >
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => {
                dismissKeyboard();
                setShowAnnouncementModal(false);
              }}
            />
            <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Pressable
                  onPress={() => {
                    dismissKeyboard();
                    setShowAnnouncementModal(false);
                  }}
                  style={styles.closeButton}
                >
                  <X size={20} color={Colors.textPrimary} />
                </Pressable>
                <Text style={styles.modalTitle}>{t.sendAnnouncement}</Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t.announcementTitle} *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder={t.announcementTitle}
                    placeholderTextColor={Colors.textTertiary}
                    value={announcementTitle}
                    onChangeText={setAnnouncementTitle}
                    textAlign="right"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t.announcementMessage} *</Text>
                  <TextInput
                    style={[styles.formInput, styles.textArea]}
                    placeholder={t.announcementMessage}
                    placeholderTextColor={Colors.textTertiary}
                    value={announcementMessage}
                    onChangeText={setAnnouncementMessage}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    textAlign="right"
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.sendButton,
                    pressed && styles.sendButtonPressed,
                    isSendingAnnouncement && styles.sendButtonDisabled,
                  ]}
                  onPress={handleSendAnnouncement}
                  disabled={isSendingAnnouncement || !announcementTitle.trim() || !announcementMessage.trim()}
                >
                  {isSendingAnnouncement ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <>
                      <Text style={styles.sendButtonText}>{t.send}</Text>
                      <Send size={20} color={Colors.white} />
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.roleBadge}>
              <Shield size={16} color={Colors.white} />
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.full_name}</Text>
          </View>
        </View>

        <View style={styles.actionsSection}>
          <Pressable
            style={({ pressed }) => [
              styles.actionCard,
              styles.attendCard,
              !canCheckIn && styles.actionDisabled,
              pressed && canCheckIn && styles.actionPressed
            ]}
            onPress={handleAttend}
            disabled={!canCheckIn || attendanceLoading}
          >
            {attendanceLoading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <View style={styles.actionIconWrapper}>
                  <LogIn size={28} color={Colors.white} />
                </View>
                <Text style={styles.actionText}>{t.attend}</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionCard,
              styles.exitCard,
              !canCheckOut && styles.actionDisabled,
              pressed && canCheckOut && styles.actionPressed
            ]}
            onPress={handleExit}
            disabled={!canCheckOut}
          >
            <View style={styles.actionIconWrapper}>
              <LogOut size={28} color={Colors.white} />
            </View>
            <Text style={styles.actionText}>{t.exit}</Text>
          </Pressable>
        </View>

        {todayAttendance && (
          <Pressable
            style={({ pressed }) => [styles.todayCard, pressed && styles.cardPressed]}
            onPress={() => {
              setSelectedAttendance(todayAttendance);
              setShowDetails(true);
            }}
          >
            <View style={styles.todayCardHeader}>
              <View style={styles.todayCardHeaderRight}>
                <Sparkles size={16} color={Colors.primary} />
                <Text style={styles.todayLabel}>{t.today}</Text>
              </View>
              <StatusBadge status={todayAttendance.status} />
            </View>

            <View style={styles.todayTimes}>
              {todayAttendance.check_in_time && (
                <View style={styles.todayTimeItem}>
                  <View style={[styles.todayTimeIcon, { backgroundColor: Colors.successLight }]}>
                    <LogIn size={14} color={Colors.success} />
                  </View>
                  <View style={styles.todayTimeInfo}>
                    <Text style={styles.todayTimeLabel}>{t.checkIn}</Text>
                    <Text style={styles.todayTimeValue}>{formatTime12h(todayAttendance.check_in_time)}</Text>
                  </View>
                </View>
              )}
              {todayAttendance.check_out_time && (
                <View style={styles.todayTimeItem}>
                  <View style={[styles.todayTimeIcon, { backgroundColor: Colors.tint.purple }]}>
                    <LogOut size={14} color={Colors.secondary} />
                  </View>
                  <View style={styles.todayTimeInfo}>
                    <Text style={styles.todayTimeLabel}>{t.checkOut}</Text>
                    <Text style={styles.todayTimeValue}>{formatTime12h(todayAttendance.check_out_time)}</Text>
                  </View>
                </View>
              )}
            </View>

            {todayAttendance.check_in_location && (
              <View style={styles.todayLocation}>
                <MapPin size={14} color={Colors.textTertiary} />
                <Text style={styles.todayLocationText} numberOfLines={1}>
                  {todayAttendance.check_in_location}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Pressable onPress={() => router.push("/history")} hitSlop={8}>
              <Text style={styles.viewAll}>{t.viewAll}</Text>
            </Pressable>
            <Text style={styles.sectionTitle}>{t.recentHistory}</Text>
          </View>

          {recentHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <Calendar size={32} color={Colors.textTertiary} />
              </View>
              <Text style={styles.emptyText}>{t.noHistory}</Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {recentHistory.map((attendance) => (
                <Pressable
                  key={attendance.id}
                  style={({ pressed }) => [styles.historyCard, pressed && styles.cardPressed]}
                  onPress={() => {
                    setSelectedAttendance(attendance);
                    setShowDetails(true);
                  }}
                >
                  <View style={styles.historyCardLeft}>
                    <ChevronRight size={16} color={Colors.textTertiary} style={{ transform: [{ scaleX: -1 }] }} />
                    <StatusBadge status={attendance.status} size="small" />
                  </View>
                  <View style={styles.historyCardCenter}>
                    <View style={styles.historyTimeRow}>
                      <LogOut size={12} color={Colors.secondary} />
                      <Text style={styles.historyTimeText}>{formatTime12h(attendance.check_out_time)}</Text>
                    </View>
                    <View style={styles.historyTimeRow}>
                      <LogIn size={12} color={Colors.success} />
                      <Text style={styles.historyTimeText}>{formatTime12h(attendance.check_in_time)}</Text>
                    </View>
                  </View>
                  <View style={styles.historyCardRight}>
                    <Text style={styles.historyDate}>{formatDate(attendance.date)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      <AttendanceDetails
        visible={showDetails}
        onClose={() => {
          setShowDetails(false);
          setSelectedAttendance(null);
        }}
        attendance={selectedAttendance}
        employeeShiftStart={user?.shift_start_time}
        employeeShiftEnd={user?.shift_end_time}
        date={selectedAttendance?.date}
      />
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
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 20,
  },
  headerLeft: {
    alignItems: "flex-start",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  greeting: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.textPrimary,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondary,
    justifyContent: "center",
    alignItems: "center",
  },
  statsContainer: {
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  quickActionBtnAnnounce: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  quickActionBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.textPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: Colors.backgroundSecondary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: "90%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.fillTertiary,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.textPrimary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.fillQuaternary,
    justifyContent: "center",
    alignItems: "center",
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: "right" as const,
  },
  formInput: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    marginTop: 12,
  },
  sendButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  statCardSmall: {
    paddingVertical: 16,
  },
  statIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: "500",
    textAlign: "center",
  },
  actionsSection: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    height: 140,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  attendCard: {
    backgroundColor: Colors.success,
  },
  exitCard: {
    backgroundColor: Colors.secondary,
  },
  actionDisabled: {
    opacity: 0.35,
  },
  actionPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  actionIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.white,
  },
  todayCard: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  todayCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  todayCardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  todayLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  todayTimes: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  todayTimeItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  todayTimeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  todayTimeInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  todayTimeLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 2,
  },
  todayTimeValue: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  todayLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  todayLocationText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "right",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  viewAll: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.primary,
  },
  emptyState: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 20,
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.fillQuaternary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  attendanceList: {
    gap: 10,
  },
  attendanceCard: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  attendanceCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  attendanceCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  attendanceTimeMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  attendanceTimeText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  attendanceCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  attendanceName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  historyList: {
    gap: 10,
  },
  historyCard: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  historyCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  historyCardCenter: {
    flex: 1,
    alignItems: "flex-end",
    gap: 4,
    paddingHorizontal: 12,
  },
  historyTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  historyTimeText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  historyCardRight: {
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: Colors.separator,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
});
