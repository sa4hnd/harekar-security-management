import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Modal, TextInput, Platform, KeyboardAvoidingView } from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar, Plus, ChevronRight, Clock, MapPin, User, X, Check, Trash2, ChevronLeft, ChevronDown, AlertCircle } from "lucide-react-native";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/state/auth";
import { supabase, User as UserType, Shift, Attendance } from "@/lib/supabase";
import * as Haptics from "expo-haptics";

interface ShiftWithDetails extends Shift {
  employee?: UserType;
  attendance?: Attendance;
}

export default function ShiftsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [shifts, setShifts] = useState<ShiftWithDetails[]>([]);
  const [employees, setEmployees] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEmployeeSelect, setShowEmployeeSelect] = useState(false);
  const [newShift, setNewShift] = useState({
    user_id: "",
    location_name: "",
    location_address: "",
    start_time: "08:00",
    end_time: "16:00",
    notes: "",
  });
  const [selectedEmployee, setSelectedEmployee] = useState<UserType | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;

    try {
      const dateStr = selectedDate.toISOString().split("T")[0];

      const [shiftsRes, employeesRes] = await Promise.all([
        supabase.from("shifts").select("*").eq("date", dateStr).order("start_time"),
        supabase.from("users").select("*").eq("role", "security").order("full_name"),
      ]);

      const shiftsData = shiftsRes.data || [];
      const employeesData = employeesRes.data || [];
      setEmployees(employeesData);

      const attendanceRes = await supabase
        .from("attendance")
        .select("*")
        .in("shift_id", shiftsData.map((s) => s.id));

      const shiftsWithDetails = shiftsData.map((shift) => ({
        ...shift,
        employee: employeesData.find((e) => e.id === shift.user_id),
        attendance: (attendanceRes.data || []).find((a) => a.shift_id === shift.id),
      }));

      setShifts(shiftsWithDetails);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, selectedDate]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [user, selectedDate]);

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const handleSelectEmployee = (emp: UserType) => {
    setSelectedEmployee(emp);
    setNewShift({ ...newShift, user_id: emp.id });
    setShowEmployeeSelect(false);
  };

  const handleCreateShift = async () => {
    if (!newShift.user_id || !newShift.location_name.trim() || !newShift.location_address.trim()) {
      setValidationError("Please fill in all required fields");
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    setValidationError(null);
    setIsCreating(true);

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const dateStr = selectedDate.toISOString().split("T")[0];

      const { data: shiftData, error: shiftError } = await supabase
        .from("shifts")
        .insert({
          user_id: newShift.user_id,
          location_name: newShift.location_name.trim(),
          location_address: newShift.location_address.trim(),
          start_time: newShift.start_time,
          end_time: newShift.end_time,
          date: dateStr,
          notes: newShift.notes.trim() || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (shiftError) throw shiftError;

      await supabase.from("attendance").insert({
        user_id: newShift.user_id,
        shift_id: shiftData.id,
        status: "pending",
      });

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setNewShift({
        user_id: "",
        location_name: "",
        location_address: "",
        start_time: "08:00",
        end_time: "16:00",
        notes: "",
      });
      setSelectedEmployee(null);
      setValidationError(null);
      setShowAddModal(false);
      fetchData();
    } catch (error) {
      console.error("Error creating shift:", error);
      setValidationError("Failed to create shift. Please try again.");
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteShift = async (shift: ShiftWithDetails) => {
    const doDelete = async () => {
      try {
        await supabase.from("attendance").delete().eq("shift_id", shift.id);
        const { error } = await supabase.from("shifts").delete().eq("id", shift.id);
        if (error) throw error;
        fetchData();
      } catch (error) {
        console.error("Error deleting shift:", error);
      }
    };

    if (Platform.OS === "web") {
      if (confirm("Are you sure you want to delete this shift?")) {
        doDelete();
      }
    } else {
      Alert.alert("Delete Shift", "Are you sure you want to delete this shift?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "checked_in":
        return Colors.success;
      case "checked_out":
        return Colors.secondary;
      case "late":
        return Colors.warning;
      case "absent":
        return Colors.error;
      default:
        return Colors.textLight;
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case "checked_in":
        return "On duty";
      case "checked_out":
        return "Completed";
      case "late":
        return "Late";
      case "absent":
        return "Absent";
      default:
        return "Pending";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Shifts</Text>
            <Text style={styles.headerSubtitle}>Manage daily assignments</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            onPress={() => setShowAddModal(true)}
          >
            <Plus size={20} color={Colors.white} />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>

        <View style={styles.dateSelector}>
          <Pressable style={styles.dateArrow} onPress={() => changeDate(-1)}>
            <ChevronLeft size={24} color={Colors.textPrimary} />
          </Pressable>
          <View style={styles.dateDisplay}>
            <Calendar size={20} color={Colors.primary} />
            <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          </View>
          <Pressable style={styles.dateArrow} onPress={() => changeDate(1)}>
            <ChevronRight size={24} color={Colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        {shifts.length === 0 ? (
          <View style={styles.emptyState}>
            <Calendar size={48} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>No shifts scheduled</Text>
            <Text style={styles.emptyText}>Add shifts for {formatDate(selectedDate).toLowerCase()}</Text>
          </View>
        ) : (
          shifts.map((shift) => (
            <View key={shift.id} style={styles.shiftCard}>
              <View style={styles.shiftHeader}>
                <View style={styles.employeeInfo}>
                  <View style={styles.employeeAvatar}>
                    <Text style={styles.avatarText}>
                      {shift.employee ? getInitials(shift.employee.full_name) : "?"}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.employeeName}>{shift.employee?.full_name || "Unknown"}</Text>
                    <Text style={styles.employeeEmail}>{shift.employee?.email || ""}</Text>
                  </View>
                </View>
                <Pressable onPress={() => handleDeleteShift(shift)} style={styles.deleteIcon}>
                  <Trash2 size={18} color={Colors.error} />
                </Pressable>
              </View>

              <View style={styles.shiftDetails}>
                <View style={styles.shiftRow}>
                  <MapPin size={16} color={Colors.primary} />
                  <View style={styles.shiftInfo}>
                    <Text style={styles.locationName}>{shift.location_name}</Text>
                    <Text style={styles.locationAddress}>{shift.location_address}</Text>
                  </View>
                </View>

                <View style={styles.shiftRow}>
                  <Clock size={16} color={Colors.textSecondary} />
                  <Text style={styles.shiftTime}>
                    {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                  </Text>
                </View>

                {shift.notes && (
                  <View style={styles.notesContainer}>
                    <Text style={styles.notesText}>{shift.notes}</Text>
                  </View>
                )}
              </View>

              <View style={styles.shiftFooter}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(shift.attendance?.status) + "20" }]}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(shift.attendance?.status) }]} />
                  <Text style={[styles.statusText, { color: getStatusColor(shift.attendance?.status) }]}>
                    {getStatusText(shift.attendance?.status)}
                  </Text>
                </View>
                {shift.attendance?.check_in_time && (
                  <Text style={styles.checkInTime}>
                    In: {new Date(shift.attendance.check_in_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                )}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Shift</Text>
              <Pressable onPress={() => { setValidationError(null); setShowAddModal(false); }} style={styles.closeButton}>
                <X size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Validation Error Banner */}
              {validationError && (
                <View style={styles.validationError}>
                  <AlertCircle size={18} color={Colors.error} />
                  <Text style={styles.validationErrorText}>{validationError}</Text>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Employee *</Text>
                <Pressable
                  style={[styles.selectButton, validationError && !newShift.user_id && styles.inputError]}
                  onPress={() => { setValidationError(null); setShowEmployeeSelect(true); }}
                >
                  {selectedEmployee ? (
                    <View style={styles.selectedEmployee}>
                      <View style={styles.selectAvatar}>
                        <Text style={styles.selectAvatarText}>{getInitials(selectedEmployee.full_name)}</Text>
                      </View>
                      <Text style={styles.selectedName}>{selectedEmployee.full_name}</Text>
                    </View>
                  ) : (
                    <Text style={styles.selectPlaceholder}>Select an employee</Text>
                  )}
                  <ChevronDown size={20} color={Colors.textSecondary} />
                </Pressable>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Location Name *</Text>
                <TextInput
                  style={[styles.formInput, validationError && !newShift.location_name.trim() && styles.inputError]}
                  placeholder="e.g., Main Building"
                  placeholderTextColor={Colors.textLight}
                  value={newShift.location_name}
                  onChangeText={(text) => { setValidationError(null); setNewShift({ ...newShift, location_name: text }); }}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Location Address *</Text>
                <TextInput
                  style={[styles.formInput, validationError && !newShift.location_address.trim() && styles.inputError]}
                  placeholder="Enter full address"
                  placeholderTextColor={Colors.textLight}
                  value={newShift.location_address}
                  onChangeText={(text) => { setValidationError(null); setNewShift({ ...newShift, location_address: text }); }}
                />
              </View>

              <View style={styles.timeRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Start Time</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="08:00"
                    placeholderTextColor={Colors.textLight}
                    value={newShift.start_time}
                    onChangeText={(text) => setNewShift({ ...newShift, start_time: text })}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>End Time</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="16:00"
                    placeholderTextColor={Colors.textLight}
                    value={newShift.end_time}
                    onChangeText={(text) => setNewShift({ ...newShift, end_time: text })}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notes</Text>
                <TextInput
                  style={[styles.formInput, styles.notesInput]}
                  placeholder="Optional notes for this shift"
                  placeholderTextColor={Colors.textLight}
                  value={newShift.notes}
                  onChangeText={(text) => setNewShift({ ...newShift, notes: text })}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.createButton,
                  pressed && styles.createButtonPressed,
                  isCreating && styles.createButtonDisabled,
                ]}
                onPress={handleCreateShift}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Check size={20} color={Colors.white} />
                    <Text style={styles.createButtonText}>Create Shift</Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showEmployeeSelect} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20, maxHeight: "70%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Employee</Text>
              <Pressable onPress={() => setShowEmployeeSelect(false)} style={styles.closeButton}>
                <X size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {employees.map((emp) => (
                <Pressable
                  key={emp.id}
                  style={({ pressed }) => [styles.employeeOption, pressed && styles.employeeOptionPressed]}
                  onPress={() => handleSelectEmployee(emp)}
                >
                  <View style={styles.employeeOptionAvatar}>
                    <Text style={styles.avatarText}>{getInitials(emp.full_name)}</Text>
                  </View>
                  <View style={styles.employeeOptionInfo}>
                    <Text style={styles.employeeOptionName}>{emp.full_name}</Text>
                    <Text style={styles.employeeOptionEmail}>{emp.email}</Text>
                  </View>
                  {selectedEmployee?.id === emp.id && <Check size={20} color={Colors.primary} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  validationError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.error + "15",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.error + "30",
  },
  validationErrorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: Colors.error,
  },
  inputError: {
    borderColor: Colors.error,
    borderWidth: 1.5,
  },
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  addButtonPressed: {
    opacity: 0.9,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.white,
  },
  dateSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    padding: 8,
  },
  dateArrow: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  dateDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  scrollContent: {
    padding: 20,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    backgroundColor: Colors.white,
    borderRadius: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  shiftCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  shiftHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  employeeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  employeeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.white,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  employeeEmail: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  deleteIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.errorLight,
    justifyContent: "center",
    alignItems: "center",
  },
  shiftDetails: {
    gap: 12,
  },
  shiftRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  shiftInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  locationAddress: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  shiftTime: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  notesContainer: {
    backgroundColor: Colors.gray50,
    borderRadius: 8,
    padding: 10,
  },
  notesText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: "italic",
  },
  shiftFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  checkInTime: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
    justifyContent: "center",
    alignItems: "center",
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notesInput: {
    height: 80,
    textAlignVertical: "top",
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectPlaceholder: {
    fontSize: 16,
    color: Colors.textLight,
  },
  selectedEmployee: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  selectAvatarText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.white,
  },
  selectedName: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  timeRow: {
    flexDirection: "row",
    gap: 16,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  createButtonPressed: {
    opacity: 0.9,
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.white,
  },
  employeeOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  employeeOptionPressed: {
    backgroundColor: Colors.gray50,
  },
  employeeOptionAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  employeeOptionInfo: {
    flex: 1,
  },
  employeeOptionName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  employeeOptionEmail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
