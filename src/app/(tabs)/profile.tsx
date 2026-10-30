import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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

import { AppColors } from "../../constants/colors";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../i18n/LanguageContext";
import { supabase } from "../../lib/supabase";

type ProfileCache = {
  fullName: string;
  skillLevel: string;
  role: string;
  avatarUrl: string | null;
};

type ConversationSummaryRow = {
  unread_count: number | null;
};

const profileCache: Record<string, ProfileCache> = {};
const unreadMessagesCache: Record<string, number> = {};

export default function ProfileScreen() {
  const { width } = useWindowDimensions();

  const { colors, isDark, toggleTheme } = useTheme();

  const styles = useMemo(() => createStyles(colors), [colors]);

  const isDesktopWeb = Platform.OS === "web" && width >= 900;

  const isSmallPhone = width < 380;

  const [fullName, setFullName] = useState("");
  const [skillLevel, setSkillLevel] = useState("");
  const [role, setRole] = useState("player");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [unreadMessages, setUnreadMessages] = useState(0);

  const [loading, setLoading] = useState(true);

  const { t } = useLanguage();

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
      void loadUnreadMessages();
    }, []),
  );

  async function loadProfile() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;

    if (!user) {
      console.log("Profile user error: No user");

      setFullName("");
      setSkillLevel("");
      setRole("player");
      setAvatarUrl(null);
      setLoading(false);

      return;
    }

    const cachedProfile = profileCache[user.id];

    if (cachedProfile) {
      setFullName(cachedProfile.fullName);
      setSkillLevel(cachedProfile.skillLevel);
      setRole(cachedProfile.role);
      setAvatarUrl(cachedProfile.avatarUrl);
      setLoading(false);
    } else {
      setLoading(true);
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
      const nextProfile: ProfileCache = {
        fullName: data.full_name || "",
        skillLevel: data.skill_level || "",
        role: data.role || "player",
        avatarUrl: data.avatar_url || null,
      };

      profileCache[user.id] = nextProfile;

      setFullName(nextProfile.fullName);
      setSkillLevel(nextProfile.skillLevel);
      setRole(nextProfile.role);
      setAvatarUrl(nextProfile.avatarUrl);
    }

    setLoading(false);
  }

  async function loadUnreadMessages() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setUnreadMessages(0);
      return;
    }

    if (Object.prototype.hasOwnProperty.call(unreadMessagesCache, user.id)) {
      setUnreadMessages(unreadMessagesCache[user.id]);
    }

    const { data, error } = await supabase.rpc(
      "get_community_conversation_summaries",
    );

    if (error) {
      console.log("Profile unread messages error:", error.message);

      return;
    }

    const rows = (data ?? []) as ConversationSummaryRow[];

    const nextUnreadCount = rows.reduce(
      (total, row) => total + Number(row.unread_count ?? 0),
      0,
    );

    unreadMessagesCache[user.id] = nextUnreadCount;

    setUnreadMessages(nextUnreadCount);
  }

  const canManageGames = role === "admin" || role === "organizer";

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

  function unreadMessagesLabel() {
    if (unreadMessages <= 0) {
      return "Your conversations";
    }

    if (unreadMessages === 1) {
      return "1 unread message";
    }

    return `${unreadMessages} unread messages`;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />

          <Text style={styles.loadingText}>{t("common.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
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
          <Text style={styles.title}>{t("profile.title")}</Text>

          <Pressable
            onPress={() => {
              void toggleTheme();
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={
              isDark ? "Switch to light mode" : "Switch to dark mode"
            }
            style={({ pressed }) => [
              styles.themeButton,
              pressed && styles.rowPressed,
            ]}
          >
            <Ionicons
              name={isDark ? "sunny-outline" : "moon-outline"}
              size={20}
              color={colors.text}
            />
          </Pressable>
        </View>

        {/* PLAYER IDENTITY */}
        <View style={styles.profileIdentity}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={45} color={colors.primary} />
              )}
            </View>

            <View style={styles.avatarBadge}>
              <Ionicons name="football" size={14} color={colors.white} />
            </View>
          </View>

          <Text style={styles.playerName} numberOfLines={1}>
            {displayName()}
          </Text>

          <Text style={styles.playerRole}>{profileRoleLabel()}</Text>
        </View>

        {/* MESSAGES */}
        <Pressable
          style={({ pressed }) => [
            styles.skillCard,
            unreadMessages > 0 && styles.messageRowUnread,
            pressed && styles.rowPressed,
          ]}
          onPress={() => router.push("/messages")}
        >
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={21}
                color={colors.primary}
              />
            </View>

            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Messages</Text>

              <Text
                style={[
                  styles.rowSubtitle,
                  unreadMessages > 0 && styles.messageSubtitleUnread,
                ]}
              >
                {unreadMessagesLabel()}
              </Text>
            </View>
          </View>

          <View style={styles.messageRowRight}>
            {unreadMessages > 0 && (
              <View style={styles.unreadMessagesBadge}>
                <Text style={styles.unreadMessagesBadgeText}>
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </Text>
              </View>
            )}

            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textSecondary}
            />
          </View>
        </Pressable>

        {/* SKILL LEVEL */}
        <Pressable
          style={({ pressed }) => [
            styles.skillCard,
            pressed && styles.rowPressed,
          ]}
          onPress={() => router.push("/edit-profile")}
        >
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}>
              <Ionicons
                name="stats-chart-outline"
                size={20}
                color={colors.primary}
              />
            </View>

            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{t("profile.skillLevel")}</Text>

              <Text style={styles.rowSubtitle}>
                {skillLevel ? skillLabel(skillLevel) : t("profile.notSet")}
              </Text>
            </View>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textSecondary}
          />
        </Pressable>

        {/* PROFILE MENU */}
        <View style={styles.menuCard}>
          <MenuRow
            icon="person-outline"
            title={t("profile.editProfile")}
            onPress={() => router.push("/edit-profile")}
            colors={colors}
            styles={styles}
          />

          <View style={styles.rowDivider} />

          <MenuRow
            icon="settings-outline"
            title={t("profile.settings")}
            onPress={() => router.push("/settings")}
            colors={colors}
            styles={styles}
          />
        </View>

        {/* ADMIN / ORGANIZER TOOLS */}
        {canManageGames && (
          <>
            <Text style={styles.sectionTitle}>{t("profile.adminTools")}</Text>

            <View style={styles.adminSection}>
              <View style={styles.adminHeader}>
                <View style={styles.rowIcon}>
                  <Ionicons
                    name="shield-checkmark"
                    size={20}
                    color={colors.primary}
                  />
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.adminTitle}>
                    {t("profile.adminTools")}
                  </Text>

                  <Text style={styles.adminSubtitle}>
                    {t("profile.adminToolsSubtitle")}
                  </Text>
                </View>
              </View>

              <View style={styles.rowDivider} />

              <AdminRow
                icon="add-circle-outline"
                title={t("profile.createGame")}
                subtitle={t("profile.createGameSubtitle")}
                onPress={() => router.push("/admin/create-game")}
                colors={colors}
                styles={styles}
              />

              <View style={styles.rowDivider} />

              <AdminRow
                icon="settings-outline"
                title={t("profile.manageGames")}
                subtitle={t("profile.manageGamesSubtitle")}
                onPress={() => router.push("/admin/manage-games")}
                colors={colors}
                styles={styles}
              />

              <View style={styles.rowDivider} />

              <AdminRow
                icon="card-outline"
                title={t("profile.paymentRequests")}
                subtitle={t("profile.paymentRequestsSubtitle")}
                onPress={() => router.push("/admin/payment-requests")}
                colors={colors}
                styles={styles}
              />
            </View>
          </>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

type ProfileStyles = ReturnType<typeof createStyles>;

type MenuRowProps = {
  icon: "person-outline" | "settings-outline";
  title: string;
  onPress: () => void;
  colors: AppColors;
  styles: ProfileStyles;
};

function MenuRow({ icon, title, onPress, colors, styles }: MenuRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>

        <Text style={styles.menuRowTitle}>{title}</Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

type AdminRowProps = {
  icon: "add-circle-outline" | "settings-outline" | "card-outline";
  title: string;
  subtitle: string;
  onPress: () => void;
  colors: AppColors;
  styles: ProfileStyles;
};

function AdminRow({
  icon,
  title,
  subtitle,
  onPress,
  colors,
  styles,
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
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>

      <View style={styles.rowText}>
        <Text style={styles.adminButtonTitle}>{title}</Text>

        <Text style={styles.adminButtonSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    /* SOCIAL SHORTCUTS */

    socialShortcuts: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 14,
    },

    socialShortcutsSmall: {
      flexDirection: "column",
    },

    socialShortcutCard: {
      flex: 1,
      minWidth: 0,
      minHeight: 112,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 15,
    },

    socialShortcutCardUnread: {
      borderColor: colors.primary,
    },

    socialShortcutTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },

    socialShortcutIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },

    messageTopRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },

    unreadMessagesBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },

    unreadMessagesBadgeText: {
      color: colors.white,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
    },

    socialShortcutTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
    },

    socialShortcutTitleUnread: {
      fontWeight: "900",
    },

    socialShortcutSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 4,
    },

    socialShortcutSubtitleUnread: {
      color: colors.primary,
      fontWeight: "700",
    },

    /* PAGE */

    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },

    container: {
      flex: 1,
      backgroundColor: colors.background,
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
    messageRowRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },

    messageRowUnread: {
      borderColor: colors.primary,
    },

    messageSubtitleUnread: {
      color: colors.primary,
      fontWeight: "700",
    },

    loadingContainer: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
    },

    loadingText: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 12,
    },

    /* HEADER */

    pageHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    title: {
      color: colors.text,
      fontSize: 32,
      fontWeight: "900",
      letterSpacing: -0.8,
    },

    themeButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.surfaceAlt,
      borderWidth: 2,
      borderColor: colors.primary,
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
      backgroundColor: colors.primary,
      borderWidth: 3,
      borderColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
    },

    playerName: {
      maxWidth: "90%",
      color: colors.text,
      fontSize: 24,
      lineHeight: 29,
      fontWeight: "900",
      letterSpacing: -0.45,
      textAlign: "center",
      marginTop: 13,
    },

    playerRole: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 3,
    },

    /* COMMON ROWS */

    skillCard: {
      minHeight: 72,
      marginBottom: 12,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },

    rowTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
    },

    rowSubtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
      marginTop: 3,
    },

    rowDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: 50,
    },

    rowPressed: {
      opacity: 0.7,
    },

    /* MENU */

    menuCard: {
      marginTop: 0,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 15,
    },

    menuRow: {
      minHeight: 62,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    menuRowTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },

    /* ADMIN */

    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
      letterSpacing: -0.25,
      marginTop: 24,
      marginBottom: 10,
    },

    adminSection: {
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 15,
    },

    adminHeader: {
      minHeight: 68,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },

    adminTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
    },

    adminSubtitle: {
      color: colors.textSecondary,
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
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
    },

    adminButtonSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 3,
    },

    bottomSpace: {
      height: 30,
    },
  });