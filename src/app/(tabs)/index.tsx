import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Calendar } from "react-native-calendars";
import { Modal } from "react-native";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { COLORS } from "../../constants/colors";
import { useLanguage } from "../../i18n/LanguageContext";
import { supabase } from "../../lib/supabase";
import { SafeAreaView } from "react-native-safe-area-context";

type Game = {
  id: string;
  title: string;
  organizer: string;
  area: string;
  distance: string | null;
  time: string;
  format: string;
  skill: string;
  price: number;
  spots_left: number;
  status: "available" | "full";
  image_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  payment_method: "free" | "venue" | "organizer";
  payment_provider: string | null;
  payment_phone: string | null;
  payment_account_name: string | null;
  city: string | null;
  maps_url: string | null;
};

type DiscoverGame = Game & {
  spotsLeft: number;
  image: string;
};

type DateOption = {
  key: string;
  day: string;
  date: string;
  fullDate: string;
};

const CITY_OPTIONS = [
  "All Ethiopia",
  "Addis Ababa",
  "Adama",
  "Bahir Dar",
  "Bishoftu",
  "Dire Dawa",
  "Gondar",
  "Hawassa",
  "Jimma",
  "Mekelle",
  "Dessie",
  "Arba Minch",
  "Shashamane",
  "Harar",
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 900;
  const isSmallScreen = width < 375;
  const isLargeScreen = width >= 768;
  const isTabletLayout = width >= 768 && width < 1100;
  const isDesktopLayout = width >= 1100;
  const isPhoneLayout = width < 768;

  /*
    Display dates in the selected language,
    but always keep the Gregorian calendar.
  */
  const dateLocale = "en-US-u-ca-gregory";

  const [games, setGames] = useState<DiscoverGame[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedGamesRef = useRef(false);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [selectedCity, setSelectedCity] = useState("Addis Ababa");
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const [sortBy, setSortBy] = useState<"soonest" | "price_low" | "spots">(
    "soonest",
  );

  const [skillFilter, setSkillFilter] = useState<string | null>(null);
  const [formatFilter, setFormatFilter] = useState<string | null>(null);
  const [priceFilter, setPriceFilter] = useState<"free" | "paid" | null>(null);

  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  const [favoriteGameIds, setFavoriteGameIds] = useState<Set<string>>(
    new Set(),
  );

  const isSearchMode = searchFocused || search.trim().length > 0;

  /*
    Generate the next 7 days.

    Database matching still uses the
    Addis Ababa calendar date.
  */
  const dates = useMemo(() => {
    const result: DateOption[] = [];

    const keyFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Addis_Ababa",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const now = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);

      const key = keyFormatter.format(date);

      let day = new Intl.DateTimeFormat(
        language === "am" ? "am-ET" : language === "om" ? "om-ET" : "en-US",
        {
          timeZone: "Africa/Addis_Ababa",
          weekday: "short",
        },
      ).format(date);

      if (i === 0) {
        day = t("discover.today");
      } else if (i === 1) {
        day = t("discover.tomorrow");
      }

      if (language === "am" || language === "om") {
        const ethiopian = getEthiopianDate(date, language);

        result.push({
          key,
          day,
          date: String(ethiopian.day),
          fullDate: ethiopian.label,
        });
      } else {
        result.push({
          key,
          day,
          date: new Intl.DateTimeFormat("en-US", {
            timeZone: "Africa/Addis_Ababa",
            day: "numeric",
          }).format(date),
          fullDate: new Intl.DateTimeFormat("en-US", {
            timeZone: "Africa/Addis_Ababa",
            month: "short",
            day: "numeric",
          }).format(date),
        });
      }
    }

    return result;
  }, [language, t]);

  /*
    Reload whenever Discover
    receives focus.
  */
  useFocusEffect(
    useCallback(() => {
      fetchGames(!hasLoadedGamesRef.current);

      async function refreshUserData() {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const userId = session?.user?.id;

        await Promise.all([
          fetchUnreadNotifications(userId),
          fetchFavorites(userId),
        ]);
      }

      refreshUserData();
    }, []),
  );

  async function fetchGames(showLoading: boolean) {
    if (showLoading) {
      setLoading(true);
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("games")
      .select(
        `
    id,
    title,
    organizer,
    area,
    city,
    time,
    format,
    skill,
    price,
    spots_left,
    status,
    image_url,
    starts_at,
    ends_at,
    payment_method
  `,
      )
      .neq("status", "cancelled")
      .not("starts_at", "is", null)
      .gte("starts_at", now)
      .order("starts_at", {
        ascending: true,
      });

    if (error) {
      console.log("Error loading games:", error.message);

      if (!hasLoadedGamesRef.current) {
        setGames([]);
      }

      if (showLoading) {
        setLoading(false);
      }

      return;
    }

    const mappedGames = (data || []).map((game) => ({
      ...game,

      id: String(game.id),

      spotsLeft: game.spots_left,

      image: game.image_url ?? "",
    })) as DiscoverGame[];

    setGames(mappedGames);
    hasLoadedGamesRef.current = true;

    if (showLoading) {
      setLoading(false);
    }
  }

  async function fetchUnreadNotifications(userId?: string) {
    if (!userId) {
      setHasUnreadNotifications(false);
      return;
    }

    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      console.log("Unread notifications error:", error.message);
      return;
    }

    setHasUnreadNotifications((count ?? 0) > 0);
  }
  async function fetchFavorites(userId?: string) {
    if (!userId) {
      setFavoriteGameIds(new Set());
      return;
    }

    const { data, error } = await supabase
      .from("favorites")
      .select("game_id")
      .eq("user_id", userId);

    if (error) {
      console.log("Favorites error:", error.message);
      return;
    }

    setFavoriteGameIds(
      new Set((data ?? []).map((favorite) => String(favorite.game_id))),
    );
  }

  async function toggleFavorite(gameId: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const userId = session?.user?.id;
    if (!userId) return;

    const isFavorite = favoriteGameIds.has(gameId);

    setFavoriteGameIds((current) => {
      const next = new Set(current);
      if (isFavorite) next.delete(gameId);
      else next.add(gameId);
      return next;
    });

    if (isFavorite) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", userId)
        .eq("game_id", gameId);

      if (error) {
        console.log("Remove favorite error:", error.message);
        fetchFavorites(userId);
      }
      return;
    }

    const { error } = await supabase.from("favorites").insert({
      user_id: userId,
      game_id: gameId,
    });

    if (error) {
      console.log("Add favorite error:", error.message);
      fetchFavorites(userId);
    }
  }

  function getAddisDateKey(timestamp: string) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Addis_Ababa",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(timestamp));
  }

  function formatGameDate(timestamp: string) {
    if (language === "am" || language === "om") {
      return getEthiopianDate(timestamp, language).label;
    }

    return new Intl.DateTimeFormat(dateLocale, {
      timeZone: "Africa/Addis_Ababa",
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(timestamp));
  }

  const visibleGames = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    // Standard app-style search:
    // - instant from the first character
    // - case-insensitive
    // - searches the fields a player naturally expects
    // - search results are ranked by relevance
    if (query) {
      return games
        .filter((game) => {
          if (!game.starts_at) {
            return false;
          }

          if (
            selectedCity !== "All Ethiopia" &&
            (game.city || "Addis Ababa").toLocaleLowerCase() !==
              selectedCity.toLocaleLowerCase()
          ) {
            return false;
          }

          const title = game.title.toLocaleLowerCase();
          const area = game.area.toLocaleLowerCase();
          const organizer = game.organizer.toLocaleLowerCase();
          const city = (game.city || "").toLocaleLowerCase();

          return (
            title.includes(query) ||
            area.includes(query) ||
            organizer.includes(query) ||
            city.includes(query)
          );
        })
        .sort((a, b) => {
          const aTitle = a.title.toLocaleLowerCase();
          const bTitle = b.title.toLocaleLowerCase();
          const aArea = a.area.toLocaleLowerCase();
          const bArea = b.area.toLocaleLowerCase();

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

          const aTime = new Date(a.starts_at!).getTime();
          const bTime = new Date(b.starts_at!).getTime();

          return aTime - bTime;
        });
    }

    // Normal Discover browsing when there is no search query.
    return games
      .filter((game) => {
        if (!game.starts_at) {
          return false;
        }

        if (
          selectedCity !== "All Ethiopia" &&
          (game.city || "Addis Ababa").toLocaleLowerCase() !==
            selectedCity.toLocaleLowerCase()
        ) {
          return false;
        }

        const gameDate = getAddisDateKey(game.starts_at);

        if (selectedDate && gameDate !== selectedDate) {
          return false;
        }

        if (
          skillFilter &&
          game.skill.toLocaleLowerCase() !== skillFilter.toLocaleLowerCase()
        ) {
          return false;
        }

        if (
          formatFilter &&
          game.format.toLocaleLowerCase() !== formatFilter.toLocaleLowerCase()
        ) {
          return false;
        }

        if (priceFilter === "free" && game.payment_method !== "free") {
          return false;
        }

        if (priceFilter === "paid" && game.payment_method === "free") {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price_low") {
          return a.price - b.price;
        }

        if (sortBy === "spots") {
          return b.spots_left - a.spots_left;
        }

        const aTime = a.starts_at
          ? new Date(a.starts_at).getTime()
          : Number.MAX_SAFE_INTEGER;

        const bTime = b.starts_at
          ? new Date(b.starts_at).getTime()
          : Number.MAX_SAFE_INTEGER;

        return aTime - bTime;
      });
  }, [
    games,
    search,
    selectedDate,
    selectedCity,
    skillFilter,
    formatFilter,
    priceFilter,
    sortBy,
  ]);

  const playingSoonGames = isSearchMode ? [] : visibleGames.slice(0, 3);

  const listGames = isSearchMode ? visibleGames : visibleGames.slice(3);

  const listColumnCount = isDesktopLayout ? 3 : isTabletLayout ? 2 : 1;

  const listRows = useMemo(() => {
    const rows: DiscoverGame[][] = [];

    for (let index = 0; index < listGames.length; index += listColumnCount) {
      rows.push(listGames.slice(index, index + listColumnCount));
    }

    return rows;
  }, [listGames, listColumnCount]);

  const selectedDateLabel = useMemo(() => {
    const quickDate = dates.find((item) => item.key === selectedDate);

    if (quickDate) {
      return quickDate;
    }

    if (!selectedDate) {
      return null;
    }

    const [year, month, day] = selectedDate.split("-").map(Number);

    const selected = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    return {
      key: selectedDate,
      day: "",
      date: String(day),
      fullDate:
        language === "am" || language === "om"
          ? getEthiopianDate(selected, language).label
          : new Intl.DateTimeFormat(dateLocale, {
              timeZone: "Africa/Addis_Ababa",
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(selected),
    };
  }, [dates, selectedDate, dateLocale, language]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <FlatList
          data={listRows}
          key={`games-${listColumnCount}-${isSearchMode ? "search" : "browse"}`}
          keyExtractor={(row) => row.map((game) => game.id).join("-")}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            isDesktopWeb && styles.scrollContentDesktop,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== "web"}
          renderItem={({ item: row }) => (
            <View style={styles.gameGrid}>
              {row.map((game) => (
                <View
                  key={game.id}
                  style={[
                    styles.gameWrapper,
                    isTabletLayout && styles.gameWrapperTablet,
                    isDesktopLayout && styles.gameWrapperDesktop,
                  ]}
                >
                  <HorizontalGameCard
                    game={game}
                    isFavorite={favoriteGameIds.has(String(game.id))}
                    onPress={() => router.push(`/game/${game.id}`)}
                    onToggleFavorite={() => toggleFavorite(game.id)}
                    formatDate={formatGameDate}
                  />
                </View>
              ))}
            </View>
          )}
          ListHeaderComponent={
            <>
              {/* CINEMATIC HERO / PHONE SEARCH MODE */}

              {isSearchMode ? (
                <View style={styles.searchModeHeader}>
                  <View style={styles.searchModeBox}>
                    <Ionicons name="search" size={21} color="#14201B" />
                    <TextInput
                      value={search}
                      onChangeText={(text) => {
                        setSearch(text);

                        if (text.length === 0) {
                          setSearchFocused(false);
                        }
                      }}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => setSearchFocused(false)}
                      placeholder={t("discover.searchPlaceholder")}
                      placeholderTextColor="#66766F"
                      style={styles.searchModeInput}
                      autoFocus
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="search"
                      blurOnSubmit
                      clearButtonMode="never"
                      selectionColor={COLORS.primary}
                    />
                    {search.length > 0 && (
                      <Pressable
                        style={styles.searchActionButton}
                        onPress={() => {
                          setSearch("");
                          setSearchFocused(false);
                        }}
                        hitSlop={8}
                      >
                        <Ionicons
                          name="close"
                          size={22}
                          color={COLORS.textSecondary}
                        />
                      </Pressable>
                    )}
                    <View style={styles.heroSearchDivider} />
                    <Pressable
                      style={[
                        styles.heroFilterButton,
                        (skillFilter ||
                          formatFilter ||
                          priceFilter ||
                          sortBy !== "soonest") &&
                          styles.heroFilterButtonActive,
                      ]}
                      onPress={() => setFilterModalVisible(true)}
                      hitSlop={6}
                    >
                      <Ionicons
                        name="options-outline"
                        size={21}
                        color={
                          skillFilter ||
                          formatFilter ||
                          priceFilter ||
                          sortBy !== "soonest"
                            ? "#F7F8FA"
                            : COLORS.primary
                        }
                      />
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View
                  style={[
                    styles.hero,
                    isSmallScreen && styles.heroSmall,
                    isLargeScreen && styles.heroLarge,
                    isDesktopWeb && styles.heroDesktopFullBleed,
                  ]}
                >
                  <Image
                    source={require("../../../assets/images/discover-hero.jpg")}
                    style={styles.heroArtwork}
                    resizeMode="cover"
                  />
                  <View style={styles.heroOverlay} />
                  <View style={styles.heroBottomShade} />
                  <View
                    style={[
                      styles.heroContent,
                      isSmallScreen && styles.heroContentSmall,
                      isLargeScreen && styles.heroContentLarge,
                    ]}
                  >
                    <View style={styles.heroTopBar}>
                      <View>
                        <Text style={styles.heroBrand}>
                          Addis{" "}
                          <Text style={styles.heroBrandAccent}>Football</Text>
                        </Text>
                        <Pressable
                          style={styles.heroLocation}
                          onPress={() => setCityModalVisible(true)}
                        >
                          <Ionicons
                            name="location-outline"
                            size={16}
                            color="rgba(255,255,255,0.85)"
                          />
                          <Text style={styles.heroLocationText}>
                            {selectedCity === "All Ethiopia"
                              ? t("discover.allEthiopia")
                              : selectedCity}
                          </Text>
                          <Ionicons
                            name="chevron-down"
                            size={15}
                            color="rgba(255,255,255,0.85)"
                          />
                        </Pressable>
                      </View>
                      <Pressable
                        style={styles.heroNotificationButton}
                        onPress={() => router.push("/notifications")}
                        accessibilityRole="button"
                        accessibilityLabel="Notifications"
                      >
                        <Ionicons
                          name="notifications-outline"
                          size={22}
                          color="#F7F8FA"
                        />
                        {hasUnreadNotifications && (
                          <View style={styles.notificationDot} />
                        )}
                      </Pressable>
                    </View>
                    <View style={styles.heroMessage}>
                      <Text
                        style={[
                          styles.heroTitle,
                          isSmallScreen && styles.heroTitleSmall,
                          isLargeScreen && styles.heroTitleLarge,
                        ]}
                      >
                        {t("discover.findYourNextGame")}
                      </Text>

                      <Text style={styles.heroSubtitle}>
                        {t("discover.heroSubtitle")}
                      </Text>
                    </View>
                    <View style={styles.heroSearchBox}>
                      <Ionicons name="search" size={21} color="#14201B" />
                      <TextInput
                        value={search}
                        onChangeText={(text) => {
                          setSearch(text);

                          if (text.length === 0) {
                            setSearchFocused(false);
                          }
                        }}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                        placeholder={t("discover.searchPlaceholder")}
                        placeholderTextColor="#66766F"
                        style={styles.heroSearchInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        blurOnSubmit
                        clearButtonMode="never"
                        selectionColor={COLORS.primary}
                      />
                      {search.length > 0 && (
                        <Pressable
                          style={styles.searchActionButton}
                          onPress={() => {
                            setSearch("");
                            setSearchFocused(false);
                          }}
                          hitSlop={8}
                        >
                          <Ionicons
                            name="close"
                            size={22}
                            color={COLORS.textSecondary}
                          />
                        </Pressable>
                      )}
                      <View style={styles.heroSearchDivider} />
                      <Pressable
                        style={[
                          styles.heroFilterButton,
                          (skillFilter ||
                            formatFilter ||
                            priceFilter ||
                            sortBy !== "soonest") &&
                            styles.heroFilterButtonActive,
                        ]}
                        onPress={() => setFilterModalVisible(true)}
                        hitSlop={6}
                      >
                        <Ionicons
                          name="options-outline"
                          size={21}
                          color={
                            skillFilter ||
                            formatFilter ||
                            priceFilter ||
                            sortBy !== "soonest"
                              ? "#F7F8FA"
                              : COLORS.primary
                          }
                        />
                      </Pressable>
                    </View>
                  </View>
                </View>
              )}

              {/* DATE SELECTOR */}

              {!isSearchMode && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dateRow}
                  style={styles.dateScroll}
                >
                  {dates.map((item) => {
                    const active = selectedDate === item.key;

                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => setSelectedDate(item.key)}
                        style={({ pressed }) => [
                          styles.dateButton,
                          active && styles.dateButtonActive,
                          pressed && styles.dateButtonPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dateDay,
                            active && styles.dateTextActive,
                          ]}
                        >
                          {item.day}
                        </Text>

                        <Text
                          style={[
                            styles.dateNumber,
                            active && styles.dateTextActive,
                          ]}
                        >
                          {item.date}
                        </Text>
                      </Pressable>
                    );
                  })}

                  <Pressable
                    style={({ pressed }) => [
                      styles.headerNotificationButton,
                      pressed && styles.headerNotificationButtonPressed,
                    ]}
                    onPress={() => router.push("/notifications")}
                    accessibilityRole="button"
                    accessibilityLabel="Notifications"
                  >
                    <Ionicons
                      name="notifications-outline"
                      size={21}
                      color="#F7F8FA"
                    />
                    {hasUnreadNotifications && (
                      <View style={styles.notificationDot} />
                    )}
                  </Pressable>
                </ScrollView>
              )}

              {!isSearchMode && selectedDateLabel && (
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>
                      {t("discover.games")}
                    </Text>

                    <Text style={styles.sectionDate}>
                      {selectedDateLabel.fullDate}
                    </Text>
                  </View>

                  {!loading && (
                    <View style={styles.gameCountBadge}>
                      <Text style={styles.gameCount}>
                        {visibleGames.length}{" "}
                        {visibleGames.length === 1
                          ? t("discover.game")
                          : t("discover.gamesCount")}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* LOADING */}

              {loading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.primary} />

                  <Text style={styles.loadingText}>
                    {t("discover.findingGames")}
                  </Text>
                </View>
              )}

              {/* EMPTY */}

              {!loading && visibleGames.length === 0 && (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIcon}>
                    <Ionicons
                      name="football-outline"
                      size={32}
                      color={COLORS.primary}
                    />
                  </View>

                  <Text style={styles.emptyTitle}>
                    {t("discover.noGamesFound")}
                  </Text>

                  <Text style={styles.emptyText}>
                    {search.trim()
                      ? t("discover.noSearchResults")
                      : t("discover.noGamesForDay")}
                  </Text>
                </View>
              )}

              {!loading && visibleGames.length > 0 && isSearchMode && (
                <View style={styles.discoverySection}>
                  <View style={styles.discoverySectionHeader}>
                    <View style={styles.discoverySectionTitleRow}>
                      <Ionicons
                        name="search"
                        size={18}
                        color={COLORS.primary}
                      />
                      <Text style={styles.discoverySectionTitle}>
                        {t("discover.games")}
                      </Text>
                    </View>
                    <Text style={styles.discoverySectionMeta}>
                      {visibleGames.length}{" "}
                      {visibleGames.length === 1
                        ? t("discover.game")
                        : t("discover.gamesCount")}
                    </Text>
                  </View>
                </View>
              )}

              {!loading && !isSearchMode && playingSoonGames.length > 0 && (
                <>
                  <View style={styles.discoverySection}>
                    <View style={styles.discoverySectionHeader}>
                      <View style={styles.discoverySectionTitleRow}>
                        <Text style={styles.discoverySectionTitle}>
                          {t("discover.playingSoon")}
                        </Text>
                      </View>
                      <Text style={styles.discoverySectionMeta}>
                        {playingSoonGames.length}{" "}
                        {playingSoonGames.length === 1
                          ? t("discover.game")
                          : t("discover.gamesCount")}
                      </Text>
                    </View>

                    <View style={styles.gameGrid}>
                      {playingSoonGames.map((game) => (
                        <View
                          key={`soon-${game.id}`}
                          style={[
                            styles.gameWrapper,
                            isTabletLayout && styles.gameWrapperTablet,
                            isDesktopLayout && styles.gameWrapperDesktop,
                          ]}
                        >
                          <HorizontalGameCard
                            game={game}
                            isFavorite={favoriteGameIds.has(String(game.id))}
                            onPress={() => router.push(`/game/${game.id}`)}
                            onToggleFavorite={() => toggleFavorite(game.id)}
                            formatDate={formatGameDate}
                          />
                        </View>
                      ))}
                    </View>
                  </View>

                  {listGames.length > 0 && (
                    <View style={styles.discoverySection}>
                      <View style={styles.discoverySectionHeader}>
                        <View style={styles.discoverySectionTitleRow}>
                          <Ionicons
                            name="football-outline"
                            size={18}
                            color={COLORS.primary}
                          />
                          <Text style={styles.discoverySectionTitle}>
                            {t("discover.moreGames")}
                          </Text>
                        </View>
                        <Text style={styles.discoverySectionMeta}>
                          {listGames.length}{" "}
                          {listGames.length === 1
                            ? t("discover.game")
                            : t("discover.gamesCount")}
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </>
          }
        />

        {/* CITY MODAL */}

        <Modal
          visible={cityModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCityModalVisible(false)}
        >
          <Pressable
            style={styles.calendarOverlay}
            onPress={() => setCityModalVisible(false)}
          >
            <Pressable
              style={styles.calendarModal}
              onPress={(event) => event.stopPropagation()}
            >
              <View style={styles.calendarHeader}>
                <Text style={styles.calendarTitle}>
                  {t("discover.chooseCity")}
                </Text>

                <Pressable
                  style={styles.calendarCloseButton}
                  onPress={() => setCityModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.cityList}
                showsVerticalScrollIndicator={false}
              >
                {CITY_OPTIONS.map((city) => {
                  const selected = city === selectedCity;

                  return (
                    <Pressable
                      key={city}
                      style={[
                        styles.cityOption,
                        selected && styles.cityOptionSelected,
                      ]}
                      onPress={() => {
                        setSelectedCity(city);
                        setCityModalVisible(false);
                      }}
                    >
                      <Ionicons
                        name={selected ? "radio-button-on" : "radio-button-off"}
                        size={21}
                        color={selected ? COLORS.primary : COLORS.textSecondary}
                      />

                      <Text
                        style={[
                          styles.cityOptionText,
                          selected && styles.cityOptionTextSelected,
                        ]}
                      >
                        {city === "All Ethiopia"
                          ? t("discover.allEthiopia")
                          : city}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* CALENDAR MODAL */}

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
                    {t("discover.chooseDate")}
                  </Text>

                  <Text style={styles.calendarSubtitle}>
                    {t("discover.calendarSubtitle")}
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

        {/* FILTER MODAL */}

        <Modal
          visible={filterModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setFilterModalVisible(false)}
        >
          <View style={styles.filterOverlay}>
            <View style={styles.filterSheet}>
              {/* SCROLLABLE FILTER OPTIONS */}

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingBottom: 10,
                }}
              >
                <View style={styles.filterHeader}>
                  <Text style={styles.filterTitle}>
                    {t("discover.filterGames")}
                  </Text>

                  <Pressable onPress={() => setFilterModalVisible(false)}>
                    <Ionicons name="close" size={26} color={COLORS.text} />
                  </Pressable>
                </View>

                {/* SORT */}

                <Text style={styles.filterSectionTitle}>
                  {t("discover.sortBy")}
                </Text>

                <View style={styles.filterChipRow}>
                  {[
                    ["soonest", t("discover.soonest")],
                    ["price_low", t("discover.lowestPrice")],
                    ["spots", t("discover.mostSpotsAvailable")],
                  ].map(([value, label]) => {
                    const active = sortBy === value;

                    return (
                      <Pressable
                        key={value}
                        style={[
                          styles.filterChip,
                          active && styles.filterChipActive,
                        ]}
                        onPress={() =>
                          setSortBy(value as "soonest" | "price_low" | "spots")
                        }
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

                {/* PRICE */}

                <Text style={styles.filterSectionTitle}>
                  {t("discover.price")}
                </Text>

                <View style={styles.filterChipRow}>
                  {[
                    [null, t("discover.anyPrice")],
                    ["free", t("discover.free")],
                    ["paid", t("discover.paid")],
                  ].map(([value, label]) => {
                    const active = priceFilter === value;

                    return (
                      <Pressable
                        key={label}
                        style={[
                          styles.filterChip,
                          active && styles.filterChipActive,
                        ]}
                        onPress={() =>
                          setPriceFilter(value as "free" | "paid" | null)
                        }
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

                {/* SKILL */}

                <Text style={styles.filterSectionTitle}>
                  {t("discover.skillLevel")}
                </Text>

                <View style={styles.filterChipRow}>
                  {[
                    [null, t("discover.anySkill")],
                    ["Beginner", t("discover.beginner")],
                    ["Intermediate", t("discover.intermediate")],
                    ["Advanced", t("discover.advanced")],
                  ].map(([value, label]) => {
                    const active = skillFilter === value;

                    return (
                      <Pressable
                        key={label}
                        style={[
                          styles.filterChip,
                          active && styles.filterChipActive,
                        ]}
                        onPress={() => setSkillFilter(value)}
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

                {/* FORMAT */}

                <Text style={styles.filterSectionTitle}>
                  {t("discover.gameFormat")}
                </Text>

                <View style={styles.filterChipRow}>
                  {[
                    [null, t("discover.anyFormat")],
                    ["5v5", "5v5"],
                    ["6v6", "6v6"],
                    ["7v7", "7v7"],
                    ["11v11", "11v11"],
                  ].map(([value, label]) => {
                    const active = formatFilter === value;

                    return (
                      <Pressable
                        key={label}
                        style={[
                          styles.filterChip,
                          active && styles.filterChipActive,
                        ]}
                        onPress={() => setFormatFilter(value)}
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
              </ScrollView>

              {/* FIXED BOTTOM BUTTONS */}

              <View style={styles.filterActions}>
                <Pressable
                  style={styles.resetFilterButton}
                  onPress={() => {
                    setSortBy("soonest");
                    setSkillFilter(null);
                    setFormatFilter(null);
                    setPriceFilter(null);
                  }}
                >
                  <Text style={styles.resetFilterText}>
                    {t("discover.reset")}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.showGamesButton}
                  onPress={() => setFilterModalVisible(false)}
                >
                  <Text style={styles.showGamesText}>
                    {t("discover.showGames")}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function HorizontalGameCard({
  game,
  isFavorite,
  onPress,
  onToggleFavorite,
  formatDate,
}: {
  game: DiscoverGame;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  formatDate: (timestamp: string) => string;
}) {
  const isFull = game.status === "full" || game.spotsLeft <= 0;
  const isFree = game.payment_method === "free" || Number(game.price) === 0;

  const dateLabel = game.starts_at ? formatDate(game.starts_at) : "";

  const startTimeLabel = game.starts_at
    ? formatAddisTime(game.starts_at)
    : getStartTimeFromLegacyTime(game.time);

  const endTimeLabel = game.ends_at
    ? formatAddisTime(game.ends_at)
    : getEndTimeFromLegacyTime(game.time);

  const durationLabel =
    game.starts_at && game.ends_at
      ? formatDuration(game.starts_at, game.ends_at)
      : "";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.horizontalGameCard,
        pressed && styles.horizontalGameCardPressed,
      ]}
    >
      <View style={styles.horizontalGameArtwork}>
        {game.image_url ? (
          <Image
            source={{ uri: game.image_url }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        ) : (
          <>
            <View style={styles.pitchHalfwayLine} />
            <View style={styles.pitchCenterCircle} />
            <Ionicons
              name="football-outline"
              size={38}
              color="rgba(255,255,255,0.16)"
              style={styles.pitchBall}
            />
            <View style={styles.pitchAccent} />
          </>
        )}
      </View>

      <View style={styles.horizontalGameInfo}>
        <View style={styles.horizontalGameTopRow}>
          <Text numberOfLines={2} style={styles.horizontalGameTitle}>
            {game.title}
          </Text>

          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onToggleFavorite();
            }}
            hitSlop={10}
            style={styles.horizontalFavoriteButton}
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={22}
              color={isFavorite ? COLORS.primary : COLORS.text}
            />
          </Pressable>
        </View>

        <View style={styles.gameScheduleBlock}>
          <View style={styles.gameDateRow}>
            <Ionicons
              name="calendar-outline"
              size={15}
              color={COLORS.textSecondary}
            />
            <Text numberOfLines={1} style={styles.gameDateText}>
              {dateLabel}
            </Text>
          </View>

          <View style={styles.gameTimeRow}>
            <View style={styles.gameTimeRange}>
              <Ionicons name="time-outline" size={17} color={COLORS.primary} />
              <Text numberOfLines={1} style={styles.gameTimeText}>
                {startTimeLabel}
                {endTimeLabel ? ` – ${endTimeLabel}` : ""}
              </Text>
            </View>

            {!!durationLabel && (
              <View style={styles.durationBadge}>
                <Text style={styles.durationBadgeText}>{durationLabel}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.horizontalMetaRow}>
          <Ionicons
            name="location-outline"
            size={15}
            color={COLORS.textSecondary}
          />
          <Text numberOfLines={1} style={styles.horizontalMetaText}>
            {game.area}
          </Text>
        </View>

        <View style={styles.horizontalMetaRow}>
          <Ionicons
            name="people-outline"
            size={15}
            color={COLORS.textSecondary}
          />
          <Text numberOfLines={1} style={styles.horizontalMetaText}>
            {game.format} · {game.skill}
          </Text>
        </View>

        <View style={styles.horizontalGameBottomRow}>
          <Text style={styles.horizontalPrice}>
            {isFree ? "FREE" : `${game.price} ETB`}
          </Text>

          <View style={[styles.spotsBadge, isFull && styles.spotsBadgeFull]}>
            <Text
              style={[
                styles.spotsBadgeText,
                isFull && styles.spotsBadgeTextFull,
              ]}
            >
              {isFull
                ? "Full"
                : `${game.spotsLeft} ${
                    game.spotsLeft === 1 ? "spot" : "spots"
                  } left`}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function formatAddisTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Addis_Ababa",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));
}

function formatDuration(startTimestamp: string, endTimestamp: string) {
  const start = new Date(startTimestamp).getTime();
  const end = new Date(endTimestamp).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return "";
  }

  const totalMinutes = Math.round((end - start) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

function getStartTimeFromLegacyTime(value: string) {
  if (!value) return "";

  const parts = value.split(/\s*[-–]\s*/);
  return parts[0]?.trim() ?? value.trim();
}

function getEndTimeFromLegacyTime(value: string) {
  if (!value) return "";

  const parts = value.split(/\s*[-–]\s*/);
  return parts.length > 1 ? parts.slice(1).join(" – ").trim() : "";
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

  // Always render 6 calendar rows.
  // This keeps the popup the same height for every Ethiopian month,
  // including Pagume.
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
  hero: {
    minHeight: 250,
    borderRadius: 0,
    overflow: "hidden",
    marginHorizontal: -20,
    marginTop: -20,
    marginBottom: 18,
    backgroundColor: "#07131A",
  },

  heroSmall: {
    minHeight: 235,
    borderRadius: 0,
  },

  heroLarge: {
    minHeight: 270,
  },

  heroDesktopFullBleed: {
    marginHorizontal: -28,
    marginTop: -22,
  },
  heroArtwork: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -42,
    width: "100%",
    height: 390,
  },

  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 10, 18, 0.22)",
  },

  heroBottomShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "62%",
    backgroundColor: "rgba(2, 10, 18, 0.12)",
  },
  heroContent: {
    flex: 1,
    minHeight: 250,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 18,
    justifyContent: "space-between",
  },

  heroContentSmall: {
    minHeight: 235,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },

  heroContentLarge: {
    minHeight: 270,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 18,
  },
  heroTopBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  heroBrand: {
    color: "#F7F8FA",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  heroBrandAccent: { color: COLORS.primary },
  heroLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 5,
  },
  heroLocationText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    fontWeight: "600",
  },
  headerNotificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },
  headerNotificationButtonPressed: {
    opacity: 0.82,
  },
  heroNotificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  heroMessage: { marginTop: "auto", marginBottom: 10 },
  heroTitle: {
    color: "#F7F8FA",
    fontSize: 30,
    lineHeight: 31,
    fontWeight: "900",
    letterSpacing: -1.3,
    maxWidth: 300,
  },

  heroTitleSmall: {
    fontSize: 28,
    lineHeight: 29,
    letterSpacing: -1,
    maxWidth: 270,
  },

  heroTitleLarge: {
    fontSize: 34,
    lineHeight: 35,
    maxWidth: 380,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500",
    maxWidth: 290,
    marginTop: 10,
  },
  heroSearchBox: {
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F7F8FA",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 17,
    paddingRight: 7,
  },
  heroSearchInput: {
    flex: 1,
    minWidth: 0,
    marginLeft: 9,
    marginRight: 4,
    color: "#14201B",
    fontSize: 15,
  },
  heroSearchDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: "#DDE6E2",
    marginHorizontal: 4,
  },
  heroFilterButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  heroFilterButtonActive: { backgroundColor: COLORS.primary },

  searchModeHeader: {
    marginBottom: 18,
    paddingTop: 2,
  },

  searchModeBox: {
    height: 54,
    borderRadius: 18,
    backgroundColor: "#F7F8FA",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  searchModeInput: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    marginRight: 4,
    color: "#14201B",
    fontSize: 16,
    fontWeight: "500",
    paddingVertical: 0,
  },

  filterChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
  },

  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#DDE6E2",
    backgroundColor: "#F7F8FA",
  },

  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  filterChipText: {
    color: "#6A6A6A",
    fontSize: 14,
    fontWeight: "600",
  },

  filterChipTextActive: {
    color: "#F7F8FA",
    fontWeight: "700",
  },

  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },

  filterOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },

  filterSheet: {
    backgroundColor: "#F7F8FA",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    maxHeight: "85%",
  },

  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  filterTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#14201B",
  },

  filterSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#14201B",
    marginTop: 18,
    marginBottom: 6,
  },

  filterOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#DDE6E2",
  },

  filterOptionText: {
    fontSize: 16,
    color: "#14201B",
  },

  filterActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },

  resetFilterButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#14201B",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F8FA",
  },

  resetFilterText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#14201B",
  },

  showGamesButton: {
    flex: 2,
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  showGamesText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F7F8FA",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },

  scrollContentDesktop: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 24,
  },

  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  title: {
    color: "#14201B",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.8,
  },

  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },

  locationText: {
    color: "#6A6A6A",
    fontSize: 16,
    fontWeight: "500",
  },

  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#DDE6E2",

    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
    elevation: 1,
  },

  notificationDot: {
    position: "absolute",
    right: 8,
    top: 7,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.danger,
    borderWidth: 2,
    borderColor: "#F7F8FA",
  },

  searchRow: {
    flexDirection: "row",
    marginBottom: 16,
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
    backgroundColor: "#F7F8FA",

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

  dateScroll: {
    width: "100%",
  },

  calendarDateButton: {
    alignItems: "center",
    justifyContent: "center",
  },

  dateRow: {
    gap: 8,
    paddingBottom: 17,
  },

  dateButton: {
    minWidth: 70,
    minHeight: 62,
    paddingHorizontal: 13,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },

  dateButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  dateButtonPressed: {
    opacity: 0.82,
  },

  dateDay: {
    color: COLORS.textSecondary,
    fontWeight: "700",
    fontSize: 11,
  },

  dateNumber: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 18,
    marginTop: 1,
  },

  dateTextActive: {
    color: "#F8FAF9",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "700",
  },

  sectionDate: {
    color: "#66766F",
    fontSize: 13,
    marginTop: 2,
  },

  gameCountBadge: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
  },

  gameCount: {
    color: "#14201B",
    fontSize: 13,
    fontWeight: "600",
  },

  loadingContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },

  loadingText: {
    color: "#66766F",
    fontSize: 14,
    marginTop: 13,
  },

  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 25,
  },

  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    color: "#14201B",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 17,
  },

  emptyText: {
    color: "#66766F",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 7,
  },

  discoverySection: {
    marginTop: 4,
    marginBottom: 18,
  },

  discoverySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 3,
  },

  discoverySectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  discoverySectionEmoji: {
    fontSize: 17,
  },

  discoverySectionTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },

  discoverySectionMeta: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "700",
  },

  gameGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },

  gameWrapper: {
    width: "100%",
    paddingHorizontal: 6,
  },

  gameWrapperTablet: {
    width: "50%",
  },

  gameWrapperDesktop: {
    width: "33.333333%",
  },

  gameDateLabel: {
    color: "#66766F",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    marginLeft: 3,
    textTransform: "uppercase",
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
    color: "#14201B",
    fontSize: 18,
    fontWeight: "700",
  },

  ethWeekRow: {
    flexDirection: "row",
    marginBottom: 5,
  },

  ethWeekday: {
    width: "14.2857%",
    textAlign: "center",
    color: "#66766F",
    fontSize: 12,
    fontWeight: "600",
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
    color: "#14201B",
    fontSize: 16,
    fontWeight: "500",
  },

  ethToday: {
    color: COLORS.primary,
  },

  ethDisabled: {
    color: "#66766F",
    opacity: 0.6,
  },

  ethSelected: {
    backgroundColor: "#14201B",
  },

  ethSelectedText: {
    color: "#F7F8FA",
    fontWeight: "700",
  },

  cityList: {
    maxHeight: 460,
  },

  cityOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },

  cityOptionSelected: {
    backgroundColor: "#FFFFFF",
  },

  cityOptionText: {
    color: "#14201B",
    fontSize: 16,
    fontWeight: "600",
  },

  cityOptionTextSelected: {
    color: "#14201B",
    fontWeight: "700",
  },

  calendarOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  calendarModal: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    backgroundColor: "#F7F8FA",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#DDE6E2",
    padding: 18,

    boxShadow: "0 8px 20px rgba(0, 0, 0, 0.12)",
    elevation: 8,
  },

  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  calendarTitle: {
    color: "#14201B",
    fontSize: 21,
    fontWeight: "700",
  },

  calendarSubtitle: {
    color: "#66766F",
    fontSize: 13,
    marginTop: 3,
  },

  calendarCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
  },

  horizontalGameCard: {
    width: "100%",
    minHeight: 178,
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    marginBottom: 12,
    boxShadow: "0 4px 14px rgba(20, 32, 27, 0.06)",
    elevation: 2,
  },

  horizontalGameCardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.995 }],
  },

  horizontalGameArtwork: {
    width: "31%",
    minWidth: 112,
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

  horizontalGameInfo: {
    flex: 1,
    minWidth: 0,
    paddingTop: 15,
    paddingBottom: 14,
    paddingLeft: 16,
    paddingRight: 14,
  },

  horizontalGameTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 7,
    paddingRight: 34,
  },

  horizontalGameTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  horizontalFavoriteButton: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    zIndex: 5,
  },

  gameScheduleBlock: {
    marginTop: 2,
    marginBottom: 2,
  },

  gameDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  gameDateText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },

  gameTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 4,
    minWidth: 0,
  },

  gameTimeRange: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  gameTimeText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    letterSpacing: -0.25,
    flexShrink: 1,
  },

  durationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: COLORS.primarySoft,
    flexShrink: 0,
  },

  durationBadgeText: {
    color: COLORS.primaryPressed,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
  },

  horizontalMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },

  horizontalMetaText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "500",
  },

  horizontalGameBottomRow: {
    marginTop: "auto",
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  horizontalPrice: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.2,
  },

  spotsBadge: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  spotsBadgeFull: {
    backgroundColor: "#FDECEA",
  },

  spotsBadgeText: {
    color: COLORS.primaryPressed,
    fontSize: 11,
    fontWeight: "800",
  },

  spotsBadgeTextFull: {
    color: COLORS.danger,
  },

  horizontalChevron: {
    display: "none",
  },
});
