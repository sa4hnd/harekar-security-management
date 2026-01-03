import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar, MapPin, Clock, LogIn, LogOut, ChevronRight, Camera } from "lucide-react-native";
import { Colors } from "@/constants/colors";
import { t } from "@/constants/translations";
import { useAuth } from "@/state/auth";
import { supabase, Attendance } from "@/lib/supabase";
import AttendanceDetails from "@/components/AttendanceDetails";
import StatusBadge from "@/components/StatusBadge";

interface GroupedAttendance {
  date: string;
  displayDate: string;
  records: Attendance[];
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<GroupedAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const fetchHistory = async () => {
    if (!user) return;

    try {
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (!attendanceData) {
        setAttendance([]);
        return;
      }

      const grouped = attendanceData.reduce((acc: { [key: string]: Attendance[] }, record) => {
        const date = record.date;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(record);
        return acc;
      }, {});

      const groupedArray: GroupedAttendance[] = Object.entries(grouped)
        .map(([date, records]) => ({
          date,
          displayDate: formatDisplayDate(date),
          records,
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setAttendance(groupedArray);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory();
  }, [user]);

  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return t.today;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return t.yesterday;
    }
    return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  };

  const formatTime = (time?: string) => {
    if (!time) return "--:--";
    return new Date(time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const calculateDuration = (checkIn?: string, checkOut?: string) => {
    if (!checkIn || !checkOut) return null;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.attendanceHistory}</Text>
        <Text style={styles.headerSubtitle}>{t.viewPastShifts}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        {attendance.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <Calendar size={36} color={Colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>{t.noHistory}</Text>
          </View>
        ) : (
          attendance.map((group, groupIndex) => (
            <View key={group.date} style={styles.dateGroup}>
              <View style={styles.dateHeaderRow}>
                <Text style={styles.dateHeader}>{group.displayDate}</Text>
                <View style={styles.dateIndicator}>
                  <View style={[styles.timelineDot, groupIndex === 0 && styles.timelineDotActive]} />
                  {groupIndex < attendance.length - 1 && <View style={styles.timelineLine} />}
                </View>
              </View>

              {group.records.map((record) => (
                <Pressable
                  key={record.id}
                  style={({ pressed }) => [styles.recordCard, pressed && styles.recordCardPressed]}
                  onPress={() => {
                    setSelectedRecord(record);
                    setShowDetails(true);
                  }}
                >
                  <View style={styles.recordContent}>
                    <View style={styles.recordLeft}>
                      <ChevronRight size={16} color={Colors.textTertiary} style={{ transform: [{ scaleX: -1 }] }} />
                      {record.check_out_photo && (
                        <View style={styles.photoIndicator}>
                          <Camera size={12} color={Colors.textSecondary} />
                        </View>
                      )}
                    </View>

                    <View style={styles.recordCenter}>
                      <View style={styles.timeRow}>
                        <View style={styles.timeItem}>
                          <View style={[styles.timeIcon, { backgroundColor: Colors.successLight }]}>
                            <LogIn size={12} color={Colors.success} />
                          </View>
                          <Text style={styles.timeValue}>{formatTime(record.check_in_time)}</Text>
                        </View>
                        <View style={styles.timeSeparator} />
                        <View style={styles.timeItem}>
                          <View style={[styles.timeIcon, { backgroundColor: Colors.tint.purple }]}>
                            <LogOut size={12} color={Colors.secondary} />
                          </View>
                          <Text style={styles.timeValue}>{formatTime(record.check_out_time)}</Text>
                        </View>
                      </View>

                      {record.check_in_location && (
                        <View style={styles.locationRow}>
                          <MapPin size={12} color={Colors.textTertiary} />
                          <Text style={styles.locationText} numberOfLines={1}>{record.check_in_location}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.recordRight}>
                      <StatusBadge status={record.status} size="small" />
                      {record.check_in_time && record.check_out_time && (
                        <View style={styles.durationBadge}>
                          <Clock size={10} color={Colors.primary} />
                          <Text style={styles.durationText}>
                            {calculateDuration(record.check_in_time, record.check_out_time)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          ))
        )}
        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      <AttendanceDetails
        visible={showDetails}
        onClose={() => setShowDetails(false)}
        attendance={selectedRecord}
        employeeShiftStart={user?.shift_start_time}
        employeeShiftEnd={user?.shift_end_time}
        date={selectedRecord?.date}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: "flex-end",
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "right",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: "right",
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  emptyState: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 24,
    padding: 48,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  emptyIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.fillQuaternary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-end",
    marginBottom: 14,
    gap: 12,
  },
  dateHeader: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  dateIndicator: {
    alignItems: "center",
    width: 16,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.fillTertiary,
  },
  timelineDotActive: {
    backgroundColor: Colors.primary,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.fillTertiary,
    marginTop: 4,
  },
  recordCard: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  recordCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  recordContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  recordLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  photoIndicator: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.fillQuaternary,
    justifyContent: "center",
    alignItems: "center",
  },
  recordCenter: {
    flex: 1,
    paddingHorizontal: 12,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 8,
  },
  timeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  timeValue: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  timeSeparator: {
    width: 1,
    height: 16,
    backgroundColor: Colors.separator,
    marginHorizontal: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  locationText: {
    fontSize: 12,
    color: Colors.textTertiary,
    maxWidth: 150,
    textAlign: "right",
  },
  recordRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.tint.blue,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  durationText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
  },
});
