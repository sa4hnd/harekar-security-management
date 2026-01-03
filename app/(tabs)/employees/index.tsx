import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Modal, TextInput, Platform, KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback } from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Users, Plus, Search, ChevronRight, Mail, Phone, Shield, X, Check, Trash2, Clock } from "lucide-react-native";
import { Colors } from "@/constants/colors";
import { t } from "@/constants/translations";
import { useAuth } from "@/state/auth";
import { supabase, User, Attendance } from "@/lib/supabase";
import AttendanceDetails from "@/components/AttendanceDetails";

interface EmployeeWithStats extends User {
  todayAttendance?: Attendance;
}

export default function EmployeesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithStats | null>(null);
  const [selectedAttendance, setSelectedAttendance] = useState<Attendance | null>(null);
  const [showAttendanceDetails, setShowAttendanceDetails] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ full_name: "", email: "", phone: "", password: "", shift_start: "08:00", shift_end: "16:00" });
  const [editShiftStart, setEditShiftStart] = useState("08:00");
  const [editShiftEnd, setEditShiftEnd] = useState("16:00");
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingShift, setIsSavingShift] = useState(false);

  const fetchEmployees = async () => {
    if (!user) return;

    try {
      const { data: employeesData } = await supabase
        .from("users")
        .select("*")
        .eq("role", "security")
        .order("full_name");

      const today = new Date().toISOString().split("T")[0];

      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", today);

      const employeesWithStats = (employeesData || []).map((emp) => {
        const todayAttendance = (attendanceData || []).find((a) => a.user_id === emp.id);
        return { ...emp, todayAttendance };
      });

      setEmployees(employeesWithStats);
      setFilteredEmployees(employeesWithStats);
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = employees.filter(
        (emp) =>
          emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredEmployees(filtered);
    } else {
      setFilteredEmployees(employees);
    }
  }, [searchQuery, employees]);

  useEffect(() => {
    if (selectedEmployee) {
      setEditShiftStart(selectedEmployee.shift_start_time?.slice(0, 5) || "08:00");
      setEditShiftEnd(selectedEmployee.shift_end_time?.slice(0, 5) || "16:00");
    }
  }, [selectedEmployee]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEmployees();
  }, [user]);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleCreateEmployee = async () => {
    if (!newEmployee.full_name.trim() || !newEmployee.email.trim() || !newEmployee.password.trim()) {
      return;
    }

    dismissKeyboard();
    setIsCreating(true);
    try {
      const { error } = await supabase.from("users").insert({
        full_name: newEmployee.full_name.trim(),
        email: newEmployee.email.toLowerCase().trim(),
        phone: newEmployee.phone.trim() || null,
        password_hash: newEmployee.password,
        role: "security",
        shift_start_time: newEmployee.shift_start + ":00",
        shift_end_time: newEmployee.shift_end + ":00",
        created_by: user?.id,
      });

      if (error) {
        console.error("Error creating employee:", error);
        return;
      }

      setNewEmployee({ full_name: "", email: "", phone: "", password: "", shift_start: "08:00", shift_end: "16:00" });
      setShowAddModal(false);
      fetchEmployees();
    } catch (error) {
      console.error("Error creating employee:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveShift = async () => {
    if (!selectedEmployee) return;
    dismissKeyboard();
    setIsSavingShift(true);

    try {
      const { error } = await supabase
        .from("users")
        .update({
          shift_start_time: editShiftStart + ":00",
          shift_end_time: editShiftEnd + ":00",
        })
        .eq("id", selectedEmployee.id);

      if (error) throw error;

      fetchEmployees();
      setSelectedEmployee({
        ...selectedEmployee,
        shift_start_time: editShiftStart + ":00",
        shift_end_time: editShiftEnd + ":00",
      });
    } catch (error) {
      console.error("Error saving shift:", error);
    } finally {
      setIsSavingShift(false);
    }
  };

  const handleDeleteEmployee = async (emp: EmployeeWithStats) => {
    const doDelete = async () => {
      try {
        const { error } = await supabase.from("users").delete().eq("id", emp.id);
        if (error) throw error;
        setShowDetailModal(false);
        setSelectedEmployee(null);
        fetchEmployees();
      } catch (error) {
        console.error("Error deleting employee:", error);
      }
    };

    if (Platform.OS === "web") {
      if (confirm(`${t.confirmRemove}`)) {
        doDelete();
      }
    } else {
      doDelete();
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "checked_in": return Colors.success;
      case "checked_out": return Colors.secondary;
      case "late": return Colors.warning;
      case "absent": return Colors.error;
      default: return Colors.textTertiary;
    }
  };

  const getStatusBg = (status?: string) => {
    switch (status) {
      case "checked_in": return Colors.successLight;
      case "checked_out": return Colors.tint.purple;
      case "late": return Colors.warningLight;
      case "absent": return Colors.errorLight;
      default: return Colors.fillQuaternary;
    }
  };

  const getStatusText = (employee: EmployeeWithStats) => {
    if (!employee.todayAttendance) return t.pending;
    switch (employee.todayAttendance.status) {
      case "checked_in": return t.onDuty;
      case "checked_out": return t.completed;
      case "late": return t.late;
      case "absent": return t.absent;
      default: return t.pending;
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

  const formatTime = (time?: string) => {
    if (!time) return "--:--";
    const [hours, minutes] = time.split(":");
    return `${hours}:${minutes}`;
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
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            onPress={() => setShowAddModal(true)}
          >
            <Plus size={18} color={Colors.white} />
            <Text style={styles.addButtonText}>{t.addEmployee}</Text>
          </Pressable>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>{t.employees}</Text>
            <Text style={styles.headerSubtitle}>{employees.length} {t.securityGuards}</Text>
          </View>
        </View>

        <Pressable style={styles.searchContainer} onPress={dismissKeyboard}>
          <TextInput
            style={styles.searchInput}
            placeholder={t.searchEmployees}
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            textAlign="right"
            returnKeyType="search"
            onSubmitEditing={dismissKeyboard}
          />
          <Search size={18} color={Colors.textTertiary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {filteredEmployees.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <Users size={36} color={Colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>{t.noEmployees}</Text>
            <Text style={styles.emptyText}>{t.addFirst}</Text>
          </View>
        ) : (
          <View style={styles.employeeList}>
            {filteredEmployees.map((emp) => (
              <Pressable
                key={emp.id}
                style={({ pressed }) => [styles.employeeCard, pressed && styles.employeeCardPressed]}
                onPress={() => {
                  setSelectedEmployee(emp);
                  setShowDetailModal(true);
                }}
              >
                <View style={styles.employeeCardContent}>
                  <View style={styles.employeeLeft}>
                    <ChevronRight size={18} color={Colors.textTertiary} style={styles.chevronRtl} />
                    <View style={[styles.statusBadge, { backgroundColor: getStatusBg(emp.todayAttendance?.status) }]}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(emp.todayAttendance?.status) }]} />
                      <Text style={[styles.statusText, { color: getStatusColor(emp.todayAttendance?.status) }]}>
                        {getStatusText(emp)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.employeeCenter}>
                    <Text style={styles.employeeName}>{emp.full_name}</Text>
                    <View style={styles.shiftInfo}>
                      <Clock size={12} color={Colors.textTertiary} />
                      <Text style={styles.shiftText}>
                        {formatTime(emp.shift_start_time)} - {formatTime(emp.shift_end_time)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.employeeRight}>
                    <View style={styles.employeeAvatar}>
                      <Text style={styles.avatarText}>{getInitials(emp.full_name)}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
          keyboardVerticalOffset={0}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => { dismissKeyboard(); setShowAddModal(false); }} />
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Pressable onPress={() => { dismissKeyboard(); setShowAddModal(false); }} style={styles.closeButton}>
                  <X size={20} color={Colors.textPrimary} />
                </Pressable>
                <Text style={styles.modalTitle}>{t.addEmployee}</Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t.fullName} *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder={t.fullName}
                    placeholderTextColor={Colors.textTertiary}
                    value={newEmployee.full_name}
                    onChangeText={(text) => setNewEmployee({ ...newEmployee, full_name: text })}
                    textAlign="right"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t.email} *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder={t.email}
                    placeholderTextColor={Colors.textTertiary}
                    value={newEmployee.email}
                    onChangeText={(text) => setNewEmployee({ ...newEmployee, email: text })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    textAlign="right"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t.phone}</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder={t.phone}
                    placeholderTextColor={Colors.textTertiary}
                    value={newEmployee.phone}
                    onChangeText={(text) => setNewEmployee({ ...newEmployee, phone: text })}
                    keyboardType="phone-pad"
                    textAlign="right"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t.password} *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder={t.password}
                    placeholderTextColor={Colors.textTertiary}
                    value={newEmployee.password}
                    onChangeText={(text) => setNewEmployee({ ...newEmployee, password: text })}
                    secureTextEntry
                    textAlign="right"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t.shiftTime}</Text>
                  <View style={styles.timeRow}>
                    <View style={styles.timeInput}>
                      <Text style={styles.timeLabel}>{t.endTime}</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="16:00"
                        placeholderTextColor={Colors.textTertiary}
                        value={newEmployee.shift_end}
                        onChangeText={(text) => setNewEmployee({ ...newEmployee, shift_end: text })}
                        textAlign="center"
                        keyboardType="numbers-and-punctuation"
                        returnKeyType="done"
                        onSubmitEditing={handleCreateEmployee}
                      />
                    </View>
                    <View style={styles.timeInput}>
                      <Text style={styles.timeLabel}>{t.startTime}</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="08:00"
                        placeholderTextColor={Colors.textTertiary}
                        value={newEmployee.shift_start}
                        onChangeText={(text) => setNewEmployee({ ...newEmployee, shift_start: text })}
                        textAlign="center"
                        keyboardType="numbers-and-punctuation"
                        returnKeyType="next"
                      />
                    </View>
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.createButton,
                    pressed && styles.createButtonPressed,
                    isCreating && styles.createButtonDisabled,
                  ]}
                  onPress={handleCreateEmployee}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <>
                      <Text style={styles.createButtonText}>{t.createEmployee}</Text>
                      <Check size={20} color={Colors.white} />
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showDetailModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => { dismissKeyboard(); setShowDetailModal(false); }} />
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Pressable onPress={() => { dismissKeyboard(); setShowDetailModal(false); }} style={styles.closeButton}>
                  <X size={20} color={Colors.textPrimary} />
                </Pressable>
                <Text style={styles.modalTitle}>{t.employeeDetails}</Text>
              </View>

              {selectedEmployee && (
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={styles.detailHeader}>
                    <View style={styles.detailAvatarWrapper}>
                      <View style={styles.detailAvatarGlow} />
                      <View style={styles.detailAvatar}>
                        <Text style={styles.detailAvatarText}>{getInitials(selectedEmployee.full_name)}</Text>
                      </View>
                    </View>
                    <Text style={styles.detailName}>{selectedEmployee.full_name}</Text>
                    <View style={styles.detailBadge}>
                      <Shield size={14} color={Colors.white} />
                    </View>
                  </View>

                  <View style={styles.detailCard}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailText}>{selectedEmployee.email}</Text>
                      <View style={[styles.detailIcon, { backgroundColor: Colors.tint.blue }]}>
                        <Mail size={16} color={Colors.primary} />
                      </View>
                    </View>
                    {selectedEmployee.phone && (
                      <>
                        <View style={styles.detailDivider} />
                        <View style={styles.detailRow}>
                          <Text style={styles.detailText}>{selectedEmployee.phone}</Text>
                          <View style={[styles.detailIcon, { backgroundColor: Colors.tint.green }]}>
                            <Phone size={16} color={Colors.success} />
                          </View>
                        </View>
                      </>
                    )}
                  </View>

                  <View style={styles.shiftSection}>
                    <View style={styles.shiftSectionHeader}>
                      <Pressable
                        style={({ pressed }) => [styles.saveShiftBtn, pressed && { opacity: 0.7 }, isSavingShift && { opacity: 0.5 }]}
                        onPress={handleSaveShift}
                        disabled={isSavingShift}
                      >
                        {isSavingShift ? (
                          <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                          <>
                            <Check size={14} color={Colors.primary} />
                            <Text style={styles.saveShiftText}>{t.saveChanges}</Text>
                          </>
                        )}
                      </Pressable>
                      <Text style={styles.sectionLabel}>{t.shiftTime}</Text>
                    </View>
                    <View style={styles.shiftEditCard}>
                      <View style={styles.shiftEditRow}>
                        <View style={styles.shiftEditInputGroup}>
                          <Text style={styles.shiftEditLabel}>{t.endTime}</Text>
                          <TextInput
                            style={styles.shiftEditInput}
                            value={editShiftEnd}
                            onChangeText={setEditShiftEnd}
                            placeholder="16:00"
                            placeholderTextColor={Colors.textTertiary}
                            textAlign="center"
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                        <View style={styles.shiftEditInputGroup}>
                          <Text style={styles.shiftEditLabel}>{t.startTime}</Text>
                          <TextInput
                            style={styles.shiftEditInput}
                            value={editShiftStart}
                            onChangeText={setEditShiftStart}
                            placeholder="08:00"
                            placeholderTextColor={Colors.textTertiary}
                            textAlign="center"
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                        <View style={[styles.detailIcon, { backgroundColor: Colors.tint.orange }]}>
                          <Clock size={18} color={Colors.warning} />
                        </View>
                      </View>
                    </View>
                  </View>

                  {selectedEmployee.todayAttendance && (
                    <Pressable
                      style={({ pressed }) => [styles.attendanceSection, pressed && { opacity: 0.9 }]}
                      onPress={() => {
                        setSelectedAttendance(selectedEmployee.todayAttendance!);
                        setShowAttendanceDetails(true);
                      }}
                    >
                      <View style={styles.attendanceSectionHeader}>
                        <ChevronRight size={18} color={Colors.textTertiary} style={styles.chevronRtl} />
                        <Text style={styles.sectionLabel}>{t.today}</Text>
                      </View>
                      <View style={styles.attendanceCard}>
                        <View style={styles.attendanceCardRow}>
                          <View style={[styles.statusDot, { backgroundColor: getStatusColor(selectedEmployee.todayAttendance.status) }]} />
                          <Text style={styles.attendanceStatus}>{getStatusText(selectedEmployee)}</Text>
                        </View>
                        {selectedEmployee.todayAttendance.check_in_time && (
                          <Text style={styles.attendanceTime}>
                            {t.checkIn}: {new Date(selectedEmployee.todayAttendance.check_in_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  )}

                  <Pressable
                    style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
                    onPress={() => handleDeleteEmployee(selectedEmployee)}
                  >
                    <Trash2 size={18} color={Colors.error} />
                    <Text style={styles.deleteButtonText}>{t.removeEmployee}</Text>
                  </Pressable>
                </ScrollView>
              )}
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      <AttendanceDetails
        visible={showAttendanceDetails}
        onClose={() => setShowAttendanceDetails(false)}
        attendance={selectedAttendance}
        employeeName={selectedEmployee?.full_name}
        date={new Date().toISOString().split("T")[0]}
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
    paddingVertical: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerTitles: {
    alignItems: "flex-end",
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
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
    borderRadius: 14,
    gap: 6,
  },
  addButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.white,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 24,
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
    fontSize: 18,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  employeeList: {
    gap: 10,
  },
  employeeCard: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  employeeCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  employeeCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  employeeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chevronRtl: {
    transform: [{ scaleX: -1 }],
  },
  employeeCenter: {
    flex: 1,
    alignItems: "flex-end",
    paddingHorizontal: 12,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 4,
    textAlign: "right",
  },
  shiftInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  shiftText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  employeeRight: {
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: Colors.separator,
  },
  employeeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.white,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
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
    fontWeight: "700",
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
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 10,
    textAlign: "right",
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
  timeRow: {
    flexDirection: "row",
    gap: 12,
  },
  timeInput: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
    textAlign: "center",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    marginTop: 12,
  },
  createButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.white,
  },
  detailHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  detailAvatarWrapper: {
    position: "relative",
    marginBottom: 16,
  },
  detailAvatarGlow: {
    position: "absolute",
    top: -12,
    left: -12,
    right: -12,
    bottom: -12,
    backgroundColor: Colors.primary,
    opacity: 0.15,
    borderRadius: 60,
  },
  detailAvatar: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.glassBorder,
  },
  detailAvatarText: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.white,
  },
  detailName: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  detailBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  detailCard: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 18,
    padding: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 14,
    padding: 14,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  detailDivider: {
    height: 1,
    backgroundColor: Colors.separator,
    marginHorizontal: 14,
  },
  detailText: {
    fontSize: 15,
    color: Colors.textPrimary,
    textAlign: "right",
    flex: 1,
  },
  shiftSection: {
    marginBottom: 20,
  },
  shiftSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  saveShiftBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.tint.blue,
    borderRadius: 10,
  },
  saveShiftText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
  },
  shiftEditCard: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  shiftEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  shiftEditInputGroup: {
    flex: 1,
  },
  shiftEditLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: "center",
    marginBottom: 6,
  },
  shiftEditInput: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  attendanceSection: {
    marginBottom: 20,
  },
  attendanceSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 12,
  },
  attendanceCard: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  attendanceCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 4,
  },
  attendanceStatus: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  attendanceTime: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: "right",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.errorLight,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.error + "30",
  },
  deleteButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.error,
  },
});
