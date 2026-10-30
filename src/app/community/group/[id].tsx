import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../../constants/colors";
import { supabase } from "../../../lib/supabase";

type GroupTab = "posts" | "games" | "members";

type GroupGameRow = {
    id: number;
    title: string | null;
    area: string | null;
    starts_at: string | null;
    format: string | null;
    skill: string | null;
    price: number | null;
    spots_left: number | null;
    status: string | null;
    image_url: string | null;
    community_group_id: string | null;
};

type GroupGame = {
    id: string;
    title: string;
    area: string;
    startsAt: string | null;
    format: string;
    skill: string;
    price: number;
    spotsLeft: number;
    status: string;
    image?: string;
};

type CommunityGroupRow = {
    id: string;
    name: string;
    description: string;
    created_at?: string;
};

function getInitials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
        return "P";
    }

    if (parts.length === 1) {
        return parts[0].slice(0, 1).toUpperCase();
    }

    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getPostTime(createdAt: string) {
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

function getGameDateTime(startsAt: string | null) {
    if (!startsAt) {
        return "Time TBD";
    }

    const date = new Date(startsAt);

    if (Number.isNaN(date.getTime())) {
        return "Time TBD";
    }

    return date.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function getGamePrice(price: number) {
    return price > 0 ? `${price} ETB` : "Free";
}

type GroupDetailsCacheEntry = {
    group: CommunityGroupRow | null;
    joined: boolean;
    memberCount: number;
    members: GroupMember[];
    posts: GroupPost[];
    likedPosts: Record<string, boolean>;
    games: GroupGame[];
    activeTab: GroupTab;
};

const groupDetailsCache: Record<string, GroupDetailsCacheEntry> = {};

function getGroupDetailsCache(groupId?: string) {
    return groupId ? groupDetailsCache[groupId] : undefined;
}

export default function GroupDetailsScreen() {
    const params = useLocalSearchParams<{
        id: string | string[];
    }>();

    const groupId = Array.isArray(params.id) ? params.id[0] : params.id;

    const [group, setGroup] = useState<CommunityGroupRow | null>(
        () => getGroupDetailsCache(groupId)?.group ?? null,
    );

    const [groupLoading, setGroupLoading] = useState(
        () => !getGroupDetailsCache(groupId)?.group,
    );

    const [groupError, setGroupError] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<GroupTab>(
        () => getGroupDetailsCache(groupId)?.activeTab ?? "posts",
    );

    const [joined, setJoined] = useState(
        () => getGroupDetailsCache(groupId)?.joined ?? false,
    );

    const [memberCount, setMemberCount] = useState(
        () => getGroupDetailsCache(groupId)?.memberCount ?? 0,
    );

    const [members, setMembers] = useState<GroupMember[]>(
        () => getGroupDetailsCache(groupId)?.members ?? [],
    );

    const [membershipLoading, setMembershipLoading] = useState(
        () => !getGroupDetailsCache(groupId),
    );

    const [membersLoading, setMembersLoading] = useState(
        () => !getGroupDetailsCache(groupId),
    );

    const [membersError, setMembersError] = useState<string | null>(null);

    const [updatingMembership, setUpdatingMembership] = useState(false);

    const [groupMenuVisible, setGroupMenuVisible] = useState(false);

    // =========================================================
    // GROUP POSTS
    // =========================================================

    const [posts, setPosts] = useState<GroupPost[]>(
        () => getGroupDetailsCache(groupId)?.posts ?? [],
    );

    const [postsLoading, setPostsLoading] = useState(
        () => !getGroupDetailsCache(groupId),
    );

    const [postsError, setPostsError] = useState<string | null>(null);

    const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>(
        () => getGroupDetailsCache(groupId)?.likedPosts ?? {},
    );

    const [likingPosts, setLikingPosts] = useState<Record<string, boolean>>({});

    // =========================================================
    // GROUP GAMES
    // =========================================================

    const [games, setGames] = useState<GroupGame[]>(
        () => getGroupDetailsCache(groupId)?.games ?? [],
    );

    const [gamesLoading, setGamesLoading] = useState(
        () => !getGroupDetailsCache(groupId),
    );

    const [gamesError, setGamesError] = useState<string | null>(null);

    // =========================================================
    // LOAD GROUP
    // =========================================================

    const loadGroup = useCallback(async () => {
        if (!groupId) {
            setGroup(null);
            setGroupError("Group not found.");
            setGroupLoading(false);
            return;
        }

        const cached = getGroupDetailsCache(groupId);
        if (!cached?.group) {
            setGroupLoading(true);
        }
        setGroupError(null);

        try {
            const { data, error } = await supabase
                .from("community_groups")
                .select("id,name,description,created_at")
                .eq("id", groupId)
                .maybeSingle();

            if (error) {
                throw error;
            }

            const nextGroup = (data ?? null) as CommunityGroupRow | null;

            setGroup(nextGroup);

            if (nextGroup) {
                const previous = getGroupDetailsCache(groupId);
                groupDetailsCache[groupId] = {
                    group: nextGroup,
                    joined: previous?.joined ?? joined,
                    memberCount: previous?.memberCount ?? memberCount,
                    members: previous?.members ?? members,
                    posts: previous?.posts ?? posts,
                    likedPosts: previous?.likedPosts ?? likedPosts,
                    games: previous?.games ?? games,
                    activeTab: previous?.activeTab ?? activeTab,
                };
            }

            if (!data) {
                setGroupError("Group not found.");
            }
        } catch (error) {
            console.error("Failed to load community group:", error);

            setGroup(null);
            setGroupError(
                error instanceof Error
                    ? error.message
                    : "We couldn't load this group.",
            );
        } finally {
            setGroupLoading(false);
        }
    }, [groupId]);

    // =========================================================
    // LOAD MEMBERS
    // =========================================================

    const loadGroupData = useCallback(async () => {
        if (!groupId) {
            setMembershipLoading(false);

            setMembersLoading(false);

            return;
        }

        const cached = getGroupDetailsCache(groupId);

        if (!cached) {
            setMembershipLoading(true);
            setMembersLoading(true);
        }

        setMembersError(null);

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

                setMemberCount(0);

                setMembers([]);

                return;
            }

            const { data: memberRows, error: membersError } = await supabase
                .from("community_group_members")
                .select("user_id")
                .eq("group_id", groupId);

            if (membersError) {
                throw membersError;
            }

            const rows = (memberRows ?? []) as GroupMemberRow[];

            setMemberCount(rows.length);

            setJoined(rows.some((row) => row.user_id === user.id));

            if (rows.length === 0) {
                setMembers([]);

                return;
            }

            const profileResults = await Promise.all(
                rows.map(async (row) => {
                    try {
                        const { data, error } = await supabase.rpc(
                            "get_public_player_profile",
                            {
                                p_user_id: row.user_id,
                            },
                        );

                        if (error) {
                            throw error;
                        }

                        let profile: PublicPlayerProfile | undefined;

                        if (Array.isArray(data)) {
                            profile = data[0] as
                                PublicPlayerProfile | undefined;
                        } else {
                            profile = data as PublicPlayerProfile | undefined;
                        }

                        return {
                            user_id: row.user_id,

                            full_name: profile?.full_name?.trim() || "Player",

                            avatar_url: profile?.avatar_url ?? null,
                        } satisfies GroupMember;
                    } catch (error) {
                        console.error(
                            "Failed to load group member profile:",
                            row.user_id,
                            error,
                        );

                        return {
                            user_id: row.user_id,
                            full_name: "Player",
                            avatar_url: null,
                        } satisfies GroupMember;
                    }
                }),
            );

            const sortedMembers = profileResults.sort((a, b) =>
                a.full_name.localeCompare(b.full_name),
            );

            const nextJoined = rows.some((row) => row.user_id === user.id);

            setMembers(sortedMembers);

            const previous = getGroupDetailsCache(groupId);
            groupDetailsCache[groupId] = {
                group: previous?.group ?? group,
                joined: nextJoined,
                memberCount: rows.length,
                members: sortedMembers,
                posts: previous?.posts ?? posts,
                likedPosts: previous?.likedPosts ?? likedPosts,
                games: previous?.games ?? games,
                activeTab: previous?.activeTab ?? activeTab,
            };
        } catch (error) {
            console.error("Failed to load group data:", error);

            setMembersError("Please try again.");
        } finally {
            setMembershipLoading(false);

            setMembersLoading(false);
        }
    }, [groupId]);

    // =========================================================
    // LOAD POSTS
    // =========================================================

    const loadPosts = useCallback(async () => {
        if (!groupId) {
            setPosts([]);
            setPostsLoading(false);
            return;
        }

        const cached = getGroupDetailsCache(groupId);

        if (!cached) {
            setPostsLoading(true);
        }

        setPostsError(null);

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) {
                throw userError;
            }

            if (!user) {
                throw new Error("You must be signed in to view group posts.");
            }

            const { data, error } = await supabase
                .from("community_posts")
                .select("id,user_id,content,group_id,image_url,created_at")
                .eq("group_id", groupId)
                .order("created_at", {
                    ascending: false,
                })
                .limit(50);

            if (error) {
                throw error;
            }

            const rows = (data ?? []) as CommunityPostRow[];

            if (rows.length === 0) {
                setPosts([]);

                setLikedPosts({});

                const previous = getGroupDetailsCache(groupId);
                groupDetailsCache[groupId] = {
                    group: previous?.group ?? group,
                    joined: previous?.joined ?? joined,
                    memberCount: previous?.memberCount ?? memberCount,
                    members: previous?.members ?? members,
                    posts: [],
                    likedPosts: {},
                    games: previous?.games ?? games,
                    activeTab: previous?.activeTab ?? activeTab,
                };

                return;
            }

            const postIds = rows.map((post) => post.id);

            const uniqueUserIds = [
                ...new Set(rows.map((post) => post.user_id)),
            ];

            const [profileEntries, likesResult, commentsResult] =
                await Promise.all([
                    Promise.all(
                        uniqueUserIds.map(async (userId) => {
                            const { data: profileData, error: profileError } =
                                await supabase.rpc(
                                    "get_public_player_profile",
                                    {
                                        p_user_id: userId,
                                    },
                                );

                            if (profileError) {
                                console.warn(
                                    "Could not load group post profile:",
                                    userId,
                                    profileError,
                                );

                                return [userId, null] as const;
                            }

                            const rawProfile = Array.isArray(profileData)
                                ? profileData[0]
                                : profileData;

                            return [
                                userId,
                                (rawProfile ??
                                    null) as PublicPlayerProfile | null,
                            ] as const;
                        }),
                    ),

                    supabase
                        .from("community_post_likes")
                        .select("post_id,user_id")
                        .in("post_id", postIds),

                    supabase
                        .from("community_post_comments")
                        .select("post_id")
                        .in("post_id", postIds),
                ]);

            if (likesResult.error) {
                throw likesResult.error;
            }

            if (commentsResult.error) {
                throw commentsResult.error;
            }

            const likes = (likesResult.data ?? []) as CommunityPostLikeRow[];

            const comments = (commentsResult.data ??
                []) as CommunityPostCommentRow[];

            const profilesByUserId = new Map(profileEntries);

            const likeCounts = new Map<string, number>();

            const commentCounts = new Map<string, number>();

            const nextLikedPosts: Record<string, boolean> = {};

            likes.forEach((like) => {
                const postId = String(like.post_id);

                likeCounts.set(postId, (likeCounts.get(postId) ?? 0) + 1);

                if (like.user_id === user.id) {
                    nextLikedPosts[postId] = true;
                }
            });

            comments.forEach((comment) => {
                const postId = String(comment.post_id);

                commentCounts.set(postId, (commentCounts.get(postId) ?? 0) + 1);
            });

            const mappedPosts: GroupPost[] = rows.map((post) => {
                const profile = profilesByUserId.get(post.user_id);

                const author = profile?.full_name?.trim() || "Player";

                const avatar = profile?.avatar_url?.trim() || undefined;

                return {
                    id: String(post.id),

                    userId: post.user_id,

                    author,

                    time: getPostTime(post.created_at),

                    text: post.content,

                    avatar,

                    images: post.image_url ? [post.image_url] : undefined,

                    likes: likeCounts.get(String(post.id)) ?? 0,

                    comments: commentCounts.get(String(post.id)) ?? 0,
                };
            });

            setLikedPosts(nextLikedPosts);

            setPosts(mappedPosts);

            const previous = getGroupDetailsCache(groupId);
            groupDetailsCache[groupId] = {
                group: previous?.group ?? group,
                joined: previous?.joined ?? joined,
                memberCount: previous?.memberCount ?? memberCount,
                members: previous?.members ?? members,
                posts: mappedPosts,
                likedPosts: nextLikedPosts,
                games: previous?.games ?? games,
                activeTab: previous?.activeTab ?? activeTab,
            };
        } catch (error) {
            console.error("Failed to load group posts:", error);

            setPostsError(
                error instanceof Error
                    ? error.message
                    : "We couldn't load group posts.",
            );
        } finally {
            setPostsLoading(false);
        }
    }, [groupId]);

    // =========================================================
    // LOAD GAMES
    // =========================================================

    const loadGames = useCallback(async () => {
        if (!groupId) {
            setGames([]);
            setGamesLoading(false);
            return;
        }

        const cached = getGroupDetailsCache(groupId);
        if (!cached) {
            setGamesLoading(true);
        }
        setGamesError(null);

        try {
            const { data, error } = await supabase
                .from("games")
                .select(
                    "id,title,area,starts_at,format,skill,price,spots_left,status,image_url,community_group_id",
                )
                .eq("community_group_id", groupId)
                .order("starts_at", {
                    ascending: true,
                    nullsFirst: false,
                });

            if (error) {
                throw error;
            }

            const rows = (data ?? []) as GroupGameRow[];

            const mappedGames = rows.map((game) => ({
                id: String(game.id),
                title: game.title?.trim() || "Football Game",
                area: game.area?.trim() || "Addis Ababa",
                startsAt: game.starts_at,
                format: game.format?.trim() || "Football",
                skill: game.skill?.trim() || "All levels",
                price: game.price ?? 0,
                spotsLeft: game.spots_left ?? 0,
                status: game.status?.trim() || "available",
                image: game.image_url?.trim() || undefined,
            }));

            setGames(mappedGames);

            const previous = getGroupDetailsCache(groupId);
            groupDetailsCache[groupId] = {
                group: previous?.group ?? group,
                joined: previous?.joined ?? joined,
                memberCount: previous?.memberCount ?? memberCount,
                members: previous?.members ?? members,
                posts: previous?.posts ?? posts,
                likedPosts: previous?.likedPosts ?? likedPosts,
                games: mappedGames,
                activeTab: previous?.activeTab ?? activeTab,
            };
        } catch (error) {
            console.error("Failed to load group games:", error);

            setGamesError(
                error instanceof Error
                    ? error.message
                    : "We couldn't load group games.",
            );
        } finally {
            setGamesLoading(false);
        }
    }, [groupId]);

    // =========================================================
    // REFRESH WHEN SCREEN OPENS / RETURNS
    // =========================================================

    useFocusEffect(
        useCallback(() => {
            void loadGroup();
            void loadGroupData();
            void loadPosts();
            void loadGames();
        }, [loadGroup, loadGroupData, loadPosts, loadGames]),
    );

    // =========================================================
    // JOIN / LEAVE GROUP
    // =========================================================

    async function toggleMembership() {
        if (!groupId || updatingMembership || membershipLoading) {
            return;
        }

        const wasJoined = joined;

        setUpdatingMembership(true);

        setJoined(!wasJoined);

        setMemberCount((current) => {
            const nextCount = Math.max(0, current + (wasJoined ? -1 : 1));

            if (groupId && groupDetailsCache[groupId]) {
                groupDetailsCache[groupId].joined = !wasJoined;
                groupDetailsCache[groupId].memberCount = nextCount;
            }

            return nextCount;
        });

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) {
                throw userError;
            }

            if (!user) {
                throw new Error("You must be signed in to join a group.");
            }

            if (wasJoined) {
                const { error } = await supabase
                    .from("community_group_members")
                    .delete()
                    .eq("group_id", groupId)
                    .eq("user_id", user.id);

                if (error) {
                    throw error;
                }

                setMembers((current) => {
                    const nextMembers = current.filter(
                        (member) => member.user_id !== user.id,
                    );

                    if (groupId && groupDetailsCache[groupId]) {
                        groupDetailsCache[groupId].members = nextMembers;
                    }

                    return nextMembers;
                });
            } else {
                const { error } = await supabase
                    .from("community_group_members")
                    .upsert(
                        {
                            group_id: groupId,
                            user_id: user.id,
                        },
                        {
                            onConflict: "group_id,user_id",
                        },
                    );

                if (error) {
                    throw error;
                }

                void loadGroupData();
            }
        } catch (error) {
            console.error("Failed to update group membership:", error);

            void loadGroupData();
        } finally {
            setUpdatingMembership(false);
        }
    }

    function promptJoinToParticipate(action: "post" | "like" | "comment") {
        const actionText =
            action === "post"
                ? "post in"
                : action === "like"
                  ? "like posts in"
                  : "comment in";

        Alert.alert(
            "Join group to participate",
            `Join ${group?.name ?? "this group"} to ${actionText} this community.`,
            [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Join Group",
                    onPress: joinGroup,
                },
            ],
        );
    }

    function joinGroup() {
        if (joined || membershipLoading || updatingMembership) {
            return;
        }

        void toggleMembership();
    }

    function confirmLeaveGroup() {
        if (!joined || membershipLoading || updatingMembership) {
            return;
        }

        setGroupMenuVisible(false);

        Alert.alert(
            "Leave group?",
            `You'll stop being a member of ${group?.name ?? "this group"}.`,
            [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Leave Group",
                    style: "destructive",
                    onPress: () => {
                        void toggleMembership();
                    },
                },
            ],
        );
    }

    // =========================================================
    // LIKES
    // =========================================================

    function updateLikeUI(postId: string, shouldBeLiked: boolean) {
        const currentlyLiked = !!likedPosts[postId];

        if (currentlyLiked === shouldBeLiked) {
            return;
        }

        setLikedPosts((current) => ({
            ...current,
            [postId]: shouldBeLiked,
        }));

        setPosts((current) =>
            current.map((post) =>
                post.id === postId
                    ? {
                          ...post,
                          likes: Math.max(
                              0,
                              post.likes + (shouldBeLiked ? 1 : -1),
                          ),
                      }
                    : post,
            ),
        );

        if (groupId && groupDetailsCache[groupId]) {
            const cache = groupDetailsCache[groupId];
            cache.likedPosts = {
                ...cache.likedPosts,
                [postId]: shouldBeLiked,
            };
            cache.posts = cache.posts.map((post) =>
                post.id === postId
                    ? {
                          ...post,
                          likes: Math.max(
                              0,
                              post.likes + (shouldBeLiked ? 1 : -1),
                          ),
                      }
                    : post,
            );
        }
    }

    async function saveLike(postId: string, shouldBeLiked: boolean) {
        if (likingPosts[postId]) {
            return;
        }

        setLikingPosts((current) => ({
            ...current,
            [postId]: true,
        }));

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) {
                throw userError;
            }

            if (!user) {
                throw new Error("You must be signed in to like a post.");
            }

            if (shouldBeLiked) {
                const { error } = await supabase
                    .from("community_post_likes")
                    .upsert(
                        {
                            post_id: Number(postId),

                            user_id: user.id,
                        },
                        {
                            onConflict: "post_id,user_id",
                        },
                    );

                if (error) {
                    throw error;
                }
            } else {
                const { error } = await supabase
                    .from("community_post_likes")
                    .delete()
                    .eq("post_id", Number(postId))
                    .eq("user_id", user.id);

                if (error) {
                    throw error;
                }
            }
        } catch (error) {
            console.error("Failed to save group post like:", error);

            void loadPosts();
        } finally {
            setLikingPosts((current) => ({
                ...current,
                [postId]: false,
            }));
        }
    }

    function handleLikePressIn(postId: string) {
        if (!joined) {
            return;
        }

        if (likingPosts[postId]) {
            return;
        }

        const shouldBeLiked = !likedPosts[postId];

        updateLikeUI(postId, shouldBeLiked);
    }

    function handleLikePress(postId: string) {
        if (!joined) {
            promptJoinToParticipate("like");
            return;
        }

        if (likingPosts[postId]) {
            return;
        }

        const shouldBeLiked = !!likedPosts[postId];

        void saveLike(postId, shouldBeLiked);
    }

    function openCreatePost() {
        if (!joined) {
            promptJoinToParticipate("post");
            return;
        }

        router.push({
            pathname: "/community/create-post",
            params: {
                groupId: group?.id ?? groupId,
            },
        });
    }

    function openMember(member: GroupMember) {
        router.push({
            pathname: "/player/[id]" as never,

            params: {
                id: member.user_id,
            },
        });
    }

    // =========================================================
    // GROUP NOT FOUND
    // =========================================================

    if (groupLoading) {
        return (
            <SafeAreaView style={styles.screen}>
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

                    <Text style={styles.headerTitle}>Group</Text>

                    <View style={styles.headerSpacer} />
                </View>

                <View style={styles.groupLoadingState}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (!groupLoading && !group) {
        return (
            <SafeAreaView style={styles.screen}>
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

                    <Text style={styles.headerTitle}>Group</Text>

                    <View style={styles.headerSpacer} />
                </View>

                <View style={styles.notFound}>
                    <Ionicons
                        name="people-outline"
                        size={34}
                        color={COLORS.textMuted}
                    />

                    <Text style={styles.notFoundTitle}>
                        {groupError || "Group not found"}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen} edges={["top"]}>
            {/* HEADER */}
            <View style={styles.header}>
                <Pressable
                    style={({ pressed }) => [
                        styles.backButton,
                        pressed && styles.pressed,
                    ]}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={23} color={COLORS.text} />
                </Pressable>

                <Text style={styles.headerTitle}>Group</Text>

                <Pressable
                    style={({ pressed }) => [
                        styles.moreButton,
                        pressed && styles.pressed,
                    ]}
                    onPress={() => setGroupMenuVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Group options"
                >
                    <Ionicons
                        name="ellipsis-horizontal"
                        size={22}
                        color={COLORS.text}
                    />
                </Pressable>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* COMPACT GROUP SUMMARY */}
                <View style={styles.hero}>
                    <View style={styles.groupSummaryRow}>
                        <View style={styles.groupIcon}>
                            <Ionicons
                                name="football-outline"
                                size={25}
                                color={COLORS.primary}
                            />
                        </View>

                        <View style={styles.groupSummaryContent}>
                            <Text style={styles.groupName} numberOfLines={1}>
                                {group.name}
                            </Text>

                            <Text
                                style={styles.groupDescription}
                                numberOfLines={2}
                            >
                                {group.description}
                            </Text>

                            <View style={styles.memberLine}>
                                <Ionicons
                                    name="people-outline"
                                    size={14}
                                    color={COLORS.textSecondary}
                                />

                                <Text style={styles.memberText}>
                                    {membershipLoading
                                        ? "Loading members..."
                                        : `${memberCount} ${
                                              memberCount === 1
                                                  ? "member"
                                                  : "members"
                                          }`}
                                </Text>
                            </View>
                        </View>

                        <Pressable
                            style={({ pressed }) => [
                                styles.joinButton,
                                joined && styles.joinedButton,
                                pressed && styles.pressed,
                                (membershipLoading || updatingMembership) &&
                                    styles.disabledButton,
                            ]}
                            disabled={
                                membershipLoading ||
                                updatingMembership ||
                                joined
                            }
                            onPress={joinGroup}
                        >
                            {updatingMembership ? (
                                <ActivityIndicator
                                    size="small"
                                    color={
                                        joined ? COLORS.primary : COLORS.white
                                    }
                                />
                            ) : joined ? (
                                <Ionicons
                                    name="checkmark"
                                    size={15}
                                    color={COLORS.primary}
                                />
                            ) : null}

                            <Text
                                style={[
                                    styles.joinButtonText,
                                    joined && styles.joinedButtonText,
                                ]}
                            >
                                {membershipLoading
                                    ? "..."
                                    : joined
                                      ? "Joined"
                                      : "Join"}
                            </Text>
                        </Pressable>
                    </View>
                </View>

                {/* TABS */}
                <View style={styles.tabs}>
                    <Pressable
                        style={styles.tab}
                        onPress={() =>
                            (() => {
                                setActiveTab("posts");
                                if (groupId && groupDetailsCache[groupId]) {
                                    groupDetailsCache[groupId].activeTab =
                                        "posts";
                                }
                            })()
                        }
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === "posts" && styles.tabTextActive,
                            ]}
                        >
                            Posts
                        </Text>

                        {activeTab === "posts" && (
                            <View style={styles.tabIndicator} />
                        )}
                    </Pressable>

                    <Pressable
                        style={styles.tab}
                        onPress={() =>
                            (() => {
                                setActiveTab("games");
                                if (groupId && groupDetailsCache[groupId]) {
                                    groupDetailsCache[groupId].activeTab =
                                        "games";
                                }
                            })()
                        }
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === "games" && styles.tabTextActive,
                            ]}
                        >
                            Games
                        </Text>

                        {activeTab === "games" && (
                            <View style={styles.tabIndicator} />
                        )}
                    </Pressable>

                    <Pressable
                        style={styles.tab}
                        onPress={() =>
                            (() => {
                                setActiveTab("members");
                                if (groupId && groupDetailsCache[groupId]) {
                                    groupDetailsCache[groupId].activeTab =
                                        "members";
                                }
                            })()
                        }
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === "members" && styles.tabTextActive,
                            ]}
                        >
                            Members
                        </Text>

                        {activeTab === "members" && (
                            <View style={styles.tabIndicator} />
                        )}
                    </Pressable>
                </View>

                {/* =====================================================
                    POSTS
                ====================================================== */}

                {activeTab === "posts" && (
                    <View style={styles.postsSection}>
                        {postsLoading ? (
                            <View style={styles.postsStatus}>
                                <ActivityIndicator
                                    size="small"
                                    color={COLORS.primary}
                                />

                                <Text style={styles.postsStatusTitle}>
                                    Loading posts...
                                </Text>

                                <Text style={styles.postsStatusText}>
                                    Getting the latest from {group.name}.
                                </Text>
                            </View>
                        ) : postsError ? (
                            <View style={styles.postsStatus}>
                                <Ionicons
                                    name="alert-circle-outline"
                                    size={27}
                                    color={COLORS.danger}
                                />

                                <Text style={styles.postsStatusTitle}>
                                    Couldn't load posts
                                </Text>

                                <Text style={styles.postsStatusText}>
                                    {postsError}
                                </Text>

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.retryButton,
                                        pressed && styles.pressed,
                                    ]}
                                    onPress={() => {
                                        void loadPosts();
                                    }}
                                >
                                    <Text style={styles.retryButtonText}>
                                        Try again
                                    </Text>
                                </Pressable>
                            </View>
                        ) : posts.length === 0 ? (
                            <View style={styles.emptyState}>
                                <View style={styles.emptyIcon}>
                                    <Ionicons
                                        name="chatbubbles-outline"
                                        size={28}
                                        color={COLORS.primary}
                                    />
                                </View>

                                <Text style={styles.emptyTitle}>
                                    No posts yet
                                </Text>

                                <Text style={styles.emptyText}>
                                    {joined
                                        ? `Be the first player to post in ${group.name}.`
                                        : `Join ${group.name} to create the first post.`}
                                </Text>

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.createPostButton,
                                        pressed && styles.pressed,
                                    ]}
                                    onPress={openCreatePost}
                                >
                                    <Ionicons
                                        name="add"
                                        size={18}
                                        color={COLORS.white}
                                    />

                                    <Text style={styles.createPostText}>
                                        {joined
                                            ? "Create Post"
                                            : "Join to Post"}
                                    </Text>
                                </Pressable>
                            </View>
                        ) : (
                            <>
                                <View style={styles.postsHeading}>
                                    <Text style={styles.postsHeadingTitle}>
                                        Latest Posts
                                    </Text>

                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.smallCreatePostButton,
                                            pressed && styles.pressed,
                                        ]}
                                        onPress={openCreatePost}
                                    >
                                        <Ionicons
                                            name="add"
                                            size={16}
                                            color={COLORS.primary}
                                        />

                                        <Text
                                            style={styles.smallCreatePostText}
                                        >
                                            {joined ? "Post" : "Join to Post"}
                                        </Text>
                                    </Pressable>
                                </View>

                                {posts.map((post) => {
                                    const liked = !!likedPosts[post.id];

                                    return (
                                        <View
                                            key={post.id}
                                            style={styles.postCard}
                                        >
                                            <View style={styles.postHeader}>
                                                {post.avatar ? (
                                                    <Image
                                                        source={{
                                                            uri: post.avatar,
                                                        }}
                                                        style={
                                                            styles.postAvatar
                                                        }
                                                    />
                                                ) : (
                                                    <View
                                                        style={
                                                            styles.postAvatarFallback
                                                        }
                                                    >
                                                        <Ionicons
                                                            name="person"
                                                            size={20}
                                                            color={
                                                                COLORS.primary
                                                            }
                                                        />
                                                    </View>
                                                )}

                                                <View
                                                    style={
                                                        styles.postAuthorText
                                                    }
                                                >
                                                    <Text
                                                        style={
                                                            styles.postAuthorName
                                                        }
                                                    >
                                                        {post.author}
                                                    </Text>

                                                    <Text
                                                        style={styles.postMeta}
                                                    >
                                                        {group.name} ·{" "}
                                                        {post.time}
                                                    </Text>
                                                </View>

                                                <Pressable
                                                    style={({ pressed }) => [
                                                        styles.postMoreButton,
                                                        pressed &&
                                                            styles.pressed,
                                                    ]}
                                                >
                                                    <Ionicons
                                                        name="ellipsis-horizontal"
                                                        size={20}
                                                        color={
                                                            COLORS.textSecondary
                                                        }
                                                    />
                                                </Pressable>
                                            </View>

                                            <Text style={styles.postText}>
                                                {post.text}
                                            </Text>

                                            {!!post.images?.length && (
                                                <View
                                                    style={[
                                                        styles.postImages,
                                                        post.images.length ===
                                                            1 &&
                                                            styles.postImagesSingle,
                                                    ]}
                                                >
                                                    {post.images
                                                        .slice(0, 2)
                                                        .map((image, index) => (
                                                            <Image
                                                                key={`${post.id}-${index}`}
                                                                source={{
                                                                    uri: image,
                                                                }}
                                                                style={[
                                                                    styles.postImage,
                                                                    post.images
                                                                        ?.length ===
                                                                        1 &&
                                                                        styles.postImageSingle,
                                                                ]}
                                                            />
                                                        ))}
                                                </View>
                                            )}

                                            <View style={styles.postActions}>
                                                {/* LIKE */}
                                                <Pressable
                                                    style={({ pressed }) => [
                                                        styles.actionButton,
                                                        pressed &&
                                                            styles.pressed,
                                                    ]}
                                                    onPressIn={() =>
                                                        handleLikePressIn(
                                                            post.id,
                                                        )
                                                    }
                                                    onPress={() =>
                                                        handleLikePress(post.id)
                                                    }
                                                >
                                                    <Ionicons
                                                        name={
                                                            liked
                                                                ? "heart"
                                                                : "heart-outline"
                                                        }
                                                        size={20}
                                                        color={
                                                            liked
                                                                ? COLORS.danger
                                                                : COLORS.textSecondary
                                                        }
                                                    />

                                                    <Text
                                                        style={[
                                                            styles.actionText,
                                                            liked &&
                                                                styles.likedActionText,
                                                        ]}
                                                    >
                                                        {post.likes}
                                                    </Text>
                                                </Pressable>

                                                {/* COMMENTS */}
                                                <Pressable
                                                    style={({ pressed }) => [
                                                        styles.actionButton,
                                                        pressed &&
                                                            styles.pressed,
                                                    ]}
                                                    onPress={() =>
                                                        router.push({
                                                            pathname:
                                                                "/community/post/[id]",

                                                            params: {
                                                                id: post.id,
                                                            },
                                                        })
                                                    }
                                                >
                                                    <Ionicons
                                                        name="chatbubble-outline"
                                                        size={19}
                                                        color={
                                                            COLORS.textSecondary
                                                        }
                                                    />

                                                    <Text
                                                        style={
                                                            styles.actionText
                                                        }
                                                    >
                                                        {post.comments}
                                                    </Text>
                                                </Pressable>
                                            </View>
                                        </View>
                                    );
                                })}
                            </>
                        )}
                    </View>
                )}

                {/* =====================================================
                    GAMES
                ====================================================== */}

                {activeTab === "games" && (
                    <View style={styles.gamesSection}>
                        {gamesLoading ? (
                            <View style={styles.gamesStatus}>
                                <ActivityIndicator
                                    size="small"
                                    color={COLORS.primary}
                                />

                                <Text style={styles.gamesStatusTitle}>
                                    Loading games...
                                </Text>
                            </View>
                        ) : gamesError ? (
                            <View style={styles.gamesStatus}>
                                <Ionicons
                                    name="alert-circle-outline"
                                    size={27}
                                    color={COLORS.danger}
                                />

                                <Text style={styles.gamesStatusTitle}>
                                    Couldn't load games
                                </Text>

                                <Text style={styles.gamesStatusText}>
                                    {gamesError}
                                </Text>

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.retryButton,
                                        pressed && styles.pressed,
                                    ]}
                                    onPress={() => {
                                        void loadGames();
                                    }}
                                >
                                    <Text style={styles.retryButtonText}>
                                        Try again
                                    </Text>
                                </Pressable>
                            </View>
                        ) : games.length === 0 ? (
                            <View style={styles.emptyState}>
                                <View style={styles.emptyIcon}>
                                    <Ionicons
                                        name="football-outline"
                                        size={28}
                                        color={COLORS.primary}
                                    />
                                </View>

                                <Text style={styles.emptyTitle}>
                                    No games yet
                                </Text>

                                <Text style={styles.emptyText}>
                                    Games connected to {group.name} will appear
                                    here.
                                </Text>
                            </View>
                        ) : (
                            <>
                                <View style={styles.gamesHeading}>
                                    <Text style={styles.gamesHeadingTitle}>
                                        Group Games
                                    </Text>

                                    <Text style={styles.gamesCount}>
                                        {games.length}
                                    </Text>
                                </View>

                                <View style={styles.gamesList}>
                                    {games.map((game) => (
                                        <Pressable
                                            key={game.id}
                                            style={({ pressed }) => [
                                                styles.gameCard,
                                                pressed && styles.pressed,
                                            ]}
                                            onPress={() =>
                                                router.push(`/game/${game.id}`)
                                            }
                                            accessibilityRole="button"
                                            accessibilityLabel={`Open ${game.title}`}
                                        >
                                            {game.image ? (
                                                <Image
                                                    source={{
                                                        uri: game.image,
                                                    }}
                                                    style={styles.gameImage}
                                                />
                                            ) : (
                                                <View
                                                    style={
                                                        styles.gameImageFallback
                                                    }
                                                >
                                                    <Ionicons
                                                        name="football-outline"
                                                        size={28}
                                                        color={COLORS.primary}
                                                    />
                                                </View>
                                            )}

                                            <View style={styles.gameContent}>
                                                <View
                                                    style={styles.gameTitleRow}
                                                >
                                                    <Text
                                                        style={styles.gameTitle}
                                                        numberOfLines={1}
                                                    >
                                                        {game.title}
                                                    </Text>

                                                    <Text
                                                        style={styles.gamePrice}
                                                    >
                                                        {getGamePrice(
                                                            game.price,
                                                        )}
                                                    </Text>
                                                </View>

                                                <View
                                                    style={styles.gameMetaRow}
                                                >
                                                    <Ionicons
                                                        name="location-outline"
                                                        size={14}
                                                        color={
                                                            COLORS.textSecondary
                                                        }
                                                    />

                                                    <Text
                                                        style={
                                                            styles.gameMetaText
                                                        }
                                                        numberOfLines={1}
                                                    >
                                                        {game.area}
                                                    </Text>
                                                </View>

                                                <View
                                                    style={styles.gameMetaRow}
                                                >
                                                    <Ionicons
                                                        name="calendar-outline"
                                                        size={14}
                                                        color={
                                                            COLORS.textSecondary
                                                        }
                                                    />

                                                    <Text
                                                        style={
                                                            styles.gameMetaText
                                                        }
                                                        numberOfLines={1}
                                                    >
                                                        {getGameDateTime(
                                                            game.startsAt,
                                                        )}
                                                    </Text>
                                                </View>

                                                <View style={styles.gameTags}>
                                                    <View
                                                        style={styles.gameTag}
                                                    >
                                                        <Text
                                                            style={
                                                                styles.gameTagText
                                                            }
                                                        >
                                                            {game.format}
                                                        </Text>
                                                    </View>

                                                    <View
                                                        style={styles.gameTag}
                                                    >
                                                        <Text
                                                            style={
                                                                styles.gameTagText
                                                            }
                                                        >
                                                            {game.skill}
                                                        </Text>
                                                    </View>

                                                    <View
                                                        style={styles.spotsTag}
                                                    >
                                                        <Text
                                                            style={
                                                                styles.spotsTagText
                                                            }
                                                        >
                                                            {game.spotsLeft > 0
                                                                ? `${game.spotsLeft} spots`
                                                                : "Full"}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </Pressable>
                                    ))}
                                </View>
                            </>
                        )}
                    </View>
                )}

                {/* =====================================================
                    MEMBERS
                ====================================================== */}

                {activeTab === "members" && (
                    <View style={styles.membersSection}>
                        {membersLoading ? (
                            <View style={styles.membersLoading}>
                                <ActivityIndicator
                                    size="small"
                                    color={COLORS.primary}
                                />

                                <Text style={styles.membersLoadingText}>
                                    Loading members...
                                </Text>
                            </View>
                        ) : membersError ? (
                            <View style={styles.membersLoading}>
                                <Ionicons
                                    name="alert-circle-outline"
                                    size={27}
                                    color={COLORS.danger}
                                />

                                <Text style={styles.postsStatusTitle}>
                                    Couldn't load members
                                </Text>

                                <Text style={styles.postsStatusText}>
                                    {membersError}
                                </Text>

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.retryButton,
                                        pressed && styles.pressed,
                                    ]}
                                    onPress={() => {
                                        void loadGroupData();
                                    }}
                                >
                                    <Text style={styles.retryButtonText}>
                                        Try again
                                    </Text>
                                </Pressable>
                            </View>
                        ) : members.length === 0 ? (
                            <View style={styles.emptyState}>
                                <View style={styles.emptyIcon}>
                                    <Ionicons
                                        name="people-outline"
                                        size={28}
                                        color={COLORS.primary}
                                    />
                                </View>

                                <Text style={styles.emptyTitle}>
                                    No members yet
                                </Text>

                                <Text style={styles.emptyText}>
                                    Players who join {group.name} will appear
                                    here.
                                </Text>
                            </View>
                        ) : (
                            <>
                                <View style={styles.membersHeader}>
                                    <Text style={styles.membersTitle}>
                                        Members
                                    </Text>

                                    <Text style={styles.membersCount}>
                                        {members.length}
                                    </Text>
                                </View>

                                <View style={styles.membersList}>
                                    {members.map((member, index) => (
                                        <Pressable
                                            key={member.user_id}
                                            style={({ pressed }) => [
                                                styles.memberRow,
                                                index < members.length - 1 &&
                                                    styles.memberRowBorder,
                                                pressed &&
                                                    styles.memberRowPressed,
                                            ]}
                                            onPress={() => openMember(member)}
                                        >
                                            {member.avatar_url ? (
                                                <Image
                                                    source={{
                                                        uri: member.avatar_url,
                                                    }}
                                                    style={styles.memberAvatar}
                                                />
                                            ) : (
                                                <View
                                                    style={
                                                        styles.memberAvatarFallback
                                                    }
                                                >
                                                    <Text
                                                        style={
                                                            styles.memberInitials
                                                        }
                                                    >
                                                        {getInitials(
                                                            member.full_name,
                                                        )}
                                                    </Text>
                                                </View>
                                            )}

                                            <View style={styles.memberInfo}>
                                                <Text
                                                    style={styles.memberName}
                                                    numberOfLines={1}
                                                >
                                                    {member.full_name}
                                                </Text>

                                                <Text
                                                    style={
                                                        styles.memberSubtitle
                                                    }
                                                >
                                                    Addis Football player
                                                </Text>
                                            </View>

                                            <Ionicons
                                                name="chevron-forward"
                                                size={18}
                                                color={COLORS.textMuted}
                                            />
                                        </Pressable>
                                    ))}
                                </View>
                            </>
                        )}
                    </View>
                )}
            </ScrollView>

            <Modal
                visible={groupMenuVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setGroupMenuVisible(false)}
            >
                <Pressable
                    style={styles.menuBackdrop}
                    onPress={() => setGroupMenuVisible(false)}
                >
                    <Pressable
                        style={styles.groupMenuSheet}
                        onPress={(event) => event.stopPropagation()}
                    >
                        <View style={styles.groupMenuHandle} />

                        <Text style={styles.groupMenuTitle}>Group options</Text>

                        <Pressable
                            style={({ pressed }) => [
                                styles.groupMenuItem,
                                pressed && styles.groupMenuItemPressed,
                            ]}
                            onPress={() => {
                                setGroupMenuVisible(false);
                                setActiveTab("games");

                                if (groupId && groupDetailsCache[groupId]) {
                                    groupDetailsCache[groupId].activeTab =
                                        "games";
                                }
                            }}
                        >
                            <View style={styles.groupMenuIcon}>
                                <Ionicons
                                    name="football-outline"
                                    size={20}
                                    color={COLORS.text}
                                />
                            </View>

                            <Text style={styles.groupMenuItemText}>
                                View games
                            </Text>
                        </Pressable>

                        <Pressable
                            style={({ pressed }) => [
                                styles.groupMenuItem,
                                pressed && styles.groupMenuItemPressed,
                            ]}
                            onPress={() => {
                                setGroupMenuVisible(false);
                                setActiveTab("members");

                                if (groupId && groupDetailsCache[groupId]) {
                                    groupDetailsCache[groupId].activeTab =
                                        "members";
                                }
                            }}
                        >
                            <View style={styles.groupMenuIcon}>
                                <Ionicons
                                    name="people-outline"
                                    size={20}
                                    color={COLORS.text}
                                />
                            </View>

                            <Text style={styles.groupMenuItemText}>
                                View members
                            </Text>
                        </Pressable>

                        {joined && (
                            <Pressable
                                style={({ pressed }) => [
                                    styles.groupMenuItem,
                                    pressed && styles.groupMenuItemPressed,
                                ]}
                                onPress={confirmLeaveGroup}
                            >
                                <View style={styles.groupMenuDangerIcon}>
                                    <Ionicons
                                        name="exit-outline"
                                        size={20}
                                        color="#D92D20"
                                    />
                                </View>

                                <Text style={styles.groupMenuDangerText}>
                                    Leave group
                                </Text>
                            </Pressable>
                        )}

                        <Pressable
                            style={({ pressed }) => [
                                styles.groupMenuCancel,
                                pressed && styles.groupMenuItemPressed,
                            ]}
                            onPress={() => setGroupMenuVisible(false)}
                        >
                            <Text style={styles.groupMenuCancelText}>
                                Cancel
                            </Text>
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

    pressed: {
        opacity: 0.65,
    },

    disabledButton: {
        opacity: 0.65,
    },

    header: {
        height: 58,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: COLORS.background,
    },

    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },

    moreButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },

    headerSpacer: {
        width: 40,
    },

    headerTitle: {
        color: COLORS.text,
        fontSize: 17,
        fontWeight: "900",
    },

    scrollContent: {
        paddingBottom: 30,
    },

    hero: {
        backgroundColor: COLORS.surface,
        paddingHorizontal: 16,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    groupSummaryRow: {
        flexDirection: "row",
        alignItems: "center",
    },

    groupSummaryContent: {
        flex: 1,
        minWidth: 0,
        marginLeft: 12,
        marginRight: 10,
    },

    groupIcon: {
        width: 54,
        height: 54,
        borderRadius: 17,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
    },

    groupName: {
        color: COLORS.text,
        fontSize: 18,
        lineHeight: 22,
        fontWeight: "900",
        letterSpacing: -0.3,
    },

    groupDescription: {
        color: COLORS.textSecondary,
        fontSize: 12,
        lineHeight: 16,
        fontWeight: "500",
        marginTop: 3,
    },

    memberLine: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 6,
    },

    memberText: {
        color: COLORS.textSecondary,
        fontSize: 11,
        fontWeight: "700",
    },

    joinButton: {
        minWidth: 70,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.primary,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        paddingHorizontal: 13,
    },

    joinedButton: {
        backgroundColor: COLORS.primarySoft,
        borderWidth: 1,
        borderColor: "#BDE8D8",
    },

    joinButtonText: {
        color: COLORS.white,
        fontSize: 12,
        fontWeight: "900",
    },

    joinedButtonText: {
        color: COLORS.primary,
    },

    tabs: {
        height: 49,
        flexDirection: "row",
        backgroundColor: COLORS.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },

    tab: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
    },

    tabText: {
        color: COLORS.textSecondary,
        fontSize: 13,
        fontWeight: "700",
    },

    tabTextActive: {
        color: COLORS.primary,
        fontWeight: "900",
    },

    tabIndicator: {
        position: "absolute",
        bottom: 0,
        left: 50,
        right: 50,
        height: 2,
        borderRadius: 2,
        backgroundColor: COLORS.primary,
    },

    // =====================================================
    // POSTS
    // =====================================================

    postsSection: {
        backgroundColor: COLORS.background,
    },

    postsHeading: {
        minHeight: 54,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    postsHeadingTitle: {
        color: COLORS.text,
        fontSize: 15,
        fontWeight: "900",
    },

    smallCreatePostButton: {
        height: 34,
        paddingHorizontal: 12,
        borderRadius: 17,
        backgroundColor: COLORS.primarySoft,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
    },

    smallCreatePostText: {
        color: COLORS.primary,
        fontSize: 12,
        fontWeight: "900",
    },

    postsStatus: {
        minHeight: 260,
        paddingHorizontal: 28,
        paddingVertical: 40,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.surface,
    },

    postsStatusTitle: {
        color: COLORS.text,
        fontSize: 16,
        lineHeight: 21,
        fontWeight: "900",
        textAlign: "center",
        marginTop: 10,
    },

    postsStatusText: {
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

    postCard: {
        backgroundColor: COLORS.surface,
        paddingTop: 15,
        paddingHorizontal: 16,
        marginBottom: 9,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
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

    postAvatarFallback: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
    },

    postAuthorText: {
        flex: 1,
        marginLeft: 10,
    },

    postAuthorName: {
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

    postMoreButton: {
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
    },

    postText: {
        color: COLORS.text,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: "500",
        marginTop: 11,
        marginBottom: 11,
    },

    postImages: {
        width: "100%",
        height: 180,
        flexDirection: "row",
        gap: 3,
        overflow: "hidden",
        borderRadius: 12,
        backgroundColor: COLORS.surfaceAlt,
    },

    postImagesSingle: {
        height: 210,
    },

    postImage: {
        flex: 1,
        height: "100%",
    },

    postImageSingle: {
        width: "100%",
    },

    postActions: {
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#EDF1EF",
        marginTop: 11,
    },

    actionButton: {
        minWidth: 58,
        height: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },

    actionText: {
        color: COLORS.textSecondary,
        fontSize: 12,
        lineHeight: 16,
        fontWeight: "700",
    },

    likedActionText: {
        color: COLORS.danger,
    },

    // =====================================================
    // EMPTY STATE
    // =====================================================

    emptyState: {
        minHeight: 300,
        paddingHorizontal: 30,
        alignItems: "center",
        justifyContent: "center",
    },

    emptyIcon: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
    },

    emptyTitle: {
        color: COLORS.text,
        fontSize: 17,
        lineHeight: 22,
        fontWeight: "900",
        marginTop: 13,
    },

    emptyText: {
        maxWidth: 280,
        color: COLORS.textSecondary,
        fontSize: 12,
        lineHeight: 18,
        fontWeight: "500",
        textAlign: "center",
        marginTop: 5,
    },

    createPostButton: {
        height: 42,
        borderRadius: 21,
        backgroundColor: COLORS.primary,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        paddingHorizontal: 18,
        marginTop: 17,
    },

    createPostText: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: "900",
    },

    // =====================================================
    // GAMES
    // =====================================================

    gamesSection: {
        backgroundColor: COLORS.background,
    },

    gamesHeading: {
        minHeight: 54,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
    },

    gamesHeadingTitle: {
        color: COLORS.text,
        fontSize: 15,
        fontWeight: "900",
    },

    gamesCount: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        paddingHorizontal: 6,
        backgroundColor: COLORS.primarySoft,
        color: COLORS.primary,
        fontSize: 11,
        fontWeight: "900",
        textAlign: "center",
        lineHeight: 22,
    },

    gamesStatus: {
        minHeight: 260,
        paddingHorizontal: 28,
        paddingVertical: 40,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.surface,
    },

    gamesStatusTitle: {
        color: COLORS.text,
        fontSize: 16,
        lineHeight: 21,
        fontWeight: "900",
        textAlign: "center",
        marginTop: 10,
    },

    gamesStatusText: {
        maxWidth: 300,
        color: COLORS.textSecondary,
        fontSize: 12,
        lineHeight: 18,
        textAlign: "center",
        marginTop: 6,
    },

    gamesList: {
        paddingHorizontal: 14,
        paddingBottom: 18,
        gap: 10,
    },

    gameCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: "hidden",
        flexDirection: "row",
    },

    gameImage: {
        width: 96,
        minHeight: 132,
        backgroundColor: COLORS.surfaceAlt,
    },

    gameImageFallback: {
        width: 96,
        minHeight: 132,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
    },

    gameContent: {
        flex: 1,
        minWidth: 0,
        padding: 12,
    },

    gameTitleRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
    },

    gameTitle: {
        flex: 1,
        minWidth: 0,
        color: COLORS.text,
        fontSize: 14,
        lineHeight: 18,
        fontWeight: "900",
    },

    gamePrice: {
        color: COLORS.primary,
        fontSize: 12,
        lineHeight: 18,
        fontWeight: "900",
    },

    gameMetaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        marginTop: 7,
    },

    gameMetaText: {
        flex: 1,
        minWidth: 0,
        color: COLORS.textSecondary,
        fontSize: 11,
        lineHeight: 15,
        fontWeight: "600",
    },

    gameTags: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 5,
        marginTop: 9,
    },

    gameTag: {
        minHeight: 23,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: COLORS.surfaceAlt,
        alignItems: "center",
        justifyContent: "center",
    },

    gameTagText: {
        color: COLORS.textSecondary,
        fontSize: 10,
        fontWeight: "700",
    },

    spotsTag: {
        minHeight: 23,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
    },

    spotsTagText: {
        color: COLORS.primary,
        fontSize: 10,
        fontWeight: "900",
    },

    // =====================================================
    // MEMBERS
    // =====================================================

    membersSection: {
        paddingBottom: 20,
    },

    membersLoading: {
        minHeight: 220,
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
    },

    membersLoadingText: {
        color: COLORS.textSecondary,
        fontSize: 12,
        fontWeight: "600",
    },

    membersHeader: {
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
    },

    membersTitle: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: "900",
    },

    membersCount: {
        minWidth: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLORS.primarySoft,
        color: COLORS.primary,
        fontSize: 11,
        fontWeight: "900",
        textAlign: "center",
        lineHeight: 24,
        paddingHorizontal: 6,
    },

    membersList: {
        marginHorizontal: 14,
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: "hidden",
    },

    memberRow: {
        minHeight: 72,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
    },

    memberRowBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },

    memberRowPressed: {
        backgroundColor: COLORS.surfaceAlt,
    },

    memberAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: COLORS.surfaceAlt,
    },

    memberAvatarFallback: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
    },

    memberInitials: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: "900",
    },

    memberInfo: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
    },

    memberName: {
        color: COLORS.text,
        fontSize: 14,
        lineHeight: 19,
        fontWeight: "800",
    },

    memberSubtitle: {
        color: COLORS.textSecondary,
        fontSize: 11,
        lineHeight: 16,
        fontWeight: "500",
        marginTop: 2,
    },

    // =====================================================
    // NOT FOUND
    // =====================================================

    menuBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.28)",
        justifyContent: "flex-end",
    },

    groupMenuSheet: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 26,
    },

    groupMenuHandle: {
        width: 38,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.border,
        alignSelf: "center",
        marginBottom: 16,
    },

    groupMenuTitle: {
        color: COLORS.text,
        fontSize: 17,
        fontWeight: "900",
        marginBottom: 10,
    },

    groupMenuItem: {
        minHeight: 54,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 14,
        paddingHorizontal: 10,
    },

    groupMenuItemPressed: {
        backgroundColor: COLORS.surfaceAlt,
    },

    groupMenuIcon: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: COLORS.surfaceAlt,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 11,
    },

    groupMenuDangerIcon: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: "#FEF3F2",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 11,
    },

    groupMenuItemText: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: "800",
    },

    groupMenuDangerText: {
        color: "#D92D20",
        fontSize: 14,
        fontWeight: "800",
    },

    groupMenuCancel: {
        minHeight: 50,
        marginTop: 8,
        borderRadius: 14,
        backgroundColor: COLORS.surfaceAlt,
        alignItems: "center",
        justifyContent: "center",
    },

    groupMenuCancelText: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: "800",
    },

    groupLoadingState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    notFound: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    notFoundTitle: {
        color: COLORS.text,
        fontSize: 17,
        fontWeight: "900",
        marginTop: 10,
    },
});
