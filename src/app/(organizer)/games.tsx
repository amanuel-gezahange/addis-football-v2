import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS } from "../../constants/colors";
import { useLanguage } from "../../i18n/LanguageContext";
import { supabase } from "../../lib/supabase";

type FilterType = "upcoming" | "past" | "cancelled";

type OrganizerGame = {
  id: number;
  title: string | null;
  area: string | null;
  time: string | null;
  starts_at: string | null;
  spots_left: number | null;
  status: string | null;
};

type GameWithPlayers = OrganizerGame & {
  playerCount: number;
};

export default function OrganizerGames() {
  const insets = useSafeAreaInsets();
  const { language, t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] =
    useState<FilterType>("upcoming");
  const [games, setGames] =
    useState<GameWithPlayers[]>([]);

  useEffect(() => {
    loadGames();
  }, []);

  async function loadGames() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("games")
        .select(
          `
          id,
          title,
          area,
          time,
          starts_at,
          spots_left,
          status
          `,
        )
        .eq("created_by", user.id)
        .order("starts_at", {
          ascending: true,
        });

      if (error) {
        console.error(
          "Error loading organizer games:",
          error
        );
        return;
      }

      const organizerGames =
        (data ?? []) as OrganizerGame[];

      if (organizerGames.length === 0) {
        setGames([]);
        return;
      }

      const gameIds = organizerGames.map(
        (game) => game.id
      );

      const {
        data: bookings,
        error: bookingsError,
      } = await supabase
        .from("bookings")
        .select("game_id, status")
        .in("game_id", gameIds)
        .not(
          "status",
          "in",
          "(cancelled_by_player,cancelled_by_organizer)"
        );

      if (bookingsError) {
        console.error(
          "Error loading game players:",
          bookingsError
        );
      }

      const playerCounts = new Map<
        number,
        number
      >();

      for (const booking of bookings ?? []) {
        const gameId = Number(booking.game_id);

        playerCounts.set(
          gameId,
          (playerCounts.get(gameId) ?? 0) + 1
        );
      }

      const gamesWithPlayers =
        organizerGames.map((game) => ({
          ...game,
          playerCount:
            playerCounts.get(Number(game.id)) ??
            0,
        }));

      setGames(gamesWithPlayers);
    } catch (error) {
      console.error(
        "Error loading organizer games:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredGames = useMemo(() => {
    const now = new Date();

    return games.filter((game) => {
      const status = (
        game.status ?? ""
      ).toLowerCase();

      const isCancelled =
        status === "cancelled";

      if (filter === "cancelled") {
        return isCancelled;
      }

      if (isCancelled) {
        return false;
      }

      if (!game.starts_at) {
        return filter === "upcoming";
      }

      const start = new Date(game.starts_at);

      if (filter === "upcoming") {
        return start >= now;
      }

      return start < now;
    });
  }, [games, filter]);

  function getLocale() {
    if (language === "am") {
      return "am-ET";
    }

    if (language === "om") {
      return "om-ET";
    }

    return "en-US";
  }

  function formatDate(startsAt: string | null) {
    if (!startsAt) {
      return t("organizerGames.dateNotSet");
    }

    const date = new Date(startsAt);

    return new Intl.DateTimeFormat(
      getLocale(),
      {
        weekday: "short",
        month: "short",
        day: "numeric",
      }
    ).format(date);
  }

  function formatTime(game: OrganizerGame) {
    if (game.time?.trim()) {
      return game.time;
    }

    if (!game.starts_at) {
      return t("organizerGames.timeNotSet");
    }

    return new Intl.DateTimeFormat(
      getLocale(),
      {
        hour: "numeric",
        minute: "2-digit",
      }
    ).format(new Date(game.starts_at));
  }

  function getResultLabel() {
    if (filter === "upcoming") {
      return t(
        "organizerGames.upcomingGames"
      );
    }

    if (filter === "past") {
      return t("organizerGames.pastGames");
    }

    return t(
      "organizerGames.cancelledGames"
    );
  }

  function getEmptyTitle() {
    if (filter === "upcoming") {
      return t(
        "organizerGames.noUpcomingGames"
      );
    }

    if (filter === "past") {
      return t("organizerGames.noPastGames");
    }

    return t(
      "organizerGames.noCancelledGames"
    );
  }

  function getStatusLabel() {
    if (filter === "cancelled") {
      return t("organizerGames.cancelled");
    }

    if (filter === "past") {
      return t("organizerGames.completed");
    }

    return t("organizerGames.upcoming");
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 20,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>
              {t("organizerGames.eyebrow")}
            </Text>

            <Text style={styles.title}>
              {t("organizerGames.title")}
            </Text>

            <Text style={styles.subtitle}>
              {t("organizerGames.subtitle")}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.pressed,
            ]}
            onPress={() =>
              router.push(
                "/organizer/create-game"
              )
            }
          >
            <Ionicons
              name="add"
              size={28}
              color="#F7F8FA"
            />
          </Pressable>
        </View>

        <View style={styles.tabs}>
          <FilterButton
            label={t(
              "organizerGames.upcoming"
            )}
            active={filter === "upcoming"}
            onPress={() =>
              setFilter("upcoming")
            }
          />

          <FilterButton
            label={t("organizerGames.past")}
            active={filter === "past"}
            onPress={() => setFilter("past")}
          />

          <FilterButton
            label={t(
              "organizerGames.cancelled"
            )}
            active={filter === "cancelled"}
            onPress={() =>
              setFilter("cancelled")
            }
          />
        </View>

        <View style={styles.resultHeader}>
          <Text style={styles.resultLabel}>
            {getResultLabel()}
          </Text>

          <Text style={styles.resultCount}>
            {filteredGames.length}
          </Text>
        </View>

        {filteredGames.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="football-outline"
                size={31}
                color={COLORS.primary}
              />
            </View>

            <Text style={styles.emptyTitle}>
              {getEmptyTitle()}
            </Text>

            <Text style={styles.emptyText}>
              {filter === "upcoming"
                ? t(
                    "organizerGames.createFirstGame"
                  )
                : t(
                    "organizerGames.gamesAppearHere"
                  )}
            </Text>

            {filter === "upcoming" && (
              <Pressable
                style={({ pressed }) => [
                  styles.emptyButton,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  router.push(
                    "/organizer/create-game"
                  )
                }
              >
                <Ionicons
                  name="add"
                  size={19}
                  color="#F7F8FA"
                />

                <Text
                  style={
                    styles.emptyButtonText
                  }
                >
                  {t(
                    "organizerGames.createGame"
                  )}
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.gameList}>
            {filteredGames.map((game) => (
              <Pressable
                key={game.id}
                style={({ pressed }) => [
                  styles.gameCard,
                  pressed &&
                    styles.cardPressed,
                ]}
                onPress={() => {
                  router.push({
                    pathname:
                      "/organizer/edit-game",
                    params: {
                      id: String(game.id),
                    },
                  });
                }}
              >
                <View style={styles.gameTop}>
                  <View style={styles.gameIcon}>
                    <Ionicons
                      name="football"
                      size={24}
                      color={COLORS.primary}
                    />
                  </View>

                  <View style={styles.gameMain}>
                    <Text
                      style={styles.gameTitle}
                      numberOfLines={1}
                    >
                      {game.title ||
                        t(
                          "organizerGames.footballGame"
                        )}
                    </Text>

                    <View
                      style={styles.statusRow}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          filter ===
                            "cancelled" &&
                            styles.cancelledDot,
                        ]}
                      />

                      <Text
                        style={[
                          styles.statusText,
                          filter ===
                            "cancelled" &&
                            styles.cancelledText,
                        ]}
                      >
                        {getStatusLabel()}
                      </Text>
                    </View>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={21}
                    color="#66766F"
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.detailRow}>
                  <View
                    style={styles.detailItem}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={17}
                      color="#66766F"
                    />

                    <Text
                      style={styles.detailText}
                    >
                      {formatDate(
                        game.starts_at
                      )}
                    </Text>
                  </View>

                  <View
                    style={styles.detailItem}
                  >
                    <Ionicons
                      name="time-outline"
                      size={17}
                      color="#66766F"
                    />

                    <Text
                      style={styles.detailText}
                    >
                      {formatTime(game)}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <View
                    style={styles.detailItem}
                  >
                    <Ionicons
                      name="location-outline"
                      size={17}
                      color="#66766F"
                    />

                    <Text
                      style={styles.detailText}
                      numberOfLines={1}
                    >
                      {game.area ||
                        t(
                          "organizerGames.locationNotSet"
                        )}
                    </Text>
                  </View>

                  <View
                    style={styles.playerPill}
                  >
                    <Ionicons
                      name="people"
                      size={15}
                      color={COLORS.primary}
                    />

                    <Text
                      style={
                        styles.playerPillText
                      }
                    >
                      {game.playerCount}{" "}
                      {game.playerCount === 1
                        ? t(
                            "organizerGames.player"
                          )
                        : t(
                            "organizerGames.players"
                          )}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function FilterButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterButton,
        active && styles.filterButtonActive,
      ]}
    >
      <Text
        style={[
          styles.filterText,
          active && styles.filterTextActive,
        ]}
      >
        {label}
      </Text>
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
    marginBottom: 24,
  },

  headerText: {
    flex: 1,
    paddingRight: 16,
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
    lineHeight: 20,
    marginTop: 4,
  },

  addButton: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  pressed: {
    opacity: 0.85,
  },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    borderRadius: 15,
    padding: 4,
    marginBottom: 26,
  },

  filterButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },

  filterText: {
    color: "#8297A2",
    fontSize: 13,
    fontWeight: "700",
  },

  filterTextActive: {
    color: "#F7F8FA",
    fontWeight: "900",
  },

  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  resultLabel: {
    flex: 1,
    color: "#66766F",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
  },

  resultCount: {
    color: "#8DA1AC",
    fontSize: 12,
    fontWeight: "800",
  },

  gameList: {
    gap: 12,
  },

  gameCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    borderRadius: 19,
    padding: 15,
  },

  cardPressed: {
    opacity: 0.82,
    transform: [
      {
        scale: 0.995,
      },
    ],
  },

  gameTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  gameIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#F0F5F3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  gameMain: {
    flex: 1,
  },

  gameTitle: {
    color: "#F7F8FA",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#00B77A",
    marginRight: 6,
  },

  cancelledDot: {
    backgroundColor: "#FF5D5D",
  },

  statusText: {
    color: "#55D99B",
    fontSize: 11,
    fontWeight: "700",
  },

  cancelledText: {
    color: "#FF7777",
  },

  divider: {
    height: 1,
    backgroundColor: "#DDE6E2",
    marginVertical: 13,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
    gap: 14,
  },

  detailItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  detailText: {
    flexShrink: 1,
    color: "#66766F",
    fontSize: 12,
    fontWeight: "600",
  },

  playerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0F5F3",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },

  playerPillText: {
    color: "#B8C7CE",
    fontSize: 11,
    fontWeight: "700",
  },

  emptyCard: {
    minHeight: 245,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: 26,
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#F0F5F3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  emptyTitle: {
    color: "#F7F8FA",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 7,
  },

  emptyText: {
    color: "#66766F",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 290,
  },

  emptyButton: {
    minHeight: 44,
    marginTop: 18,
    paddingHorizontal: 17,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  emptyButtonText: {
    color: "#F7F8FA",
    fontSize: 13,
    fontWeight: "900",
  },
});