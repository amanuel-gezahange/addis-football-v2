import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../constants/colors";
import { languageOptions, Language } from "../i18n";
import { useLanguage } from "../i18n/LanguageContext";
import { supabase } from "../lib/supabase";

const PRIVACY_POLICY_URL =
  "https://amanuel-gezahange.github.io/addis-football/";

const SUPPORT_EMAIL = "addisfootballapp@gmail.com";

const organizerRoleCache: Record<string, boolean> = {};

export default function SettingsScreen() {
  const { language, setLanguage, t } = useLanguage();

  const [languageOpen, setLanguageOpen] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadRole() {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const userId = session?.user?.id;

        if (!userId) {
          if (active) {
            setIsOrganizer(false);
          }

          return;
        }

        if (
          Object.prototype.hasOwnProperty.call(organizerRoleCache, userId) &&
          active
        ) {
          setIsOrganizer(organizerRoleCache[userId]);
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.log("Settings role error:", error);
          return;
        }

        const nextIsOrganizer = data?.role === "organizer";

        organizerRoleCache[userId] = nextIsOrganizer;
        setIsOrganizer(nextIsOrganizer);
      }

      void loadRole();

      return () => {
        active = false;
      };
    }, []),
  );

  async function changeLanguage(nextLanguage: Language) {
    await setLanguage(nextLanguage);
    setLanguageOpen(false);
  }

  async function handleSignOut() {
    if (isDeletingAccount) {
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert(t("settings.signOutFailed"), error.message);

      return;
    }

    router.replace("/login");
  }

  function handleDeleteAccount() {
    if (isDeletingAccount) {
      return;
    }

    setDeleteError(null);
    setDeleteModalVisible(true);
  }

  function closeDeleteModal() {
    if (isDeletingAccount) {
      return;
    }

    setDeleteError(null);
    setDeleteModalVisible(false);
  }

  async function deleteAccount() {
    if (isDeletingAccount) {
      return;
    }

    setDeleteError(null);
    setIsDeletingAccount(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      if (!session) {
        setDeleteModalVisible(false);

        await supabase.auth.signOut();

        router.replace("/login");

        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "delete-account",
        {
          method: "POST",
        },
      );

      if (error) {
        console.log("Delete account function error:", error);

        throw new Error(error.message || "Unable to delete your account.");
      }

      if (!data?.success) {
        console.log("Unexpected delete-account response:", data);

        throw new Error(data?.error || "Unable to confirm account deletion.");
      }

      setDeleteModalVisible(false);

      try {
        const { error: signOutError } = await supabase.auth.signOut();

        if (signOutError) {
          console.log("Post-deletion sign out error:", signOutError);
        }
      } catch (signOutException) {
        console.log("Post-deletion sign out exception:", signOutException);
      }

      router.replace("/login");
    } catch (error) {
      console.log("Delete account error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to delete your account. Please try again.";

      setDeleteError(message);
    } finally {
      setIsDeletingAccount(false);
    }
  }

  async function openExternalUrl(url: string) {
    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert(
          t("settings.unableToOpenLink"),
          t("settings.unableToOpenLinkMessage"),
        );

        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.log("Open URL error:", error);

      Alert.alert(t("settings.unableToOpenLink"), t("settings.pleaseTryAgain"));
    }
  }

  async function openSupportEmail() {
    const subject = encodeURIComponent(t("settings.supportEmailSubject"));

    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}`;

    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert(
          t("settings.contactSupport"),
          `${t("settings.emailUsAt")} ${SUPPORT_EMAIL}`,
        );

        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.log("Support email error:", error);

      Alert.alert(
        t("settings.contactSupport"),
        `${t("settings.emailUsAt")} ${SUPPORT_EMAIL}`,
      );
    }
  }

  function currentLanguageLabel() {
    return (
      languageOptions.find((option) => option.code === language)?.label ||
      language.toUpperCase()
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* =====================================================
          HEADER
      ====================================================== */}

      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/profile");
            }
          }}
        >
          <Ionicons name="arrow-back" size={23} color={COLORS.text} />
        </Pressable>

        <Text style={styles.headerTitle}>{t("settings.title")}</Text>

        <View style={styles.headerSpacer} />
      </View>

      {/* =====================================================
          SETTINGS CONTENT
      ====================================================== */}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* GENERAL */}

        <Text style={styles.sectionTitle}>{t("settings.general")}</Text>

        <View style={styles.card}>
          {/* LANGUAGE */}

          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => setLanguageOpen((open) => !open)}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconBox}>
                <Ionicons
                  name="language-outline"
                  size={20}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t("settings.language")}</Text>

                <Text style={styles.rowSubtitle}>{currentLanguageLabel()}</Text>
              </View>
            </View>

            <View style={styles.settingChevron}>
              <Ionicons
                name={languageOpen ? "chevron-down" : "chevron-forward"}
                size={20}
                color="#66766F"
              />
            </View>
          </Pressable>

          {languageOpen && (
            <View style={styles.languageContainer}>
              {languageOptions.map((option, index) => {
                const selected = language === option.code;

                return (
                  <View key={option.code}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.languageOption,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => changeLanguage(option.code)}
                    >
                      <View style={styles.languageOptionLeft}>
                        <View style={styles.languageCheck}>
                          {selected && (
                            <Ionicons
                              name="checkmark"
                              size={18}
                              color={COLORS.primary}
                            />
                          )}
                        </View>

                        <Text
                          style={[
                            styles.languageName,
                            selected && styles.languageNameSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </View>
                    </Pressable>

                    {index < languageOptions.length - 1 && (
                      <View style={styles.languageDivider} />
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.divider} />

          <SettingsRow
            icon="notifications-outline"
            title={t("settings.notifications")}
            subtitle={t("settings.notificationsSubtitle")}
            onPress={() => router.push("/notifications")}
          />
        </View>

        {/* ===================================================
            ORGANIZE
        ==================================================== */}

        <Text style={styles.sectionTitle}>Organize</Text>

        <View style={styles.card}>
          <SettingsRow
            icon={isOrganizer ? "grid-outline" : "football-outline"}
            title={isOrganizer ? "Organizer Dashboard" : "Become an Organizer"}
            subtitle={
              isOrganizer
                ? "Manage your games and players"
                : "Host games and reach more players"
            }
            onPress={() => {
              if (isOrganizer) {
                router.push("/(organizer)");
              } else {
                router.push("/become-organizer");
              }
            }}
          />
        </View>

        {/* ===================================================
            SUPPORT
        ==================================================== */}

        <Text style={styles.sectionTitle}>{t("settings.support")}</Text>

        <View style={styles.card}>
          <SettingsRow
            icon="help-circle-outline"
            title={t("settings.helpSupport")}
            subtitle={t("settings.helpSupportSubtitle")}
            onPress={openSupportEmail}
          />

          <View style={styles.divider} />

          <SettingsRow
            icon="document-text-outline"
            title={t("settings.privacyPolicy")}
            onPress={() => openExternalUrl(PRIVACY_POLICY_URL)}
          />
        </View>

        {/* ===================================================
            ACCOUNT
        ==================================================== */}

        <Text style={styles.sectionTitle}>{t("settings.account")}</Text>

        <View style={styles.card}>
          <SettingsRow
            icon="trash-outline"
            title={
              isDeletingAccount
                ? "Deleting Account..."
                : t("settings.deleteAccount")
            }
            subtitle="Permanently delete your account"
            danger
            disabled={isDeletingAccount}
            loading={isDeletingAccount}
            onPress={handleDeleteAccount}
          />

          <View style={styles.divider} />

          <SettingsRow
            icon="log-out-outline"
            title={t("settings.signOut")}
            danger
            disabled={isDeletingAccount}
            onPress={handleSignOut}
          />
        </View>

        <Text style={styles.version}>{t("settings.footer")}</Text>

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* =====================================================
          DELETE ACCOUNT CONFIRMATION MODAL
      ====================================================== */}

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeDeleteModal}
            disabled={isDeletingAccount}
          />

          <View style={styles.deleteModal}>
            <View style={styles.deleteModalIcon}>
              <Ionicons name="trash-outline" size={30} color="#FF5A62" />
            </View>

            <Text style={styles.deleteModalTitle}>Delete your account?</Text>

            <Text style={styles.deleteModalDescription}>
              This will permanently delete your Addis Football account and
              associated personal data.
            </Text>

            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={20} color="#FFB45A" />

              <Text style={styles.warningText}>
                This action cannot be undone.
              </Text>
            </View>

            {!!deleteError && (
              <View style={styles.deleteErrorBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={19}
                  color="#FF6B72"
                />

                <Text style={styles.deleteErrorText}>{deleteError}</Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <Pressable
                disabled={isDeletingAccount}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && !isDeletingAccount && styles.pressed,
                  isDeletingAccount && styles.disabled,
                ]}
                onPress={closeDeleteModal}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                disabled={isDeletingAccount}
                style={({ pressed }) => [
                  styles.confirmDeleteButton,
                  pressed && !isDeletingAccount && styles.pressed,
                  isDeletingAccount && styles.disabled,
                ]}
                onPress={() => {
                  void deleteAccount();
                }}
              >
                {isDeletingAccount ? (
                  <>
                    <ActivityIndicator size="small" color="#F7F8FA" />

                    <Text style={styles.confirmDeleteButtonText}>
                      Deleting...
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={18} color="#F7F8FA" />

                    <Text style={styles.confirmDeleteButtonText}>
                      Delete Account
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type SettingsRowProps = {
  icon:
    | "notifications-outline"
    | "help-circle-outline"
    | "document-text-outline"
    | "trash-outline"
    | "log-out-outline"
    | "football-outline"
    | "grid-outline";
  title: string;
  subtitle?: string;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
};

function SettingsRow({
  icon,
  title,
  subtitle,
  danger = false,
  disabled = false,
  loading = false,
  onPress,
}: SettingsRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.iconBox, danger && styles.dangerIconBox]}>
          {loading ? (
            <ActivityIndicator size="small" color="#FF5A62" />
          ) : (
            <Ionicons
              name={icon}
              size={20}
              color={danger ? "#FF5A62" : COLORS.primary}
            />
          )}
        </View>

        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, danger && styles.dangerText]}>
            {title}
          </Text>

          {!!subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
        </View>
      </View>

      {!loading && (
        <View style={styles.settingChevron}>
          <Ionicons name="chevron-forward" size={20} color="#66766F" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // =========================================================
  // SCREEN
  // =========================================================

  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollView: {
    flex: 1,
  },

  // =========================================================
  // HEADER
  // =========================================================

  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
  },

  headerSpacer: {
    width: 40,
  },

  // =========================================================
  // CONTENT
  // =========================================================

  content: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginLeft: 4,
    marginBottom: 9,
    marginTop: 8,
  },

  card: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 15,
    marginBottom: 18,
  },

  // =========================================================
  // STANDARD SETTINGS ROW
  // =========================================================

  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  rowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },

  rowText: {
    flex: 1,
    minWidth: 0,
  },

  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },

  rowTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },

  rowSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },

  // Keeps ALL arrows at the same far-right position.
  settingChevron: {
    width: 32,
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: 10,
    flexShrink: 0,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginLeft: 50,
  },

  // =========================================================
  // LANGUAGE
  // =========================================================

  languageContainer: {
    marginLeft: 50,
    paddingRight: 0,
    paddingBottom: 7,
  },

  languageOption: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
  },

  languageOptionLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  languageCheck: {
    width: 28,
    alignItems: "flex-start",
    justifyContent: "center",
  },

  languageName: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },

  languageNameSelected: {
    color: COLORS.primary,
    fontWeight: "800",
  },

  languageDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginLeft: 28,
  },

  // =========================================================
  // DANGER / DISABLED
  // =========================================================

  dangerIconBox: {
    backgroundColor: "rgba(217, 45, 58, 0.08)",
  },

  dangerText: {
    color: COLORS.danger,
  },

  disabled: {
    opacity: 0.55,
  },

  pressed: {
    opacity: 0.7,
  },

  // =========================================================
  // FOOTER
  // =========================================================

  version: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2,
  },

  bottomSpace: {
    height: 40,
  },

  // =========================================================
  // DELETE ACCOUNT MODAL
  // =========================================================

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(20, 32, 27, 0.48)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 30,
  },

  deleteModal: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: "center",
  },

  deleteModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(217, 45, 58, 0.09)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  deleteModalTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },

  deleteModalDescription: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
  },

  warningBox: {
    width: "100%",
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.22)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 14,
    marginTop: 18,
  },

  warningText: {
    color: COLORS.warning,
    fontSize: 13,
    fontWeight: "800",
  },

  deleteErrorBox: {
    width: "100%",
    borderRadius: 13,
    backgroundColor: "rgba(217, 45, 58, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(217, 45, 58, 0.2)",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    padding: 13,
    marginTop: 14,
  },

  deleteErrorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },

  // =========================================================
  // MODAL BUTTONS
  // =========================================================

  modalButtons: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },

  cancelButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  cancelButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },

  confirmDeleteButton: {
    flex: 1.25,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: COLORS.danger,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
  },

  confirmDeleteButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
  },
});
