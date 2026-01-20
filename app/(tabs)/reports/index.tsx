import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Dimensions, Share, Platform } from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart3, TrendingUp, TrendingDown, Calendar, Users, Clock, Download, ChevronRight, AlertTriangle, CheckCircle, XCircle, Minus } from "lucide-react-native";
import { Colors } from "@/constants/colors";
import { t } from "@/constants/translations";
import { useAuth } from "@/state/auth";
import { supabase, User, Attendance } from "@/lib/supabase";
import * as Haptics from "expo-haptics";

interface DayStats {
  date: string;
  total: number;
  attended: number;
  late: number;
  absent: number;
}

interface EmployeePerformance {
  user: User;
  totalDays: number;
  onTime: number;
  late: number;
  absent: number;
  averageCheckIn: string;
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingPeriod, setIsChangingPeriod] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [weeklyStats, setWeeklyStats] = useState<DayStats[]>([]);
  const [employeePerformance, setEmployeePerformance] = useState<EmployeePerformance[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month">("week");
  const [totalStats, setTotalStats] = useState({
    totalEmployees: 0,
    avgAttendance: 0,
    avgLateRate: 0,
    trend: 0
  });

  const fetchReports = async (showPeriodLoading = false) => {
    if (!user) return;

    if (showPeriodLoading) {
      setIsChangingPeriod(true);
    }

    try {
      const { data: employees } = await supabase
        .from("users")
        .select("*")
        .eq("role", "security");

      const daysBack = selectedPeriod === "week" ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("*")
        .gte("date", startDate.toISOString().split("T")[0])
        .order("date", { ascending: true });

      const dailyStats: { [key: string]: DayStats } = {};
      for (let i = 0; i < daysBack; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (daysBack - 1 - i));
        const dateStr = d.toISOString().split("T")[0];
        dailyStats[dateStr] = {
          date: dateStr,
          total: (employees || []).length,
          attended: 0,
          late: 0,
          absent: 0,
        };
      }

      // Group attendance by date and user to handle multiple records per day
      const attendanceByDateUser: { [key: string]: Set<string> } = {};
      const lateByDateUser: { [key: string]: Set<string> } = {};

      (attendanceData || []).forEach(att => {
        const key = att.date;
        if (!attendanceByDateUser[key]) {
          attendanceByDateUser[key] = new Set();
          lateByDateUser[key] = new Set();
        }

        if (att.status === "checked_in" || att.status === "checked_out" || att.status === "late") {
          attendanceByDateUser[key].add(att.user_id);
        }
        if (att.status === "late") {
          lateByDateUser[key].add(att.user_id);
        }
      });

      // Calculate stats based on unique users per day
      Object.keys(dailyStats).forEach(date => {
        const ds = dailyStats[date];
        ds.attended = attendanceByDateUser[date]?.size || 0;
        ds.late = lateByDateUser[date]?.size || 0;
        ds.absent = ds.total - ds.attended;
      });

      setWeeklyStats(Object.values(dailyStats));

      // Calculate employee performance with unique days
      const empPerformance: EmployeePerformance[] = (employees || []).map(emp => {
        const empAttendance = (attendanceData || []).filter(a => a.user_id === emp.id);

        // Count unique days for on-time and late
        const uniqueOnTimeDays = new Set(empAttendance.filter(a => a.status === "checked_in" || a.status === "checked_out").map(a => a.date)).size;
        const uniqueLateDays = new Set(empAttendance.filter(a => a.status === "late").map(a => a.date)).size;
        const totalDays = daysBack;
        const absent = totalDays - uniqueOnTimeDays - uniqueLateDays;

        const checkInTimes = empAttendance
          .filter(a => a.check_in_time)
          .map(a => {
            const d = new Date(a.check_in_time!);
            return d.getHours() * 60 + d.getMinutes();
          });

        const avgMinutes = checkInTimes.length > 0
          ? checkInTimes.reduce((a, b) => a + b, 0) / checkInTimes.length
          : 0;
        const avgHours = Math.floor(avgMinutes / 60);
        const avgMins = Math.round(avgMinutes % 60);
        const averageCheckIn = avgMinutes > 0
          ? `${avgHours.toString().padStart(2, "0")}:${avgMins.toString().padStart(2, "0")}`
          : "--:--";

        return {
          user: emp,
          totalDays,
          onTime: uniqueOnTimeDays,
          late: uniqueLateDays,
          absent,
          averageCheckIn,
        };
      });

      empPerformance.sort((a, b) => (b.onTime + b.late) - (a.onTime + a.late));
      setEmployeePerformance(empPerformance);

      const totalAttendance = Object.values(dailyStats).reduce((sum, ds) => sum + ds.attended, 0);
      const totalPossible = Object.values(dailyStats).reduce((sum, ds) => sum + ds.total, 0);
      const totalLate = Object.values(dailyStats).reduce((sum, ds) => sum + ds.late, 0);

      const recentDays = Object.values(dailyStats).slice(-3);
      const olderDays = Object.values(dailyStats).slice(0, 3);
      const recentAvg = recentDays.reduce((s, d) => s + (d.total > 0 ? d.attended / d.total : 0), 0) / recentDays.length;
      const olderAvg = olderDays.reduce((s, d) => s + (d.total > 0 ? d.attended / d.total : 0), 0) / olderDays.length;
      const trend = Math.round((recentAvg - olderAvg) * 100);

      setTotalStats({
        totalEmployees: (employees || []).length,
        avgAttendance: totalPossible > 0 ? Math.round((totalAttendance / totalPossible) * 100) : 0,
        avgLateRate: totalAttendance > 0 ? Math.round((totalLate / totalAttendance) * 100) : 0,
        trend,
      });

    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setIsLoading(false);
      setIsChangingPeriod(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [user]);

  // Separate effect for period changes to show loading
  useEffect(() => {
    if (!isLoading) {
      fetchReports(true);
    }
  }, [selectedPeriod]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReports();
  }, [user, selectedPeriod]);

  const handleExport = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    let reportText = `${t.appName} - ${t.attendanceReport}\n`;
    reportText += `${t.period}: ${selectedPeriod === "week" ? t.lastWeek : t.lastMonth}\n`;
    reportText += `${t.generatedOn}: ${new Date().toLocaleDateString()}\n\n`;
    reportText += `=== ${t.summary} ===\n`;
    reportText += `${t.totalSecurities}: ${totalStats.totalEmployees}\n`;
    reportText += `${t.avgAttendance}: ${totalStats.avgAttendance}%\n`;
    reportText += `${t.lateRate}: ${totalStats.avgLateRate}%\n\n`;
    reportText += `=== ${t.dailyBreakdown} ===\n`;

    weeklyStats.forEach(day => {
      reportText += `${day.date}: ${t.attended}: ${day.attended}, ${t.late}: ${day.late}, ${t.absent}: ${day.absent}\n`;
    });

    reportText += `\n=== ${t.employeePerformance} ===\n`;
    employeePerformance.forEach(emp => {
      reportText += `${emp.user.full_name}: ${t.onTime}: ${emp.onTime}, ${t.late}: ${emp.late}, ${t.absent}: ${emp.absent}\n`;
    });

    try {
      await Share.share({
        message: reportText,
        title: t.attendanceReport,
      });
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const formatDayLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ["ی", "د", "س", "چ", "پ", "ھ", "ش"];
    return days[date.getDay()];
  };

  const maxAttendance = Math.max(...weeklyStats.map(d => d.total), 1);

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
        <Pressable
          style={({ pressed }) => [styles.exportButton, pressed && styles.exportButtonPressed]}
          onPress={handleExport}
        >
          <Download size={16} color={Colors.white} />
          <Text style={styles.exportButtonText}>{t.export}</Text>
        </Pressable>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>{t.reports}</Text>
          <Text style={styles.headerSubtitle}>{t.analyticsAndInsights}</Text>
        </View>
      </View>

      <View style={styles.periodSelector}>
        <Pressable
          style={[styles.periodBtn, selectedPeriod === "month" && styles.periodBtnActive]}
          onPress={() => setSelectedPeriod("month")}
          disabled={isChangingPeriod}
        >
          <Text style={[styles.periodBtnText, selectedPeriod === "month" && styles.periodBtnTextActive]}>
            {t.lastMonth}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.periodBtn, selectedPeriod === "week" && styles.periodBtnActive]}
          onPress={() => setSelectedPeriod("week")}
          disabled={isChangingPeriod}
        >
          <Text style={[styles.periodBtnText, selectedPeriod === "week" && styles.periodBtnTextActive]}>
            {t.lastWeek}
          </Text>
        </Pressable>
      </View>

      {isChangingPeriod && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>{t.loading}</Text>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardWide]}>
            <View style={styles.statHeader}>
              <View style={[styles.statIconWrapper, { backgroundColor: Colors.tint.green }]}>
                <TrendingUp size={18} color={Colors.success} />
              </View>
              <Text style={styles.statLabel}>{t.avgAttendance}</Text>
            </View>
            <View style={styles.statValueRow}>
              <View style={styles.trendBadge}>
                {totalStats.trend >= 0 ? (
                  <TrendingUp size={12} color={Colors.success} />
                ) : (
                  <TrendingDown size={12} color={Colors.error} />
                )}
                <Text style={[styles.trendText, { color: totalStats.trend >= 0 ? Colors.success : Colors.error }]}>
                  {totalStats.trend >= 0 ? "+" : ""}{totalStats.trend}%
                </Text>
              </View>
              <Text style={styles.statValue}>{totalStats.avgAttendance}%</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <View style={[styles.statIconWrapper, { backgroundColor: Colors.tint.orange }]}>
                <AlertTriangle size={18} color={Colors.warning} />
              </View>
              <Text style={styles.statLabel}>{t.lateRate}</Text>
            </View>
            <Text style={styles.statValue}>{totalStats.avgLateRate}%</Text>
          </View>
        </View>

        <View style={styles.chartSection}>
          <View style={styles.sectionHeader}>
            <BarChart3 size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>{t.attendanceTrend}</Text>
          </View>
          <View style={styles.chartCard}>
            <View style={styles.chartContainer}>
              {weeklyStats.slice(-7).map((day, index) => {
                const attendedHeight = (day.attended / maxAttendance) * 100;
                const lateHeight = (day.late / maxAttendance) * 100;
                return (
                  <View key={day.date} style={styles.barColumn}>
                    <View style={styles.barWrapper}>
                      <View style={[styles.bar, styles.barLate, { height: `${lateHeight}%` }]} />
                      <View style={[styles.bar, styles.barAttended, { height: `${attendedHeight - lateHeight}%` }]} />
                    </View>
                    <Text style={styles.barLabel}>{formatDayLabel(day.date)}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
                <Text style={styles.legendText}>{t.onTime}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
                <Text style={styles.legendText}>{t.late}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.performanceSection}>
          <View style={styles.sectionHeader}>
            <Users size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>{t.employeePerformance}</Text>
          </View>

          {employeePerformance.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t.noData}</Text>
            </View>
          ) : (
            <View style={styles.performanceList}>
              {employeePerformance.slice(0, 5).map((emp, index) => {
                const attendanceRate = emp.totalDays > 0
                  ? Math.round(((emp.onTime + emp.late) / emp.totalDays) * 100)
                  : 0;
                return (
                  <View key={emp.user.id} style={styles.performanceCard}>
                    <View style={styles.performanceLeft}>
                      <View style={styles.rankBadge}>
                        <Text style={styles.rankText}>{index + 1}</Text>
                      </View>
                      <View style={styles.performanceStats}>
                        <View style={styles.performanceStatRow}>
                          <CheckCircle size={12} color={Colors.success} />
                          <Text style={styles.performanceStatText}>{emp.onTime}</Text>
                        </View>
                        <View style={styles.performanceStatRow}>
                          <Clock size={12} color={Colors.warning} />
                          <Text style={styles.performanceStatText}>{emp.late}</Text>
                        </View>
                        <View style={styles.performanceStatRow}>
                          <XCircle size={12} color={Colors.error} />
                          <Text style={styles.performanceStatText}>{emp.absent}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.performanceRight}>
                      <Text style={styles.performanceName}>{emp.user.full_name}</Text>
                      <View style={styles.performanceMeta}>
                        <Text style={styles.performanceRate}>{attendanceRate}%</Text>
                        <View style={styles.avgTimeWrapper}>
                          <Clock size={10} color={Colors.textTertiary} />
                          <Text style={styles.avgTimeText}>{emp.averageCheckIn}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.performanceAvatar}>
                      <Text style={styles.avatarText}>{getInitials(emp.user.full_name)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
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
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 16,
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
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  exportButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  periodSelector: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: Colors.fillQuaternary,
    borderRadius: 12,
    padding: 4,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  periodBtnActive: {
    backgroundColor: Colors.cardBackgroundSolid,
  },
  periodBtnText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: Colors.textSecondary,
  },
  periodBtnTextActive: {
    color: Colors.textPrimary,
    fontWeight: "600" as const,
  },
  loadingOverlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: Colors.tint.blue,
    borderRadius: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: "500" as const,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  statCardWide: {
    flex: 1.5,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 12,
  },
  statIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: Colors.textPrimary,
    textAlign: "right",
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.tint.green,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trendText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  chartSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600" as const,
    color: Colors.textPrimary,
  },
  chartCard: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  chartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 120,
    marginBottom: 16,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
  },
  barWrapper: {
    width: 24,
    height: "100%",
    justifyContent: "flex-end",
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: Colors.fillQuaternary,
  },
  bar: {
    width: "100%",
  },
  barAttended: {
    backgroundColor: Colors.success,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barLate: {
    backgroundColor: Colors.warning,
  },
  barLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 8,
    fontWeight: "500" as const,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  performanceSection: {
    marginBottom: 20,
  },
  emptyState: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 18,
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  performanceList: {
    gap: 10,
  },
  performanceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  performanceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: Colors.fillQuaternary,
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.textSecondary,
  },
  performanceStats: {
    flexDirection: "row",
    gap: 10,
  },
  performanceStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  performanceStatText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  performanceRight: {
    flex: 1,
    alignItems: "flex-end",
    paddingHorizontal: 12,
  },
  performanceName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.textPrimary,
    textAlign: "right",
    marginBottom: 4,
  },
  performanceMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  performanceRate: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.success,
  },
  avgTimeWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  avgTimeText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  performanceAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.white,
  },
});
