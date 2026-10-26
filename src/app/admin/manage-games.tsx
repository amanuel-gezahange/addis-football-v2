import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { COLORS } from "../../constants/colors";
import { useLanguage } from "../../i18n/LanguageContext";
import { supabase } from "../../lib/supabase";

type UserRole = "admin" | "organizer" | "player";

type Game = {
  id: number;
  title: string;
  organizer: string;
  area: string;
  distance: string | null;
  time: string;
  format: string;
  skill: string;
  price: number;
  payment_method: "free" | "venue" | "organizer";
  payment_provider: string | null;
  payment_phone: string | null;
  payment_account_name: string | null;
  spots_left: number;
  status: string;
  image_url: string | null;
  created_by: string | null;
};

export default function ManageGamesScreen() {
  const { t } = useLanguage();

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadGames();
    }, []),
  );

  async function loadGames() {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log(
        "Manage games auth error:",
        userError?.message || "No user",
      );

      setGames([]);
      setRole(null);
      setLoading(false);

      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.log("Role check error:", profileError.message);

      setGames([]);
      setRole(null);
      setLoading(false);

      return;
    }

    const userRole = profile?.role as UserRole | undefined;

    if (userRole !== "admin" && userRole !== "organizer") {
      console.log("User does not have permission to manage games.");

      setGames([]);
      setRole(userRole || "player");
      setLoading(false);

      return;
    }

    setRole(userRole);

    /*
      ADMIN:
      sees every game.

      ORGANIZER:
      sees only games where
      created_by = their user ID.
    */

    let gamesQuery = supabase.from("games").select(`
      id,
      title,
      organizer,
      area,
      distance,
      time,
      format,
      skill,
      price,
      spots_left,
      status,
      image_url,
      created_by,
      payment_method,
      payment_provider,
      payment_phone,
      payment_account_name
    `);

    if (userRole === "organizer") {
      gamesQuery = gamesQuery.eq("created_by", user.id);
    }

    const { data, error } = await gamesQuery.order("id", {
      ascending: false,
    });

    if (error) {
      console.log("Manage games error:", error.message);

      setGames([]);
      setLoading(false);

      return;
    }

    setGames((data || []) as Game[]);
    setLoading(false);
  }

  function openEditGame(game: Game) {
    router.push({
      pathname: "/admin/edit-game",
      params: {
        id: String(game.id),
      },
    });
  }

  function getSkillLabel(skill: string) {
    const normalizedSkill = skill.trim().toLowerCase();

    if (normalizedSkill === "beginner") {
      return t("discover.beginner");
    }

    if (normalizedSkill === "intermediate") {
      return t("discover.intermediate");
    }

    if (normalizedSkill === "advanced") {
      return t("discover.advanced");
    }

    return skill;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
          />

          <Text style={styles.loadingText}>
            {t("manageGames.loading")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.replace("/(tabs)/profile")}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={COLORS.primary}
          />

          <Text style={styles.backText}>
            {t("manageGames.back")}
          </Text>
        </Pressable>

        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>
              {t("manageGames.title")}
            </Text>

            <Text style={styles.subtitle}>
              {role === "admin"
                ? t("manageGames.adminSubtitle")
                : t("manageGames.organizerSubtitle")}
            </Text>
          </View>

          {(role === "admin" || role === "organizer") && (
            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.addButtonPressed,
              ]}
              onPress={() => router.push("/admin/create-game")}
            >
              <Ionicons
                name="add"
                size={25}
                color="#F7F8FA"
              />
            </Pressable>
          )}
        </View>

        {role === "admin" && (
          <View style={styles.roleBanner}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={COLORS.primary}
            />

            <Text style={styles.roleBannerText}>
              {t("manageGames.adminAccess")}
            </Text>
          </View>
        )}

        {role === "organizer" && (
          <View style={styles.roleBanner}>
            <Ionicons
              name="person-outline"
              size={18}
              color={COLORS.primary}
            />

            <Text style={styles.roleBannerText}>
              {t("manageGames.organizerAccess")}
            </Text>
          </View>
        )}

        {games.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="football-outline"
                size={34}
                color={COLORS.primary}
              />
            </View>

            <Text style={styles.emptyTitle}>
              {t("manageGames.noGames")}
            </Text>

            <Text style={styles.emptyText}>
              {role === "organizer"
                ? t("manageGames.noOrganizerGames")
                : t("manageGames.createFirstGame")}
            </Text>

            {(role === "admin" || role === "organizer") && (
              <Pressable
                style={({ pressed }) => [
                  styles.createButton,
                  pressed && styles.createButtonPressed,
                ]}
                onPress={() => router.push("/admin/create-game")}
              >
                <Text style={styles.createButtonText}>
                  {t("manageGames.createGame")}
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.gameList}>
            {games.map((game) => {
              const isCancelled = game.status === "cancelled";

              const isFull =
                !isCancelled &&
                (game.status === "full" || game.spots_left <= 0);

              const statusLabel = isCancelled
                ? t("manageGames.cancelled")
                : isFull
                  ? t("manageGames.full")
                  : t("manageGames.available");

              return (
                <View
                  key={game.id}
                  style={[
                    styles.card,
                    isCancelled && styles.cancelledCard,
                  ]}
                >
                  <View style={styles.cardTop}>
                    <View
                      style={[
                        styles.statusBadge,
                        isCancelled
                          ? styles.cancelledBadge
                          : isFull
                            ? styles.fullBadge
                            : styles.availableBadge,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          isCancelled
                            ? styles.cancelledDot
                            : isFull
                              ? styles.fullDot
                              : styles.availableDot,
                        ]}
                      />

                      <Text
                        style={[
                          styles.statusText,
                          isCancelled
                            ? styles.cancelledText
                            : isFull
                              ? styles.fullText
                              : styles.availableText,
                        ]}
                      >
                        {statusLabel}
                      </Text>
                    </View>

                    <Text style={styles.gameId}>
                      #{game.id}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.gameTitle,
                      isCancelled && styles.cancelledGameTitle,
                    ]}
                  >
                    {game.title}
                  </Text>

                  <Text style={styles.organizer}>
                    {t("manageGames.by")} {game.organizer}
                  </Text>

                  <View style={styles.infoRow}>
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color={COLORS.textSecondary}
                    />

                    <Text style={styles.infoText}>
                      {game.area}
                      {game.distance ? ` • ${game.distance}` : ""}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Ionicons
                      name="time-outline"
                      size={18}
                      color={COLORS.textSecondary}
                    />

                    <Text style={styles.infoText}>
                      {game.time}
                    </Text>
                  </View>

                  <View style={styles.detailsRow}>
                    <View style={styles.detail}>
                      <Text style={styles.detailLabel}>
                        {t("manageGames.format")}
                      </Text>

                      <Text style={styles.detailValue}>
                        {game.format}
                      </Text>
                    </View>

                    <View style={styles.detail}>
                      <Text style={styles.detailLabel}>
                        {t("manageGames.skill")}
                      </Text>

                      <Text style={styles.detailValue}>
                        {getSkillLabel(game.skill)}
                      </Text>
                    </View>

                    <View style={styles.detail}>
                      <Text style={styles.detailLabel}>
                        {t("manageGames.spots")}
                      </Text>

                      <Text style={styles.detailValue}>
                        {game.spots_left}
                      </Text>
                    </View>

                    <View style={styles.detail}>
                      <Text style={styles.detailLabel}>
                        {t("manageGames.payment")}
                      </Text>

                      <Text style={styles.detailValue}>
                        {game.payment_method === "free"
                          ? t("manageGames.free")
                          : game.payment_method === "venue"
                            ? `${t("manageGames.venue")} · ${game.price} ETB`
                            : `${
                                game.payment_provider ||
                                t("manageGames.organizer")
                              } · ${game.price} ETB`}
                      </Text>
                    </View>
                  </View>

                  {isCancelled ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.viewButton,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => openEditGame(game)}
                    >
                      <Ionicons
                        name="eye-outline"
                        size={20}
                        color={COLORS.textSecondary}
                      />

                      <Text style={styles.viewButtonText}>
                        {t("manageGames.viewCancelledGame")}
                      </Text>

                      <Ionicons
                        name="chevron-forward"
                        size={19}
                        color={COLORS.textMuted}
                      />
                    </Pressable>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [
                        styles.editButton,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => openEditGame(game)}
                    >
                      <Ionicons
                        name="create-outline"
                        size={20}
                        color={COLORS.primary}
                      />

                      <Text style={styles.editButtonText}>
                        {t("manageGames.editGame")}
                      </Text>

                      <Ionicons
                        name="chevron-forward"
                        size={19}
                        color={COLORS.textMuted}
                      />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F8FA",
  },

  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    marginTop: 14,
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingVertical: 7,
    marginBottom: 14,
  },

  backText: {
    color: "#00B77A",
    fontSize: 14,
    fontWeight: "600",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },

  headerText: {
    flex: 1,
  },

  title: {
    color: "#14201B",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.8,
  },

  subtitle: {
    color: "#66766F",
    fontSize: 14,
    marginTop: 3,
  },

  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  addButtonPressed: {
    backgroundColor: COLORS.primaryPressed,
  },

  roleBanner: {
    minHeight: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#F0F5F3",
    backgroundColor: "#F0F5F3",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 13,
    marginBottom: 20,
  },

  roleBannerText: {
    color: "#00B77A",
    fontSize: 12,
    fontWeight: "600",
  },

  emptyContainer: {
    alignItems: "center",
    paddingTop: 70,
  },

  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#F0F5F3",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "800",
    marginTop: 18,
  },

  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    marginTop: 6,
    textAlign: "center",
  },

  createButton: {
    height: 50,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
  },

  createButtonPressed: {
    backgroundColor: COLORS.primaryPressed,
  },

  createButtonText: {
    color: "#F7F8FA",
    fontSize: 15,
    fontWeight: "700",
  },

  gameList: {
    gap: 14,
  },

  card: {
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    borderRadius: 16,
    padding: 16,
  },

  cancelledCard: {
    borderColor: "#7A302B",
    backgroundColor: "#F7F8FABFA",
  },

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },

  availableBadge: {
    backgroundColor: "#F0F5F3",
  },

  fullBadge: {
    backgroundColor: "#F7F8FA3E8",
  },

  cancelledBadge: {
    backgroundColor: "#FFF1F2",
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  availableDot: {
    backgroundColor: "#00B77A",
  },

  fullDot: {
    backgroundColor: "#C13515",
  },

  cancelledDot: {
    backgroundColor: "#C13515",
  },

  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },

  availableText: {
    color: "#00B77A",
  },

  fullText: {
    color: "#C13515",
  },

  cancelledText: {
    color: "#C13515",
  },

  gameId: {
    color: "#9A9A9A",
    fontSize: 11,
    fontWeight: "600",
  },

  gameTitle: {
    color: "#14201B",
    fontSize: 19,
    fontWeight: "700",
  },

  cancelledGameTitle: {
    color: COLORS.textSecondary,
  },

  organizer: {
    color: "#66766F",
    fontSize: 14,
    marginTop: 2,
    marginBottom: 11,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 8,
  },

  infoText: {
    color: "#66766F",
    fontSize: 14,
    flexShrink: 1,
  },

  detailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#33433C",
    paddingTop: 12,
    gap: 7,
  },

  detail: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  detailLabel: {
    color: "#66766F",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },

  detailValue: {
    color: "#14201B",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },

  editButton: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDE6E2",
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 8,
  },

  editButtonText: {
    flex: 1,
    color: "#00B77A",
    fontSize: 14,
    fontWeight: "700",
  },

  viewButton: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDE6E2",
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 8,
  },

  viewButtonText: {
    flex: 1,
    color: "#66766F",
    fontSize: 14,
    fontWeight: "700",
  },

  pressed: {
    opacity: 0.75,
  },

  bottomSpace: {
    height: 28,
  },
});