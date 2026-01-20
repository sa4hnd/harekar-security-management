import { View, Text, StyleSheet, Pressable, Dimensions, Platform, Alert } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import {
  Users,
  Clock,
  MapPin,
  ChevronLeft,
  Shield,
  CheckCircle,
  Camera,
  Bell,
  ImageIcon,
  X,
  Check
} from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { t } from "@/constants/translations";
import { APP_LOGO_URL } from "@/constants/logo";
import { useAuth } from "@/state/auth";
import * as Location from "expo-location";
import { useCameraPermissions } from "expo-camera";
import * as Notifications from "expo-notifications";
import * as ImagePicker from "expo-image-picker";

const { width, height } = Dimensions.get("window");

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PermissionStatus {
  camera: "pending" | "granted" | "denied";
  location: "pending" | "granted" | "denied";
  notifications: "pending" | "granted" | "denied";
  photos: "pending" | "granted" | "denied";
}

// First 4 slides are info, last slide is permissions
const onboardingData = [
  {
    id: 1,
    icon: Shield,
    useLogo: true,
    title: t.appName,
    subtitle: t.securityManagement,
    description: t.onboardingDesc1,
    accentColor: Colors.primary,
    bgGradient: Colors.tint.blue,
    features: ["بەڕێوەبردنی پاسەوان", "تۆمارکردنی ئامادەبوون", "شوێندۆزی GPS"],
    isPermissionSlide: false,
  },
  {
    id: 2,
    icon: Clock,
    useLogo: false,
    title: t.onboardingTitle2,
    subtitle: t.onboardingSubtitle2,
    description: t.onboardingDesc2,
    accentColor: Colors.secondary,
    bgGradient: Colors.tint.purple,
    features: ["چوونەژوورەوە بە وێنە", "دەرچوون بە پشتڕاستکردنەوە", "مێژووی تەواو"],
    isPermissionSlide: false,
  },
  {
    id: 3,
    icon: MapPin,
    useLogo: false,
    title: t.onboardingTitle3,
    subtitle: t.onboardingSubtitle3,
    description: t.onboardingDesc3,
    accentColor: Colors.accent,
    bgGradient: Colors.tint.orange,
    features: ["شوێنی ڕاستەقینە", "نەخشەی زیندوو", "پشتڕاستکردنی شوێن"],
    isPermissionSlide: false,
  },
  {
    id: 4,
    icon: Users,
    useLogo: false,
    title: t.onboardingTitle4,
    subtitle: t.onboardingSubtitle4,
    description: t.onboardingDesc4,
    accentColor: Colors.success,
    bgGradient: Colors.tint.green,
    features: ["بەڕێوەبردنی تیم", "ڕاپۆرتی ئامادەبوون", "ئاگادارکردنەوە"],
    isPermissionSlide: false,
  },
  {
    id: 5,
    icon: Shield,
    useLogo: false,
    title: "دەستوورەکان",
    subtitle: "مۆڵەتی دەستگەیشتن",
    description: "بۆ کارکردنی باش، ئەم بەرنامە پێویستی بە ئەم دەستوورانە هەیە",
    accentColor: Colors.primary,
    bgGradient: Colors.tint.blue,
    features: [],
    isPermissionSlide: true,
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const { setOnboardingComplete } = useAuth();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [permissions, setPermissions] = useState<PermissionStatus>({
    camera: "pending",
    location: "pending",
    notifications: "pending",
    photos: "pending",
  });

  // Animation values
  const iconScale = useSharedValue(0);
  const iconRotate = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const featureOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  const progressWidth = useSharedValue(0);

  // Check initial permission status
  useEffect(() => {
    checkAllPermissions();
  }, []);

  const checkAllPermissions = async () => {
    if (Platform.OS === "web") return;

    // Check camera
    if (cameraPermission?.granted) {
      setPermissions(prev => ({ ...prev, camera: "granted" }));
    }

    // Check location
    const { status: locationStatus } = await Location.getForegroundPermissionsAsync();
    if (locationStatus === "granted") {
      setPermissions(prev => ({ ...prev, location: "granted" }));
    }

    // Check notifications
    const { status: notifStatus } = await Notifications.getPermissionsAsync();
    if (notifStatus === "granted") {
      setPermissions(prev => ({ ...prev, notifications: "granted" }));
    }

    // Check photos
    const { status: photoStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (photoStatus === "granted") {
      setPermissions(prev => ({ ...prev, photos: "granted" }));
    }
  };

  useEffect(() => {
    // Reset and animate on slide change
    iconScale.value = 0;
    iconRotate.value = 0;
    titleOpacity.value = 0;
    titleTranslateY.value = 30;
    featureOpacity.value = 0;

    // Animate in sequence
    iconScale.value = withSpring(1, { damping: 12, stiffness: 100 });
    iconRotate.value = withSequence(
      withTiming(-10, { duration: 150 }),
      withSpring(0, { damping: 8 })
    );

    titleOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    titleTranslateY.value = withDelay(200, withSpring(0, { damping: 15 }));

    featureOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));

    // Progress bar
    progressWidth.value = withTiming(((currentIndex + 1) / onboardingData.length) * 100, {
      duration: 300,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [currentIndex]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: iconScale.value },
      { rotate: `${iconRotate.value}deg` },
    ],
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const featureAnimatedStyle = useAnimatedStyle(() => ({
    opacity: featureOpacity.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const requestCameraPermissionHandler = async () => {
    if (Platform.OS === "web") {
      setPermissions(prev => ({ ...prev, camera: "granted" }));
      return;
    }
    const result = await requestCameraPermission();
    setPermissions(prev => ({
      ...prev,
      camera: result.granted ? "granted" : "denied"
    }));
  };

  const requestLocationPermission = async () => {
    if (Platform.OS === "web") {
      setPermissions(prev => ({ ...prev, location: "granted" }));
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermissions(prev => ({
      ...prev,
      location: status === "granted" ? "granted" : "denied"
    }));

    // Also request background location for better tracking
    if (status === "granted") {
      await Location.requestBackgroundPermissionsAsync();
    }
  };

  const requestNotificationPermission = async () => {
    if (Platform.OS === "web") {
      setPermissions(prev => ({ ...prev, notifications: "granted" }));
      return;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    setPermissions(prev => ({
      ...prev,
      notifications: status === "granted" ? "granted" : "denied"
    }));
  };

  const requestPhotoPermission = async () => {
    if (Platform.OS === "web") {
      setPermissions(prev => ({ ...prev, photos: "granted" }));
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    setPermissions(prev => ({
      ...prev,
      photos: status === "granted" ? "granted" : "denied"
    }));
  };

  const handleNext = async () => {
    buttonScale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withSpring(1, { damping: 10 })
    );

    if (currentIndex < onboardingData.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      await setOnboardingComplete();
      router.replace("/login");
    }
  };

  const handleSkip = async () => {
    await setOnboardingComplete();
    router.replace("/login");
  };

  const currentData = onboardingData[currentIndex];
  const IconComponent = currentData.icon;

  const getPermissionIcon = (status: "pending" | "granted" | "denied") => {
    switch (status) {
      case "granted":
        return <Check size={18} color={Colors.success} strokeWidth={3} />;
      case "denied":
        return <X size={18} color={Colors.error} strokeWidth={3} />;
      default:
        return null;
    }
  };

  const getPermissionColor = (status: "pending" | "granted" | "denied") => {
    switch (status) {
      case "granted":
        return Colors.successLight;
      case "denied":
        return Colors.errorLight;
      default:
        return Colors.fillTertiary;
    }
  };

  const renderPermissionSlide = () => (
    <View style={styles.permissionsContainer}>
      {/* Camera Permission */}
      <Pressable
        style={[
          styles.permissionCard,
          { borderColor: getPermissionColor(permissions.camera) }
        ]}
        onPress={requestCameraPermissionHandler}
        disabled={permissions.camera === "granted"}
      >
        <View style={[styles.permissionIconWrapper, { backgroundColor: Colors.tint.blue }]}>
          <Camera size={24} color={Colors.primary} />
        </View>
        <View style={styles.permissionContent}>
          <Text style={styles.permissionTitle}>کامێرا</Text>
          <Text style={styles.permissionDesc}>بۆ گرتنا وێنەی ئامادەبوون</Text>
        </View>
        <View style={[styles.permissionStatus, { backgroundColor: getPermissionColor(permissions.camera) }]}>
          {permissions.camera === "pending" ? (
            <Text style={styles.permissionStatusText}>داواکردن</Text>
          ) : (
            getPermissionIcon(permissions.camera)
          )}
        </View>
      </Pressable>

      {/* Location Permission */}
      <Pressable
        style={[
          styles.permissionCard,
          { borderColor: getPermissionColor(permissions.location) }
        ]}
        onPress={requestLocationPermission}
        disabled={permissions.location === "granted"}
      >
        <View style={[styles.permissionIconWrapper, { backgroundColor: Colors.tint.orange }]}>
          <MapPin size={24} color={Colors.accent} />
        </View>
        <View style={styles.permissionContent}>
          <Text style={styles.permissionTitle}>شوێن</Text>
          <Text style={styles.permissionDesc}>بۆ پشتڕاستکردنی شوێنی ئامادەبوون</Text>
        </View>
        <View style={[styles.permissionStatus, { backgroundColor: getPermissionColor(permissions.location) }]}>
          {permissions.location === "pending" ? (
            <Text style={styles.permissionStatusText}>داواکردن</Text>
          ) : (
            getPermissionIcon(permissions.location)
          )}
        </View>
      </Pressable>

      {/* Notifications Permission */}
      <Pressable
        style={[
          styles.permissionCard,
          { borderColor: getPermissionColor(permissions.notifications) }
        ]}
        onPress={requestNotificationPermission}
        disabled={permissions.notifications === "granted"}
      >
        <View style={[styles.permissionIconWrapper, { backgroundColor: Colors.tint.purple }]}>
          <Bell size={24} color={Colors.secondary} />
        </View>
        <View style={styles.permissionContent}>
          <Text style={styles.permissionTitle}>ئاگادارکردنەوە</Text>
          <Text style={styles.permissionDesc}>بۆ وەرگرتنی ئاگادارکردنەوەکان</Text>
        </View>
        <View style={[styles.permissionStatus, { backgroundColor: getPermissionColor(permissions.notifications) }]}>
          {permissions.notifications === "pending" ? (
            <Text style={styles.permissionStatusText}>داواکردن</Text>
          ) : (
            getPermissionIcon(permissions.notifications)
          )}
        </View>
      </Pressable>

      {/* Photos Permission */}
      <Pressable
        style={[
          styles.permissionCard,
          { borderColor: getPermissionColor(permissions.photos) }
        ]}
        onPress={requestPhotoPermission}
        disabled={permissions.photos === "granted"}
      >
        <View style={[styles.permissionIconWrapper, { backgroundColor: Colors.tint.green }]}>
          <ImageIcon size={24} color={Colors.success} />
        </View>
        <View style={styles.permissionContent}>
          <Text style={styles.permissionTitle}>گالێری</Text>
          <Text style={styles.permissionDesc}>بۆ هەلبژارتنی وێنەی پرۆفایل</Text>
        </View>
        <View style={[styles.permissionStatus, { backgroundColor: getPermissionColor(permissions.photos) }]}>
          {permissions.photos === "pending" ? (
            <Text style={styles.permissionStatusText}>داواکردن</Text>
          ) : (
            getPermissionIcon(permissions.photos)
          )}
        </View>
      </Pressable>

      {/* Grant All Button */}
      <Pressable
        style={styles.grantAllButton}
        onPress={async () => {
          await requestCameraPermissionHandler();
          await requestLocationPermission();
          await requestNotificationPermission();
          await requestPhotoPermission();
        }}
      >
        <Text style={styles.grantAllText}>هەموو دەستوورەکان</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={[styles.progressContainer, { top: insets.top + 8 }]}>
        <View style={styles.progressBackground}>
          <Animated.View
            style={[
              styles.progressFill,
              { backgroundColor: currentData.accentColor },
              progressAnimatedStyle,
            ]}
          />
        </View>
      </View>

      {/* Skip Button */}
      <View style={[styles.topSection, { paddingTop: insets.top + 24 }]}>
        {currentIndex < onboardingData.length - 1 ? (
          <Pressable
            onPress={handleSkip}
            style={({ pressed }) => [styles.skipButton, pressed && styles.skipPressed]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.skipText}>{t.skip}</Text>
          </Pressable>
        ) : (
          <View style={styles.skipPlaceholder} />
        )}
      </View>

      {/* Hero Section */}
      <View style={styles.heroSection}>
        <Animated.View style={[styles.iconWrapper, iconAnimatedStyle]}>
          <View style={[styles.iconGlow, { backgroundColor: currentData.bgGradient }]} />
          <View style={[styles.iconInnerGlow, { backgroundColor: currentData.bgGradient }]} />

          {currentData.useLogo ? (
            <View style={styles.logoContainer}>
              <Image
                source={{ uri: APP_LOGO_URL }}
                style={styles.logoImage}
                contentFit="cover"
              />
            </View>
          ) : (
            <View style={[styles.iconCircle, { backgroundColor: currentData.accentColor }]}>
              {IconComponent && (
                <IconComponent size={52} color={Colors.white} strokeWidth={1.5} />
              )}
            </View>
          )}
        </Animated.View>

        <Animated.View style={[styles.textContent, titleAnimatedStyle]}>
          <Text style={styles.title}>{currentData.title}</Text>
          <View style={[styles.subtitleBadge, { backgroundColor: currentData.bgGradient }]}>
            <Text style={[styles.subtitle, { color: currentData.accentColor }]}>
              {currentData.subtitle}
            </Text>
          </View>
          <Text style={styles.description}>{currentData.description}</Text>
        </Animated.View>

        {/* Features List or Permissions */}
        <Animated.View style={[styles.featuresContainer, featureAnimatedStyle]}>
          {currentData.isPermissionSlide ? (
            renderPermissionSlide()
          ) : (
            currentData.features.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={[styles.featureIcon, { backgroundColor: currentData.bgGradient }]}>
                  <CheckCircle size={16} color={currentData.accentColor} strokeWidth={2.5} />
                </View>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))
          )}
        </Animated.View>
      </View>

      {/* Bottom Section */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {onboardingData.map((_, index) => (
            <Pressable
              key={index}
              onPress={() => setCurrentIndex(index)}
              style={styles.dotTouchable}
            >
              <View
                style={[
                  styles.dot,
                  index === currentIndex && [styles.dotActive, { backgroundColor: currentData.accentColor }],
                  index < currentIndex && [styles.dotCompleted, { backgroundColor: currentData.accentColor }],
                ]}
              />
            </Pressable>
          ))}
        </View>

        {/* Continue Button */}
        <AnimatedPressable
          style={[
            styles.continueButton,
            { backgroundColor: currentData.accentColor },
            buttonAnimatedStyle,
          ]}
          onPress={handleNext}
        >
          <Text style={styles.buttonText}>
            {currentIndex === onboardingData.length - 1 ? t.getStarted : t.next}
          </Text>
          <View style={styles.buttonIconWrapper}>
            <ChevronLeft size={22} color={Colors.white} strokeWidth={2.5} />
          </View>
        </AnimatedPressable>

        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>
            <Text style={[styles.stepCurrent, { color: currentData.accentColor }]}>
              {currentIndex + 1}
            </Text>
            <Text style={styles.stepDivider}> / </Text>
            <Text style={styles.stepTotal}>{onboardingData.length}</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  progressContainer: {
    position: "absolute",
    left: 24,
    right: 24,
    zIndex: 10,
  },
  progressBackground: {
    height: 4,
    backgroundColor: Colors.fillTertiary,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  topSection: {
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  skipButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: Colors.fillQuaternary,
  },
  skipPressed: {
    opacity: 0.7,
  },
  skipPlaceholder: {
    height: 44,
  },
  skipText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  heroSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  iconWrapper: {
    width: 160,
    height: 160,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  iconGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.3,
  },
  iconInnerGlow: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.5,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 3,
    borderColor: Colors.glassBorder,
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
  },
  textContent: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  subtitleBadge: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 26,
    maxWidth: 300,
  },
  featuresContainer: {
    width: "100%",
    maxWidth: 340,
    gap: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  featureText: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  bottomSection: {
    paddingHorizontal: 24,
    gap: 16,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  dotTouchable: {
    padding: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.fillTertiary,
  },
  dotActive: {
    width: 32,
    borderRadius: 16,
  },
  dotCompleted: {
    opacity: 0.5,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    borderRadius: 20,
    gap: 10,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.white,
  },
  buttonIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  stepIndicator: {
    alignItems: "center",
    paddingTop: 4,
  },
  stepText: {
    fontSize: 14,
    fontWeight: "600",
  },
  stepCurrent: {
    fontSize: 18,
    fontWeight: "800",
  },
  stepDivider: {
    color: Colors.textTertiary,
  },
  stepTotal: {
    color: Colors.textTertiary,
  },
  // Permission styles
  permissionsContainer: {
    width: "100%",
    gap: 12,
  },
  permissionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.fillTertiary,
    gap: 12,
  },
  permissionIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  permissionContent: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  permissionDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  permissionStatus: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  permissionStatusText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  grantAllButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  grantAllText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.white,
  },
});
