import { Ionicons } from "@expo/vector-icons";

import { router } from "expo-router";

import { useCallback, useEffect, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../constants/colors";

import { supabase } from "../../lib/supabase";

import { useLanguage } from "../../i18n/LanguageContext";

type PaymentRequest = {
    id: number;

    booking_id: number;

    game_id: number;

    user_id: string;

    provider: string | null;

    amount: number;

    currency: string;

    status: string;

    submitted_at: string | null;

    game_title: string;

    player_name: string;

    player_phone: string | null;
};

export default function PaymentRequestsScreen() {
    const [requests, setRequests] = useState<PaymentRequest[]>([]);

    const [loading, setLoading] = useState(true);

    const [refreshing, setRefreshing] = useState(false);

    const [confirmingId, setConfirmingId] = useState<number | null>(null);

    const [confirmedId, setConfirmedId] = useState<number | null>(null);

    const { t } = useLanguage();

    const loadRequests = useCallback(async () => {
        try {
            const {
                data: { user },

                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                Alert.alert(
                    t("paymentRequests.error"),
                    t("paymentRequests.mustBeSignedIn"),
                );

                return;
            }

            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", user.id)
                .maybeSingle();

            if (profileError) {
                throw profileError;
            }

            const role = profile?.role || "player";

            if (role !== "admin" && role !== "organizer") {
                Alert.alert(
                    t("paymentRequests.notAllowed"),
                    t("paymentRequests.organizersAdminsOnly"),
                );

                router.back();

                return;
            }

            const { data: paymentRows, error: paymentError } = await supabase
                .from("payments")
                .select(
                    `
         id,
         booking_id,
         game_id,
         user_id,
         provider,
         amount,
         currency,
         status,
         submitted_at
       `,
                )
                .eq("status", "submitted")
                .order("submitted_at", { ascending: true });

            if (paymentError) {
                throw paymentError;
            }

            if (!paymentRows || paymentRows.length === 0) {
                setRequests([]);

                return;
            }

            const gameIds = [
                ...new Set(
                    paymentRows
                        .map((payment) => payment.game_id)
                        .filter((id): id is number => typeof id === "number"),
                ),
            ];

            const userIds = [
                ...new Set(
                    paymentRows
                        .map((payment) => payment.user_id)
                        .filter((id): id is string => Boolean(id)),
                ),
            ];

            const { data: games, error: gamesError } = await supabase
                .from("games")
                .select("id, title, organizer, payment_method")
                .in("id", gameIds);

            if (gamesError) {
                throw gamesError;
            }

            const { data: players, error: playersError } = await supabase
                .from("profiles")
                .select("id, full_name, phone")
                .in("id", userIds);

            if (playersError) {
                throw playersError;
            }

            const gameMap = new Map(
                (games || []).map((game) => [game.id, game]),
            );

            const playerMap = new Map(
                (players || []).map((player) => [player.id, player]),
            );

            const visiblePayments = paymentRows.filter((payment) => {
                const game = gameMap.get(payment.game_id);

                // Payment Requests is only for the current
                // organizer-direct payment flow.
                if (game?.payment_method !== "organizer") {
                    return false;
                }

                if (role === "admin") {
                    return true;
                }

                return game.organizer === user.id;
            });

            const formatted: PaymentRequest[] = visiblePayments.map(
                (payment) => {
                    const game = gameMap.get(payment.game_id);

                    const player = playerMap.get(payment.user_id);

                    return {
                        id: payment.id,

                        booking_id: payment.booking_id,

                        game_id: payment.game_id,

                        user_id: payment.user_id,

                        provider: payment.provider,

                        amount: payment.amount,

                        currency: payment.currency,

                        status: payment.status,

                        submitted_at: payment.submitted_at,

                        game_title:
                            game?.title || t("paymentRequests.footballGame"),

                        player_name:
                            player?.full_name ||
                            t("paymentRequests.playerFallback"),

                        player_phone: player?.phone || null,
                    };
                },
            );

            setRequests(formatted);
        } catch (error: any) {
            console.log("Load payment requests error:", error);

            Alert.alert(
                t("paymentRequests.couldNotLoadPayments"),
                error?.message || t("paymentRequests.pleaseTryAgain"),
            );
        } finally {
            setLoading(false);

            setRefreshing(false);
        }
    }, [t]);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    async function handleRefresh() {
        setRefreshing(true);

        await loadRequests();
    }

    async function handleMarkPaid(request: PaymentRequest) {
        try {
            setConfirmingId(request.id);

            console.log("MARK PAID DEBUG:", {
                paymentId: request.id,

                bookingId: request.booking_id,
            });

            const { data, error } = await supabase.rpc(
                "confirm_organizer_payment",
                {
                    p_booking_id: request.booking_id,
                },
            );

            console.log("MARK PAID RESULT:", data);

            console.log("MARK PAID ERROR:", error);

            if (error) {
                throw error;
            }

            if (!data?.success) {
                throw new Error(
                    t("paymentRequests.paymentCouldNotBeConfirmed"),
                );
            }

            // Supabase has successfully confirmed the payment.
            // Show a visible success state before removing the card.
            setConfirmingId(null);
            setConfirmedId(request.id);

            await new Promise((resolve) => setTimeout(resolve, 1200));

            setRequests((current) =>
                current.filter((item) => item.id !== request.id),
            );

            setConfirmedId(null);
        } catch (error: any) {
            console.log("Confirm payment error:", error);

            if (Platform.OS === "web") {
                window.alert(
                    error?.message ||
                        t("paymentRequests.couldNotConfirmPayment"),
                );
            } else {
                Alert.alert(
                    t("paymentRequests.couldNotConfirmPayment"),
                    error?.message || t("paymentRequests.pleaseTryAgain"),
                );
            }
        } finally {
            setConfirmingId(null);
        }
    }

    function formatSubmittedAt(value: string | null) {
        if (!value) {
            return t("paymentRequests.recentlySubmitted");
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return t("paymentRequests.recentlySubmitted");
        }

        return date.toLocaleString();
    }

    if (loading) {
        return (
            <SafeAreaView style={styles.safeArea} edges={["top"]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />

                    <Text style={styles.loadingText}>
                        {t("paymentRequests.loading")}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
            <View style={styles.header}>
                <Pressable
                    style={styles.backButton}
                    onPress={() => router.replace("/(tabs)/profile")}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t("paymentRequests.goBack")}
                >
                    <Ionicons name="arrow-back" size={20} color="#00B77A" />

                    <Text style={styles.backText}>
                        {t("paymentRequests.back")}
                    </Text>
                </Pressable>

                <Text style={styles.title}>{t("paymentRequests.title")}</Text>

                <Text style={styles.subtitle}>
                    {t("paymentRequests.subtitle")}
                </Text>
            </View>

            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={COLORS.primary}
                    />
                }
            >
                {requests.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <View style={styles.emptyIcon}>
                            <Ionicons
                                name="checkmark-circle-outline"
                                size={34}
                                color={COLORS.primary}
                            />
                        </View>

                        <Text style={styles.emptyTitle}>
                            {t("paymentRequests.noRequests")}
                        </Text>

                        <Text style={styles.emptyText}>
                            {t("paymentRequests.noRequestsDescription")}
                        </Text>
                    </View>
                ) : (
                    requests.map((request) => {
                        const isConfirming = confirmingId === request.id;
                        const isConfirmed = confirmedId === request.id;

                        return (
                            <View key={request.id} style={styles.card}>
                                <View style={styles.cardTop}>
                                    <View style={styles.gameIcon}>
                                        <Ionicons
                                            name="football-outline"
                                            size={22}
                                            color={COLORS.primary}
                                        />
                                    </View>

                                    <View style={styles.gameInfo}>
                                        <Text style={styles.gameTitle}>
                                            {request.game_title}
                                        </Text>

                                        <Text style={styles.submittedText}>
                                            {formatSubmittedAt(
                                                request.submitted_at,
                                            )}
                                        </Text>
                                    </View>

                                    <View style={styles.statusBadge}>
                                        <Text style={styles.statusText}>
                                            {t("paymentRequests.submitted")}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.divider} />

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>
                                        {t("paymentRequests.player")}
                                    </Text>

                                    <Text style={styles.detailValue}>
                                        {request.player_name}
                                    </Text>
                                </View>

                                {request.player_phone ? (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>
                                            {t("paymentRequests.phone")}
                                        </Text>

                                        <Text style={styles.detailValue}>
                                            {request.player_phone}
                                        </Text>
                                    </View>
                                ) : null}

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>
                                        {t("paymentRequests.method")}
                                    </Text>

                                    <Text style={styles.detailValue}>
                                        {request.provider ||
                                            t(
                                                "paymentRequests.organizerPayment",
                                            )}
                                    </Text>
                                </View>

                                <View style={styles.amountRow}>
                                    <View>
                                        <Text style={styles.amountLabel}>
                                            {t(
                                                "paymentRequests.amountToVerify",
                                            )}
                                        </Text>

                                        <Text style={styles.amount}>
                                            {request.amount} {request.currency}
                                        </Text>
                                    </View>

                                    <Ionicons
                                        name="wallet-outline"
                                        size={27}
                                        color={COLORS.primary}
                                    />
                                </View>

                                <View style={styles.warningBox}>
                                    <Ionicons
                                        name="information-circle-outline"
                                        size={20}
                                        color="#9A6700"
                                    />

                                    <Text style={styles.warningText}>
                                        {t(
                                            "paymentRequests.checkAccountBeforeConfirming",
                                        ).replace(
                                            "{provider}",
                                            request.provider ||
                                                t(
                                                    "paymentRequests.paymentFallback",
                                                ),
                                        )}
                                    </Text>
                                </View>

                                <Pressable
                                    style={[
                                        styles.confirmButton,
                                        isConfirming && styles.confirmingButton,
                                        isConfirmed && styles.confirmedButton,
                                    ]}
                                    onPress={() => handleMarkPaid(request)}
                                    disabled={isConfirming || isConfirmed}
                                >
                                    {isConfirmed ? (
                                        <>
                                            <Ionicons
                                                name="checkmark-circle"
                                                size={21}
                                                color="#087A35"
                                            />

                                            <Text
                                                style={
                                                    styles.confirmedButtonText
                                                }
                                            >
                                                {t(
                                                    "paymentRequests.paymentConfirmed",
                                                )}
                                            </Text>
                                        </>
                                    ) : isConfirming ? (
                                        <>
                                            <ActivityIndicator
                                                size="small"
                                                color="#F7F8FA"
                                            />

                                            <Text
                                                style={
                                                    styles.confirmingButtonText
                                                }
                                            >
                                                {t(
                                                    "paymentRequests.confirming",
                                                )}
                                            </Text>
                                        </>
                                    ) : (
                                        <>
                                            <Ionicons
                                                name="checkmark-circle"
                                                size={20}
                                                color="#F7F8FA"
                                            />

                                            <Text
                                                style={styles.confirmButtonText}
                                            >
                                                {t("paymentRequests.markPaid")}
                                            </Text>
                                        </>
                                    )}
                                </Pressable>
                            </View>
                        );
                    })
                )}

                <View style={{ height: 30 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,

        backgroundColor: "#F7F8FA",
    },

    header: {
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: "#33433C",
    },

    backButton: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingVertical: 6,
        marginBottom: 10,
    },

    backText: {
        color: "#00B77A",
        fontSize: 14,
        fontWeight: "600",
    },

    title: {
        color: "#14201B",
        fontSize: 32,
        fontWeight: "800",
        letterSpacing: -0.8,
    },

    subtitle: {
        color: "#66766F",
        fontSize: 15,
        marginTop: 3,
    },

    container: {
        flex: 1,
    },

    content: {
        padding: 20,
    },

    loadingContainer: {
        flex: 1,

        alignItems: "center",

        justifyContent: "center",
    },

    loadingText: {
        color: "#66766F",

        fontSize: 14,

        marginTop: 12,
    },

    emptyCard: {
        marginTop: 60,

        alignItems: "center",

        paddingHorizontal: 30,
    },

    emptyIcon: {
        width: 68,

        height: 68,

        borderRadius: 34,

        backgroundColor: "#F0F5F3",

        borderWidth: 1,

        borderColor: "#F0F5F3",

        alignItems: "center",

        justifyContent: "center",
    },

    emptyTitle: {
        color: "#14201B",

        fontSize: 19,

        fontWeight: "700",

        marginTop: 16,
    },

    emptyText: {
        color: "#66766F",

        fontSize: 14,

        lineHeight: 21,

        textAlign: "center",

        marginTop: 7,
    },

    card: {
        backgroundColor: "#F7F8FA",

        borderWidth: 1,

        borderColor: "#DDE6E2",

        borderRadius: 16,

        padding: 16,

        marginBottom: 14,
    },

    cardTop: {
        flexDirection: "row",

        alignItems: "center",
    },

    gameIcon: {
        width: 40,

        height: 40,

        borderRadius: 12,

        backgroundColor: "#F0F5F3",

        alignItems: "center",

        justifyContent: "center",

        marginRight: 11,
    },

    gameInfo: {
        flex: 1,
    },

    gameTitle: {
        color: "#14201B",

        fontSize: 17,

        fontWeight: "700",
    },

    submittedText: {
        color: "#66766F",

        fontSize: 11,

        marginTop: 3,
    },

    statusBadge: {
        paddingHorizontal: 9,

        paddingVertical: 6,

        borderRadius: 20,

        backgroundColor: "#F7F8FA8E7",

        borderWidth: 1,

        borderColor: "#765A00",
    },

    statusText: {
        color: "#9A6700",

        fontSize: 11,

        fontWeight: "800",
    },

    divider: {
        height: 1,

        backgroundColor: "#33433C",

        marginVertical: 15,
    },

    detailRow: {
        flexDirection: "row",

        alignItems: "center",

        justifyContent: "space-between",

        marginBottom: 11,

        gap: 15,
    },

    detailLabel: {
        color: "#66766F",

        fontSize: 13,
    },

    detailValue: {
        flex: 1,

        color: "#14201B",

        fontSize: 14,

        fontWeight: "600",

        textAlign: "right",
    },

    amountRow: {
        minHeight: 70,

        borderRadius: 13,

        backgroundColor: "#FFFFFF",

        paddingHorizontal: 14,

        paddingVertical: 12,

        marginTop: 4,

        flexDirection: "row",

        alignItems: "center",

        justifyContent: "space-between",
    },

    amountLabel: {
        color: "#66766F",

        fontSize: 12,
    },

    amount: {
        color: "#14201B",

        fontSize: 23,

        fontWeight: "800",

        marginTop: 3,
    },

    warningBox: {
        flexDirection: "row",

        alignItems: "flex-start",

        gap: 9,

        backgroundColor: "#F7F8FA8E7",

        borderWidth: 1,

        borderColor: "#765A00",

        borderRadius: 13,

        padding: 12,

        marginTop: 13,
    },

    warningText: {
        flex: 1,

        color: "#8A6500",

        fontSize: 12,

        lineHeight: 18,
    },

    confirmButton: {
        height: 50,

        borderRadius: 14,

        backgroundColor: COLORS.primary,

        alignItems: "center",

        justifyContent: "center",

        flexDirection: "row",

        gap: 8,

        marginTop: 14,
    },

    confirmButtonText: {
        color: "#F7F8FA",

        fontSize: 15,

        fontWeight: "700",
    },

    confirmingButton: {
        backgroundColor: "#16A34A",
    },

    confirmingButtonText: {
        color: "#F7F8FA",

        fontSize: 15,

        fontWeight: "700",
    },

    confirmedButton: {
        backgroundColor: "#F0F5F3",

        borderWidth: 1,

        borderColor: "#86D5A3",
    },

    confirmedButtonText: {
        color: "#087A35",

        fontSize: 15,

        fontWeight: "800",
    },
});
