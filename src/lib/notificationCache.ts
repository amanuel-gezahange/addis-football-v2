export type CachedNotificationGame = {
  title: string | null;
};

export type CachedNotification = {
  id: number;
  type: string;
  title: string;
  message: string;
  game_id: number | null;
  is_read: boolean;
  created_at: string;
  games: CachedNotificationGame | null;
};

type NotificationCacheEntry = {
  notifications: CachedNotification[];
  hasLoaded: boolean;
};

const notificationCache: Record<string, NotificationCacheEntry> = {};

export function getCachedNotifications(userId: string) {
  return notificationCache[userId]?.notifications ?? [];
}

export function setCachedNotifications(
  userId: string,
  notifications: CachedNotification[],
) {
  notificationCache[userId] = {
    notifications,
    hasLoaded: true,
  };
}

export function hasNotificationCache(userId: string) {
  return notificationCache[userId]?.hasLoaded === true;
}

export function clearNotificationCache(userId: string) {
  delete notificationCache[userId];
}