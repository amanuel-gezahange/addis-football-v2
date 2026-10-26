import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import GameBookingAction, {
  type GameBookingState,
} from "../../components/GameBookingAction";
import { COLORS } from "../../constants/colors";
import { useLanguage } from "../../i18n/LanguageContext";
import { supabase } from "../../lib/supabase";

type JoinedPlayer = {
  bookingId: number;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  quantity: number;
};

type GameDetails = {
  id: number;
  title: string;
  organizer: string | null;
  area: string | null;
  distance: string | null;
  time: string | null;
  format: string | null;
  skill: string | null;
  price: number;
  spots_left: number;
  status: string | null;
  image_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  payment_method: "organizer" | "venue" | "free" | null;
  payment_provider: string | null;
  payment_phone: string | null;
  payment_account_name: string | null;
  accepts_telebirr: boolean;
  accepts_mobile_banking: boolean;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  city: string | null;
  maps_url: string | null;
};

const GAME_DETAIL_HERO = require("../../../assets/images/game-detail-hero.jpg");

export default function GameDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language, t } = useLanguage();

  const [game, setGame] = useState<GameDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [bookingState, setBookingState] = useState<GameBookingState>({
    bookingStatus: null,
    paymentStatus: null,
    paymentMethod: Number(game?.price ?? 0) > 0 ? "organizer" : "free",
    paymentProvider: null,
  });

  useEffect(() => {
    loadGame();
  }, [id]);

  useEffect(() => {
    let active = true;

    async function loadFavorite() {
      if (!id) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id;

      if (!userId || !active) {
        return;
      }

      const { data, error: favoriteError } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", userId)
        .eq("game_id", Number(id))
        .maybeSingle();

      if (!active) {
        return;
      }

      if (favoriteError) {
        console.log("Favorite lookup error:", favoriteError);
        return;
      }

      setIsFavorite(Boolean(data));
    }

    loadFavorite();

    return () => {
      active = false;
    };
  }, [id]);

  async function loadGame() {
    if (!id) {
      setError(t("gameDetails.gameNotFound"));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: gameError } = await supabase
      .from("games")
      .select(
        `
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
          starts_at,
          ends_at,
          payment_method,
          payment_provider,
          payment_phone,
          payment_account_name,
          accepts_telebirr,
          accepts_mobile_banking,
          bank_name,
          bank_account_number,
          bank_account_name,
          city,
          maps_url
        `,
      )
      .eq("id", Number(id))
      .single();

    if (gameError || !data) {
      console.log("Game details error:", gameError?.message);

      setError(t("gameDetails.couldNotLoadGame"));
      setGame(null);
      setLoading(false);
      return;
    }

    setGame(data as GameDetails);
    setLoading(false);
  }

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
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

  const AMHARIC_WEEKDAYS = ["እሑድ", "ሰኞ", "ማክሰኞ", "ረቡዕ", "ሐሙስ", "ዓርብ", "ቅዳሜ"];

  const OROMO_WEEKDAYS = [
    "Dilbata",
    "Wiixata",
    "Kibxata",
    "Roobii",
    "Kamisa",
    "Jimaata",
    "Sanbata",
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

    const weekdays = language === "om" ? OROMO_WEEKDAYS : AMHARIC_WEEKDAYS;

    return {
      ...eth,
      monthName: months[eth.month - 1],
      weekday: weekdays[date.getDay()],
    };
  }

  function getLocale() {
    if (language === "am") return "am-ET";
    if (language === "om") return "om-ET";

    return "en-US";
  }

  function formatDate(value: string | null) {
    if (!value) return null;

    if (language === "am" || language === "om") {
      const ethiopian = getEthiopianDate(value, language as EthiopianLanguage);

      const separator = language === "am" ? "፣ " : ", ";

      return `${ethiopian.weekday}${separator}${ethiopian.monthName} ${ethiopian.day}, ${ethiopian.year}`;
    }

    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Addis_Ababa",
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  }

  function formatTime(value: string | null) {
    if (!value) return null;

    return new Intl.DateTimeFormat(getLocale(), {
      timeZone: "Africa/Addis_Ababa",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  }

  function getTimeRange() {
    if (!game) return "";

    const start = formatTime(game.starts_at);
    const end = formatTime(game.ends_at);

    if (start && end) {
      return `${start} – ${end}`;
    }

    if (start) {
      return start;
    }

    return game.time ?? "";
  }

  function getLocation() {
    if (!game) return "";

    const area = String(game.area ?? "").trim();
    const city = String(game.city ?? "").trim();

    if (area && city && !area.toLowerCase().includes(city.toLowerCase())) {
      return `${area}, ${city}`;
    }

    return area || city;
  }

  function getSkillLabel(skill: string | null) {
    if (!skill) {
      return t("gameDetails.allLevels");
    }

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

  function shouldShowCitySeparately() {
    if (!game?.city) return false;

    const area = String(game.area ?? "")
      .trim()
      .toLowerCase();

    const city = String(game.city).trim().toLowerCase();

    if (!city) return false;

    return !area.includes(city);
  }

  async function toggleFavorite() {
    if (!game || favoriteLoading) {
      return;
    }

    setFavoriteLoading(true);

    const previousFavoriteState = isFavorite;

    setIsFavorite(!previousFavoriteState);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setIsFavorite(previousFavoriteState);
        router.push("/login");
        return;
      }

      if (previousFavoriteState) {
        const { error: deleteError } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("game_id", game.id);

        if (deleteError) {
          throw deleteError;
        }
      } else {
        const { error: insertError } = await supabase.from("favorites").insert({
          user_id: user.id,
          game_id: game.id,
        });

        if (insertError) {
          throw insertError;
        }
      }
    } catch (favoriteError) {
      console.log("Favorite toggle error:", favoriteError);

      setIsFavorite(previousFavoriteState);
    } finally {
      setFavoriteLoading(false);
    }
  }

  async function openLocation() {
    if (!game) return;

    const savedMapsUrl = String(game.maps_url ?? "").trim();

    const location = getLocation();

    const targetUrl =
      savedMapsUrl ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        location,
      )}`;

    try {
      await Linking.openURL(targetUrl);
    } catch (locationError) {
      console.log("Could not open game location:", locationError);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingSafeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !game) {
    return (
      <SafeAreaView style={styles.loadingSafeArea}>
        <View style={styles.errorScreen}>
          <Pressable style={styles.errorBackButton} onPress={goBack}>
            <Ionicons name="arrow-back" size={21} color="#00B77A" />

            <Text style={styles.errorBackText}>
              {t("gameDetails.discover")}
            </Text>
          </Pressable>

          <View style={styles.errorContent}>
            <View style={styles.errorIcon}>
              <Ionicons name="football-outline" size={30} color="#00B77A" />
            </View>

            <Text style={styles.errorTitle}>
              {t("gameDetails.gameUnavailable")}
            </Text>

            <Text style={styles.errorText}>
              {error ?? t("gameDetails.gameCouldNotBeFound")}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const date = formatDate(game.starts_at);
  const timeRange = getTimeRange();
  const location = getLocation();

  const isFull = game.status === "full" || Number(game.spots_left ?? 0) <= 0;

  const isFree = Number(game.price ?? 0) === 0;
  const isBookingConfirmed = bookingState.bookingStatus === "confirmed";

  const isPaymentSubmitted =
    bookingState.bookingStatus === "pending_payment" &&
    bookingState.paymentStatus === "submitted";

  const isPayAtVenue =
    isBookingConfirmed && !isFree && bookingState.paymentMethod === "venue";

  const isPaymentConfirmed =
    isBookingConfirmed && (isFree || bookingState.paymentStatus === "paid");

  const heroImage = game.image_url ? { uri: game.image_url } : GAME_DETAIL_HERO;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}

        <View style={styles.hero}>
          <Image
            source={heroImage}
            style={styles.heroImage}
            resizeMode="cover"
          />

          <View style={styles.heroOverlay} />

          <SafeAreaView
            edges={["top"]}
            style={styles.heroControls}
            pointerEvents="box-none"
          >
            <Pressable
              style={({ pressed }) => [
                styles.heroButton,
                pressed && styles.heroButtonPressed,
              ]}
              onPress={goBack}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={23} color="#F7F8FA" />
            </Pressable>

            {/* <Pressable
              style={({ pressed }) => [
                styles.heroButton,
                pressed && styles.heroButtonPressed,
              ]}
              onPress={toggleFavorite}
              disabled={favoriteLoading}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={
                isFavorite ? "Remove from favorites" : "Add to favorites"
              }
            >
              {favoriteLoading ? (
                <ActivityIndicator size="small" color="#F7F8FA" />
              ) : (
                <Ionicons
                  name={isFavorite ? "heart" : "heart-outline"}
                  size={23}
                  color="#F7F8FA"
                />
              )}
            </Pressable> */}
          </SafeAreaView>
        </View>

        {/* WHITE DETAILS SHEET */}

        <View style={styles.sheet}>
          {/* TITLE */}

          <View style={styles.titleSection}>
            <Text style={styles.title}>{game.title}</Text>

            {!!location && (
              <View style={styles.titleLocationRow}>
                <Ionicons name="location" size={16} color="#66766F" />

                <Text style={styles.heroLocation} numberOfLines={2}>
                  {location}
                </Text>
              </View>
            )}
          </View>

          {/* DATE + TIME */}

          {(date || timeRange) && (
            <View style={styles.scheduleCard}>
              {!!date && (
                <View style={styles.scheduleRow}>
                  <View style={styles.scheduleIcon}>
                    <Ionicons
                      name="calendar-outline"
                      size={21}
                      color={COLORS.primary}
                    />
                  </View>

                  <View style={styles.scheduleText}>
                    <Text style={styles.scheduleLabel}>{date}</Text>

                    {!!timeRange && (
                      <Text style={styles.scheduleValue}>{timeRange}</Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* QUICK GAME DETAILS */}

          <View style={styles.quickDetails}>
            <QuickDetail
              icon="football-outline"
              value={game.format || t("gameDetails.notSpecified")}
              label={t("gameDetails.format")}
            />

            <View style={styles.quickDivider} />

            <QuickDetail
              icon="speedometer-outline"
              value={getSkillLabel(game.skill)}
              label={t("gameDetails.skillLevel")}
            />

            <View style={styles.quickDivider} />

            <QuickDetail
              icon="people-outline"
              value={
                isFull ? t("gameDetails.gameFull") : String(game.spots_left)
              }
              label={
                isFull
                  ? t("gameDetails.availability")
                  : t("gameDetails.spotsLeft").replace("{count}", "").trim()
              }
              danger={isFull}
            />
          </View>

          <View style={styles.divider} />

          {/* HOST */}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("gameDetails.hostedBy")}</Text>

            <View style={styles.organizerCard}>
              <View style={styles.organizerAvatar}>
                <Ionicons name="person" size={22} color={COLORS.primary} />
              </View>

              <View style={styles.organizerText}>
                <Text style={styles.organizerName}>
                  {game.organizer || t("gameDetails.organizer")}
                </Text>

                <Text style={styles.organizerLabel}>
                  {t("gameDetails.gameOrganizer")}
                </Text>
              </View>

              <View style={styles.verifiedIcon}>
                <Ionicons
                  name="football-outline"
                  size={18}
                  color={COLORS.primary}
                />
              </View>
            </View>
          </View>

          {!!location && (
            <>
              <View style={styles.divider} />

              {/* LOCATION */}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {t("gameDetails.location")}
                </Text>

                <Pressable
                  style={({ pressed }) => [
                    styles.locationCard,
                    pressed && styles.locationCardPressed,
                  ]}
                  onPress={openLocation}
                >
                  <View style={styles.locationIcon}>
                    <Ionicons
                      name="location"
                      size={23}
                      color={COLORS.primary}
                    />
                  </View>

                  <View style={styles.locationText}>
                    <Text style={styles.locationName} numberOfLines={2}>
                      {location}
                    </Text>

                    {shouldShowCitySeparately() && !!game.city && (
                      <Text style={styles.locationCity}>{game.city}</Text>
                    )}

                    <Text style={styles.mapActionText}>
                      {t("gameDetails.viewOnMap")}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={21} color="#66766F" />
                </Pressable>
              </View>
            </>
          )}

          <View style={styles.divider} />

          {/* PAYMENT */}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("gameDetails.payment")}</Text>

            {isPayAtVenue ? (
              <View style={styles.paymentCard}>
                <View style={styles.paymentTopRow}>
                  <View style={styles.paymentIcon}>
                    <Ionicons
                      name="location-outline"
                      size={23}
                      color={COLORS.primary}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.payAtVenueTitle}>
                      {t("gameDetails.payAtVenue")}
                    </Text>
                    <Text style={styles.paymentPrice}>{game.price} ETB</Text>
                  </View>
                </View>

                <Text style={styles.paymentDescription}>
                  {t("gameDetails.paymentAtVenue")}
                </Text>
              </View>
            ) : isPaymentConfirmed ? (
              <View style={styles.paymentConfirmedCard}>
                <View style={styles.paymentConfirmedTop}>
                  <View style={styles.paymentConfirmedIcon}>
                    <Ionicons name="checkmark" size={22} color="#F7F8FA" />
                  </View>

                  <View style={styles.paymentConfirmedHeading}>
                    <Text style={styles.paymentConfirmedTitle}>
                      {t("gameDetails.paymentConfirmed")}
                    </Text>

                    <Text style={styles.paymentConfirmedPrice}>
                      {isFree ? t("gameDetails.free") : `${game.price} ETB`}
                    </Text>
                  </View>
                </View>

                {!isFree && bookingState.paymentProvider && (
                  <View style={styles.paymentMethodRow}>
                    <Text style={styles.paymentMethodLabel}>
                      {t("gameDetails.paymentMethod")}
                    </Text>

                    <Text style={styles.paymentMethodValue}>
                      {bookingState.paymentProvider}
                    </Text>
                  </View>
                )}
              </View>
            ) : isPaymentSubmitted ? (
              <View style={styles.paymentSubmittedCard}>
                <View style={styles.paymentSubmittedTop}>
                  <View style={styles.paymentSubmittedIcon}>
                    <Ionicons name="checkmark" size={22} color="#F7F8FA" />
                  </View>

                  <View style={styles.paymentSubmittedHeading}>
                    <Text style={styles.paymentSubmittedTitle}>
                      {t("gameCard.paymentSubmittedTitle")}
                    </Text>

                    <Text style={styles.paymentSubmittedPrice}>
                      {game.price} ETB
                      {bookingState.paymentProvider
                        ? ` • ${bookingState.paymentProvider}`
                        : ""}
                    </Text>
                  </View>
                </View>

                <View style={styles.paymentSubmittedStatus}>
                  <Ionicons name="time-outline" size={19} color="#9A6700" />

                  <Text style={styles.paymentSubmittedStatusText}>
                    {t("gameCard.waitingForOrganizer")}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.paymentCard}>
                <View style={styles.paymentTopRow}>
                  <View style={styles.paymentIcon}>
                    <Ionicons
                      name={
                        isFree ? "checkmark-circle-outline" : "wallet-outline"
                      }
                      size={23}
                      color={COLORS.primary}
                    />
                  </View>

                  <Text style={styles.paymentPrice}>
                    {isFree ? t("gameDetails.free") : `${game.price} ETB`}
                  </Text>
                </View>

                <Text style={styles.paymentDescription}>
                  {isFree
                    ? t("gameDetails.noPaymentRequired")
                    : game.payment_method === "venue"
                      ? t("gameDetails.paymentAtVenue")
                      : game.payment_method === "organizer"
                        ? t("gameDetails.organizerPaymentInstructions")
                        : t("gameDetails.paymentDetailsAfterReservation")}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.bottomSpace} />
          {isBookingConfirmed && (
            <>
              <View style={styles.divider} />

              <View style={styles.section}>
                <View style={styles.allSetHeader}>
                  <View style={styles.allSetIcon}>
                    <Ionicons
                      name="checkmark-circle"
                      size={25}
                      color="#00B77A"
                    />
                  </View>

                  <View style={styles.allSetHeading}>
                    <Text style={styles.allSetTitle}>
                      {t("gameDetails.youreAllSet")}
                    </Text>

                    <Text style={styles.allSetSubtitle}>
                      {!isPayAtVenue && isPaymentConfirmed && !isFree
                        ? t("gameDetails.spotAndPaymentConfirmed")
                        : t("gameDetails.spotConfirmedNextSteps")}
                    </Text>
                  </View>
                </View>

                {!!location && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.nextStep,
                      pressed && styles.nextStepPressed,
                    ]}
                    onPress={openLocation}
                  >
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>1</Text>
                    </View>

                    <View style={styles.stepContent}>
                      <Text style={styles.stepTitle}>
                        {t("gameDetails.goToField")}
                      </Text>

                      <Text style={styles.stepDescription}>
                        {t("gameDetails.openDirectionsToGame")}
                      </Text>
                    </View>
                  </Pressable>
                )}

                <View style={styles.nextStep}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>
                      {location ? "2" : "1"}
                    </Text>
                  </View>

                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>
                      {t("gameDetails.arriveEarly")}
                    </Text>

                    <Text style={styles.stepDescription}>
                      {t("gameDetails.arriveEarlyDescription")}
                    </Text>
                  </View>
                </View>

                <View style={styles.nextStep}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>
                      {location ? "3" : "2"}
                    </Text>
                  </View>

                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>
                      {t("gameDetails.findOrganizer")}
                    </Text>

                    <Text style={styles.stepDescription}>
                      {t("gameDetails.findOrganizerDescription")}
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* KEEP EXISTING BOOKING / PAYMENT LOGIC */}

      <GameBookingAction
        gameId={game.id}
        title={game.title}
        price={Number(game.price ?? 0)}
        spotsLeft={Number(game.spots_left ?? 0)}
        status={game.status}
        paymentMethod={game.payment_method ?? "free"}
        paymentProvider={game.payment_provider}
        paymentPhone={game.payment_phone}
        paymentAccountName={game.payment_account_name}
        acceptsTelebirr={game.accepts_telebirr}
        acceptsMobileBanking={game.accepts_mobile_banking}
        bankName={game.bank_name}
        bankAccountNumber={game.bank_account_number}
        bankAccountName={game.bank_account_name}
        onBookingStateChange={setBookingState}
        onDirectionsPress={location ? openLocation : undefined}
        onSpotsChange={(nextSpotsLeft) => {
          setGame((currentGame) => {
            if (!currentGame) {
              return currentGame;
            }

            return {
              ...currentGame,
              spots_left: nextSpotsLeft,
              status:
                nextSpotsLeft <= 0
                  ? "full"
                  : currentGame.status === "full"
                    ? "available"
                    : currentGame.status,
            };
          });
        }}
      />
    </View>
  );
}

type QuickDetailProps = {
  icon: "football-outline" | "speedometer-outline" | "people-outline";
  value: string;
  label: string;
  danger?: boolean;
};

function QuickDetail({ icon, value, label, danger = false }: QuickDetailProps) {
  return (
    <View style={styles.quickDetail}>
      <View style={[styles.quickIcon, danger && styles.quickIconDanger]}>
        <Ionicons
          name={icon}
          size={21}
          color={danger ? "#D92D3A" : COLORS.primary}
        />
      </View>

      <Text
        style={[styles.quickValue, danger && styles.quickValueDanger]}
        numberOfLines={1}
      >
        {value}
      </Text>

      <Text style={styles.quickLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  
  loadingSafeArea: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  screen: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ERROR */

  errorScreen: {
    flex: 1,
    paddingHorizontal: 20,
  },

  errorBackButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 48,
  },

  errorBackText: {
    color: "#00B77A",
    fontSize: 15,
    fontWeight: "700",
  },

  errorContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },

  errorIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#F0F5F3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  errorTitle: {
    color: "#14201B",
    fontSize: 22,
    fontWeight: "800",
  },

  errorText: {
    color: "#66766F",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 7,
  },

  hero: {
    position: "relative",
    width: "100%",
    height: 280,
    backgroundColor: "#B58B66",
    overflow: "hidden",
  },

  sheet: {
    position: "relative",
    marginTop: -24,

    backgroundColor: "#F7F8FA",

    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,

    overflow: "hidden",
  },

  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },

  title: {
    color: "#14201B",
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.6,
  },

  titleLocationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 6,
  },

  heroLocation: {
    flex: 1,
    color: "#66766F",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
  },

  scheduleCard: {
    marginHorizontal: 20,
    marginBottom: 12,

    paddingHorizontal: 14,
    paddingVertical: 12,

    borderRadius: 15,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#DDE6E2",
  },

  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },

  scheduleIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#F0F5F3",
  },

  scheduleText: {
    flex: 1,
  },

  scheduleLabel: {
    color: "#14201B",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },

  scheduleValue: {
    color: "#66766F",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },

  quickDetails: {
    flexDirection: "row",

    marginHorizontal: 20,
    marginBottom: 17,

    paddingVertical: 13,

    borderRadius: 16,

    backgroundColor: "#F7F8FA",

    borderWidth: 1,
    borderColor: "#DDE6E2",
  },

  quickDetail: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 5,
  },

  quickDivider: {
    width: 1,
    backgroundColor: "#DDE6E2",
    marginVertical: 3,
  },

  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#F0F5F3",
    marginBottom: 6,
  },

  quickIconDanger: {
    backgroundColor: "#FFF1F2",
  },

  quickValue: {
    color: "#14201B",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },

  quickValueDanger: {
    color: "#D92D3A",
  },

  quickLabel: {
    color: "#66766F",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2,
  },

  divider: {
    height: 1,
    backgroundColor: "#DDE6E2",
    marginHorizontal: 20,
  },

  section: {
    paddingHorizontal: 20,
    paddingVertical: 19,
  },

  sectionTitle: {
    color: "#14201B",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.25,
    marginBottom: 12,
  },

  heroImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },

  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(3, 12, 19, 0.08)",
  },

  heroControls: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,

    flexDirection: "row",
    justifyContent: "space-between",

    paddingHorizontal: 18,
    paddingTop: 8,
  },

  heroButton: {
    width: 44,
    height: 44,
    borderRadius: 22,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "rgba(5, 16, 24, 0.72)",

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },

  heroButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.94 }],
  },

  organizerCard: {
    flexDirection: "row",
    alignItems: "center",

    padding: 14,

    borderRadius: 16,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#DDE6E2",
  },

  organizerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,

    backgroundColor: "#F0F5F3",

    alignItems: "center",
    justifyContent: "center",
  },

  organizerText: {
    flex: 1,
    marginLeft: 12,
  },

  organizerName: {
    color: "#14201B",
    fontSize: 16,
    fontWeight: "800",
  },

  organizerLabel: {
    color: "#66766F",
    fontSize: 13,
    marginTop: 3,
  },

  verifiedIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,

    backgroundColor: "#F0F5F3",

    alignItems: "center",
    justifyContent: "center",
  },

  /* LOCATION */

  locationCard: {
    flexDirection: "row",
    alignItems: "center",

    padding: 14,

    borderRadius: 16,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#DDE6E2",
  },

  locationCardPressed: {
    opacity: 0.72,
  },

  locationIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,

    backgroundColor: "#F0F5F3",

    alignItems: "center",
    justifyContent: "center",
  },

  locationText: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },

  locationName: {
    color: "#14201B",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },

  locationCity: {
    color: "#66766F",
    fontSize: 13,
    marginTop: 3,
  },

  mapActionText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 5,
  },

  /* PAYMENT */

  paymentCard: {
    padding: 16,

    borderRadius: 16,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#DDE6E2",
  },

  paymentTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },

  paymentIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,

    backgroundColor: "#F0F5F3",

    alignItems: "center",
    justifyContent: "center",
  },

  paymentPrice: {
    color: "#14201B",
    fontSize: 23,
    fontWeight: "900",
  },

  payAtVenueTitle: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 2,
  },

  paymentDescription: {
    color: "#66766F",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
    maxWidth: 500,
  },

  bottomSpace: {
    height: 28,
  },
  paymentSubmittedCard: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: "#F7F8FA8E7",
    borderWidth: 1,
    borderColor: "#765A00",
  },

  paymentSubmittedTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },

  paymentSubmittedIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#D89A00",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },

  paymentSubmittedHeading: {
    flex: 1,
  },

  paymentSubmittedTitle: {
    color: "#9A6700",
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "800",
  },

  paymentSubmittedPrice: {
    color: "#14201B",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
    marginTop: 2,
  },

  paymentSubmittedStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 13,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "#765A00",
  },

  paymentSubmittedStatusText: {
    flex: 1,
    color: "#9A6700",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },

  paymentConfirmedCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#F0FAF4",
    borderWidth: 1,
    borderColor: "#DDE6E2",
  },

  paymentConfirmedTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  paymentConfirmedIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#00B77A",
    alignItems: "center",
    justifyContent: "center",
  },

  paymentConfirmedHeading: {
    flex: 1,
  },

  paymentConfirmedTitle: {
    color: "#00B77A",
    fontSize: 15,
    fontWeight: "800",
  },

  paymentConfirmedPrice: {
    color: "#14201B",
    fontSize: 23,
    fontWeight: "900",
    marginTop: 2,
  },

  paymentMethodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#D6EDDF",
  },

  paymentMethodLabel: {
    color: "#66766F",
    fontSize: 13,
    fontWeight: "600",
  },

  paymentMethodValue: {
    color: "#14201B",
    fontSize: 14,
    fontWeight: "800",
  },

  allSetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    marginBottom: 18,
  },

  allSetIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#F0F5F3",
    alignItems: "center",
    justifyContent: "center",
  },

  allSetHeading: {
    flex: 1,
  },

  allSetTitle: {
    color: "#14201B",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  allSetSubtitle: {
    color: "#66766F",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },

  nextStep: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1F3",
  },

  nextStepPressed: {
    opacity: 0.65,
  },

  stepNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F0F5F3",
    alignItems: "center",
    justifyContent: "center",
  },

  stepNumberText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "900",
  },

  stepContent: {
    flex: 1,
  },

  stepTitle: {
    color: "#14201B",
    fontSize: 15,
    fontWeight: "800",
  },

  stepDescription: {
    color: "#66766F",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
});
