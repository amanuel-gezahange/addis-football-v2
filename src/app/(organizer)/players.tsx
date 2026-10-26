import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
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

type PlayerBooking = {
  id: number;
  user_id: string;
  game_id: number;
  status: string | null;
  payment_status: string | null;
  created_at: string | null;
};

type OrganizerGame = {
  id: number;
  title: string | null;
  starts_at: string | null;
  status: string | null;
  payment_method: string | null;
  payment_provider: string | null;
};

type PlayerProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  skill_level: string | null;
};

type OrganizerPayment = {
  id: number;
  booking_id: number | null;
  amount: number;
  provider: string | null;
  status: string;
  player_reference: string | null;
  refund_status: string | null;
};

type PlayerRow = {
  bookingId: number;
  userId: string;
  gameId: number;

  playerName: string;
  phone: string | null;
  skillLevel: string | null;

  bookingStatus: string | null;
  paymentStatus: string | null;

  gameTitle: string;
  gameStartsAt: string | null;

  paymentMethod: string | null;
  paymentProvider: string | null;

  paymentId: number | null;
  paymentAmount: number | null;
  paymentReference: string | null;
};

type RefundRow = {
  bookingId: number;
  userId: string;
  gameId: number;

  playerName: string;
  phone: string | null;

  gameTitle: string;

  paymentId: number;
  paymentAmount: number;
  paymentProvider: string | null;
};

type Tab = "active" | "refunds";

