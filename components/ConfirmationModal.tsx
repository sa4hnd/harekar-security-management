import { View, Text, StyleSheet, Modal, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, Trash2, LogOut, X, Check } from "lucide-react-native";
import { Colors } from "@/constants/colors";
import { t } from "@/constants/translations";
import * as Haptics from "expo-haptics";

interface ConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "default";
  isLoading?: boolean;
}

export default function ConfirmationModal({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = t.confirm,
  cancelText = t.cancel,
  variant = "default",
  isLoading = false,
}: ConfirmationModalProps) {
  const insets = useSafeAreaInsets();

  const handleConfirm = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onConfirm();
  };

  const getIcon = () => {
    switch (variant) {
      case "danger":
        return <Trash2 size={28} color={Colors.error} />;
      case "warning":
        return <AlertTriangle size={28} color={Colors.warning} />;
      default:
        return <AlertTriangle size={28} color={Colors.primary} />;
    }
  };

  const getIconBg = () => {
    switch (variant) {
      case "danger":
        return Colors.errorLight;
      case "warning":
        return Colors.warningLight;
      default:
        return Colors.tint.blue;
    }
  };

  const getConfirmBtnStyle = () => {
    switch (variant) {
      case "danger":
        return { backgroundColor: Colors.error };
      case "warning":
        return { backgroundColor: Colors.warning };
      default:
        return { backgroundColor: Colors.primary };
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.container}>
          <View style={[styles.iconWrapper, { backgroundColor: getIconBg() }]}>
            {getIcon()}
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.cancelBtn, pressed && styles.btnPressed]}
              onPress={onClose}
              disabled={isLoading}
            >
              <X size={18} color={Colors.textPrimary} />
              <Text style={styles.cancelBtnText}>{cancelText}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.confirmBtn,
                getConfirmBtnStyle(),
                pressed && styles.btnPressed,
                isLoading && styles.btnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={isLoading}
            >
              <Check size={18} color={Colors.white} />
              <Text style={styles.confirmBtnText}>{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  btnDisabled: {
    opacity: 0.5,
  },
  cancelBtn: {
    backgroundColor: Colors.fillQuaternary,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.textPrimary,
  },
  confirmBtn: {},
  confirmBtnText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.white,
  },
});
