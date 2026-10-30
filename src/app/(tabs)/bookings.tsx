import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Calendar } from "react-native-calendars";
import {
  ActivityIndicator,
  Keyboard,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { COLORS } from "../../constants/colors";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../i18n/LanguageContext";
import { supabase } from "../../lib/supabase";
import HorizontalGameCard from "../../components/HorizontalGameCard";

type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "waitlisted"
  | "cancelled_by_player"
  | "cancelled_by_organizer";

type PaymentStatus =
  | "not_required"
  | "pending"
  | "submitted"
  | "paid"
  | "failed"
  | "refund_pending"
  | "refunded"
  | null;

type PaymentMethod = "free" | "venue" | "organizer";

type BookingSection = "upcoming" | "history";

type BookingSort = "upcoming" | "latest";

type BookingFilter = "all" | "confirmed" | "payment_required" | "waitlisted";

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
  spots_left: number;
  capacity: number | null;
  image_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  payment_method: PaymentMethod;
  payment_provider: string | null;
  payment_phone: string | null;
  payment_account_name: string | null;
};

type Booking = {
  id: number;
  status: BookingStatus;
  quantity: number;
  price_paid: number | null;
  payment_status: PaymentStatus;
  payment_offer_expires_at: string | null;
  created_at: string;
  games: Game | null;
};

type Translate = (key: string) => string;

let bookingsCache: Booking[] | null = null;

/* ============================================================
   BOOKING HELPERS
   ============================================================ */

function isCancelledBooking(booking: Booking) {
  return (
    booking.status === "cancelled_by_player" ||
    booking.status === "cancelled_by_organizer"
  );
}

function getBookingEndTime(booking: Booking) {
  const game = booking.games;

  if (!game?.starts_at) {
    return 0;
  }

  return new Date(game.ends_at ?? game.starts_at).getTime();
}

function isHistoryBooking(booking: Booking, now: number) {
  return isCancelledBooking(booking) || getBookingEndTime(booking) < now;
}

function matchesBookingFilter(booking: Booking, filter: BookingFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "confirmed") {
    return booking.status === "confirmed";
  }

  if (filter === "waitlisted") {
    return booking.status === "waitlisted";
  }

  if (filter === "payment_required") {
    return (
      booking.status === "pending_payment" &&
      booking.payment_status === "pending"
    );
  }

  return true;
}

function getBookingStatus(
  booking: Booking,
  t: Translate,
): {
  label: string;
  icon:
    | "checkmark-circle"
    | "time-outline"
    | "close-circle-outline"
    | "card-outline"
    | "location-outline";
  tone: "success" | "warning" | "danger" | "neutral";
} {
  const game = booking.games;

  if (booking.status === "cancelled_by_organizer") {
    return {
      label: "Cancelled by organizer",
      icon: "close-circle-outline",
      tone: "danger",
    };
  }

  if (booking.status === "cancelled_by_player") {
    return {
      label: "Cancelled by you",
      icon: "close-circle-outline",
      tone: "neutral",
    };
  }

  if (
    booking.status === "pending_payment" &&
    booking.payment_status === "submitted"
  ) {
    return {
      label: "Payment sent",
      icon: "time-outline",
      tone: "warning",
    };
  }

  if (
    booking.status === "pending_payment" &&
    booking.payment_status === "pending"
  ) {
    return {
      label: t("bookings.paymentRequired"),
      icon: "card-outline",
      tone: "warning",
    };
  }

  if (booking.status === "waitlisted") {
    return {
      label: t("bookings.waitlisted"),
      icon: "time-outline",
      tone: "warning",
    };
  }

  if (booking.payment_status === "refund_pending") {
    return {
      label: "Refund pending",
      icon: "time-outline",
      tone: "warning",
    };
  }

  if (booking.payment_status === "refunded") {
    return {
      label: "Refunded",
      icon: "checkmark-circle",
      tone: "neutral",
    };
  }

  if (game?.payment_method === "venue" && booking.status === "confirmed") {
    return {
      label: t("bookings.payAtVenue"),
      icon: "location-outline",
      tone: "success",
    };
  }

  return {
    label: t("bookings.confirmed"),
    icon: "checkmark-circle",
    tone: "success",
  };
}

/* ============================================================
   BOOKING CARD
   ============================================================ */

type BookingCardProps = {
  booking: Booking;
  dateLocale: string;
  t: Translate;
  history: boolean;
  cancelling: boolean;
  submitting: boolean;
  onCancel: (booking: Booking) => void;
  onSubmitPayment: (booking: Booking) => void;
  onCallOrganizer: (phone: string | null) => void;
};