export default function OrganizerPlayers() {
  const insets = useSafeAreaInsets();
  const { language, t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("active");

  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);

  const [confirmingBookingId, setConfirmingBookingId] = useState<number | null>(
    null,
  );

  const [rejectingBookingId, setRejectingBookingId] = useState<number | null>(
    null,
  );

  const [refundingPaymentId, setRefundingPaymentId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    loadPlayers();
  }, []);

  async function loadPlayers(showFullScreenLoader = true) {
    try {
      if (showFullScreenLoader) {
        setLoading(true);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      // --------------------------------
      // 1. Organizer's games
      // --------------------------------

      const { data: gamesData, error: gamesError } = await supabase
        .from("games")
        .select(
          `
            id,
            title,
            starts_at,
            status,
            payment_method,
            payment_provider
          `,
        )
        .eq("created_by", user.id)
        .order("starts_at", {
          ascending: false,
        });

      if (gamesError) {
        console.error("Error loading organizer games:", gamesError);
        return;
      }

      const games = (gamesData ?? []) as OrganizerGame[];

      if (games.length === 0) {
        setPlayers([]);
        setRefunds([]);
        return;
      }

      const gameIds = games.map((game) => game.id);

      const gameMap = new Map(games.map((game) => [Number(game.id), game]));

      // --------------------------------
      // 2. Active bookings
      // --------------------------------

      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select(
          `
            id,
            user_id,
            game_id,
            status,
            payment_status,
            created_at
          `,
        )
        .in("game_id", gameIds)
        .not("status", "in", "(cancelled_by_player,cancelled_by_organizer)")
        .order("created_at", {
          ascending: false,
        });

      if (bookingsError) {
        console.error("Error loading organizer bookings:", bookingsError);
        return;
      }

      const bookings = (bookingsData ?? []) as PlayerBooking[];

      // --------------------------------
      // 3. Refund-pending bookings
      // --------------------------------

      const { data: refundBookingsData, error: refundBookingsError } =
        await supabase
          .from("bookings")
          .select(
            `
              id,
              user_id,
              game_id,
              status,
              payment_status,
              created_at
            `,
          )
          .in("game_id", gameIds)
          .eq("status", "cancelled_by_organizer")
          .eq("payment_status", "refund_pending")
          .order("created_at", {
            ascending: false,
          });

      if (refundBookingsError) {
        console.error(
          "Error loading organizer refund bookings:",
          refundBookingsError,
        );
        return;
      }

      const refundBookings = (refundBookingsData ?? []) as PlayerBooking[];

      // --------------------------------
      // 4. Profiles
      // --------------------------------

      const allUserIds = [
        ...new Set(
          [...bookings, ...refundBookings]
            .map((booking) => booking.user_id)
            .filter(Boolean),
        ),
      ];

      let profiles: PlayerProfile[] = [];

      if (allUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select(
            `
              id,
              full_name,
              phone,
              skill_level
            `,
          )
          .in("id", allUserIds);

        if (profilesError) {
          console.error("Error loading player profiles:", profilesError);
        }

        profiles = (profilesData ?? []) as PlayerProfile[];
      }

      const profileMap = new Map(
        profiles.map((profile) => [profile.id, profile]),
      );

      // --------------------------------
      // 5. Payments
      // --------------------------------

      const allBookingIds = [
        ...new Set(
          [...bookings, ...refundBookings].map((booking) => booking.id),
        ),
      ];

      let payments: OrganizerPayment[] = [];

      if (allBookingIds.length > 0) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("payments")
          .select(
            `
              id,
              booking_id,
              amount,
              provider,
              status,
              player_reference,
              refund_status
            `,
          )
          .in("booking_id", allBookingIds)
          .order("id", {
            ascending: false,
          });

        if (paymentsError) {
          console.error("Error loading organizer payments:", paymentsError);
        }

        payments = (paymentsData ?? []) as OrganizerPayment[];
      }

      const paymentMap = new Map<number, OrganizerPayment>();

      payments.forEach((payment) => {
        if (
          payment.booking_id !== null &&
          !paymentMap.has(payment.booking_id)
        ) {
          paymentMap.set(payment.booking_id, payment);
        }
      });

      // --------------------------------
      // 6. Build active rows
      // --------------------------------

      const rows: PlayerRow[] = bookings.map((booking) => {
        const profile = profileMap.get(booking.user_id);
        const game = gameMap.get(Number(booking.game_id));
        const payment = paymentMap.get(booking.id);

        return {
          bookingId: booking.id,
          userId: booking.user_id,
          gameId: Number(booking.game_id),

          playerName:
            profile?.full_name?.trim() || t("organizerPlayers.player"),

          phone: profile?.phone ?? null,
          skillLevel: profile?.skill_level ?? null,

          bookingStatus: booking.status,
          paymentStatus: booking.payment_status,

          gameTitle: game?.title || t("organizerPlayers.footballGame"),

          gameStartsAt: game?.starts_at ?? null,

          paymentMethod: game?.payment_method ?? null,

          paymentProvider: payment?.provider ?? game?.payment_provider ?? null,

          paymentId: payment?.id ?? null,
          paymentAmount: payment?.amount ?? null,
          paymentReference: payment?.player_reference ?? null,
        };
      });

      // --------------------------------
      // 7. Build refund rows
      // --------------------------------

      const refundRows: RefundRow[] = refundBookings
        .map((booking) => {
          const profile = profileMap.get(booking.user_id);
          const game = gameMap.get(Number(booking.game_id));
          const payment = paymentMap.get(booking.id);

          if (
            !game ||
            game.status !== "cancelled" ||
            game.payment_method !== "organizer" ||
            booking.status !== "cancelled_by_organizer" ||
            booking.payment_status !== "refund_pending" ||
            !payment ||
            payment.refund_status !== "pending"
          ) {
            return null;
          }

          return {
            bookingId: booking.id,
            userId: booking.user_id,
            gameId: Number(booking.game_id),

            playerName:
              profile?.full_name?.trim() || t("organizerPlayers.player"),

            phone: profile?.phone ?? null,

            gameTitle: game.title || t("organizerPlayers.footballGame"),

            paymentId: payment.id,
            paymentAmount: payment.amount,

            paymentProvider: payment.provider ?? game.payment_provider ?? null,
          };
        })
        .filter((row): row is RefundRow => row !== null);

      setPlayers(rows);
      setRefunds(refundRows);
    } catch (error) {
      console.error("Error loading organizer players:", error);
    } finally {
      if (showFullScreenLoader) {
        setLoading(false);
      }
    }
  }

  // --------------------------------
  // Confirm payment
  // --------------------------------

  async function confirmPayment(bookingId: number) {
    if (confirmingBookingId !== null || rejectingBookingId !== null || refundingPaymentId !== null) {
      return;
    }

    try {
      setConfirmingBookingId(bookingId);

      const { data, error } = await supabase.rpc("confirm_organizer_payment", {
        p_booking_id: bookingId,
      });

      if (error) {
        console.error("Error confirming payment:", error);
        return;
      }

      console.log("Payment confirmed:", data);

      await loadPlayers(false);
    } catch (error) {
      console.error("Error confirming payment:", error);
    } finally {
      setConfirmingBookingId(null);
    }
  }

  // --------------------------------
  // Payment not received
  // --------------------------------

  function requestRejectPayment(player: PlayerRow) {
    if (
      confirmingBookingId !== null ||
      rejectingBookingId !== null ||
      refundingPaymentId !== null
    ) {
      return;
    }

    const title = "Payment not received";
    const message = `Cancel ${player.playerName}'s booking because you could not verify their payment?

Their spot will be released.`;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const confirmed = window.confirm(`${title}\n\n${message}`);

      if (confirmed) {
        void rejectPayment(player.bookingId);
      }

      return;
    }

    Alert.alert(title, message, [
      {
        text: "Keep booking",
        style: "cancel",
      },
      {
        text: "Cancel booking",
        style: "destructive",
        onPress: () => {
          void rejectPayment(player.bookingId);
        },
      },
    ]);
  }

  async function rejectPayment(bookingId: number) {
    if (
      confirmingBookingId !== null ||
      rejectingBookingId !== null ||
      refundingPaymentId !== null
    ) {
      return;
    }

    try {
      setRejectingBookingId(bookingId);

      const { data, error } = await supabase.rpc("reject_organizer_payment", {
        p_booking_id: bookingId,
      });

      if (error) {
        console.error("Error rejecting organizer payment:", error);
        showMessage("Could not cancel booking", error.message);
        return;
      }

      console.log("Organizer payment rejected:", data);

      await loadPlayers(false);
    } catch (error) {
      console.error("Error rejecting organizer payment:", error);

      showMessage(
        "Could not cancel booking",
        error instanceof Error ? error.message : "",
      );
    } finally {
      setRejectingBookingId(null);
    }
  }

  // --------------------------------
  // Refund
  // --------------------------------

  function requestMarkRefunded(refund: RefundRow) {
    if (refundingPaymentId !== null || confirmingBookingId !== null || rejectingBookingId !== null) {
      return;
    }

    const message = `${t("organizerPlayers.confirmRefundMessage")}

${refund.paymentAmount} ETB${
      refund.paymentProvider ? ` · ${refund.paymentProvider}` : ""
    }`;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const confirmed = window.confirm(
        `${t("organizerPlayers.confirmRefundTitle")}\n\n${message}`,
      );

      if (confirmed) {
        void markRefunded(refund.paymentId);
      }

      return;
    }

    Alert.alert(t("organizerPlayers.confirmRefundTitle"), message, [
      {
        text: t("organizerPlayers.keepPending"),
        style: "cancel",
      },
      {
        text: t("organizerPlayers.confirmRefund"),
        style: "destructive",
        onPress: () => {
          void markRefunded(refund.paymentId);
        },
      },
    ]);
  }

  async function markRefunded(paymentId: number) {
    if (refundingPaymentId !== null || confirmingBookingId !== null || rejectingBookingId !== null) {
      return;
    }

    try {
      setRefundingPaymentId(paymentId);

      const { data, error } = await supabase.rpc(
        "mark_organizer_payment_refunded",
        {
          p_payment_id: paymentId,
        },
      );

      if (error) {
        console.error("Error recording organizer refund:", error);

        showMessage(t("organizerPlayers.refundFailed"), error.message);

        return;
      }

      console.log("Organizer refund recorded:", data);

      await loadPlayers(false);
    } catch (error) {
      console.error("Error recording organizer refund:", error);

      showMessage(
        t("organizerPlayers.refundFailed"),
        error instanceof Error ? error.message : "",
      );
    } finally {
      setRefundingPaymentId(null);
    }
  }

  function showMessage(title: string, message: string) {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(`${title}\n\n${message}`);
      return;
    }

    Alert.alert(title, message);
  }

  // --------------------------------
  // Derived
  // --------------------------------

  const pendingPlayers = useMemo(() => {
    return players.filter(
      (player) =>
        player.bookingStatus === "pending_payment" &&
        player.paymentStatus === "submitted",
    );
  }, [players]);

  const confirmedPlayers = useMemo(() => {
    return players.filter(
      (player) =>
        !(
          player.bookingStatus === "pending_payment" &&
          player.paymentStatus === "submitted"
        ),
    );
  }, [players]);

  const orderedPlayers = useMemo(() => {
    return [...pendingPlayers, ...confirmedPlayers];
  }, [pendingPlayers, confirmedPlayers]);

  function formatDate(value: string | null) {
    if (!value) {
      return t("organizerPlayers.dateNotSet");
    }

    const locale =
      language === "am" ? "am-ET" : language === "om" ? "om-ET" : "en-US";

    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  }

  function getInitial(name: string) {
    const trimmed = name.trim();

    if (!trimmed) {
      return "P";
    }

    return trimmed.charAt(0).toUpperCase();
  }

  function isPaymentPending(player: PlayerRow) {
    return (
      player.bookingStatus === "pending_payment" &&
      player.paymentStatus === "submitted"
    );
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
        {/* HEADER */}

        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>
              {t("organizerPlayers.eyebrow")}
            </Text>

            <Text style={styles.title}>
              {t("organizerPlayers.title")}
            </Text>

            <Text style={styles.subtitle}>
              {t("organizerPlayers.subtitle")}
            </Text>
          </View>

          <View style={styles.headerIcon}>
            <Ionicons name="people" size={24} color={COLORS.primary} />
          </View>
        </View>

        {/* TABS */}

        <View style={styles.tabs}>
          <Pressable
            onPress={() => setActiveTab("active")}
            style={[
              styles.tab,
              activeTab === "active" && styles.activeTab,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "active" && styles.activeTabText,
              ]}
            >
              Active
            </Text>

            {pendingPlayers.length > 0 && (
              <View style={styles.tabAttentionDot} />
            )}
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("refunds")}
            style={[
              styles.tab,
              activeTab === "refunds" && styles.activeTab,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "refunds" && styles.activeTabText,
              ]}
            >
              Refunds
            </Text>

            {refunds.length > 0 && (
              <View style={styles.tabCount}>
                <Text style={styles.tabCountText}>{refunds.length}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* ACTIVE */}

        {activeTab === "active" && (
          <View style={styles.tabContent}>
            {orderedPlayers.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name="people-outline"
                    size={25}
                    color="#66766F"
                  />
                </View>

                <Text style={styles.emptyTitle}>No active players</Text>

                <Text style={styles.emptyText}>
                  Players who join your games will appear here.
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {orderedPlayers.map((player) => {
                  const pending = isPaymentPending(player);
                  const confirming =
                    confirmingBookingId === player.bookingId;
                  const rejecting =
                    rejectingBookingId === player.bookingId;

                  return (
                    <View
                      key={player.bookingId}
                      style={styles.playerCard}
                    >
                      <View style={styles.playerTop}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {getInitial(player.playerName)}
                          </Text>
                        </View>

                        <View style={styles.playerInfo}>
                          <Text
                            style={styles.playerName}
                            numberOfLines={1}
                          >
                            {player.playerName}
                          </Text>

                          <Text
                            style={styles.gameTitle}
                            numberOfLines={1}
                          >
                            {player.gameTitle}
                          </Text>

                          <View style={styles.metaRow}>
                            <Ionicons
                              name="calendar-outline"
                              size={13}
                              color="#66766F"
                            />

                            <Text style={styles.metaText}>
                              {formatDate(player.gameStartsAt)}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={[
                            styles.statusBadge,
                            pending
                              ? styles.pendingStatus
                              : styles.bookedStatus,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              pending
                                ? styles.pendingStatusText
                                : styles.bookedStatusText,
                            ]}
                          >
                            {pending
                              ? t("organizerPlayers.pending")
                              : player.bookingStatus === "waitlisted"
                                ? t("organizerPlayers.waitlist")
                                : t("organizerPlayers.booked")}
                          </Text>
                        </View>
                      </View>

                      {pending && (
                        <>
                          <View style={styles.divider} />

                          <View style={styles.paymentRow}>
                            <View style={styles.paymentCopy}>
                              <Text style={styles.paymentAmount}>
                                {player.paymentAmount ?? 0} ETB
                                {player.paymentProvider
                                  ? ` · ${player.paymentProvider}`
                                  : ""}
                              </Text>

                              {player.paymentReference && (
                                <Text
                                  style={styles.paymentReference}
                                  numberOfLines={1}
                                >
                                  {t("organizerPlayers.reference")}:{" "}
                                  {player.paymentReference}
                                </Text>
                              )}

                              {player.phone && (
                                <Text style={styles.phoneText}>
                                  {player.phone}
                                </Text>
                              )}
                            </View>
                          </View>

                          <View style={styles.paymentActions}>
                            <Pressable
                              disabled={
                                confirmingBookingId !== null ||
                                rejectingBookingId !== null ||
                                refundingPaymentId !== null
                              }
                              onPress={() =>
                                confirmPayment(player.bookingId)
                              }
                              style={({ pressed }) => [
                                styles.primaryButton,
                                styles.paymentActionButton,
                                pressed && styles.buttonPressed,
                                (confirmingBookingId !== null ||
                                  rejectingBookingId !== null ||
                                  refundingPaymentId !== null) &&
                                  styles.buttonDisabled,
                              ]}
                            >
                              {confirming ? (
                                <ActivityIndicator
                                  size="small"
                                  color="#F7F8FA"
                                />
                              ) : (
                                <>
                                  <Ionicons
                                    name="checkmark"
                                    size={19}
                                    color="#F7F8FA"
                                  />

                                  <Text style={styles.primaryButtonText}>
                                    {t("organizerPlayers.confirmPayment")}
                                  </Text>
                                </>
                              )}
                            </Pressable>

                            <Pressable
                              disabled={
                                confirmingBookingId !== null ||
                                rejectingBookingId !== null ||
                                refundingPaymentId !== null
                              }
                              onPress={() => requestRejectPayment(player)}
                              style={({ pressed }) => [
                                styles.rejectButton,
                                styles.paymentActionButton,
                                pressed && styles.buttonPressed,
                                (confirmingBookingId !== null ||
                                  rejectingBookingId !== null ||
                                  refundingPaymentId !== null) &&
                                  styles.buttonDisabled,
                              ]}
                            >
                              {rejecting ? (
                                <ActivityIndicator
                                  size="small"
                                  color="#FF9A9A"
                                />
                              ) : (
                                <>
                                  <Ionicons
                                    name="close"
                                    size={18}
                                    color="#FF9A9A"
                                  />

                                  <Text style={styles.rejectButtonText}>
                                    Payment not received
                                  </Text>
                                </>
                              )}
                            </Pressable>
                          </View>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* REFUNDS */}

        {activeTab === "refunds" && (
          <View style={styles.tabContent}>
            {refunds.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name="return-down-back-outline"
                    size={25}
                    color="#66766F"
                  />
                </View>

                <Text style={styles.emptyTitle}>
                  No pending refunds
                </Text>

                <Text style={styles.emptyText}>
                  Refunds that require your action will appear here.
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {refunds.map((refund) => {
                  const refunding =
                    refundingPaymentId === refund.paymentId;

                  return (
                    <View
                      key={refund.paymentId}
                      style={styles.playerCard}
                    >
                      <View style={styles.playerTop}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {getInitial(refund.playerName)}
                          </Text>
                        </View>

                        <View style={styles.playerInfo}>
                          <Text
                            style={styles.playerName}
                            numberOfLines={1}
                          >
                            {refund.playerName}
                          </Text>

                          <Text
                            style={styles.gameTitle}
                            numberOfLines={1}
                          >
                            {refund.gameTitle}
                          </Text>

                          {refund.phone && (
                            <View style={styles.metaRow}>
                              <Ionicons
                                name="call-outline"
                                size={13}
                                color="#66766F"
                              />

                              <Text style={styles.metaText}>
                                {refund.phone}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View
                          style={[
                            styles.statusBadge,
                            styles.pendingStatus,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              styles.pendingStatusText,
                            ]}
                          >
                            {t("organizerPlayers.pending")}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.divider} />

                      <Text style={styles.refundAmount}>
                        {refund.paymentAmount} ETB
                        {refund.paymentProvider
                          ? ` · ${refund.paymentProvider}`
                          : ""}
                      </Text>

                      <Pressable
                        disabled={
                          refundingPaymentId !== null ||
                          confirmingBookingId !== null ||
                          rejectingBookingId !== null
                        }
                        onPress={() =>
                          requestMarkRefunded(refund)
                        }
                        style={({ pressed }) => [
                          styles.secondaryButton,
                          pressed && styles.buttonPressed,
                          (refundingPaymentId !== null ||
                            confirmingBookingId !== null) &&
                            styles.buttonDisabled,
                        ]}
                      >
                        {refunding ? (
                          <ActivityIndicator
                            size="small"
                            color="#F7F8FA"
                          />
                        ) : (
                          <>
                            <Ionicons
                              name="checkmark"
                              size={18}
                              color="#F7F8FA"
                            />

                            <Text style={styles.secondaryButtonText}>
                              {t(
                                "organizerPlayers.markAsRefunded",
                              )}
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* REFRESH */}

        {(players.length > 0 || refunds.length > 0) && (
          <Pressable
            onPress={() => loadPlayers()}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons
              name="refresh"
              size={17}
              color="#66766F"
            />

            <Text style={styles.refreshText}>
              {t("organizerPlayers.refreshPlayers")}
            </Text>
          </Pressable>
        )}
      </ScrollView>
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
    paddingBottom: 38,
  },

  // Header

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  headerCopy: {
    flex: 1,
    paddingRight: 16,
  },

  eyebrow: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
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
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    alignItems: "center",
    justifyContent: "center",
  },

  // Tabs

  tabs: {
    height: 48,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 4,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#173540",
    marginBottom: 22,
  },

  tab: {
    flex: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },

  activeTab: {
    backgroundColor: "#EEF4F1",
  },

  tabText: {
    color: "#66766F",
    fontSize: 13,
    fontWeight: "700",
  },

  activeTabText: {
    color: "#F7F8FA",
  },

  tabCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  tabCountText: {
    color: "#F7F8FA",
    fontSize: 10,
    fontWeight: "900",
  },

  tabAttentionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },

  tabContent: {
    minHeight: 220,
  },

  list: {
    gap: 10,
  },

  // Player cards

  playerCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    borderRadius: 16,
    padding: 14,
  },

  playerTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "#EEF4F1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  avatarText: {
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: "900",
  },

  playerInfo: {
    flex: 1,
    minWidth: 0,
  },

  playerName: {
    color: "#F7F8FA",
    fontSize: 15,
    fontWeight: "800",
  },

  gameTitle: {
    color: "#91A3AC",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },

  metaText: {
    color: "#66766F",
    fontSize: 11,
    fontWeight: "500",
  },

  // Status

  statusBadge: {
    marginLeft: 10,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  pendingStatus: {
    backgroundColor: "#172832",
  },

  bookedStatus: {
    backgroundColor: "#142A27",
  },

  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },

  pendingStatusText: {
    color: "#A7BAC3",
  },

  bookedStatusText: {
    color: "#75CFA8",
  },

  divider: {
    height: 1,
    backgroundColor: "#DDE6E2",
    marginVertical: 13,
  },

  // Payment

  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  paymentCopy: {
    flex: 1,
  },

  paymentAmount: {
    color: "#F7F8FA",
    fontSize: 14,
    fontWeight: "800",
  },

  paymentReference: {
    color: "#66766F",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
  },

  phoneText: {
    color: "#66766F",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
  },

  refundAmount: {
    color: "#F7F8FA",
    fontSize: 15,
    fontWeight: "800",
  },

  // Buttons

  primaryButton: {
    minHeight: 45,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    marginTop: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  primaryButtonText: {
    color: "#F7F8FA",
    fontSize: 13,
    fontWeight: "900",
  },

  secondaryButton: {
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: "#EEF4F1",
    borderWidth: 1,
    borderColor: "#234756",
    marginTop: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  secondaryButtonText: {
    color: "#F7F8FA",
    fontSize: 13,
    fontWeight: "800",
  },

  paymentActions: {
    marginTop: 13,
    gap: 9,
  },

  paymentActionButton: {
    marginTop: 0,
  },

  rejectButton: {
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: "#241A1D",
    borderWidth: 1,
    borderColor: "#563039",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  rejectButtonText: {
    color: "#FF9A9A",
    fontSize: 13,
    fontWeight: "800",
  },

  buttonPressed: {
    opacity: 0.82,
  },

  buttonDisabled: {
    opacity: 0.55,
  },

  // Empty

  emptyState: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  emptyTitle: {
    color: "#F7F8FA",
    fontSize: 15,
    fontWeight: "800",
  },

  emptyText: {
    color: "#66766F",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 5,
  },

  // Refresh

  refreshButton: {
    minHeight: 44,
    marginTop: 24,
    alignSelf: "center",
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  refreshText: {
    color: "#66766F",
    fontSize: 12,
    fontWeight: "700",
  },
});