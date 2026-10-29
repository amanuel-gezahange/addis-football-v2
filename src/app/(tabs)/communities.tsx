import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../constants/colors";
import { supabase } from "../../lib/supabase";

type CommunitySection = "posts" | "groups";

type Post = {
    id: string;
    userId: string;
    groupId: string | null;
    author: string;
    time: string;
    text: string;
    avatar?: string;
    images?: string[];
    likes: number;
    comments: number;
};

type CommunityPostRow = {
    id: number;
    user_id: string;
    content: string;
    group_id: string | null;
    image_url: string | null;
    created_at: string;
};

type CommunityPostLikeRow = {
    post_id: number;
    user_id: string;
};

type CommunityPostCommentRow = {
    post_id: number;
};

type CommunityCommentRow = {
    id: number;
    post_id: number;
    user_id: string;
    content: string;
    created_at: string;
};

type InlineComment = {
    id: string;
    userId: string;
    author: string;
    avatar?: string;
    text: string;
    time: string;
    createdAt: string;
};

type CommunityGroupSummaryRow = {
    group_id: string;
    member_count: number;
    joined: boolean;
};

type PublicPlayerProfile = {
    user_id?: string;
    id?: string;
    full_name?: string | null;
    avatar_url?: string | null;
};

type FootballGroup = {
    id: string;
    name: string;
    description: string;
    created_at: string;
};

type GroupMemberRow = {
    group_id: string;
    user_id: string;
    created_at: string;
};

type GroupPreview = {
    memberAvatars: string[];
    latestActivity?: {
        author: string;
        avatar?: string;
        text: string;
        time: string;
    };
};

let communityPostsCache: Post[] | null = null;
let communityLikedPostsCache: Record<string, boolean> = {};
let communityGroupsCache: FootballGroup[] | null = null;
let communityGroupPreviewsCache: Record<string, GroupPreview> = {};

let communityGroupMemberCountsCache: Record<string, number> | null = null;
let communityGroupJoinedCache: Record<string, boolean> | null = null;
let communityCommentsCache: Record<string, InlineComment[]> = {};
let communityActiveSectionCache: CommunitySection = "posts";
let communityCurrentUserIdCache: string | null = null;
let communityCurrentUserProfileCache: {
    full_name: string | null;
    avatar_url: string | null;
} | null = null;
let communityPublicProfilesCache: Record<
    string,
    {
        full_name: string | null;
        avatar_url: string | null;
    }
> = {};

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

