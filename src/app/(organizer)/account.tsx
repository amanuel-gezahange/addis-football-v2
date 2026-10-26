import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS } from "../../constants/colors";
import { useLanguage } from "../../i18n/LanguageContext";
import { supabase } from "../../lib/supabase";

type Language = "en" | "am" | "om";

type BankOption = {
  name: string;
  logo?: ImageSourcePropType;
  short: string;
};

const TOP_BANKS: BankOption[] = [
  {
    name: "Commercial Bank of Ethiopia (CBE)",
    short: "CBE",
    logo: require("../../../assets/images/cbe.png"),
  },
  {
    name: "Awash Bank",
    short: "AW",
    logo: require("../../../assets/images/awash.png"),
  },
  {
    name: "Bank of Abyssinia",
    short: "BOA",
    logo: require("../../../assets/images/abyssinia.png"),
  },
  {
    name: "Dashen Bank",
    short: "DB",
    logo: require("../../../assets/images/dashen.png"),
  },
  {
    name: "Cooperative Bank of Oromia",
    short: "COOP",
    logo: require("../../../assets/images/coop.png"),
  },
];

const OTHER_BANKS: BankOption[] = [];

const TELEBIRR_LOGO =
  "https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/tele_birr/tele_birr.png";

function getBankOption(name: string) {
  return [...TOP_BANKS, ...OTHER_BANKS].find((bank) => bank.name === name);
}

