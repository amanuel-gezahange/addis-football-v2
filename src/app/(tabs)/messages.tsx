import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../constants/colors";
import { supabase } from "../../lib/supabase";

type FilterType = "all" | "friends" | "organizers";

export default function Messages() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");

  const { width } = useWindowDimensions();

  const isDesktopWeb =
    Platform.OS === "web" && width >= 900;

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setItems([]);
        return;
      }

      const { data: cs, error: conversationsError } =
        await supabase
          .from("conversations")
          .select(
            "id,user_a,user_b,game_id,kind,updated_at",
          )
          .or(
            `user_a.eq.${user.id},user_b.eq.${user.id}`,
          )
          .order("updated_at", {
            ascending: false,
          });

      if (conversationsError) {
        console.log(
          "Messages conversations error:",
          conversationsError.message,
        );

        setItems([]);
        return;
      }

      const otherIds = [
        ...new Set(
          (cs ?? []).map((c: any) =>
            c.user_a === user.id
              ? c.user_b
              : c.user_a,
          ),
        ),
      ];

      const { data: ps, error: profilesError } =
        otherIds.length
          ? await supabase
              .from("profiles")
              .select(
                "id,full_name,avatar_url",
              )
              .in("id", otherIds)
          : {
              data: [],
              error: null,
            };

      if (profilesError) {
        console.log(
          "Messages profiles error:",
          profilesError.message,
        );
      }

      const profileMap = new Map(
        (ps ?? []).map((p: any) => [
          p.id,
          p,
        ]),
      );

      const nextItems = (cs ?? []).map(
        (c: any) => {
          const otherUserId =
            c.user_a === user.id
              ? c.user_b
              : c.user_a;

          return {
            ...c,
            other: profileMap.get(otherUserId),
          };
        },
      );

      setItems(nextItems);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filteredItems = useMemo(() => {
    if (filter === "organizers") {
      return items.filter(
        (item) => item.kind === "organizer",
      );
    }

    if (filter === "friends") {
      return items.filter(
        (item) => item.kind !== "organizer",
      );
    }

    return items;
  }, [items, filter]);

  function emptyTitle() {
    if (filter === "friends") {
      return "No friend messages yet";
    }

    if (filter === "organizers") {
      return "No organizer messages yet";
    }

    return "No messages yet";
  }

  function emptyDescription() {
    if (filter === "friends") {
      return "Your conversations with friends will appear here.";
    }

    if (filter === "organizers") {
      return "Your conversations with game organizers will appear here.";
    }

    return "Friend and organizer chats will appear here.";
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top"]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          isDesktopWeb &&
            styles.contentDesktop,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Messages
          </Text>
        </View>

        {/* FILTERS */}
        <View style={styles.filters}>
          <FilterButton
            title="All"
            active={filter === "all"}
            onPress={() => setFilter("all")}
          />

          <FilterButton
            title="Friends"
            active={filter === "friends"}
            onPress={() =>
              setFilter("friends")
            }
          />

          <FilterButton
            title="Organizers"
            active={filter === "organizers"}
            onPress={() =>
              setFilter("organizers")
            }
          />
        </View>

        {/* CONTENT */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
            />

            <Text style={styles.loadingText}>
              Loading messages...
            </Text>
          </View>
        ) : filteredItems.length > 0 ? (
          <View style={styles.messagesCard}>
            {filteredItems.map(
              (conversation, index) => (
                <View key={conversation.id}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.row,
                      pressed &&
                        styles.rowPressed,
                    ]}
                    onPress={() =>
                      router.push({
                        pathname:
                          "/messages/[id]",
                        params: {
                          id: String(
                            conversation.id,
                          ),
                        },
                      } as any)
                    }
                  >
                    {/* AVATAR */}
                    {conversation.other
                      ?.avatar_url ? (
                      <Image
                        source={{
                          uri: conversation
                            .other.avatar_url,
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
                          size={23}
                          color={COLORS.primary}
                        />
                      </View>
                    )}

                    {/* TEXT */}
                    <View
                      style={
                        styles.conversationContent
                      }
                    >
                      <View style={styles.line}>
                        <Text
                          style={styles.name}
                          numberOfLines={1}
                        >
                          {conversation.other
                            ?.full_name ||
                            "Conversation"}
                        </Text>

                        {conversation.kind ===
                          "organizer" && (
                          <View
                            style={
                              styles.organizerBadge
                            }
                          >
                            <Text
                              style={
                                styles.organizerBadgeText
                              }
                            >
                              Organizer
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text
                        style={styles.preview}
                        numberOfLines={1}
                      >
                        {conversation.kind ===
                        "organizer"
                          ? "Game organizer conversation"
                          : "Open conversation"}
                      </Text>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={
                        COLORS.textSecondary
                      }
                    />
                  </Pressable>

                  {index !==
                    filteredItems.length -
                      1 && (
                    <View
                      style={styles.divider}
                    />
                  )}
                </View>
              ),
            )}
          </View>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="chatbubbles-outline"
                size={36}
                color={COLORS.textSecondary}
              />
            </View>

            <Text style={styles.emptyTitle}>
              {emptyTitle()}
            </Text>

            <Text
              style={styles.emptyDescription}
            >
              {emptyDescription()}
            </Text>
          </View>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

type FilterButtonProps = {
  title: string;
  active: boolean;
  onPress: () => void;
};

function FilterButton({
  title,
  active,
  onPress,
}: FilterButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterButton,
        active &&
          styles.filterButtonActive,
        pressed &&
          styles.filterButtonPressed,
      ]}
    >
      <Text
        style={[
          styles.filterText,
          active &&
            styles.filterTextActive,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
  },

  contentDesktop: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 24,
  },

  /* HEADER */

  header: {
    marginBottom: 18,
  },

  title: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.8,
  },

  /* FILTERS */

  filters: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },

  filterButton: {
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },

  filterButtonActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },

  filterButtonPressed: {
    opacity: 0.75,
  },

  filterText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },

  filterTextActive: {
    color: COLORS.primaryPressed,
    fontWeight: "900",
  },

  /* LOADING */

  loadingContainer: {
    flex: 1,
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 12,
  },

  /* MESSAGES */

  messagesCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    overflow: "hidden",
    paddingHorizontal: 15,
  },

  row: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  rowPressed: {
    opacity: 0.7,
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
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },

  conversationContent: {
    flex: 1,
    minWidth: 0,
  },

  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  name: {
    flexShrink: 1,
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 15,
  },

  organizerBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: COLORS.primarySoft,
  },

  organizerBadgeText: {
    color: COLORS.primaryPressed,
    fontSize: 10,
    fontWeight: "800",
  },

  preview: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginLeft: 60,
  },

  /* EMPTY STATE */

  empty: {
    flex: 1,
    minHeight: 360,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 80,
  },

  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },

  emptyDescription: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
    maxWidth: 320,
  },

  bottomSpace: {
    height: 30,
  },
});