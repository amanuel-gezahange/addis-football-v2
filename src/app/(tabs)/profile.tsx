import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../constants/colors";
import { useLanguage } from "../../i18n/LanguageContext";
import { supabase } from "../../lib/supabase";

export default function ProfileScreen() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 900;

  const [fullName, setFullName] = useState("");
  const [skillLevel, setSkillLevel] = useState("");
  const [role, setRole] = useState("player");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { t } = useLanguage();

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, []),
  );

  async function loadProfile() {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;

    if (!user) {
      console.log("Profile user error: No user");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, skill_level, role, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.log("Profile error:", error.message);
      setLoading(false);
      return;
    }

    if (data) {
      setFullName(data.full_name || "");
      setSkillLevel(data.skill_level || "");
      setRole(data.role || "player");
      setAvatarUrl(data.avatar_url || null);
    }

    setLoading(false);
  }

  const canManageGames =
    role === "admin" || role === "organizer";

  function skillLabel(level: string) {
    if (level === "Beginner") {
      return t("profile.beginner");
    }

    if (level === "Intermediate") {
      return t("profile.intermediate");
    }

    if (level === "Advanced") {
      return t("profile.advanced");
    }

    return level;
  }

  function profileRoleLabel() {
    if (role === "admin") {
      return t("profile.admin");
    }

    if (role === "organizer") {
      return t("profile.organizer");
    }

    return t("profile.footballPlayer");
  }

  function displayName() {
    if (fullName.trim()) {
      return fullName.trim();
    }

    return t("profile.footballPlayer");
  }

  if (loading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top"]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
          />

          <Text style={styles.loadingText}>
            {t("common.loading")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top"]}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          isDesktopWeb && styles.contentDesktop,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.pageHeader}>
          <Text style={styles.title}>
            {t("profile.title")}
          </Text>
        </View>

        {/* PLAYER IDENTITY */}
        <View style={styles.profileIdentity}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <Ionicons
                  name="person"
                  size={45}
                  color={COLORS.primary}
                />
              )}
            </View>

            <View style={styles.avatarBadge}>
              <Ionicons
                name="football"
                size={14}
                color={COLORS.white}
              />
            </View>
          </View>

          <Text
            style={styles.playerName}
            numberOfLines={1}
          >
            {displayName()}
          </Text>

          <Text style={styles.playerRole}>
            {profileRoleLabel()}
          </Text>
        </View>

        {/* SKILL LEVEL */}
        <Pressable
          style={({ pressed }) => [
            styles.skillCard,
            pressed && styles.rowPressed,
          ]}
          onPress={() =>
            router.push("/edit-profile")
          }
        >
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}>
              <Ionicons
                name="stats-chart-outline"
                size={20}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>
                {t("profile.skillLevel")}
              </Text>

              <Text style={styles.rowSubtitle}>
                {skillLevel
                  ? skillLabel(skillLevel)
                  : t("profile.notSet")}
              </Text>
            </View>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color={COLORS.textSecondary}
          />
        </Pressable>

        {/* PROFILE MENU */}
        <View style={styles.menuCard}>
          <MenuRow
            icon="person-outline"
            title={t("profile.editProfile")}
            onPress={() =>
              router.push("/edit-profile")
            }
          />

          <View style={styles.rowDivider} />

          <MenuRow
            icon="settings-outline"
            title={t("profile.settings")}
            onPress={() =>
              router.push("/settings")
            }
          />
        </View>

        {/* ADMIN / ORGANIZER TOOLS */}
        {canManageGames && (
          <>
            <Text style={styles.sectionTitle}>
              {t("profile.adminTools")}
            </Text>

            <View style={styles.adminSection}>
              <View style={styles.adminHeader}>
                <View style={styles.rowIcon}>
                  <Ionicons
                    name="shield-checkmark"
                    size={20}
                    color={COLORS.primary}
                  />
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.adminTitle}>
                    {t("profile.adminTools")}
                  </Text>

                  <Text
                    style={styles.adminSubtitle}
                  >
                    {t(
                      "profile.adminToolsSubtitle",
                    )}
                  </Text>
                </View>
              </View>

              <View style={styles.rowDivider} />

              <AdminRow
                icon="add-circle-outline"
                title={t("profile.createGame")}
                subtitle={t(
                  "profile.createGameSubtitle",
                )}
                onPress={() =>
                  router.push(
                    "/admin/create-game",
                  )
                }
              />

              <View style={styles.rowDivider} />

              <AdminRow
                icon="settings-outline"
                title={t("profile.manageGames")}
                subtitle={t(
                  "profile.manageGamesSubtitle",
                )}
                onPress={() =>
                  router.push(
                    "/admin/manage-games",
                  )
                }
              />

              <View style={styles.rowDivider} />

              <AdminRow
                icon="card-outline"
                title={t(
                  "profile.paymentRequests",
                )}
                subtitle={t(
                  "profile.paymentRequestsSubtitle",
                )}
                onPress={() =>
                  router.push(
                    "/admin/payment-requests",
                  )
                }
              />
            </View>
          </>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

type MenuRowProps = {
  icon:
    | "person-outline"
    | "settings-outline";
  title: string;
  onPress: () => void;
};

function MenuRow({
  icon,
  title,
  onPress,
}: MenuRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuRow,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>
          <Ionicons
            name={icon}
            size={20}
            color={COLORS.primary}
          />
        </View>

        <Text style={styles.menuRowTitle}>
          {title}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color={COLORS.textSecondary}
      />
    </Pressable>
  );
}

type AdminRowProps = {
  icon:
    | "add-circle-outline"
    | "settings-outline"
    | "card-outline";
  title: string;
  subtitle: string;
  onPress: () => void;
};

function AdminRow({
  icon,
  title,
  subtitle,
  onPress,
}: AdminRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.adminButton,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.rowIcon}>
        <Ionicons
          name={icon}
          size={20}
          color={COLORS.primary}
        />
      </View>

      <View style={styles.rowText}>
        <Text style={styles.adminButtonTitle}>
          {title}
        </Text>

        <Text
          style={styles.adminButtonSubtitle}
        >
          {subtitle}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color={COLORS.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },

  contentDesktop: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 24,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },

  /* HEADER */

  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  title: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.8,
  },

  /* PLAYER */

  profileIdentity: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 22,
  },

  avatarWrap: {
    position: "relative",
  },

  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
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
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },

  playerName: {
    maxWidth: "90%",
    color: COLORS.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
    letterSpacing: -0.45,
    textAlign: "center",
    marginTop: 13,
  },

  playerRole: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
  },

  /* COMMON ROWS */

  skillCard: {
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  rowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  rowText: {
    flex: 1,
    minWidth: 0,
  },

  rowIcon: {
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
    fontSize: 13,
    fontWeight: "600",
    marginTop: 3,
  },

  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginLeft: 50,
  },

  rowPressed: {
    opacity: 0.7,
  },

  /* MENU */

  menuCard: {
    marginTop: 14,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 15,
  },

  menuRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  menuRowTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },

  /* ADMIN */

  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.25,
    marginTop: 24,
    marginBottom: 10,
  },

  adminSection: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 15,
  },

  adminHeader: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  adminTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },

  adminSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  adminButton: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 9,
  },

  adminButtonTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },

  adminButtonSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  bottomSpace: {
    height: 30,
  },
});