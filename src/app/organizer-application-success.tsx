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
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.successIcon}>
            <Ionicons
              name="checkmark-circle"
              size={32}
              color={COLORS.primary}
            />
          </View>

          <Text style={styles.title}>
            Organizer access activated
          </Text>

          <Text style={styles.description}>
            You're ready to create and manage games on Addis Football.
          </Text>
        </View>

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
            size={20}
            color={COLORS.primary}
          />

          <Text style={styles.infoText}>
            Players can now discover and join the games you publish.
          </Text>
        </View>

        {/* CTA */}
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
            color={COLORS.white}
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
          size={20}
          color={COLORS.primary}
        />
      </View>

      <Text style={styles.statusText}>
        {title}
      </Text>

      <Ionicons
        name="checkmark"
        size={19}
        color={COLORS.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 28,
  },

  header: {
    alignItems: "center",
    marginBottom: 26,
  },

  successIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF8F2",
    marginBottom: 16,
  },

  title: {
    color: COLORS.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.4,
  },

  description: {
    maxWidth: 390,
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 8,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    overflow: "hidden",
  },

  statusRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  statusIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF8F2",
  },

  statusText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginLeft: 50,
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "#F2FAF7",
    borderWidth: 1,
    borderColor: "#DCEFE7",
  },

  infoText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },

  button: {
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 18,
  },

  buttonText: {
    color: COLORS.white,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "800",
  },

  pressed: {
    opacity: 0.85,
  },
});