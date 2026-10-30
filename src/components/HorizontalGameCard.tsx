import { Ionicons } from "@expo/vector-icons";
import { memo, ReactNode, useCallback, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { COLORS } from "../constants/colors";
import GameBookingAction from "./GameBookingAction";

export type HorizontalGameCardGame = {
  id: string | number;
  title: string;
  area: string;
  time: string;
  price: number;

  spotsLeft: number;
  capacity: number | null;

  status: "available" | "full";

  starts_at: string | null;
  ends_at: string | null;

  image_url?: string | null;

  payment_method: "free" | "venue" | "organizer";
  payment_provider: string | null;
  payment_phone: string | null;
  payment_account_name: string | null;
};

type Props = {
  game: HorizontalGameCardGame;
  onPress: () => void;
  formatDate: (timestamp: string) => string;
  mode?: "discover" | "booking";
  bottomContent?: ReactNode;
};

function HorizontalGameCardComponent({
  game,
  onPress,
  formatDate,
  mode = "discover",
  bottomContent,
}: Props) {
  const { width } = useWindowDimensions();
  const isSmallPhone = width < 375;

  const [joinTrigger, setJoinTrigger] = useState(0);

  const handleJoinPress = useCallback(() => {
    setJoinTrigger((current) => current + 1);
  }, []);

  const isFull = game.status === "full" || game.spotsLeft <= 0;

  const isFree = game.payment_method === "free" || Number(game.price) === 0;

  const startTimeLabel = game.starts_at
    ? formatAddisTime(game.starts_at)
    : getStartTimeFromLegacyTime(game.time);

  const endTimeLabel = game.ends_at
    ? formatAddisTime(game.ends_at)
    : getEndTimeFromLegacyTime(game.time);

  const timeRangeLabel = endTimeLabel
    ? `${startTimeLabel} – ${endTimeLabel}`
    : startTimeLabel;

  const durationLabel =
    game.starts_at && game.ends_at
      ? formatDuration(game.starts_at, game.ends_at)
      : "";

  const dateLabel = game.starts_at ? formatDate(game.starts_at) : "";

  const capacity = game.capacity ?? 0;

  const occupiedSpots =
    capacity > 0
      ? Math.max(0, Math.min(capacity, capacity - game.spotsLeft))
      : 0;

  return (
    <>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.horizontalGameCard,
          pressed && styles.horizontalGameCardPressed,
        ]}
      >
        {/* LEFT IMAGE */}
        <View
          style={[
            styles.horizontalGameArtwork,
            isSmallPhone && styles.horizontalGameArtworkSmall,
          ]}
        >
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
                size={42}
                color="rgba(255,255,255,0.18)"
                style={styles.pitchBall}
              />

              <View style={styles.pitchAccent} />
            </>
          )}
        </View>

        {/* RIGHT CONTENT */}
        <View
          style={[
            styles.horizontalGameInfo,
            isSmallPhone && styles.horizontalGameInfoSmall,
          ]}
        >
          {/* TITLE */}
          <View style={styles.horizontalGameTopRow}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.horizontalGameTitle}
            >
              {game.title}
            </Text>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.textSecondary}
            />
          </View>

          {/* DATE */}
          {dateLabel ? (
            <View style={styles.gameDatePill}>
              <Ionicons
                name="calendar-outline"
                size={13}
                color={COLORS.primary}
              />

              <Text numberOfLines={1} style={styles.gameDatePillText}>
                {dateLabel}
              </Text>
            </View>
          ) : null}

          {/* GAME META */}
          <View style={styles.gameMetaStack}>
            {/* TIME + DURATION */}
            <View style={styles.gameTimeRow}>
              <View style={styles.gameMetaRow}>
                <Ionicons
                  name="time-outline"
                  size={17}
                  color={COLORS.primary}
                />

                <Text numberOfLines={1} style={styles.gameMetaRowText}>
                  {timeRangeLabel}
                </Text>
              </View>

              {durationLabel ? (
                <View style={styles.gameDurationPill}>
                  <Text style={styles.gameDurationText}>{durationLabel}</Text>
                </View>
              ) : null}
            </View>

            {/* LOCATION */}
            <View style={styles.gameMetaRow}>
              <Ionicons
                name="location-outline"
                size={17}
                color={COLORS.primary}
              />

              <Text numberOfLines={1} style={styles.gameMetaRowText}>
                {game.area.split(",")[0]?.trim() || game.area}
              </Text>
            </View>

            {/* PLAYERS + PRICE */}
            <View style={styles.gamePlayersPriceRow}>
              {capacity > 0 ? (
                <View style={styles.gameMetaRow}>
                  <Ionicons
                    name="people-outline"
                    size={17}
                    color={COLORS.primary}
                  />

                  <Text style={styles.gameMetaRowText}>
                    {occupiedSpots}/{capacity}
                  </Text>
                </View>
              ) : (
                <View />
              )}

              <View style={styles.gameDurationPill}>
                <Text style={styles.gameDurationText}>
                  {isFree ? "FREE" : `${game.price} ETB`}
                </Text>
              </View>
            </View>
          </View>

          {/* BOTTOM ACTION */}
          <View style={styles.gameCardBottomRow}>
            {mode === "booking" ? (
              bottomContent
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.joinGameButton,
                  isFull && styles.joinGameButtonFull,
                  pressed && {
                    opacity: 0.85,
                  },
                ]}
                onPress={(event) => {
                  event.stopPropagation();
                  handleJoinPress();
                }}
                accessibilityRole="button"
                accessibilityLabel={isFull ? "Join waitlist" : "Join game"}
              >
                <Text
                  style={[
                    styles.joinGameButtonText,
                    isFull && styles.joinGameButtonTextFull,
                  ]}
                >
                  {isFull ? "Join Waitlist" : "Join Game"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>

      {mode === "discover" ? (
        <GameBookingAction
          gameId={game.id}
          title={game.title}
          price={game.price}
          spotsLeft={game.spotsLeft}
          status={game.status}
          paymentMethod={game.payment_method}
          paymentProvider={game.payment_provider}
          paymentPhone={game.payment_phone}
          paymentAccountName={game.payment_account_name}
          externalJoinTrigger={joinTrigger}
          hideActionUI
        />
      ) : null}
    </>
  );
}

