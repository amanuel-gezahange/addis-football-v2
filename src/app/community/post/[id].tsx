import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../../constants/colors";
import { supabase } from "../../../lib/supabase";

type CommunityPostRow = {
    id: number;
    user_id: string;
    content: string;
    group_id: string | null;
    image_url: string | null;
    created_at: string;
};

type CommunityCommentRow = {
    id: number;
    post_id: number;
    user_id: string;
    content: string;
    created_at: string;
};

type PublicPlayerProfile = {
    user_id?: string;
    id?: string;
    full_name?: string | null;
    avatar_url?: string | null;
};

type PostDetails = {
    id: string;
    userId: string;
    groupId: string | null;
    author: string;
    avatar?: string;
    group: string;
    time: string;
    text: string;
    image?: string;
};

type Comment = {
    id: string;
    userId: string;
    author: string;
    avatar?: string;
    text: string;
    time: string;
};

function getGroupName(groupId: string | null) {
    switch (groupId) {
        case "bole":
            return "Bole Players";

        case "cmc":
            return "CMC Football";

        case "beginners":
            return "Beginners Football";

        default:
            return "All Addis Football";
    }
}

function getTime(createdAt: string) {
    const created = new Date(createdAt);
    const now = new Date();

    const differenceMs = now.getTime() - created.getTime();

    const differenceMinutes = Math.max(0, Math.floor(differenceMs / 60000));

    if (differenceMinutes < 1) {
        return "now";
    }

    if (differenceMinutes < 60) {
        return `${differenceMinutes}m`;
    }

    const differenceHours = Math.floor(differenceMinutes / 60);

    if (differenceHours < 24) {
        return `${differenceHours}h`;
    }

    const differenceDays = Math.floor(differenceHours / 24);

    if (differenceDays < 7) {
        return `${differenceDays}d`;
    }

    return created.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
}

async function getPublicProfile(userId: string) {
    const { data, error } = await supabase.rpc("get_public_player_profile", {
        p_user_id: userId,
    });

    if (error) {
        console.warn("Could not load player profile:", userId, error);

        return null;
    }

    const profile = Array.isArray(data) ? data[0] : data;

    return (profile ?? null) as PublicPlayerProfile | null;
}


type CommunityPostCacheEntry = {
    post: PostDetails;
    comments: Comment[];
    joined: boolean;
    membershipResolved: boolean;
};

const communityPostCache: Record<string, CommunityPostCacheEntry> = {};

function getCommunityPostCache(postId?: string) {
    return postId ? communityPostCache[postId] : undefined;
}

