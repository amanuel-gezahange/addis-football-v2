import { Ionicons } from "@expo/vector-icons";

import { router, useFocusEffect } from "expo-router";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar } from "react-native-calendars";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../constants/colors";

import { useLanguage } from "../../i18n/LanguageContext";

import { supabase } from "../../lib/supabase";

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

  price_paid: number | null;

  payment_status: PaymentStatus;

  payment_offer_expires_at: string | null;

  created_at: string;

  games: Game | null;
};

export default function BookingsScreen() {
  const { language, t } = useLanguage();

  const { width } = useWindowDimensions();

  const isDesktopWeb = Platform.OS === "web" && width >= 900;

  const dateLocale =
    language === "am"
      ? "am-ET-u-ca-gregory"
      : language === "om"
        ? "om-ET-u-ca-gregory"
        : "en-US-u-ca-gregory";

  const [bookings, setBookings] = useState<Booking[]>([]);

  const [loading, setLoading] = useState(true);

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const [submittingId, setSubmittingId] = useState<number | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [bookingFilterVisible, setBookingFilterVisible] = useState(false);

  const [bookingSortBy, setBookingSortBy] = useState<"upcoming" | "latest">(
    "upcoming",
  );

  const [bookingStatusFilter, setBookingStatusFilter] = useState<
    "all" | "confirmed" | "payment_required" | "waitlisted"
  >("all");
  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timer = setTimeout(() => {
      setSuccessMessage(null);
    }, 2500);

    return () => clearTimeout(timer);
  }, [successMessage]);

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, []),
  );

  async function fetchBookings() {
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      if (!user) {
        console.log("Booking user error: No session user");

        setBookings([]);

        return;
      }

      const { data, error } = await supabase

        .from("bookings")

        .select(
          `

          id,

          status,

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

        .order("created_at", { ascending: false });

      if (error) {
        console.log("Bookings error:", error.message);

        setBookings([]);

        return;
      }

      setBookings((data || []) as unknown as Booking[]);
    } finally {
      setLoading(false);
    }
  }

  const visibleBookings = useMemo(() => {
    const now = Date.now();
    const query = search.trim().toLocaleLowerCase();

    // Standard app-style search:
    // - instant from the first character
    // - case-insensitive
    // - searches only fields a player naturally expects
    // - ranks title/area matches first
    if (query) {
      return bookings
        .filter((booking) => {
          const game = booking.games;

          if (!game?.starts_at) {
            return false;
          }

          if (
            booking.status === "cancelled_by_player" ||
            booking.status === "cancelled_by_organizer"
          ) {
            return false;
          }

          const gameEndTime = game.ends_at
            ? new Date(game.ends_at).getTime()
            : new Date(game.starts_at).getTime();

          if (gameEndTime < now) {
            return false;
          }

          const title = (game.title ?? "").toLocaleLowerCase();
          const area = (game.area ?? "").toLocaleLowerCase();
          const organizer = (game.organizer ?? "").toLocaleLowerCase();

          return (
            title.includes(query) ||
            area.includes(query) ||
            organizer.includes(query)
          );
        })
        .sort((a, b) => {
          const aTitle = (a.games?.title ?? "").toLocaleLowerCase();
          const bTitle = (b.games?.title ?? "").toLocaleLowerCase();
          const aArea = (a.games?.area ?? "").toLocaleLowerCase();
          const bArea = (b.games?.area ?? "").toLocaleLowerCase();

          const rank = (title: string, area: string) => {
            if (title.startsWith(query)) return 0;
            if (area.startsWith(query)) return 1;
            if (title.includes(query)) return 2;
            if (area.includes(query)) return 3;
            return 4;
          };

          const rankDifference = rank(aTitle, aArea) - rank(bTitle, bArea);

          if (rankDifference !== 0) {
            return rankDifference;
          }

          const aTime = a.games?.starts_at
            ? new Date(a.games.starts_at).getTime()
            : Number.MAX_SAFE_INTEGER;

          const bTime = b.games?.starts_at
            ? new Date(b.games.starts_at).getTime()
            : Number.MAX_SAFE_INTEGER;

          return aTime - bTime;
        });
    }

    // Normal Bookings browsing when there is no search query.
    return bookings
      .filter((booking) => {
        const game = booking.games;

        if (!game?.starts_at) {
          return false;
        }

        if (
          booking.status === "cancelled_by_player" ||
          booking.status === "cancelled_by_organizer"
        ) {
          return false;
        }

        const gameEndTime = game.ends_at
          ? new Date(game.ends_at).getTime()
          : new Date(game.starts_at).getTime();

        if (gameEndTime < now) {
          return false;
        }

        if (selectedDate && getAddisDateKey(game.starts_at) !== selectedDate) {
          return false;
        }

        if (
          bookingStatusFilter === "confirmed" &&
          booking.status !== "confirmed"
        ) {
          return false;
        }

        if (
          bookingStatusFilter === "payment_required" &&
          !(
            booking.status === "pending_payment" &&
            booking.payment_status === "pending"
          )
        ) {
          return false;
        }

        if (
          bookingStatusFilter === "waitlisted" &&
          booking.status !== "waitlisted"
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const aTime = a.games?.starts_at
          ? new Date(a.games.starts_at).getTime()
          : Number.MAX_SAFE_INTEGER;

        const bTime = b.games?.starts_at
          ? new Date(b.games.starts_at).getTime()
          : Number.MAX_SAFE_INTEGER;

        return bookingSortBy === "latest" ? bTime - aTime : aTime - bTime;
      });
  }, [bookings, search, selectedDate, bookingStatusFilter, bookingSortBy]);

  async function submitOrganizerPayment(booking: Booking) {
    if (
      !booking.games ||
      booking.games.payment_method !== "organizer" ||
      booking.status !== "pending_payment" ||
      booking.payment_status === "submitted"
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

      await fetchBookings();
    } catch (error: any) {
      console.log("Submit organizer payment error:", error?.message || error);

      if (Platform.OS === "web") {
        window.alert(error?.message || t("bookings.couldNotSubmitPayment"));
      }
    } finally {
      setSubmittingId(null);
    }
  }

  function openCancellationModal(booking: Booking) {
    if (booking.status !== "confirmed" && booking.status !== "waitlisted") {
      return;
    }

    setErrorMessage(null);

    setSelectedBooking(booking);
  }

  function closeCancellationModal() {
    if (cancellingId !== null) {
      return;
    }

    setSelectedBooking(null);

    setErrorMessage(null);
  }

  async function cancelSelectedBooking() {
    if (!selectedBooking?.games) {
      return;
    }

    const booking = selectedBooking;

    const wasWaitlisted = booking.status === "waitlisted";

    const game = booking.games;

    if (!game) {
      return;
    }

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

       * IMPORTANT

       *

       * Organizer-direct payments must NEVER call the old

       * Chapa refund function.

       *

       * The player paid the organizer directly through Telebirr,

       * so any refund must be handled by the organizer.

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
      console.log("Cancel booking error:", error?.message || error);

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
  }

  const selectedIsWaitlisted = selectedBooking?.status === "waitlisted";

  const selectedIsOrganizerPaid =
    selectedBooking?.games?.payment_method === "organizer" &&
    selectedBooking?.payment_status === "paid";

  async function callOrganizer(phone: string | null) {
    if (!phone) {
      return;
    }

    try {
      await Linking.openURL(`tel:${phone}`);
    } catch (error) {
      console.log("Could not open phone dialer:", error);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {successMessage && (
        <View style={styles.successBanner}>
          <View style={styles.successBannerIcon}>
            <Ionicons name="checkmark" size={20} color="#F7F8FA" />
          </View>

          <View style={styles.successBannerContent}>
            <Text style={styles.successBannerText}>{successMessage}</Text>

            <Text style={styles.successBannerSubtext}>
              {t("bookings.successUpdateSaved")}
            </Text>
          </View>

          <Pressable onPress={() => setSuccessMessage(null)} hitSlop={10}>
            <Ionicons name="close" size={22} color="#14201B" />
          </Pressable>

          <View style={styles.successBannerProgress} />
        </View>
      )}
      <ScrollView
        style={styles.container}

        contentContainerStyle={[
          styles.content,

          isDesktopWeb && styles.contentDesktop,
        ]}

        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t("bookings.title")}</Text>

        <Text style={styles.subtitle}>{t("bookings.subtitle")}</Text>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={21} color="#66766F" />

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("bookings.searchPlaceholder")}
              placeholderTextColor={COLORS.textMuted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              selectionColor={COLORS.primary}
            />

            {search.length > 0 && (
              <Pressable
                style={styles.searchActionButton}
                onPress={() => setSearch("")}
                hitSlop={8}
              >
                <Ionicons name="close" size={23} color={COLORS.textSecondary} />
              </Pressable>
            )}

            <View style={styles.searchDivider} />

            <Pressable
              style={[
                styles.searchFilterButton,
                (bookingStatusFilter !== "all" ||
                  bookingSortBy !== "upcoming") &&
                  styles.searchFilterButtonActive,
              ]}
              onPress={() => setBookingFilterVisible(true)}
              hitSlop={6}
            >
              <Ionicons
                name="options-outline"
                size={21}
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
              size={21}
              color={selectedDate ? "#F7F8FA" : COLORS.primary}
            />
          </Pressable>
        </View>

        {selectedDate && (
          <View style={styles.activeDateFilter}>
            <Ionicons
              name="calendar-outline"
              size={16}
              color={COLORS.primary}
            />

            <Text style={styles.activeDateFilterText}>
              {language === "am"
                ? formatEthiopianDate(`${selectedDate}T12:00:00Z`, language)
                : language === "om"
                  ? formatEthiopianDate(`${selectedDate}T12:00:00Z`, language)
                  : new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(`${selectedDate}T12:00:00Z`))}
            </Text>

            <Pressable onPress={() => setSelectedDate(null)}>
              <Ionicons
                name="close-circle"
                size={20}
                color={COLORS.textMuted}
              />
            </Pressable>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />

            <Text style={styles.loadingText}>{t("bookings.loading")}</Text>
          </View>
        ) : visibleBookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="calendar-outline"

                size={34}

                color={COLORS.primary}
              />
            </View>

            <Text style={styles.emptyTitle}>{t("bookings.noBookings")}</Text>

            <Text style={styles.emptyText}>
              {t("bookings.noBookingsDescription")}
            </Text>
          </View>
        ) : (
          <View style={styles.bookingList}>
            {visibleBookings.map((booking) => {
              const game = booking.games;

              if (!game) {
                return null;
              }

              const isWaitlisted = booking.status === "waitlisted";

              const isConfirmed = booking.status === "confirmed";

              const isPendingPayment = booking.status === "pending_payment";

              const cancelledByPlayer =
                booking.status === "cancelled_by_player";

              const cancelledByOrganizer =
                booking.status === "cancelled_by_organizer";

              const isCancelled = cancelledByPlayer || cancelledByOrganizer;

              const isOrganizerPayment = game.payment_method === "organizer";

              const paymentPending =
                isOrganizerPayment &&
                isPendingPayment &&
                booking.payment_status === "pending";

              const paymentSubmitted =
                isOrganizerPayment &&
                isPendingPayment &&
                booking.payment_status === "submitted";

              const paymentConfirmed =
                isOrganizerPayment &&
                isConfirmed &&
                booking.payment_status === "paid";

              const isCancelling = cancellingId === booking.id;

              const isSubmitting = submittingId === booking.id;

              const statusInfo = getStatusInfo(
                booking.status,

                booking.payment_status,

                isOrganizerPayment,

                t,
              );

              const compactStatusLabel = isCancelled
                ? statusInfo.label
                : paymentPending
                  ? t("bookings.paymentRequired")
                  : paymentSubmitted
                    ? "Payment sent"
                    : isWaitlisted
                      ? t("bookings.waitlisted")
                      : game.payment_method === "venue" && isConfirmed
                        ? t("bookings.payAtVenue")
                        : isConfirmed || paymentConfirmed
                          ? t("bookings.confirmed")
                          : game.payment_method === "free"
                            ? t("bookings.free")
                            : statusInfo.label;

              const compactStatusIcon = isCancelled
                ? "close-circle-outline"
                : paymentPending
                  ? "card-outline"
                  : paymentSubmitted || isWaitlisted
                    ? "time-outline"
                    : game.payment_method === "venue" && isConfirmed
                      ? "location-outline"
                      : "checkmark-circle";

              const compactStatusWarning =
                paymentPending || paymentSubmitted || isWaitlisted;

              return (
                <Pressable
                  key={booking.id}
                  style={[styles.card, isCancelled && styles.cancelledCard]}
                  onPress={() => router.push(`/game/${game.id}`)}
                  disabled={isCancelled}
                  accessibilityRole="button"
                  accessibilityLabel={game.title}
                >
                  <View style={styles.bookingThumb}>
                    {game.image_url ? (
                      <>
                        <Image
                          source={{ uri: game.image_url }}
                          style={[styles.image, isCancelled && styles.cancelledImage]}
                          resizeMode="cover"
                        />
                        <View style={styles.imageShade} />
                      </>
                    ) : (
                      <View
                        style={[
                          styles.gameFallback,
                          isCancelled && styles.cancelledImage,
                        ]}
                      >
                        <View style={styles.gameFallbackCenterCircle} />
                        <View style={styles.gameFallbackCenterLine} />
                        <Ionicons
                          name="football-outline"
                          size={42}
                          color="rgba(255,255,255,0.14)"
                        />
                        <View style={styles.gameFallbackAccent} />
                      </View>
                    )}

                    <View
                      style={[
                        styles.bookingStatusPill,
                        compactStatusWarning && styles.bookingStatusPillWarning,
                        isCancelled && styles.bookingStatusPillCancelled,
                      ]}
                    >
                      <Ionicons
                        name={compactStatusIcon}
                        size={15}
                        color={
                          isCancelled
                            ? COLORS.danger
                            : compactStatusWarning
                              ? "#9A6700"
                              : COLORS.white
                        }
                      />
                      <Text
                        style={[
                          styles.bookingStatusPillText,
                          compactStatusWarning && styles.bookingStatusPillTextWarning,
                          isCancelled && styles.bookingStatusPillTextCancelled,
                        ]}
                        numberOfLines={1}
                      >
                        {compactStatusLabel}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bookingCardBody}>
                    <View style={styles.bookingCardTopRow}>
                      <Text style={styles.bookingCardTitle} numberOfLines={1}>
                        {game.title}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={COLORS.textSecondary}
                      />
                    </View>

                    <View style={styles.bookingMetaRow}>
                      <Ionicons
                        name="calendar-outline"
                        size={16}
                        color={COLORS.textSecondary}
                      />
                      <Text style={styles.bookingCardDate} numberOfLines={1}>
                        {game.starts_at
                          ? `${formatCompactAddisDate(game.starts_at, dateLocale)} · ${formatAddisStartTime(game.starts_at, dateLocale)}`
                          : game.time}
                      </Text>
                    </View>

                    <View style={styles.bookingMetaRow}>
                      <Ionicons
                        name="location-outline"
                        size={17}
                        color={COLORS.textSecondary}
                      />
                      <Text style={styles.bookingCardLocation} numberOfLines={1}>
                        {game.area}
                      </Text>
                    </View>

                    <Text style={styles.bookingCardPrice}>
                      {game.payment_method === "free"
                        ? t("bookings.free")
                        : `${booking.price_paid ?? game.price} ETB`}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
      <Modal
        visible={calendarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarVisible(false)}
      >
        <Pressable
          style={styles.calendarOverlay}
          onPress={() => setCalendarVisible(false)}
        >
          <Pressable
            style={styles.calendarModal}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.calendarHeader}>
              <View>
                <Text style={styles.calendarTitle}>
                  {t("bookings.chooseDate")}
                </Text>

                <Text style={styles.calendarSubtitle}>
                  {t("bookings.calendarSubtitle")}
                </Text>
              </View>

              <Pressable
                style={styles.calendarCloseButton}
                onPress={() => setCalendarVisible(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </Pressable>
            </View>

            {language === "en" ? (
              <Calendar
                minDate={getTodayAddisKey()}
                current={selectedDate ?? undefined}
                onDayPress={(day) => {
                  setSelectedDate(day.dateString);
                  setCalendarVisible(false);
                }}
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
                  selectedDayTextColor: COLORS.background,
                  textMonthFontWeight: "800",
                  textDayFontWeight: "500",
                  textDayHeaderFontWeight: "700",
                }}
              />
            ) : (
              <EthiopianCalendar
                language={language}
                selectedDate={selectedDate}
                onSelect={(gregorianDate) => {
                  setSelectedDate(gregorianDate);
                  setCalendarVisible(false);
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        visible={bookingFilterVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBookingFilterVisible(false)}
      >
        <View style={styles.bookingFilterOverlay}>
          <View style={styles.bookingFilterSheet}>
            <View style={styles.bookingFilterHeader}>
              <Text style={styles.bookingFilterTitle}>
                {t("bookings.filterBookings")}
              </Text>

              <Pressable onPress={() => setBookingFilterVisible(false)}>
                <Ionicons name="close" size={26} color={COLORS.text} />
              </Pressable>
            </View>

            {/* SORT BY */}

            <Text style={styles.bookingFilterSectionTitle}>
              {t("bookings.sortBy")}
            </Text>

            <View style={styles.bookingFilterChipRow}>
              {[
                ["upcoming", t("bookings.upcomingFirst")],
                ["latest", t("bookings.latestFirst")],
              ].map(([value, label]) => {
                const active = bookingSortBy === value;

                return (
                  <Pressable
                    key={value}
                    style={[
                      styles.bookingFilterChip,
                      active && styles.bookingFilterChipActive,
                    ]}
                    onPress={() =>
                      setBookingSortBy(value as "upcoming" | "latest")
                    }
                  >
                    <Text
                      style={[
                        styles.bookingFilterChipText,
                        active && styles.bookingFilterChipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* STATUS */}

            <Text style={styles.bookingFilterSectionTitle}>
              {t("bookings.status")}
            </Text>

            <View style={styles.bookingFilterChipRow}>
              {[
                ["all", t("bookings.allBookings")],
                ["confirmed", t("bookings.confirmed")],
                ["payment_required", t("bookings.paymentRequired")],
                ["waitlisted", t("bookings.waitlisted")],
              ].map(([value, label]) => {
                const active = bookingStatusFilter === value;

                return (
                  <Pressable
                    key={value}
                    style={[
                      styles.bookingFilterChip,
                      active && styles.bookingFilterChipActive,
                    ]}
                    onPress={() =>
                      setBookingStatusFilter(
                        value as
                          | "all"
                          | "confirmed"
                          | "payment_required"
                          | "waitlisted",
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.bookingFilterChipText,
                        active && styles.bookingFilterChipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* ACTIONS */}

            <View style={styles.bookingFilterActions}>
              <Pressable
                style={styles.bookingResetButton}
                onPress={() => {
                  setBookingSortBy("upcoming");
                  setBookingStatusFilter("all");
                }}
              >
                <Text style={styles.bookingResetText}>
                  {t("bookings.reset")}
                </Text>
              </Pressable>

              <Pressable
                style={styles.bookingShowButton}
                onPress={() => setBookingFilterVisible(false)}
              >
                <Text style={styles.bookingShowButtonText}>
                  {t("bookings.showBookings")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={selectedBooking !== null}
        transparent
        animationType="slide"
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
            <View style={styles.cancelModalHandle} />

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
                pressed && styles.cancelModalButtonPressed,
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
                pressed && styles.cancelModalButtonPressed,
              ]}
              onPress={cancelSelectedBooking}
              disabled={cancellingId !== null}
            >
              {cancellingId !== null ? (
                <ActivityIndicator size="small" color="#D92D20" />
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

function getStatusInfo(
  status: BookingStatus,

  paymentStatus: PaymentStatus,

  organizerPayment: boolean,

  t: (key: string) => string,
): {
  label: string;

  color: string;

  backgroundColor: string;

  icon: "checkmark-circle" | "time-outline" | "close-circle";
} {
  if (status === "pending_payment") {
    if (organizerPayment && paymentStatus === "submitted") {
      return {
        label: t("bookings.waitingForOrganizer"),

        color: "#9A6700",

        backgroundColor: "#FFF8E7",

        icon: "time-outline",
      };
    }

    return {
      label: t("bookings.organizerPaymentRequired"),

      color: "#9A6700",

      backgroundColor: "#FFF8E7",

      icon: "time-outline",
    };
  }

  if (status === "confirmed") {
    return {
      label: t("bookings.confirmed"),

      color: "#F7F8FA",

      backgroundColor: "#15803D",

      icon: "checkmark-circle",
    };
  }

  if (status === "waitlisted") {
    return {
      label: t("bookings.waitlisted"),

      color: "#9A6700",

      backgroundColor: "#FFF8E7",

      icon: "time-outline",
    };
  }

  if (status === "cancelled_by_organizer") {
    return {
      label: t("bookings.gameCancelled"),

      color: "#C13515",

      backgroundColor: "#FFF1F1",

      icon: "close-circle",
    };
  }

  return {
    label: t("bookings.cancelled"),

    color: COLORS.textSecondary,

    backgroundColor: "#F0F5F3",

    icon: "close-circle",
  };
}

function getAddisDateKey(timestamp: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function formatEthiopianDate(timestamp: string, language: "en" | "am" | "om") {
  const date = new Date(timestamp);

  // Read Gregorian date using Addis Ababa timezone
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  // Gregorian -> Julian Day Number
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;

  const jdn =
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;

  // Julian Day Number -> Ethiopian calendar
  const r = (jdn - 1724221) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);

  const ethYear =
    4 * Math.floor((jdn - 1724221) / 1461) +
    Math.floor(r / 365) -
    Math.floor(r / 1460) +
    1;

  const ethMonth = Math.floor(n / 30) + 1;
  const ethDay = (n % 30) + 1;

  const amharicMonths = [
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

  const oromoMonths = [
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

  const months = language === "om" ? oromoMonths : amharicMonths;

  return `${months[ethMonth - 1]} ${ethDay} ${ethYear}`;
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

function formatAddisDate(timestamp: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Africa/Addis_Ababa",

    weekday: "short",

    month: "short",

    day: "numeric",

    year: "numeric",
  }).format(new Date(timestamp));
}

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

  return { year, month, day };
}

function ethiopianToGregorianKey(year: number, month: number, day: number) {
  const gregorian = jdnToGregorian(ethiopianToJdn(year, month, day));

  return `${gregorian.year}-${String(gregorian.month).padStart(
    2,
    "0",
  )}-${String(gregorian.day).padStart(2, "0")}`;
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
      ? [
          "Wiixata",
          "Kibxata",
          "Roobii",
          "Kamiisa",
          "Jimaata",
          "Sanbata",
          "Dilbata",
        ]
      : ["ሰኞ", "ማክሰኞ", "ረቡዕ", "ሐሙስ", "ዓርብ", "ቅዳሜ", "እሁድ"];

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
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
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
          const disabled = gregorianKey < today;

          return (
            <Pressable
              key={gregorianKey}
              style={styles.ethCell}
              disabled={disabled}
              onPress={() => onSelect(gregorianKey)}
            >
              <View
                style={[styles.ethDayCircle, selected && styles.ethSelected]}
              >
                <Text
                  style={[
                    styles.ethDayText,
                    isToday && styles.ethToday,
                    disabled && styles.ethDisabled,
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

const styles = StyleSheet.create({
  successBanner: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    zIndex: 100,
    elevation: 10,

    flexDirection: "row",
    alignItems: "center",

    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0F5F3",
    borderRadius: 18,

    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 18,

    boxShadow: "0 6px 14px rgba(0, 0, 0, 0.16)",

    overflow: "hidden",
  },

  successBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  successBannerContent: {
    flex: 1,
    paddingRight: 10,
  },

  successBannerText: {
    color: "#14201B",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },

  successBannerSubtext: {
    color: "#66766F",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    marginTop: 2,
  },

  successBannerProgress: {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: "65%",
    height: 4,
    borderRadius: 999,
    backgroundColor: "#22C55E",
  },
  cancelModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.58)",
    justifyContent: "flex-end",
  },

  cancelModalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 34,
  },

  cancelModalHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#CBD8D2",
    alignSelf: "center",
    marginBottom: 28,
  },

  cancelModalTitle: {
    color: "#14201B",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.5,
  },

  cancelModalMessage: {
    color: "#66766F",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 28,
  },

  keepBookingButton: {
    minHeight: 56,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  keepBookingButtonText: {
    color: "#F7F8FA",
    fontSize: 17,
    fontWeight: "900",
  },

  confirmCancelButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },

  confirmCancelButtonText: {
    color: "#D92D20",
    fontSize: 16,
    fontWeight: "800",
  },

  cancelModalButtonPressed: {
    opacity: 0.7,
  },
  bookingFilterOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },

  bookingFilterSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
  },

  bookingFilterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  bookingFilterTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },

  bookingFilterSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 18,
    marginBottom: 6,
  },

  bookingFilterOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },

  bookingFilterOptionText: {
    fontSize: 16,
    color: COLORS.text,
  },

  bookingFilterChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
  },

  bookingFilterChip: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },

  bookingFilterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  bookingFilterChipText: {
    color: "#66766F",
    fontSize: 14,
    fontWeight: "600",
  },

  bookingFilterChipTextActive: {
    color: "#F7F8FA",
    fontWeight: "700",
  },

  bookingFilterActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },

  bookingResetButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  bookingResetText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.primary,
  },

  bookingShowButton: {
    flex: 2,
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  bookingShowButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.background,
  },

  bookingFilterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },

  searchBox: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: "#DDE6E2",
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 6,
    backgroundColor: COLORS.surface,
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
    elevation: 1,
  },

  searchInput: {
    flex: 1,
    marginLeft: 9,
    marginRight: 4,
    color: "#14201B",
    fontSize: 15,
    minWidth: 0,
  },

  searchActionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  searchDivider: {
    width: StyleSheet.hairlineWidth,
    height: 26,
    backgroundColor: "#DDE6E2",
    marginHorizontal: 4,
  },

  searchFilterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  searchFilterButtonActive: {
    backgroundColor: COLORS.primary,
  },

  calendarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    marginBottom: 18,
  },

  activeDateFilterText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },

  ethMonthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
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
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  ethDayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  ethDayText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
  },

  ethToday: {
    color: COLORS.primary,
  },

  ethDisabled: {
    color: COLORS.textMuted,
    opacity: 0.5,
  },

  ethSelected: {
    backgroundColor: COLORS.primary,
  },

  ethSelectedText: {
    color: COLORS.background,
    fontWeight: "800",
  },

  calendarOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
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

  calendarTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "800",
  },

  calendarSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },

  calendarCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    paddingHorizontal: 20,
    paddingTop: 14,
  },

  contentDesktop: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 24,
  },

  title: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.8,
  },

  subtitle: {
    color: "#66766F",
    fontSize: 15,
    marginTop: 3,
    marginBottom: 18,
  },

  loadingContainer: {
    alignItems: "center",
    paddingTop: 80,
  },

  loadingText: {
    color: "#66766F",
    fontSize: 15,
    marginTop: 14,
  },

  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 30,
  },

  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "800",
  },

  emptyText: {
    color: "#66766F",
    fontSize: 15,
    marginTop: 7,
    textAlign: "center",
  },

  /* BOOKING CARDS */

  bookingList: {
    gap: 14,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    boxShadow: "0 4px 14px rgba(20, 32, 27, 0.06)",
    elevation: 2,
  },

  cancelledCard: {
    borderColor: "#E2D6D4",
  },

  bookingCardRow: {
    flexDirection: "column",
  },

  bookingThumb: {
    position: "relative",
    width: "100%",
    height: 118,
    backgroundColor: "#12333A",
    overflow: "hidden",
  },

  imageWrapper: {
    position: "relative",
    backgroundColor: "#12333A",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  imagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },

  imageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 15, 25, 0.08)",
  },

  gameFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#12333A",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  gameFallbackCenterLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  gameFallbackCenterCircle: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    top: "50%",
    left: "50%",
    marginLeft: -46,
    marginTop: -46,
  },

  gameFallbackAccent: {
    position: "absolute",
    left: 18,
    bottom: 16,
    width: 30,
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },

  gameFallbackTitle: {
    color: COLORS.white,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
  },

  cancelledImage: {
    opacity: 0.45,
  },

  bookingCardBody: {
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 14,
  },

  bookingCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  bookingCardTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800",
    letterSpacing: -0.25,
  },

  bookingMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 23,
  },

  bookingCardDate: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
  },

  bookingCardLocation: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 19,
  },

  bookingCardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  bookingCardPrice: {
    color: COLORS.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
    marginTop: 9,
  },

  bookingStatusPill: {
    position: "absolute",
    top: 12,
    right: 12,
    maxWidth: "72%",
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    zIndex: 2,
  },

  bookingStatusPillWarning: {
    backgroundColor: "#FFF1C7",
  },

  bookingStatusPillCancelled: {
    backgroundColor: "#FFF1F1",
  },

  bookingStatusPillText: {
    flexShrink: 1,
    color: COLORS.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },

  bookingStatusPillTextWarning: {
    color: "#9A6700",
  },

  bookingStatusPillTextCancelled: {
    color: COLORS.danger,
  },

  cardContent: {
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 14,
  },

  /*
   * Kept because existing code elsewhere may still reference
   * these styles. Normal booking status now appears on the image.
   */
  statusRow: {
    flexDirection: "row",
    marginBottom: 10,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  statusText: {
    fontSize: 13,
    fontWeight: "700",
  },

  gameTitle: {
    color: "#14201B",
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.2,
  },

  cancelledGameTitle: {
    color: "#C6CFCA",
  },

  organizer: {
    color: "#66766F",
    fontSize: 14,
    marginTop: 1,
    marginBottom: 8,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 5,
  },

  infoText: {
    color: "#66766F",
    fontSize: 14,
    flexShrink: 1,
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },

  formatBadge: {
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
  },

  formatText: {
    color: "#4A4A4A",
    fontSize: 14,
    fontWeight: "600",
  },

  price: {
    color: "#14201B",
    fontSize: 17,
    fontWeight: "700",
  },

  cancelledPrice: {
    color: COLORS.textSecondary,
  },

  paymentSection: {
    marginTop: 18,
    backgroundColor: "#FFF9E8",
    borderWidth: 1,
    borderColor: "#765A00",
    borderRadius: 16,
    padding: 14,
  },

  paymentHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  paymentTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },

  paymentDescription: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },

  paymentAccountCard: {
    marginTop: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 13,
    paddingHorizontal: 13,
  },

  paymentAccountRow: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  paymentDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  paymentLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },

  paymentValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },

  paymentAmount: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "800",
  },

  paymentInstruction: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },

  paidButton: {
    height: 50,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    marginTop: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  paidButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "800",
  },

  waitingPaymentNotice: {
    marginTop: 14,
    backgroundColor: "#FFF8E7",
    borderWidth: 1,
    borderColor: "#765A00",
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  waitingPaymentHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  waitingPaymentIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#D89A00", alignItems: "center", justifyContent: "center" },
  waitingPaymentContent: { flex: 1, minWidth: 0 },
  waitingPaymentTitle: { color: "#9A6700", fontSize: 14, fontWeight: "800" },
  waitingPaymentText: { color: "#8A7450", fontSize: 12, lineHeight: 17, marginTop: 2 },
  waitingPaymentDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#765A00", marginVertical: 10 },
  waitingPaymentStatusRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  waitingPaymentStatusText: { flex: 1, color: "#9A6700", fontSize: 13, lineHeight: 18, fontWeight: "700" },

  confirmedPaymentNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F0F5F3",
    borderWidth: 1,
    borderColor: "#B9E5CF",
    borderRadius: 13,
    padding: 13,
    marginTop: 17,
  },

  confirmedPaymentTitle: {
    color: "#00B77A",
    fontSize: 14,
    fontWeight: "800",
  },

  confirmedPaymentText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },

  venueNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F0F5F3",
    borderRadius: 13,
    padding: 13,
    marginTop: 17,
  },

  venueTitle: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "800",
  },

  venueText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },

  refundNotice: {
    backgroundColor: "#FFF8E7",
    borderWidth: 1,
    borderColor: "#765A00",
    borderRadius: 13,
    padding: 13,
    marginTop: 17,
  },

  refundHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },

  refundTitle: {
    color: "#9A6700",
    fontSize: 14,
    fontWeight: "800",
  },

  refundNoticeText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },

  contactCard: {
    marginTop: 13,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
  },

  contactLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },

  contactValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 3,
  },

  contactDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 11,
  },

  contactPhone: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 4,
  },

  callButton: {
    height: 44,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  callButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },

  noContactText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },

  historyNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#F0F5F3",
    borderRadius: 12,
    padding: 12,
    marginTop: 17,
  },

  historyNoticeText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },

  cancelButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 13,
    paddingVertical: 5,
    paddingRight: 8,
  },

  cancelText: {
    color: "#C13515",
    fontSize: 14,
    fontWeight: "600",
  },

  disabledButton: {
    opacity: 0.6,
  },
});
