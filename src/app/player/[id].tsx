import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../constants/colors";
import { supabase } from "../../lib/supabase";

type PublicPlayerProfile = {
    userId: string;
    fullName: string;
    avatarUrl: string | null;
    skillLevel: string | null;
    role: string;
};

type FriendshipStatus =
    "none" | "outgoing_pending" | "incoming_pending" | "accepted";

type FriendshipRow = {
    id: number;
    requester_id: string;
    addressee_id: string;
    status: "pending" | "accepted" | "declined";
};


type PlayerProfileCacheEntry = {
    profile: PublicPlayerProfile;
    currentUserId: string | null;
    friendship: FriendshipRow | null;
    friendshipStatus: FriendshipStatus;
    friendsCount: number | null;
};

const playerProfileCache: Record<string, PlayerProfileCacheEntry> = {};

function getPlayerProfileCacheKey(
    playerId?: string,
    viewerId?: string | null,
) {
    if (!playerId) {
        return undefined;
    }

    return `${viewerId ?? "signed-out"}:${playerId}`;
}

function getPlayerProfileCache(
    playerId?: string,
    viewerId?: string | null,
) {
    const key = getPlayerProfileCacheKey(playerId, viewerId);

    return key ? playerProfileCache[key] : undefined;
}

function setPlayerProfileCache(
    playerId: string,
    viewerId: string | null,
    entry: PlayerProfileCacheEntry,
) {
    const key = getPlayerProfileCacheKey(playerId, viewerId);

    if (key) {
        playerProfileCache[key] = entry;
    }
}

