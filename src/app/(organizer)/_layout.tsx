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

export default function OrganizerTabLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useLanguage();

  const isDesktopWeb = Platform.OS === "web" && width >= 900;
  const bottomInset = insets.bottom;

  return (
    <View style={styles.root}>
      {isDesktopWeb && (
        <View style={styles.brand}>
          <View style={styles.brandIcon}>
            <Ionicons name="football" size={25} color="#F7F8FA" />
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
          tabBarInactiveTintColor: "#718492",

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
                backgroundColor: "#0A1822",
                borderTopColor: "#DDE6E2",
                borderTopWidth: 1,
                height: 60 + bottomInset,
                paddingTop: 4,
                paddingBottom: bottomInset + 8,
                elevation: 0,
              },

          tabBarItemStyle: isDesktopWeb
            ? {
                width: "100%",
                maxHeight: 56,
                borderRadius: 12,
                marginVertical: 4,
              }
            : {
                paddingTop: 0,
              },

          tabBarIconStyle: isDesktopWeb
            ? {
                marginRight: 8,
              }
            : {
                marginTop: -3,
              },

          tabBarLabelStyle: isDesktopWeb
            ? {
                fontSize: 15,
                fontWeight: "700",
              }
            : {
                fontSize: 11,
                fontWeight: "700",
                marginTop: -2,
              },

          sceneStyle: {
            backgroundColor: "#F7F8FA",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t("organizerTabs.dashboard"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "grid" : "grid-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="games"
          options={{
            title: t("organizerTabs.games"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "football" : "football-outline"}
                size={23}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="players"
          options={{
            title: t("organizerTabs.players"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "people" : "people-outline"}
                size={23}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="account"
          options={{
            title: t("organizerTabs.account"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "person" : "person-outline"}
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
    color: "#F7F8FA",
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 16,
    letterSpacing: 0.7,
  },
});