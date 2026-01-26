import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Keyboard, TouchableWithoutFeedback, Modal } from "react-native";
import { useState, useRef } from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Mail, Lock, Eye, EyeOff, AlertCircle, ChevronLeft, Building2, User, Phone, X, CheckCircle } from "lucide-react-native";
import { Colors } from "@/constants/colors";
import { t } from "@/constants/translations";
import { APP_LOGO_URL } from "@/constants/logo";
import { useAuth } from "@/state/auth";
import * as Haptics from "expo-haptics";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  // Signup modal state
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [signupOrg, setSignupOrg] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupError, setSignupError] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const resetSignupForm = () => {
    setSignupOrg("");
    setSignupName("");
    setSignupEmail("");
    setSignupPhone("");
    setSignupPassword("");
    setSignupConfirmPassword("");
    setSignupError("");
  };

  const handleSignupSubmit = async () => {
    Keyboard.dismiss();

    // Validation
    if (!signupOrg.trim() || !signupName.trim() || !signupEmail.trim() || !signupPhone.trim() || !signupPassword || !signupConfirmPassword) {
      setSignupError(t.fillRequired);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setSignupError(t.passwordMismatch);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    // Success - mockup only
    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setShowSignupModal(false);
    resetSignupForm();
    setShowSuccessModal(true);
  };

  const handleLogin = async () => {
    dismissKeyboard();
    if (!email.trim()) {
      setError(t.fillRequired);
      return;
    }
    if (!password) {
      setError(t.fillRequired);
      return;
    }

    setError("");
    const result = await login(email, password);

    if (result.success) {
      router.replace("/(tabs)");
    } else {
      setError(result.error || t.invalidCredentials);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.heroSection}>
            <View style={styles.logoWrapper}>
              <View style={styles.logoGlow} />
              <View style={styles.logoContainer}>
                <Image
                  source={{ uri: APP_LOGO_URL }}
                  style={styles.logoImage}
                  contentFit="cover"
                />
              </View>
            </View>
            <Text style={styles.appTitle}>{t.appName}</Text>
            <Text style={styles.appSubtitle}>{t.securityManagement}</Text>
          </View>

          <View style={styles.formSection}>
            <View style={styles.formHeader}>
              <Text style={styles.welcomeTitle}>{t.welcomeBack}</Text>
              <Text style={styles.welcomeSubtitle}>{t.signInToContinue}</Text>
            </View>

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
                <AlertCircle size={18} color={Colors.error} />
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <View style={[
                styles.inputWrapper,
                emailFocused && styles.inputWrapperFocused
              ]}>
                <TextInput
                  style={styles.input}
                  placeholder={t.email}
                  placeholderTextColor={Colors.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
                <View style={styles.inputIconWrapper}>
                  <Mail size={20} color={emailFocused ? Colors.primary : Colors.textTertiary} />
                </View>
              </View>

              <View style={[
                styles.inputWrapper,
                passwordFocused && styles.inputWrapperFocused
              ]}>
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={Colors.textTertiary} />
                  ) : (
                    <Eye size={20} color={Colors.textTertiary} />
                  )}
                </Pressable>
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder={t.password}
                  placeholderTextColor={Colors.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <View style={styles.inputIconWrapper}>
                  <Lock size={20} color={passwordFocused ? Colors.primary : Colors.textTertiary} />
                </View>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                pressed && styles.loginButtonPressed,
                isLoading && styles.loginButtonLoading,
              ]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>{t.signIn}</Text>
                  <ChevronLeft size={20} color={Colors.white} />
                </>
              )}
            </Pressable>

            <Text style={styles.helpText}>{t.contactSupervisor}</Text>

            <Pressable
              style={({ pressed }) => [
                styles.signupButton,
                pressed && styles.signupButtonPressed,
              ]}
              onPress={() => setShowSignupModal(true)}
            >
              <Building2 size={18} color={Colors.primary} />
              <Text style={styles.signupButtonText}>{t.signupForOrganization}</Text>
            </Pressable>
          </View>
        </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Signup Modal */}
      <Modal
        visible={showSignupModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowSignupModal(false);
          resetSignupForm();
        }}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => {
                setShowSignupModal(false);
                resetSignupForm();
              }}
              style={styles.modalCloseButton}
            >
              <X size={24} color={Colors.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>{t.signupForOrganization}</Text>
            <View style={{ width: 40 }} />
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <ScrollView
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {signupError ? (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{signupError}</Text>
                    <AlertCircle size={18} color={Colors.error} />
                  </View>
                ) : null}

                <View style={styles.inputGroup}>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder={t.organizationName}
                      placeholderTextColor={Colors.textTertiary}
                      value={signupOrg}
                      onChangeText={setSignupOrg}
                      autoCapitalize="words"
                    />
                    <View style={styles.inputIconWrapper}>
                      <Building2 size={20} color={Colors.textTertiary} />
                    </View>
                  </View>

                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder={t.yourFullName}
                      placeholderTextColor={Colors.textTertiary}
                      value={signupName}
                      onChangeText={setSignupName}
                      autoCapitalize="words"
                    />
                    <View style={styles.inputIconWrapper}>
                      <User size={20} color={Colors.textTertiary} />
                    </View>
                  </View>

                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder={t.email}
                      placeholderTextColor={Colors.textTertiary}
                      value={signupEmail}
                      onChangeText={setSignupEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <View style={styles.inputIconWrapper}>
                      <Mail size={20} color={Colors.textTertiary} />
                    </View>
                  </View>

                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder={t.phoneNumber}
                      placeholderTextColor={Colors.textTertiary}
                      value={signupPhone}
                      onChangeText={setSignupPhone}
                      keyboardType="phone-pad"
                    />
                    <View style={styles.inputIconWrapper}>
                      <Phone size={20} color={Colors.textTertiary} />
                    </View>
                  </View>

                  <View style={styles.inputWrapper}>
                    <Pressable
                      onPress={() => setShowSignupPassword(!showSignupPassword)}
                      style={styles.eyeButton}
                    >
                      {showSignupPassword ? (
                        <EyeOff size={20} color={Colors.textTertiary} />
                      ) : (
                        <Eye size={20} color={Colors.textTertiary} />
                      )}
                    </Pressable>
                    <TextInput
                      style={styles.input}
                      placeholder={t.createPassword}
                      placeholderTextColor={Colors.textTertiary}
                      value={signupPassword}
                      onChangeText={setSignupPassword}
                      secureTextEntry={!showSignupPassword}
                    />
                    <View style={styles.inputIconWrapper}>
                      <Lock size={20} color={Colors.textTertiary} />
                    </View>
                  </View>

                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder={t.confirmPassword}
                      placeholderTextColor={Colors.textTertiary}
                      value={signupConfirmPassword}
                      onChangeText={setSignupConfirmPassword}
                      secureTextEntry={!showSignupPassword}
                    />
                    <View style={styles.inputIconWrapper}>
                      <Lock size={20} color={Colors.textTertiary} />
                    </View>
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.loginButton,
                    pressed && styles.loginButtonPressed,
                  ]}
                  onPress={handleSignupSubmit}
                >
                  <Text style={styles.loginButtonText}>{t.submitApplication}</Text>
                  <ChevronLeft size={20} color={Colors.white} />
                </Pressable>
              </ScrollView>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconWrapper}>
              <CheckCircle size={64} color={Colors.success} />
            </View>
            <Text style={styles.successTitle}>{t.signupSuccess}</Text>
            <Text style={styles.successMessage}>{t.signupSuccessMessage}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                pressed && styles.loginButtonPressed,
                { marginTop: 24 },
              ]}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.loginButtonText}>{t.close}</Text>
            </Pressable>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoWrapper: {
    position: "relative",
    marginBottom: 20,
  },
  logoGlow: {
    position: "absolute",
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    backgroundColor: Colors.primary,
    opacity: 0.15,
    borderRadius: 80,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: "hidden",
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  logoImage: {
    width: 88,
    height: 88,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  formSection: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  formHeader: {
    marginBottom: 24,
    alignItems: "flex-end",
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
    textAlign: "right",
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "right",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: Colors.errorLight,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.error + "30",
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: Colors.error,
    fontWeight: "500",
    textAlign: "right",
  },
  inputGroup: {
    gap: 14,
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 14,
    paddingHorizontal: 4,
    height: 56,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  inputWrapperFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
  },
  inputIconWrapper: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
    height: 56,
    textAlign: "right",
    paddingLeft: 4,
  },
  eyeButton: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  loginButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 14,
    gap: 8,
  },
  loginButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  loginButtonLoading: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.white,
  },
  helpText: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: "center",
    marginTop: 20,
  },
  signupButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primaryLight,
    height: 50,
    borderRadius: 14,
    marginTop: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary + "30",
  },
  signupButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  signupButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.primary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  modalScrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  successModal: {
    backgroundColor: Colors.cardBackgroundSolid,
    borderRadius: 24,
    padding: 32,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  successIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.success + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
