import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
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

type PlayerProfileCacheEntry = {
    profile: PublicPlayerProfile;
    currentUserId: string | null;
};

const playerProfileCache: Record<string, PlayerProfileCacheEntry> = {};

function getPlayerProfileCacheKey(playerId?: string, viewerId?: string | null) {
    if (!playerId) {
        return undefined;
    }

    return `${viewerId ?? "signed-out"}:${playerId}`;
}

function getPlayerProfileCache(playerId?: string, viewerId?: string | null) {
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

    useEffect(() => {
        void loadProfile();
    }, [id]);

    async function loadProfile() {
        console.log("PLAYER PROFILE ROUTE ID:", id);
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
        console.log("==========PLAYER PROFILE VIEWER ID:", viewerId);
        setCurrentUserId(viewerId);

        const cached = getPlayerProfileCache(id, viewerId);

        if (cached) {
            setProfile(cached.profile);
            setLoading(false);
        } else {
            setLoading(true);
            setProfile(null);
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

        console.log("PLAYER PROFILE RPC DATA:", data);
        console.log("PLAYER PROFILE RPC ERROR:", profileError);
        console.log("PLAYER PROFILE RESULT:", result);

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
        });

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

                <View style={styles.headerSpacer} />
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

                {/* MESSAGE */}

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
                            accessibilityRole="button"
                            accessibilityLabel={`Message ${profile.fullName}`}
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

    headerSpacer: {
        width: 42,
        height: 42,
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
        paddingHorizontal: 20,
        marginTop: 24,
    },

    messageButton: {
        width: "100%",
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
