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

import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../i18n/LanguageContext";

export default function TabLayout() {
  const { t } = useLanguage();
  const { colors } = useTheme();

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isDesktopWeb =
    Platform.OS === "web" && width >= 900;

  const bottomInset =
    Platform.OS === "web" ? 0 : insets.bottom;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      {/* Desktop web branding */}
      {isDesktopWeb && (
        <View style={styles.brand}>
          <View
            style={[
              styles.brandIcon,
              {
                backgroundColor:
                  colors.primary,
              },
            ]}
          >
            <Ionicons
              name="football"
              size={25}
              color={colors.white}
            />
          </View>

          <View>
            <Text
              style={[
                styles.brandTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              ADDIS
            </Text>

            <Text
              style={[
                styles.brandTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              FOOTBALL
            </Text>
          </View>
        </View>
      )}

      <Tabs
        screenOptions={{
          headerShown: false,

          tabBarActiveTintColor:
            colors.primary,

          tabBarInactiveTintColor:
            colors.textSecondary,

          tabBarPosition: isDesktopWeb
            ? "left"
            : "bottom",

          tabBarStyle: isDesktopWeb
            ? {
                backgroundColor:
                  colors.background,

                borderRightColor:
                  colors.border,
                borderRightWidth: 1,
                borderTopWidth: 0,

                width: 230,

                paddingTop: 120,
                paddingHorizontal: 14,
              }
            : {
                backgroundColor:
                  colors.background,

                borderTopColor:
                  colors.border,
                borderTopWidth:
                  StyleSheet.hairlineWidth,

                height: 72 + bottomInset,

                paddingTop: 8,

                paddingBottom:
                  Platform.OS === "web"
                    ? 8
                    : Math.max(
                        bottomInset,
                        6,
                      ),

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
            backgroundColor:
              colors.background,
          },
        }}
      >
        {/* GAMES */}
        <Tabs.Screen
          name="index"
          options={{
            title: t("tabs.games"),

            tabBarIcon: ({
              color,
              focused,
            }) => (
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

        {/* BOOKINGS */}
        <Tabs.Screen
          name="bookings"
          options={{
            title: t("tabs.bookings"),

            tabBarIcon: ({
              color,
              focused,
            }) => (
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

        {/* PROFILE */}
        <Tabs.Screen
          name="profile"
          options={{
            title: t("tabs.profile"),

            tabBarIcon: ({
              color,
              focused,
            }) => (
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

        {/* Keep Friends route, but hide it */}
        <Tabs.Screen
          name="friends"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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

    alignItems: "center",
    justifyContent: "center",
  },

  brandTitle: {
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 16,
    letterSpacing: 0.7,
  },
});