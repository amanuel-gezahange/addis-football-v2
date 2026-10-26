import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../constants/colors";

export default function OrganizerApplicationSuccessScreen() {
  function goToOrganizerDashboard() {
    router.replace("/(organizer)");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* SUCCESS ICON */}
        <View style={styles.successIcon}>
          <Ionicons
            name="checkmark"
            size={46}
            color="#00B77A"
          />
        </View>

        {/* TITLE */}
        <Text style={styles.title}>
          You're now an Organizer!
        </Text>

        <Text style={styles.description}>
          Your organizer account is ready. You can start creating games and
          reaching players on Addis Football.
        </Text>

        {/* STATUS CARD */}
        <View style={styles.card}>
          <StatusRow
            icon="checkmark-circle-outline"
            title="Application submitted"
          />

          <View style={styles.divider} />

          <StatusRow
            icon="shield-checkmark-outline"
            title="Organizer access activated"
          />

          <View style={styles.divider} />

          <StatusRow
            icon="football-outline"
            title="Ready to create games"
          />
        </View>

        {/* INFO */}
        <View style={styles.infoBox}>
          <Ionicons
            name="information-circle-outline"
            size={21}
            color={COLORS.primary}
          />

          <Text style={styles.infoText}>
            Players will be able to discover and join the games you publish.
          </Text>
        </View>

        {/* BUTTON */}
        <Pressable
          onPress={goToOrganizerDashboard}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.buttonText}>
            Go to Organizer Dashboard
          </Text>

          <Ionicons
            name="arrow-forward"
            size={20}
            color="#F7F8FA"
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

type StatusRowProps = {
  icon:
    | "checkmark-circle-outline"
    | "shield-checkmark-outline"
    | "football-outline";
  title: string;
};

function StatusRow({
  icon,
  title,
}: StatusRowProps) {
  return (
    <View style={styles.statusRow}>
      <View style={styles.statusIcon}>
        <Ionicons
          name={icon}
          size={21}
          color="#00B77A"
        />
      </View>

      <Text style={styles.statusText}>
        {title}
      </Text>

      <Ionicons
        name="checkmark"
        size={20}
        color="#00B77A"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  container: {
    flex: 1,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(73, 211, 154, 0.09)",
    borderWidth: 1,
    borderColor: "rgba(73, 211, 154, 0.35)",
    marginBottom: 25,
  },

  title: {
    color: "#F7F8FA",
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "900",
    textAlign: "center",
  },

  description: {
    color: "#66766F",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 28,
    paddingHorizontal: 8,
  },

  card: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    paddingHorizontal: 16,
  },

  statusRow: {
    minHeight: 67,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  statusIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(73, 211, 154, 0.08)",
  },

  statusText: {
    flex: 1,
    color: "#E7EEF2",
    fontSize: 14,
    fontWeight: "800",
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#D7E2DD",
    marginLeft: 50,
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginTop: 16,
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderRadius: 15,
    backgroundColor: "#0A1C27",
    borderWidth: 1,
    borderColor: "#DDE6E2",
  },

  infoText: {
    flex: 1,
    color: "#66766F",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  button: {
    height: 54,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },

  buttonText: {
    color: "#F7F8FA",
    fontSize: 16,
    fontWeight: "900",
  },

  pressed: {
    opacity: 0.7,
  },
});