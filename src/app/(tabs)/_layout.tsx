import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import {
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS } from "../../constants/colors";
import { useLanguage } from "../../i18n/LanguageContext";

export default function TabLayout() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isDesktopWeb = Platform.OS === "web" && width >= 900;

  // Native devices use the real safe-area inset.
  // Mobile web gets a little extra breathing room
  // so labels are never clipped.
  const bottomInset =
    Platform.OS === "web" ? 0 : insets.bottom;

  return (
    <View style={styles.root}>
      {/* Desktop web branding */}
      {isDesktopWeb && (
        <View style={styles.brand}>
          <View style={styles.brandIcon}>
            <Ionicons
              name="football"
              size={25}
              color="#F7F8FA"
            />
          </View>

          <View>
            <Text style={styles.brandTitle}>ADDIS</Text>
            <Text style={styles.brandTitle}>FOOTBALL</Text>
          </View>
        </View>
      )}

      <Tabs
        screenOptions={{
          headerShown: false,

          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: "#66766F",

          tabBarPosition: isDesktopWeb ? "left" : "bottom",

          tabBarStyle: isDesktopWeb
            ? {
                backgroundColor: "#F7F8FA",

                borderRightColor: "#DDE6E2",
                borderRightWidth: 1,
                borderTopWidth: 0,

                width: 230,

                paddingTop: 120,
                paddingHorizontal: 14,
              }
            : {
                backgroundColor: "#F7F8FA",

                borderTopColor: "#DDE6E2",
                borderTopWidth: StyleSheet.hairlineWidth,

                // More room for both icon + label.
                height: 72 + bottomInset,

                paddingTop: 8,
                paddingBottom:
                  Platform.OS === "web"
                    ? 8
                    : Math.max(bottomInset, 6),

                elevation: 0,
                shadowColor: "transparent",
              },

          tabBarItemStyle: isDesktopWeb
            ? {
                width: "100%",
                maxHeight: 56,
                borderRadius: 12,
                marginVertical: 4,
              }
            : {
                height: 56,
                paddingTop: 2,
                paddingBottom: 2,
              },

          tabBarIconStyle: isDesktopWeb
            ? {
                marginRight: 8,
              }
            : {
                marginTop: 0,
                marginBottom: 2,
              },

          tabBarLabelStyle: isDesktopWeb
            ? {
                fontSize: 15,
                fontWeight: "700",
              }
            : {
                fontSize: 11,
                fontWeight: "600",
                lineHeight: 14,
                marginTop: 0,
                marginBottom: 0,
              },

          sceneStyle: {
            backgroundColor: "#F7F8FA",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t("tabs.games"),

            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={
                  focused
                    ? "football"
                    : "football-outline"
                }
                size={23}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="bookings"
          options={{
            title: t("tabs.bookings"),

            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={
                  focused
                    ? "calendar"
                    : "calendar-outline"
                }
                size={23}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="friends"
          options={{
            title: "Friends",

            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={
                  focused
                    ? "people"
                    : "people-outline"
                }
                size={23}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="messages"
          options={{
            title: "Messages",

            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={
                  focused
                    ? "chatbubbles"
                    : "chatbubbles-outline"
                }
                size={23}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: t("tabs.profile"),

            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={
                  focused
                    ? "person"
                    : "person-outline"
                }
                size={23}
                color={color}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  brand: {
    position: "absolute",
    top: 32,
    left: 22,
    zIndex: 100,

    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },

  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,

    backgroundColor: COLORS.primary,

    alignItems: "center",
    justifyContent: "center",
  },

  brandTitle: {
    color: "#14201B",
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 16,
    letterSpacing: 0.7,
  },
});