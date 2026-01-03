import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { useState, useEffect, useRef } from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, MapPin, Clock, Check, Camera, RotateCcw } from "lucide-react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { Colors } from "@/constants/colors";
import { t } from "@/constants/translations";
import { useAuth } from "@/state/auth";
import { supabase } from "@/lib/supabase";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";

export default function ExitCameraScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [facing, setFacing] = useState<CameraType>("front");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [locationInfo, setLocationInfo] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

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

  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      if (Platform.OS !== "web") {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({});
          const address = await getLocationAddress(location.coords.latitude, location.coords.longitude);
          setLocationInfo({
            address,
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          });
        }
      }
    } catch (error) {
      console.error("Error getting location:", error);
    } finally {
      setIsGettingLocation(false);
    }
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
        mirror: false,
      });
      if (result?.uri) {
        setPhoto(result.uri);
        if (result.base64) {
          setPhotoBase64(`data:image/jpeg;base64,${result.base64}`);
        }
      }
    } catch (error) {
      console.error("Error taking photo:", error);
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
    setPhotoBase64(null);
  };

  const submitExit = async () => {
    if (!user || isLoading) return;
    if (!photo) return;

    setIsLoading(true);

    try {
      let latitude = locationInfo?.lat || 0;
      let longitude = locationInfo?.lng || 0;
      let locationAddress = locationInfo?.address || t.locationUnavailable;

      if (!locationInfo && Platform.OS !== "web") {
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

      // Find the most recent checked-in attendance for today
      const { data: latestAttendance } = await supabase
        .from("attendance")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", today)
        .in("status", ["checked_in", "late"])
        .order("check_in_time", { ascending: false })
        .limit(1)
        .single();

      if (!latestAttendance) {
        throw new Error("No active attendance found");
      }

      const { error } = await supabase
        .from("attendance")
        .update({
          check_out_time: now.toISOString(),
          check_out_location: locationAddress,
          check_out_latitude: latitude,
          check_out_longitude: longitude,
          check_out_photo: photoBase64 || photo,
          status: "checked_out",
        })
        .eq("id", latestAttendance.id);

      if (error) throw error;

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    } catch (error) {
      console.error("Check-out error:", error);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!permission) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Camera size={64} color={Colors.textTertiary} />
        <Text style={styles.permissionText}>{t.cameraPermission}</Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>{t.grantPermission}</Text>
        </Pressable>
      </View>
    );
  }

  if (photo) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <X size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t.exitPhoto}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.previewContainer}>
          <Image source={{ uri: photo }} style={styles.preview} contentFit="cover" />
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Clock size={18} color={Colors.textSecondary} />
            <Text style={styles.infoText}>
              {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MapPin size={18} color={Colors.textSecondary} />
            {isGettingLocation ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={styles.infoText} numberOfLines={1}>
                {locationInfo?.address || t.locationUnavailable}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.retakeButton, pressed && styles.buttonPressed]}
            onPress={retakePhoto}
          >
            <RotateCcw size={20} color={Colors.textPrimary} />
            <Text style={styles.retakeButtonText}>{t.retake}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.confirmButton, pressed && styles.buttonPressed, isLoading && styles.buttonDisabled]}
            onPress={submitExit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <Check size={20} color={Colors.white} />
                <Text style={styles.confirmButtonText}>{t.checkOut}</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mirror={false}
      >
        <View style={[styles.cameraOverlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.cameraHeader}>
            <Pressable onPress={() => router.back()} style={styles.closeButtonCamera}>
              <X size={22} color={Colors.white} />
            </Pressable>
            <Text style={styles.cameraTitle}>{t.captureExitPhoto}</Text>
            <Pressable
              onPress={() => setFacing(f => f === "back" ? "front" : "back")}
              style={styles.flipButton}
            >
              <RotateCcw size={20} color={Colors.white} />
            </Pressable>
          </View>

          <View style={styles.cameraFooter}>
            <Pressable
              style={({ pressed }) => [styles.captureButton, pressed && styles.captureButtonPressed]}
              onPress={takePhoto}
            >
              <View style={styles.captureButtonInner} />
            </Pressable>
          </View>
        </View>
      </CameraView>
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
    gap: 16,
    padding: 24,
  },
  permissionText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.white,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.fillQuaternary,
    justifyContent: "center",
    alignItems: "center",
  },
  previewContainer: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: Colors.backgroundTertiary,
  },
  preview: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    textAlign: "right",
  },
  actions: {
    flexDirection: "row-reverse",
    gap: 12,
    padding: 16,
  },
  retakeButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.cardBackground,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  retakeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  confirmButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.white,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    justifyContent: "space-between",
  },
  cameraHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  cameraTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.white,
  },
  closeButtonCamera: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  flipButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraFooter: {
    alignItems: "center",
    paddingBottom: 40,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.3)",
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonPressed: {
    transform: [{ scale: 0.95 }],
  },
  captureButtonInner: {
    width: "100%",
    height: "100%",
    borderRadius: 36,
    backgroundColor: Colors.white,
  },
});
