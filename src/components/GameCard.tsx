import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { memo, useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { Image } from "expo-image";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useLanguage } from "../i18n/LanguageContext";
import { supabase } from "../lib/supabase";
import { Game } from "../types/game";

type Props = {
  game: Game;
  initialIsFavorite?: boolean;
};

function GameCard({ game, initialIsFavorite = false }: Props) {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();

  const isSmallScreen = width < 375;
  const isLargeScreen = width >= 768;

  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  useEffect(() => {
    setIsFavorite(initialIsFavorite);
  }, [initialIsFavorite]);

  /*
   * CARD INTERACTION
   *
   * Idle:
   *   scale = 1
   *
   * Finger down:
   *   scale = 0.955
   *
   * Release:
   *   scale = 1.018
   *   then spring back to 1
   *
   * Navigation itself is immediate.
   */
  const cardScale = useSharedValue(1);

  const animatedCardStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: cardScale.value }],
    };
  });

  const spotsLeft = Number(game.spotsLeft ?? 0);
  const price = Number(game.price ?? 0);

  const isFull = game.status === "full" || spotsLeft <= 0;
  const isLowSpots = !isFull && spotsLeft > 0 && spotsLeft <= 3;

  const locationGame = game as Game & {
    city?: string | null;
  };

  const city = String(locationGame.city ?? "").trim();
  const area = String(game.area ?? "").trim();

  const location =
    city && !area.toLowerCase().includes(city.toLowerCase())
      ? `${area}, ${city}`
      : area;

  function pressCardIn() {
    cancelAnimation(cardScale);

    cardScale.value = withTiming(0.955, {
      duration: 90,
    });
  }

  function pressCardOut() {
    cancelAnimation(cardScale);

    cardScale.value = withSequence(
      withTiming(1.018, {
        duration: 110,
      }),
      withSpring(1, {
        damping: 10,
        stiffness: 260,
        mass: 0.45,
      }),
    );
  }

  /*
   * Open the game immediately.
   *
   * Previously navigation waited for a spring animation
   * to completely finish, which made taps feel slow on
   * physical devices.
   */
  function openGameDetails() {
    cancelAnimation(cardScale);

    cardScale.value = withTiming(1, {
      duration: 80,
    });

    router.push(`/game/${game.id}`);
  }

  async function toggleFavorite() {
    if (favoriteLoading) {
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
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("game_id", game.id);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.from("favorites").insert({
          user_id: user.id,
          game_id: game.id,
        });

        if (error) {
          throw error;
        }
      }
    } catch (error) {
      console.log("Favorite toggle error:", error);
      setIsFavorite(previousFavoriteState);
    } finally {
      setFavoriteLoading(false);
    }
  }

  return (
    <Animated.View style={[styles.card, animatedCardStyle]}>
      {/* IMAGE */}
      <Pressable
        style={[
          styles.imagePressable,
          isSmallScreen && styles.imagePressableSmall,
          isLargeScreen && styles.imagePressableLarge,
        ]}
        onPressIn={pressCardIn}
        onPressOut={pressCardOut}
        onPress={openGameDetails}
        accessibilityRole="button"
        accessibilityLabel={t("gameCard.viewGameDetails").replace(
          "{game}",
          game.title,
        )}
      >
        {game.image ? (
          <>
            <Image
              source={{ uri: game.image }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />

            <View style={styles.imageOverlay} />
          </>
        ) : (
          <View style={styles.fallback}>
            <View style={styles.fallbackCenterCircle} />
            <View style={styles.fallbackCenterLine} />

            <Ionicons
              name="football-outline"
              size={54}
              color="rgba(255,255,255,0.10)"
            />

            <View style={styles.fallbackAccent} />

            <Text style={styles.fallbackTitle} numberOfLines={2}>
              {game.title}
            </Text>
          </View>
        )}
      </Pressable>

      {/* HEART */}
      <Pressable
        style={({ pressed }) => [
          styles.favorite,
          isSmallScreen && styles.favoriteSmall,
          pressed && styles.favoritePressed,
        ]}
        onPress={toggleFavorite}
        disabled={favoriteLoading}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={
          isFavorite
            ? t("gameCard.removeFromFavorites").replace("{game}", game.title)
            : t("gameCard.saveToFavorites").replace("{game}", game.title)
        }
      >
        <Ionicons
          name={isFavorite ? "heart" : "heart-outline"}
          size={23}
          color={isFavorite ? "#00B77A" : "#14201B"}
        />
      </Pressable>

      {/* DETAILS */}
      <Pressable
        style={[
          styles.details,
          isSmallScreen && styles.detailsSmall,
          isLargeScreen && styles.detailsLarge,
        ]}
        onPressIn={pressCardIn}
        onPressOut={pressCardOut}
        onPress={openGameDetails}
        accessibilityRole="button"
        accessibilityLabel={t("gameCard.viewDetailsFor").replace(
          "{game}",
          game.title,
        )}
      >
        {/* TITLE */}
        {!!game.image && (
          <Text
            style={[
              styles.title,
              isSmallScreen && styles.titleSmall,
              isLargeScreen && styles.titleLarge,
            ]}
            numberOfLines={2}
          >
            {game.title}
          </Text>
        )}

        {/* LOCATION */}
        <View style={styles.metaRow}>
          <Ionicons name="location" size={15} color="#33433C" />

          <Text style={styles.metaText} numberOfLines={2}>
            {location}
          </Text>
        </View>

        {/* TIME */}
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={15} color="#33433C" />

          <Text style={styles.metaText} numberOfLines={2}>
            {game.time}
          </Text>
        </View>

        {/* BOTTOM */}
        <View
          style={[styles.bottomRow, isSmallScreen && styles.bottomRowSmall]}
        >
          <View style={styles.spotsRow}>
            <Ionicons
              name="people-outline"
              size={16}
              color={isFull ? "#C13515" : "#33433C"}
            />

            <Text
              style={[styles.spotsText, isFull && styles.fullText]}
              numberOfLines={2}
            >
              {isFull
                ? t("gameCard.gameFull")
                : `${spotsLeft} ${t("gameCard.spotsLeft")}`}
            </Text>
          </View>

          <View
            style={[styles.priceBadge, price === 0 && styles.freePriceBadge]}
          >
            <Text style={styles.priceText} numberOfLines={1}>
              {price === 0 ? t("gameCard.free") : `${price} ETB`}
            </Text>
          </View>
        </View>

        {isLowSpots && (
          <View style={styles.urgencyBadge}>
            <Text style={styles.urgencyText}>
              {spotsLeft} {t("gameCard.spotsLeft")}
            </Text>
          </View>
        )}
      </Pressable>

      {!isFull && (
        <Pressable
          style={({ pressed }) => [
            styles.joinButton,
            pressed && styles.joinButtonPressed,
          ]}
          onPress={openGameDetails}
          accessibilityRole="button"
          accessibilityLabel={`Join ${game.title}`}
        >
          <Text style={styles.joinButtonText}>Join Game</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    width: "100%",
    backgroundColor: "#F7F8FA",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DDE6E2",
    marginBottom: 18,
    overflow: "hidden",
  },

  imagePressable: {
    width: "100%",
    height: 190,
    backgroundColor: "#0B1823",
  },

  imagePressableSmall: {
    height: 170,
  },

  imagePressableLarge: {
    height: 220,
  },

  image: {
    width: "100%",
    height: "100%",
  },

  imageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 15, 25, 0.06)",
  },

  favorite: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    zIndex: 10,
  },

  favoriteSmall: {
    top: 12,
    right: 12,
  },

  favoritePressed: {
    opacity: 0.7,
    transform: [{ scale: 0.92 }],
  },

  details: {
    position: "relative",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },

  detailsSmall: {
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 14,
  },

  detailsLarge: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
  },

  title: {
    color: "#14201B",
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 24,
    letterSpacing: -0.35,
    paddingRight: 4,
  },

  titleSmall: {
    fontSize: 18,
    lineHeight: 23,
  },

  titleLarge: {
    fontSize: 20,
    lineHeight: 25,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 8,
  },

  metaText: {
    flex: 1,
    minWidth: 0,
    color: "#33433C",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 16,
  },

  bottomRowSmall: {
    alignItems: "flex-start",
  },

  spotsRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
  },

  spotsText: {
    flexShrink: 1,
    color: "#14201B",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },

  fullText: {
    color: "#C13515",
  },

  priceBadge: {
    flexShrink: 0,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "#F0F5F3",
  },

  freePriceBadge: {
    backgroundColor: "#F0F5F3",
  },

  priceText: {
    color: "#14201B",
    fontSize: 14,
    fontWeight: "800",
  },

  urgencyBadge: {
    alignSelf: "flex-start",
    marginTop: 11,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: "#FFF1F2",
  },

  urgencyText: {
    color: "#D92D3A",
    fontSize: 11,
    fontWeight: "800",
  },
  joinButton: {
    alignSelf: "center",
    minWidth: 220,
    height: 48,
    marginBottom: 16,
    paddingHorizontal: 28,
    borderRadius: 16,
    backgroundColor: "#00B77A",
    alignItems: "center",
    justifyContent: "center",
  },

  joinButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  joinButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  fallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#12333A",
    justifyContent: "flex-end",
    paddingHorizontal: 18,
    paddingBottom: 18,
    overflow: "hidden",
  },

  fallbackCenterLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  fallbackCenterCircle: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    top: "50%",
    left: "50%",
    marginLeft: -60,
    marginTop: -60,
  },

  fallbackAccent: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#00B77A",
    marginTop: 12,
    marginBottom: 8,
  },

  fallbackTitle: {
    color: "#F7F8FA",
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: -0.4,
    paddingRight: 52,
  },
});

export default memo(GameCard);