export default function PlayerProfileScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();

    const [profile, setProfile] = useState<PublicPlayerProfile | null>(null);

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState<string | null>(null);

    const [openingMessage, setOpeningMessage] = useState(false);

    const [friendship, setFriendship] = useState<FriendshipRow | null>(null);

    const [friendshipStatus, setFriendshipStatus] =
        useState<FriendshipStatus>("none");

    const [friendActionLoading, setFriendActionLoading] = useState(false);

    const [friendsCount, setFriendsCount] = useState<number | null>(null);

    useEffect(() => {
        void loadProfile();
    }, [id]);

    async function loadProfile() {
        if (!id) {
            setError("Player profile not found.");
            setLoading(false);
            return;
        }

        setError(null);

        const {
            data: { session },
        } = await supabase.auth.getSession();

        const viewerId = session?.user?.id ?? null;
        setCurrentUserId(viewerId);

        const cached = getPlayerProfileCache(id, viewerId);

        if (cached) {
            setProfile(cached.profile);
            setFriendship(cached.friendship);
            setFriendshipStatus(cached.friendshipStatus);
            setFriendsCount(cached.friendsCount);
            setLoading(false);
        } else {
            setLoading(true);
            setProfile(null);
            setFriendship(null);
            setFriendshipStatus("none");
            setFriendsCount(null);
        }

        const { data, error: profileError } = await supabase.rpc(
            "get_public_player_profile",
            {
                p_user_id: id,
            },
        );

        if (profileError) {
            console.log("Public player profile error:", profileError.message);

            if (!cached) {
                setError("Could not load this player's profile.");
            }

            setLoading(false);
            return;
        }

        const result = Array.isArray(data) ? data[0] : data;

        if (!result) {
            if (!cached) {
                setError("Player profile is unavailable.");
            }

            setLoading(false);
            return;
        }

        const loadedProfile: PublicPlayerProfile = {
            userId: String(result.user_id),
            fullName: String(result.full_name || "Player"),
            avatarUrl: result.avatar_url ? String(result.avatar_url) : null,
            skillLevel: result.skill_level ? String(result.skill_level) : null,
            role: String(result.role || "player"),
        };

        setProfile(loadedProfile);

        setPlayerProfileCache(id, viewerId, {
            profile: loadedProfile,
            currentUserId: viewerId,
            friendship: cached?.friendship ?? null,
            friendshipStatus: cached?.friendshipStatus ?? "none",
            friendsCount: cached?.friendsCount ?? null,
        });

        if (viewerId) {
            await Promise.all([
                loadFriendship(viewerId, loadedProfile.userId),
                loadFriendsCount(loadedProfile.userId, viewerId),
            ]);
        } else {
            setFriendship(null);
            setFriendshipStatus("none");
            await loadFriendsCount(loadedProfile.userId, null);
        }

        setLoading(false);
    }

    function goBack() {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace("/(tabs)");
        }
    }

    function getRoleLabel(role: string) {
        const normalizedRole = role.trim().toLowerCase();

        if (normalizedRole === "organizer") {
            return "Organizer";
        }

        if (normalizedRole === "admin") {
            return "Admin";
        }

        return "Football Player";
    }

    function getSkillLabel(skillLevel: string | null) {
        if (!skillLevel) {
            return "Not set";
        }

        const normalized = skillLevel.trim().toLowerCase();

        if (normalized === "beginner") {
            return "Beginner";
        }

        if (normalized === "intermediate") {
            return "Intermediate";
        }

        if (normalized === "advanced") {
            return "Advanced";
        }

        return skillLevel;
    }

    async function loadFriendship(viewerId: string, playerId: string) {
        if (viewerId === playerId) {
            setFriendship(null);
            setFriendshipStatus("none");

            const cached = getPlayerProfileCache(playerId, viewerId);
            if (cached) {
                cached.friendship = null;
                cached.friendshipStatus = "none";
            }
            return;
        }

        const { data, error: friendshipError } = await supabase
            .from("friendships")
            .select("id,requester_id,addressee_id,status")
            .or(
                `and(requester_id.eq.${viewerId},addressee_id.eq.${playerId}),and(requester_id.eq.${playerId},addressee_id.eq.${viewerId})`,
            )
            .order("updated_at", {
                ascending: false,
            })
            .limit(1)
            .maybeSingle();

        if (friendshipError) {
            console.error("Could not load friendship:", friendshipError);
            return;
        }

        const row = data
            ? ({
                  id: Number(data.id),
                  requester_id: String(data.requester_id),
                  addressee_id: String(data.addressee_id),
                  status: String(data.status) as FriendshipRow["status"],
              } satisfies FriendshipRow)
            : null;

        setFriendship(row);

        let nextStatus: FriendshipStatus = "none";

        if (row && row.status !== "declined") {
            if (row.status === "accepted") {
                nextStatus = "accepted";
            } else {
                nextStatus =
                    row.requester_id === viewerId
                        ? "outgoing_pending"
                        : "incoming_pending";
            }
        }

        setFriendshipStatus(nextStatus);

        const cached = getPlayerProfileCache(playerId, viewerId);
        if (cached) {
            cached.friendship = row;
            cached.friendshipStatus = nextStatus;
        }
    }

    async function loadFriendsCount(
        playerId: string,
        viewerId: string | null = currentUserId,
    ) {
        const { count, error: countError } = await supabase
            .from("friendships")
            .select("id", {
                count: "exact",
                head: true,
            })
            .eq("status", "accepted")
            .or(`requester_id.eq.${playerId},addressee_id.eq.${playerId}`);

        if (countError) {
            console.error("Could not load friends count:", countError);
            return;
        }

        const nextCount = count ?? 0;
        setFriendsCount(nextCount);

        const cached = getPlayerProfileCache(playerId, viewerId);
        if (cached) {
            cached.friendsCount = nextCount;
        }
    }

    async function handleAddFriend() {
        if (!profile?.userId || !currentUserId || friendActionLoading) {
            return;
        }

        setFriendActionLoading(true);

        try {
            if (friendship && friendship.status === "declined") {
                const { error: deleteError } = await supabase
                    .from("friendships")
                    .delete()
                    .eq("id", friendship.id);

                if (deleteError) {
                    throw deleteError;
                }
            }

            const { error: insertError } = await supabase
                .from("friendships")
                .insert({
                    requester_id: currentUserId,
                    addressee_id: profile.userId,
                    status: "pending",
                });

            if (insertError) {
                throw insertError;
            }

            await loadFriendship(currentUserId, profile.userId);
        } catch (friendError) {
            console.error("Could not send friend request:", friendError);

            Alert.alert(
                "Could not send request",
                friendError instanceof Error
                    ? friendError.message
                    : "Please try again.",
            );
        } finally {
            setFriendActionLoading(false);
        }
    }

    async function handleAcceptFriend() {
        if (
            !friendship ||
            !profile?.userId ||
            !currentUserId ||
            friendActionLoading
        ) {
            return;
        }

        setFriendActionLoading(true);

        try {
            const { error: updateError } = await supabase
                .from("friendships")
                .update({
                    status: "accepted",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", friendship.id)
                .eq("addressee_id", currentUserId);

            if (updateError) {
                throw updateError;
            }

            await Promise.all([
                loadFriendship(currentUserId, profile.userId),
                loadFriendsCount(profile.userId, currentUserId),
            ]);
        } catch (friendError) {
            console.error("Could not accept friend request:", friendError);

            Alert.alert("Could not accept request", "Please try again.");
        } finally {
            setFriendActionLoading(false);
        }
    }

    async function handleDeclineFriend() {
        if (
            !friendship ||
            !profile?.userId ||
            !currentUserId ||
            friendActionLoading
        ) {
            return;
        }

        setFriendActionLoading(true);

        try {
            const { error: updateError } = await supabase
                .from("friendships")
                .update({
                    status: "declined",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", friendship.id)
                .eq("addressee_id", currentUserId);

            if (updateError) {
                throw updateError;
            }

            await loadFriendship(currentUserId, profile.userId);
        } catch (friendError) {
            console.error("Could not decline friend request:", friendError);

            Alert.alert("Could not decline request", "Please try again.");
        } finally {
            setFriendActionLoading(false);
        }
    }

    function openPlayerMenu() {
        if (isCurrentUser || friendActionLoading) {
            return;
        }

        if (friendshipStatus === "accepted" && friendship) {
            Alert.alert("Player options", undefined, [
                {
                    text: "Remove Friend",
                    style: "destructive",
                    onPress: () => {
                        confirmRemoveFriend();
                    },
                },
                {
                    text: "Cancel",
                    style: "cancel",
                },
            ]);
            return;
        }

        if (friendshipStatus === "outgoing_pending" && friendship) {
            Alert.alert("Player options", undefined, [
                {
                    text: "Cancel Friend Request",
                    style: "destructive",
                    onPress: () => {
                        confirmCancelFriendRequest();
                    },
                },
                {
                    text: "Cancel",
                    style: "cancel",
                },
            ]);
            return;
        }

        Alert.alert(
            "Player options",
            "No additional actions are available for this player right now.",
            [
                {
                    text: "OK",
                },
            ],
        );
    }

    function confirmRemoveFriend() {
        Alert.alert(
            "Remove friend?",
            `You and ${profile?.fullName ?? "this player"} will no longer be friends.`,
            [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Remove Friend",
                    style: "destructive",
                    onPress: () => {
                        void deleteFriendship("friend");
                    },
                },
            ],
        );
    }

    function confirmCancelFriendRequest() {
        Alert.alert(
            "Cancel friend request?",
            `${profile?.fullName ?? "This player"} will no longer have a pending friend request from you.`,
            [
                {
                    text: "Keep Request",
                    style: "cancel",
                },
                {
                    text: "Cancel Request",
                    style: "destructive",
                    onPress: () => {
                        void deleteFriendship("request");
                    },
                },
            ],
        );
    }

    async function deleteFriendship(action: "friend" | "request") {
        if (
            !friendship ||
            !profile?.userId ||
            !currentUserId ||
            friendActionLoading
        ) {
            return;
        }

        setFriendActionLoading(true);

        try {
            const { error: deleteError } = await supabase
                .from("friendships")
                .delete()
                .eq("id", friendship.id);

            if (deleteError) {
                throw deleteError;
            }

            setFriendship(null);
            setFriendshipStatus("none");

            const cached = getPlayerProfileCache(
                profile.userId,
                currentUserId,
            );
            if (cached) {
                cached.friendship = null;
                cached.friendshipStatus = "none";
            }

            if (action === "friend") {
                await loadFriendsCount(profile.userId, currentUserId);
            }
        } catch (friendError) {
            console.error(
                action === "friend"
                    ? "Could not remove friend:"
                    : "Could not cancel friend request:",
                friendError,
            );

            Alert.alert(
                action === "friend"
                    ? "Could not remove friend"
                    : "Could not cancel request",
                "Please try again.",
            );
        } finally {
            setFriendActionLoading(false);
        }
    }

    async function handleMessage() {
        if (!profile?.userId || openingMessage) {
            return;
        }

        setOpeningMessage(true);

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) {
                throw userError;
            }

            if (!user) {
                throw new Error("You must be signed in to message a player.");
            }

            if (user.id === profile.userId) {
                return;
            }

            const { data, error: conversationError } = await supabase.rpc(
                "get_or_create_direct_conversation",
                {
                    p_other_user_id: profile.userId,
                },
            );

            if (conversationError) {
                throw conversationError;
            }

            if (data === null || data === undefined) {
                throw new Error("Could not create conversation.");
            }

            const conversationId = String(data);

            router.push({
                pathname: "/community/chat/[id]",
                params: {
                    id: conversationId,
                },
            });
        } catch (messageError) {
            console.error("Could not open conversation:", messageError);

            setError(
                messageError instanceof Error
                    ? messageError.message
                    : "Could not open this conversation.",
            );
        } finally {
            setOpeningMessage(false);
        }
    }

    if (loading) {
        return (
            <SafeAreaView style={styles.screen}>
                <View style={styles.centerState}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (error || !profile) {
        return (
            <SafeAreaView style={styles.screen}>
                <View style={styles.header}>
                    <Pressable
                        style={styles.backButton}
                        onPress={goBack}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <Ionicons name="arrow-back" size={24} color="#14201B" />
                    </Pressable>
                </View>

                <View style={styles.centerState}>
                    <View style={styles.errorIcon}>
                        <Ionicons
                            name="person-outline"
                            size={30}
                            color={COLORS.primary}
                        />
                    </View>

                    <Text style={styles.errorTitle}>Profile unavailable</Text>

                    <Text style={styles.errorText}>
                        {error ?? "This player profile could not be loaded."}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    const isCurrentUser = profile.userId === currentUserId;

    return (
        <SafeAreaView style={styles.screen} edges={["top"]}>
            {/* HEADER */}

            <View style={styles.header}>
                <Pressable
                    style={({ pressed }) => [
                        styles.backButton,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={goBack}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <Ionicons name="arrow-back" size={24} color="#14201B" />
                </Pressable>

                <Text style={styles.headerTitle}>Player Profile</Text>

                <Pressable
                    style={({ pressed }) => [
                        styles.moreButton,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={openPlayerMenu}
                    disabled={isCurrentUser || friendActionLoading}
                    accessibilityRole="button"
                    accessibilityLabel="More options"
                >
                    <Ionicons
                        name="ellipsis-horizontal"
                        size={23}
                        color="#14201B"
                    />
                </Pressable>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
            >
                {/* PROFILE */}

                <View style={styles.profileHeader}>
                    <View style={styles.avatarWrap}>
                        {profile.avatarUrl ? (
                            <Image
                                source={{
                                    uri: profile.avatarUrl,
                                }}
                                style={styles.avatar}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={styles.avatarFallback}>
                                <Text style={styles.avatarInitial}>
                                    {profile.fullName
                                        .trim()
                                        .charAt(0)
                                        .toUpperCase() || "P"}
                                </Text>
                            </View>
                        )}

                        <View style={styles.footballBadge}>
                            <Ionicons
                                name="football"
                                size={17}
                                color="#FFFFFF"
                            />
                        </View>
                    </View>

                    <View style={styles.nameRow}>
                        <Text style={styles.name}>{profile.fullName}</Text>

                        {isCurrentUser && (
                            <View style={styles.youBadge}>
                                <Text style={styles.youText}>You</Text>
                            </View>
                        )}
                    </View>

                    <Text style={styles.role}>
                        {getRoleLabel(profile.role)}
                    </Text>

                    {!!profile.skillLevel && (
                        <View style={styles.skillBadge}>
                            <Ionicons
                                name="flash-outline"
                                size={14}
                                color={COLORS.primary}
                            />

                            <Text style={styles.skillBadgeText}>
                                {getSkillLabel(profile.skillLevel)}
                            </Text>
                        </View>
                    )}
                </View>

                {/* ACTIONS */}

                {!isCurrentUser && (
                    <View style={styles.actions}>
                        <Pressable
                            style={({ pressed }) => [
                                styles.messageButton,
                                pressed && styles.actionPressed,
                                openingMessage && {
                                    opacity: 0.65,
                                },
                            ]}
                            onPress={() => {
                                void handleMessage();
                            }}
                            disabled={openingMessage}
                        >
                            {openingMessage ? (
                                <ActivityIndicator
                                    size="small"
                                    color="#FFFFFF"
                                />
                            ) : (
                                <>
                                    <Ionicons
                                        name="chatbubble-outline"
                                        size={19}
                                        color="#FFFFFF"
                                    />

                                    <Text style={styles.messageButtonText}>
                                        Message
                                    </Text>
                                </>
                            )}
                        </Pressable>

                        {friendshipStatus === "incoming_pending" ? (
                            <View style={styles.friendRequestActions}>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.acceptButton,
                                        pressed && styles.actionPressed,
                                        friendActionLoading && {
                                            opacity: 0.65,
                                        },
                                    ]}
                                    onPress={() => {
                                        void handleAcceptFriend();
                                    }}
                                    disabled={friendActionLoading}
                                >
                                    <Text style={styles.acceptButtonText}>
                                        Accept
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.declineButton,
                                        pressed && styles.actionPressed,
                                        friendActionLoading && {
                                            opacity: 0.65,
                                        },
                                    ]}
                                    onPress={() => {
                                        void handleDeclineFriend();
                                    }}
                                    disabled={friendActionLoading}
                                >
                                    <Text style={styles.declineButtonText}>
                                        Decline
                                    </Text>
                                </Pressable>
                            </View>
                        ) : (
                            <Pressable
                                style={({ pressed }) => [
                                    styles.friendButton,
                                    friendshipStatus === "accepted" &&
                                        styles.friendButtonAccepted,
                                    pressed &&
                                        friendshipStatus === "none" &&
                                        styles.actionPressed,
                                    friendActionLoading && {
                                        opacity: 0.65,
                                    },
                                ]}
                                onPress={() => {
                                    if (friendshipStatus === "none") {
                                        void handleAddFriend();
                                    }
                                }}
                                disabled={
                                    friendActionLoading ||
                                    friendshipStatus !== "none"
                                }
                            >
                                {friendActionLoading ? (
                                    <ActivityIndicator
                                        size="small"
                                        color={COLORS.primary}
                                    />
                                ) : (
                                    <Ionicons
                                        name={
                                            friendshipStatus === "accepted"
                                                ? "checkmark-circle"
                                                : friendshipStatus ===
                                                    "outgoing_pending"
                                                  ? "time-outline"
                                                  : "person-add-outline"
                                        }
                                        size={19}
                                        color={COLORS.primary}
                                    />
                                )}

                                <Text style={styles.friendButtonText}>
                                    {friendshipStatus === "accepted"
                                        ? "Friends"
                                        : friendshipStatus ===
                                            "outgoing_pending"
                                          ? "Requested"
                                          : "Add Friend"}
                                </Text>
                            </Pressable>
                        )}
                    </View>
                )}

                <View style={styles.divider} />

                {/* PLAYER INFO */}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Player info</Text>

                    <View style={styles.infoCard}>
                        <InfoRow
                            icon="speedometer-outline"
                            label="Skill level"
                            value={getSkillLabel(profile.skillLevel)}
                        />

                        <View style={styles.infoDivider} />

                        <InfoRow
                            icon="football-outline"
                            label="Preferred position"
                            value="Not set"
                        />

                        <View style={styles.infoDivider} />

                        <InfoRow
                            icon="location-outline"
                            label="Location"
                            value="Not set"
                        />
                    </View>
                </View>

                <View style={styles.divider} />

                {/* ACTIVITY */}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Football activity</Text>

                    <View style={styles.activityCard}>
                        <ActivityItem value="—" label="Games played" />

                        <View style={styles.activityDivider} />

                        <ActivityItem value="—" label="Games together" />

                        <View style={styles.activityDivider} />

                        <ActivityItem
                            value={
                                friendsCount === null
                                    ? "—"
                                    : String(friendsCount)
                            }
                            label="Friends"
                        />
                    </View>

                    <Text style={styles.comingSoon}>
                        More football activity will appear as the player uses
                        Addis Football.
                    </Text>
                </View>

                <View style={styles.divider} />

                {/* ABOUT */}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About</Text>

                    <View style={styles.aboutCard}>
                        <Ionicons
                            name="football-outline"
                            size={22}
                            color={COLORS.primary}
                        />

                        <Text style={styles.aboutText}>
                            Member of the Addis Football community.
                        </Text>
                    </View>
                </View>

                <View style={styles.bottomSpace} />
            </ScrollView>
        </SafeAreaView>
    );
}

type InfoRowProps = {
    icon: "speedometer-outline" | "football-outline" | "location-outline";
    label: string;
    value: string;
};

function InfoRow({ icon, label, value }: InfoRowProps) {
    return (
        <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
                <Ionicons name={icon} size={21} color={COLORS.primary} />
            </View>

            <View style={styles.infoText}>
                <Text style={styles.infoLabel}>{label}</Text>

                <Text style={styles.infoValue}>{value}</Text>
            </View>
        </View>
    );
}

function ActivityItem({ value, label }: { value: string; label: string }) {
    return (
        <View style={styles.activityItem}>
            <Text style={styles.activityValue}>{value}</Text>

            <Text style={styles.activityLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#F7F8FA",
    },

    header: {
        height: 58,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        backgroundColor: "#F7F8FA",
    },

    headerTitle: {
        color: "#14201B",
        fontSize: 17,
        fontWeight: "800",
    },

    backButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#DDE6E2",
    },

    moreButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#DDE6E2",
    },

    buttonPressed: {
        opacity: 0.65,
        transform: [{ scale: 0.95 }],
    },

    content: {
        paddingBottom: 30,
    },

    centerState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 30,
    },

    errorIcon: {
        width: 66,
        height: 66,
        borderRadius: 33,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#E7F8F1",
    },

    errorTitle: {
        color: "#14201B",
        fontSize: 20,
        fontWeight: "900",
        marginTop: 16,
    },

    errorText: {
        color: "#66766F",
        fontSize: 14,
        lineHeight: 20,
        textAlign: "center",
        marginTop: 7,
    },

    profileHeader: {
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 24,
    },

    avatarWrap: {
        position: "relative",
        width: 112,
        height: 112,
    },

    avatar: {
        width: 112,
        height: 112,
        borderRadius: 56,
        borderWidth: 3,
        borderColor: COLORS.primary,
        backgroundColor: "#F0F5F3",
    },

    avatarFallback: {
        width: 112,
        height: 112,
        borderRadius: 56,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 3,
        borderColor: COLORS.primary,
        backgroundColor: "#E7F8F1",
    },

    avatarInitial: {
        color: COLORS.primary,
        fontSize: 38,
        fontWeight: "900",
    },

    footballBadge: {
        position: "absolute",
        right: 0,
        bottom: 3,
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.primary,
        borderWidth: 3,
        borderColor: "#F7F8FA",
    },

    nameRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 16,
        paddingHorizontal: 20,
    },

    name: {
        flexShrink: 1,
        color: "#14201B",
        fontSize: 26,
        lineHeight: 31,
        fontWeight: "900",
        letterSpacing: -0.6,
        textAlign: "center",
    },

    youBadge: {
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: "#E7F8F1",
    },

    youText: {
        color: COLORS.primary,
        fontSize: 11,
        fontWeight: "900",
    },

    role: {
        color: "#66766F",
        fontSize: 14,
        fontWeight: "700",
        marginTop: 4,
    },

    skillBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        marginTop: 10,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "#E7F8F1",
    },

    skillBadgeText: {
        color: COLORS.primary,
        fontSize: 12,
        fontWeight: "800",
    },

    actions: {
        flexDirection: "row",
        gap: 10,
        paddingHorizontal: 20,
        marginTop: 24,
    },

    messageButton: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: COLORS.primary,
    },

    messageButtonText: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "800",
    },

    friendButton: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: COLORS.primary,
    },

    friendButtonText: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: "800",
    },

    friendButtonAccepted: {
        backgroundColor: "#E7F8F1",
    },

    friendRequestActions: {
        flex: 1,
        flexDirection: "row",
        gap: 8,
    },

    acceptButton: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.primary,
    },

    acceptButtonText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "800",
    },

    declineButton: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#DDE6E2",
    },

    declineButtonText: {
        color: "#66766F",
        fontSize: 13,
        fontWeight: "800",
    },

    actionPressed: {
        opacity: 0.75,
        transform: [{ scale: 0.98 }],
    },

    divider: {
        height: 1,
        backgroundColor: "#DDE6E2",
        marginHorizontal: 20,
        marginTop: 26,
    },

    section: {
        paddingHorizontal: 20,
        paddingTop: 22,
    },

    sectionTitle: {
        color: "#14201B",
        fontSize: 18,
        fontWeight: "900",
        marginBottom: 12,
    },

    infoCard: {
        overflow: "hidden",
        borderRadius: 17,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#DDE6E2",
    },

    infoRow: {
        minHeight: 72,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
    },

    infoIcon: {
        width: 42,
        height: 42,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#E7F8F1",
    },

    infoText: {
        flex: 1,
        marginLeft: 12,
    },

    infoLabel: {
        color: "#66766F",
        fontSize: 12,
        fontWeight: "600",
    },

    infoValue: {
        color: "#14201B",
        fontSize: 15,
        fontWeight: "800",
        marginTop: 3,
    },

    infoDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: "#DDE6E2",
        marginLeft: 68,
    },

    activityCard: {
        flexDirection: "row",
        alignItems: "stretch",
        borderRadius: 17,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#DDE6E2",
    },

    activityItem: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 5,
        paddingVertical: 18,
    },

    activityValue: {
        color: "#14201B",
        fontSize: 22,
        fontWeight: "900",
    },

    activityLabel: {
        color: "#66766F",
        fontSize: 11,
        fontWeight: "600",
        textAlign: "center",
        marginTop: 4,
    },

    activityDivider: {
        width: 1,
        backgroundColor: "#DDE6E2",
        marginVertical: 14,
    },

    comingSoon: {
        color: "#8A9791",
        fontSize: 12,
        lineHeight: 18,
        marginTop: 10,
    },

    aboutCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 11,
        padding: 15,
        borderRadius: 17,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#DDE6E2",
    },

    aboutText: {
        flex: 1,
        color: "#66766F",
        fontSize: 14,
        lineHeight: 21,
    },

    bottomSpace: {
        height: 40,
    },
});
