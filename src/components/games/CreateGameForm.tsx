import { useState } from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../constants/colors";
import { useLanguage } from "../../i18n/LanguageContext";
import { supabase } from "../../lib/supabase";

type PaymentMethod = "free" | "venue" | "organizer";

type CreateGameFormProps = {
  organizerName?: string;
  allowOrganizerEditing?: boolean;
  onBack: () => void;
  onSuccess: () => void;
};

export default function CreateGameForm({
  organizerName = "Addis Football",
  allowOrganizerEditing = true,
  onBack,
  onSuccess,
}: CreateGameFormProps) {
  const { t } = useLanguage();

  const [title, setTitle] = useState("");

  const [organizer, setOrganizer] = useState(organizerName);

  const [area, setArea] = useState("");

  const [city, setCity] = useState("Addis Ababa");

  const [mapsUrl, setMapsUrl] = useState("");

  const [distance, setDistance] = useState("");

  const [gameDate, setGameDate] = useState("");

  const [startTime, setStartTime] = useState("");

  const [endTime, setEndTime] = useState("");

  const [format, setFormat] = useState("");

  const [skill, setSkill] = useState("Intermediate");

  const [price, setPrice] = useState("");

  const [spots, setSpots] = useState("");

  const [imageUrl, setImageUrl] = useState("");

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("organizer");

  const [creating, setCreating] = useState(false);

  function showMessage(title: string, message: string) {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(`${title}\n\n${message}`);

      return;
    }

    Alert.alert(title, message);
  }

  function selectPaymentMethod(method: PaymentMethod) {
    setPaymentMethod(method);

    if (method === "free") {
      setPrice("0");
    }

    if (method !== "free" && price === "0") {
      setPrice("");
    }
  }

  function parseAddisDateTime(date: string, time: string) {
    const cleanDate = date.trim();

    const cleanTime = time.trim();

    const dateMatch = cleanDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!dateMatch) {
      return null;
    }

    const timeMatch = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

    if (!timeMatch) {
      return null;
    }

    const year = Number(dateMatch[1]);

    const month = Number(dateMatch[2]);

    const day = Number(dateMatch[3]);

    let hour = Number(timeMatch[1]);

    const minute = Number(timeMatch[2]);

    const period = timeMatch[3].toUpperCase();

    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hour < 1 ||
      hour > 12 ||
      minute < 0 ||
      minute > 59
    ) {
      return null;
    }

    if (period === "AM") {
      if (hour === 12) {
        hour = 0;
      }
    } else {
      if (hour !== 12) {
        hour += 12;
      }
    }

    const monthText = String(month).padStart(2, "0");

    const dayText = String(day).padStart(2, "0");

    const hourText = String(hour).padStart(2, "0");

    const minuteText = String(minute).padStart(2, "0");

    const isoString =
      `${year}-${monthText}-${dayText}` + `T${hourText}:${minuteText}:00+03:00`;

    const parsed = new Date(isoString);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  async function createGame() {
    if (
      !title.trim() ||
      !organizer.trim() ||
      !area.trim() ||
      !city.trim() ||
      !gameDate.trim() ||
      !startTime.trim() ||
      !endTime.trim() ||
      !format.trim() ||
      !skill.trim() ||
      !spots.trim()
    ) {
      showMessage(
        t("createGame.missingInformation"),
        t("createGame.completeRequiredFields"),
      );

      return;
    }

    if (paymentMethod !== "free" && !price.trim()) {
      showMessage(t("createGame.missingPrice"), t("createGame.enterGamePrice"));

      return;
    }



    const numericPrice = paymentMethod === "free" ? 0 : Number(price);

    const numericSpots = Number(spots);

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      showMessage(
        t("createGame.invalidPrice"),
        t("createGame.enterValidPrice"),
      );

      return;
    }

    if (paymentMethod !== "free" && numericPrice <= 0) {
      showMessage(
        t("createGame.invalidPrice"),
        t("createGame.paidPriceGreaterThanZero"),
      );

      return;
    }

    if (!Number.isInteger(numericSpots) || numericSpots < 1) {
      showMessage(
        t("createGame.invalidSpots"),
        t("createGame.enterAtLeastOneSpot"),
      );

      return;
    }

    const startDateTime = parseAddisDateTime(gameDate, startTime);

    const endDateTime = parseAddisDateTime(gameDate, endTime);

    if (!startDateTime) {
      showMessage(
        t("createGame.invalidStartTime"),
        t("createGame.startTimeFormatHelp"),
      );

      return;
    }

    if (!endDateTime) {
      showMessage(
        t("createGame.invalidEndTime"),
        t("createGame.endTimeFormatHelp"),
      );

      return;
    }

    if (endDateTime.getTime() <= startDateTime.getTime()) {
      showMessage(
        t("createGame.invalidGameTime"),
        t("createGame.endAfterStart"),
      );

      return;
    }

    const displayTime = `${startTime.trim()} to ` + `${endTime.trim()}`;

    try {
      setCreating(true);

      let organizerPayment = {
        accepts_telebirr: false,
        accepts_mobile_banking: false,
        telebirr_phone: null as string | null,
        telebirr_account_name: null as string | null,
        bank_name: null as string | null,
        bank_account_number: null as string | null,
        bank_account_name: null as string | null,
      };

      if (paymentMethod === "organizer") {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          showMessage(
            t("createGame.couldNotCreateGame"),
            "You must be logged in.",
          );
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select(
            "accepts_telebirr, accepts_mobile_banking, telebirr_phone, telebirr_account_name, bank_name, bank_account_number, bank_account_name",
          )
          .eq("id", user.id)
          .single();

        if (profileError) {
          showMessage(
            t("createGame.couldNotCreateGame"),
            profileError.message,
          );
          return;
        }

        if (!profile.accepts_telebirr && !profile.accepts_mobile_banking) {
          showMessage(
            "Payment setup required",
            "Add at least one payment method in your Account before creating a game with Pay Organizer Directly.",
          );
          return;
        }

        organizerPayment = {
          accepts_telebirr: Boolean(profile.accepts_telebirr),
          accepts_mobile_banking: Boolean(profile.accepts_mobile_banking),
          telebirr_phone: profile.telebirr_phone,
          telebirr_account_name: profile.telebirr_account_name,
          bank_name: profile.bank_name,
          bank_account_number: profile.bank_account_number,
          bank_account_name: profile.bank_account_name,
        };
      }

      const { error } = await supabase.rpc("create_game", {
        p_title: title.trim(),

        p_organizer: organizer.trim(),

        p_area: area.trim(),

        p_city: city.trim(),

        p_maps_url: mapsUrl.trim() || null,

        p_distance: distance.trim(),

        p_time: displayTime,

        p_format: format.trim(),

        p_skill: skill.trim(),

        p_price: numericPrice,

        p_spots_left: numericSpots,

        p_starts_at: startDateTime.toISOString(),

        p_ends_at: endDateTime.toISOString(),

        p_image_url: imageUrl.trim() || null,

        p_payment_method: paymentMethod,

        p_payment_provider:
          paymentMethod === "organizer" && organizerPayment.accepts_telebirr
            ? "Telebirr"
            : null,

        p_payment_phone:
          paymentMethod === "organizer" && organizerPayment.accepts_telebirr
            ? organizerPayment.telebirr_phone
            : null,

        p_payment_account_name:
          paymentMethod === "organizer" && organizerPayment.accepts_telebirr
            ? organizerPayment.telebirr_account_name
            : null,

        p_accepts_telebirr:
          paymentMethod === "organizer"
            ? organizerPayment.accepts_telebirr
            : false,

        p_accepts_mobile_banking:
          paymentMethod === "organizer"
            ? organizerPayment.accepts_mobile_banking
            : false,

        p_bank_name:
          paymentMethod === "organizer" &&
          organizerPayment.accepts_mobile_banking
            ? organizerPayment.bank_name
            : null,

        p_bank_account_number:
          paymentMethod === "organizer" &&
          organizerPayment.accepts_mobile_banking
            ? organizerPayment.bank_account_number
            : null,

        p_bank_account_name:
          paymentMethod === "organizer" &&
          organizerPayment.accepts_mobile_banking
            ? organizerPayment.bank_account_name
            : null,
      });

      if (error) {
        console.log("Create game error:", error.message);

        showMessage(t("createGame.couldNotCreateGame"), error.message);

        return;
      }

      onSuccess();
    } catch (error: any) {
      console.log("Create game error:", error);

      showMessage(
        t("createGame.couldNotCreateGame"),
        error?.message || t("createGame.createErrorFallback"),
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
        >
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backText}>← {t("createGame.back")}</Text>
          </Pressable>

          <Text style={styles.title}>{t("createGame.title")}</Text>

          <Text style={styles.subtitle}>{t("createGame.subtitle")}</Text>

          <Field
            label={t("createGame.gameTitle")}
            value={title}
            onChangeText={setTitle}
            placeholder={t("createGame.gameTitlePlaceholder")}
          />

          {allowOrganizerEditing && (
            <Field
              label={t("createGame.organizer")}
              value={organizer}
              onChangeText={setOrganizer}
              placeholder="Addis Football"
            />
          )}

          {!allowOrganizerEditing && (
            <View style={styles.organizerCard}>
              <Text style={styles.organizerLabel}>
                {t("createGame.organizer")}
              </Text>

              <Text style={styles.organizerValue}>{organizer}</Text>
            </View>
          )}

          <Field
            label={t("createGame.area")}
            value={area}
            onChangeText={setArea}
            placeholder={t("createGame.areaPlaceholder")}
          />

          <Field
            label={t("createGame.city")}
            value={city}
            onChangeText={setCity}
            placeholder={t("createGame.cityPlaceholder")}
          />

          <Field
            label={t("createGame.googleMapsLinkOptional")}
            value={mapsUrl}
            onChangeText={setMapsUrl}
            placeholder="https://maps.google.com/..."
            autoCapitalize="none"
          />

          <Field
            label={t("createGame.distance")}
            value={distance}
            onChangeText={setDistance}
            placeholder="2.5 km"
          />

          <View style={styles.scheduleSection}>
            <View style={styles.scheduleHeader}>
              <Text style={styles.scheduleTitle}>
                {t("createGame.gameSchedule")}
              </Text>

              <Text style={styles.timezoneBadge}>
                {t("createGame.timezone")}
              </Text>
            </View>

            <Text style={styles.scheduleHint}>
              {t("createGame.scheduleHint")}
            </Text>

            <Field
              label={t("createGame.gameDate")}
              value={gameDate}
              onChangeText={setGameDate}
              placeholder="2026-10-20"
              autoCapitalize="none"
            />

            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Field
                  label={t("createGame.startTime")}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="7:00 PM"
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.timeField}>
                <Field
                  label={t("createGame.endTime")}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="9:00 PM"
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </View>

          <Field
            label={t("createGame.format")}
            value={format}
            onChangeText={setFormat}
            placeholder="6v6"
          />

          <Field
            label={t("createGame.skillLevel")}
            value={skill}
            onChangeText={setSkill}
            placeholder={t("discover.intermediate")}
          />

          <View style={styles.paymentSection}>
            <Text style={styles.paymentTitle}>{t("createGame.payment")}</Text>

            <Text style={styles.paymentHint}>
              {t("createGame.paymentHint")}
            </Text>

            <PaymentOption
              title={t("createGame.free")}
              description={t("createGame.freeDescription")}
              selected={paymentMethod === "free"}
              onPress={() => selectPaymentMethod("free")}
            />

            <PaymentOption
              title={t("createGame.payAtVenue")}
              description={t("createGame.payAtVenueDescription")}
              selected={paymentMethod === "venue"}
              onPress={() => selectPaymentMethod("venue")}
            />

            <PaymentOption
              title={t("createGame.payOrganizerDirectly")}
              description={t("createGame.payOrganizerDescription")}
              selected={paymentMethod === "organizer"}
              onPress={() => selectPaymentMethod("organizer")}
            />
          </View>

          {paymentMethod !== "free" && (
            <Field
              label={t("createGame.priceEtb")}
              value={price}
              onChangeText={setPrice}
              placeholder="300"
              keyboardType="number-pad"
            />
          )}

          {paymentMethod === "organizer" && (
            <View style={styles.paymentDetails}>
              <Text style={styles.paymentDetailsTitle}>
                Uses your saved payment methods
              </Text>

              <Text style={styles.paymentDetailsHint}>
                Players will pay using the Telebirr or Mobile Banking details
                saved in your Account.
              </Text>
            </View>
          )}

          <Field
            label={t("createGame.availableSpots")}
            value={spots}
            onChangeText={setSpots}
            placeholder="12"
            keyboardType="number-pad"
          />

          <Field
            label={t("createGame.imageUrlOptional")}
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="https://..."
            autoCapitalize="none"
          />

          <Pressable
            style={[
              styles.createButton,
              creating && styles.createButtonDisabled,
            ]}
            onPress={createGame}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <Text style={styles.createButtonText}>
                {t("createGame.title")}
              </Text>
            )}
          </Pressable>

          <View style={styles.bottomSpace} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = {
  label: string;
  value: string;

  onChangeText: (value: string) => void;

  placeholder: string;

  keyboardType?: "default" | "number-pad" | "phone-pad";

  autoCapitalize?: "none" | "sentences" | "words" | "characters";
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  autoCapitalize = "sentences",
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6F8793"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

type PaymentOptionProps = {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
};

function PaymentOption({
  title,
  description,
  selected,
  onPress,
}: PaymentOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.paymentOption, selected && styles.paymentOptionSelected]}
    >
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>

      <View style={styles.paymentOptionText}>
        <Text
          style={[
            styles.paymentOptionTitle,

            selected && styles.paymentOptionTitleSelected,
          ]}
        >
          {title}
        </Text>

        <Text style={styles.paymentOptionDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}


