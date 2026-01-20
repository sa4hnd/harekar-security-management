import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Modal, TextInput, Platform, KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback, ViewStyle } from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, Plus, X, Check, ChevronRight, Clock, MapPin, Shield, AlertCircle, Wrench, HelpCircle, Flame, FileText, Camera, ImageIcon } from "lucide-react-native";
import { Colors } from "@/constants/colors";
import { t } from "@/constants/translations";
import { useAuth } from "@/state/auth";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import {
  supabase,
  Incident,
  IncidentWithUser,
  createIncident,
  getIncidentsWithUsers,
  updateIncidentStatus,
  getActivePushTokens,
  logNotification,
} from "@/lib/supabase";
import { sendPushNotificationsToUsers } from "@/lib/notifications/pushService";

const INCIDENT_TYPES = [
  { id: "security_breach", label: t.securityBreach, icon: Shield, color: Colors.error },
  { id: "suspicious_activity", label: t.suspiciousActivity, icon: AlertCircle, color: Colors.warning },
  { id: "equipment_issue", label: t.equipmentIssue, icon: Wrench, color: Colors.primary },
  { id: "other", label: t.other, icon: HelpCircle, color: Colors.textSecondary },
];

export default function IncidentsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<IncidentWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<IncidentWithUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [newIncident, setNewIncident] = useState({
    type: "suspicious_activity" as Incident["type"],
    priority: "normal" as Incident["priority"],
    description: "",
    location: "",
  });

  const isSupervisor = user?.role === "supervisor";

  const fetchIncidents = async () => {
    try {
      const data = await getIncidentsWithUsers();
      setIncidents(data);
    } catch (error) {
      console.error("Error fetching incidents:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchIncidents();
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
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          setSelectedPhotoUri(`data:image/jpeg;base64,${asset.base64}`);
        } else {
          setSelectedPhotoUri(asset.uri);
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
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
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          setSelectedPhotoUri(`data:image/jpeg;base64,${asset.base64}`);
        } else {
          setSelectedPhotoUri(asset.uri);
        }
      }
    } catch (error) {
      console.error("Error taking photo:", error);
    }
  };

  const handleSubmitIncident = async () => {
    // Validation
    if (!newIncident.description.trim()) {
      setValidationError(t.descriptionRequired || "Please enter a description");
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      return;
    }

    if (!user) {
      setValidationError(t.loginRequired || "Please login first");
      return;
    }

    setValidationError(null);
    dismissKeyboard();
    setIsSubmitting(true);

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      let locationAddress = t.locationUnavailable;
      let latitude = 0;
      let longitude = 0;

      if (Platform.OS !== "web") {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          try {
            const loc = await Location.getCurrentPositionAsync({});
            latitude = loc.coords.latitude;
            longitude = loc.coords.longitude;
            const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (addresses.length > 0) {
              const addr = addresses[0];
              locationAddress = `${addr.street || ""}, ${addr.city || ""}`.replace(/^, |, $/g, "");
            }
          } catch {
            locationAddress = newIncident.location || t.locationUnavailable;
          }
        }
      }

      // Create incident in Supabase with photo upload
      const incidentData: Omit<Incident, "id" | "created_at" | "updated_at"> = {
        user_id: user.id,
        type: newIncident.type,
        priority: newIncident.priority,
        description: newIncident.description.trim(),
        location: locationAddress,
        latitude,
        longitude,
        status: "pending",
      };

      const { id: incidentId, success } = await createIncident(incidentData, selectedPhotoUri || undefined);

      if (!success) {
        throw new Error("Failed to create incident");
      }

      // Send push notification to all users about the new incident
      const typeLabel = INCIDENT_TYPES.find(t => t.id === newIncident.type)?.label || newIncident.type;
      const priorityText = newIncident.priority === "urgent" ? " [URGENT]" : "";
      const notificationTitle = `${t.newIncident}${priorityText}`;
      const notificationBody = `${user.full_name}: ${newIncident.description.substring(0, 100)}${newIncident.description.length > 100 ? "..." : ""}`;

      // Get all push tokens and send notifications
      try {
        const tokens = await getActivePushTokens("all");
        if (tokens.length > 0) {
          await sendPushNotificationsToUsers(
            tokens,
            notificationTitle,
            notificationBody,
            { type: "incident", incidentId, incidentType: newIncident.type }
          );

          // Log notification for each user
          for (const token of tokens) {
            await logNotification(
              token.user_id,
              notificationTitle,
              notificationBody,
              "incident",
              user.id,
              { incidentId, incidentType: newIncident.type },
              token.push_token
            );
          }
        }
      } catch (notifyError) {
        console.error("Error sending notifications:", notifyError);
        // Don't fail the incident creation if notifications fail
      }

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setNewIncident({
        type: "suspicious_activity",
        priority: "normal",
        description: "",
        location: "",
      });
      setSelectedPhotoUri(null);
      setShowReportModal(false);
      fetchIncidents();
    } catch (error) {
      console.error("Error submitting incident:", error);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (incidentId: string, newStatus: Incident["status"]) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const success = await updateIncidentStatus(
        incidentId,
        newStatus,
        newStatus === "resolved" ? user?.id : undefined
      );

      if (success) {
        fetchIncidents();
        setShowDetailModal(false);

        if (Platform.OS !== "web") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error("Error updating incident:", error);
    }
  };

  const getTypeIcon = (type: Incident["type"]) => {
    const typeConfig = INCIDENT_TYPES.find(t => t.id === type);
    return typeConfig || INCIDENT_TYPES[3];
  };

  const getStatusColor = (status: Incident["status"]) => {
    switch (status) {
      case "pending": return Colors.warning;
      case "in_progress": return Colors.primary;
      case "resolved": return Colors.success;
      default: return Colors.textTertiary;
    }
  };

  const getStatusBg = (status: Incident["status"]) => {
    switch (status) {
      case "pending": return Colors.warningLight;
      case "in_progress": return Colors.tint.blue;
      case "resolved": return Colors.successLight;
      default: return Colors.fillQuaternary;
    }
  };

  const getStatusText = (status: Incident["status"]) => {
    switch (status) {
      case "pending": return t.pending;
      case "in_progress": return t.inProgress;
      case "resolved": return t.resolved;
      default: return status;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return t.today;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        {!isSupervisor && (
          <Pressable
            style={({ pressed }) => [styles.reportButton, pressed && styles.reportButtonPressed]}
            onPress={() => setShowReportModal(true)}
          >
            <Plus size={18} color={Colors.white} />
            <Text style={styles.reportButtonText}>{t.reportIncident}</Text>
          </Pressable>
        )}
        <View style={[styles.headerTitles, isSupervisor ? styles.headerTitlesFull : undefined]}>
          <Text style={styles.headerTitle}>{t.incidents}</Text>
          <Text style={styles.headerSubtitle}>
            {incidents.filter(i => i.status !== "resolved").length} {t.pending}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        {incidents.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <AlertTriangle size={36} color={Colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>{t.noIncidents}</Text>
            {!isSupervisor && (
              <Pressable
                style={({ pressed }) => [styles.emptyButton, pressed && { opacity: 0.8 }]}
                onPress={() => setShowReportModal(true)}
              >
                <Text style={styles.emptyButtonText}>{t.reportIncident}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.incidentList}>
            {incidents.map((incident) => {
              const typeConfig = getTypeIcon(incident.type);
              const TypeIcon = typeConfig.icon;
              return (
                <Pressable
                  key={incident.id}
                  style={({ pressed }) => [styles.incidentCard, pressed && styles.incidentCardPressed]}
                  onPress={() => {
                    setSelectedIncident(incident);
                    setShowDetailModal(true);
                  }}
                >
                  <View style={styles.incidentHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusBg(incident.status) }]}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(incident.status) }]} />
                      <Text style={[styles.statusText, { color: getStatusColor(incident.status) }]}>
                        {getStatusText(incident.status)}
                      </Text>
                    </View>
                    <View style={styles.incidentMeta}>
                      <Text style={styles.incidentDate}>{formatDate(incident.created_at)}</Text>
                      {incident.priority === "urgent" && (
                        <View style={styles.urgentBadge}>
                          <Flame size={12} color={Colors.error} />
                        </View>
                      )}
                      {incident.photo_url && (
                        <View style={styles.photoBadge}>
                          <ImageIcon size={12} color={Colors.primary} />
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.incidentContent}>
                    <View style={styles.incidentInfo}>
                      <Text style={styles.incidentDesc} numberOfLines={2}>
                        {incident.description}
                      </Text>
                      <View style={styles.incidentLocationRow}>
                        <MapPin size={12} color={Colors.textTertiary} />
                        <Text style={styles.incidentLocation} numberOfLines={1}>
                          {incident.location}
                        </Text>
                      </View>
                      <Text style={[styles.reportedBy, incident.user_id === user?.id && styles.ownIncident]}>
                        {incident.user_id === user?.id ? t.you : incident.reporter_name || incident.user?.full_name}
                      </Text>
                    </View>
                    <View style={[styles.typeIconWrapper, { backgroundColor: typeConfig.color + "20" }]}>
                      <TypeIcon size={22} color={typeConfig.color} />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      {/* Report Incident Modal */}
      <Modal visible={showReportModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => { dismissKeyboard(); setShowReportModal(false); setSelectedPhotoUri(null); setValidationError(null); }} />
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Pressable onPress={() => { dismissKeyboard(); setShowReportModal(false); setSelectedPhotoUri(null); setValidationError(null); }} style={styles.closeButton}>
                  <X size={20} color={Colors.textPrimary} />
                </Pressable>
                <Text style={styles.modalTitle}>{t.reportIncident}</Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t.incidentType}</Text>
                  <View style={styles.typeGrid}>
                    {INCIDENT_TYPES.map((type) => {
                      const TypeIcon = type.icon;
                      const isSelected = newIncident.type === type.id;
                      return (
                        <Pressable
                          key={type.id}
                          style={[styles.typeOption, isSelected && { borderColor: type.color, backgroundColor: type.color + "15" }]}
                          onPress={() => setNewIncident({ ...newIncident, type: type.id as Incident["type"] })}
                        >
                          <TypeIcon size={20} color={isSelected ? type.color : Colors.textSecondary} />
                          <Text style={[styles.typeOptionText, isSelected && { color: type.color }]}>
                            {type.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t.priority}</Text>
                  <View style={styles.priorityRow}>
                    <Pressable
                      style={[styles.priorityOption, newIncident.priority === "normal" && styles.priorityOptionActive]}
                      onPress={() => setNewIncident({ ...newIncident, priority: "normal" })}
                    >
                      <Text style={[styles.priorityText, newIncident.priority === "normal" && styles.priorityTextActive]}>
                        {t.normal}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.priorityOption, styles.priorityUrgent, newIncident.priority === "urgent" && styles.priorityUrgentActive]}
                      onPress={() => setNewIncident({ ...newIncident, priority: "urgent" })}
                    >
                      <Flame size={16} color={newIncident.priority === "urgent" ? Colors.white : Colors.error} />
                      <Text style={[styles.priorityText, styles.priorityUrgentText, newIncident.priority === "urgent" && { color: Colors.white }]}>
                        {t.urgent}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t.incidentDescription} *</Text>
                  <TextInput
                    style={[styles.formInput, styles.textArea, validationError && !newIncident.description.trim() && styles.formInputError]}
                    placeholder={t.incidentDescription}
                    placeholderTextColor={Colors.textTertiary}
                    value={newIncident.description}
                    onChangeText={(text) => {
                      setNewIncident({ ...newIncident, description: text });
                      if (validationError) setValidationError(null);
                    }}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    textAlign="right"
                  />
                </View>

                {/* Photo Section */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t.incidentPhoto || "Incident Photo"}</Text>
                  {selectedPhotoUri ? (
                    <View style={styles.photoPreviewContainer}>
                      <Image source={{ uri: selectedPhotoUri }} style={styles.photoPreview} contentFit="cover" />
                      <Pressable
                        style={styles.removePhotoBtn}
                        onPress={() => setSelectedPhotoUri(null)}
                      >
                        <X size={16} color={Colors.white} />
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.photoButtons}>
                      <Pressable
                        style={({ pressed }) => [styles.photoBtn, pressed && { opacity: 0.7 }]}
                        onPress={handleTakePhoto}
                      >
                        <Camera size={20} color={Colors.primary} />
                        <Text style={styles.photoBtnText}>{t.takePhoto || "Take Photo"}</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.photoBtn, pressed && { opacity: 0.7 }]}
                        onPress={handlePickImage}
                      >
                        <ImageIcon size={20} color={Colors.primary} />
                        <Text style={styles.photoBtnText}>{t.choosePhoto || "Choose Photo"}</Text>
                      </Pressable>
                    </View>
                  )}
                </View>

                {/* Validation Error */}
                {validationError && (
                  <View style={styles.validationError}>
                    <AlertTriangle size={16} color={Colors.error} />
                    <Text style={styles.validationErrorText}>{validationError}</Text>
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.submitButton,
                    pressed && styles.submitButtonPressed,
                    isSubmitting && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmitIncident}
                  disabled={isSubmitting || !newIncident.description.trim()}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <>
                      <Text style={styles.submitButtonText}>{t.submitIncident}</Text>
                      <Check size={20} color={Colors.white} />
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Incident Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowDetailModal(false)} />
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowDetailModal(false)} style={styles.closeButton}>
                <X size={20} color={Colors.textPrimary} />
              </Pressable>
              <Text style={styles.modalTitle}>{t.incidentDetails}</Text>
            </View>

            {selectedIncident && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailSection}>
                  <View style={[styles.detailStatusBadge, { backgroundColor: getStatusBg(selectedIncident.status) }]}>
                    <Text style={[styles.detailStatusText, { color: getStatusColor(selectedIncident.status) }]}>
                      {getStatusText(selectedIncident.status)}
                    </Text>
                  </View>

                  {/* Incident Photo */}
                  {selectedIncident.photo_url && (
                    <View style={styles.detailPhotoContainer}>
                      <Image
                        source={{ uri: selectedIncident.photo_url }}
                        style={styles.detailPhoto}
                        contentFit="cover"
                      />
                    </View>
                  )}

                  <View style={styles.detailCard}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailValue}>{selectedIncident.description}</Text>
                      <View style={styles.detailLabel}>
                        <FileText size={14} color={Colors.textTertiary} />
                      </View>
                    </View>

                    <View style={styles.detailDivider} />

                    <View style={styles.detailRow}>
                      <Text style={styles.detailValue}>{selectedIncident.location}</Text>
                      <View style={styles.detailLabel}>
                        <MapPin size={14} color={Colors.textTertiary} />
                      </View>
                    </View>

                    <View style={styles.detailDivider} />

                    <View style={styles.detailRow}>
                      <Text style={styles.detailValue}>
                        {new Date(selectedIncident.created_at).toLocaleString()}
                      </Text>
                      <View style={styles.detailLabel}>
                        <Clock size={14} color={Colors.textTertiary} />
                      </View>
                    </View>

                    <View style={styles.detailDivider} />
                    <View style={styles.detailRow}>
                      <Text style={styles.detailValue}>
                        {selectedIncident.reporter_name || selectedIncident.user?.full_name}
                      </Text>
                      <View style={styles.detailLabel}>
                        <Shield size={14} color={Colors.textTertiary} />
                      </View>
                    </View>
                  </View>
                </View>

                {isSupervisor && selectedIncident.status !== "resolved" && (
                  <View style={styles.actionSection}>
                    <Text style={styles.actionLabel}>{t.updateStatus}</Text>
                    <View style={styles.actionButtons}>
                      {selectedIncident.status === "pending" && (
                        <Pressable
                          style={({ pressed }) => [styles.actionBtn, styles.actionBtnProgress, pressed && { opacity: 0.8 }]}
                          onPress={() => handleUpdateStatus(selectedIncident.id, "in_progress")}
                        >
                          <Text style={styles.actionBtnText}>{t.inProgress}</Text>
                        </Pressable>
                      )}
                      <Pressable
                        style={({ pressed }) => [styles.actionBtn, styles.actionBtnResolve, pressed && { opacity: 0.8 }]}
                        onPress={() => handleUpdateStatus(selectedIncident.id, "resolved")}
                      >
                        <Check size={16} color={Colors.white} />
                        <Text style={[styles.actionBtnText, { color: Colors.white }]}>{t.resolved}</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  headerWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 16,
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
  headerTitlesFull: {
    flex: 1,
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
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.warning,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  reportButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  reportButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.white,
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
    fontWeight: "600" as const,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  emptyButton: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  incidentList: {
    gap: 12,
  },
  incidentCard: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  incidentCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  incidentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  incidentMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  incidentDate: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: "500" as const,
  },
  urgentBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: Colors.errorLight,
    justifyContent: "center",
    alignItems: "center",
  },
  photoBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: Colors.tint.blue,
    justifyContent: "center",
    alignItems: "center",
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
    fontSize: 12,
    fontWeight: "600" as const,
  },
  incidentContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  incidentInfo: {
    flex: 1,
    alignItems: "flex-end",
    paddingRight: 12,
  },
  incidentDesc: {
    fontSize: 15,
    fontWeight: "500" as const,
    color: Colors.textPrimary,
    textAlign: "right",
    marginBottom: 8,
    lineHeight: 22,
  },
  incidentLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  incidentLocation: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  reportedBy: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 6,
  },
  ownIncident: {
    color: Colors.primary,
    fontWeight: "600" as const,
  },
  typeIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
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
    textAlign: "right",
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  typeOption: {
    flex: 1,
    minWidth: "45%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.cardBackgroundSolid,
    borderWidth: 2,
    borderColor: Colors.glassBorder,
  },
  typeOptionText: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: Colors.textSecondary,
  },
  priorityRow: {
    flexDirection: "row",
    gap: 10,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.cardBackgroundSolid,
    borderWidth: 2,
    borderColor: Colors.glassBorder,
    alignItems: "center",
  },
  priorityOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.tint.blue,
  },
  priorityUrgent: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  priorityUrgentActive: {
    borderColor: Colors.error,
    backgroundColor: Colors.error,
  },
  priorityText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  priorityTextActive: {
    color: Colors.primary,
  },
  priorityUrgentText: {
    color: Colors.error,
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
  formInputError: {
    borderColor: Colors.error,
    borderWidth: 2,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  photoButtons: {
    flexDirection: "row",
    gap: 12,
  },
  photoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.tint.blue,
    borderWidth: 1,
    borderColor: Colors.primary + "30",
  },
  photoBtnText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  photoPreviewContainer: {
    position: "relative",
    borderRadius: 16,
    overflow: "hidden",
  },
  photoPreview: {
    width: "100%",
    height: 200,
    borderRadius: 16,
  },
  removePhotoBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.warning,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    marginTop: 12,
  },
  submitButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  validationError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.error + "15",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  validationErrorText: {
    flex: 1,
    fontSize: 14,
    color: Colors.error,
    fontWeight: "500" as const,
    textAlign: "right",
  },
  detailSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  detailStatusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 20,
  },
  detailStatusText: {
    fontSize: 16,
    fontWeight: "700" as const,
  },
  detailPhotoContainer: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
  },
  detailPhoto: {
    width: "100%",
    height: 200,
    borderRadius: 16,
  },
  detailCard: {
    width: "100%",
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 18,
    padding: 6,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-end",
    gap: 12,
    padding: 14,
  },
  detailLabel: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.fillQuaternary,
    justifyContent: "center",
    alignItems: "center",
  },
  detailValue: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    textAlign: "right",
    lineHeight: 22,
  },
  detailDivider: {
    height: 1,
    backgroundColor: Colors.separator,
    marginHorizontal: 14,
  },
  actionSection: {
    marginTop: 20,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    textAlign: "right",
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  actionBtnProgress: {
    backgroundColor: Colors.tint.blue,
  },
  actionBtnResolve: {
    backgroundColor: Colors.success,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  incidentDetails: undefined,
  updateStatus: undefined,
});

(t as Record<string, string>).incidentDetails = "وردەکاری ڕووداو";
(t as Record<string, string>).updateStatus = "نوێکردنەوەی بارودۆخ";
(t as Record<string, string>).you = "تۆ";
(t as Record<string, string>).newIncident = "ڕووداوی نوێ";
(t as Record<string, string>).incidentPhoto = "وێنەی ڕووداو";
(t as Record<string, string>).takePhoto = "وێنە بگرە";
(t as Record<string, string>).choosePhoto = "وێنە هەڵبژێرە";
