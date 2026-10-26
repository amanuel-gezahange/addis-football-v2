import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../constants/colors";
import { useLanguage } from "../i18n/LanguageContext";
import { supabase } from "../lib/supabase";

const skillLevels = ["Beginner", "Intermediate", "Advanced"] as const;

type SkillLevel = (typeof skillLevels)[number];

export default function EditProfileScreen() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [skillLevel, setSkillLevel] = useState("");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selectedAvatarUri, setSelectedAvatarUri] = useState<string | null>(
    null,
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { t } = useLanguage();

  useEffect(() => {
    loadProfile();
  }, []);

  function skillLabel(level: SkillLevel) {
    if (level === "Beginner") {
      return t("editProfile.beginner");
    }

    if (level === "Intermediate") {
      return t("editProfile.intermediate");
    }

    return t("editProfile.advanced");
  }

  async function loadProfile() {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      if (!user) {
        Alert.alert(
          t("editProfile.error"),
          t("editProfile.notLoggedIn"),
        );
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, skill_level, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.log("Edit profile load error:", error.message);

        Alert.alert(
          t("editProfile.error"),
          t("editProfile.couldNotLoadProfile"),
        );

        return;
      }

      setFullName(data?.full_name || "");
      setPhone(data?.phone || user.phone || "");
      setSkillLevel(data?.skill_level || "");
      setAvatarUrl(data?.avatar_url || null);
    } finally {
      setLoading(false);
    }
  }

  async function handleChooseAvatar() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Photo permission required",
          "Please allow access to your photos to choose a profile picture.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      const image = result.assets[0];

      if (!image?.uri) {
        return;
      }

      setSelectedAvatarUri(image.uri);
    } catch (error) {
      console.log("Image picker error:", error);

      Alert.alert(
        t("editProfile.error"),
        "Could not select profile picture.",
      );
    }
  }

  async function uploadAvatar(
    userId: string,
    imageUri: string,
  ): Promise<string> {
    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();

    const fileExtension =
      imageUri.split(".").pop()?.toLowerCase().split("?")[0] || "jpg";

    const safeExtension =
      fileExtension === "png" ||
      fileExtension === "webp" ||
      fileExtension === "jpeg"
        ? fileExtension
        : "jpg";

    const filePath = `${userId}/avatar.${safeExtension}`;

    const contentType =
      safeExtension === "png"
        ? "image/png"
        : safeExtension === "webp"
          ? "image/webp"
          : "image/jpeg";

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    // Prevent React Native/web from showing an old cached avatar.
    return `${data.publicUrl}?v=${Date.now()}`;
  }

  async function handleSave() {
    if (!fullName.trim()) {
      Alert.alert(
        t("editProfile.nameRequired"),
        t("editProfile.nameRequiredMessage"),
      );
      return;
    }

    if (!skillLevel) {
      Alert.alert(
        t("editProfile.skillRequired"),
        t("editProfile.skillRequiredMessage"),
      );
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert(
          t("editProfile.error"),
          userError?.message || t("editProfile.notLoggedIn"),
        );
        return;
      }

      let nextAvatarUrl = avatarUrl;

      if (selectedAvatarUri) {
        try {
          nextAvatarUrl = await uploadAvatar(
            user.id,
            selectedAvatarUri,
          );
        } catch (uploadError: any) {
          console.log(
            "Avatar upload error:",
            uploadError?.message || uploadError,
          );

          Alert.alert(
            t("editProfile.error"),
            uploadError?.message ||
              "Could not upload profile picture.",
          );

          return;
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          skill_level: skillLevel,
          avatar_url: nextAvatarUrl,
        })
        .eq("id", user.id);

      if (error) {
        console.log("Profile save error:", error.message);

        Alert.alert(
          t("editProfile.couldNotSaveProfile"),
          error.message,
        );

        return;
      }

      setAvatarUrl(nextAvatarUrl);
      setSelectedAvatarUri(null);

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)/profile");
      }
    } finally {
      setSaving(false);
    }
  }

  const displayedAvatar = selectedAvatarUri || avatarUrl;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* HEADER */}
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
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
          >
            <Ionicons
              name="arrow-back"
              size={23}
              color={COLORS.text}
            />
          </Pressable>

          <Text style={styles.headerTitle}>
            {t("editProfile.title")}
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* AVATAR */}
          <View style={styles.avatarSection}>
            <Pressable
              style={({ pressed }) => [
                styles.avatarWrap,
                pressed && styles.avatarPressed,
              ]}
              onPress={handleChooseAvatar}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
            >
              <View style={styles.avatar}>
                {displayedAvatar ? (
                  <Image
                    source={{ uri: displayedAvatar }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Ionicons
                    name="person"
                    size={42}
                    color={COLORS.primary}
                  />
                )}
              </View>

              <View style={styles.avatarBadge}>
                <Ionicons
                  name="camera"
                  size={14}
                  color={COLORS.white}
                />
              </View>
            </Pressable>

            <Text style={styles.avatarText}>
              {t("editProfile.playerProfile")}
            </Text>

            <Text style={styles.avatarHint}>
              Tap photo to change
            </Text>
          </View>

          {/* PERSONAL INFORMATION */}
          <View style={styles.formCard}>
            {/* FULL NAME */}
            <View style={styles.field}>
              <View style={styles.fieldHeader}>
                <View style={styles.fieldIcon}>
                  <Ionicons
                    name="person-outline"
                    size={19}
                    color={COLORS.primary}
                  />
                </View>

                <Text style={styles.fieldLabel}>
                  {t("editProfile.fullName")}
                </Text>
              </View>

              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder={t(
                  "editProfile.fullNamePlaceholder",
                )}
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>

            <View style={styles.divider} />

            {/* PHONE */}
            <View style={styles.field}>
              <View style={styles.fieldHeader}>
                <View style={styles.fieldIcon}>
                  <Ionicons
                    name="call-outline"
                    size={19}
                    color={COLORS.primary}
                  />
                </View>

                <Text style={styles.fieldLabel}>
                  {t("editProfile.phoneNumber")}
                </Text>
              </View>

              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder={t(
                  "editProfile.phonePlaceholder",
                )}
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
                returnKeyType="done"
              />
            </View>
          </View>

          {/* SKILL LEVEL */}
          <View style={styles.skillCard}>
            <View style={styles.fieldHeader}>
              <View style={styles.fieldIcon}>
                <Ionicons
                  name="stats-chart-outline"
                  size={19}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.fieldText}>
                <Text style={styles.fieldLabel}>
                  {t("editProfile.skillLevel")}
                </Text>

                <Text style={styles.fieldDescription}>
                  {t("editProfile.skillDescription")}
                </Text>
              </View>
            </View>

            <View style={styles.skillOptions}>
              {skillLevels.map((level) => {
                const selected = skillLevel === level;

                return (
                  <Pressable
                    key={level}
                    style={({ pressed }) => [
                      styles.skillButton,
                      selected && styles.skillButtonSelected,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setSkillLevel(level)}
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                      style={[
                        styles.skillButtonText,
                        selected &&
                          styles.skillButtonTextSelected,
                      ]}
                    >
                      {skillLabel(level)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* SAVE */}
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              saving && styles.saveButtonDisabled,
              pressed &&
                !saving &&
                styles.saveButtonPressed,
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.saveButtonText}>
                {t("editProfile.saveChanges")}
              </Text>
            )}
          </Pressable>

          <View style={styles.bottomSpace} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  /* HEADER */

  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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

  content: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 22,
  },

  /* AVATAR */

  avatarSection: {
    alignItems: "center",
    marginBottom: 24,
  },

  avatarWrap: {
    position: "relative",
  },

  avatarPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },

  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
  },

  avatarBadge: {
    position: "absolute",
    right: -1,
    bottom: 1,
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 9,
  },

  avatarHint: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 3,
  },

  /* FORM */

  formCard: {
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 15,
  },

  field: {
    paddingVertical: 15,
  },

  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },

  fieldText: {
    flex: 1,
  },

  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },

  fieldLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },

  fieldDescription: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },

  input: {
    height: 48,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 13,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    color: COLORS.text,
    fontSize: 15,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
  },

  /* SKILL */

  skillCard: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
  },

  skillOptions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 15,
  },

  skillButton: {
    flex: 1,
    minHeight: 45,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },

  skillButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  skillButtonText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },

  skillButtonTextSelected: {
    color: COLORS.white,
    fontWeight: "900",
  },

  /* SAVE */

  saveButton: {
    height: 54,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },

  saveButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "900",
  },

  pressed: {
    opacity: 0.7,
  },

  bottomSpace: {
    height: 40,
  },
});