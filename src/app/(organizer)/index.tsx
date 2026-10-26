import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
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

type OrganizerStats = {
  totalGames: number;
  totalPlayers: number;
  paymentsConfirmed: number;
  upcomingGames: number;
};

export default function OrganizerDashboard() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [organizerName, setOrganizerName] = useState("");

  const [stats, setStats] = useState<OrganizerStats>({
    totalGames: 0,
    totalPlayers: 0,
    paymentsConfirmed: 0,
    upcomingGames: 0,
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
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
          .select("full_name, role")
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("organizer_applications")
          .select("organizer_name")
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

      const resolvedOrganizerName =
        profileResult.data?.full_name?.trim() ||
        applicationResult.data?.organizer_name?.trim() ||
        "";

      setOrganizerName(resolvedOrganizerName);

      const { data: games, error: gamesError } = await supabase
        .from("games")
        .select("id, starts_at")
        .eq("created_by", user.id);

      if (gamesError) {
        console.error("Error loading organizer games:", gamesError);
      }

      const organizerGames = games ?? [];
      const gameIds = organizerGames.map((game) => game.id);

      const now = new Date();

      const upcomingGames = organizerGames.filter((game) => {
        if (!game.starts_at) return false;

        return new Date(game.starts_at) >= now;
      }).length;

      let totalPlayers = 0;
      let paymentsConfirmed = 0;

      if (gameIds.length > 0) {
        const { count: playerCount, error: bookingsError } = await supabase
          .from("bookings")
          .select("*", {
            count: "exact",
            head: true,
          })
          .in("game_id", gameIds)
          .not("status", "in", "(cancelled_by_player,cancelled_by_organizer)");

        if (bookingsError) {
          console.error("Error loading organizer players:", bookingsError);
        } else {
          totalPlayers = playerCount ?? 0;
        }

        const { count: confirmedPaymentCount, error: paymentsError } =
          await supabase
            .from("payments")
            .select("*", {
              count: "exact",
              head: true,
            })
            .in("game_id", gameIds)
            .eq("status", "confirmed");

        if (paymentsError) {
          console.error("Error loading confirmed payments:", paymentsError);
        } else {
          paymentsConfirmed = confirmedPaymentCount ?? 0;
        }
      }

      setStats({
        totalGames: organizerGames.length,
        totalPlayers,
        paymentsConfirmed,
        upcomingGames,
      });
    } catch (error) {
      console.error("Error loading organizer dashboard:", error);
    } finally {
      setLoading(false);
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
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 20,
          },
        ]}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>
              {t("organizerDashboard.eyebrow")}
            </Text>

            <Text style={styles.title}>{t("organizerDashboard.title")}</Text>

            <Text style={styles.subtitle}>
              {t("organizerDashboard.subtitle")}
            </Text>
          </View>

          <View style={styles.headerIcon}>
            <Ionicons name="football" size={26} color={COLORS.primary} />
          </View>
        </View>

        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={27} color="#F7F8FA" />
          </View>

          <View style={styles.identityText}>
            <Text style={styles.organizerName}>
              {organizerName || t("organizerDashboard.organizer")}
            </Text>

            <View style={styles.roleRow}>
              <View style={styles.roleDot} />

              <Text style={styles.roleText}>
                {t("organizerDashboard.organizer")}
              </Text>
            </View>
          </View>

          <Ionicons name="shield-checkmark" size={22} color={COLORS.primary} />
        </View>

        <Text style={styles.sectionLabel}>
          {t("organizerDashboard.overview")}
        </Text>

        <View style={styles.statsGrid}>
          <StatCard
            icon="football-outline"
            value={stats.totalGames}
            label={t("organizerDashboard.totalGames")}
          />

          <StatCard
            icon="people-outline"
            value={stats.totalPlayers}
            label={t("organizerDashboard.totalPlayers")}
          />

          <StatCard
            icon="checkmark-circle-outline"
            value={stats.paymentsConfirmed}
            label={t("organizerDashboard.paymentsConfirmed")}
          />

          <StatCard
            icon="calendar-outline"
            value={stats.upcomingGames}
            label={t("organizerDashboard.upcomingGames")}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.createButton,
            pressed && styles.createButtonPressed,
          ]}
          onPress={() => {
            router.push("/organizer/create-game");
          }}
        >
          <View style={styles.createIcon}>
            <Ionicons name="add" size={23} color="#F7F8FA" />
          </View>

          <Text style={styles.createButtonText}>
            {t("organizerDashboard.createNewGame")}
          </Text>

          <Ionicons name="chevron-forward" size={21} color="#F7F8FA" />
        </Pressable>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              {t("organizerDashboard.upcomingGamesTitle")}
            </Text>

            <Text style={styles.sectionSubtitle}>
              {t("organizerDashboard.upcomingGamesSubtitle")}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              router.push("/(organizer)/games");
            }}
            hitSlop={10}
          >
            <Text style={styles.viewAll}>
              {t("organizerDashboard.viewAll")}
            </Text>
          </Pressable>
        </View>

        {stats.upcomingGames === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="football-outline"
                size={29}
                color={COLORS.primary}
              />
            </View>

            <Text style={styles.emptyTitle}>
              {t("organizerDashboard.noUpcomingGames")}
            </Text>

            <Text style={styles.emptyText}>
              {t("organizerDashboard.noUpcomingGamesDescription")}
            </Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.gamesSummaryCard,
              pressed && styles.cardPressed,
            ]}
            onPress={() => {
              router.push("/(organizer)/games");
            }}
          >
            <View style={styles.gamesSummaryIcon}>
              <Ionicons name="calendar" size={24} color={COLORS.primary} />
            </View>

            <View style={styles.gamesSummaryContent}>
              <Text style={styles.gamesSummaryTitle}>
                {stats.upcomingGames === 1
                  ? t("organizerDashboard.upcomingGame")
                  : `${stats.upcomingGames} ${t(
                      "organizerDashboard.upcomingGamesCount",
                    )}`}
              </Text>

              <Text style={styles.gamesSummaryText}>
                {t("organizerDashboard.viewManageSchedule")}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={22} color="#66766F" />
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={21} color={COLORS.primary} />
      </View>

      <Text style={styles.statValue}>{value}</Text>

      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
    marginBottom: 22,
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
    marginTop: 3,
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
    marginBottom: 27,
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

  identityText: {
    flex: 1,
  },

  organizerName: {
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
    letterSpacing: 1.4,
    marginBottom: 12,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  statCard: {
    width: "48.5%",
    minHeight: 126,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
  },

  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#F0F5F3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  statValue: {
    color: "#F7F8FA",
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 30,
  },

  statLabel: {
    color: "#8FA3AE",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },

  createButton: {
    minHeight: 58,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
  },

  createButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },

  createIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "rgba(7,19,29,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  createButtonText: {
    flex: 1,
    color: "#F7F8FA",
    fontSize: 15,
    fontWeight: "900",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 13,
  },

  sectionTitle: {
    color: "#F7F8FA",
    fontSize: 20,
    fontWeight: "900",
  },

  sectionSubtitle: {
    color: "#66766F",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
  },

  viewAll: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "800",
  },

  emptyCard: {
    minHeight: 180,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DDE6E2",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: "#F0F5F3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  emptyTitle: {
    color: "#F7F8FA",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },

  emptyText: {
    maxWidth: 280,
    color: "#66766F",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },

  gamesSummaryCard: {
    minHeight: 82,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDE6E2",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },

  cardPressed: {
    opacity: 0.85,
  },

  gamesSummaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#F0F5F3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  gamesSummaryContent: {
    flex: 1,
  },

  gamesSummaryTitle: {
    color: "#F7F8FA",
    fontSize: 15,
    fontWeight: "800",
  },

  gamesSummaryText: {
    color: "#7F949F",
    fontSize: 12,
    marginTop: 4,
  },
});
