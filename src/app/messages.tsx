import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Image,
  Platform,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../constants/colors";
import { supabase } from "../lib/supabase";

type Conversation = {
  id: string;
  name: string;
  message: string;
  time: string;
  unread: number;
  avatar?: string;
  isGroup?: boolean;
};

type PublicPlayerProfile = {
  user_id?: string;
  id?: string;
  full_name?: string | null;
  avatar_url?: string | null;
};

type CommunityConversationSummaryRow = {
  conversation_id: number;
  conversation_type: "direct" | "group";
  group_id: string | null;
  conversation_created_at: string;
  other_user_id: string | null;
  latest_message_content: string | null;
  latest_message_created_at: string | null;
  unread_count: number;
};

type CommunityMessageRow = {
  id: number;
  conversation_id: number;
  sender_id: string;
  content: string;
  created_at: string;
};

type CachedPlayerProfile = {
  full_name: string | null;
  avatar_url: string | null;
};

const messagesConversationCache: Record<string, Conversation[]> = {};
const messagesProfileCache: Record<string, CachedPlayerProfile> = {};

function getGroupName(groupId: string | null) {
  switch (groupId) {
    case "bole":
      return "Bole Players";

    case "cmc":
      return "CMC Football";

    case "beginners":
      return "Beginners Football";

    case "women":
      return "Women's Football";

    case "indoor":
      return "Indoor Football";

    default:
      return "All Addis Football";
  }
}

