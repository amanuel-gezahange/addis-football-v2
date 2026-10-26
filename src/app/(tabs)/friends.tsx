import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
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

type Friend = {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
};
export default function FriendsScreen() {
    const [friends, setFriends] = useState<Friend[]>([]);
    const [q, setQ] = useState("");
    const [loading, setLoading] = useState(true);
    const load = useCallback(async () => {
        setLoading(true);
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            setLoading(false);
            return;
        }
        const { data: rels } = await supabase
            .from("friendships")
            .select("requester_id,addressee_id")
            .eq("status", "accepted")
            .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
        const ids = (rels ?? []).map((r: any) =>
            r.requester_id === user.id ? r.addressee_id : r.requester_id,
        );
        if (!ids.length) {
            setFriends([]);
            setLoading(false);
            return;
        }
        const { data } = await supabase
            .from("profiles")
            .select("id,full_name,avatar_url,phone")
            .in("id", ids);
        setFriends((data ?? []) as Friend[]);
        setLoading(false);
    }, []);
    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );
    const filtered = useMemo(
        () =>
            friends.filter(
                (f) =>
                    (f.full_name ?? "")
                        .toLowerCase()
                        .includes(q.toLowerCase()) ||
                    (f.phone ?? "").includes(q),
            ),
        [friends, q],
    );
    return (
        <SafeAreaView style={s.safe}>
            <View style={s.head}>
                <Text style={s.title}>Friends</Text>
                <Pressable
                    onPress={() => router.push("/friends/add" as any)}
                    style={s.add}
                >
                    <Ionicons name="add" size={25} />
                </Pressable>
            </View>
            <View style={s.search}>
                <Ionicons name="search" size={18} color="#66766F" />
                <TextInput
                    value={q}
                    onChangeText={setQ}
                    placeholder="Search friends by name or phone"
                    style={s.input}
                />
            </View>
            {loading ? (
                <ActivityIndicator
                    style={{ marginTop: 40 }}
                    color={COLORS.primary}
                />
            ) : (
                <ScrollView contentContainerStyle={s.list}>
                    {filtered.map((f) => (
                        <Pressable
                            key={f.id}
                            style={s.row}
                            onPress={() =>
                                router.push({
                                    pathname: "/friends/[id]",
                                    params: { id: f.id },
                                } as any)
                            }
                        >
                            {f.avatar_url ? (
                                <Image
                                    source={{ uri: f.avatar_url }}
                                    style={s.avatar}
                                />
                            ) : (
                                <View style={s.avatarFallback}>
                                    <Ionicons name="person" size={22} />
                                </View>
                            )}
                            <View style={{ flex: 1 }}>
                                <Text style={s.name}>
                                    {f.full_name || "Player"}
                                </Text>
                                <Text style={s.online}>Friend</Text>
                            </View>
                            <Ionicons
                                name="chevron-forward"
                                size={20}
                                color="#66766F"
                            />
                        </Pressable>
                    ))}
                    {!filtered.length && (
                        <View style={s.empty}>
                            <Ionicons
                                name="people-outline"
                                size={40}
                                color="#66766F"
                            />
                            <Text style={s.emptyTitle}>
                                Your friends will appear here
                            </Text>
                            <Pressable
                                style={s.primary}
                                onPress={() =>
                                    router.push("/friends/add" as any)
                                }
                            >
                                <Text style={s.primaryText}>Add a friend</Text>
                            </Pressable>
                        </View>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}
const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#F7F8FA", paddingHorizontal: 18 },
    head: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 8,
        paddingBottom: 14,
    },
    title: { fontSize: 30, fontWeight: "800", color: "#14201B" },
    add: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#F0F5F3",
        alignItems: "center",
        justifyContent: "center",
    },
    search: {
        height: 46,
        borderWidth: 1,
        borderColor: "#DDE6E2",
        borderRadius: 13,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 13,
        backgroundColor: "#FFFFFF",
    },
    input: { flex: 1, marginLeft: 8, fontSize: 15 },
    list: { paddingTop: 12, paddingBottom: 30 },
    row: {
        minHeight: 68,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#F0F5F3",
    },
    avatar: { width: 46, height: 46, borderRadius: 23 },
    avatarFallback: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: "#DDE6E2",
        alignItems: "center",
        justifyContent: "center",
    },
    name: { fontSize: 16, fontWeight: "700", color: "#14201B" },
    online: { fontSize: 13, color: COLORS.primary, marginTop: 2 },
    empty: { alignItems: "center", paddingTop: 70, gap: 12 },
    emptyTitle: { fontSize: 17, fontWeight: "700", color: "#14201B" },
    primary: {
        marginTop: 8,
        backgroundColor: COLORS.primary,
        paddingHorizontal: 24,
        paddingVertical: 13,
        borderRadius: 14,
    },
    primaryText: { color: "#14201B", fontWeight: "800" },
});