export default function OrganizerAccount() {
  const insets = useSafeAreaInsets();

  const { language, setLanguage, t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [acceptsTelebirr, setAcceptsTelebirr] = useState(false);
  const [acceptsMobileBanking, setAcceptsMobileBanking] = useState(false);
  const [telebirrPhone, setTelebirrPhone] = useState("");
  const [telebirrAccountName, setTelebirrAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [savingPayments, setSavingPayments] = useState(false);
  const [editingPayment, setEditingPayment] = useState<
    "telebirr" | "mobile_banking" | null
  >(null);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [showOtherBanks, setShowOtherBanks] = useState(false);

  const [languageOpen, setLanguageOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const [originalName, setOriginalName] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");

  useEffect(() => {
    loadAccount();
  }, []);

  async function loadAccount() {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const [profileResult, applicationResult] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "full_name, phone, role, accepts_telebirr, accepts_mobile_banking, telebirr_phone, telebirr_account_name, bank_name, bank_account_number, bank_account_name",
          )
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("organizer_applications")
          .select("organizer_name, phone")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (profileResult.error) {
        console.error("Error loading organizer profile:", profileResult.error);
      }

      if (applicationResult.error) {
        console.error(
          "Error loading organizer application:",
          applicationResult.error,
        );
      }

      const profile = profileResult.data;
      const application = applicationResult.data;

      const resolvedName =
        profile?.full_name?.trim() || application?.organizer_name?.trim() || "";

      const resolvedPhone =
        profile?.phone?.trim() ||
        application?.phone?.trim() ||
        user.phone ||
        "";

      setFullName(resolvedName);
      setPhone(resolvedPhone);

      setAcceptsTelebirr(Boolean(profile?.accepts_telebirr));
      setAcceptsMobileBanking(Boolean(profile?.accepts_mobile_banking));
      setTelebirrPhone(profile?.telebirr_phone?.trim() || "");
      setTelebirrAccountName(profile?.telebirr_account_name?.trim() || "");
      setBankName(profile?.bank_name?.trim() || "");
      setBankAccountNumber(profile?.bank_account_number?.trim() || "");
      setBankAccountName(profile?.bank_account_name?.trim() || "");

      setOriginalName(resolvedName);
      setOriginalPhone(resolvedPhone);
    } catch (error) {
      console.error("Error loading organizer account:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveAccount() {
    try {
      setSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const savedName = fullName.trim();
      const savedPhone = phone.trim();

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: savedName || null,
          phone: savedPhone || null,
        })
        .eq("id", user.id);

      if (error) {
        throw error;
      }

      setFullName(savedName);
      setPhone(savedPhone);

      setOriginalName(savedName);
      setOriginalPhone(savedPhone);

      setEditing(false);

      Alert.alert(
        t("organizerAccount.accountSaved"),
        t("organizerAccount.accountUpdated"),
      );
    } catch (error) {
      console.error("Error saving organizer account:", error);

      Alert.alert(
        t("organizerAccount.couldNotSave"),
        t("organizerAccount.tryAgain"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function updatePaymentProfile(
    updates: Record<string, string | boolean | null>,
  ) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      throw new Error("Not signed in");
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      throw error;
    }
  }

  async function saveTelebirr() {
    if (!telebirrPhone.trim()) {
      Alert.alert("Missing Telebirr number", "Enter your Telebirr number.");
      return;
    }

    if (!telebirrAccountName.trim()) {
      Alert.alert(
        "Missing account name",
        "Enter the name on your Telebirr account.",
      );
      return;
    }

    try {
      setSavingPayments(true);

      await updatePaymentProfile({
        accepts_telebirr: true,
        telebirr_phone: telebirrPhone.trim(),
        telebirr_account_name: telebirrAccountName.trim(),
      });

      setAcceptsTelebirr(true);
      setEditingPayment(null);

      Alert.alert(
        "Telebirr saved",
        "Players can now pay you using your Telebirr account.",
      );
    } catch (error) {
      console.error("Error saving Telebirr details:", error);
      Alert.alert("Could not save Telebirr", "Please try again.");
    } finally {
      setSavingPayments(false);
    }
  }

  async function saveMobileBanking() {
    if (!bankName.trim()) {
      Alert.alert("Missing bank", "Enter your bank name.");
      return;
    }

    if (!bankAccountNumber.trim()) {
      Alert.alert("Missing account number", "Enter your bank account number.");
      return;
    }

    if (!bankAccountName.trim()) {
      Alert.alert("Missing account name", "Enter your bank account name.");
      return;
    }

    try {
      setSavingPayments(true);

      await updatePaymentProfile({
        accepts_mobile_banking: true,
        bank_name: bankName.trim(),
        bank_account_number: bankAccountNumber.trim(),
        bank_account_name: bankAccountName.trim(),
      });

      setAcceptsMobileBanking(true);
      setEditingPayment(null);

      Alert.alert(
        "Mobile Banking saved",
        "Players can now pay you using your bank account.",
      );
    } catch (error) {
      console.error("Error saving Mobile Banking details:", error);
      Alert.alert("Could not save Mobile Banking", "Please try again.");
    } finally {
      setSavingPayments(false);
    }
  }

  async function toggleTelebirr() {
    if (savingPayments) return;

    if (acceptsTelebirr) {
      if (!acceptsMobileBanking) {
        Alert.alert(
          "Keep one payment method",
          "Enable Mobile Banking before turning off Telebirr.",
        );
        return;
      }

      try {
        setSavingPayments(true);
        await updatePaymentProfile({
          accepts_telebirr: false,
        });
        setAcceptsTelebirr(false);
      } catch (error) {
        console.error("Error disabling Telebirr:", error);
        Alert.alert("Could not update Telebirr", "Please try again.");
      } finally {
        setSavingPayments(false);
      }

      return;
    }

    if (!telebirrPhone.trim() || !telebirrAccountName.trim()) {
      setEditingPayment("telebirr");
      return;
    }

    try {
      setSavingPayments(true);
      await updatePaymentProfile({
        accepts_telebirr: true,
        telebirr_phone: telebirrPhone.trim(),
        telebirr_account_name: telebirrAccountName.trim(),
      });
      setAcceptsTelebirr(true);
    } catch (error) {
      console.error("Error enabling Telebirr:", error);
      Alert.alert("Could not update Telebirr", "Please try again.");
    } finally {
      setSavingPayments(false);
    }
  }

  async function toggleMobileBanking() {
    if (savingPayments) return;

    if (acceptsMobileBanking) {
      if (!acceptsTelebirr) {
        Alert.alert(
          "Keep one payment method",
          "Enable Telebirr before turning off Mobile Banking.",
        );
        return;
      }

      try {
        setSavingPayments(true);

        await updatePaymentProfile({
          accepts_mobile_banking: false,
        });

        setAcceptsMobileBanking(false);
      } catch (error) {
        console.error("Error disabling Mobile Banking:", error);
        Alert.alert("Could not update Mobile Banking", "Please try again.");
      } finally {
        setSavingPayments(false);
      }

      return;
    }

    // If details are already loaded, simply turn the method back on.
    if (bankName.trim() && bankAccountNumber.trim() && bankAccountName.trim()) {
      try {
        setSavingPayments(true);

        await updatePaymentProfile({
          accepts_mobile_banking: true,
          bank_name: bankName.trim(),
          bank_account_number: bankAccountNumber.trim(),
          bank_account_name: bankAccountName.trim(),
        });

        setAcceptsMobileBanking(true);
      } catch (error) {
        console.error("Error enabling Mobile Banking:", error);
        Alert.alert("Could not update Mobile Banking", "Please try again.");
      } finally {
        setSavingPayments(false);
      }

      return;
    }

    // First-time setup: open the Mobile Banking form.
    setEditingPayment("mobile_banking");
  }

  function confirmRemoveTelebirr() {
    if (!acceptsMobileBanking) {
      Alert.alert(
        "Keep one payment method",
        "Add Mobile Banking before removing Telebirr.",
      );
      return;
    }

    Alert.alert(
      "Remove Telebirr?",
      "Players will no longer see Telebirr as a payment option.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setSavingPayments(true);
              await updatePaymentProfile({
                accepts_telebirr: false,
                telebirr_phone: null,
                telebirr_account_name: null,
              });
              setAcceptsTelebirr(false);
              setTelebirrPhone("");
              setTelebirrAccountName("");
              setEditingPayment(null);
            } catch (error) {
              console.error("Error removing Telebirr:", error);
              Alert.alert("Could not remove Telebirr", "Please try again.");
            } finally {
              setSavingPayments(false);
            }
          },
        },
      ],
    );
  }

  function confirmRemoveMobileBanking() {
    if (!acceptsTelebirr) {
      Alert.alert(
        "Keep one payment method",
        "Add Telebirr before removing Mobile Banking.",
      );
      return;
    }

    Alert.alert(
      "Remove Mobile Banking?",
      "Players will no longer see Mobile Banking as a payment option.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setSavingPayments(true);
              await updatePaymentProfile({
                accepts_mobile_banking: false,
                bank_name: null,
                bank_account_number: null,
                bank_account_name: null,
              });
              setAcceptsMobileBanking(false);
              setBankName("");
              setBankAccountNumber("");
              setBankAccountName("");
              setEditingPayment(null);
            } catch (error) {
              console.error("Error removing Mobile Banking:", error);
              Alert.alert(
                "Could not remove Mobile Banking",
                "Please try again.",
              );
            } finally {
              setSavingPayments(false);
            }
          },
        },
      ],
    );
  }

  function maskAccountNumber(value: string) {
    const clean = value.trim();

    if (clean.length <= 4) {
      return clean;
    }

    return `${"•".repeat(Math.min(8, clean.length - 4))}${clean.slice(-4)}`;
  }

  function startEditing() {
    setOriginalName(fullName);
    setOriginalPhone(phone);
    setEditing(true);
  }

  function cancelEditing() {
    setFullName(originalName);
    setPhone(originalPhone);
    setEditing(false);
  }

  async function deleteAccount() {
    if (deletingAccount) return;

    try {
      setDeletingAccount(true);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.access_token) {
        setDeleteModalOpen(false);
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase.functions.invoke("delete-account", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error("Delete account function error:", error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || "Unable to delete account.");
      }

      setDeleteModalOpen(false);

      // The Auth user has already been deleted by the Edge Function.
      // Clear the local client session. A remote/global sign-out can return
      // user_not_found after successful deletion, so it is intentionally
      // not required for this flow.
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch (signOutError) {
        console.log(
          "Local session cleanup after account deletion:",
          signOutError,
        );
      }

      router.replace("/login");
    } catch (error) {
      console.error("Delete organizer account error:", error);

      Alert.alert(
        "Could not delete account",
        "Your account could not be deleted. Please try again.",
      );
    } finally {
      setDeletingAccount(false);
    }
  }

  async function signOut() {
    try {
      setSigningOut(true);

      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.replace("/login");
    } catch (error) {
      console.error("Sign out error:", error);

      Alert.alert(
        t("organizerAccount.couldNotSignOut"),
        t("organizerAccount.tryAgain"),
      );
    } finally {
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 20,
          },
        ]}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t("organizerAccount.eyebrow")}</Text>

            <Text style={styles.title}>{t("organizerAccount.title")}</Text>

            <Text style={styles.subtitle}>
              {t("organizerAccount.subtitle")}
            </Text>
          </View>

          {/* <View style={styles.headerIcon}>
            <Ionicons
              name="settings-outline"
              size={25}
              color={COLORS.primary}
            />
          </View> */}
        </View>

        {/* ORGANIZER IDENTITY */}
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color="#F7F8FA" />
          </View>

          <View style={styles.identityContent}>
            <Text style={styles.identityName} numberOfLines={1}>
              {fullName.trim() || t("organizerAccount.organizer")}
            </Text>

            <View style={styles.roleRow}>
              <View style={styles.roleDot} />

              <Text style={styles.roleText}>
                {t("organizerAccount.organizer")}
              </Text>
            </View>
          </View>

          <Ionicons name="shield-checkmark" size={23} color={COLORS.primary} />
        </View>

        {/* PERSONAL INFORMATION */}
        <Text style={styles.sectionLabel}>PERSONAL INFORMATION</Text>

        <View style={styles.card}>
          {!editing ? (
            <>
              {/* ORGANIZER NAME */}
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="business-outline" size={19} color="#66766F" />
                </View>

                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Organizer Name</Text>

                  <Text style={styles.infoValue}>
                    {fullName || "Not provided"}
                  </Text>
                </View>
              </View>

              <View style={styles.fieldDivider} />

              {/* PHONE */}
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="call-outline" size={19} color="#66766F" />
                </View>

                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone</Text>

                  <Text style={styles.infoValue}>
                    {phone || "Not provided"}
                  </Text>
                </View>
              </View>

              <View style={styles.fieldDivider} />

              {/* EDIT */}
              <Pressable
                onPress={startEditing}
                style={({ pressed }) => [
                  styles.editButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Ionicons
                  name="pencil-outline"
                  size={18}
                  color={COLORS.primary}
                />

                <Text style={styles.editButtonText}>Edit Profile</Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* ORGANIZER NAME INPUT */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Organizer Name</Text>

                <View style={styles.inputContainer}>
                  <Ionicons name="business-outline" size={19} color="#66766F" />

                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Organizer name"
                    placeholderTextColor="#66766F"
                    style={styles.input}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View style={styles.fieldDivider} />

              {/* PHONE INPUT */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Phone</Text>

                <View style={styles.inputContainer}>
                  <Ionicons name="call-outline" size={19} color="#66766F" />

                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Phone number"
                    placeholderTextColor="#66766F"
                    style={styles.input}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {/* EDIT ACTIONS */}
              <View style={styles.editActions}>
                <Pressable
                  disabled={saving}
                  onPress={cancelEditing}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && styles.buttonPressed,
                    saving && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  disabled={saving}
                  onPress={saveAccount}
                  style={({ pressed }) => [
                    styles.saveChangesButton,
                    pressed && styles.buttonPressed,
                    saving && styles.buttonDisabled,
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#F7F8FA" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={19} color="#F7F8FA" />

                      <Text style={styles.saveChangesText}>Save Changes</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>

        {/* PAYMENT METHODS */}
        <Text style={styles.sectionLabel}>PAYMENT METHODS</Text>

        <View style={styles.paymentSection}>
          <Text style={styles.paymentIntro}>
            Choose how players can pay you for games. You can enable one or both
            methods.
          </Text>

          {editingPayment !== "telebirr" && (
            <PaymentSummaryCard
              icon="wallet-outline"
              logoUri={TELEBIRR_LOGO}
              title="Telebirr"
              description="Players can send payments to your Telebirr account."
              enabled={acceptsTelebirr}
              rows={
                acceptsTelebirr
                  ? [
                      {
                        icon: "call-outline",
                        value: telebirrPhone || "No number",
                      },
                      {
                        icon: "person-outline",
                        value: telebirrAccountName || "No account name",
                      },
                    ]
                  : []
              }
              onEdit={() => setEditingPayment("telebirr")}
              onToggle={toggleTelebirr}
              disabled={savingPayments}
            />
          )}

          {editingPayment === "telebirr" && (
            <View style={styles.paymentEditCard}>
              <View style={styles.paymentEditHeader}>
                <Pressable
                  onPress={() => setEditingPayment(null)}
                  style={({ pressed }) => [
                    styles.paymentBackButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Ionicons name="arrow-back" size={20} color="#F7F8FA" />
                </Pressable>

                <View style={styles.paymentEditHeaderText}>
                  <Text style={styles.paymentEditTitle}>Edit Telebirr</Text>
                  <Text style={styles.paymentEditSubtitle}>
                    Players can send payments to your Telebirr account.
                  </Text>
                </View>
              </View>

              <PaymentField
                label="Telebirr number"
                icon="call-outline"
                value={telebirrPhone}
                onChangeText={setTelebirrPhone}
                placeholder="0912345678"
                keyboardType="phone-pad"
              />

              <PaymentField
                label="Account name"
                icon="person-outline"
                value={telebirrAccountName}
                onChangeText={setTelebirrAccountName}
                placeholder="Abebe Kebede"
              />

              <Pressable
                disabled={savingPayments}
                onPress={saveTelebirr}
                style={({ pressed }) => [
                  styles.paymentSaveButton,
                  pressed && styles.buttonPressed,
                  savingPayments && styles.buttonDisabled,
                ]}
              >
                {savingPayments ? (
                  <ActivityIndicator size="small" color="#F7F8FA" />
                ) : (
                  <Text style={styles.paymentSaveText}>Save Changes</Text>
                )}
              </Pressable>

              {acceptsTelebirr && (
                <Pressable
                  disabled={savingPayments}
                  onPress={confirmRemoveTelebirr}
                  style={({ pressed }) => [
                    styles.removePaymentButton,
                    pressed && styles.buttonPressed,
                    savingPayments && styles.buttonDisabled,
                  ]}
                >
                  <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                  <Text style={styles.removePaymentText}>Remove Telebirr</Text>
                </Pressable>
              )}
            </View>
          )}

          {editingPayment !== "mobile_banking" && (
            <PaymentSummaryCard
              icon="business-outline"
              logoSource={getBankOption(bankName)?.logo}
              logoFallback={getBankOption(bankName)?.short}
              title="Mobile Banking"
              description="Players can transfer payments to your bank account."
              enabled={acceptsMobileBanking}
              rows={
                acceptsMobileBanking
                  ? [
                      {
                        icon: "business-outline",
                        value: bankName || "No bank",
                      },
                      {
                        icon: "card-outline",
                        value: maskAccountNumber(bankAccountNumber),
                      },
                      {
                        icon: "person-outline",
                        value: bankAccountName || "No account name",
                      },
                    ]
                  : []
              }
              onEdit={() => setEditingPayment("mobile_banking")}
              onToggle={toggleMobileBanking}
              disabled={savingPayments}
            />
          )}

          {editingPayment === "mobile_banking" && (
            <View style={styles.paymentEditCard}>
              <View style={styles.paymentEditHeader}>
                <Pressable
                  onPress={() => setEditingPayment(null)}
                  style={({ pressed }) => [
                    styles.paymentBackButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Ionicons name="arrow-back" size={20} color="#F7F8FA" />
                </Pressable>

                <View style={styles.paymentEditHeaderText}>
                  <Text style={styles.paymentEditTitle}>
                    Edit Mobile Banking
                  </Text>
                  <Text style={styles.paymentEditSubtitle}>
                    Players can transfer payments to your bank account.
                  </Text>
                </View>
              </View>

              <View style={styles.paymentField}>
                <Text style={styles.fieldLabel}>Bank</Text>

                <Pressable
                  onPress={() => {
                    if (!bankName) setBankName(TOP_BANKS[0].name);
                    setBankPickerOpen(true);
                  }}
                  style={({ pressed }) => [
                    styles.bankSelector,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <BankLogo
                    bankName={
                      getBankOption(bankName)?.name || TOP_BANKS[0].name
                    }
                    size={36}
                  />

                  <View style={styles.bankSelectorContent}>
                    <Text
                      style={[
                        styles.bankSelectorText,
                        !bankName && styles.bankSelectorPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {getBankOption(bankName)?.name || TOP_BANKS[0].name}
                    </Text>
                    <Text style={styles.bankSelectorHint}>
                      Tap to change bank
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={19} color="#66766F" />
                </Pressable>
              </View>

              <Modal
                visible={bankPickerOpen}
                transparent
                animationType="slide"
                onRequestClose={() => setBankPickerOpen(false)}
              >
                <View style={styles.pickerOverlay}>
                  <Pressable
                    style={styles.pickerBackdrop}
                    onPress={() => setBankPickerOpen(false)}
                  />

                  <View style={styles.bankPickerSheet}>
                    <ScrollView
                      horizontal
                      style={styles.bankPickerScroll}
                      contentContainerStyle={[
                        styles.bankPickerScrollContent,
                        styles.bankLogoStrip,
                      ]}
                      showsHorizontalScrollIndicator={false}
                      showsVerticalScrollIndicator={false}
                      bounces
                    >
                      {TOP_BANKS.map((bank) => (
                        <BankPickerRow
                          key={bank.name}
                          bank={bank}
                          selected={bankName === bank.name}
                          onPress={() => {
                            setBankName(bank.name);
                            setBankPickerOpen(false);
                          }}
                        />
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </Modal>

              <PaymentField
                label="Account number"
                icon="card-outline"
                value={bankAccountNumber}
                onChangeText={setBankAccountNumber}
                placeholder="1000123456789"
                keyboardType="number-pad"
              />

              <PaymentField
                label="Account name"
                icon="person-outline"
                value={bankAccountName}
                onChangeText={setBankAccountName}
                placeholder="Abebe Kebede"
              />

              <Pressable
                disabled={savingPayments}
                onPress={saveMobileBanking}
                style={({ pressed }) => [
                  styles.paymentSaveButton,
                  pressed && styles.buttonPressed,
                  savingPayments && styles.buttonDisabled,
                ]}
              >
                {savingPayments ? (
                  <ActivityIndicator size="small" color="#F7F8FA" />
                ) : (
                  <Text style={styles.paymentSaveText}>Save Changes</Text>
                )}
              </Pressable>

              {acceptsMobileBanking && (
                <Pressable
                  disabled={savingPayments}
                  onPress={confirmRemoveMobileBanking}
                  style={({ pressed }) => [
                    styles.removePaymentButton,
                    pressed && styles.buttonPressed,
                    savingPayments && styles.buttonDisabled,
                  ]}
                >
                  <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                  <Text style={styles.removePaymentText}>
                    Remove Mobile Banking
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {!editingPayment && (!acceptsTelebirr || !acceptsMobileBanking) && (
            <Pressable
              onPress={() =>
                setEditingPayment(
                  !acceptsTelebirr ? "telebirr" : "mobile_banking",
                )
              }
              style={({ pressed }) => [
                styles.addPaymentButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons
                name="add-circle-outline"
                size={21}
                color={COLORS.primary}
              />
              <Text style={styles.addPaymentText}>Add a payment method</Text>
            </Pressable>
          )}

          {!editingPayment && (
            <View style={styles.paymentHint}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.paymentHintText}>
                Players will see the payment methods you enable when joining
                your games.
              </Text>
            </View>
          )}
        </View>

        {/* LANGUAGE — HIDDEN FOR V1 (English only)
            Amharic and Afaan Oromo code is intentionally preserved below.
            Re-enable this block when additional languages are ready.

        <Text style={styles.sectionLabel}>
          {t("organizerAccount.language")}
        </Text>

        <View style={styles.card}>
          <Pressable
            onPress={() =>
              setLanguageOpen((current) => !current)
            }
            style={({ pressed }) => [
              styles.languageSelector,
              pressed && styles.languagePressed,
            ]}
          >
            <View style={styles.languageCode}>
              <Text style={styles.languageCodeText}>
                {language === "en"
                  ? "EN"
                  : language === "am"
                    ? "AM"
                    : "OM"}
              </Text>
            </View>

            <Text style={styles.languageLabel}>
              {language === "en"
                ? t("languages.english")
                : language === "am"
                  ? t("languages.amharic")
                  : t("languages.oromo")}
            </Text>

            <Ionicons
              name={
                languageOpen
                  ? "chevron-up"
                  : "chevron-down"
              }
              size={20}
              color="#66766F"
            />
          </Pressable>

          {languageOpen && (
            <>
              <View style={styles.optionDivider} />

              <LanguageOption
                label={t("languages.english")}
                code="EN"
                selected={language === "en"}
                onPress={() => {
                  setLanguage("en" as Language);
                  setLanguageOpen(false);
                }}
              />

              <View style={styles.optionDivider} />

              <LanguageOption
                label={t("languages.amharic")}
                code="AM"
                selected={language === "am"}
                onPress={() => {
                  setLanguage("am" as Language);
                  setLanguageOpen(false);
                }}
              />

              <View style={styles.optionDivider} />

              <LanguageOption
                label={t("languages.oromo")}
                code="OM"
                selected={language === "om"}
                onPress={() => {
                  setLanguage("om" as Language);
                  setLanguageOpen(false);
                }}
              />
            </>
          )}
        </View>

        */}

        {/* ACCOUNT ACTIONS */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>

        <View style={styles.accountActionsCard}>
          <Pressable
            disabled={deletingAccount || signingOut}
            onPress={() => setDeleteModalOpen(true)}
            style={({ pressed }) => [
              styles.deleteAccountButton,
              pressed && styles.buttonPressed,
              (deletingAccount || signingOut) && styles.buttonDisabled,
            ]}
          >
            <View style={styles.accountActionIconDanger}>
              <Ionicons name="trash-outline" size={20} color="#FF5B63" />
            </View>

            <View style={styles.accountActionContent}>
              <Text style={styles.deleteAccountText}>Delete Account</Text>
              <Text style={styles.accountActionSubtitle}>
                Permanently delete your account
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color="#66766F" />
          </Pressable>

          <View style={styles.accountActionDivider} />

          <Pressable
            disabled={signingOut || deletingAccount}
            onPress={signOut}
            style={({ pressed }) => [
              styles.accountSignOutButton,
              pressed && styles.buttonPressed,
              (signingOut || deletingAccount) && styles.buttonDisabled,
            ]}
          >
            <View style={styles.accountActionIconDanger}>
              {signingOut ? (
                <ActivityIndicator size="small" color="#FF5B63" />
              ) : (
                <Ionicons name="log-out-outline" size={20} color="#FF5B63" />
              )}
            </View>

            <View style={styles.accountActionContent}>
              <Text style={styles.signOutText}>
                {t("organizerAccount.signOut")}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color="#66766F" />
          </Pressable>
        </View>

        <Modal
          visible={deleteModalOpen}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => {
            if (!deletingAccount) {
              setDeleteModalOpen(false);
            }
          }}
        >
          <View style={styles.deleteModalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              disabled={deletingAccount}
              onPress={() => setDeleteModalOpen(false)}
            />

            <View style={styles.deleteModalCard}>
              <View style={styles.deleteModalIcon}>
                <Ionicons name="trash-outline" size={34} color="#FF5B63" />
              </View>

              <Text style={styles.deleteModalTitle}>Delete your account?</Text>

              <Text style={styles.deleteModalDescription}>
                This will permanently delete your Addis Football organizer
                account and associated personal data.
              </Text>

              <View style={styles.deleteWarning}>
                <Ionicons name="warning-outline" size={21} color="#FFB454" />
                <Text style={styles.deleteWarningText}>
                  This action cannot be undone.
                </Text>
              </View>

              <View style={styles.deleteModalActions}>
                <Pressable
                  disabled={deletingAccount}
                  onPress={() => setDeleteModalOpen(false)}
                  style={({ pressed }) => [
                    styles.deleteCancelButton,
                    pressed && styles.buttonPressed,
                    deletingAccount && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.deleteCancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  disabled={deletingAccount}
                  onPress={deleteAccount}
                  style={({ pressed }) => [
                    styles.deleteConfirmButton,
                    pressed && styles.buttonPressed,
                    deletingAccount && styles.buttonDisabled,
                  ]}
                >
                  {deletingAccount ? (
                    <ActivityIndicator size="small" color="#F7F8FA" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={20} color="#F7F8FA" />
                      <Text style={styles.deleteConfirmText}>
                        Delete Account
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Text style={styles.footer}>{t("organizerAccount.footer")}</Text>
      </ScrollView>
    </View>
  );
}

function BankLogo({
  bankName,
  size = 40,
}: {
  bankName: string;
  size?: number;
}) {
  const bank = getBankOption(bankName) || TOP_BANKS[0];

  return (
    <View
      style={[
        styles.bankLogoFrame,
        { width: size, height: size, borderRadius: Math.round(size / 3) },
      ]}
    >
      <Image
        source={bank.logo}
        style={{ width: size - 8, height: size - 8 }}
        resizeMode="contain"
      />
    </View>
  );
}

function BankPickerRow({
  bank,
  selected,
  onPress,
}: {
  bank: BankOption;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={bank.name}
      onPress={onPress}
      style={({ pressed }) => [
        styles.logoOnlyBankRow,
        selected && styles.logoOnlyBankRowSelected,
        pressed && styles.buttonPressed,
      ]}
    >
      <BankLogo bankName={bank.name} size={38} />
      {selected && (
        <View style={styles.logoSelectedDot}>
          <Ionicons name="checkmark" size={11} color="#F7F8FA" />
        </View>
      )}
    </Pressable>
  );
}

function PaymentSummaryCard({
  icon,
  logoUri,
  logoSource,
  logoFallback,
  title,
  description,
  enabled,
  rows,
  onEdit,
  onToggle,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  logoUri?: string;
  logoSource?: ImageSourcePropType;
  logoFallback?: string;
  title: string;
  description: string;
  enabled: boolean;
  rows: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    value: string;
  }[];
  onEdit: () => void;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.paymentSummaryCard}>
      <View style={styles.paymentSummaryTop}>
        <View style={styles.paymentIcon}>
          {logoSource ? (
            <Image
              source={logoSource}
              style={styles.paymentBrandLogo}
              resizeMode="contain"
            />
          ) : logoUri ? (
            <Image
              source={{ uri: logoUri }}
              style={styles.paymentBrandLogo}
              resizeMode="contain"
            />
          ) : logoFallback ? (
            <Text style={styles.paymentLogoFallback}>{logoFallback}</Text>
          ) : (
            <Ionicons
              name={icon}
              size={21}
              color={enabled ? COLORS.primary : "#66766F"}
            />
          )}
        </View>

        <View style={styles.paymentToggleContent}>
          <Text style={styles.paymentToggleTitle}>{title}</Text>
          <Text style={styles.paymentToggleDescription}>{description}</Text>
        </View>

        <Pressable
          onPress={onToggle}
          disabled={disabled}
          hitSlop={14}
          accessibilityRole="switch"
          accessibilityState={{ checked: enabled, disabled }}
          style={({ pressed }) => [
            styles.switchTrack,
            enabled && styles.switchTrackEnabled,
            pressed && styles.buttonPressed,
            disabled && styles.buttonDisabled,
          ]}
        >
          <View
            style={[styles.switchThumb, enabled && styles.switchThumbEnabled]}
          />
        </Pressable>
      </View>

      {enabled ? (
        <>
          <View style={styles.paymentSummaryDetails}>
            {rows.map((row, index) => (
              <View key={`${title}-${index}`} style={styles.paymentSummaryRow}>
                <Ionicons name={row.icon} size={19} color="#7E95A1" />
                <Text style={styles.paymentSummaryValue} numberOfLines={1}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [
              styles.paymentEditAction,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.paymentEditActionLeft}>
              <Ionicons
                name="pencil-outline"
                size={18}
                color={COLORS.primary}
              />
              <Text style={styles.paymentEditActionText}>Edit</Text>
            </View>

            <Ionicons name="chevron-forward" size={19} color={COLORS.primary} />
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={onEdit}
          style={({ pressed }) => [
            styles.paymentSetupAction,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.paymentSetupText}>Set up {title}</Text>
          <Ionicons name="chevron-forward" size={19} color={COLORS.primary} />
        </Pressable>
      )}
    </View>
  );
}

function PaymentField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "number-pad" | "phone-pad";
}) {
  return (
    <View style={styles.paymentField}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <View style={styles.inputContainer}>
        <Ionicons name={icon} size={19} color="#66766F" />

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#66766F"
          style={styles.input}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === "default" ? "words" : "none"}
        />
      </View>
    </View>
  );
}

function LanguageOption({
  label,
  code,
  selected,
  onPress,
}: {
  label: string;
  code: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.languageRow,
        pressed && styles.languagePressed,
      ]}
    >
      <View style={styles.languageCode}>
        <Text style={styles.languageCodeText}>{code}</Text>
      </View>

      <Text style={styles.languageLabel}>{label}</Text>

      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingBottom: 36,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  eyebrow: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.7,
    marginBottom: 5,
  },

  title: {
    color: "#F7F8FA",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.8,
  },

  subtitle: {
    color: "#66766F",
    fontSize: 14,
    fontWeight: "500",
    marginTop: 4,
  },

  headerIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#0E2632",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    alignItems: "center",
    justifyContent: "center",
  },

  identityCard: {
    minHeight: 88,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  identityContent: {
    flex: 1,
    minWidth: 0,
  },

  identityName: {
    color: "#F7F8FA",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
  },

  roleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  roleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#00B77A",
    marginRight: 7,
  },

  roleText: {
    color: "#66766F",
    fontSize: 13,
    fontWeight: "600",
  },

  sectionLabel: {
    color: "#66766F",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
    marginBottom: 11,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    borderRadius: 19,
    paddingHorizontal: 15,
    marginBottom: 27,
  },

  /* READ-ONLY PROFILE */

  infoRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },

  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  infoContent: {
    flex: 1,
  },

  infoLabel: {
    color: "#66766F",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },

  infoValue: {
    color: "#F7F8FA",
    fontSize: 15,
    fontWeight: "700",
  },

  editButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  editButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "800",
  },

  /* EDIT PROFILE */

  field: {
    paddingVertical: 15,
  },

  fieldLabel: {
    color: "#91A4AE",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
  },

  inputContainer: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  input: {
    flex: 1,
    color: "#F7F8FA",
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 10,
  },

  fieldDivider: {
    height: 1,
    backgroundColor: "#DDE6E2",
  },

  editActions: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 15,
  },

  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#CBD8D2",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    color: "#A6B5BD",
    fontSize: 14,
    fontWeight: "800",
  },

  saveChangesButton: {
    flex: 1.4,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  saveChangesText: {
    color: "#F7F8FA",
    fontSize: 14,
    fontWeight: "900",
  },

  /* PAYMENT METHODS */

  paymentSection: {
    marginBottom: 27,
  },

  paymentIntro: {
    color: "#66766F",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },

  paymentSummaryCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    borderRadius: 19,
    padding: 15,
    marginBottom: 12,
  },

  paymentSummaryTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  paymentIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  paymentToggleContent: {
    flex: 1,
    paddingRight: 10,
  },

  paymentToggleTitle: {
    color: "#F7F8FA",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },

  paymentToggleDescription: {
    color: "#66766F",
    fontSize: 12,
    lineHeight: 17,
  },

  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    backgroundColor: "#29404B",
    justifyContent: "center",
  },

  switchTrackEnabled: {
    backgroundColor: COLORS.primary,
  },

  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#A7B6BD",
  },

  switchThumbEnabled: {
    backgroundColor: "#F7F8FA",
    alignSelf: "flex-end",
  },

  paymentSummaryDetails: {
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    gap: 10,
  },

  paymentSummaryRow: {
    minHeight: 25,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },

  paymentSummaryValue: {
    flex: 1,
    color: "#F7F8FA",
    fontSize: 14,
    fontWeight: "700",
  },

  paymentEditAction: {
    minHeight: 47,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  paymentEditActionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  paymentEditActionText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "800",
  },

  paymentSetupAction: {
    minHeight: 44,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#DDE6E2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
  },

  paymentSetupText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "800",
  },

  paymentEditCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD8D2",
    borderRadius: 19,
    padding: 15,
    marginBottom: 12,
  },

  paymentEditHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },

  paymentBackButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  paymentEditHeaderText: {
    flex: 1,
    paddingTop: 1,
  },

  paymentEditTitle: {
    color: "#F7F8FA",
    fontSize: 17,
    fontWeight: "900",
  },

  paymentEditSubtitle: {
    color: "#66766F",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  paymentField: {
    paddingVertical: 7,
  },

  bankSelector: {
    minHeight: 64,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },

  bankSelectorContent: {
    flex: 1,
    minWidth: 0,
  },

  bankSelectorText: {
    color: "#F7F8FA",
    fontSize: 14,
    fontWeight: "800",
  },

  bankSelectorPlaceholder: {
    color: "#7B909B",
  },

  bankSelectorHint: {
    color: "#66766F",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },

  bankLogoFrame: {
    backgroundColor: "#F7F8FA",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  bankLogoFallback: {
    color: "#0A7189",
    fontSize: 10,
    fontWeight: "900",
  },

  paymentBrandLogo: {
    width: 34,
    height: 34,
  },

  paymentLogoFallback: {
    color: COLORS.primary,
    fontSize: 9,
    fontWeight: "900",
  },

  pickerOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  pickerBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.18)",
  },

  bankPickerSheet: {
    width: "100%",
    maxWidth: 360,
    maxHeight: 150,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#CBD8D2",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },

  pickerHandle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#35515E",
    alignSelf: "center",
    marginBottom: 8,
  },

  bankPickerScroll: {
    flexGrow: 0,
  },

  bankPickerScrollContent: {
    paddingBottom: 8,
  },

  pickerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  pickerTitle: {
    color: "#F7F8FA",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  pickerSubtitle: {
    color: "#66766F",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },

  pickerClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  bankLogoStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 0,
  },

  logoOnlyBankRow: {
    width: 52,
    height: 52,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
    position: "relative",
  },

  logoOnlyBankRowSelected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },

  logoSelectedDot: {
    position: "absolute",
    right: -3,
    top: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  otherLogoTile: {
    backgroundColor: "#0D2632",
  },

  compactBackButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },

  pickerBankRow: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 9,
    marginBottom: 5,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  pickerBankRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#0B2834",
  },

  pickerBankName: {
    flex: 1,
    color: "#DDE6E2",
    fontSize: 14,
    fontWeight: "700",
  },

  pickerBankNameSelected: {
    color: "#F7F8FA",
    fontWeight: "900",
  },

  selectedBankCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  otherBanksRow: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 11,
    marginTop: 2,
    backgroundColor: "#0D2632",
    borderWidth: 1,
    borderColor: "#CBD8D2",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  otherBanksIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#F0F5F3",
    alignItems: "center",
    justifyContent: "center",
  },

  otherBanksContent: {
    flex: 1,
  },

  otherBanksRowTitle: {
    color: "#F7F8FA",
    fontSize: 14,
    fontWeight: "800",
  },

  otherBanksRowSubtitle: {
    color: "#66766F",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },

  backToTopBanks: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 8,
  },

  backToTopBanksText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "800",
  },

  paymentSaveButton: {
    minHeight: 50,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  paymentSaveText: {
    color: "#F7F8FA",
    fontSize: 14,
    fontWeight: "900",
  },

  removePaymentButton: {
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#F2C8CD",
    backgroundColor: "#FFF1F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 10,
  },

  removePaymentText: {
    color: "#FF6B6B",
    fontSize: 13,
    fontWeight: "800",
  },

  addPaymentButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
  },

  addPaymentText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "800",
  },

  paymentHint: {
    marginTop: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#DDE6E2",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  paymentHintText: {
    flex: 1,
    color: "#66766F",
    fontSize: 12,
    lineHeight: 18,
  },

  /* LANGUAGE */

  languageSelector: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
  },

  languageRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
  },

  languagePressed: {
    opacity: 0.75,
  },

  languageCode: {
    width: 37,
    height: 37,
    borderRadius: 11,
    backgroundColor: "#F0F5F3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  languageCodeText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "900",
  },

  languageLabel: {
    flex: 1,
    color: "#F7F8FA",
    fontSize: 14,
    fontWeight: "700",
  },

  optionDivider: {
    height: 1,
    backgroundColor: "#DDE6E2",
  },

  radio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#66766F",
    alignItems: "center",
    justifyContent: "center",
  },

  radioSelected: {
    borderColor: COLORS.primary,
  },

  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },

  /* ACCOUNT ACTIONS */

  accountActionsCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    borderRadius: 19,
    paddingHorizontal: 15,
  },

  deleteAccountButton: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
  },

  accountSignOutButton: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
  },

  accountActionIconDanger: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#211B24",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  accountActionContent: {
    flex: 1,
    minWidth: 0,
  },

  deleteAccountText: {
    color: "#FF5B63",
    fontSize: 15,
    fontWeight: "800",
  },

  accountActionSubtitle: {
    color: "#66766F",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },

  accountActionDivider: {
    height: 1,
    backgroundColor: "#DDE6E2",
    marginLeft: 52,
  },

  deleteModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  deleteModalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#214654",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 24,
    alignItems: "center",
  },

  deleteModalIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#2A222B",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },

  deleteModalTitle: {
    color: "#F7F8FA",
    fontSize: 25,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
  },

  deleteModalDescription: {
    color: "#66766F",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    textAlign: "center",
    marginTop: 14,
  },

  deleteWarning: {
    width: "100%",
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#70532D",
    backgroundColor: "#24272A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 24,
    paddingHorizontal: 14,
  },

  deleteWarningText: {
    color: "#FFB454",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },

  deleteModalActions: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },

  deleteCancelButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD8D2",
    alignItems: "center",
    justifyContent: "center",
  },

  deleteCancelText: {
    color: "#DDE6E2",
    fontSize: 15,
    fontWeight: "800",
  },

  deleteConfirmButton: {
    flex: 1.2,
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: "#E54850",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  deleteConfirmText: {
    color: "#F7F8FA",
    fontSize: 15,
    fontWeight: "900",
  },

  /* SIGN OUT */

  signOutButton: {
    minHeight: 53,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F2C8CD",
    backgroundColor: "#FFF1F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  signOutText: {
    color: "#FF6B6B",
    fontSize: 14,
    fontWeight: "800",
  },

  buttonPressed: {
    opacity: 0.82,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  footer: {
    color: "#66766F",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 24,
  },
});