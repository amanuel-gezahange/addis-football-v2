import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../../constants/colors";
import { supabase } from "../../../lib/supabase";
import {
    getCachedCommunityChat,
    setCachedCommunityChat,
    updateCachedCommunityChatMessages,
} from "../../../lib/communityChatCache";

type MessageRow = {
    id: number;
    conversation_id: number;
    sender_id: string;
    content: string;
    created_at: string;
};

type ChatMessage = {
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
    pending?: boolean;
};

type PublicPlayerProfile = {
    user_id?: string;
    id?: string;
    full_name?: string | null;
    avatar_url?: string | null;
    role?: string | null;
};

type ChatHeaderProfile = {
    userId: string;
    name: string;
    avatar?: string;
    role?: string;
};

type ChatListItem =
    | {
          type: "date";
          id: string;
          label: string;
      }
    | {
          type: "message";
          id: string;
          message: ChatMessage;
          isMine: boolean;
          firstInGroup: boolean;
          lastInGroup: boolean;
      };

function formatMessageTime(createdAt: string) {
    return new Date(createdAt).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
    });
}

function getDateKey(createdAt: string) {
    const date = new Date(createdAt);

    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDateSeparator(createdAt: string) {
    const date = new Date(createdAt);
    const now = new Date();

    const todayKey = getDateKey(now.toISOString());
    const messageKey = getDateKey(createdAt);

    if (messageKey === todayKey) {
        return "Today";
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (messageKey === getDateKey(yesterday.toISOString())) {
        return "Yesterday";
    }

    const sameYear = date.getFullYear() === now.getFullYear();

    return date.toLocaleDateString(undefined, {
        ...(sameYear ? {} : { year: "numeric" }),
        month: "short",
        day: "numeric",
    });
}

function mapMessageRow(message: MessageRow): ChatMessage {
    return {
        id: String(message.id),
        senderId: message.sender_id,
        content: message.content,
        createdAt: message.created_at,
    };
}

function isSameMessageGroup(a?: ChatMessage, b?: ChatMessage) {
    if (!a || !b || a.senderId !== b.senderId) {
        return false;
    }

    if (getDateKey(a.createdAt) !== getDateKey(b.createdAt)) {
        return false;
    }

    const difference =
        Math.abs(
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ) / 60000;

    return difference <= 5;
}

export default function CommunityChatScreen() {
    const params = useLocalSearchParams<{
        id?: string | string[];
    }>();

    const conversationId = Array.isArray(params.id) ? params.id[0] : params.id;

    const listRef = useRef<FlatList<ChatListItem>>(null);
    const currentUserIdRef = useRef<string | null>(null);
    const isNearBottomRef = useRef(true);
    const didInitialScrollRef = useRef(false);
    const keyboardVisibleRef = useRef(false);

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const [otherPlayer, setOtherPlayer] = useState<ChatHeaderProfile | null>(
        null,
    );

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messageText, setMessageText] = useState("");
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [menuVisible, setMenuVisible] = useState(false);

    useEffect(() => {
        if (!conversationId) return;

        const cached = getCachedCommunityChat(conversationId);

        if (!cached) return;

        setMessages(cached.messages);
        setOtherPlayer(cached.otherPlayer);
        setLoading(false);
        didInitialScrollRef.current = false;
    }, [conversationId]);

    const syncMessageCache = useCallback(
        (nextMessages: ChatMessage[]) => {
            if (!conversationId) return;

            updateCachedCommunityChatMessages(conversationId, nextMessages);
        },
        [conversationId],
    );

    const markConversationRead = useCallback(
        async (userId?: string) => {
            if (!conversationId) return;

            const resolvedUserId = userId ?? currentUserIdRef.current;

            if (!resolvedUserId) return;

            const numericConversationId = Number(conversationId);

            if (!Number.isFinite(numericConversationId)) return;

            const { error } = await supabase
                .from("community_conversation_members")
                .update({
                    last_read_at: new Date().toISOString(),
                })
                .eq("conversation_id", numericConversationId)
                .eq("user_id", resolvedUserId);

            if (error) {
                console.warn("Could not update last read time:", error);
            }
        },
        [conversationId],
    );

    const scrollToLatest = useCallback((animated = true) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                listRef.current?.scrollToEnd({
                    animated,
                });
            });
        });
    }, []);

    const scrollToLatestAfterLayout = useCallback(
        (animated = false) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    scrollToLatest(animated);

                    setTimeout(() => {
                        scrollToLatest(animated);
                    }, 120);
                });
            });
        },
        [scrollToLatest],
    );

    const loadConversation = useCallback(async () => {
        if (!conversationId) {
            setErrorMessage("Conversation not found.");
            setLoading(false);
            return;
        }

        setErrorMessage(null);

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) {
                throw userError;
            }

            if (!user) {
                throw new Error(
                    "You must be signed in to view this conversation.",
                );
            }

            currentUserIdRef.current = user.id;
            setCurrentUserId(user.id);

            const numericConversationId = Number(conversationId);

            if (!Number.isFinite(numericConversationId)) {
                throw new Error("Invalid conversation.");
            }

            const { data: membershipData, error: membershipError } =
                await supabase
                    .from("community_conversation_members")
                    .select("conversation_id,user_id")
                    .eq("conversation_id", numericConversationId);

            if (membershipError) {
                throw membershipError;
            }

            const memberships = membershipData ?? [];

            const currentMembership = memberships.find(
                (membership) => membership.user_id === user.id,
            );

            if (!currentMembership) {
                throw new Error("You don't have access to this conversation.");
            }

            const otherMembership = memberships.find(
                (membership) => membership.user_id !== user.id,
            );

            let resolvedOtherPlayer: ChatHeaderProfile | null = null;

            if (otherMembership?.user_id) {
                const { data: profileData, error: profileError } =
                    await supabase.rpc("get_public_player_profile", {
                        p_user_id: otherMembership.user_id,
                    });

                if (profileError) {
                    console.warn(
                        "Could not load chat player profile:",
                        profileError,
                    );

                    resolvedOtherPlayer =
                        getCachedCommunityChat(conversationId)?.otherPlayer ??
                        null;
                } else {
                    const rawProfile = Array.isArray(profileData)
                        ? profileData[0]
                        : profileData;

                    const profile = (rawProfile ??
                        null) as PublicPlayerProfile | null;

                    resolvedOtherPlayer = {
                        userId: otherMembership.user_id,
                        name: profile?.full_name?.trim() || "Player",
                        avatar: profile?.avatar_url?.trim() || undefined,
                        role: profile?.role?.trim() || "player",
                    };

                    setOtherPlayer(resolvedOtherPlayer);
                }
            } else {
                setOtherPlayer(null);
            }

            const { data: messageData, error: messagesError } = await supabase
                .from("community_messages")
                .select("id,conversation_id,sender_id,content,created_at")
                .eq("conversation_id", numericConversationId)
                .order("created_at", {
                    ascending: false,
                })
                .limit(100);

            if (messagesError) {
                throw messagesError;
            }

            const rows = (messageData ?? []) as MessageRow[];

            const orderedRows = [...rows].reverse();

            const freshMessages = orderedRows.map(mapMessageRow);

            setMessages(freshMessages);

            setCachedCommunityChat(conversationId, {
                messages: freshMessages,
                otherPlayer: resolvedOtherPlayer,
            });

            void markConversationRead(user.id);
        } catch (error) {
            console.error("Failed to load community conversation:", error);

            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "We couldn't load this conversation.",
            );
        } finally {
            setLoading(false);
        }
    }, [conversationId, markConversationRead]);

    useEffect(() => {
        void loadConversation();
    }, [loadConversation]);

    useEffect(() => {
        if (!conversationId) return;

        const numericConversationId = Number(conversationId);

        if (!Number.isFinite(numericConversationId)) {
            return;
        }

        const channel = supabase
            .channel(`community-chat-${numericConversationId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "community_messages",
                    filter: `conversation_id=eq.${numericConversationId}`,
                },
                (payload) => {
                    const row = payload.new as MessageRow;

                    const realtimeMessage = mapMessageRow(row);

                    setMessages((current) => {
                        if (
                            current.some(
                                (message) => message.id === realtimeMessage.id,
                            )
                        ) {
                            return current;
                        }

                        let next: ChatMessage[];

                        if (row.sender_id === currentUserIdRef.current) {
                            const optimisticIndex = current.findIndex(
                                (message) =>
                                    message.pending &&
                                    message.senderId === row.sender_id &&
                                    message.content === row.content,
                            );

                            if (optimisticIndex !== -1) {
                                next = [...current];

                                next[optimisticIndex] = realtimeMessage;

                                syncMessageCache(next);

                                return next;
                            }
                        }

                        next = [...current, realtimeMessage];

                        syncMessageCache(next);

                        return next;
                    });

                    if (row.sender_id !== currentUserIdRef.current) {
                        void markConversationRead();

                        if (isNearBottomRef.current) {
                            setTimeout(() => {
                                scrollToLatestAfterLayout(true);
                            }, 0);
                        }
                    }
                },
            )
            .subscribe((status) => {
                if (status === "CHANNEL_ERROR") {
                    console.warn("Community chat realtime channel error.");
                }
            });

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [
        conversationId,
        markConversationRead,
        scrollToLatestAfterLayout,
        syncMessageCache,
    ]);

    const chatItems = useMemo<ChatListItem[]>(() => {
        const items: ChatListItem[] = [];
        let previousDateKey: string | null = null;

        messages.forEach((message, index) => {
            const dateKey = getDateKey(message.createdAt);

            if (dateKey !== previousDateKey) {
                items.push({
                    type: "date",
                    id: `date-${dateKey}`,
                    label: formatDateSeparator(message.createdAt),
                });

                previousDateKey = dateKey;
            }

            const previous = messages[index - 1];

            const next = messages[index + 1];

            items.push({
                type: "message",
                id: `message-${message.id}`,
                message,
                isMine: message.senderId === currentUserId,
                firstInGroup: !isSameMessageGroup(previous, message),
                lastInGroup: !isSameMessageGroup(message, next),
            });
        });

        return items;
    }, [currentUserId, messages]);

    async function sendMessage() {
        const content = messageText.trim();

        if (!content || !conversationId || !currentUserId) {
            return;
        }

        const numericConversationId = Number(conversationId);

        if (!Number.isFinite(numericConversationId)) {
            return;
        }

        setErrorMessage(null);

        const optimisticId = `pending-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

        const optimisticMessage: ChatMessage = {
            id: optimisticId,
            senderId: currentUserId,
            content,
            createdAt: new Date().toISOString(),
            pending: true,
        };

        setMessages((current) => {
            const next = [...current, optimisticMessage];

            syncMessageCache(next);

            return next;
        });

        setMessageText("");
        isNearBottomRef.current = true;

        setTimeout(() => {
            scrollToLatestAfterLayout(true);
        }, 0);

        try {
            const { data, error } = await supabase
                .from("community_messages")
                .insert({
                    conversation_id: numericConversationId,
                    sender_id: currentUserId,
                    content,
                })
                .select("id,conversation_id,sender_id,content,created_at")
                .single();

            if (error) {
                throw error;
            }

            const realMessage = mapMessageRow(data as MessageRow);

            setMessages((current) => {
                const alreadyExists = current.some(
                    (message) => message.id === realMessage.id,
                );

                const next = alreadyExists
                    ? current.filter((message) => message.id !== optimisticId)
                    : current.map((message) =>
                          message.id === optimisticId ? realMessage : message,
                      );

                syncMessageCache(next);

                return next;
            });

            void markConversationRead(currentUserId);
        } catch (error) {
            console.error("Failed to send community message:", error);

            setMessages((current) => {
                const next = current.filter(
                    (message) => message.id !== optimisticId,
                );

                syncMessageCache(next);

                return next;
            });

            setMessageText((current) =>
                current.trim().length === 0 ? content : current,
            );

            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "We couldn't send your message.",
            );
        }
    }

    const canSend = messageText.trim().length > 0 && !!currentUserId;

    const renderChatItem = useCallback(({ item }: { item: ChatListItem }) => {
        if (item.type === "date") {
            return (
                <View style={styles.dateRow}>
                    <View style={styles.datePill}>
                        <Text style={styles.dateText}>{item.label}</Text>
                    </View>
                </View>
            );
        }

        const { message, isMine, firstInGroup, lastInGroup } = item;

        return (
            <View
                style={[
                    styles.messageRow,
                    isMine ? styles.messageRowMine : styles.messageRowOther,
                    firstInGroup
                        ? styles.messageGroupStart
                        : styles.messageGroupContinuation,
                    message.pending && styles.messageRowPending,
                ]}
            >
                <View
                    style={[
                        styles.messageBubble,
                        isMine
                            ? styles.messageBubbleMine
                            : styles.messageBubbleOther,

                        !firstInGroup &&
                            (isMine
                                ? styles.mineConnectedTop
                                : styles.otherConnectedTop),

                        !lastInGroup &&
                            (isMine
                                ? styles.mineConnectedBottom
                                : styles.otherConnectedBottom),
                    ]}
                >
                    <Text
                        style={[
                            styles.messageText,
                            isMine
                                ? styles.messageTextMine
                                : styles.messageTextOther,
                        ]}
                    >
                        {message.content}
                    </Text>

                    {lastInGroup && (
                        <Text
                            style={[
                                styles.messageTime,
                                isMine
                                    ? styles.messageTimeMine
                                    : styles.messageTimeOther,
                            ]}
                        >
                            {message.pending
                                ? "Sending…"
                                : formatMessageTime(message.createdAt)}
                        </Text>
                    )}
                </View>
            </View>
        );
    }, []);

    useEffect(() => {
        const handleKeyboardShown = () => {
            keyboardVisibleRef.current = true;

            if (isNearBottomRef.current) {
                scrollToLatestAfterLayout(false);
            }
        };

        const handleKeyboardHidden = () => {
            keyboardVisibleRef.current = false;
        };

        const subscriptions = [
            Keyboard.addListener(
                Platform.OS === "ios"
                    ? "keyboardWillChangeFrame"
                    : "keyboardDidShow",
                handleKeyboardShown,
            ),
            Keyboard.addListener("keyboardDidShow", handleKeyboardShown),
            Keyboard.addListener("keyboardDidHide", handleKeyboardHidden),
        ];

        return () => {
            subscriptions.forEach((subscription) => subscription.remove());
        };
    }, [scrollToLatestAfterLayout]);

    const otherPlayerRoleLabel =
        otherPlayer?.role === "organizer"
            ? "Organizer"
            : otherPlayer?.role === "admin"
              ? "Addis Football"
              : "Player";

    return (
        <SafeAreaView edges={["top"]} style={styles.screen}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={0}
            >
                <View style={styles.header}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.headerButton,
                            pressed && styles.pressed,
                        ]}
                        onPress={() => router.back()}
                    >
                        <Ionicons
                            name="chevron-back"
                            size={25}
                            color={COLORS.text}
                        />
                    </Pressable>

                    <Pressable
                        style={({ pressed }) => [
                            styles.headerProfile,
                            pressed && styles.headerProfilePressed,
                        ]}
                        onPress={() => {
                            if (!otherPlayer?.userId) {
                                return;
                            }

                            router.push(
                                `/community/player/${otherPlayer.userId}`,
                            );
                        }}
                    >
                        {otherPlayer?.avatar ? (
                            <Image
                                source={{
                                    uri: otherPlayer.avatar,
                                }}
                                style={styles.headerAvatar}
                            />
                        ) : (
                            <View style={styles.headerAvatarFallback}>
                                <Ionicons
                                    name="person"
                                    size={19}
                                    color={COLORS.primary}
                                />
                            </View>
                        )}

                        <View style={styles.headerProfileText}>
                            <Text numberOfLines={1} style={styles.headerName}>
                                {otherPlayer?.name ?? "Conversation"}
                            </Text>

                            <Text style={styles.headerSubtitle}>
                                {otherPlayerRoleLabel}
                            </Text>
                        </View>
                    </Pressable>

                    <Pressable
                        style={({ pressed }) => [
                            styles.headerButton,
                            pressed && styles.pressed,
                        ]}
                        onPress={() => setMenuVisible(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Conversation options"
                    >
                        <Ionicons
                            name="ellipsis-horizontal"
                            size={21}
                            color={COLORS.textSecondary}
                        />
                    </Pressable>
                </View>

                {loading ? (
                    <View style={styles.centerState}>
                        <ActivityIndicator
                            size="small"
                            color={COLORS.primary}
                        />

                        <Text style={styles.stateText}>
                            Loading conversation...
                        </Text>
                    </View>
                ) : errorMessage && messages.length === 0 ? (
                    <View style={styles.centerState}>
                        <View style={styles.stateIcon}>
                            <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={27}
                                color={COLORS.primary}
                            />
                        </View>

                        <Text style={styles.stateTitle}>
                            Couldn't open chat
                        </Text>

                        <Text style={styles.stateText}>{errorMessage}</Text>

                        <Pressable
                            style={({ pressed }) => [
                                styles.retryButton,
                                pressed && styles.pressed,
                            ]}
                            onPress={() => {
                                setLoading(true);

                                void loadConversation();
                            }}
                        >
                            <Text style={styles.retryButtonText}>
                                Try again
                            </Text>
                        </Pressable>
                    </View>
                ) : (
                    <>
                        <FlatList
                            ref={listRef}
                            data={chatItems}
                            renderItem={renderChatItem}
                            keyExtractor={(item) => item.id}
                            style={styles.messagesList}
                            contentContainerStyle={[
                                styles.messagesContent,
                                messages.length === 0 &&
                                    styles.messagesContentEmpty,
                            ]}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode={
                                Platform.OS === "ios"
                                    ? "interactive"
                                    : "on-drag"
                            }
                            automaticallyAdjustKeyboardInsets={false}
                            onScroll={(event) => {
                                const {
                                    contentOffset,
                                    contentSize,
                                    layoutMeasurement,
                                } = event.nativeEvent;

                                const distanceFromBottom =
                                    contentSize.height -
                                    (contentOffset.y +
                                        layoutMeasurement.height);

                                isNearBottomRef.current =
                                    distanceFromBottom < 120;
                            }}
                            scrollEventThrottle={16}
                            onContentSizeChange={() => {
                                if (
                                    !didInitialScrollRef.current &&
                                    messages.length > 0
                                ) {
                                    didInitialScrollRef.current = true;

                                    isNearBottomRef.current = true;

                                    scrollToLatestAfterLayout(false);
                                }
                            }}
                            ListEmptyComponent={
                                <View style={styles.emptyConversation}>
                                    <View style={styles.emptyAvatar}>
                                        {otherPlayer?.avatar ? (
                                            <Image
                                                source={{
                                                    uri: otherPlayer.avatar,
                                                }}
                                                style={styles.emptyAvatarImage}
                                            />
                                        ) : (
                                            <Ionicons
                                                name="person"
                                                size={29}
                                                color={COLORS.primary}
                                            />
                                        )}
                                    </View>

                                    <Text style={styles.emptyTitle}>
                                        {otherPlayer?.name ??
                                            "New conversation"}
                                    </Text>

                                    <Text style={styles.emptyText}>
                                        Send a message to start the
                                        conversation.
                                    </Text>
                                </View>
                            }
                            ListFooterComponent={
                                errorMessage && messages.length > 0 ? (
                                    <Text style={styles.inlineError}>
                                        {errorMessage}
                                    </Text>
                                ) : null
                            }
                            initialNumToRender={20}
                            maxToRenderPerBatch={20}
                            windowSize={9}
                            removeClippedSubviews={Platform.OS !== "web"}
                        />

                        <View
                            style={styles.composer}
                            onLayout={() => {
                                if (
                                    keyboardVisibleRef.current &&
                                    isNearBottomRef.current
                                ) {
                                    scrollToLatestAfterLayout(false);
                                }
                            }}
                        >
                            <TextInput
                                value={messageText}
                                onChangeText={(text) => {
                                    setMessageText(text);

                                    if (errorMessage) {
                                        setErrorMessage(null);
                                    }
                                }}
                                placeholder="Message"
                                placeholderTextColor={COLORS.textMuted}
                                style={styles.input}
                                multiline
                                maxLength={2000}
                                autoCorrect
                                returnKeyType="send"
                                blurOnSubmit
                                onSubmitEditing={() => {
                                    if (canSend) {
                                        void sendMessage();
                                    }

                                    Keyboard.dismiss();
                                }}
                                scrollEnabled
                                textAlignVertical="center"
                            />

                            <Pressable
                                style={({ pressed }) => [
                                    styles.sendButton,
                                    !canSend && styles.sendButtonDisabled,
                                    pressed && canSend && styles.pressed,
                                ]}
                                disabled={!canSend}
                                onPress={() => {
                                    void sendMessage();
                                }}
                            >
                                <Ionicons
                                    name="arrow-up"
                                    size={20}
                                    color={COLORS.white}
                                />
                            </Pressable>
                        </View>
                    </>
                )}
            </KeyboardAvoidingView>

            {/* ===== END HALF 1 ===== */}
            <Modal
                visible={menuVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
            >
                <Pressable
                    style={styles.menuOverlay}
                    onPress={() => setMenuVisible(false)}
                >
                    <Pressable
                        style={styles.menuSheet}
                        onPress={(event) => event.stopPropagation()}
                    >
                        <View style={styles.menuHandle} />

                        <Text style={styles.menuTitle}>Conversation</Text>

                        <Pressable
                            style={({ pressed }) => [
                                styles.menuItem,
                                pressed && styles.menuItemPressed,
                            ]}
                            onPress={() => {
                                setMenuVisible(false);

                                if (!otherPlayer?.userId) return;

                                router.push(
                                    `/community/player/${otherPlayer.userId}`,
                                );
                            }}
                        >
                            <View style={styles.menuItemIcon}>
                                <Ionicons
                                    name="person-outline"
                                    size={20}
                                    color={COLORS.primary}
                                />
                            </View>

                            <View style={styles.menuItemText}>
                                <Text style={styles.menuItemTitle}>
                                    View profile
                                </Text>

                                <Text style={styles.menuItemSubtitle}>
                                    View this player's profile
                                </Text>
                            </View>

                            <Ionicons
                                name="chevron-forward"
                                size={19}
                                color={COLORS.textMuted}
                            />
                        </Pressable>

                        <Pressable
                            style={({ pressed }) => [
                                styles.menuCancel,
                                pressed && styles.menuItemPressed,
                            ]}
                            onPress={() => setMenuVisible(false)}
                        >
                            <Text style={styles.menuCancelText}>Cancel</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },

    keyboardView: {
        flex: 1,
    },

    pressed: {
        opacity: 0.65,
    },

    header: {
        height: 62,
        paddingHorizontal: 10,
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.white,
    },

    headerButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
    },

    headerProfile: {
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 4,
        borderRadius: 12,
    },

    headerProfilePressed: {
        opacity: 0.7,
    },

    headerAvatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: COLORS.surfaceAlt,
    },

    headerAvatarFallback: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
    },

    headerProfileText: {
        flex: 1,
        minWidth: 0,
        marginLeft: 9,
    },

    headerName: {
        color: COLORS.text,
        fontSize: 14,
        lineHeight: 18,
        fontWeight: "900",
    },

    headerSubtitle: {
        color: COLORS.textMuted,
        fontSize: 10,
        lineHeight: 14,
        fontWeight: "600",
        marginTop: 1,
    },

    centerState: {
        flex: 1,
        paddingHorizontal: 30,
        alignItems: "center",
        justifyContent: "center",
    },

    stateIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
    },

    stateTitle: {
        color: COLORS.text,
        fontSize: 17,
        lineHeight: 22,
        fontWeight: "900",
        marginTop: 13,
        textAlign: "center",
    },

    stateText: {
        maxWidth: 300,
        color: COLORS.textSecondary,
        fontSize: 12,
        lineHeight: 18,
        fontWeight: "500",
        textAlign: "center",
        marginTop: 7,
    },

    retryButton: {
        height: 40,
        paddingHorizontal: 18,
        borderRadius: 20,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 16,
    },

    retryButtonText: {
        color: COLORS.primary,
        fontSize: 12,
        fontWeight: "900",
    },

    messagesList: {
        flex: 1,
    },

    messagesContent: {
        flexGrow: 1,
        width: "100%",
        maxWidth: 680,
        alignSelf: "center",
        paddingHorizontal: 13,
        paddingTop: 12,
        paddingBottom: 10,
    },

    messagesContentEmpty: {
        justifyContent: "center",
    },

    emptyConversation: {
        flex: 1,
        minHeight: 330,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 30,
    },

    emptyAvatar: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },

    emptyAvatarImage: {
        width: "100%",
        height: "100%",
    },

    emptyTitle: {
        color: COLORS.text,
        fontSize: 17,
        lineHeight: 22,
        fontWeight: "900",
        marginTop: 12,
    },

    emptyText: {
        maxWidth: 250,
        color: COLORS.textSecondary,
        fontSize: 12,
        lineHeight: 18,
        fontWeight: "500",
        textAlign: "center",
        marginTop: 4,
    },

    dateRow: {
        alignItems: "center",
        marginVertical: 12,
    },

    datePill: {
        backgroundColor: COLORS.surfaceAlt,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },

    dateText: {
        color: COLORS.textSecondary,
        fontSize: 10,
        lineHeight: 14,
        fontWeight: "800",
    },

    messageRow: {
        width: "100%",
    },

    messageRowMine: {
        alignItems: "flex-end",
    },

    messageRowOther: {
        alignItems: "flex-start",
    },

    messageGroupStart: {
        marginTop: 9,
    },

    messageGroupContinuation: {
        marginTop: 3,
    },

    messageRowPending: {
        opacity: 0.82,
    },

    messageBubble: {
        maxWidth: "78%",
        paddingHorizontal: 13,
        paddingTop: 8,
        paddingBottom: 6,
    },

    messageBubbleMine: {
        backgroundColor: COLORS.primary,
        borderRadius: 18,
        borderBottomRightRadius: 5,
    },

    messageBubbleOther: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        borderBottomLeftRadius: 5,
    },

    mineConnectedTop: {
        borderTopRightRadius: 7,
    },

    mineConnectedBottom: {
        borderBottomRightRadius: 7,
    },

    otherConnectedTop: {
        borderTopLeftRadius: 7,
    },

    otherConnectedBottom: {
        borderBottomLeftRadius: 7,
    },

    messageText: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: "500",
    },

    messageTextMine: {
        color: COLORS.white,
    },

    messageTextOther: {
        color: COLORS.text,
    },

    messageTime: {
        fontSize: 9,
        lineHeight: 12,
        fontWeight: "600",
        marginTop: 3,
        alignSelf: "flex-end",
    },

    messageTimeMine: {
        color: "rgba(255,255,255,0.72)",
    },

    messageTimeOther: {
        color: COLORS.textMuted,
    },

    inlineError: {
        color: COLORS.danger,
        fontSize: 11,
        lineHeight: 16,
        textAlign: "center",
        marginVertical: 10,
    },

    composer: {
        paddingHorizontal: 10,
        paddingTop: 7,
        paddingBottom: 7,
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 7,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.border,
        backgroundColor: COLORS.white,
    },

    input: {
        flex: 1,
        minHeight: 42,
        maxHeight: 104,
        borderRadius: 21,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
        color: COLORS.text,
        fontSize: 15,
        lineHeight: 20,
        paddingHorizontal: 14,
        paddingTop: Platform.OS === "ios" ? 10 : 8,
        paddingBottom: Platform.OS === "ios" ? 10 : 8,
        margin: 0,
    },

    sendButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: COLORS.primary,
        alignItems: "center",
        justifyContent: "center",
    },

    sendButtonDisabled: {
        opacity: 0.28,
    },

    menuOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.28)",
        justifyContent: "flex-end",
    },

    menuSheet: {
        width: "100%",
        maxWidth: 600,
        alignSelf: "center",
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 18,
        paddingTop: 10,
        paddingBottom: Platform.OS === "ios" ? 28 : 18,
    },

    menuHandle: {
        width: 38,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.border,
        alignSelf: "center",
        marginBottom: 14,
    },

    menuTitle: {
        color: COLORS.text,
        fontSize: 18,
        lineHeight: 23,
        fontWeight: "900",
        marginBottom: 10,
    },

    menuItem: {
        minHeight: 64,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 16,
        paddingHorizontal: 10,
    },

    menuItemPressed: {
        backgroundColor: COLORS.surfaceAlt,
    },

    menuItemIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 11,
    },

    menuItemText: {
        flex: 1,
        minWidth: 0,
    },

    menuItemTitle: {
        color: COLORS.text,
        fontSize: 14,
        lineHeight: 18,
        fontWeight: "800",
    },

    menuItemSubtitle: {
        color: COLORS.textSecondary,
        fontSize: 11,
        lineHeight: 15,
        fontWeight: "500",
        marginTop: 2,
    },

    menuCancel: {
        height: 48,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
        backgroundColor: COLORS.surfaceAlt,
    },

    menuCancelText: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: "800",
    },
});