export default function CommunityPostScreen() {
    const params = useLocalSearchParams<{
        id?: string | string[];
    }>();

    const postId = Array.isArray(params.id) ? params.id[0] : params.id;

    const cachedPost = getCommunityPostCache(postId);

    const [post, setPost] = useState<PostDetails | null>(
        () => cachedPost?.post ?? null,
    );

    const [comments, setComments] = useState<Comment[]>(
        () => cachedPost?.comments ?? [],
    );

    const [loading, setLoading] = useState(() => !cachedPost);

    const [error, setError] = useState<string | null>(null);

    const [commentText, setCommentText] = useState("");

    const [posting, setPosting] = useState(false);

    const [joined, setJoined] = useState(
        () => cachedPost?.joined ?? false,
    );

    const [membershipLoading, setMembershipLoading] = useState(
        () => !cachedPost?.membershipResolved,
    );

    const [joiningGroup, setJoiningGroup] = useState(false);

    const loadPost = useCallback(async () => {
        if (!postId) {
            setError("Post not found.");
            setLoading(false);
            return;
        }

        if (!getCommunityPostCache(postId)) {
            setLoading(true);
        }
        setError(null);

        try {
            const numericPostId = Number(postId);

            if (!Number.isFinite(numericPostId)) {
                throw new Error("Invalid post.");
            }

            const { data: postData, error: postError } = await supabase
                .from("community_posts")
                .select("id,user_id,content,group_id,image_url,created_at")
                .eq("id", numericPostId)
                .single();

            if (postError) {
                throw postError;
            }

            const postRow = postData as CommunityPostRow;

            const { data: commentData, error: commentsError } = await supabase
                .from("community_post_comments")
                .select("id,post_id,user_id,content,created_at")
                .eq("post_id", numericPostId)
                .order("created_at", {
                    ascending: true,
                });

            if (commentsError) {
                throw commentsError;
            }

            const commentRows = (commentData ?? []) as CommunityCommentRow[];

            const uniqueUserIds = [
                ...new Set([
                    postRow.user_id,
                    ...commentRows.map((comment) => comment.user_id),
                ]),
            ];

            const profileEntries = await Promise.all(
                uniqueUserIds.map(async (userId) => {
                    const profile = await getPublicProfile(userId);

                    return [userId, profile] as const;
                }),
            );

            const profiles = new Map(profileEntries);

            const postProfile = profiles.get(postRow.user_id);

            const nextPost: PostDetails = {
                id: String(postRow.id),
                userId: postRow.user_id,
                groupId: postRow.group_id,
                author: postProfile?.full_name?.trim() || "Player",
                avatar: postProfile?.avatar_url?.trim() || undefined,
                group: getGroupName(postRow.group_id),
                time: getTime(postRow.created_at),
                text: postRow.content,
                image: postRow.image_url || undefined,
            };

            const nextComments: Comment[] = commentRows.map((comment) => {
                const profile = profiles.get(comment.user_id);

                return {
                    id: String(comment.id),
                    userId: comment.user_id,
                    author: profile?.full_name?.trim() || "Player",
                    avatar: profile?.avatar_url?.trim() || undefined,
                    text: comment.content,
                    time: getTime(comment.created_at),
                };
            });

            setPost(nextPost);
            setComments(nextComments);

            const previous = getCommunityPostCache(postId);
            communityPostCache[postId] = {
                post: nextPost,
                comments: nextComments,
                joined: previous?.joined ?? (nextPost.groupId ? false : true),
                membershipResolved:
                    previous?.membershipResolved ?? !nextPost.groupId,
            };
        } catch (loadError) {
            console.error("Failed to load community post:", loadError);

            if (!getCommunityPostCache(postId)) {
                setError(
                    loadError instanceof Error
                        ? loadError.message
                        : "We couldn't load this post.",
                );
            }
        } finally {
            setLoading(false);
        }
    }, [postId]);

    useEffect(() => {
        void loadPost();
    }, [loadPost]);

    const loadMembership = useCallback(async () => {
        if (!post?.groupId) {
            setJoined(true);
            setMembershipLoading(false);

            if (postId && post) {
                communityPostCache[postId] = {
                    post,
                    comments,
                    joined: true,
                    membershipResolved: true,
                };
            }

            return;
        }

        const cached = getCommunityPostCache(postId);
        if (!cached?.membershipResolved) {
            setMembershipLoading(true);
        }

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) {
                throw userError;
            }

            if (!user) {
                setJoined(false);

                if (postId && post) {
                    communityPostCache[postId] = {
                        post,
                        comments,
                        joined: false,
                        membershipResolved: true,
                    };
                }

                return;
            }

            const { data, error: membershipError } = await supabase
                .from("community_group_members")
                .select("id")
                .eq("group_id", post.groupId)
                .eq("user_id", user.id)
                .maybeSingle();

            if (membershipError) {
                throw membershipError;
            }

            const nextJoined = !!data;
            setJoined(nextJoined);

            if (postId && post) {
                communityPostCache[postId] = {
                    post,
                    comments,
                    joined: nextJoined,
                    membershipResolved: true,
                };
            }
        } catch (membershipError) {
            console.error(
                "Failed to load group membership:",
                membershipError,
            );
            setJoined(false);
        } finally {
            setMembershipLoading(false);
        }
    }, [post?.groupId]);

    useEffect(() => {
        void loadMembership();
    }, [loadMembership]);

    async function joinGroupToComment() {
        if (
            !post?.groupId ||
            joined ||
            joiningGroup
        ) {
            return;
        }

        setJoiningGroup(true);

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) {
                throw userError;
            }

            if (!user) {
                throw new Error("You must be signed in to join this group.");
            }

            const { error: joinError } = await supabase
                .from("community_group_members")
                .upsert(
                    {
                        group_id: post.groupId,
                        user_id: user.id,
                    },
                    {
                        onConflict: "group_id,user_id",
                    },
                );

            if (joinError) {
                throw joinError;
            }

            setJoined(true);

            if (postId && post) {
                communityPostCache[postId] = {
                    post,
                    comments,
                    joined: true,
                    membershipResolved: true,
                };
            }
        } catch (joinError) {
            console.error("Failed to join group:", joinError);
            Alert.alert("Couldn't join group", "Please try again.");
        } finally {
            setJoiningGroup(false);
        }
    }

    async function submitComment() {
        const content = commentText.trim();

        if (!content || posting || !postId) {
            return;
        }

        if (post?.groupId && !joined) {
            Alert.alert(
                "Join group to comment",
                `Join ${post.group} to participate in this conversation.`,
                [
                    {
                        text: "Cancel",
                        style: "cancel",
                    },
                    {
                        text: "Join Group",
                        onPress: () => {
                            void joinGroupToComment();
                        },
                    },
                ],
            );
            return;
        }

        setPosting(true);

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) {
                throw userError;
            }

            if (!user) {
                throw new Error("You must be signed in to comment.");
            }

            const numericPostId = Number(postId);

            const { data, error: insertError } = await supabase
                .from("community_post_comments")
                .insert({
                    post_id: numericPostId,
                    user_id: user.id,
                    content,
                })
                .select("id,post_id,user_id,content,created_at")
                .single();

            if (insertError) {
                throw insertError;
            }

            const inserted = data as CommunityCommentRow;

            const profile = await getPublicProfile(user.id);

            const newComment: Comment = {
                id: String(inserted.id),
                userId: inserted.user_id,
                author: profile?.full_name?.trim() || "Player",
                avatar: profile?.avatar_url?.trim() || undefined,
                text: inserted.content,
                time: "now",
            };

            setComments((current) => {
                const nextComments = [...current, newComment];

                if (postId && post) {
                    communityPostCache[postId] = {
                        post,
                        comments: nextComments,
                        joined,
                        membershipResolved: true,
                    };
                }

                return nextComments;
            });

            setCommentText("");
            Keyboard.dismiss();
        } catch (submitError) {
            console.error("Failed to post comment:", submitError);
        } finally {
            setPosting(false);
        }
    }

    if (loading) {
        return (
            <SafeAreaView style={styles.screen}>
                <View style={styles.centerState}>
                    <ActivityIndicator size="small" color={COLORS.primary} />

                    <Text style={styles.stateText}>Loading post...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error || !post) {
        return (
            <SafeAreaView style={styles.screen}>
                <View style={styles.header}>
                    <Pressable
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Ionicons
                            name="arrow-back"
                            size={23}
                            color={COLORS.text}
                        />
                    </Pressable>

                    <Text style={styles.headerTitle}>Post</Text>

                    <View style={styles.headerSpacer} />
                </View>

                <View style={styles.centerState}>
                    <Ionicons
                        name="alert-circle-outline"
                        size={30}
                        color={COLORS.danger}
                    />

                    <Text style={styles.stateTitle}>Couldn't load post</Text>

                    <Text style={styles.stateText}>{error}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <View style={styles.header}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.backButton,
                            pressed && styles.pressed,
                        ]}
                        onPress={() => router.back()}
                    >
                        <Ionicons
                            name="arrow-back"
                            size={23}
                            color={COLORS.text}
                        />
                    </Pressable>

                    <Text style={styles.headerTitle}>Post</Text>

                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView
                    style={styles.flex}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.postCard}>
                        <View style={styles.postHeader}>
                            {post.avatar ? (
                                <Image
                                    source={{
                                        uri: post.avatar,
                                    }}
                                    style={styles.postAvatar}
                                />
                            ) : (
                                <View style={styles.avatarFallback}>
                                    <Ionicons
                                        name="person"
                                        size={20}
                                        color={COLORS.primary}
                                    />
                                </View>
                            )}

                            <View style={styles.postAuthorContent}>
                                <Text style={styles.authorName}>
                                    {post.author}
                                </Text>

                                <Text style={styles.postMeta}>
                                    {post.group} · {post.time}
                                </Text>
                            </View>

                            <Ionicons
                                name="ellipsis-horizontal"
                                size={20}
                                color={COLORS.textSecondary}
                            />
                        </View>

                        <Text style={styles.postText}>{post.text}</Text>

                        {post.image && (
                            <Image
                                source={{
                                    uri: post.image,
                                }}
                                style={styles.postImage}
                            />
                        )}
                    </View>

                    <View style={styles.commentsHeader}>
                        <Text style={styles.commentsTitle}>Comments</Text>

                        <Text style={styles.commentCount}>
                            {comments.length}
                        </Text>
                    </View>

                    {comments.length === 0 ? (
                        <View style={styles.emptyComments}>
                            <View style={styles.emptyIcon}>
                                <Ionicons
                                    name="chatbubble-outline"
                                    size={23}
                                    color={COLORS.primary}
                                />
                            </View>

                            <Text style={styles.emptyTitle}>
                                No comments yet
                            </Text>

                            <Text style={styles.emptyText}>
                                {post.groupId && !joined
                                    ? `Join ${post.group} to participate in the conversation.`
                                    : "Be the first to join the conversation."}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.commentsList}>
                            {comments.map((comment) => (
                                <View
                                    key={comment.id}
                                    style={styles.commentRow}
                                >
                                    {comment.avatar ? (
                                        <Image
                                            source={{
                                                uri: comment.avatar,
                                            }}
                                            style={styles.commentAvatar}
                                        />
                                    ) : (
                                        <View
                                            style={styles.commentAvatarFallback}
                                        >
                                            <Ionicons
                                                name="person"
                                                size={16}
                                                color={COLORS.primary}
                                            />
                                        </View>
                                    )}

                                    <View style={styles.commentContent}>
                                        <View style={styles.commentTopRow}>
                                            <Text style={styles.commentAuthor}>
                                                {comment.author}
                                            </Text>

                                            <Text style={styles.commentTime}>
                                                {comment.time}
                                            </Text>
                                        </View>

                                        <Text style={styles.commentText}>
                                            {comment.text}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </ScrollView>

                <View style={styles.composerContainer}>
                    {membershipLoading ? (
                        <View style={styles.membershipComposerState}>
                            <ActivityIndicator
                                size="small"
                                color={COLORS.primary}
                            />
                        </View>
                    ) : post.groupId && !joined ? (
                        <Pressable
                            style={({ pressed }) => [
                                styles.joinToCommentButton,
                                pressed && styles.pressed,
                            ]}
                            disabled={joiningGroup}
                            onPress={() => {
                                void joinGroupToComment();
                            }}
                        >
                            {joiningGroup ? (
                                <ActivityIndicator
                                    size="small"
                                    color={COLORS.white}
                                />
                            ) : (
                                <>
                                    <Ionicons
                                        name="people-outline"
                                        size={18}
                                        color={COLORS.white}
                                    />
                                    <Text style={styles.joinToCommentText}>
                                        Join {post.group} to comment
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    ) : (
                        <View style={styles.composer}>
                            <TextInput
                                value={commentText}
                                onChangeText={setCommentText}
                                placeholder="Write a comment..."
                                placeholderTextColor={COLORS.textMuted}
                                style={styles.commentInput}
                                multiline
                                maxLength={1000}
                                returnKeyType="done"
                                blurOnSubmit
                                onSubmitEditing={() => {
                                    void submitComment();
                                    Keyboard.dismiss();
                                }}
                            />

                            <Pressable
                                style={({ pressed }) => [
                                    styles.sendButton,
                                    !commentText.trim() &&
                                        styles.sendButtonDisabled,
                                    pressed &&
                                        !!commentText.trim() &&
                                        styles.pressed,
                                ]}
                                disabled={!commentText.trim() || posting}
                                onPress={() => {
                                    void submitComment();
                                }}
                            >
                                {posting ? (
                                    <ActivityIndicator
                                        size="small"
                                        color={COLORS.white}
                                    />
                                ) : (
                                    <Ionicons
                                        name="arrow-up"
                                        size={20}
                                        color={COLORS.white}
                                    />
                                )}
                            </Pressable>
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#F7F8FA",
    },

    flex: {
        flex: 1,
    },

    pressed: {
        opacity: 0.65,
    },

    header: {
        height: 56,
        paddingHorizontal: 12,
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#DDE6E2",
    },

    backButton: {
        width: 42,
        height: 42,
        alignItems: "center",
        justifyContent: "center",
    },

    headerTitle: {
        flex: 1,
        color: COLORS.text,
        fontSize: 17,
        lineHeight: 22,
        fontWeight: "900",
        textAlign: "center",
    },

    headerSpacer: {
        width: 42,
    },

    scrollContent: {
        paddingBottom: 20,
    },

    centerState: {
        flex: 1,
        paddingHorizontal: 30,
        alignItems: "center",
        justifyContent: "center",
    },

    stateTitle: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: "900",
        marginTop: 10,
    },

    stateText: {
        color: COLORS.textSecondary,
        fontSize: 13,
        lineHeight: 19,
        textAlign: "center",
        marginTop: 7,
    },

    postCard: {
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 15,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#DDE6E2",
    },

    postHeader: {
        flexDirection: "row",
        alignItems: "center",
    },

    postAvatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: COLORS.surfaceAlt,
    },

    avatarFallback: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
    },

    postAuthorContent: {
        flex: 1,
        marginLeft: 10,
    },

    authorName: {
        color: COLORS.text,
        fontSize: 14,
        lineHeight: 18,
        fontWeight: "900",
    },

    postMeta: {
        color: COLORS.textMuted,
        fontSize: 11,
        lineHeight: 15,
        fontWeight: "600",
        marginTop: 1,
    },

    postText: {
        color: COLORS.text,
        fontSize: 14,
        lineHeight: 21,
        fontWeight: "500",
        marginTop: 13,
    },

    postImage: {
        width: "100%",
        height: 220,
        borderRadius: 14,
        backgroundColor: COLORS.surfaceAlt,
        marginTop: 13,
    },

    commentsHeader: {
        height: 51,
        paddingHorizontal: 16,
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E7ECEA",
    },

    commentsTitle: {
        color: COLORS.text,
        fontSize: 15,
        lineHeight: 20,
        fontWeight: "900",
    },

    commentCount: {
        color: COLORS.textSecondary,
        fontSize: 12,
        fontWeight: "700",
        marginLeft: 6,
    },

    emptyComments: {
        minHeight: 210,
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 24,
        alignItems: "center",
        justifyContent: "center",
    },

    emptyIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
    },

    emptyTitle: {
        color: COLORS.text,
        fontSize: 15,
        fontWeight: "900",
        marginTop: 11,
    },

    emptyText: {
        color: COLORS.textSecondary,
        fontSize: 12,
        lineHeight: 18,
        textAlign: "center",
        marginTop: 4,
    },

    commentsList: {
        backgroundColor: "#FFFFFF",
    },

    commentRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#EDF1EF",
    },

    commentAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.surfaceAlt,
    },

    commentAvatarFallback: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
    },

    commentContent: {
        flex: 1,
        marginLeft: 10,
        minWidth: 0,
    },

    commentTopRow: {
        flexDirection: "row",
        alignItems: "center",
    },

    commentAuthor: {
        flex: 1,
        color: COLORS.text,
        fontSize: 13,
        lineHeight: 17,
        fontWeight: "800",
    },

    commentTime: {
        color: COLORS.textMuted,
        fontSize: 10,
        lineHeight: 14,
        fontWeight: "600",
        marginLeft: 8,
    },

    commentText: {
        color: COLORS.text,
        fontSize: 13,
        lineHeight: 19,
        fontWeight: "500",
        marginTop: 3,
    },

    composerContainer: {
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: "#FFFFFF",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#DDE6E2",
    },

    membershipComposerState: {
        minHeight: 46,
        alignItems: "center",
        justifyContent: "center",
    },

    joinToCommentButton: {
        minHeight: 46,
        borderRadius: 23,
        backgroundColor: COLORS.primary,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        paddingHorizontal: 16,
    },

    joinToCommentText: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: "900",
    },

    composer: {
        minHeight: 46,
        borderRadius: 23,
        backgroundColor: COLORS.surfaceAlt,
        flexDirection: "row",
        alignItems: "flex-end",
        paddingLeft: 15,
        paddingRight: 5,
        paddingVertical: 5,
    },

    commentInput: {
        flex: 1,
        minHeight: 36,
        maxHeight: 110,
        color: COLORS.text,
        fontSize: 14,
        lineHeight: 19,
        paddingTop: 8,
        paddingBottom: 8,
        paddingRight: 8,
    },

    sendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.primary,
        alignItems: "center",
        justifyContent: "center",
    },

    sendButtonDisabled: {
        opacity: 0.35,
    },
});
