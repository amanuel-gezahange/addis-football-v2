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
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../constants/colors";
import { useLanguage } from "../i18n/LanguageContext";
import { supabase } from "../lib/supabase";

type NotificationGame = {
  title: string | null;
};

type Notification = {
  id: number;
  type: string;
  title: string;
  message: string;
  game_id: number | null;
  is_read: boolean;
  created_at: string;
  games: NotificationGame | null;
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const { language, t } = useLanguage();

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      if (!user) {
        setNotifications([]);
        return;
      }

      const { data, error } = await supabase
        .from("notifications")
        .select(
          `
            id,
            type,
            title,
            message,
            game_id,
            is_read,
            created_at,
            games (
              title
            )
          `,
        )
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        console.log("Load notifications error:", error.message);
        return;
      }

      const loadedNotifications = (data ?? []) as unknown as Notification[];

      setNotifications(loadedNotifications);

      const unreadIds = loadedNotifications
        .filter((notification) => !notification.is_read)
        .map((notification) => notification.id);

      if (unreadIds.length > 0) {
        const { error: updateError } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", user.id)
          .in("id", unreadIds);

        if (updateError) {
          console.log(
            "Mark notifications read error:",
            updateError.message,
          );
        }
      }
    } finally {
      setLoading(false);
    }
  }

  function formatTime(createdAt: string) {
    const date = new Date(createdAt);

    const locale =
      language === "am"
        ? "am-ET"
        : language === "om"
          ? "om-ET"
          : "en-US";

    try {
      return new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
    } catch {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
    }
  }

  function handleNotificationPress(notification: Notification) {
    if (!notification.game_id) {
      return;
    }

    router.push(`/game/${notification.game_id}`);
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case "game_cancelled":
        return "close-circle-outline";

      case "booking_confirmed":
        return "checkmark-circle-outline";

      case "game_updated":
        return "calendar-outline";

      case "game_reminder":
        return "time-outline";

      default:
        return "notifications-outline";
    }
  }

  function getNotificationTitle(notification: Notification) {
    switch (notification.type) {
      case "game_updated":
        return t("notifications.gameUpdated");

      case "booking_confirmed":
        return t("notifications.bookingConfirmed");

      case "game_cancelled":
        return t("notifications.gameCancelled");

      case "game_reminder":
        return t("notifications.gameReminder");

      default:
        return notification.title;
    }
  }

  function getNotificationMessage(notification: Notification) {
    const gameTitle = notification.games?.title;

    if (!gameTitle) {
      return notification.message;
    }

    let message: string;

    switch (notification.type) {
      case "game_updated":
        message = t("notifications.gameUpdatedMessage");
        break;

      case "booking_confirmed":
        message = t("notifications.bookingConfirmedMessage");
        break;

      case "game_cancelled":
        message = t("notifications.gameCancelledMessage");
        break;

      case "game_reminder":
        message = t("notifications.gameReminderMessage");
        break;

      default:
        return notification.message;
    }

    return message.replace("{game}", gameTitle);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)");
            }
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Ionicons
            name="arrow-back"
            size={23}
            color={COLORS.text}
          />
        </Pressable>

        <Text style={styles.headerTitle}>
          {t("notifications.title")}
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      {/* CONTENT */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
          />

          <Text style={styles.loadingText}>
            {t("notifications.loading")}
          </Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="notifications-outline"
              size={30}
              color={COLORS.primary}
            />
          </View>

          <Text style={styles.emptyTitle}>
            {t("notifications.empty")}
          </Text>

          <Text style={styles.emptyText}>
            {t("notifications.emptyDescription")}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {notifications.map((notification) => {
            const title = getNotificationTitle(notification);
            const message = getNotificationMessage(notification);

            return (
              <Pressable
                key={notification.id}
                onPress={() =>
                  handleNotificationPress(notification)
                }
                accessibilityRole="button"
                accessibilityLabel={`${title}. ${message}`}
                style={({ pressed }) => [
                  styles.notificationCard,
                  !notification.is_read && styles.unreadCard,
                  pressed && styles.notificationCardPressed,
                ]}
              >
                <View style={styles.iconContainer}>
                  <Ionicons
                    name={getNotificationIcon(notification.type)}
                    size={22}
                    color={COLORS.primary}
                  />
                </View>

                <View style={styles.notificationContent}>
                  <View style={styles.titleRow}>
                    <Text style={styles.notificationTitle}>
                      {title}
                    </Text>

                    {!notification.is_read && (
                      <View style={styles.unreadDot} />
                    )}
                  </View>

                  <Text style={styles.notificationMessage}>
                    {message}
                  </Text>

                  <View style={styles.notificationFooter}>
                    <Text style={styles.notificationTime}>
                      {formatTime(notification.created_at)}
                    </Text>

                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={COLORS.textSecondary}
                    />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
  },

  headerSpacer: {
    width: 40,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 12,
  },

  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },

  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 6,
  },

  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 10,
  },

  notificationCard: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
  },

  notificationCardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },

  unreadCard: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },

  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  notificationContent: {
    flex: 1,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  notificationTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },

  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginLeft: 8,
  },

  notificationMessage: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  notificationFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },

  notificationTime: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },

  pressed: {
    opacity: 0.7,
  },
});