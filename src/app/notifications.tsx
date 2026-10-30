import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../constants/colors";
import { useLanguage } from "../i18n/LanguageContext";
import { supabase } from "../lib/supabase";
import {
  getCachedNotifications,
  hasNotificationCache,
  setCachedNotifications,
} from "../lib/notificationCache";

const NOTIFICATION_PAGE_SIZE = 30;

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

type NotificationCardProps = {
  notification: Notification;
  title: string;
  message: string;
  time: string;
  onPress: (notification: Notification) => void;
};

function getNotificationIcon(
  type: string,
): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "game_cancelled":
      return "close-circle-outline";

    case "booking_confirmed":
      return "checkmark-circle-outline";

    case "game_updated":
      return "calendar-outline";

    case "game_reminder":
      return "time-outline";

    case "waitlist_spot_available":
      return "ticket-outline";

    case "waitlist_offer_expired":
      return "timer-outline";

    case "payment_not_received":
      return "alert-circle-outline";

    case "refund_completed":
      return "cash-outline";

    default:
      return "notifications-outline";
  }
}

const NotificationCard = memo(function NotificationCard({
  notification,
  title,
  message,
  time,
  onPress,
}: NotificationCardProps) {
  const handlePress = useCallback(() => {
    onPress(notification);
  }, [notification, onPress]);

  return (
    <Pressable
      onPress={handlePress}
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
            {time}
          </Text>

          {notification.game_id && (
            <Ionicons
              name="chevron-forward"
              size={16}
              color={COLORS.textSecondary}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
});

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<
    Notification[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const { language, t } = useLanguage();

  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);

  const mountedRef = useRef(true);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    loadInitialNotifications();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const userId = currentUserIdRef.current;

    if (!loading && userId) {
      setCachedNotifications(userId, notifications);
    }
  }, [notifications, loading]);

  const fetchNotifications = useCallback(
    async (
      userId: string,
      offset: number,
      limit: number,
    ): Promise<Notification[]> => {
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
        .eq("user_id", userId)
        .order("created_at", {
          ascending: false,
        })
        .order("id", {
          ascending: false,
        })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return (data ?? []) as unknown as Notification[];
    },
    [],
  );

  const loadInitialNotifications = useCallback(
    async () => {
      let hasCache = false;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          currentUserIdRef.current = null;

          if (mountedRef.current) {
            setNotifications([]);
            setLoading(false);
            setHasMore(false);
            hasMoreRef.current = false;
          }

          return;
        }

        currentUserIdRef.current = user.id;
        hasCache = hasNotificationCache(user.id);

        if (hasCache) {
          const cached =
            getCachedNotifications(
              user.id,
            ) as Notification[];

          if (mountedRef.current) {
            setNotifications(cached);
            setLoading(false);
          }
        } else if (mountedRef.current) {
          setLoading(true);
        }

        const data = await fetchNotifications(
          user.id,
          0,
          NOTIFICATION_PAGE_SIZE,
        );

        if (!mountedRef.current) {
          return;
        }

        setNotifications(data);
        setCachedNotifications(user.id, data);

        const more =
          data.length === NOTIFICATION_PAGE_SIZE;

        setHasMore(more);
        hasMoreRef.current = more;
      } catch (error) {
        console.log(
          "Load notifications error:",
          error instanceof Error
            ? error.message
            : "Unknown error",
        );
      } finally {
        if (mountedRef.current && !hasCache) {
          setLoading(false);
        }
      }
    },
    [fetchNotifications],
  );

  const refreshNotifications = useCallback(
    async () => {
      try {
        setRefreshing(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          currentUserIdRef.current = null;
          setNotifications([]);
          setHasMore(false);
          hasMoreRef.current = false;
          return;
        }

        currentUserIdRef.current = user.id;

        const data = await fetchNotifications(
          user.id,
          0,
          NOTIFICATION_PAGE_SIZE,
        );

        if (!mountedRef.current) {
          return;
        }

        setNotifications(data);

        const more =
          data.length === NOTIFICATION_PAGE_SIZE;

        setHasMore(more);
        hasMoreRef.current = more;
      } catch (error) {
        console.log(
          "Refresh notifications error:",
          error instanceof Error
            ? error.message
            : "Unknown error",
        );
      } finally {
        if (mountedRef.current) {
          setRefreshing(false);
        }
      }
    },
    [fetchNotifications],
  );

  const loadMoreNotifications = useCallback(
    async () => {
      if (
        loadingMoreRef.current ||
        !hasMoreRef.current
      ) {
        return;
      }

      loadingMoreRef.current = true;
      setLoadingMore(true);

      try {
        const offset = notifications.length;

        let userId =
          currentUserIdRef.current;

        if (!userId) {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          userId = user?.id ?? null;
          currentUserIdRef.current = userId;
        }

        if (!userId) {
          return;
        }

        const data = await fetchNotifications(
          userId,
          offset,
          NOTIFICATION_PAGE_SIZE,
        );

        if (!mountedRef.current) {
          return;
        }

        setNotifications((current) => {
          const existingIds = new Set(
            current.map(
              (notification) => notification.id,
            ),
          );

          const newNotifications = data.filter(
            (notification) =>
              !existingIds.has(notification.id),
          );

          return [
            ...current,
            ...newNotifications,
          ];
        });

        const more =
          data.length === NOTIFICATION_PAGE_SIZE;

        setHasMore(more);
        hasMoreRef.current = more;
      } catch (error) {
        console.log(
          "Load more notifications error:",
          error instanceof Error
            ? error.message
            : "Unknown error",
        );
      } finally {
        loadingMoreRef.current = false;

        if (mountedRef.current) {
          setLoadingMore(false);
        }
      }
    },
    [
      fetchNotifications,
      notifications.length,
    ],
  );

  const formatTime = useCallback(
    (createdAt: string) => {
      const date = new Date(createdAt);
      const now = new Date();

      const diffMs = Math.max(
        0,
        now.getTime() - date.getTime(),
      );

      const diffMinutes = Math.floor(
        diffMs / 60000,
      );

      const diffHours = Math.floor(
        diffMs / 3600000,
      );

      const diffDays = Math.floor(
        diffMs / 86400000,
      );

      if (diffMinutes < 1) {
        return "Now";
      }

      if (diffMinutes < 60) {
        return `${diffMinutes}m`;
      }

      if (diffHours < 24) {
        return `${diffHours}h`;
      }

      if (diffDays === 1) {
        return "Yesterday";
      }

      if (diffDays < 7) {
        return `${diffDays}d`;
      }

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
        }).format(date);
      } catch {
        return new Intl.DateTimeFormat(
          "en-US",
          {
            month: "short",
            day: "numeric",
          },
        ).format(date);
      }
    },
    [language],
  );

  const handleNotificationPress = useCallback(
    async (notification: Notification) => {
      if (!notification.is_read) {
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? {
                  ...item,
                  is_read: true,
                }
              : item,
          ),
        );

        const { error } = await supabase
          .from("notifications")
          .update({
            is_read: true,
          })
          .eq("id", notification.id);

        if (error) {
          console.log(
            "Mark notification read error:",
            error.message,
          );

          if (mountedRef.current) {
            setNotifications((current) =>
              current.map((item) =>
                item.id === notification.id
                  ? {
                      ...item,
                      is_read: false,
                    }
                  : item,
              ),
            );
          }
        }
      }

      if (notification.game_id) {
        router.push(
          `/game/${notification.game_id}`,
        );
      }
    },
    [],
  );

  const unreadCount = useMemo(
    () =>
      notifications.reduce(
        (count, notification) =>
          notification.is_read
            ? count
            : count + 1,
        0,
      ),
    [notifications],
  );

  const markAllAsRead = useCallback(
    async () => {
      if (unreadCount === 0) {
        return;
      }

      const previousNotifications =
        notifications;

      // Update all currently visible notifications immediately.
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          is_read: true,
        })),
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setNotifications(
          previousNotifications,
        );
        return;
      }

      // Mark ALL unread notifications for this user as read,
      // including notifications that have not been paginated
      // into the app yet.
      const { error } = await supabase
        .from("notifications")
        .update({
          is_read: true,
        })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) {
        console.log(
          "Mark all notifications read error:",
          error.message,
        );

        setNotifications(
          previousNotifications,
        );
      }
    },
    [notifications, unreadCount],
  );

  const getNotificationTitle = useCallback(
    (notification: Notification) => {
      switch (notification.type) {
        case "game_updated":
          return t(
            "notifications.gameUpdated",
          );

        case "booking_confirmed":
          return t(
            "notifications.bookingConfirmed",
          );

        case "game_cancelled":
          return t(
            "notifications.gameCancelled",
          );

        case "game_reminder":
          return t(
            "notifications.gameReminder",
          );

        case "waitlist_spot_available":
          return "Spot available";

        case "waitlist_offer_expired":
          return "Spot offer expired";

        case "payment_not_received":
          return "Payment not received";

        case "refund_completed":
          return "Refund completed";

        default:
          return notification.title;
      }
    },
    [t],
  );

  const getNotificationMessage = useCallback(
    (notification: Notification) => {
      const gameTitle =
        notification.games?.title;

      if (!gameTitle) {
        return notification.message;
      }

      let message: string;

      switch (notification.type) {
        case "game_updated":
          message = t(
            "notifications.gameUpdatedMessage",
          );
          break;

        case "booking_confirmed":
          message = t(
            "notifications.bookingConfirmedMessage",
          );
          break;

        case "game_cancelled":
          message = t(
            "notifications.gameCancelledMessage",
          );
          break;

        case "game_reminder":
          message = t(
            "notifications.gameReminderMessage",
          );
          break;

        case "waitlist_spot_available":
          return `A spot opened for ${gameTitle}. Complete payment within 10 minutes to secure it.`;

        case "waitlist_offer_expired":
          return `Your spot offer for ${gameTitle} expired because payment was not completed in time.`;

        case "refund_completed":
          return `Your refund for ${gameTitle} has been completed.`;

        case "payment_not_received":
          return notification.message;

        default:
          return notification.message;
      }

      return message.replace(
        "{game}",
        gameTitle,
      );
    },
    [t],
  );

  const renderItem = useCallback(
    ({
      item,
    }: {
      item: Notification;
    }) => {
      return (
        <NotificationCard
          notification={item}
          title={getNotificationTitle(
            item,
          )}
          message={getNotificationMessage(
            item,
          )}
          time={formatTime(
            item.created_at,
          )}
          onPress={
            handleNotificationPress
          }
        />
      );
    },
    [
      formatTime,
      getNotificationMessage,
      getNotificationTitle,
      handleNotificationPress,
    ],
  );

  const keyExtractor = useCallback(
    (item: Notification) =>
      String(item.id),
    [],
  );

  const renderFooter = useCallback(() => {
    if (!loadingMore) {
      return null;
    }

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator
          size="small"
          color={COLORS.primary}
        />
      </View>
    );
  }, [loadingMore]);

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
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
          accessibilityLabel={t(
            "common.back",
          )}
        >
          <Ionicons
            name="arrow-back"
            size={23}
            color={COLORS.text}
          />
        </Pressable>

        <Text
          style={styles.headerTitle}
        >
          {t("notifications.title")}
        </Text>

        <View
          style={styles.headerAction}
        >
          {unreadCount > 0 && (
            <Pressable
              onPress={markAllAsRead}
              hitSlop={8}
              style={({ pressed }) => [
                styles.markAllButton,
                pressed &&
                  styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications as read"
            >
              <Ionicons
                name="checkmark-done"
                size={21}
                color={
                  COLORS.primary
                }
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* CONTENT */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
          />

          <Text
            style={styles.loadingText}
          >
            {t(
              "notifications.loading",
            )}
          </Text>
        </View>
      ) : notifications.length ===
        0 ? (
        <FlatList
          data={[]}
          keyExtractor={() => "empty"}
          renderItem={() => null}
          contentContainerStyle={
            styles.emptyList
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={
                refreshNotifications
              }
              tintColor={
                COLORS.primary
              }
            />
          }
          ListEmptyComponent={
            <View
              style={
                styles.emptyContent
              }
            >
              <View
                style={
                  styles.emptyIcon
                }
              >
                <Ionicons
                  name="notifications-outline"
                  size={30}
                  color={
                    COLORS.primary
                  }
                />
              </View>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                {t(
                  "notifications.empty",
                )}
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                {t(
                  "notifications.emptyDescription",
                )}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={
            keyExtractor
          }
          renderItem={renderItem}
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.list
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={
                refreshNotifications
              }
              tintColor={
                COLORS.primary
              }
            />
          }
          onEndReached={
            loadMoreNotifications
          }
          onEndReachedThreshold={
            0.35
          }
          ListFooterComponent={
            renderFooter
          }
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={
            50
          }
          windowSize={7}
          removeClippedSubviews
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },

  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor:
      COLORS.border,
    backgroundColor:
      COLORS.background,
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

  headerAction: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  markAllButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  loadingText: {
    color:
      COLORS.textSecondary,
    fontSize: 13,
    marginTop: 12,
  },

  emptyList: {
    flexGrow: 1,
  },

  emptyContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor:
      COLORS.surfaceAlt,
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
    color:
      COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 6,
  },

  list: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
    gap: 10,
  },

  notificationCard: {
    flexDirection: "row",
    backgroundColor:
      COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 12,
  },

  notificationCardPressed: {
    opacity: 0.78,
    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  unreadCard: {
    backgroundColor:
      COLORS.primarySoft,
    borderColor: COLORS.border,
  },

  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor:
      COLORS.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
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
    lineHeight: 18,
    fontWeight: "800",
  },

  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor:
      COLORS.primary,
    marginLeft: 8,
  },

  notificationMessage: {
    color:
      COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },

  notificationFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    marginTop: 6,
  },

  notificationTime: {
    color:
      COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },

  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  pressed: {
    opacity: 0.7,
  },
});