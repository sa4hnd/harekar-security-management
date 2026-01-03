import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Users, Clock, MapPin, ChevronLeft, Shield } from "lucide-react-native";
import { Colors } from "@/constants/colors";
import { t } from "@/constants/translations";
import { APP_LOGO_URL } from "@/constants/logo";
import { useAuth } from "@/state/auth";

const { width, height } = Dimensions.get("window");

const onboardingData = [
  {
    id: 1,
    icon: Shield,
    useLogo: true,
    title: t.welcomeToHarekar,
    subtitle: t.onboardingSubtitle1,
    description: t.onboardingDesc1,
    accentColor: Colors.primary,
    bgGradient: Colors.tint.blue,
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
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const { setOnboardingComplete } = useAuth();

  const handleNext = async () => {
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
      <View style={[styles.topSection, { paddingTop: insets.top + 16 }]}>
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

      <View style={styles.heroSection}>
        <View style={[styles.iconWrapper, { backgroundColor: currentData.bgGradient }]}>
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
                <IconComponent size={48} color={Colors.white} strokeWidth={1.5} />
              )}
            </View>
          )}
        </View>

        <View style={styles.textContent}>
          <Text style={styles.title}>{currentData.title}</Text>
          <Text style={[styles.subtitle, { color: currentData.accentColor }]}>
            {currentData.subtitle}
          </Text>
          <Text style={styles.description}>{currentData.description}</Text>
        </View>
      </View>

      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
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
                ]}
              />
            </Pressable>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.continueButton,
            { backgroundColor: currentData.accentColor },
            pressed && styles.buttonPressed,
          ]}
          onPress={handleNext}
        >
          <Text style={styles.buttonText}>
            {currentIndex === onboardingData.length - 1 ? t.getStarted : t.next}
          </Text>
          <ChevronLeft size={20} color={Colors.white} />
        </Pressable>

        <View style={styles.pageIndicator}>
          <Text style={styles.pageText}>
            {currentIndex + 1} / {onboardingData.length}
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
  topSection: {
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.fillQuaternary,
  },
  skipPressed: {
    opacity: 0.7,
  },
  skipPlaceholder: {
    height: 36,
  },
  skipText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  heroSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconWrapper: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 48,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 2,
    borderColor: Colors.glassBorder,
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  textContent: {
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
  },
  bottomSection: {
    paddingHorizontal: 24,
    gap: 20,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  dotTouchable: {
    padding: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.fillTertiary,
  },
  dotActive: {
    width: 28,
    borderRadius: 14,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: 16,
    gap: 8,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.white,
  },
  pageIndicator: {
    alignItems: "center",
  },
  pageText: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: "500",
  },
});
