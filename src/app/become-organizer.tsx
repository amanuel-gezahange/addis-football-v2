import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../constants/colors";

export default function BecomeOrganizerScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.replace("/settings")}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
        >
          <Text style={styles.backArrow}>←</Text>
        </Pressable>

        <Text style={styles.headerTitle}>
          Become an Organizer
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <View style={styles.heroIcon}>
          <Ionicons
            name="football-outline"
            size={38}
            color={COLORS.primary}
          />
        </View>

        <Text style={styles.title}>
          Bring your games to Addis Football
        </Text>

        <Text style={styles.description}>
          Create games, manage players, and reach footballers looking for games
          around Addis Ababa.
        </Text>

        {/* BENEFITS */}
        <View style={styles.card}>
          <Benefit
            icon="people-outline"
            title="Reach more players"
            subtitle="Help fill open spots in your games."
          />

          <View style={styles.divider} />

          <Benefit
            icon="calendar-outline"
            title="Manage games easily"
            subtitle="Keep your upcoming games in one place."
          />

          <View style={styles.divider} />

          <Benefit
            icon="checkmark-circle-outline"
            title="Track who's joining"
            subtitle="See players and manage your game list."
          />

          <View style={styles.divider} />

          <Benefit
            icon="wallet-outline"
            title="Keep your payments"
            subtitle="Players pay you directly using your preferred method."
          />
        </View>

        {/* FREE */}
        <View style={styles.freeBox}>
          <Ionicons
            name="sparkles-outline"
            size={20}
            color={COLORS.primary}
          />

          <View style={styles.freeText}>
            <Text style={styles.freeTitle}>
              Free for organizers
            </Text>

            <Text style={styles.freeSubtitle}>
              No subscription and no fee per game.
            </Text>
          </View>
        </View>

        {/* APPLY */}
        <Pressable
          style={({ pressed }) => [
            styles.applyButton,
            pressed && styles.pressed,
          ]}
          onPress={() =>
            router.push("/organizer-application")
          }
          accessibilityRole="button"
          accessibilityLabel="Apply to Organize"
        >
          <Text style={styles.applyButtonText}>
            Apply to Organize
          </Text>

          <Ionicons
            name="arrow-forward"
            size={20}
            color={COLORS.white}
          />
        </Pressable>

        <Text style={styles.footer}>
          The application takes about a minute.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

type BenefitProps = {
  icon:
    | "people-outline"
    | "calendar-outline"
    | "checkmark-circle-outline"
    | "wallet-outline";
  title: string;
  subtitle: string;
};

function Benefit({
  icon,
  title,
  subtitle,
}: BenefitProps) {
  return (
    <View style={styles.benefit}>
      <View style={styles.benefitIcon}>
        <Ionicons
          name={icon}
          size={21}
          color={COLORS.primary}
        />
      </View>

      <View style={styles.benefitText}>
        <Text style={styles.benefitTitle}>
          {title}
        </Text>

        <Text style={styles.benefitSubtitle}>
          {subtitle}
        </Text>
      </View>
    </View>
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

  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  backArrow: {
    color: COLORS.text,
    fontSize: 32,
    lineHeight: 34,
    fontWeight: "400",
  },

  headerTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
  },

  headerSpacer: {
    width: 40,
  },

  content: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 40,
  },

  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 20,
  },

  title: {
    color: COLORS.text,
    fontSize: 26,
    lineHeight: 33,
    fontWeight: "900",
    textAlign: "center",
    paddingHorizontal: 12,
  },

  description: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 27,
    paddingHorizontal: 10,
  },

  card: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 15,
  },

  benefit: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },

  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },

  benefitText: {
    flex: 1,
  },

  benefitTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },

  benefitSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    marginTop: 3,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginLeft: 53,
  },

  freeBox: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 183, 122, 0.22)",
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  freeText: {
    flex: 1,
  },

  freeTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },

  freeSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },

  applyButton: {
    height: 54,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },

  applyButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "900",
  },

  footer: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 11,
  },

  pressed: {
    opacity: 0.7,
  },
});