const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  content: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
  },

  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    marginBottom: 10,
  },

  backText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "700",
  },

  title: {
    color: "#F7F8FA",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.8,
  },

  subtitle: {
    color: "#66766F",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 24,
  },

  field: {
    marginBottom: 16,
  },

  label: {
    color: "#C4D0D6",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 7,
  },

  input: {
    height: 52,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#DDE6E2",
    backgroundColor: "#FFFFFF",
    color: "#F7F8FA",
    fontSize: 15,
    paddingHorizontal: 14,
  },

  organizerCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    borderRadius: 13,
    padding: 14,
    marginBottom: 16,
  },

  organizerLabel: {
    color: "#66766F",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 5,
  },

  organizerValue: {
    color: "#F7F8FA",
    fontSize: 15,
    fontWeight: "800",
  },

  scheduleSection: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    borderRadius: 17,
    padding: 16,
    marginBottom: 18,
  },

  scheduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  scheduleTitle: {
    color: "#F7F8FA",
    fontSize: 17,
    fontWeight: "800",
  },

  timezoneBadge: {
    color: COLORS.primary,
    backgroundColor: "#F0F5F3",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 16,
    fontSize: 11,
    fontWeight: "800",
  },

  scheduleHint: {
    color: "#66766F",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 16,
  },

  timeRow: {
    flexDirection: "row",
    gap: 12,
  },

  timeField: {
    flex: 1,
  },

  paymentSection: {
    marginTop: 2,
    marginBottom: 18,
  },

  paymentTitle: {
    color: "#F7F8FA",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },

  paymentHint: {
    color: "#66766F",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },

  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderColor: "#DDE6E2",
    backgroundColor: "#FFFFFF",
    borderRadius: 13,
    marginBottom: 8,
  },

  paymentOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#F0F5F3",
  },

  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#66766F",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  radioOuterSelected: {
    borderColor: COLORS.primary,
  },

  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },

  paymentOptionText: {
    flex: 1,
  },

  paymentOptionTitle: {
    color: "#F7F8FA",
    fontSize: 14,
    fontWeight: "700",
  },

  paymentOptionTitleSelected: {
    color: COLORS.primary,
  },

  paymentOptionDescription: {
    color: "#66766F",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },

  paymentDetails: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    borderRadius: 17,
    padding: 16,
    marginBottom: 18,
  },

  paymentDetailsTitle: {
    color: "#F7F8FA",
    fontSize: 16,
    fontWeight: "800",
  },

  paymentDetailsHint: {
    color: "#66766F",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 16,
  },

  createButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  createButtonDisabled: {
    opacity: 0.6,
  },

  createButtonText: {
    color: "#F7F8FA",
    fontSize: 15,
    fontWeight: "900",
  },

  bottomSpace: {
    height: 28,
  },
});
