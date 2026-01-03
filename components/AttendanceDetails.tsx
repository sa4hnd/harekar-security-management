import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, MapPin, Clock, Calendar, LogIn, LogOut, Camera, Briefcase } from "lucide-react-native";
import { Colors } from "@/constants/colors";
import { t } from "@/constants/translations";
import StatusBadge from "@/components/StatusBadge";
import MapViewEmbed from "@/components/MapViewEmbed";

interface AttendanceDetailsProps {
  visible: boolean;
  onClose: () => void;
  attendance: {
    check_in_time?: string;
    check_in_location?: string;
    check_in_latitude?: number;
    check_in_longitude?: number;
    check_out_time?: string;
    check_out_location?: string;
    check_out_latitude?: number;
    check_out_longitude?: number;
    check_out_photo?: string;
    status?: string;
    date?: string;
  } | null;
  employeeName?: string;
  employeeShiftStart?: string;
  employeeShiftEnd?: string;
  date?: string;
}

export default function AttendanceDetails({ visible, onClose, attendance, employeeName, employeeShiftStart, employeeShiftEnd, date }: AttendanceDetailsProps) {
  const insets = useSafeAreaInsets();

  if (!attendance) return null;

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return "--:--";
    return new Date(timeStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const formatShiftTime = (timeStr?: string) => {
    if (!timeStr) return "--:--";
    const [hours, minutes] = timeStr.split(":");
    return `${hours}:${minutes}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  };

  const getDuration = () => {
    if (!attendance.check_in_time || !attendance.check_out_time) return null;
    const start = new Date(attendance.check_in_time);
    const end = new Date(attendance.check_out_time);
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdropPress} onPress={onClose} />
        <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textPrimary} />
            </Pressable>
            <View style={styles.headerInfo}>
              <Text style={styles.title}>{t.attendanceDetails}</Text>
              {employeeName && <Text style={styles.employeeName}>{employeeName}</Text>}
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.topSection}>
              {(date || attendance.date) && (
                <View style={styles.dateRow}>
                  <Text style={styles.dateText}>{formatDate(date || attendance.date)}</Text>
                  <View style={[styles.iconWrapper, { backgroundColor: Colors.tint.blue }]}>
                    <Calendar size={14} color={Colors.primary} />
                  </View>
                </View>
              )}

              <View style={styles.statusRow}>
                <StatusBadge status={attendance.status} size="large" />
              </View>
            </View>

            {(employeeShiftStart || employeeShiftEnd) && (
              <View style={styles.shiftCard}>
                <View style={styles.shiftHeader}>
                  <Text style={styles.shiftTitle}>{t.shiftTime}</Text>
                  <View style={[styles.iconWrapper, { backgroundColor: Colors.tint.orange }]}>
                    <Briefcase size={14} color={Colors.warning} />
                  </View>
                </View>
                <View style={styles.shiftTimes}>
                  <View style={styles.shiftItem}>
                    <Text style={styles.shiftValue}>{formatShiftTime(employeeShiftEnd)}</Text>
                    <Text style={styles.shiftLabel}>{t.endTime}</Text>
                  </View>
                  <View style={styles.shiftDivider} />
                  <View style={styles.shiftItem}>
                    <Text style={styles.shiftValue}>{formatShiftTime(employeeShiftStart)}</Text>
                    <Text style={styles.shiftLabel}>{t.startTime}</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t.checkIn}</Text>
                <View style={[styles.iconWrapper, { backgroundColor: Colors.successLight }]}>
                  <LogIn size={16} color={Colors.success} />
                </View>
              </View>

              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoValue}>{formatTime(attendance.check_in_time)}</Text>
                  <View style={styles.infoMeta}>
                    <Text style={styles.infoLabel}>{t.time}</Text>
                    <Clock size={12} color={Colors.textTertiary} />
                  </View>
                </View>

                {attendance.check_in_location && (
                  <>
                    <View style={styles.infoDivider} />
                    <View style={styles.infoRow}>
                      <Text style={styles.infoValue} numberOfLines={2}>{attendance.check_in_location}</Text>
                      <View style={styles.infoMeta}>
                        <Text style={styles.infoLabel}>{t.location}</Text>
                        <MapPin size={12} color={Colors.textTertiary} />
                      </View>
                    </View>
                  </>
                )}

                {attendance.check_in_latitude && attendance.check_in_longitude && (
                  <View style={styles.mapWrapper}>
                    <MapViewEmbed
                      latitude={attendance.check_in_latitude}
                      longitude={attendance.check_in_longitude}
                      title={t.checkIn}
                      markerColor={Colors.success}
                    />
                  </View>
                )}
              </View>
            </View>

            {attendance.check_out_time && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t.checkOut}</Text>
                  <View style={[styles.iconWrapper, { backgroundColor: Colors.tint.purple }]}>
                    <LogOut size={16} color={Colors.secondary} />
                  </View>
                </View>

                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoValue}>{formatTime(attendance.check_out_time)}</Text>
                    <View style={styles.infoMeta}>
                      <Text style={styles.infoLabel}>{t.time}</Text>
                      <Clock size={12} color={Colors.textTertiary} />
                    </View>
                  </View>

                  {attendance.check_out_location && (
                    <>
                      <View style={styles.infoDivider} />
                      <View style={styles.infoRow}>
                        <Text style={styles.infoValue} numberOfLines={2}>{attendance.check_out_location}</Text>
                        <View style={styles.infoMeta}>
                          <Text style={styles.infoLabel}>{t.location}</Text>
                          <MapPin size={12} color={Colors.textTertiary} />
                        </View>
                      </View>
                    </>
                  )}

                  {attendance.check_out_latitude && attendance.check_out_longitude && (
                    <View style={styles.mapWrapper}>
                      <MapViewEmbed
                        latitude={attendance.check_out_latitude}
                        longitude={attendance.check_out_longitude}
                        title={t.checkOut}
                        markerColor={Colors.secondary}
                      />
                    </View>
                  )}

                  {attendance.check_out_photo && (
                    <View style={styles.photoContainer}>
                      <View style={styles.photoLabel}>
                        <Text style={styles.photoLabelText}>{t.photo}</Text>
                        <Camera size={14} color={Colors.textTertiary} />
                      </View>
                      <Image source={{ uri: attendance.check_out_photo }} style={styles.photo} contentFit="cover" />
                    </View>
                  )}
                </View>
              </View>
            )}

            {getDuration() && (
              <View style={styles.durationCard}>
                <View style={styles.durationContent}>
                  <Text style={styles.durationValue}>{getDuration()}</Text>
                  <Text style={styles.durationLabel}>{t.duration}</Text>
                </View>
                <View style={[styles.durationIcon, { backgroundColor: Colors.tint.blue }]}>
                  <Clock size={20} color={Colors.primary} />
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "flex-end",
  },
  backdropPress: {
    flex: 1,
  },
  container: {
    backgroundColor: Colors.backgroundSecondary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.fillTertiary,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  headerInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "right",
    letterSpacing: -0.3,
  },
  employeeName: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: "right",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.fillQuaternary,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 20,
    gap: 20,
  },
  topSection: {
    gap: 16,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  dateText: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: "500",
    textAlign: "right",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  shiftCard: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  shiftHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    marginBottom: 16,
  },
  shiftTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  shiftTimes: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  shiftItem: {
    flex: 1,
    alignItems: "center",
  },
  shiftValue: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  shiftLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  shiftDivider: {
    width: 1,
    height: 44,
    backgroundColor: Colors.separator,
    marginHorizontal: 20,
  },
  section: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.textPrimary,
    textAlign: "right",
  },
  infoCard: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  infoMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: "500",
  },
  infoValue: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: "600",
    textAlign: "right",
  },
  infoDivider: {
    height: 1,
    backgroundColor: Colors.separator,
    marginVertical: 14,
  },
  mapWrapper: {
    marginTop: 14,
  },
  photoContainer: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  photoLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginBottom: 12,
  },
  photoLabelText: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: "500",
    textAlign: "right",
  },
  photo: {
    width: "100%",
    height: 200,
    borderRadius: 14,
    backgroundColor: Colors.backgroundTertiary,
  },
  durationCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  durationContent: {
    alignItems: "flex-end",
    flex: 1,
  },
  durationLabel: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  durationValue: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.primary,
  },
  durationIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 16,
  },
});
