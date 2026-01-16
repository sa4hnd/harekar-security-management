import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Modal, TextInput, Platform, KeyboardAvoidingView, Keyboard } from "react-native";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Users, Plus, Search, ChevronRight, Mail, Phone, Shield, X, Check, Trash2, Clock, Edit3, Save, FileText, Eye, EyeOff, Camera } from "lucide-react-native";
import { Colors } from "@/constants/colors";
import { t } from "@/constants/translations";
import { useAuth } from "@/state/auth";
import { supabase, User, Attendance, uploadAvatar } from "@/lib/supabase";
import AttendanceDetails from "@/components/AttendanceDetails";
import ConfirmationModal from "@/components/ConfirmationModal";
import { formatShiftTime12h, formatTime12h } from "@/lib/utils/time";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";

interface EmployeeWithStats extends User {
  todayAttendance?: Attendance;
  notes?: string;
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
  const [newEmployee, setNewEmployee] = useState({ full_name: "", email: "", phone: "", password: "", shift_start: "08:00", shift_end: "16:00", notes: "" });
  const [editShiftStart, setEditShiftStart] = useState("08:00");
  const [editShiftEnd, setEditShiftEnd] = useState("16:00");
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingShift, setIsSavingShift] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeWithStats | null>(null);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

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
      setEditFullName(selectedEmployee.full_name);
      setEditEmail(selectedEmployee.email);
      setEditPhone(selectedEmployee.phone || "");
      setEditNotes(selectedEmployee.notes || "");
      setEditPassword("");
      setEditAvatarUrl(selectedEmployee.avatar_url || null);
      setIsEditMode(false);
      setShowPassword(false);
    }
  }, [selectedEmployee]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEmployees();
  }, [user]);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handlePickImage = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        // For now, store the local URI - in production you would upload to Supabase Storage
        setEditAvatarUrl(asset.uri);
        if (Platform.OS !== "web") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  const handleTakePhoto = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setEditAvatarUrl(asset.uri);
        if (Platform.OS !== "web") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
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

      setNewEmployee({ full_name: "", email: "", phone: "", password: "", shift_start: "08:00", shift_end: "16:00", notes: "" });
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

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      fetchEmployees();
      setSelectedEmployee({
        ...selectedEmployee,
        shift_start_time: editShiftStart + ":00",
        shift_end_time: editShiftEnd + ":00",
      });
    } catch (error) {
      console.error("Error saving shift:", error);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsSavingShift(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!selectedEmployee || !editFullName.trim() || !editEmail.trim()) return;
    dismissKeyboard();
    setIsSavingDetails(true);

    try {
      const updateData: Record<string, string | null> = {
        full_name: editFullName.trim(),
        email: editEmail.toLowerCase().trim(),
        phone: editPhone.trim() || null,
        notes: editNotes.trim() || null,
      };

      // Only update password if a new one was entered
      if (editPassword.trim()) {
        updateData.password_hash = editPassword;
      }

      // Upload avatar to Supabase Storage if changed
      if (editAvatarUrl && editAvatarUrl !== selectedEmployee.avatar_url) {
        // If it's a new local URI (not already a Supabase URL), upload it
        if (!editAvatarUrl.includes("supabase.co")) {
          const uploadedUrl = await uploadAvatar(selectedEmployee.id, editAvatarUrl);
          if (uploadedUrl) {
            updateData.avatar_url = uploadedUrl;
          }
        } else {
          updateData.avatar_url = editAvatarUrl;
        }
      } else if (!editAvatarUrl && selectedEmployee.avatar_url) {
        // Avatar was removed
        updateData.avatar_url = null;
      }

      const { error } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", selectedEmployee.id);

      if (error) throw error;

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Update local state
      setSelectedEmployee({
        ...selectedEmployee,
        full_name: editFullName.trim(),
        email: editEmail.toLowerCase().trim(),
        phone: editPhone.trim() || "",
        notes: editNotes.trim() || "",
        avatar_url: updateData.avatar_url || undefined,
      });

      setIsEditMode(false);
      setEditPassword("");
      fetchEmployees();
    } catch (error) {
      console.error("Error saving employee details:", error);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleCancelEdit = () => {
    if (selectedEmployee) {
      setEditFullName(selectedEmployee.full_name);
      setEditEmail(selectedEmployee.email);
      setEditPhone(selectedEmployee.phone || "");
      setEditNotes(selectedEmployee.notes || "");
      setEditPassword("");
      setEditAvatarUrl(selectedEmployee.avatar_url || null);
    }
    setIsEditMode(false);
    setShowPassword(false);
  };

  const handleDeleteEmployee = async (emp: EmployeeWithStats) => {
    setEmployeeToDelete(emp);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    try {
      const { error } = await supabase.from("users").delete().eq("id", employeeToDelete.id);
      if (error) throw error;
      setShowDetailModal(false);
      setSelectedEmployee(null);
      setShowDeleteConfirm(false);
      setEmployeeToDelete(null);
      fetchEmployees();
    } catch (error) {
      console.error("Error deleting employee:", error);
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
                        {formatShiftTime12h(emp.shift_start_time)} - {formatShiftTime12h(emp.shift_end_time)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.employeeRight}>
                    <View style={styles.employeeAvatar}>
                      {emp.avatar_url ? (
                        <Image source={{ uri: emp.avatar_url }} style={styles.avatarImage} contentFit="cover" />
                      ) : (
                        <Text style={styles.avatarText}>{getInitials(emp.full_name)}</Text>
                      )}
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          dismissKeyboard();
          setShowAddModal(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
          keyboardVerticalOffset={0}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              dismissKeyboard();
              setShowAddModal(false);
            }}
          />
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Pressable
                onPress={() => {
                  dismissKeyboard();
                  setShowAddModal(false);
                }}
                style={styles.closeButton}
              >
                <X size={20} color={Colors.textPrimary} />
              </Pressable>
              <Text style={styles.modalTitle}>{t.addEmployee}</Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={dismissKeyboard}
            >
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
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          dismissKeyboard();
          setShowDetailModal(false);
          setSelectedEmployee(null);
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
              setShowDetailModal(false);
              setSelectedEmployee(null);
            }}
          />
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Pressable
                onPress={() => {
                  dismissKeyboard();
                  setShowDetailModal(false);
                  setSelectedEmployee(null);
                }}
                style={styles.closeButton}
              >
                <X size={20} color={Colors.textPrimary} />
              </Pressable>
              <Text style={styles.modalTitle}>{t.employeeDetails}</Text>
            </View>

            {selectedEmployee && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={dismissKeyboard}
              >
                <View style={styles.detailHeader}>
                  <View style={styles.detailAvatarWrapper}>
                    <View style={styles.detailAvatarGlow} />
                    <View style={styles.detailAvatar}>
                      {editAvatarUrl ? (
                        <Image source={{ uri: editAvatarUrl }} style={styles.detailAvatarImage} contentFit="cover" />
                      ) : (
                        <Text style={styles.detailAvatarText}>{getInitials(isEditMode ? editFullName : selectedEmployee.full_name)}</Text>
                      )}
                    </View>
                    {isEditMode && (
                      <View style={styles.avatarEditButtons}>
                        <Pressable
                          style={({ pressed }) => [styles.avatarEditBtn, pressed && { opacity: 0.7 }]}
                          onPress={handleTakePhoto}
                        >
                          <Camera size={16} color={Colors.white} />
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [styles.avatarEditBtn, styles.avatarGalleryBtn, pressed && { opacity: 0.7 }]}
                          onPress={handlePickImage}
                        >
                          <Plus size={16} color={Colors.white} />
                        </Pressable>
                      </View>
                    )}
                  </View>
                  {isEditMode ? (
                    <TextInput
                      style={styles.detailNameInput}
                      value={editFullName}
                      onChangeText={setEditFullName}
                      placeholder={t.fullName}
                      placeholderTextColor={Colors.textTertiary}
                      textAlign="center"
                    />
                  ) : (
                    <Text style={styles.detailName}>{selectedEmployee.full_name}</Text>
                  )}
                  <View style={styles.detailBadge}>
                    <Shield size={14} color={Colors.white} />
                  </View>
                </View>

                {/* Edit Mode Toggle Button */}
                <View style={styles.editModeSection}>
                  {isEditMode ? (
                    <View style={styles.editModeButtons}>
                      <Pressable
                        style={({ pressed }) => [styles.cancelEditBtn, pressed && { opacity: 0.7 }]}
                        onPress={handleCancelEdit}
                      >
                        <X size={16} color={Colors.error} />
                        <Text style={styles.cancelEditText}>{t.cancel}</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.saveEditBtn, pressed && { opacity: 0.7 }, isSavingDetails && { opacity: 0.5 }]}
                        onPress={handleSaveDetails}
                        disabled={isSavingDetails}
                      >
                        {isSavingDetails ? (
                          <ActivityIndicator size="small" color={Colors.white} />
                        ) : (
                          <>
                            <Save size={16} color={Colors.white} />
                            <Text style={styles.saveEditText}>{t.save}</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [styles.editModeBtn, pressed && { opacity: 0.7 }]}
                      onPress={() => setIsEditMode(true)}
                    >
                      <Edit3 size={16} color={Colors.primary} />
                      <Text style={styles.editModeText}>{t.edit}</Text>
                    </Pressable>
                  )}
                </View>

                {/* Contact Info Card */}
                <View style={styles.detailCard}>
                  <View style={styles.detailRow}>
                    {isEditMode ? (
                      <TextInput
                        style={styles.detailInput}
                        value={editEmail}
                        onChangeText={setEditEmail}
                        placeholder={t.email}
                        placeholderTextColor={Colors.textTertiary}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        textAlign="right"
                      />
                    ) : (
                      <Text style={styles.detailText}>{selectedEmployee.email}</Text>
                    )}
                    <View style={[styles.detailIcon, { backgroundColor: Colors.tint.blue }]}>
                      <Mail size={16} color={Colors.primary} />
                    </View>
                  </View>

                  <View style={styles.detailDivider} />

                  <View style={styles.detailRow}>
                    {isEditMode ? (
                      <TextInput
                        style={styles.detailInput}
                        value={editPhone}
                        onChangeText={setEditPhone}
                        placeholder={t.phone}
                        placeholderTextColor={Colors.textTertiary}
                        keyboardType="phone-pad"
                        textAlign="right"
                      />
                    ) : (
                      <Text style={styles.detailText}>{selectedEmployee.phone || "-"}</Text>
                    )}
                    <View style={[styles.detailIcon, { backgroundColor: Colors.tint.green }]}>
                      <Phone size={16} color={Colors.success} />
                    </View>
                  </View>

                  {isEditMode && (
                    <>
                      <View style={styles.detailDivider} />
                      <View style={styles.detailRow}>
                        <View style={styles.passwordInputWrapper}>
                          <Pressable
                            style={styles.eyeButton}
                            onPress={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff size={18} color={Colors.textTertiary} />
                            ) : (
                              <Eye size={18} color={Colors.textTertiary} />
                            )}
                          </Pressable>
                          <TextInput
                            style={[styles.detailInput, { flex: 1 }]}
                            value={editPassword}
                            onChangeText={setEditPassword}
                            placeholder={t.newPassword}
                            placeholderTextColor={Colors.textTertiary}
                            secureTextEntry={!showPassword}
                            textAlign="right"
                          />
                        </View>
                        <View style={[styles.detailIcon, { backgroundColor: Colors.tint.purple }]}>
                          <Shield size={16} color={Colors.secondary} />
                        </View>
                      </View>
                    </>
                  )}
                </View>

                {/* Notes Section */}
                <View style={styles.notesSection}>
                  <View style={styles.notesSectionHeader}>
                    <FileText size={16} color={Colors.textSecondary} />
                    <Text style={styles.sectionLabel}>{t.notes}</Text>
                  </View>
                  <View style={styles.notesCard}>
                    {isEditMode ? (
                      <TextInput
                        style={styles.notesInput}
                        value={editNotes}
                        onChangeText={setEditNotes}
                        placeholder={t.addNote}
                        placeholderTextColor={Colors.textTertiary}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        textAlign="right"
                      />
                    ) : (
                      <Text style={[styles.notesText, !selectedEmployee.notes && styles.notesPlaceholder]}>
                        {selectedEmployee.notes || t.noNotes}
                      </Text>
                    )}
                  </View>
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
                          onBlur={dismissKeyboard}
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
                          onBlur={dismissKeyboard}
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
                          {t.checkIn}: {formatTime12h(selectedEmployee.todayAttendance.check_in_time)}
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
        </KeyboardAvoidingView>
      </Modal>

      <AttendanceDetails
        visible={showAttendanceDetails}
        onClose={() => setShowAttendanceDetails(false)}
        attendance={selectedAttendance}
        employeeName={selectedEmployee?.full_name}
        date={new Date().toISOString().split("T")[0]}
      />

      <ConfirmationModal
        visible={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setEmployeeToDelete(null);
        }}
        onConfirm={confirmDeleteEmployee}
        title={t.removeEmployee}
        message={employeeToDelete ? `${t.confirmRemove} ${employeeToDelete.full_name}?` : t.confirmRemove}
        confirmText={t.remove}
        cancelText={t.cancel}
        variant="danger"
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
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
  },
  detailAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 45,
  },
  avatarEditButtons: {
    position: "absolute",
    bottom: -5,
    flexDirection: "row",
    gap: 8,
  },
  avatarEditBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.backgroundSecondary,
  },
  avatarGalleryBtn: {
    backgroundColor: Colors.success,
  },
  detailNameInput: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 10,
    letterSpacing: -0.3,
    textAlign: "center",
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.primary + "40",
    minWidth: 200,
  },
  editModeSection: {
    marginBottom: 20,
    alignItems: "center",
  },
  editModeButtons: {
    flexDirection: "row",
    gap: 12,
  },
  editModeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.tint.blue,
    borderRadius: 12,
  },
  editModeText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  cancelEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
  },
  cancelEditText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.error,
  },
  saveEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  saveEditText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.white,
  },
  detailInput: {
    fontSize: 15,
    color: Colors.textPrimary,
    textAlign: "right",
    flex: 1,
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.primary + "30",
  },
  passwordInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eyeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.fillQuaternary,
  },
  notesSection: {
    marginBottom: 20,
  },
  notesSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 12,
  },
  notesCard: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    minHeight: 80,
  },
  notesInput: {
    fontSize: 15,
    color: Colors.textPrimary,
    textAlign: "right",
    minHeight: 80,
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.primary + "30",
  },
  notesText: {
    fontSize: 15,
    color: Colors.textPrimary,
    textAlign: "right",
    lineHeight: 22,
  },
  notesPlaceholder: {
    color: Colors.textTertiary,
    fontStyle: "italic",
  },
});
