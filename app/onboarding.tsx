import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Users, Clock, MapPin, ChevronLeft, Shield, CheckCircle } from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  interpolate,
  Easing,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
} from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { t } from "@/constants/translations";
import { APP_LOGO_URL } from "@/constants/logo";
import { useAuth } from "@/state/auth";

const { width, height } = Dimensions.get("window");

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const { setOnboardingComplete } = useAuth();

  // Animation values
  const iconScale = useSharedValue(0);
  const iconRotate = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const featureOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  const progressWidth = useSharedValue(0);

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

        {/* Features List */}
        <Animated.View style={[styles.featuresContainer, featureAnimatedStyle]}>
          {currentData.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: currentData.bgGradient }]}>
                <CheckCircle size={16} color={currentData.accentColor} strokeWidth={2.5} />
              </View>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
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
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
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
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
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
    maxWidth: 320,
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
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
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
});