const BookingCard = memo(function BookingCard({
  booking,
  dateLocale,
  t,
  history,
  cancelling,
  submitting,
  onCancel,
  onSubmitPayment,
  onCallOrganizer,
}: BookingCardProps) {
  const game = booking.games;

  if (!game) {
    return null;
  }

  const bookingQuantity = Math.max(Number(booking.quantity ?? 1), 1);

  const bookingTotal =
    booking.price_paid !== null && booking.price_paid !== undefined
      ? Number(booking.price_paid)
      : Number(game.price ?? 0) * bookingQuantity;

  const cancelled = isCancelledBooking(booking);
  const status = getBookingStatus(booking, t);

  const organizerPayment = game.payment_method === "organizer";

  const paymentRequired =
    organizerPayment &&
    booking.status === "pending_payment" &&
    booking.payment_status === "pending";

  const sharedCardGame = {
    id: game.id,
    title: game.title,
    area: game.area,
    time: game.time,
    price: bookingTotal,
    spotsLeft: game.spots_left,
    capacity: game.capacity,
    status:
      game.status === "full" || game.spots_left <= 0
        ? ("full" as const)
        : ("available" as const),
    starts_at: game.starts_at,
    ends_at: game.ends_at,
    image_url: game.image_url,
    payment_method: game.payment_method,
    payment_provider: game.payment_provider,
    payment_phone: game.payment_phone,
    payment_account_name: game.payment_account_name,
  };

  function openGame() {
    if (!cancelled) {
      router.push(`/game/${game.id}`);
    }
  }

  const bookingStatusContent = (
    <View
      style={[
        styles.bookingCardStatus,
        status.tone === "warning" && styles.bookingCardStatusWarning,
        status.tone === "danger" && styles.bookingCardStatusDanger,
        status.tone === "neutral" && styles.bookingCardStatusNeutral,
      ]}
    >
      <Ionicons
        name={status.icon}
        size={16}
        color={
          status.tone === "warning"
            ? "#9A6700"
            : status.tone === "danger"
              ? COLORS.danger
              : status.tone === "neutral"
                ? COLORS.textSecondary
                : COLORS.white
        }
      />

      <Text
        numberOfLines={1}
        style={[
          styles.bookingCardStatusText,
          status.tone === "warning" && styles.bookingCardStatusTextWarning,
          status.tone === "danger" && styles.bookingCardStatusTextDanger,
          status.tone === "neutral" && styles.bookingCardStatusTextNeutral,
        ]}
      >
        {status.label}
      </Text>
    </View>
  );

  return (
    <View
      style={[
        styles.bookingCardWrapper,
        cancelled && styles.bookingCardWrapperCancelled,
      ]}
    >
      <HorizontalGameCard
        game={sharedCardGame}
        onPress={openGame}
        formatDate={(timestamp) =>
          formatCompactAddisDate(timestamp, dateLocale)
        }
        mode="booking"
        bottomContent={bookingStatusContent}
      />

      {paymentRequired && (
        <View style={styles.paymentBox}>
          <View style={styles.paymentBoxHeader}>
            <View style={styles.paymentIcon}>
              <Ionicons name="wallet-outline" size={18} color="#9A6700" />
            </View>

            <View style={styles.paymentHeaderText}>
              <Text style={styles.paymentTitle}>
                {t("bookings.paymentRequired")}
              </Text>

              <Text style={styles.paymentDescription}>
                Pay the organizer, then confirm that you sent the payment.
              </Text>
            </View>
          </View>

          {(game.payment_provider ||
            game.payment_account_name ||
            game.payment_phone) && (
            <View style={styles.paymentDetails}>
              {!!game.payment_provider && (
                <PaymentDetailRow
                  label="Payment"
                  value={game.payment_provider}
                />
              )}

              {!!game.payment_account_name && (
                <PaymentDetailRow
                  label="Account"
                  value={game.payment_account_name}
                />
              )}

              {!!game.payment_phone && (
                <PaymentDetailRow
                  label="Phone"
                  value={game.payment_phone}
                  last
                />
              )}
            </View>
          )}

          <View style={styles.paymentActions}>
            {!!game.payment_phone && (
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryAction,
                  pressed && styles.actionPressed,
                ]}
                onPress={() => {
                  onCallOrganizer(game.payment_phone);
                }}
              >
                <Ionicons
                  name="call-outline"
                  size={17}
                  color={COLORS.primary}
                />

                <Text style={styles.secondaryActionText}>Call</Text>
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.primaryAction,
                pressed && styles.actionPressed,
                submitting && styles.actionDisabled,
              ]}
              disabled={submitting}
              onPress={() => {
                onSubmitPayment(booking);
              }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color={COLORS.white}
                  />

                  <Text style={styles.primaryActionText}>I've paid</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {booking.payment_status === "refund_pending" && (
        <View style={styles.waitingBox}>
          <Ionicons name="time-outline" size={19} color="#9A6700" />

          <View style={styles.waitingContent}>
            <Text style={styles.waitingTitle}>Refund pending</Text>

            <Text style={styles.waitingText}>
              Your refund is still being processed.
            </Text>
          </View>
        </View>
      )}

      {booking.payment_status === "refunded" && (
        <View style={styles.refundedBox}>
          <Ionicons name="checkmark-circle" size={19} color={COLORS.primary} />

          <Text style={styles.refundedText}>Refund completed</Text>
        </View>
      )}
    </View>
  );
});

function PaymentDetailRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={[styles.paymentDetailRow, !last && styles.paymentDetailBorder]}
    >
      <Text style={styles.paymentDetailLabel}>{label}</Text>

      <Text style={styles.paymentDetailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/* ============================================================
   MAIN SCREEN
   ============================================================ */

export default function BookingsScreen() {
  const { language, t } = useLanguage();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isDesktopWeb = Platform.OS === "web" && width >= 900;

  const dateLocale =
    language === "am"
      ? "am-ET-u-ca-gregory"
      : language === "om"
        ? "om-ET-u-ca-gregory"
        : "en-US-u-ca-gregory";

  const [bookings, setBookings] = useState<Booking[]>(
    () => bookingsCache ?? [],
  );

  const [loading, setLoading] = useState(bookingsCache === null);

  const [refreshing, setRefreshing] = useState(false);

  const [activeSection, setActiveSection] =
    useState<BookingSection>("upcoming");

  const [search, setSearch] = useState("");

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [bookingSortBy, setBookingSortBy] = useState<BookingSort>("upcoming");

  const [bookingStatusFilter, setBookingStatusFilter] =
    useState<BookingFilter>("all");

  const [calendarVisible, setCalendarVisible] = useState(false);

  const [bookingFilterVisible, setBookingFilterVisible] = useState(false);

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const [submittingId, setSubmittingId] = useState<number | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timer = setTimeout(() => {
      setSuccessMessage(null);
    }, 2500);

    return () => clearTimeout(timer);
  }, [successMessage]);

  /* ==========================================================
     FETCH + CACHE
     ========================================================== */

  const fetchBookings = useCallback(
    async (options?: { showLoading?: boolean; refresh?: boolean }) => {
      const showLoading = options?.showLoading ?? false;
      const refresh = options?.refresh ?? false;

      if (showLoading && bookingsCache === null) {
        setLoading(true);
      }

      if (refresh) {
        setRefreshing(true);
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const user = session?.user;
        console.log("----------------->CURRENT BOOKING USER:", user?.id);

        if (!user) {
          bookingsCache = [];
          setBookings([]);
          return;
        }

        const { data, error } = await supabase
          .from("bookings")
          .select(
            `
            id,
            status,
            quantity,
            price_paid,
            payment_status,
            payment_offer_expires_at,
            created_at,
            games (
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
              capacity,
              image_url,
              starts_at,
              ends_at,
              status,
              payment_method,
              payment_provider,
              payment_phone,
              payment_account_name
            )
          `,
          )
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          });

        if (error) {
          throw error;
        }

        const nextBookings = (data ?? []) as unknown as Booking[];

        // Always replace both the in-memory cache and screen state
        // with the latest data returned by Supabase.
        bookingsCache = nextBookings;
        setBookings([...nextBookings]);
      } catch (error: any) {
        console.log("Bookings error:", error?.message ?? error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchBookings({
        showLoading: bookingsCache === null,
      });
    }, [fetchBookings]),
  );

  /* ==========================================================
     UPCOMING / HISTORY COUNTS
     ========================================================== */

  const sectionCounts = useMemo(() => {
    const now = Date.now();

    let upcoming = 0;
    let history = 0;

    for (const booking of bookings) {
      if (!booking.games?.starts_at) {
        continue;
      }

      if (isHistoryBooking(booking, now)) {
        history += 1;
      } else {
        upcoming += 1;
      }
    }

    return {
      upcoming,
      history,
    };
  }, [bookings]);

  /* ==========================================================
     SEARCH + FILTER + SORT
     ========================================================== */

  const visibleBookings = useMemo(() => {
    const now = Date.now();

    const query = search.trim().toLocaleLowerCase();

    const filtered = bookings.filter((booking) => {
      const game = booking.games;

      if (!game?.starts_at) {
        return false;
      }

      const history = isHistoryBooking(booking, now);

      if (activeSection === "upcoming" && history) {
        return false;
      }

      if (activeSection === "history" && !history) {
        return false;
      }

      if (selectedDate && getAddisDateKey(game.starts_at) !== selectedDate) {
        return false;
      }

      if (!matchesBookingFilter(booking, bookingStatusFilter)) {
        return false;
      }

      if (!query) {
        return true;
      }

      const title = (game.title ?? "").toLocaleLowerCase();

      const area = (game.area ?? "").toLocaleLowerCase();

      const organizer = (game.organizer ?? "").toLocaleLowerCase();

      return (
        title.includes(query) ||
        area.includes(query) ||
        organizer.includes(query)
      );
    });

    return filtered.sort((a, b) => {
      if (query) {
        const aTitle = (a.games?.title ?? "").toLocaleLowerCase();

        const bTitle = (b.games?.title ?? "").toLocaleLowerCase();

        const aArea = (a.games?.area ?? "").toLocaleLowerCase();

        const bArea = (b.games?.area ?? "").toLocaleLowerCase();

        const rank = (title: string, area: string) => {
          if (title.startsWith(query)) {
            return 0;
          }

          if (area.startsWith(query)) {
            return 1;
          }

          if (title.includes(query)) {
            return 2;
          }

          if (area.includes(query)) {
            return 3;
          }

          return 4;
        };

        const rankDifference = rank(aTitle, aArea) - rank(bTitle, bArea);

        if (rankDifference !== 0) {
          return rankDifference;
        }
      }

      const aTime = a.games?.starts_at
        ? new Date(a.games.starts_at).getTime()
        : 0;

      const bTime = b.games?.starts_at
        ? new Date(b.games.starts_at).getTime()
        : 0;

      if (activeSection === "history") {
        return bTime - aTime;
      }

      return bookingSortBy === "latest" ? bTime - aTime : aTime - bTime;
    });
  }, [
    activeSection,
    bookingSortBy,
    bookingStatusFilter,
    bookings,
    search,
    selectedDate,
  ]);

  /* ==========================================================
     ORGANIZER PAYMENT
     ========================================================== */

  const submitOrganizerPayment = useCallback(
    async (booking: Booking) => {
      if (
        !booking.games ||
        booking.games.payment_method !== "organizer" ||
        booking.status !== "pending_payment" ||
        booking.payment_status !== "pending" ||
        submittingId !== null
      ) {
        return;
      }

      setSubmittingId(booking.id);

      try {
        const { data, error } = await supabase.rpc("submit_organizer_payment", {
          p_booking_id: booking.id,
          p_player_reference: null,
        });

        if (error) {
          throw error;
        }

        if (!data?.success) {
          throw new Error(t("bookings.paymentCouldNotBeSubmitted"));
        }

        setSuccessMessage("Payment submitted");

        await fetchBookings();
      } catch (error: any) {
        console.log("Submit organizer payment error:", error?.message ?? error);

        if (Platform.OS === "web") {
          window.alert(error?.message || t("bookings.couldNotSubmitPayment"));
        }
      } finally {
        setSubmittingId(null);
      }
    },
    [fetchBookings, submittingId, t],
  );

  /* ==========================================================
     CANCELLATION
     ========================================================== */

  const openCancellationModal = useCallback((booking: Booking) => {
    if (booking.status !== "confirmed" && booking.status !== "waitlisted") {
      return;
    }

    const isPaidOrganizerBooking =
      booking.status === "confirmed" &&
      booking.games?.payment_method === "organizer" &&
      booking.payment_status === "paid";

    if (isPaidOrganizerBooking) {
      if (booking.games?.id) {
        router.push(`/game/${booking.games.id}`);
      }

      return;
    }

    setErrorMessage(null);
    setSelectedBooking(booking);
  }, []);

  const closeCancellationModal = useCallback(() => {
    if (cancellingId !== null) {
      return;
    }

    setSelectedBooking(null);
    setErrorMessage(null);
  }, [cancellingId]);

  const cancelSelectedBooking = useCallback(async () => {
    if (!selectedBooking?.games || cancellingId !== null) {
      return;
    }

    const booking = selectedBooking;
    const game = booking.games;

    if (!game) {
      return;
    }

    const isPaidOrganizerBooking =
      booking.status === "confirmed" &&
      game.payment_method === "organizer" &&
      booking.payment_status === "paid";

    // Paid organizer bookings must be handled through the organizer.
    // Never automatically cancel them from the Bookings page.
    if (isPaidOrganizerBooking) {
      setSelectedBooking(null);
      setErrorMessage(null);

      router.push(`/game/${game.id}`);
      return;
    }

    const wasWaitlisted = booking.status === "waitlisted";

    if (booking.status !== "confirmed" && booking.status !== "waitlisted") {
      return;
    }

    setErrorMessage(null);
    setCancellingId(booking.id);

    try {
      const { data: cancelData, error: cancelError } = await supabase.rpc(
        "cancel_booking",
        {
          p_game_id: Number(game.id),
        },
      );

      if (cancelError) {
        throw cancelError;
      }

      /*
       * Organizer-direct payments must never
       * use the legacy Chapa refund flow.
       *
       * The player paid the organizer directly,
       * so the organizer handles that refund.
       */
      if (
        game.payment_method !== "organizer" &&
        booking.payment_status === "paid" &&
        cancelData?.refund_required === true
      ) {
        const { error: refundError } = await supabase.functions.invoke(
          "refund-chapa-payment",
          {
            body: {
              booking_id: booking.id,
            },
          },
        );

        if (refundError) {
          console.log("Legacy refund request error:", refundError.message);
        }
      }

      setSelectedBooking(null);
      setErrorMessage(null);

      setSuccessMessage(
        wasWaitlisted
          ? t("bookings.leftWaitlistSuccess")
          : t("bookings.bookingCancelledSuccess"),
      );

      await fetchBookings();
    } catch (error: any) {
      console.log("Cancel booking error:", error?.message ?? error);

      const message = String(error?.message ?? "").toLowerCase();

      if (message.includes("already cancelled")) {
        setSelectedBooking(null);
        setErrorMessage(null);

        await fetchBookings();
        return;
      }

      setErrorMessage(error?.message || t("bookings.couldNotCancelBooking"));
    } finally {
      setCancellingId(null);
    }
  }, [cancellingId, fetchBookings, selectedBooking, t]);

  /* ==========================================================
     CONTACT ORGANIZER
     ========================================================== */

  const callOrganizer = useCallback(async (phone: string | null) => {
    if (!phone) {
      return;
    }

    try {
      await Linking.openURL(`tel:${phone}`);
    } catch (error) {
      console.log("Could not open phone dialer:", error);
    }
  }, []);

  /* ==========================================================
     FLATLIST ITEM
     ========================================================== */

  const renderBooking = useCallback(
    ({ item }: { item: Booking }) => (
      <BookingCard
        booking={item}
        dateLocale={dateLocale}
        t={t}
        history={activeSection === "history"}
        cancelling={cancellingId === item.id}
        submitting={submittingId === item.id}
        onCancel={openCancellationModal}
        onSubmitPayment={submitOrganizerPayment}
        onCallOrganizer={callOrganizer}
      />
    ),
    [
      activeSection,
      callOrganizer,
      cancellingId,
      dateLocale,
      openCancellationModal,
      submitOrganizerPayment,
      submittingId,
      t,
    ],
  );
  /* ==========================================================
     HEADER
     ========================================================== */

  const listHeader = (
    <>
      <Text style={[styles.title, isDark && { color: colors.white }]}>
        {t("bookings.title")}
      </Text>

      <Text
        style={[styles.subtitle, isDark && { color: colors.textSecondary }]}
      >
        {t("bookings.subtitle")}
      </Text>

      <View style={styles.sectionTabs}>
        <Pressable
          style={[
            styles.sectionTab,
            activeSection === "upcoming" && styles.sectionTabActive,
          ]}
          onPress={() => {
            setActiveSection("upcoming");
            setSelectedDate(null);
          }}
        >
          <Text
            style={[
              styles.sectionTabText,
              activeSection === "upcoming" && styles.sectionTabTextActive,
            ]}
          >
            Upcoming
          </Text>

          <View
            style={[
              styles.sectionCount,
              activeSection === "upcoming" && styles.sectionCountActive,
            ]}
          >
            <Text
              style={[
                styles.sectionCountText,
                activeSection === "upcoming" && styles.sectionCountTextActive,
              ]}
            >
              {sectionCounts.upcoming}
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={[
            styles.sectionTab,
            activeSection === "history" && styles.sectionTabActive,
          ]}
          onPress={() => {
            setActiveSection("history");
            setSelectedDate(null);
          }}
        >
          <Text
            style={[
              styles.sectionTabText,
              activeSection === "history" && styles.sectionTabTextActive,
            ]}
          >
            History
          </Text>

          <View
            style={[
              styles.sectionCount,
              activeSection === "history" && styles.sectionCountActive,
            ]}
          >
            <Text
              style={[
                styles.sectionCountText,
                activeSection === "history" && styles.sectionCountTextActive,
              ]}
            >
              {sectionCounts.history}
            </Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("bookings.searchPlaceholder")}
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor={COLORS.primary}
            returnKeyType="search"
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
          />

          {search.length > 0 && (
            <Pressable
              style={styles.searchActionButton}
              onPress={() => setSearch("")}
              hitSlop={8}
            >
              <Ionicons name="close" size={21} color={COLORS.textSecondary} />
            </Pressable>
          )}

          <View style={styles.searchDivider} />

          <Pressable
            style={[
              styles.searchFilterButton,
              (bookingStatusFilter !== "all" || bookingSortBy !== "upcoming") &&
                styles.searchFilterButtonActive,
            ]}
            onPress={() => setBookingFilterVisible(true)}
            hitSlop={6}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={
                bookingStatusFilter !== "all" || bookingSortBy !== "upcoming"
                  ? COLORS.white
                  : COLORS.primary
              }
            />
          </Pressable>
        </View>

        <Pressable
          style={[
            styles.calendarButton,
            selectedDate && styles.calendarButtonActive,
          ]}
          onPress={() => setCalendarVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={t("bookings.openCalendar")}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={selectedDate ? COLORS.white : COLORS.primary}
          />
        </Pressable>
      </View>

      {selectedDate && (
        <View style={styles.activeDateFilter}>
          <Ionicons name="calendar-outline" size={15} color={COLORS.primary} />

          <Text style={styles.activeDateFilterText}>
            {language === "en"
              ? new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(new Date(`${selectedDate}T12:00:00Z`))
              : formatEthiopianDate(`${selectedDate}T12:00:00Z`, language)}
          </Text>

          <Pressable onPress={() => setSelectedDate(null)}>
            <Ionicons name="close-circle" size={19} color={COLORS.textMuted} />
          </Pressable>
        </View>
      )}
    </>
  );

  const emptyComponent = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons
            name={
              activeSection === "history" ? "time-outline" : "calendar-outline"
            }
            size={32}
            color={COLORS.primary}
          />
        </View>

        <Text style={styles.emptyTitle}>
          {search
            ? "No matching bookings"
            : activeSection === "history"
              ? "No booking history"
              : t("bookings.noBookings")}
        </Text>

        <Text style={styles.emptyText}>
          {search
            ? "Try another game, location, or organizer."
            : activeSection === "history"
              ? "Completed and cancelled bookings will appear here."
              : t("bookings.noBookingsDescription")}
        </Text>
      </View>
    ),
    [activeSection, search, t],
  );

  const selectedIsWaitlisted = selectedBooking?.status === "waitlisted";

  const selectedIsOrganizerPaid =
    selectedBooking?.games?.payment_method === "organizer" &&
    selectedBooking?.payment_status === "paid";

  /* ==========================================================
     SCREEN
     ========================================================== */

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {successMessage && (
        <View
          style={[
            styles.successBanner,
            {
              top: insets.top + 8,
            },
          ]}
        >
          <View style={styles.successBannerIcon}>
            <Ionicons name="checkmark" size={20} color={COLORS.white} />
          </View>

          <View style={styles.successBannerContent}>
            <Text style={styles.successBannerText}>{successMessage}</Text>

            <Text style={styles.successBannerSubtext}>
              {t("bookings.successUpdateSaved")}
            </Text>
          </View>

          <Pressable onPress={() => setSuccessMessage(null)} hitSlop={10}>
            <Ionicons name="close" size={21} color={COLORS.text} />
          </Pressable>
        </View>
      )}

      {loading ? (
        <View style={styles.firstLoad}>
          <ActivityIndicator size="large" color={COLORS.primary} />

          <Text style={styles.loadingText}>{t("bookings.loading")}</Text>
        </View>
      ) : (
        <FlatList
          data={visibleBookings}
          renderItem={renderBooking}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={emptyComponent}
          ItemSeparatorComponent={() => <View style={styles.cardGap} />}
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={[
            styles.content,
            isDesktopWeb && styles.contentDesktop,
            visibleBookings.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() =>
                void fetchBookings({
                  refresh: true,
                })
              }
              tintColor={COLORS.primary}
            />
          }
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== "web"}
        />
      )}

      {/* ============================================
          CALENDAR
          ============================================ */}

      <CalendarModal
        visible={calendarVisible}
        language={language}
        selectedDate={selectedDate}
        t={t}
        onClose={() => setCalendarVisible(false)}
        onSelect={(date) => {
          setSelectedDate(date);
          setCalendarVisible(false);
        }}
      />

      {/* ============================================
          FILTERS
          ============================================ */}

      <FilterModal
        visible={bookingFilterVisible}
        t={t}
        sortBy={bookingSortBy}
        statusFilter={bookingStatusFilter}
        onSortChange={setBookingSortBy}
        onStatusChange={setBookingStatusFilter}
        onReset={() => {
          setBookingSortBy("upcoming");
          setBookingStatusFilter("all");
        }}
        onClose={() => setBookingFilterVisible(false)}
      />

      {/* ============================================
          CANCELLATION
          ============================================ */}

      <Modal
        visible={selectedBooking !== null}
        transparent
        animationType="fade"
        onRequestClose={closeCancellationModal}
      >
        <Pressable
          style={styles.cancelModalOverlay}
          onPress={closeCancellationModal}
        >
          <Pressable
            style={styles.cancelModalSheet}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={styles.cancelModalTitle}>
              {selectedIsWaitlisted
                ? t("bookings.leaveWaitlistQuestion")
                : t("bookings.cancelBookingQuestion")}
            </Text>

            <Text style={styles.cancelModalMessage}>
              {errorMessage
                ? `${t("bookings.somethingWentWrong")} ${errorMessage}`
                : selectedIsWaitlisted
                  ? t("bookings.leaveWaitlistHistory")
                  : selectedIsOrganizerPaid
                    ? t("bookings.cancelOrganizerPaidMessage").replace(
                        "{game}",
                        selectedBooking?.games?.title ?? t("bookings.thisGame"),
                      )
                    : t("bookings.cancelNormalMessage")}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.keepBookingButton,
                pressed && styles.actionPressed,
              ]}
              onPress={closeCancellationModal}
              disabled={cancellingId !== null}
            >
              <Text style={styles.keepBookingButtonText}>
                {t("bookings.keepBooking")}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.confirmCancelButton,
                pressed && styles.actionPressed,
              ]}
              onPress={cancelSelectedBooking}
              disabled={cancellingId !== null}
            >
              {cancellingId !== null ? (
                <ActivityIndicator size="small" color={COLORS.danger} />
              ) : (
                <Text style={styles.confirmCancelButtonText}>
                  {selectedIsWaitlisted
                    ? t("bookings.leaveWaitlist")
                    : t("bookings.cancelBooking")}
                </Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/* ============================================================
   FILTER MODAL
   ============================================================ */

function FilterModal({
  visible,
  t,
  sortBy,
  statusFilter,
  onSortChange,
  onStatusChange,
  onReset,
  onClose,
}: {
  visible: boolean;
  t: Translate;
  sortBy: BookingSort;
  statusFilter: BookingFilter;
  onSortChange: (value: BookingSort) => void;
  onStatusChange: (value: BookingFilter) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.filterOverlay}>
        <View style={styles.filterSheet}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>
              {t("bookings.filterBookings")}
            </Text>

            <Pressable style={styles.modalCloseButton} onPress={onClose}>
              <Ionicons name="close" size={23} color={COLORS.text} />
            </Pressable>
          </View>

          <Text style={styles.filterSectionTitle}>{t("bookings.sortBy")}</Text>

          <View style={styles.filterChipRow}>
            {[
              ["upcoming", t("bookings.upcomingFirst")],
              ["latest", t("bookings.latestFirst")],
            ].map(([value, label]) => {
              const active = sortBy === value;

              return (
                <Pressable
                  key={value}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => onSortChange(value as BookingSort)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.filterSectionTitle}>{t("bookings.status")}</Text>

          <View style={styles.filterChipRow}>
            {[
              ["all", t("bookings.allBookings")],
              ["confirmed", t("bookings.confirmed")],
              ["payment_required", t("bookings.paymentRequired")],
              ["waitlisted", t("bookings.waitlisted")],
            ].map(([value, label]) => {
              const active = statusFilter === value;

              return (
                <Pressable
                  key={value}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => onStatusChange(value as BookingFilter)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.filterActions}>
            <Pressable style={styles.resetButton} onPress={onReset}>
              <Text style={styles.resetButtonText}>{t("bookings.reset")}</Text>
            </Pressable>

            <Pressable style={styles.showButton} onPress={onClose}>
              <Text style={styles.showButtonText}>
                {t("bookings.showBookings")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ============================================================
   CALENDAR MODAL
   ============================================================ */

function CalendarModal({
  visible,
  language,
  selectedDate,
  t,
  onClose,
  onSelect,
}: {
  visible: boolean;
  language: "en" | "am" | "om";
  selectedDate: string | null;
  t: Translate;
  onClose: () => void;
  onSelect: (date: string) => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.calendarOverlay} onPress={onClose}>
        <Pressable
          style={styles.calendarModal}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.calendarHeader}>
            <View style={styles.calendarHeading}>
              <Text style={styles.calendarTitle}>
                {t("bookings.chooseDate")}
              </Text>

              <Text style={styles.calendarSubtitle}>
                {t("bookings.calendarSubtitle")}
              </Text>
            </View>

            <Pressable style={styles.modalCloseButton} onPress={onClose}>
              <Ionicons name="close" size={23} color={COLORS.text} />
            </Pressable>
          </View>

          {language === "en" ? (
            <Calendar
              current={selectedDate ?? undefined}
              onDayPress={(day) => onSelect(day.dateString)}
              markedDates={
                selectedDate
                  ? {
                      [selectedDate]: {
                        selected: true,
                      },
                    }
                  : {}
              }
              enableSwipeMonths
              theme={{
                calendarBackground: COLORS.surface,
                backgroundColor: COLORS.surface,
                monthTextColor: COLORS.text,
                dayTextColor: COLORS.text,
                textDisabledColor: COLORS.textMuted,
                arrowColor: COLORS.primary,
                todayTextColor: COLORS.primary,
                selectedDayBackgroundColor: COLORS.primary,
                selectedDayTextColor: COLORS.white,
                textMonthFontWeight: "800",
                textDayFontWeight: "500",
                textDayHeaderFontWeight: "700",
              }}
            />
          ) : (
            <EthiopianCalendar
              language={language}
              selectedDate={selectedDate}
              onSelect={onSelect}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ============================================================
   DATE HELPERS
   ============================================================ */

type EthiopianLanguage = "am" | "om";

const AMHARIC_MONTHS = [
  "መስከረም",
  "ጥቅምት",
  "ኅዳር",
  "ታኅሣሥ",
  "ጥር",
  "የካቲት",
  "መጋቢት",
  "ሚያዝያ",
  "ግንቦት",
  "ሰኔ",
  "ሐምሌ",
  "ነሐሴ",
  "ጳጉሜ",
];

const OROMO_MONTHS = [
  "Fulbaana",
  "Onkololeessa",
  "Sadaasa",
  "Muddee",
  "Amajjii",
  "Guraandhala",
  "Bitooteessa",
  "Ebla",
  "Caamsaa",
  "Waxabajjii",
  "Adooleessa",
  "Hagayya",
  "Qaammee",
];

function getAddisDateKey(timestamp: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function formatCompactAddisDate(timestamp: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Africa/Addis_Ababa",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function formatAddisStartTime(timestamp: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Africa/Addis_Ababa",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function gregorianToJdn(year: number, month: number, day: number) {
  const a = Math.floor((14 - month) / 12);

  const y = year + 4800 - a;

  const m = month + 12 * a - 3;

  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function jdnToEthiopian(jdn: number) {
  const r = (jdn - 1724221) % 1461;

  const n = (r % 365) + 365 * Math.floor(r / 1460);

  return {
    year:
      4 * Math.floor((jdn - 1724221) / 1461) +
      Math.floor(r / 365) -
      Math.floor(r / 1460) +
      1,

    month: Math.floor(n / 30) + 1,

    day: (n % 30) + 1,
  };
}

function ethiopianToJdn(year: number, month: number, day: number) {
  return (
    1724221 +
    365 * (year - 1) +
    Math.floor(year / 4) +
    30 * (month - 1) +
    day -
    1
  );
}

function jdnToGregorian(jdn: number) {
  const a = jdn + 32044;

  const b = Math.floor((4 * a + 3) / 146097);

  const c = a - Math.floor((146097 * b) / 4);

  const d = Math.floor((4 * c + 3) / 1461);

  const e = c - Math.floor((1461 * d) / 4);

  const m = Math.floor((5 * e + 2) / 153);

  const day = e - Math.floor((153 * m + 2) / 5) + 1;

  const month = m + 3 - 12 * Math.floor(m / 10);

  const year = 100 * b + d - 4800 + Math.floor(m / 10);

  return {
    year,
    month,
    day,
  };
}

function ethiopianToGregorianKey(year: number, month: number, day: number) {
  const gregorian = jdnToGregorian(ethiopianToJdn(year, month, day));

  return `${gregorian.year}-${String(gregorian.month).padStart(
    2,
    "0",
  )}-${String(gregorian.day).padStart(2, "0")}`;
}

function getEthiopianDate(
  timestamp: string | Date,
  language: EthiopianLanguage,
) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value);

  const month = Number(parts.find((part) => part.type === "month")?.value);

  const day = Number(parts.find((part) => part.type === "day")?.value);

  const eth = jdnToEthiopian(gregorianToJdn(year, month, day));

  const months = language === "om" ? OROMO_MONTHS : AMHARIC_MONTHS;

  return {
    ...eth,
    monthName: months[eth.month - 1],

    label: `${months[eth.month - 1]} ${eth.day} ${eth.year}`,
  };
}

function formatEthiopianDate(timestamp: string, language: EthiopianLanguage) {
  return getEthiopianDate(timestamp, language).label;
}

function getTodayAddisKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isEthiopianLeapYear(year: number) {
  return year % 4 === 3;
}

/* ============================================================
   ETHIOPIAN CALENDAR
   ============================================================ */

function EthiopianCalendar({
  language,
  selectedDate,
  onSelect,
}: {
  language: EthiopianLanguage;
  selectedDate: string | null;
  onSelect: (gregorianDate: string) => void;
}) {
  const todayEthiopian = useMemo(
    () => getEthiopianDate(new Date(), language),
    [language],
  );

  const [viewYear, setViewYear] = useState(todayEthiopian.year);

  const [viewMonth, setViewMonth] = useState(todayEthiopian.month);

  const months = language === "om" ? OROMO_MONTHS : AMHARIC_MONTHS;

  const weekdays =
    language === "om"
      ? ["Wi", "Ki", "Ro", "Ka", "Ji", "Sa", "Di"]
      : ["ሰ", "ማ", "ረ", "ሐ", "ዓ", "ቅ", "እ"];

  const daysInMonth =
    viewMonth <= 12 ? 30 : isEthiopianLeapYear(viewYear) ? 6 : 5;

  const firstDate = ethiopianToGregorianKey(viewYear, viewMonth, 1);

  const [firstYear, firstMonth, firstDay] = firstDate.split("-").map(Number);

  const firstWeekday =
    (new Date(Date.UTC(firstYear, firstMonth - 1, firstDay, 12)).getUTCDay() +
      6) %
    7;

  const cells: Array<number | null> = [
    ...Array(firstWeekday).fill(null),

    ...Array.from(
      {
        length: daysInMonth,
      },
      (_, index) => index + 1,
    ),
  ];

  while (cells.length < 42) {
    cells.push(null);
  }

  const today = getTodayAddisKey();

  function previousMonth() {
    if (viewMonth === 1) {
      setViewMonth(13);

      setViewYear((year) => year - 1);
    } else {
      setViewMonth((month) => month - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 13) {
      setViewMonth(1);

      setViewYear((year) => year + 1);
    } else {
      setViewMonth((month) => month + 1);
    }
  }

  return (
    <View>
      <View style={styles.ethMonthHeader}>
        <Pressable style={styles.ethArrow} onPress={previousMonth}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </Pressable>

        <Text style={styles.ethMonthTitle}>
          {months[viewMonth - 1]} {viewYear}
        </Text>

        <Pressable style={styles.ethArrow} onPress={nextMonth}>
          <Ionicons name="chevron-forward" size={22} color={COLORS.primary} />
        </Pressable>
      </View>

      <View style={styles.ethWeekRow}>
        {weekdays.map((weekday) => (
          <Text key={weekday} style={styles.ethWeekday}>
            {weekday}
          </Text>
        ))}
      </View>

      <View style={styles.ethGrid}>
        {cells.map((day, index) => {
          if (day === null) {
            return <View key={`empty-${index}`} style={styles.ethCell} />;
          }

          const gregorianKey = ethiopianToGregorianKey(
            viewYear,
            viewMonth,
            day,
          );

          const selected = gregorianKey === selectedDate;

          const isToday = gregorianKey === today;

          return (
            <Pressable
              key={gregorianKey}
              style={styles.ethCell}
              onPress={() => onSelect(gregorianKey)}
            >
              <View
                style={[styles.ethDayCircle, selected && styles.ethSelected]}
              >
                <Text
                  style={[
                    styles.ethDayText,
                    isToday && styles.ethToday,
                    selected && styles.ethSelectedText,
                  ]}
                >
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ============================================================
   STYLES
   ============================================================ */

const styles = StyleSheet.create({
  bookingCardWrapper: {
    width: "100%",
  },

  bookingCardWrapperCancelled: {
    opacity: 0.62,
  },

  bookingCardStatus: {
    width: "100%",
    height: 36,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10,
  },

  bookingCardStatusWarning: {
    backgroundColor: "#FFF4D6",
  },

  bookingCardStatusDanger: {
    backgroundColor: "#FDECEC",
  },

  bookingCardStatusNeutral: {
    backgroundColor: COLORS.surfaceAlt,
  },

  bookingCardStatusText: {
    color: COLORS.white,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },

  bookingCardStatusTextWarning: {
    color: "#9A6700",
  },

  bookingCardStatusTextDanger: {
    color: COLORS.danger,
  },

  bookingCardStatusTextNeutral: {
    color: COLORS.textSecondary,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 34,
  },

  contentDesktop: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 24,
  },

  title: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.8,
  },

  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    marginTop: 3,
    marginBottom: 16,
  },

  sectionTabs: {
    flexDirection: "row",
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },

  sectionTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  sectionTabActive: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
  },

  sectionTabText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: "700",
  },

  sectionTabTextActive: {
    color: COLORS.text,
    fontWeight: "900",
  },

  sectionCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.border,
  },

  sectionCountActive: {
    backgroundColor: COLORS.primary,
  },

  sectionCountText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "800",
  },

  sectionCountTextActive: {
    color: COLORS.white,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },

  searchBox: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 15,
    paddingRight: 5,
    backgroundColor: COLORS.surface,
    elevation: 1,
  },

  searchInput: {
    flex: 1,
    minWidth: 0,
    marginLeft: 9,
    marginRight: 3,
    color: COLORS.text,
    fontSize: 15,
  },

  searchActionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  searchDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: COLORS.border,
    marginHorizontal: 3,
  },

  searchFilterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  searchFilterButtonActive: {
    backgroundColor: COLORS.primary,
  },

  calendarButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  calendarButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  activeDateFilter: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingLeft: 11,
    paddingRight: 7,
    paddingVertical: 7,
    marginBottom: 14,
  },

  activeDateFilterText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },

  cardGap: {
    height: 12,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    elevation: 2,
  },

  cardPressed: {
    opacity: 0.94,
  },

  cardCancelled: {
    borderColor: "#E2D6D4",
    opacity: 0.88,
  },

  cardMainRow: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 190,
  },

  thumbnail: {
    width: "38%",
    maxWidth: 150,
    alignSelf: "stretch",
    overflow: "hidden",
    backgroundColor: "#00524F",
    position: "relative",
  },

  thumbnailImage: {
    width: "100%",
    height: "100%",
  },

  thumbnailFallback: {
    flex: 1,
    backgroundColor: "#123E3F",
    overflow: "hidden",
    position: "relative",
  },

  pitchHalfwayLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  pitchCenterCircle: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    left: "50%",
    top: "50%",
    transform: [{ translateX: -36 }, { translateY: -36 }],
  },

  pitchBall: {
    position: "absolute",
    left: 14,
    top: 20,
  },

  pitchAccent: {
    position: "absolute",
    left: 14,
    bottom: 16,
    width: 34,
    height: 4,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },

  fallbackLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  fallbackCircle: {
    position: "absolute",
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },

  cancelledImage: {
    opacity: 0.45,
  },

  cardContent: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 16,
    justifyContent: "center",
  },

  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  cardTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "900",
    letterSpacing: -0.25,
  },

  statusPill: {
    alignSelf: "flex-start",
    minHeight: 25,
    maxWidth: "100%",
    marginTop: 6,
    marginBottom: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#15803D",
  },

  statusPillWarning: {
    backgroundColor: "#FFF1C7",
  },

  statusPillDanger: {
    backgroundColor: "#FFF1F1",
  },

  statusPillNeutral: {
    backgroundColor: COLORS.surfaceAlt,
  },

  statusPillText: {
    flexShrink: 1,
    color: COLORS.white,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
  },

  statusPillTextWarning: {
    color: "#9A6700",
  },

  statusPillTextDanger: {
    color: COLORS.danger,
  },

  statusPillTextNeutral: {
    color: COLORS.textSecondary,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 19,
  },

  metaText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12.5,
    lineHeight: 17,
  },

  priceText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    marginTop: 5,
  },

  paymentBox: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E9D39A",
    backgroundColor: "#FFF9E8",
    padding: 12,
  },

  paymentBoxHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },

  paymentIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFF1C7",
    alignItems: "center",
    justifyContent: "center",
  },

  paymentHeaderText: {
    flex: 1,
  },

  paymentTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
  },

  paymentDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },

  paymentDetails: {
    marginTop: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 11,
    paddingHorizontal: 11,
  },

  paymentDetailRow: {
    minHeight: 39,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  paymentDetailBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },

  paymentDetailLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },

  paymentDetailValue: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },

  paymentActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },

  secondaryAction: {
    minHeight: 43,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  secondaryActionText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "800",
  },

  primaryAction: {
    flex: 1,
    minHeight: 43,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  primaryActionText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "900",
  },

  waitingBox: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#E9D39A",
    backgroundColor: "#FFF8E7",
    padding: 11,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },

  waitingContent: {
    flex: 1,
  },

  waitingTitle: {
    color: "#9A6700",
    fontSize: 13,
    fontWeight: "900",
  },

  waitingText: {
    color: "#8A7450",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },

  refundedBox: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 13,
    backgroundColor: "#F0F5F3",
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  refundedText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "800",
  },

  cancelAction: {
    alignSelf: "flex-start",
    marginLeft: 12,
    marginBottom: 11,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 10,
  },

  cancelActionText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: "800",
  },

  actionPressed: {
    opacity: 0.65,
  },

  actionDisabled: {
    opacity: 0.6,
  },

  firstLoad: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    marginTop: 13,
  },

  emptyListContent: {
    flexGrow: 1,
  },

  emptyContainer: {
    alignItems: "center",
    paddingTop: 70,
    paddingHorizontal: 28,
    paddingBottom: 60,
  },

  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },

  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: "center",
  },

  successBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 100,
    elevation: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },

  successBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  successBannerContent: {
    flex: 1,
    paddingRight: 8,
  },

  successBannerText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
  },

  successBannerSubtext: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },

  filterOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.38)",
    justifyContent: "flex-end",
  },

  filterSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
  },

  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  filterTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
  },

  filterSectionTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 18,
    marginBottom: 7,
  },

  filterChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },

  filterChip: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },

  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  filterChipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },

  filterChipTextActive: {
    color: COLORS.white,
    fontWeight: "800",
  },

  filterActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
  },

  resetButton: {
    flex: 1,
    height: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  resetButtonText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "800",
  },

  showButton: {
    flex: 2,
    height: 50,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  showButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "800",
  },

  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  calendarOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  calendarModal: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },

  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  calendarHeading: {
    flex: 1,
    paddingRight: 12,
  },

  calendarTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
  },

  calendarSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },

  ethMonthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
  },

  ethArrow: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  ethMonthTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },

  ethWeekRow: {
    flexDirection: "row",
    marginBottom: 5,
  },

  ethWeekday: {
    width: "14.2857%",
    textAlign: "center",
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },

  ethGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  ethCell: {
    width: "14.2857%",
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },

  ethDayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  ethDayText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },

  ethToday: {
    color: COLORS.primary,
    fontWeight: "900",
  },

  ethSelected: {
    backgroundColor: COLORS.primary,
  },

  ethSelectedText: {
    color: COLORS.white,
    fontWeight: "900",
  },

  cancelModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  cancelModalSheet: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
  },

  cancelModalTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },

  cancelModalMessage: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 11,
    marginBottom: 25,
  },

  keepBookingButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  keepBookingButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "900",
  },

  confirmCancelButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 7,
  },

  confirmCancelButtonText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: "800",
  },
});