const HorizontalGameCard = memo(
  HorizontalGameCardComponent,
  (previous, next) =>
    previous.game === next.game &&
    previous.onPress === next.onPress &&
    previous.formatDate === next.formatDate,
);

export default HorizontalGameCard;

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

const styles = StyleSheet.create({
  horizontalGameCard: {
    width: "100%",
    minHeight: 214,
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
    width: "39%",
    minWidth: 126,
    backgroundColor: "#123E3F",
    overflow: "hidden",
    position: "relative",
  },

  horizontalGameArtworkSmall: {
    width: "38%",
    minWidth: 118,
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
    left: 18,
    top: 20,
  },

  pitchAccent: {
    position: "absolute",
    left: 18,
    bottom: 16,
    width: 38,
    height: 4,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },

  horizontalGameInfo: {
    flex: 1,
    minWidth: 0,
    paddingTop: 13,
    paddingBottom: 12,
    paddingLeft: 13,
    paddingRight: 12,
  },

  horizontalGameInfoSmall: {
    paddingTop: 11,
    paddingBottom: 10,
    paddingLeft: 10,
    paddingRight: 9,
  },

  horizontalGameTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 7,
  },

  horizontalGameTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  gameDatePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 24,
    paddingRight: 8,
    paddingLeft: 2,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: "#EAF8F2",
    marginBottom: 8,
  },

  gameDatePillText: {
    color: "#176B50",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },

  gameMetaStack: {
    gap: 6,
    marginBottom: 8,
  },

  gameTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    minWidth: 0,
  },

  gameMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minWidth: 0,
  },

  gameMetaRowText: {
    flexShrink: 1,
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },

  gameDurationPill: {
    flexShrink: 0,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: COLORS.surfaceAlt,
  },

  gameDurationText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
  },

  gamePlayersPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minWidth: 0,
  },

  gameCardBottomRow: {
    marginTop: "auto",
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },

  joinGameButton: {
    width: "100%",
    height: 36,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  joinGameButtonFull: {
    backgroundColor: COLORS.surfaceAlt,
  },

  joinGameButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },

  joinGameButtonTextFull: {
    color: COLORS.textSecondary,
  },
});
