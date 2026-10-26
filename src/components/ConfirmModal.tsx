import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { COLORS } from "../constants/colors";

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;

  confirmText?: string;
  cancelText?: string;

  destructive?: boolean;
  loading?: boolean;

  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!loading) {
          onCancel();
        }
      }}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (!loading) {
              onCancel();
            }
          }}
        />

        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View
              style={[
                styles.iconContainer,
                destructive
                  ? styles.destructiveIconContainer
                  : styles.normalIconContainer,
              ]}
            >
              <Ionicons
                name={
                  destructive
                    ? "warning-outline"
                    : "help-circle-outline"
                }
                size={22}
                color={destructive ? "#C13515" : COLORS.primary}
              />
            </View>

            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>

              <Text style={styles.message}>
                {message}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.buttons}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                pressed && styles.pressed,
                loading && styles.disabled,
              ]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>
                {cancelText}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                destructive
                  ? styles.destructiveButton
                  : styles.confirmButton,
                pressed && styles.pressed,
                loading && styles.disabled,
              ]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator
                  size="small"
                  color={
                    destructive
                      ? "#F7F8FA"
                      : "#F7F8FA"
                  }
                />
              ) : (
                <>
                  <Ionicons
                    name={
                      destructive
                        ? "close-circle-outline"
                        : "checkmark-circle-outline"
                    }
                    size={18}
                    color={
                      destructive
                        ? "#F7F8FA"
                        : "#F7F8FA"
                    }
                  />

                  <Text
                    style={[
                      styles.confirmButtonText,
                      destructive
                        ? styles.destructiveButtonText
                        : styles.primaryButtonText,
                    ]}
                  >
                    {confirmText}
                  </Text>
                </>
              )}
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
    backgroundColor: "rgba(7, 17, 31, 0.62)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },

  modal: {
    width: "100%",
    maxWidth: 390,

    backgroundColor: "#F7F8FA",

    borderRadius: 20,

    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.18,
    shadowRadius: 28,

    elevation: 12,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,

    alignItems: "center",
    justifyContent: "center",

    marginRight: 13,
    flexShrink: 0,
  },

  normalIconContainer: {
    backgroundColor: "#F0F5F3",
  },

  destructiveIconContainer: {
    backgroundColor: "#FDECEC",
  },

  headerText: {
    flex: 1,
    paddingTop: 1,
  },

  title: {
    color: "#171717",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.35,
  },

  message: {
    color: "#666666",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },

  buttons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },

  button: {
    flex: 1,
    minHeight: 48,

    borderRadius: 12,

    alignItems: "center",
    justifyContent: "center",

    flexDirection: "row",
    gap: 6,

    paddingHorizontal: 12,
  },

  cancelButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E2E2",
  },

  cancelButtonText: {
    color: "#14201B",
    fontSize: 15,
    fontWeight: "700",
  },

  confirmButton: {
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },

  destructiveButton: {
    backgroundColor: "#C13515",
    borderWidth: 1,
    borderColor: "#C13515",
  },

  confirmButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },

  primaryButtonText: {
    color: "#F7F8FA",
  },

  destructiveButtonText: {
    color: "#F7F8FA",
  },

  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.985 }],
  },

  disabled: {
    opacity: 0.55,
  },
});