export default function CommunitiesScreen() {
    const [activeSection, setActiveSection] = useState<CommunitySection>(
        () => communityActiveSectionCache,
    );

    const [groups, setGroups] = useState<FootballGroup[]>(
        () => communityGroupsCache ?? [],
    );

    const [groupPreviews, setGroupPreviews] = useState<
        Record<string, GroupPreview>
    >(() => communityGroupPreviewsCache);

    const [posts, setPosts] = useState<Post[]>(() => communityPostsCache ?? []);
    const [currentUserProfile, setCurrentUserProfile] = useState<{
        full_name: string | null;
        avatar_url: string | null;
    } | null>(() => communityCurrentUserProfileCache);
    const profileCacheRef = useRef<
        Record<
            string,
            {
                full_name: string | null;
                avatar_url: string | null;
            }
        >
    >(communityPublicProfilesCache);

    const scrollViewRef = useRef<ScrollView>(null);
    const commentInputRefs = useRef<Record<string, TextInput | null>>({});

    const [postsLoading, setPostsLoading] = useState(
        communityPostsCache === null,
    );

    const postsLoadedRef = useRef(communityPostsCache !== null);

    const [postsError, setPostsError] = useState<string | null>(null);

    const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>(
        () => communityLikedPostsCache,
    );

    const [likingPosts, setLikingPosts] = useState<Record<string, boolean>>({});

    const [expandedComments, setExpandedComments] = useState<
        Record<string, boolean>
    >({});
    const [commentsByPost, setCommentsByPost] = useState<
        Record<string, InlineComment[]>
    >(() => ({ ...communityCommentsCache }));
    const [commentsLoading, setCommentsLoading] = useState<
        Record<string, boolean>
    >({});
    const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
        {},
    );
    const [postingComments, setPostingComments] = useState<
        Record<string, boolean>
    >({});
    const [visibleCommentCounts, setVisibleCommentCounts] = useState<
        Record<string, number>
    >({});
    const [currentUserId, setCurrentUserId] = useState<string | null>(
        () => communityCurrentUserIdCache,
    );
    const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
    const [editingPost, setEditingPost] = useState<Post | null>(null);
    const [editingPostText, setEditingPostText] = useState("");
    const [editingPostImage, setEditingPostImage] =
        useState<ImagePicker.ImagePickerAsset | null>(null);
    const [removeEditingPostImage, setRemoveEditingPostImage] = useState(false);
    const [savingPostEdit, setSavingPostEdit] = useState(false);
    const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
    const [commentMenuId, setCommentMenuId] = useState<string | null>(null);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(
        null,
    );
    const [editingCommentText, setEditingCommentText] = useState("");
    const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
    const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
        null,
    );

    const [groupMemberCounts, setGroupMemberCounts] = useState<
        Record<string, number>
    >(() => communityGroupMemberCountsCache ?? {});
    const [groupJoined, setGroupJoined] = useState<Record<string, boolean>>(
        () => communityGroupJoinedCache ?? {},
    );
    const [joiningGroups, setJoiningGroups] = useState<Record<string, boolean>>(
        {},
    );
    const [groupSearch, setGroupSearch] = useState("");
    const [groupsLoading, setGroupsLoading] = useState(
        communityGroupsCache === null,
    );
    const [groupsError, setGroupsError] = useState<string | null>(null);

    const loadPosts = useCallback(async (showLoading = false) => {
        if (showLoading) {
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
                throw new Error(
                    "You must be signed in to view community posts.",
                );
            }

            communityCurrentUserIdCache = user.id;
            setCurrentUserId(user.id);

            const { data: currentProfileData, error: currentProfileError } =
                await supabase.rpc("get_public_player_profile", {
                    p_user_id: user.id,
                });

            if (!currentProfileError) {
                const rawCurrentProfile = Array.isArray(currentProfileData)
                    ? currentProfileData[0]
                    : currentProfileData;

                if (rawCurrentProfile) {
                    const nextCurrentProfile = {
                        full_name: rawCurrentProfile.full_name ?? null,
                        avatar_url: rawCurrentProfile.avatar_url ?? null,
                    };

                    communityCurrentUserProfileCache = nextCurrentProfile;
                    communityPublicProfilesCache[user.id] = nextCurrentProfile;
                    setCurrentUserProfile(nextCurrentProfile);
                }
            }

            const { data, error } = await supabase
                .from("community_posts")
                .select("id,user_id,content,group_id,image_url,created_at")
                .order("created_at", {
                    ascending: false,
                })
                .limit(50);

            if (error) {
                throw error;
            }

            const rows = (data ?? []) as CommunityPostRow[];

            if (rows.length === 0) {
                communityPostsCache = [];
                communityLikedPostsCache = {};

                setPosts([]);
                setLikedPosts({});

                postsLoadedRef.current = true;
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
                            // Use cached profile first.
                            const cachedProfile =
                                profileCacheRef.current[userId];

                            if (cachedProfile) {
                                return [userId, cachedProfile] as const;
                            }

                            // Only call Supabase when we have not loaded
                            // this player's profile before.
                            const { data: profileData, error: profileError } =
                                await supabase.rpc(
                                    "get_public_player_profile",
                                    {
                                        p_user_id: userId,
                                    },
                                );

                            if (profileError) {
                                console.warn(
                                    "Could not load community post profile:",
                                    userId,
                                    profileError,
                                );

                                return [userId, null] as const;
                            }

                            const rawProfile = Array.isArray(profileData)
                                ? profileData[0]
                                : profileData;

                            const profile = (rawProfile ??
                                null) as PublicPlayerProfile | null;

                            // Save it so Posts, refreshes, etc.
                            // don't need to fetch it again.
                            if (profile) {
                                const cachedValue = {
                                    full_name: profile.full_name ?? null,
                                    avatar_url: profile.avatar_url ?? null,
                                };
                                profileCacheRef.current[userId] = cachedValue;
                                communityPublicProfilesCache[userId] =
                                    cachedValue;
                            }

                            return [userId, profile] as const;
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

            const mappedPosts: Post[] = rows.map((post) => {
                const profile = profilesByUserId.get(post.user_id);

                const author = profile?.full_name?.trim() || "Player";

                const avatar = profile?.avatar_url?.trim() || undefined;

                return {
                    id: String(post.id),
                    userId: post.user_id,
                    groupId: post.group_id,
                    author,
                    time: getPostTime(post.created_at),
                    text: post.content,
                    avatar,
                    images: post.image_url ? [post.image_url] : undefined,
                    likes: likeCounts.get(String(post.id)) ?? 0,
                    comments: commentCounts.get(String(post.id)) ?? 0,
                };
            });

            communityPostsCache = mappedPosts;
            communityLikedPostsCache = nextLikedPosts;

            setLikedPosts(nextLikedPosts);
            setPosts(mappedPosts);

            postsLoadedRef.current = true;
        } catch (error) {
            console.error("Failed to load community posts:", error);

            setPostsError(
                error instanceof Error
                    ? error.message
                    : "We couldn't load community posts.",
            );
        } finally {
            setPostsLoading(false);
        }
    }, []);

    const getCachedPublicProfile = useCallback(async (userId: string) => {
        const cachedProfile = profileCacheRef.current[userId];

        if (cachedProfile) {
            return cachedProfile;
        }

        const { data: profileData, error: profileError } = await supabase.rpc(
            "get_public_player_profile",
            {
                p_user_id: userId,
            },
        );

        if (profileError) {
            console.warn(
                "Could not load community group profile:",
                userId,
                profileError,
            );
            return null;
        }

        const rawProfile = Array.isArray(profileData)
            ? profileData[0]
            : profileData;

        const profile = (rawProfile ?? null) as PublicPlayerProfile | null;

        if (profile) {
            const cachedValue = {
                full_name: profile.full_name ?? null,
                avatar_url: profile.avatar_url ?? null,
            };
            profileCacheRef.current[userId] = cachedValue;
            communityPublicProfilesCache[userId] = cachedValue;
        }

        return profile;
    }, []);

    const loadGroupPreviews = useCallback(
        async (currentGroups: FootballGroup[]) => {
            if (currentGroups.length === 0) {
                communityGroupPreviewsCache = {};
                setGroupPreviews({});
                return;
            }

            try {
                const groupIds = currentGroups.map((group) => group.id);

                const { data: memberData, error: memberError } = await supabase
                    .from("community_group_members")
                    .select("group_id,user_id,created_at")
                    .in("group_id", groupIds)
                    .order("created_at", {
                        ascending: false,
                    });

                if (memberError) {
                    throw memberError;
                }

                const memberRows = (memberData ?? []) as GroupMemberRow[];

                const memberIdsByGroup: Record<string, string[]> = {};

                memberRows.forEach((member) => {
                    const existing = memberIdsByGroup[member.group_id] ?? [];

                    if (existing.length < 3) {
                        existing.push(member.user_id);
                        memberIdsByGroup[member.group_id] = existing;
                    }
                });

                const latestPostResults = await Promise.all(
                    currentGroups.map(async (group) => {
                        const { data, error } = await supabase
                            .from("community_posts")
                            .select(
                                "id,user_id,content,group_id,image_url,created_at",
                            )
                            .eq("group_id", group.id)
                            .order("created_at", {
                                ascending: false,
                            })
                            .limit(1)
                            .maybeSingle();

                        if (error) {
                            console.warn(
                                "Could not load latest group activity:",
                                group.id,
                                error,
                            );
                            return [group.id, null] as const;
                        }

                        return [
                            group.id,
                            (data ?? null) as CommunityPostRow | null,
                        ] as const;
                    }),
                );

                const latestPostByGroup = new Map(latestPostResults);

                const profileUserIds = new Set<string>();

                Object.values(memberIdsByGroup).forEach((userIds) => {
                    userIds.forEach((userId) => profileUserIds.add(userId));
                });

                latestPostResults.forEach(([, post]) => {
                    if (post?.user_id) {
                        profileUserIds.add(post.user_id);
                    }
                });

                const profileEntries = await Promise.all(
                    [...profileUserIds].map(async (userId) => {
                        const profile = await getCachedPublicProfile(userId);
                        return [userId, profile] as const;
                    }),
                );

                const profilesByUserId = new Map(profileEntries);

                const nextPreviews: Record<string, GroupPreview> = {};

                currentGroups.forEach((group) => {
                    const memberAvatars = (memberIdsByGroup[group.id] ?? [])
                        .map(
                            (userId) =>
                                profilesByUserId
                                    .get(userId)
                                    ?.avatar_url?.trim() || undefined,
                        )
                        .filter((avatar): avatar is string => !!avatar)
                        .slice(0, 3);

                    const latestPost = latestPostByGroup.get(group.id);

                    let latestActivity: GroupPreview["latestActivity"];

                    if (latestPost) {
                        const profile = profilesByUserId.get(
                            latestPost.user_id,
                        );

                        latestActivity = {
                            author: profile?.full_name?.trim() || "Player",
                            avatar: profile?.avatar_url?.trim() || undefined,
                            text: latestPost.content,
                            time: getPostTime(latestPost.created_at),
                        };
                    }

                    nextPreviews[group.id] = {
                        memberAvatars,
                        latestActivity,
                    };
                });

                communityGroupPreviewsCache = nextPreviews;
                setGroupPreviews(nextPreviews);
            } catch (error) {
                console.error(
                    "Failed to load community group previews:",
                    error,
                );
            }
        },
        [getCachedPublicProfile],
    );

    const loadGroups = useCallback(
        async (showLoading = false) => {
            if (showLoading) {
                setGroupsLoading(true);
            }

            setGroupsError(null);

            try {
                const { data, error } = await supabase
                    .from("community_groups")
                    .select("id,name,description,created_at")
                    .order("created_at", {
                        ascending: true,
                    });

                if (error) {
                    throw error;
                }

                const rows = (data ?? []) as FootballGroup[];

                communityGroupsCache = rows;
                setGroups(rows);
                void loadGroupPreviews(rows);
            } catch (error) {
                console.error("Failed to load community groups:", error);
                setGroupsError(
                    error instanceof Error
                        ? error.message
                        : "We couldn't load football groups.",
                );
            } finally {
                setGroupsLoading(false);
            }
        },
        [loadGroupPreviews],
    );

    const loadGroupMemberships = useCallback(async () => {
        try {
            const { data, error } = await supabase.rpc(
                "get_community_group_summaries",
            );

            if (error) {
                throw error;
            }

            const rows = (data ?? []) as CommunityGroupSummaryRow[];

            const nextMemberCounts: Record<string, number> = {};
            const nextJoined: Record<string, boolean> = {};

            rows.forEach((row) => {
                nextMemberCounts[row.group_id] = Number(row.member_count ?? 0);
                nextJoined[row.group_id] = !!row.joined;
            });

            communityGroupMemberCountsCache = nextMemberCounts;
            communityGroupJoinedCache = nextJoined;

            setGroupMemberCounts(nextMemberCounts);
            setGroupJoined(nextJoined);
        } catch (error) {
            console.error("Failed to load community group summaries:", error);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadPosts(!postsLoadedRef.current);
            void loadGroups(communityGroupsCache === null);
            void loadGroupMemberships();
        }, [loadPosts, loadGroups, loadGroupMemberships]),
    );

    async function joinGroupFromDiscover(groupId: string) {
        if (joiningGroups[groupId] || groupJoined[groupId]) {
            return;
        }

        setJoiningGroups((current) => ({
            ...current,
            [groupId]: true,
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
                throw new Error("You must be signed in to join a group.");
            }

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

            setGroupJoined((current) => {
                const next = {
                    ...current,
                    [groupId]: true,
                };

                communityGroupJoinedCache = next;
                return next;
            });

            setGroupMemberCounts((current) => {
                const next = {
                    ...current,
                    [groupId]: (current[groupId] ?? 0) + 1,
                };

                communityGroupMemberCountsCache = next;
                return next;
            });

            void loadGroupPreviews(groups);
        } catch (error) {
            console.error("Failed to join community group:", error);
            Alert.alert("Couldn't join group", "Please try again.");
            void loadGroupMemberships();
        } finally {
            setJoiningGroups((current) => ({
                ...current,
                [groupId]: false,
            }));
        }
    }

    function updateLikeUI(postId: string, shouldBeLiked: boolean) {
        const currentlyLiked = !!likedPosts[postId];

        if (currentlyLiked === shouldBeLiked) {
            return;
        }

        setLikedPosts((current) => {
            const next = {
                ...current,
                [postId]: shouldBeLiked,
            };
            communityLikedPostsCache = next;
            return next;
        });

        setPosts((current) => {
            const next = current.map((post) =>
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
            communityPostsCache = next;
            return next;
        });
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
            console.error("Failed to save community post like:", error);

            void loadPosts();
        } finally {
            setLikingPosts((current) => ({
                ...current,
                [postId]: false,
            }));
        }
    }

    function handleLikePressIn(postId: string) {
        if (likingPosts[postId]) {
            return;
        }

        const shouldBeLiked = !likedPosts[postId];

        updateLikeUI(postId, shouldBeLiked);
    }

    function handleLikePress(postId: string) {
        if (likingPosts[postId]) {
            return;
        }

        const shouldBeLiked = !!likedPosts[postId];

        void saveLike(postId, shouldBeLiked);
    }

    async function loadInlineComments(postId: string, forceRefresh = false) {
        if (commentsLoading[postId]) {
            return;
        }

        if (!forceRefresh && communityCommentsCache[postId]) {
            setCommentsByPost((current) => ({
                ...current,
                [postId]: communityCommentsCache[postId],
            }));
        }

        setCommentsLoading((current) => ({ ...current, [postId]: true }));

        try {
            const { data, error } = await supabase
                .from("community_post_comments")
                .select("id,post_id,user_id,content,created_at")
                .eq("post_id", Number(postId))
                .order("created_at", { ascending: true });

            if (error) {
                throw error;
            }

            const rows = (data ?? []) as CommunityCommentRow[];
            const userIds = [
                ...new Set(rows.map((comment) => comment.user_id)),
            ];

            const profileEntries = await Promise.all(
                userIds.map(async (userId) => {
                    const profile = await getCachedPublicProfile(userId);
                    return [userId, profile] as const;
                }),
            );

            const profiles = new Map(profileEntries);

            const mappedComments: InlineComment[] = rows.map((comment) => {
                const profile = profiles.get(comment.user_id);

                return {
                    id: String(comment.id),
                    userId: comment.user_id,
                    author: profile?.full_name?.trim() || "Player",
                    avatar: profile?.avatar_url?.trim() || undefined,
                    text: comment.content,
                    time: getPostTime(comment.created_at),
                    createdAt: comment.created_at,
                };
            });

            communityCommentsCache[postId] = mappedComments;

            setCommentsByPost((current) => ({
                ...current,
                [postId]: mappedComments,
            }));
        } catch (error) {
            console.error("Failed to load inline comments:", error);
        } finally {
            setCommentsLoading((current) => ({ ...current, [postId]: false }));
        }
    }

    function toggleInlineComments(postId: string) {
        const opening = !expandedComments[postId];

        setExpandedComments((current) => ({
            ...current,
            [postId]: opening,
        }));

        if (opening) {
            setVisibleCommentCounts((current) => ({
                ...current,
                [postId]: current[postId] ?? 3,
            }));

            void loadInlineComments(postId);
        }
    }

    function showMoreComments(postId: string) {
        setVisibleCommentCounts((current) => ({
            ...current,
            [postId]: (current[postId] ?? 3) + 5,
        }));
    }

    function startEditingComment(comment: InlineComment) {
        setCommentMenuId(null);
        setEditingCommentId(comment.id);
        setEditingCommentText(comment.text);
    }

    function cancelEditingComment() {
        setEditingCommentId(null);
        setEditingCommentText("");
    }

    async function saveEditedComment(postId: string, commentId: string) {
        const content = editingCommentText.trim();

        if (!content || savingCommentId) {
            return;
        }

        setSavingCommentId(commentId);

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) {
                throw userError;
            }

            if (!user) {
                throw new Error("You must be signed in to edit a comment.");
            }

            const { error } = await supabase
                .from("community_post_comments")
                .update({ content })
                .eq("id", Number(commentId))
                .eq("user_id", user.id);

            if (error) {
                throw error;
            }

            const nextComments = (communityCommentsCache[postId] ?? []).map(
                (comment) =>
                    comment.id === commentId
                        ? { ...comment, text: content }
                        : comment,
            );

            communityCommentsCache[postId] = nextComments;
            setCommentsByPost((current) => ({
                ...current,
                [postId]: nextComments,
            }));

            cancelEditingComment();
        } catch (error) {
            console.error("Failed to edit inline comment:", error);
            Alert.alert("Couldn't edit comment", "Please try again.");
        } finally {
            setSavingCommentId(null);
        }
    }

    function confirmDeleteComment(postId: string, commentId: string) {
        setCommentMenuId(null);

        Alert.alert(
            "Delete comment?",
            "This comment will be permanently deleted.",
            [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        void deleteInlineComment(postId, commentId);
                    },
                },
            ],
        );
    }

    async function deleteInlineComment(postId: string, commentId: string) {
        if (deletingCommentId) {
            return;
        }

        setDeletingCommentId(commentId);

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) {
                throw userError;
            }

            if (!user) {
                throw new Error("You must be signed in to delete a comment.");
            }

            const { error } = await supabase
                .from("community_post_comments")
                .delete()
                .eq("id", Number(commentId))
                .eq("user_id", user.id);

            if (error) {
                throw error;
            }

            const nextComments = (communityCommentsCache[postId] ?? []).filter(
                (comment) => comment.id !== commentId,
            );

            communityCommentsCache[postId] = nextComments;
            setCommentsByPost((current) => ({
                ...current,
                [postId]: nextComments,
            }));

            setPosts((current) => {
                const nextPosts = current.map((post) =>
                    post.id === postId
                        ? { ...post, comments: Math.max(0, post.comments - 1) }
                        : post,
                );
                communityPostsCache = nextPosts;
                return nextPosts;
            });

            if (editingCommentId === commentId) {
                cancelEditingComment();
            }
        } catch (error) {
            console.error("Failed to delete inline comment:", error);
            Alert.alert("Couldn't delete comment", "Please try again.");
        } finally {
            setDeletingCommentId(null);
        }
    }

    function focusCommentComposer(postId: string) {
        // iOS automaticallyAdjustKeyboardInsets is the primary keyboard
        // handler. Do not manually move the input at the same time because
        // the two adjustments can cause a visible second jump.
        //
        // Keep the ref lookup so this remains scoped to the focused post,
        // but let the ScrollView's native keyboard inset reveal the field.
        const input = commentInputRefs.current[postId];

        if (!input) {
            return;
        }
    }

    async function submitInlineComment(postId: string) {
        const content = (commentDrafts[postId] ?? "").trim();

        if (!content || postingComments[postId]) {
            return;
        }

        setPostingComments((current) => ({ ...current, [postId]: true }));

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

            const { data, error } = await supabase
                .from("community_post_comments")
                .insert({
                    post_id: Number(postId),
                    user_id: user.id,
                    content,
                })
                .select("id,post_id,user_id,content,created_at")
                .single();

            if (error) {
                throw error;
            }

            const inserted = data as CommunityCommentRow;
            const profile = await getCachedPublicProfile(user.id);

            const newComment: InlineComment = {
                id: String(inserted.id),
                userId: inserted.user_id,
                author: profile?.full_name?.trim() || "Player",
                avatar: profile?.avatar_url?.trim() || undefined,
                text: inserted.content,
                time: "now",
                createdAt: inserted.created_at,
            };

            const nextComments = [
                ...(commentsByPost[postId] ??
                    communityCommentsCache[postId] ??
                    []),
                newComment,
            ];

            communityCommentsCache[postId] = nextComments;

            setCommentsByPost((current) => ({
                ...current,
                [postId]: nextComments,
            }));

            setPosts((current) => {
                const nextPosts = current.map((post) =>
                    post.id === postId
                        ? { ...post, comments: post.comments + 1 }
                        : post,
                );
                communityPostsCache = nextPosts;
                return nextPosts;
            });

            setVisibleCommentCounts((current) => ({
                ...current,
                [postId]: Math.max(current[postId] ?? 3, 3),
            }));

            setCommentDrafts((current) => ({ ...current, [postId]: "" }));
            Keyboard.dismiss();
        } catch (error) {
            console.error("Failed to post inline comment:", error);
        } finally {
            setPostingComments((current) => ({ ...current, [postId]: false }));
        }
    }

    function openPostMenu(post: Post) {
        if (!currentUserId || post.userId !== currentUserId) {
            return;
        }

        Alert.alert("Post options", undefined, [
            {
                text: "Edit post",
                onPress: () => {
                    setEditingPost(post);
                    setEditingPostText(post.text);
                    setEditingPostImage(null);
                    setRemoveEditingPostImage(false);
                },
            },
            {
                text: "Delete post",
                style: "destructive",
                onPress: () => confirmDeletePost(post),
            },
            { text: "Cancel", style: "cancel" },
        ]);
    }

    async function pickEditingPostPhoto() {
        if (savingPostEdit) {
            return;
        }

        const permission =
            await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
            Alert.alert(
                "Photo access needed",
                "Allow Addis Football to access your photos so you can change the photo on your post.",
            );
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: false,
            quality: 0.85,
        });

        if (result.canceled || !result.assets?.[0]) {
            return;
        }

        setEditingPostImage(result.assets[0]);
        setRemoveEditingPostImage(false);
        Keyboard.dismiss();
    }

    async function uploadEditedPostImage(
        userId: string,
        asset: ImagePicker.ImagePickerAsset,
    ) {
        const response = await fetch(asset.uri);
        const arrayBuffer = await response.arrayBuffer();
        const mimeType = asset.mimeType ?? "image/jpeg";
        const rawExtension =
            asset.fileName?.split(".").pop()?.toLowerCase() ??
            mimeType.split("/").pop()?.toLowerCase() ??
            "jpg";
        const extension = rawExtension === "jpeg" ? "jpg" : rawExtension;
        const filePath = `${userId}/${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 10)}.${extension}`;

        const { error: uploadError } = await supabase.storage
            .from("community-posts")
            .upload(filePath, arrayBuffer, {
                contentType: mimeType,
                upsert: false,
            });

        if (uploadError) {
            throw uploadError;
        }

        const { data } = supabase.storage
            .from("community-posts")
            .getPublicUrl(filePath);

        if (!data.publicUrl) {
            await supabase.storage.from("community-posts").remove([filePath]);
            throw new Error("We couldn't create a public URL for your photo.");
        }

        return { filePath, publicUrl: data.publicUrl };
    }

    function getCommunityPostStoragePath(imageUrl: string) {
        const marker = "/storage/v1/object/public/community-posts/";
        const markerIndex = imageUrl.indexOf(marker);

        if (markerIndex < 0) {
            return null;
        }

        return decodeURIComponent(
            imageUrl.slice(markerIndex + marker.length).split("?")[0],
        );
    }

    async function savePostEdit() {
        if (!editingPost || savingPostEdit || !currentUserId) {
            return;
        }

        const content = editingPostText.trim();
        const oldImageUrl = editingPost.images?.[0] ?? null;
        const willHaveImage =
            !!editingPostImage || (!!oldImageUrl && !removeEditingPostImage);

        if (!content && !willHaveImage) {
            Alert.alert(
                "Post can't be empty",
                "Add some text or a photo before saving.",
            );
            return;
        }

        setSavingPostEdit(true);
        let uploadedFilePath: string | null = null;

        try {
            let nextImageUrl = removeEditingPostImage ? null : oldImageUrl;

            if (editingPostImage) {
                const uploaded = await uploadEditedPostImage(
                    currentUserId,
                    editingPostImage,
                );
                uploadedFilePath = uploaded.filePath;
                nextImageUrl = uploaded.publicUrl;
            }

            const { data, error } = await supabase
                .from("community_posts")
                .update({
                    content,
                    image_url: nextImageUrl,
                })
                .eq("id", Number(editingPost.id))
                .eq("user_id", currentUserId)
                .select("id")
                .maybeSingle();

            if (error) {
                if (uploadedFilePath) {
                    await supabase.storage
                        .from("community-posts")
                        .remove([uploadedFilePath]);
                }
                throw error;
            }

            if (!data) {
                if (uploadedFilePath) {
                    await supabase.storage
                        .from("community-posts")
                        .remove([uploadedFilePath]);
                }
                throw new Error(
                    "Post not found or you no longer have permission to edit it.",
                );
            }

            setPosts((current) => {
                const nextPosts = current.map((post) =>
                    post.id === editingPost.id
                        ? {
                              ...post,
                              text: content,
                              images: nextImageUrl ? [nextImageUrl] : undefined,
                          }
                        : post,
                );
                communityPostsCache = nextPosts;
                return nextPosts;
            });

            if (oldImageUrl && oldImageUrl !== nextImageUrl) {
                const oldStoragePath = getCommunityPostStoragePath(oldImageUrl);
                if (oldStoragePath) {
                    const { error: cleanupError } = await supabase.storage
                        .from("community-posts")
                        .remove([oldStoragePath]);
                    if (cleanupError) {
                        console.warn(
                            "Post updated, but old image cleanup failed:",
                            cleanupError,
                        );
                    }
                }
            }

            setEditingPost(null);
            setEditingPostText("");
            setEditingPostImage(null);
            setRemoveEditingPostImage(false);
            Keyboard.dismiss();
        } catch (error) {
            console.error("Failed to edit community post:", error);
            Alert.alert("Couldn't edit post", "Please try again.");
        } finally {
            setSavingPostEdit(false);
        }
    }

    function confirmDeletePost(post: Post) {
        Alert.alert("Delete post?", "This post will be permanently removed.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                    void deletePost(post);
                },
            },
        ]);
    }

    async function deletePost(post: Post) {
        if (deletingPostId || !currentUserId || post.userId !== currentUserId) {
            return;
        }

        setDeletingPostId(post.id);

        try {
            const { data, error } = await supabase
                .from("community_posts")
                .delete()
                .eq("id", Number(post.id))
                .eq("user_id", currentUserId)
                .select("id")
                .maybeSingle();

            if (error) {
                throw error;
            }

            if (!data) {
                throw new Error(
                    "Post not found or you no longer have permission to delete it.",
                );
            }

            setPosts((current) => {
                const nextPosts = current.filter((item) => item.id !== post.id);
                communityPostsCache = nextPosts;
                return nextPosts;
            });

            setLikedPosts((current) => {
                const next = { ...current };
                delete next[post.id];
                communityLikedPostsCache = next;
                return next;
            });

            setCommentsByPost((current) => {
                const next = { ...current };
                delete next[post.id];
                delete communityCommentsCache[post.id];
                return next;
            });

            const imageUrl = post.images?.[0];
            if (imageUrl) {
                const marker = "/storage/v1/object/public/community-posts/";
                const markerIndex = imageUrl.indexOf(marker);

                if (markerIndex >= 0) {
                    const storagePath = decodeURIComponent(
                        imageUrl
                            .slice(markerIndex + marker.length)
                            .split("?")[0],
                    );

                    const { error: storageError } = await supabase.storage
                        .from("community-posts")
                        .remove([storagePath]);

                    if (storageError) {
                        console.warn(
                            "Post deleted, but image cleanup failed:",
                            storageError,
                        );
                    }
                }
            }
        } catch (error) {
            console.error("Failed to delete community post:", error);
            Alert.alert("Couldn't delete post", "Please try again.");
        } finally {
            setDeletingPostId(null);
        }
    }

    const normalizedGroupSearch = groupSearch.trim().toLowerCase();

    const filteredGroups = normalizedGroupSearch
        ? groups.filter((group) => {
              const searchableText =
                  `${group.name} ${group.description}`.toLowerCase();
              return searchableText.includes(normalizedGroupSearch);
          })
        : groups;

    const yourGroups = filteredGroups.filter(
        (group) => !!groupJoined[group.id],
    );
    const discoverGroups = filteredGroups.filter(
        (group) => !groupJoined[group.id],
    );

    return (
        <SafeAreaView edges={["top"]} style={styles.screen}>
            {/* HEADER */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Communities</Text>
            </View>

            <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                automaticallyAdjustKeyboardInsets
                onScrollBeginDrag={Keyboard.dismiss}
            >
                {/* INTERNAL TABS */}
                <View style={styles.sectionTabs}>
                    <CommunityTab
                        label="Feed"
                        active={activeSection === "posts"}
                        onPress={() => {
                            communityActiveSectionCache = "posts";
                            setActiveSection("posts");
                        }}
                    />

                    <CommunityTab
                        label="Groups"
                        active={activeSection === "groups"}
                        onPress={() => {
                            communityActiveSectionCache = "groups";
                            setActiveSection("groups");
                        }}
                    />
                </View>

                {/* POSTS */}
                {activeSection === "posts" && (
                    <View style={styles.feed}>
                        {/* COMPACT CREATE POST COMPOSER */}
                        <Pressable
                            style={({ pressed }) => [
                                styles.compactComposer,
                                pressed && styles.compactComposerPressed,
                            ]}
                            onPress={() =>
                                router.push("/community/create-post")
                            }
                        >
                            {currentUserProfile?.avatar_url ? (
                                <Image
                                    source={{
                                        uri: currentUserProfile.avatar_url,
                                    }}
                                    style={styles.composerAvatar}
                                />
                            ) : (
                                <View style={styles.composerAvatarFallback}>
                                    <Ionicons
                                        name="person"
                                        size={19}
                                        color={COLORS.primary}
                                    />
                                </View>
                            )}

                            <Text
                                style={styles.compactComposerPlaceholder}
                                numberOfLines={1}
                            >
                                Share with the community...
                            </Text>

                            <View style={styles.compactComposerPhoto}>
                                <Ionicons
                                    name="images-outline"
                                    size={21}
                                    color={COLORS.primary}
                                />
                            </View>
                        </Pressable>

                        {postsLoading && posts.length === 0 ? (
                            <View style={styles.postsStatus}>
                                <Text style={styles.postsStatusTitle}>
                                    Loading posts...
                                </Text>

                                <Text style={styles.postsStatusText}>
                                    Getting the latest from the Addis football
                                    community.
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
                            <View style={styles.postsStatus}>
                                <View style={styles.emptyPostsIcon}>
                                    <Ionicons
                                        name="chatbubbles-outline"
                                        size={26}
                                        color={COLORS.primary}
                                    />
                                </View>

                                <Text style={styles.postsStatusTitle}>
                                    No posts yet
                                </Text>

                                <Text style={styles.postsStatusText}>
                                    Be the first player to post in the Addis
                                    football community.
                                </Text>

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.createFirstPostButton,
                                        pressed && styles.pressed,
                                    ]}
                                    onPress={() =>
                                        router.push("/community/create-post")
                                    }
                                >
                                    <Ionicons
                                        name="add"
                                        size={18}
                                        color={COLORS.white}
                                    />

                                    <Text style={styles.createFirstPostText}>
                                        Create Post
                                    </Text>
                                </Pressable>
                            </View>
                        ) : (
                            posts.map((post) => {
                                const liked = !!likedPosts[post.id];
                                const groupName =
                                    groups.find(
                                        (group) => group.id === post.groupId,
                                    )?.name ?? "Addis Football";

                                return (
                                    <View key={post.id} style={styles.postCard}>
                                        <View style={styles.postHeader}>
                                            {post.avatar ? (
                                                <Image
                                                    source={{
                                                        uri: post.avatar,
                                                    }}
                                                    style={styles.avatar}
                                                />
                                            ) : (
                                                <View
                                                    style={
                                                        styles.avatarFallback
                                                    }
                                                >
                                                    <Ionicons
                                                        name="person"
                                                        size={21}
                                                        color={COLORS.primary}
                                                    />
                                                </View>
                                            )}

                                            <View style={styles.postAuthorText}>
                                                <Text style={styles.authorName}>
                                                    {post.author}
                                                </Text>

                                                <View
                                                    style={styles.postMetaRow}
                                                >
                                                    <Ionicons
                                                        name="people"
                                                        size={13}
                                                        color={COLORS.textMuted}
                                                    />
                                                    <Text
                                                        style={styles.postMeta}
                                                        numberOfLines={1}
                                                    >
                                                        {groupName} ·{" "}
                                                        {post.time}
                                                    </Text>
                                                </View>
                                            </View>

                                            {post.userId === currentUserId && (
                                                <Pressable
                                                    style={({ pressed }) => [
                                                        styles.moreButton,
                                                        pressed &&
                                                            styles.pressed,
                                                    ]}
                                                    onPress={() =>
                                                        openPostMenu(post)
                                                    }
                                                    disabled={
                                                        deletingPostId ===
                                                        post.id
                                                    }
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Post options"
                                                >
                                                    {deletingPostId ===
                                                    post.id ? (
                                                        <ActivityIndicator
                                                            size="small"
                                                            color={
                                                                COLORS.textSecondary
                                                            }
                                                        />
                                                    ) : (
                                                        <Ionicons
                                                            name="ellipsis-horizontal"
                                                            size={21}
                                                            color={
                                                                COLORS.textSecondary
                                                            }
                                                        />
                                                    )}
                                                </Pressable>
                                            )}
                                        </View>

                                        {!!post.text && (
                                            <Text style={styles.postText}>
                                                {post.text}
                                            </Text>
                                        )}

                                        {!!post.images?.length && (
                                            <View
                                                style={[
                                                    styles.postImages,
                                                    post.images.length === 1 &&
                                                        styles.postImagesSingle,
                                                ]}
                                            >
                                                {post.images
                                                    .slice(0, 2)
                                                    .map((image, index) => (
                                                        <View
                                                            key={`${post.id}-${index}`}
                                                            style={
                                                                post.images
                                                                    ?.length ===
                                                                1
                                                                    ? styles.singlePostImageWrap
                                                                    : styles.postImagePressable
                                                            }
                                                        >
                                                            <Image
                                                                source={{
                                                                    uri: image,
                                                                }}
                                                                resizeMode="contain"
                                                                onLoad={(
                                                                    event,
                                                                ) => {
                                                                    const source =
                                                                        event
                                                                            .nativeEvent
                                                                            ?.source;

                                                                    const width =
                                                                        source?.width;
                                                                    const height =
                                                                        source?.height;

                                                                    if (
                                                                        typeof width ===
                                                                            "number" &&
                                                                        typeof height ===
                                                                            "number" &&
                                                                        width >
                                                                            0 &&
                                                                        height >
                                                                            0 &&
                                                                        !imageRatios[
                                                                            image
                                                                        ]
                                                                    ) {
                                                                        setImageRatios(
                                                                            (
                                                                                current,
                                                                            ) => ({
                                                                                ...current,
                                                                                [image]:
                                                                                    width /
                                                                                    height,
                                                                            }),
                                                                        );
                                                                    }
                                                                }}
                                                                style={[
                                                                    styles.postImageSingle,
                                                                    {
                                                                        aspectRatio:
                                                                            imageRatios[
                                                                                image
                                                                            ] ??
                                                                            1,
                                                                    },
                                                                ]}
                                                            />
                                                        </View>
                                                    ))}
                                            </View>
                                        )}

                                        <View style={styles.postStats}>
                                            <View style={styles.statItem}>
                                                <View
                                                    style={[
                                                        styles.reactionBubble,
                                                        liked &&
                                                            styles.reactionBubbleLiked,
                                                    ]}
                                                >
                                                    <Ionicons
                                                        name="heart"
                                                        size={13}
                                                        color={
                                                            liked
                                                                ? COLORS.white
                                                                : COLORS.danger
                                                        }
                                                    />
                                                </View>
                                                <Text style={styles.statText}>
                                                    {post.likes}
                                                </Text>
                                            </View>

                                            <Pressable
                                                style={({ pressed }) => [
                                                    styles.commentCountButton,
                                                    pressed && styles.pressed,
                                                ]}
                                                onPress={() =>
                                                    router.push(
                                                        `/community/post/${post.id}`,
                                                    )
                                                }
                                            >
                                                <Text style={styles.statText}>
                                                    {post.comments}{" "}
                                                    {post.comments === 1
                                                        ? "comment"
                                                        : "comments"}
                                                </Text>
                                            </Pressable>
                                        </View>

                                        <View style={styles.postActions}>
                                            <Pressable
                                                style={({ pressed }) => [
                                                    styles.actionButton,
                                                    pressed &&
                                                        styles.actionButtonPressed,
                                                ]}
                                                onPressIn={() =>
                                                    handleLikePressIn(post.id)
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
                                                    size={21}
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
                                                    Like
                                                </Text>
                                            </Pressable>

                                            <View
                                                style={styles.actionDivider}
                                            />

                                            <Pressable
                                                style={({ pressed }) => [
                                                    styles.actionButton,
                                                    pressed &&
                                                        styles.actionButtonPressed,
                                                ]}
                                                onPress={() =>
                                                    router.push(
                                                        `/community/post/${post.id}`,
                                                    )
                                                }
                                            >
                                                <Ionicons
                                                    name="chatbubble-outline"
                                                    size={20}
                                                    color={COLORS.textSecondary}
                                                />
                                                <Text style={styles.actionText}>
                                                    Comment
                                                </Text>
                                            </Pressable>
                                        </View>


                                    </View>
                                );
                            })
                        )}
                    </View>
                )}

                {/* GROUPS */}
                {activeSection === "groups" && (
                    <View style={styles.groupsSection}>
                        <View style={styles.groupsHeading}>
                            <View>
                                <Text style={styles.groupsTitle}>
                                    Football Groups
                                </Text>

                                <Text style={styles.groupsSubtitle}>
                                    Find your community in Addis.
                                </Text>
                            </View>
                        </View>

                        <View style={styles.groupSearchWrap}>
                            <Ionicons
                                name="search-outline"
                                size={19}
                                color={COLORS.textMuted}
                            />

                            <TextInput
                                value={groupSearch}
                                onChangeText={setGroupSearch}
                                placeholder="Search groups"
                                placeholderTextColor={COLORS.textMuted}
                                style={styles.groupSearchInput}
                                returnKeyType="search"
                                blurOnSubmit
                                submitBehavior="blurAndSubmit"
                                onSubmitEditing={Keyboard.dismiss}
                                autoCapitalize="none"
                                autoCorrect={false}
                                clearButtonMode="while-editing"
                                accessibilityLabel="Search football groups"
                            />

                            {!!groupSearch && (
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.groupSearchClear,
                                        pressed && styles.pressed,
                                    ]}
                                    onPress={() => setGroupSearch("")}
                                    accessibilityRole="button"
                                    accessibilityLabel="Clear group search"
                                >
                                    <Ionicons
                                        name="close-circle"
                                        size={19}
                                        color={COLORS.textMuted}
                                    />
                                </Pressable>
                            )}
                        </View>

                        {groupsLoading && groups.length === 0 ? (
                            <View style={styles.groupsStatusState}>
                                <ActivityIndicator
                                    size="small"
                                    color={COLORS.primary}
                                />
                                <Text style={styles.emptyGroupsTitle}>
                                    Loading groups...
                                </Text>
                                <Text style={styles.emptyGroupsText}>
                                    Finding football communities in Addis.
                                </Text>
                            </View>
                        ) : groupsError && groups.length === 0 ? (
                            <View style={styles.groupsStatusState}>
                                <Ionicons
                                    name="alert-circle-outline"
                                    size={28}
                                    color={COLORS.danger}
                                />
                                <Text style={styles.emptyGroupsTitle}>
                                    Couldn't load groups
                                </Text>
                                <Text style={styles.emptyGroupsText}>
                                    Please check your connection and try again.
                                </Text>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.clearGroupSearchButton,
                                        pressed && styles.pressed,
                                    ]}
                                    onPress={() => {
                                        void loadGroups(true);
                                        void loadGroupMemberships();
                                    }}
                                >
                                    <Text
                                        style={
                                            styles.clearGroupSearchButtonText
                                        }
                                    >
                                        Try again
                                    </Text>
                                </Pressable>
                            </View>
                        ) : (
                            <>
                                {yourGroups.length > 0 && (
                                    <View style={styles.groupCollection}>
                                        <Text style={styles.groupSectionTitle}>
                                            Your Groups
                                        </Text>

                                        <View style={styles.groupsList}>
                                            {yourGroups.map((group) => {
                                                const preview =
                                                    groupPreviews[group.id];
                                                const activity =
                                                    preview?.latestActivity;
                                                const memberCount =
                                                    groupMemberCounts[
                                                        group.id
                                                    ] ?? 0;

                                                return (
                                                    <Pressable
                                                        key={group.id}
                                                        style={({
                                                            pressed,
                                                        }) => [
                                                            styles.groupRow,
                                                            pressed &&
                                                                styles.groupRowPressed,
                                                        ]}
                                                        onPress={() =>
                                                            router.push({
                                                                pathname:
                                                                    "/community/group/[id]",
                                                                params: {
                                                                    id: group.id,
                                                                },
                                                            })
                                                        }
                                                    >
                                                        <View
                                                            style={
                                                                styles.groupIcon
                                                            }
                                                        >
                                                            <Ionicons
                                                                name="people-outline"
                                                                size={23}
                                                                color={
                                                                    COLORS.primary
                                                                }
                                                            />
                                                        </View>

                                                        <View
                                                            style={
                                                                styles.groupContent
                                                            }
                                                        >
                                                            <View
                                                                style={
                                                                    styles.groupTopRow
                                                                }
                                                            >
                                                                <Text
                                                                    style={
                                                                        styles.groupName
                                                                    }
                                                                    numberOfLines={
                                                                        1
                                                                    }
                                                                >
                                                                    {group.name}
                                                                </Text>
                                                            </View>

                                                            <View
                                                                style={
                                                                    styles.groupMembersRow
                                                                }
                                                            >
                                                                {!!preview
                                                                    ?.memberAvatars
                                                                    .length && (
                                                                    <View
                                                                        style={
                                                                            styles.groupAvatarStack
                                                                        }
                                                                    >
                                                                        {preview.memberAvatars.map(
                                                                            (
                                                                                avatar,
                                                                                index,
                                                                            ) => (
                                                                                <Image
                                                                                    key={`${group.id}-member-${index}`}
                                                                                    source={{
                                                                                        uri: avatar,
                                                                                    }}
                                                                                    style={[
                                                                                        styles.groupMemberAvatar,
                                                                                        index >
                                                                                            0 && {
                                                                                            marginLeft:
                                                                                                -7,
                                                                                        },
                                                                                    ]}
                                                                                />
                                                                            ),
                                                                        )}
                                                                    </View>
                                                                )}

                                                                <Ionicons
                                                                    name="people-outline"
                                                                    size={13}
                                                                    color={
                                                                        COLORS.textMuted
                                                                    }
                                                                />

                                                                <Text
                                                                    style={
                                                                        styles.groupMembers
                                                                    }
                                                                >
                                                                    {
                                                                        memberCount
                                                                    }{" "}
                                                                    {memberCount ===
                                                                    1
                                                                        ? "member"
                                                                        : "members"}
                                                                </Text>

                                                                {activity && (
                                                                    <Text
                                                                        style={
                                                                            styles.groupActiveMeta
                                                                        }
                                                                    >
                                                                        · Active{" "}
                                                                        {
                                                                            activity.time
                                                                        }{" "}
                                                                        ago
                                                                    </Text>
                                                                )}
                                                            </View>

                                                            {activity ? (
                                                                <View
                                                                    style={
                                                                        styles.groupActivityRow
                                                                    }
                                                                >
                                                                    {activity.avatar ? (
                                                                        <Image
                                                                            source={{
                                                                                uri: activity.avatar,
                                                                            }}
                                                                            style={
                                                                                styles.groupActivityAvatar
                                                                            }
                                                                        />
                                                                    ) : (
                                                                        <View
                                                                            style={
                                                                                styles.groupActivityAvatarFallback
                                                                            }
                                                                        >
                                                                            <Ionicons
                                                                                name="person"
                                                                                size={
                                                                                    10
                                                                                }
                                                                                color={
                                                                                    COLORS.primary
                                                                                }
                                                                            />
                                                                        </View>
                                                                    )}

                                                                    <Text
                                                                        style={
                                                                            styles.groupActivityText
                                                                        }
                                                                        numberOfLines={
                                                                            1
                                                                        }
                                                                    >
                                                                        <Text
                                                                            style={
                                                                                styles.groupActivityAuthor
                                                                            }
                                                                        >
                                                                            {
                                                                                activity.author
                                                                            }

                                                                            :{" "}
                                                                        </Text>
                                                                        {
                                                                            activity.text
                                                                        }
                                                                    </Text>
                                                                </View>
                                                            ) : (
                                                                <Text
                                                                    style={
                                                                        styles.groupNoActivity
                                                                    }
                                                                >
                                                                    No activity
                                                                    yet
                                                                </Text>
                                                            )}
                                                        </View>

                                                        <Ionicons
                                                            name="chevron-forward"
                                                            size={19}
                                                            color={
                                                                COLORS.textMuted
                                                            }
                                                        />
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    </View>
                                )}

                                {discoverGroups.length > 0 && (
                                    <View style={styles.groupCollection}>
                                        <View
                                            style={styles.discoverSectionHeader}
                                        >
                                            <View
                                                style={
                                                    styles.discoverSectionTitleRow
                                                }
                                            >
                                                <Text
                                                    style={
                                                        styles.groupSectionTitle
                                                    }
                                                >
                                                    Discover Groups
                                                </Text>

                                                <View
                                                    style={
                                                        styles.discoverCountBadge
                                                    }
                                                >
                                                    <Text
                                                        style={
                                                            styles.discoverCountText
                                                        }
                                                    >
                                                        {discoverGroups.length}
                                                    </Text>
                                                </View>
                                            </View>

                                            <Text
                                                style={
                                                    styles.discoverSectionSubtitle
                                                }
                                            >
                                                Find more football communities
                                                to join.
                                            </Text>
                                        </View>

                                        <View style={styles.groupsList}>
                                            {discoverGroups.map((group) => {
                                                const preview =
                                                    groupPreviews[group.id];
                                                const memberCount =
                                                    groupMemberCounts[
                                                        group.id
                                                    ] ?? 0;
                                                const joining =
                                                    !!joiningGroups[group.id];

                                                return (
                                                    <Pressable
                                                        key={group.id}
                                                        style={({
                                                            pressed,
                                                        }) => [
                                                            styles.groupRow,
                                                            styles.discoverGroupRow,
                                                            pressed &&
                                                                styles.groupRowPressed,
                                                        ]}
                                                        onPress={() =>
                                                            router.push({
                                                                pathname:
                                                                    "/community/group/[id]",
                                                                params: {
                                                                    id: group.id,
                                                                },
                                                            })
                                                        }
                                                    >
                                                        <View
                                                            style={
                                                                styles.groupIcon
                                                            }
                                                        >
                                                            <Ionicons
                                                                name="people-outline"
                                                                size={23}
                                                                color={
                                                                    COLORS.primary
                                                                }
                                                            />
                                                        </View>

                                                        <View
                                                            style={
                                                                styles.groupContent
                                                            }
                                                        >
                                                            <Text
                                                                style={
                                                                    styles.groupName
                                                                }
                                                                numberOfLines={
                                                                    1
                                                                }
                                                            >
                                                                {group.name}
                                                            </Text>

                                                            <Text
                                                                style={
                                                                    styles.groupDescription
                                                                }
                                                                numberOfLines={
                                                                    1
                                                                }
                                                            >
                                                                {
                                                                    group.description
                                                                }
                                                            </Text>

                                                            <View
                                                                style={
                                                                    styles.groupMembersRow
                                                                }
                                                            >
                                                                {!!preview
                                                                    ?.memberAvatars
                                                                    .length && (
                                                                    <View
                                                                        style={
                                                                            styles.groupAvatarStack
                                                                        }
                                                                    >
                                                                        {preview.memberAvatars.map(
                                                                            (
                                                                                avatar,
                                                                                index,
                                                                            ) => (
                                                                                <Image
                                                                                    key={`${group.id}-member-${index}`}
                                                                                    source={{
                                                                                        uri: avatar,
                                                                                    }}
                                                                                    style={[
                                                                                        styles.groupMemberAvatar,
                                                                                        index >
                                                                                            0 && {
                                                                                            marginLeft:
                                                                                                -7,
                                                                                        },
                                                                                    ]}
                                                                                />
                                                                            ),
                                                                        )}
                                                                    </View>
                                                                )}

                                                                <Ionicons
                                                                    name="people-outline"
                                                                    size={13}
                                                                    color={
                                                                        COLORS.textMuted
                                                                    }
                                                                />

                                                                <Text
                                                                    style={
                                                                        styles.groupMembers
                                                                    }
                                                                >
                                                                    {
                                                                        memberCount
                                                                    }{" "}
                                                                    {memberCount ===
                                                                    1
                                                                        ? "member"
                                                                        : "members"}
                                                                </Text>
                                                            </View>
                                                        </View>

                                                        <Pressable
                                                            style={({
                                                                pressed,
                                                            }) => [
                                                                styles.joinGroupButton,
                                                                pressed &&
                                                                    styles.joinGroupButtonPressed,
                                                                joining &&
                                                                    styles.joinGroupButtonDisabled,
                                                            ]}
                                                            disabled={joining}
                                                            onPress={(
                                                                event,
                                                            ) => {
                                                                event.stopPropagation();
                                                                void joinGroupFromDiscover(
                                                                    group.id,
                                                                );
                                                            }}
                                                            accessibilityRole="button"
                                                            accessibilityLabel={`Join ${group.name}`}
                                                        >
                                                            {joining ? (
                                                                <ActivityIndicator
                                                                    size="small"
                                                                    color={
                                                                        COLORS.white
                                                                    }
                                                                />
                                                            ) : (
                                                                <Text
                                                                    style={
                                                                        styles.joinGroupButtonText
                                                                    }
                                                                >
                                                                    Join
                                                                </Text>
                                                            )}
                                                        </Pressable>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    </View>
                                )}

                                {yourGroups.length === 0 &&
                                    discoverGroups.length === 0 && (
                                        <View style={styles.emptyGroupsState}>
                                            <Ionicons
                                                name={
                                                    normalizedGroupSearch
                                                        ? "search-outline"
                                                        : "people-outline"
                                                }
                                                size={26}
                                                color={COLORS.primary}
                                            />
                                            <Text
                                                style={styles.emptyGroupsTitle}
                                            >
                                                {normalizedGroupSearch
                                                    ? "No groups found"
                                                    : "No groups yet"}
                                            </Text>
                                            <Text
                                                style={styles.emptyGroupsText}
                                            >
                                                {normalizedGroupSearch
                                                    ? `No groups match “${groupSearch.trim()}”. Try another search.`
                                                    : "Football groups will appear here."}
                                            </Text>

                                            {normalizedGroupSearch && (
                                                <Pressable
                                                    style={({ pressed }) => [
                                                        styles.clearGroupSearchButton,
                                                        pressed &&
                                                            styles.pressed,
                                                    ]}
                                                    onPress={() =>
                                                        setGroupSearch("")
                                                    }
                                                >
                                                    <Text
                                                        style={
                                                            styles.clearGroupSearchButtonText
                                                        }
                                                    >
                                                        Clear search
                                                    </Text>
                                                </Pressable>
                                            )}
                                        </View>
                                    )}
                            </>
                        )}
                    </View>
                )}
            </ScrollView>

            <Modal
                visible={!!editingPost}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    if (!savingPostEdit) {
                        setEditingPost(null);
                        setEditingPostText("");
                        setEditingPostImage(null);
                        setRemoveEditingPostImage(false);
                    }
                }}
            >
                <View style={styles.editPostBackdrop}>
                    <View style={styles.editPostCard}>
                        <View style={styles.editPostHeader}>
                            <Pressable
                                style={styles.editPostHeaderButton}
                                onPress={() => {
                                    if (!savingPostEdit) {
                                        setEditingPost(null);
                                        setEditingPostText("");
                                        setEditingPostImage(null);
                                        setRemoveEditingPostImage(false);
                                        Keyboard.dismiss();
                                    }
                                }}
                                disabled={savingPostEdit}
                            >
                                <Text style={styles.editPostCancelText}>
                                    Cancel
                                </Text>
                            </Pressable>

                            <Text style={styles.editPostTitle}>Edit post</Text>

                            <Pressable
                                style={styles.editPostHeaderButton}
                                onPress={() => void savePostEdit()}
                                disabled={savingPostEdit}
                            >
                                {savingPostEdit ? (
                                    <ActivityIndicator
                                        size="small"
                                        color={COLORS.primary}
                                    />
                                ) : (
                                    <Text style={styles.editPostSaveText}>
                                        Save
                                    </Text>
                                )}
                            </Pressable>
                        </View>

                        <TextInput
                            value={editingPostText}
                            onChangeText={setEditingPostText}
                            placeholder="What's on your mind?"
                            placeholderTextColor={COLORS.textMuted}
                            style={styles.editPostInput}
                            multiline
                            textAlignVertical="top"
                            maxLength={1500}
                            autoFocus
                            editable={!savingPostEdit}
                            returnKeyType="done"
                            blurOnSubmit
                            submitBehavior="blurAndSubmit"
                            onSubmitEditing={() => {
                                Keyboard.dismiss();
                            }}
                        />

                        <Text style={styles.editPostCharacterCount}>
                            {editingPostText.length}/1500
                        </Text>

                        {(editingPostImage ||
                            (!!editingPost?.images?.[0] &&
                                !removeEditingPostImage)) && (
                            <View style={styles.editPostImageWrap}>
                                <Image
                                    source={{
                                        uri:
                                            editingPostImage?.uri ??
                                            editingPost?.images?.[0],
                                    }}
                                    style={[
                                        styles.editPostImage,
                                        editingPostImage?.width &&
                                        editingPostImage?.height
                                            ? {
                                                  aspectRatio:
                                                      editingPostImage.width /
                                                      editingPostImage.height,
                                              }
                                            : undefined,
                                    ]}
                                    resizeMode="contain"
                                />

                                <Pressable
                                    style={styles.editPostRemoveImageButton}
                                    onPress={() => {
                                        setEditingPostImage(null);
                                        setRemoveEditingPostImage(true);
                                    }}
                                    disabled={savingPostEdit}
                                    accessibilityRole="button"
                                    accessibilityLabel="Remove post photo"
                                >
                                    <Ionicons
                                        name="close"
                                        size={20}
                                        color={COLORS.white}
                                    />
                                </Pressable>
                            </View>
                        )}

                        <Pressable
                            style={({ pressed }) => [
                                styles.editPostPhotoButton,
                                pressed && styles.pressed,
                            ]}
                            onPress={() => void pickEditingPostPhoto()}
                            disabled={savingPostEdit}
                        >
                            <Ionicons
                                name="images-outline"
                                size={20}
                                color={COLORS.primary}
                            />
                            <Text style={styles.editPostPhotoButtonText}>
                                {editingPostImage ||
                                (!!editingPost?.images?.[0] &&
                                    !removeEditingPostImage)
                                    ? "Change photo"
                                    : "Add photo"}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

type CommunityTabProps = {
    label: string;
    active: boolean;
    onPress: () => void;
};

function CommunityTab({ label, active, onPress }: CommunityTabProps) {
    return (
        <Pressable
            style={({ pressed }) => [
                styles.sectionTab,
                pressed && styles.pressed,
            ]}
            onPress={onPress}
        >
            <Text
                style={[
                    styles.sectionTabText,
                    active && styles.sectionTabTextActive,
                ]}
            >
                {label}
            </Text>

            {active && <View style={styles.sectionTabIndicator} />}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#F7F8FA",
    },

    scrollView: {
        flex: 1,
    },

    scrollContent: {
        width: "100%",
        maxWidth: 680,
        alignSelf: "center",
        paddingBottom: 20,
    },

    pressed: {
        opacity: 0.65,
    },

    header: {
        width: "100%",
        maxWidth: 680,
        alignSelf: "center",
        height: 58,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    headerTitle: {
        color: "#14201B",
        fontSize: 25,
        lineHeight: 30,
        fontWeight: "900",
        letterSpacing: -0.5,
    },

    groupTopRow: {
        flexDirection: "row",
        alignItems: "center",
    },

    groupActivityTime: {
        color: COLORS.textMuted,
        fontSize: 10,
        lineHeight: 14,
        fontWeight: "600",
        marginLeft: 8,
    },

    groupActivityRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 7,
    },

    groupActivityAvatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: COLORS.surfaceAlt,
        marginRight: 6,
    },

    groupActivityAvatarFallback: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 6,
    },

    groupActivityText: {
        flex: 1,
        minWidth: 0,
        color: COLORS.textSecondary,
        fontSize: 11,
        lineHeight: 15,
        fontWeight: "500",
    },

    groupActivityAuthor: {
        color: COLORS.text,
        fontWeight: "800",
    },

    groupNoActivity: {
        color: COLORS.textMuted,
        fontSize: 11,
        lineHeight: 15,
        fontWeight: "500",
        marginTop: 7,
    },

    sectionTabs: {
        height: 50,
        flexDirection: "row",
        backgroundColor: COLORS.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
        paddingHorizontal: 14,
    },

    sectionTab: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
    },

    sectionTabText: {
        color: COLORS.textSecondary,
        fontSize: 14,
        fontWeight: "700",
    },

    sectionTabTextActive: {
        color: COLORS.primary,
        fontWeight: "900",
    },

    sectionTabIndicator: {
        position: "absolute",
        left: 10,
        right: 10,
        bottom: 0,
        height: 3,
        borderRadius: 3,
        backgroundColor: COLORS.primary,
    },

    feed: {
        backgroundColor: COLORS.background,
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 8,
        gap: 12,
    },

    postsStatus: {
        minHeight: 240,
        paddingHorizontal: 28,
        paddingVertical: 40,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
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

    emptyPostsIcon: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
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

    createFirstPostButton: {
        height: 42,
        paddingHorizontal: 17,
        borderRadius: 21,
        backgroundColor: COLORS.primary,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        marginTop: 17,
    },

    createFirstPostText: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: "900",
    },

    compactComposer: {
        minHeight: 62,
        marginHorizontal: 16,
        marginTop: 14,
        marginBottom: 12,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    compactComposerPressed: {
        opacity: 0.94,
    },

    compactComposerPlaceholder: {
        flex: 1,
        color: COLORS.textSecondary,
        fontSize: 14,
        lineHeight: 19,
        fontWeight: "600",
    },

    compactComposerPhoto: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.surfaceAlt,
    },

    postComposer: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 14,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },

    postComposerTop: {
        flexDirection: "row",
        alignItems: "center",
    },

    composerAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: COLORS.surfaceAlt,
    },

    composerAvatarFallback: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
    },

    composerInput: {
        flex: 1,
        minHeight: 46,
        marginLeft: 11,
        paddingHorizontal: 17,
        borderWidth: 1,
        borderColor: COLORS.borderStrong,
        borderRadius: 23,
        justifyContent: "center",
        backgroundColor: COLORS.surface,
    },

    composerInputPressed: {
        backgroundColor: COLORS.surfaceAlt,
    },

    composerPlaceholder: {
        color: COLORS.textSecondary,
        fontSize: 15,
        fontWeight: "500",
    },

    composerPhotoButton: {
        height: 46,
        marginTop: 12,
        borderRadius: 14,
        backgroundColor: COLORS.primarySoft,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
    },

    composerPhotoButtonPressed: {
        opacity: 0.72,
        transform: [{ scale: 0.995 }],
    },

    composerPhotoIcon: {
        width: 27,
        height: 27,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },

    composerPhotoText: {
        color: COLORS.text,
        fontSize: 13,
        fontWeight: "800",
    },

    postCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingTop: 15,
        paddingHorizontal: 15,
        overflow: "hidden",
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.045,
        shadowRadius: 10,
        elevation: 2,
    },

    postHeader: {
        flexDirection: "row",
        alignItems: "center",
    },

    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.surfaceAlt,
    },

    avatarFallback: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
    },

    postAuthorText: {
        flex: 1,
        minWidth: 0,
        marginLeft: 11,
    },

    authorName: {
        color: COLORS.text,
        fontSize: 15,
        lineHeight: 19,
        fontWeight: "900",
    },

    postMetaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        marginTop: 3,
    },

    postMeta: {
        flexShrink: 1,
        color: COLORS.textMuted,
        fontSize: 11.5,
        lineHeight: 15,
        fontWeight: "650",
    },

    moreButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
    },

    postText: {
        color: COLORS.text,
        fontSize: 15,
        lineHeight: 21,
        fontWeight: "500",
        marginTop: 14,
        marginBottom: 13,
    },

    postImages: {
        width: "100%",
        height: 220,
        flexDirection: "row",
        gap: 3,
        overflow: "hidden",
        borderRadius: 14,
        backgroundColor: COLORS.surfaceAlt,
        marginTop: 10,
        marginBottom: 2,
    },
    postImagesSingle: {
        width: "auto",
        height: undefined,
        flexDirection: "column",
        overflow: "hidden",
        marginHorizontal: -18,
        marginTop: 10,
        marginBottom: 2,
        borderRadius: 0,
        backgroundColor: COLORS.surface,
    },

    singlePostImageWrap: {
        width: "100%",
        overflow: "hidden",
        borderRadius: 0,
    },

    postImageSingle: {
        width: "100%",
        height: undefined,
    },

    postImagePressable: {
        flex: 1,
        height: "100%",
        overflow: "hidden",
    },

    postImage: {
        width: "100%",
        height: "100%",
    },

    postStats: {
        minHeight: 43,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },

    statItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },

    reactionBubble: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#F3C9CE",
        backgroundColor: "#FFF4F5",
        alignItems: "center",
        justifyContent: "center",
    },

    reactionBubbleLiked: {
        borderColor: COLORS.danger,
        backgroundColor: COLORS.danger,
    },

    statText: {
        color: COLORS.textSecondary,
        fontSize: 12,
        fontWeight: "600",
    },

    commentCountButton: {
        minHeight: 38,
        justifyContent: "center",
        paddingLeft: 12,
    },

    postActions: {
        height: 50,
        flexDirection: "row",
        alignItems: "center",
    },

    actionButton: {
        flex: 1,
        height: 42,
        borderRadius: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
    },

    actionButtonPressed: {
        backgroundColor: COLORS.surfaceAlt,
    },

    actionDivider: {
        width: StyleSheet.hairlineWidth,
        height: 22,
        backgroundColor: COLORS.border,
    },

    actionText: {
        color: COLORS.textSecondary,
        fontSize: 13,
        lineHeight: 17,
        fontWeight: "800",
    },

    likedActionText: {
        color: COLORS.danger,
    },

    inlineCommentsSection: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.border,
        paddingTop: 10,
        paddingBottom: 12,
    },

    inlineCommentsLoading: {
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },

    inlineCommentsLoadingText: {
        color: COLORS.textMuted,
        fontSize: 11.5,
        fontWeight: "600",
    },

    inlineCommentRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 10,
    },

    inlineCommentAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.surfaceAlt,
        marginRight: 8,
    },

    inlineCommentAvatarFallback: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
    },

    inlineCommentBody: {
        flex: 1,
        minWidth: 0,
        alignItems: "flex-start",
    },

    inlineCommentBubble: {
        maxWidth: "100%",
        backgroundColor: COLORS.surfaceAlt,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },

    inlineCommentAuthor: {
        color: COLORS.text,
        fontSize: 12.5,
        lineHeight: 16,
        fontWeight: "800",
    },

    inlineCommentText: {
        color: COLORS.text,
        fontSize: 13,
        lineHeight: 18,
        fontWeight: "500",
        marginTop: 1,
    },

    inlineCommentTime: {
        color: COLORS.textMuted,
        fontSize: 10,
        lineHeight: 14,
        fontWeight: "600",
        marginTop: 3,
        marginLeft: 7,
    },

    viewMoreCommentsButton: {
        alignSelf: "flex-start",
        minHeight: 30,
        justifyContent: "center",
        marginBottom: 6,
        marginLeft: 40,
    },

    viewMoreCommentsText: {
        color: COLORS.textSecondary,
        fontSize: 12,
        fontWeight: "800",
    },

    inlineCommentTopRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "flex-start",
    },

    commentMenuWrap: {
        position: "relative",
        marginLeft: 3,
        zIndex: 20,
    },

    commentMenuButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },

    commentMenu: {
        position: "absolute",
        top: 28,
        right: 0,
        width: 160,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
        zIndex: 30,
    },

    commentMenuItem: {
        minHeight: 40,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
    },

    commentMenuItemText: {
        color: COLORS.text,
        fontSize: 12.5,
        fontWeight: "700",
    },

    commentMenuDeleteText: {
        color: COLORS.danger,
    },

    inlineEditInput: {
        minWidth: 150,
        maxWidth: "100%",
        color: COLORS.text,
        fontSize: 13,
        lineHeight: 18,
        padding: 0,
        marginTop: 3,
    },

    inlineEditActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        marginTop: 4,
        marginLeft: 7,
    },

    inlineEditCancel: {
        color: COLORS.textMuted,
        fontSize: 11,
        fontWeight: "700",
    },

    inlineEditSave: {
        color: COLORS.primary,
        fontSize: 11,
        fontWeight: "900",
    },

    inlineNoComments: {
        color: COLORS.textMuted,
        fontSize: 11.5,
        lineHeight: 16,
        fontWeight: "600",
        textAlign: "center",
        paddingVertical: 8,
    },

    inlineCommentComposer: {
        flexDirection: "row",
        alignItems: "flex-end",
        marginTop: 4,
    },

    inlineComposerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.surfaceAlt,
        marginRight: 8,
    },

    inlineComposerAvatarFallback: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
    },

    inlineCommentInputWrap: {
        flex: 1,
        minHeight: 38,
        maxHeight: 100,
        borderRadius: 19,
        backgroundColor: COLORS.surfaceAlt,
        flexDirection: "row",
        alignItems: "flex-end",
        paddingLeft: 13,
        paddingRight: 4,
        paddingVertical: 3,
    },

    inlineCommentInput: {
        flex: 1,
        minHeight: 32,
        maxHeight: 92,
        color: COLORS.text,
        fontSize: 13,
        lineHeight: 18,
        paddingTop: 7,
        paddingBottom: 7,
        paddingRight: 7,
    },

    inlineSendButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        alignItems: "center",
        justifyContent: "center",
    },

    inlineSendButtonDisabled: {
        opacity: 0.35,
    },

    groupsSection: {
        backgroundColor: "#F7F8FA",
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 20,
    },

    groupsHeading: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 15,
    },

    groupSearchWrap: {
        minHeight: 46,
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        paddingHorizontal: 13,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 14,
        backgroundColor: COLORS.surface,
    },

    groupSearchInput: {
        flex: 1,
        minHeight: 44,
        paddingVertical: 0,
        color: COLORS.text,
        fontSize: 14,
        fontWeight: "600",
    },

    groupSearchClear: {
        width: 30,
        height: 30,
        alignItems: "center",
        justifyContent: "center",
    },

    editPostBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.42)",
        justifyContent: "center",
        paddingHorizontal: 18,
    },

    editPostCard: {
        maxHeight: "82%",
        backgroundColor: COLORS.surface,
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingBottom: 16,
        overflow: "hidden",
    },

    editPostHeader: {
        height: 58,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },

    editPostHeaderButton: {
        minWidth: 58,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },

    editPostTitle: {
        color: COLORS.text,
        fontSize: 17,
        fontWeight: "900",
    },

    editPostCancelText: {
        color: COLORS.textSecondary,
        fontSize: 14,
        fontWeight: "700",
    },

    editPostSaveText: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: "900",
    },

    editPostInput: {
        minHeight: 120,
        maxHeight: 240,
        color: COLORS.text,
        fontSize: 17,
        lineHeight: 24,
        fontWeight: "500",
        paddingTop: 16,
        paddingHorizontal: 2,
    },

    editPostCharacterCount: {
        alignSelf: "flex-end",
        color: COLORS.textMuted,
        fontSize: 11,
        fontWeight: "600",
        marginTop: 6,
        marginBottom: 12,
    },

    editPostImageWrap: {
        position: "relative",
        width: "100%",
        marginTop: 2,
        overflow: "hidden",
        borderRadius: 14,
        backgroundColor: COLORS.surfaceAlt,
    },

    editPostImage: {
        width: "100%",
        minHeight: 180,
        maxHeight: 360,
        backgroundColor: COLORS.surfaceAlt,
    },

    editPostRemoveImageButton: {
        position: "absolute",
        top: 10,
        right: 10,
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: "rgba(20,32,27,0.78)",
        alignItems: "center",
        justifyContent: "center",
    },

    editPostPhotoButton: {
        minHeight: 46,
        marginTop: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
    },

    editPostPhotoButtonText: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: "800",
    },

    groupsTitle: {
        color: "#14201B",
        fontSize: 19,
        lineHeight: 24,
        fontWeight: "900",
        letterSpacing: -0.25,
    },

    groupsSubtitle: {
        color: "#66766F",
        fontSize: 12,
        lineHeight: 17,
        fontWeight: "600",
        marginTop: 2,
    },

    groupCollection: {
        marginBottom: 16,
    },

    groupSectionTitle: {
        color: "#14201B",
        fontSize: 15,
        lineHeight: 20,
        fontWeight: "900",
        marginBottom: 10,
    },

    joinedBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        marginLeft: 8,
        paddingHorizontal: 7,
        height: 24,
        borderRadius: 12,
        backgroundColor: "#E7F8F1",
    },

    joinedBadgeText: {
        color: COLORS.primary,
        fontSize: 10,
        fontWeight: "800",
    },

    discoverBadge: {
        marginLeft: 8,
        paddingHorizontal: 8,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLORS.surfaceAlt,
        alignItems: "center",
        justifyContent: "center",
    },

    discoverBadgeText: {
        color: COLORS.textSecondary,
        fontSize: 10,
        fontWeight: "800",
    },

    groupActiveMeta: {
        color: "#8A9791",
        fontSize: 11,
        lineHeight: 15,
        fontWeight: "600",
    },

    discoverSectionHeader: {
        marginBottom: 10,
    },

    discoverSectionTitleRow: {
        flexDirection: "row",
        alignItems: "center",
    },

    discoverSectionSubtitle: {
        color: COLORS.textSecondary,
        fontSize: 11.5,
        lineHeight: 16,
        fontWeight: "500",
        marginTop: -5,
    },

    discoverCountBadge: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        paddingHorizontal: 6,
        marginLeft: 7,
        marginBottom: 10,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
    },

    discoverCountText: {
        color: COLORS.primary,
        fontSize: 10,
        fontWeight: "900",
    },

    discoverGroupRow: {
        minHeight: 88,
    },

    joinGroupButton: {
        minWidth: 66,
        height: 36,
        paddingHorizontal: 15,
        borderRadius: 18,
        backgroundColor: COLORS.primary,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 6,
    },

    joinGroupButtonPressed: {
        opacity: 0.82,
        transform: [{ scale: 0.97 }],
    },

    joinGroupButtonDisabled: {
        opacity: 0.65,
    },

    joinGroupButtonText: {
        color: COLORS.white,
        fontSize: 12,
        fontWeight: "900",
    },

    groupsStatusState: {
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
        paddingVertical: 48,
        gap: 8,
    },

    emptyGroupsState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 42,
        paddingHorizontal: 24,
    },

    emptyGroupsTitle: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: "900",
        marginTop: 10,
    },

    emptyGroupsText: {
        color: COLORS.textSecondary,
        fontSize: 12,
        fontWeight: "500",
        marginTop: 4,
        textAlign: "center",
    },

    clearGroupSearchButton: {
        minHeight: 38,
        marginTop: 14,
        paddingHorizontal: 16,
        borderRadius: 19,
        backgroundColor: "#E7F8F1",
        alignItems: "center",
        justifyContent: "center",
    },

    clearGroupSearchButtonText: {
        color: COLORS.primary,
        fontSize: 12,
        fontWeight: "800",
    },

    groupsList: {
        gap: 10,
    },

    groupRow: {
        minHeight: 92,
        flexDirection: "row",
        alignItems: "center",

        paddingHorizontal: 13,
        paddingVertical: 11,

        backgroundColor: COLORS.surface,

        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 17,
    },

    groupRowPressed: {
        backgroundColor: "#F8FAF9",
        transform: [{ scale: 0.99 }],
    },

    groupIcon: {
        width: 46,
        height: 46,
        borderRadius: 14,
        backgroundColor: "#E7F8F1",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 11,
    },

    groupContent: {
        flex: 1,
        minWidth: 0,
        paddingRight: 8,
    },

    groupName: {
        color: "#14201B",
        fontSize: 15,
        lineHeight: 20,
        fontWeight: "900",
    },

    groupDescription: {
        color: "#66766F",
        fontSize: 12,
        lineHeight: 17,
        fontWeight: "500",
        marginTop: 2,
    },

    groupMembersRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 5,
    },

    groupAvatarStack: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 2,
    },

    groupMemberAvatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: COLORS.surface,
        backgroundColor: COLORS.surfaceAlt,
    },

    groupMembers: {
        color: "#8A9791",
        fontSize: 11,
        lineHeight: 15,
        fontWeight: "600",
    },
});