function getMessageTime(createdAt: string) {
  const created = new Date(createdAt);
  const now = new Date();

  const sameDay =
    created.getFullYear() === now.getFullYear() &&
    created.getMonth() === now.getMonth() &&
    created.getDate() === now.getDate();

  if (sameDay) {
    return created.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const wasYesterday =
    created.getFullYear() === yesterday.getFullYear() &&
    created.getMonth() === yesterday.getMonth() &&
    created.getDate() === yesterday.getDate();

  if (wasYesterday) {
    return "Yesterday";
  }

  const differenceMs = now.getTime() - created.getTime();
  const differenceDays = Math.floor(differenceMs / 86400000);

  if (differenceDays < 7) {
    return created.toLocaleDateString([], {
      weekday: "short",
    });
  }

  return created.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export default function Messages() {
  const { width } = useWindowDimensions();

  const isDesktopWeb = Platform.OS === "web" && width >= 900;

  const [conversations, setConversations] = useState<Conversation[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const profileCacheRef =
    useRef<Record<string, CachedPlayerProfile>>(messagesProfileCache);

  const loadedRef = useRef(false);

  const realtimeRefreshTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const loadConversationsRef = useRef<(() => Promise<void>) | null>(null);

  const loadConversations = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }

    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setConversations([]);
        setLoading(false);
        throw new Error("You must be signed in to view messages.");
      }

      const cachedConversations = messagesConversationCache[user.id];

      if (!loadedRef.current && cachedConversations) {
        setConversations(cachedConversations);
        setLoading(false);
        loadedRef.current = true;
      }

      const { data, error: summaryError } = await supabase.rpc(
        "get_community_conversation_summaries",
      );

      if (summaryError) {
        throw summaryError;
      }

      const rows = (data ?? []) as CommunityConversationSummaryRow[];

      if (rows.length === 0) {
        messagesConversationCache[user.id] = [];
        setConversations([]);
        loadedRef.current = true;
        return;
      }

      const directOtherUserIds = [
        ...new Set(
          rows
            .filter(
              (row) =>
                row.conversation_type === "direct" && !!row.other_user_id,
            )
            .map((row) => row.other_user_id as string),
        ),
      ];

      const uncachedUserIds = directOtherUserIds.filter(
        (userId) => !profileCacheRef.current[userId],
      );

      if (uncachedUserIds.length > 0) {
        await Promise.all(
          uncachedUserIds.map(async (userId) => {
            const { data: profileData, error: profileError } =
              await supabase.rpc("get_public_player_profile", {
                p_user_id: userId,
              });

            if (profileError) {
              console.warn(
                "Could not load conversation player profile:",
                userId,
                profileError,
              );

              return;
            }

            const rawProfile = Array.isArray(profileData)
              ? profileData[0]
              : profileData;

            const profile = (rawProfile ?? null) as PublicPlayerProfile | null;

            if (profile) {
              profileCacheRef.current[userId] = {
                full_name: profile.full_name ?? null,
                avatar_url: profile.avatar_url ?? null,
              };
            }
          }),
        );
      }

      const mappedConversations: Conversation[] = rows.map((row) => {
        const latestTime =
          row.latest_message_created_at ?? row.conversation_created_at;

        if (row.conversation_type === "group") {
          return {
            id: String(row.conversation_id),
            name: getGroupName(row.group_id),
            message: row.latest_message_content ?? "No messages yet.",
            time: getMessageTime(latestTime),
            unread: Number(row.unread_count ?? 0),
            isGroup: true,
          };
        }

        const profile = row.other_user_id
          ? profileCacheRef.current[row.other_user_id]
          : null;

        return {
          id: String(row.conversation_id),
          name: profile?.full_name?.trim() || "Player",
          message: row.latest_message_content ?? "No messages yet.",
          time: getMessageTime(latestTime),
          unread: Number(row.unread_count ?? 0),
          avatar: profile?.avatar_url?.trim() || undefined,
          isGroup: false,
        };
      });

      messagesConversationCache[user.id] = mappedConversations;
      setConversations(mappedConversations);

      loadedRef.current = true;
    } catch (loadError) {
      console.error("Failed to load community conversations:", loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "We couldn't load your conversations.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversationsRef.current = loadConversations;
  }, [loadConversations]);

  useFocusEffect(
    useCallback(() => {
      void loadConversations(!loadedRef.current);
    }, [loadConversations]),
  );

  useEffect(() => {
    let active = true;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribeToMessages() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active || userError || !user) {
        return;
      }

      channel = supabase
        .channel(`messages-tab-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "community_messages",
          },
          (payload) => {
            if (!active) {
              return;
            }

            const message = payload.new as CommunityMessageRow;

            const conversationId = String(message.conversation_id);

            setConversations((current) => {
              const index = current.findIndex(
                (conversation) => conversation.id === conversationId,
              );

              if (index === -1) {
                return current;
              }

              const existing = current[index];

              const updated: Conversation = {
                ...existing,
                message: message.content,
                time: getMessageTime(message.created_at),
                unread:
                  message.sender_id === user.id
                    ? existing.unread
                    : existing.unread + 1,
              };

              const nextConversations = [
                updated,
                ...current.filter(
                  (conversation) => conversation.id !== conversationId,
                ),
              ];

              messagesConversationCache[user.id] = nextConversations;

              return nextConversations;
            });

            if (realtimeRefreshTimeoutRef.current) {
              clearTimeout(realtimeRefreshTimeoutRef.current);
            }

            realtimeRefreshTimeoutRef.current = setTimeout(() => {
              if (active) {
                void loadConversationsRef.current?.();
              }
            }, 500);
          },
        )
        .subscribe((status, channelError) => {
          if (channelError) {
            console.warn("Messages realtime error:", channelError);
          }

          if (status === "CHANNEL_ERROR") {
            console.warn("Messages realtime channel error.");
          }
        });
    }

    void subscribeToMessages();

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active" && active) {
          void loadConversationsRef.current?.();
        }
      },
    );

    return () => {
      active = false;

      appStateSubscription.remove();

      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);

        realtimeRefreshTimeoutRef.current = null;
      }

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  const filteredConversations = conversations.filter((conversation) => {
    const query = search.trim().toLocaleLowerCase();

    if (!query) {
      return true;
    }

    return (
      conversation.name.toLocaleLowerCase().includes(query) ||
      conversation.message.toLocaleLowerCase().includes(query)
    );
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={[
          styles.content,
          isDesktopWeb && styles.contentDesktop,
          filteredConversations.length === 0 && styles.emptyContent,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Pressable
                onPress={() => router.back()}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="chevron-back" size={26} color={COLORS.text} />
              </Pressable>

              <Text style={styles.title}>Messages</Text>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={20} color={COLORS.textSecondary} />

              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search messages"
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
                  onPress={() => setSearch("")}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.clearSearchButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={COLORS.textMuted}
                  />
                </Pressable>
              )}
            </View>
          </>
        }
        renderItem={({ item: conversation }) => (
          <Pressable
            style={({ pressed }) => [
              styles.conversationRow,
              pressed && styles.conversationRowPressed,
            ]}
            onPress={() =>
              router.push({
                pathname: "/community/chat/[id]",
                params: {
                  id: conversation.id,
                  name: conversation.name,
                  ...(conversation.avatar
                    ? { avatar: conversation.avatar }
                    : {}),
                },
              })
            }
          >
            <View style={styles.avatarContainer}>
              {conversation.avatar ? (
                <Image
                  source={{ uri: conversation.avatar }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons
                    name={conversation.isGroup ? "people" : "person"}
                    size={22}
                    color={COLORS.primary}
                  />
                </View>
              )}
            </View>

            <View style={styles.conversationContent}>
              <View style={styles.topRow}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.name,
                    conversation.unread > 0 && styles.nameUnread,
                  ]}
                >
                  {conversation.name}
                </Text>

                <Text
                  style={[
                    styles.time,
                    conversation.unread > 0 && styles.timeUnread,
                  ]}
                >
                  {conversation.time}
                </Text>
              </View>

              <View style={styles.bottomRow}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.preview,
                    conversation.unread > 0 && styles.previewUnread,
                  ]}
                >
                  {conversation.message}
                </Text>

                {conversation.unread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>
                      {conversation.unread > 99 ? "99+" : conversation.unread}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          loading && conversations.length === 0 ? (
            <View style={styles.statusContainer}>
              <Text style={styles.statusTitle}>Loading messages...</Text>
              <Text style={styles.statusText}>
                Getting your latest conversations.
              </Text>
            </View>
          ) : error ? (
            <View style={styles.statusContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={28}
                color={COLORS.danger}
              />

              <Text style={styles.statusTitle}>Couldn't load messages</Text>
              <Text style={styles.statusText}>{error}</Text>

              <Pressable
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  void loadConversations(true);
                }}
              >
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : search.trim().length > 0 ? (
            <View style={styles.statusContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="search-outline"
                  size={30}
                  color={COLORS.textSecondary}
                />
              </View>

              <Text style={styles.statusTitle}>No conversations found</Text>
              <Text style={styles.statusText}>
                Try searching for another player or message.
              </Text>
            </View>
          ) : (
            <View style={styles.statusContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={30}
                  color={COLORS.textSecondary}
                />
              </View>

              <Text style={styles.statusTitle}>No messages yet</Text>
              <Text style={styles.statusText}>
                Open a player's profile and tap Message to start a conversation.
              </Text>
            </View>
          )
        }
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== "web"}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  list: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 30,
  },

  contentDesktop: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 24,
  },

  emptyContent: {
    flexGrow: 1,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
    marginRight: 4,
  },

  title: {
    color: COLORS.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -0.8,
  },

  searchBox: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 15,
    marginBottom: 12,
  },

  searchInput: {
    flex: 1,
    height: "100%",
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "500",
    paddingHorizontal: 10,
    paddingVertical: 0,
  },

  clearSearchButton: {
    alignItems: "center",
    justifyContent: "center",
  },

  conversationRow: {
    minHeight: 78,
    paddingHorizontal: 4,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
  },

  conversationRowPressed: {
    backgroundColor: COLORS.surfaceAlt,
  },

  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginLeft: 65,
  },

  avatarContainer: {
    width: 50,
    height: 50,
    marginRight: 11,
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.surfaceAlt,
  },

  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  conversationContent: {
    flex: 1,
    minWidth: 0,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },

  name: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
    paddingRight: 8,
  },

  nameUnread: {
    fontWeight: "900",
  },

  time: {
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },

  timeUnread: {
    color: COLORS.primary,
    fontWeight: "800",
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  preview: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    paddingRight: 8,
  },

  previewUnread: {
    color: COLORS.textSecondary,
    fontWeight: "700",
  },

  unreadBadge: {
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  unreadBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
  },

  statusContainer: {
    flex: 1,
    minHeight: 360,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },

  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },

  statusTitle: {
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 10,
  },

  statusText: {
    maxWidth: 300,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 5,
  },

  retryButton: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 19,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
  },

  retryButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "900",
  },

  pressed: {
    opacity: 0.65,
  },
});
