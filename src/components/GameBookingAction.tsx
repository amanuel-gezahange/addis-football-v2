import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Clipboard,
  Modal,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Colors } from "../constants/theme";
import { useLanguage } from "../i18n/LanguageContext";
import { supabase } from "../lib/supabase";

const c = Colors.dark;

const ACTION_GRADIENT = ["#19D39A", "#00B77A", "#009B68"] as const;
const ACTION_GRADIENT_START = { x: 0, y: 0.5 };
const ACTION_GRADIENT_END = { x: 1, y: 0.5 };

// Ethiopian payment-brand logos. Telebirr and CBE Birr use the maintained
// EthiopianLogos assets; CBE Mobile uses the CBE mark bundled with the app.
const TELEBIRR_LOGO =
  "https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/tele_birr/tele_birr.png";
const CBE_BIRR_LOGO =
  "https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/cbe_birr_light/cbe_birr_light.png";
const CBE_MOBILE_LOGO = require("../../assets/images/cbe.png");

type BookingStatus = "confirmed" | "waitlisted" | "pending_payment" | null;
type PaymentMethod = "free" | "venue" | "organizer";
type SelectedPaymentMethod = "telebirr" | "cbe_birr" | "cbe_mobile" | null;

type PaymentDetails = {
  payment_method: PaymentMethod;
  payment_provider: string | null;
  payment_phone: string | null;
  payment_account_name: string | null;
  accepts_telebirr: boolean;
  accepts_mobile_banking: boolean;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
};

export type GameBookingState = {
  bookingStatus: BookingStatus;
  paymentStatus: string | null;
  paymentMethod: PaymentMethod;
  paymentProvider: string | null;
};

type Props = {
  gameId: string | number;
  title: string;
  price: number;
  spotsLeft: number;
  status: string | null;
  paymentMethod: PaymentMethod;
  paymentProvider: string | null;
  paymentPhone: string | null;
  paymentAccountName: string | null;
  acceptsTelebirr?: boolean;
  acceptsMobileBanking?: boolean;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  onSpotsChange?: (spotsLeft: number) => void;
  onBookingStateChange?: (state: GameBookingState) => void;
  onDirectionsPress?: () => void;
};

export default function GameBookingAction({
  gameId,
  title,
  price,
  spotsLeft: initialSpotsLeft,
  status,
  paymentMethod,
  paymentProvider,
  paymentPhone,
  paymentAccountName,
  acceptsTelebirr = Boolean(paymentPhone),
  acceptsMobileBanking = false,
  bankName = null,
  bankAccountNumber = null,
  bankAccountName = null,
  onSpotsChange,
  onBookingStateChange,
  onDirectionsPress,
}: Props) {
  const { t } = useLanguage();

  const [bookingStatus, setBookingStatus] = useState<BookingStatus>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [stateLoading, setStateLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [spotsLeft, setSpotsLeft] = useState(Number(initialSpotsLeft ?? 0));

  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [multiSpotConfirmVisible, setMultiSpotConfirmVisible] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [playerModalVisible, setPlayerModalVisible] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<SelectedPaymentMethod>(null);
  const [paymentNumberCopied, setPaymentNumberCopied] = useState(false);

  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [waitlistModalVisible, setWaitlistModalVisible] = useState(false);
  const [paymentSubmittedModalVisible, setPaymentSubmittedModalVisible] =
    useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);

  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>({
    payment_method: paymentMethod,
    payment_provider: paymentProvider,
    payment_phone: paymentPhone,
    payment_account_name: paymentAccountName,
    accepts_telebirr: acceptsTelebirr,
    accepts_mobile_banking: acceptsMobileBanking,
    bank_name: bankName,
    bank_account_number: bankAccountNumber,
    bank_account_name: bankAccountName,
  });

  const numericPrice = Number(price ?? 0);
  const isPaidGame = numericPrice > 0;
  const isFull = status === "full" || spotsLeft <= 0;
  const isCancelled = status === "cancelled";
  const isConfirmed = bookingStatus === "confirmed";
  const isWaitlisted = bookingStatus === "waitlisted";
  const isPendingPayment = bookingStatus === "pending_payment";
  const isPaymentSubmitted = paymentStatus === "submitted";
  const isOrganizerPayment = paymentDetails.payment_method === "organizer";
  const totalAmount = numericPrice * selectedQuantity;
  const maxQuantity = Math.max(1, spotsLeft);

  const guestLabel = useMemo(() => {
    if (selectedQuantity <= 1) return "Just you";
    const guests = selectedQuantity - 1;
    return `You + ${guests} ${guests === 1 ? "guest" : "guests"}`;
  }, [selectedQuantity]);

  useEffect(() => {
    setSpotsLeft(Number(initialSpotsLeft ?? 0));
  }, [initialSpotsLeft]);

  useEffect(() => {
    setPaymentDetails({
      payment_method: paymentMethod,
      payment_provider: paymentProvider,
      payment_phone: paymentPhone,
      payment_account_name: paymentAccountName,
      accepts_telebirr: acceptsTelebirr,
      accepts_mobile_banking: acceptsMobileBanking,
      bank_name: bankName,
      bank_account_number: bankAccountNumber,
      bank_account_name: bankAccountName,
    });
  }, [
    paymentMethod,
    paymentProvider,
    paymentPhone,
    paymentAccountName,
    acceptsTelebirr,
    acceptsMobileBanking,
    bankName,
    bankAccountNumber,
    bankAccountName,
  ]);

  useEffect(() => {
    if (stateLoading) return;

    onBookingStateChange?.({
      bookingStatus,
      paymentStatus,
      paymentMethod: paymentDetails.payment_method,
      paymentProvider: paymentDetails.payment_provider,
    });
  }, [
    stateLoading,
    bookingStatus,
    paymentStatus,
    paymentDetails.payment_method,
    paymentDetails.payment_provider,
    onBookingStateChange,
  ]);

  function updateSpots(nextSpotsLeft: number) {
    setSpotsLeft(nextSpotsLeft);
    onSpotsChange?.(nextSpotsLeft);
  }

  async function loadState() {
    setStateLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const userId = session?.user?.id;

    if (!userId) {
      setBookingStatus(null);
      setPaymentStatus(null);
      setStateLoading(false);
      return;
    }

    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id,status,payment_status,quantity")
      .eq("user_id", userId)
      .eq("game_id", Number(gameId))
      .in("status", ["confirmed", "waitlisted", "pending_payment"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setStateLoading(false);
      return;
    }

    if (!booking?.id) {
      setBookingStatus(null);
      setPaymentStatus(null);
      setStateLoading(false);
      return;
    }

    setPaymentStatus(booking.payment_status ?? null);

    if (booking.status === "confirmed") {
      setBookingStatus("confirmed");
    } else if (booking.status === "waitlisted") {
      setBookingStatus("waitlisted");
    } else if (booking.status === "pending_payment") {
      setBookingStatus("pending_payment");
    } else {
      setBookingStatus(null);
    }

    setStateLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      loadState();
    }, [gameId]),
  );

  function openQuantityPicker() {
    setPaymentMessage(null);
    setSelectedQuantity(1);
    setSelectedPaymentMethod(null);
    setPaymentNumberCopied(false);
    setQuantityModalVisible(true);
  }

  async function handleJoinGame() {
    if (joining || stateLoading || isCancelled || isConfirmed || isWaitlisted) {
      return;
    }

    setPaymentMessage(null);

    if (isPendingPayment) {
      if (isPaymentSubmitted) return;
      openPaymentPicker();
      return;
    }

    // A full game joins the waitlist immediately. Waitlist is always one player.
    if (isFull) {
      setSelectedQuantity(1);
      setSelectedFriendIds([]);
      await handleNormalJoin(1);
      return;
    }

    // Available games let the player choose how many spots to reserve.
    openQuantityPicker();
  }

  function decreaseQuantity() {
    setSelectedQuantity((current) => Math.max(1, current - 1));
  }

  function increaseQuantity() {
    setSelectedQuantity((current) => Math.min(maxQuantity, current + 1));
  }

  async function loadFriendsForBooking() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
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
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id,full_name,avatar_url")
      .in("id", ids);
    setFriends(data ?? []);
  }

  async function handleQuantityContinue() {
    if (joining) return;

    setSelectedFriendIds([]);

    if (selectedQuantity > 1) {
      setQuantityModalVisible(false);
      setMultiSpotConfirmVisible(true);
      return;
    }

    setQuantityModalVisible(false);
    await continueBookingWithQuantity();
  }

  async function continueBookingWithQuantity() {
    if (
      paymentDetails.payment_method === "free" ||
      paymentDetails.payment_method === "venue" ||
      !isPaidGame
    ) {
      await handleNormalJoin(selectedQuantity);
      return;
    }

    if (isOrganizerPayment) {
      openPaymentPicker();
      return;
    }

    setPaymentMessage(t("gameCard.paymentMethodNotAvailable"));
  }

  async function confirmMultipleSpots() {
    if (joining) return;

    setMultiSpotConfirmVisible(false);
    await continueBookingWithQuantity();
  }

  async function handlePlayersContinue() {
    const neededFriends = Math.max(0, selectedQuantity - 1);
    if (selectedFriendIds.length !== neededFriends) {
      setPaymentMessage(
        `Choose ${neededFriends} ${neededFriends === 1 ? "friend" : "friends"} to fill these spots.`,
      );
      return;
    }
    setPlayerModalVisible(false);
    if (
      paymentDetails.payment_method === "free" ||
      paymentDetails.payment_method === "venue" ||
      !isPaidGame
    ) {
      await handleNormalJoin(selectedQuantity);
      return;
    }
    if (isOrganizerPayment) {
      openPaymentPicker();
      return;
    }
    setPaymentMessage(t("gameCard.paymentMethodNotAvailable"));
  }

  async function saveSelectedBookingPlayers(userId: string) {
    if (selectedQuantity <= 1 || selectedFriendIds.length === 0) return;
    const { data: booking } = await supabase
      .from("bookings")
      .select("id")
      .eq("user_id", userId)
      .eq("game_id", Number(gameId))
      .in("status", ["confirmed", "pending_payment"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!booking?.id) return;
    await supabase.from("booking_players").upsert(
      selectedFriendIds.map((profileId) => ({
        booking_id: booking.id,
        profile_id: profileId,
      })),
      { onConflict: "booking_id,profile_id" },
    );
  }

  async function handleNormalJoin(quantity: number) {
    setJoining(true);
    setPaymentMessage(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setPaymentMessage(t("gameCard.signInFirst"));
        return;
      }

      const { data, error } = await supabase.rpc("join_game", {
        p_game_id: Number(gameId),
        p_quantity: quantity,
      });

      if (error) {
        const message = error.message.toLowerCase();

        if (message.includes("already joined")) {
          await loadState();
          return;
        }

        if (message.includes("spots are available")) {
          setPaymentMessage(error.message);
          await loadState();
          return;
        }

        setPaymentMessage(t("gameCard.bookingCouldNotBeCreated"));
        return;
      }

      await saveSelectedBookingPlayers(user.id);

      if (data?.booking_status === "confirmed") {
        setBookingStatus("confirmed");
        setSuccessModalVisible(true);
      } else if (data?.booking_status === "waitlisted") {
        setBookingStatus("waitlisted");
        setWaitlistModalVisible(true);
      } else if (data?.booking_status === "pending_payment") {
        setBookingStatus("pending_payment");
      }

      if (typeof data?.spots_left === "number") {
        updateSpots(Number(data.spots_left));
      }
    } finally {
      setJoining(false);
    }
  }

  function openPaymentPicker() {
    setPaymentMessage(null);
    setPaymentNumberCopied(false);

    // The organizer's saved payment details are the source of truth.
    // If a Telebirr number exists, go directly to Telebirr checkout.
    // Do not show a redundant chooser with unavailable payment methods.
    if (paymentDetails.payment_phone) {
      setSelectedPaymentMethod("telebirr");
      setPaymentModalVisible(true);
      return;
    }

    // Otherwise use the configured bank account, if one exists.
    if (paymentDetails.bank_account_number) {
      setSelectedPaymentMethod(
        paymentDetails.accepts_mobile_banking ? "cbe_mobile" : "cbe_birr",
      );
      setPaymentModalVisible(true);
      return;
    }

    setSelectedPaymentMethod(null);
    setPaymentMessage(t("gameCard.paymentMethodNotAvailable"));
  }

  function selectPaymentMethod(method: Exclude<SelectedPaymentMethod, null>) {
    setPaymentNumberCopied(false);
    setSelectedPaymentMethod(method);
  }

  function getSelectedPaymentInfo() {
    if (selectedPaymentMethod === "telebirr") {
      return {
        label: "Telebirr",
        number: paymentDetails.payment_phone,
        accountName: paymentDetails.payment_account_name,
        bankName: null,
      };
    }

    if (selectedPaymentMethod === "cbe_birr") {
      return {
        label: "CBE Birr",
        number: paymentDetails.bank_account_number,
        accountName: paymentDetails.bank_account_name,
        bankName: paymentDetails.bank_name ?? "Commercial Bank of Ethiopia",
      };
    }

    return {
      label: "CBE Mobile",
      number: paymentDetails.bank_account_number,
      accountName: paymentDetails.bank_account_name,
      bankName: paymentDetails.bank_name ?? "Commercial Bank of Ethiopia",
    };
  }

  function handleCopyPaymentNumber() {
    if (!selectedPaymentMethod) return;

    const info = getSelectedPaymentInfo();
    if (!info.number) return;

    Clipboard.setString(info.number);
    setPaymentNumberCopied(true);
  }

  async function handleSubmitPayment() {
    if (joining || !selectedPaymentMethod) return;

    setJoining(true);
    setPaymentMessage(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setPaymentMessage(t("gameCard.signInFirst"));
        return;
      }

      const { data, error } = await supabase.rpc(
        "submit_new_organizer_payment",
        {
          p_game_id: Number(gameId),
          p_player_reference: null,
          p_quantity: selectedQuantity,
        },
      );

      if (error) {
        const message = error.message.toLowerCase();

        if (
          message.includes("game is full") ||
          message.includes("spots are available")
        ) {
          setPaymentModalVisible(false);
          setPaymentMessage(error.message);
          await loadState();
          return;
        }

        if (message.includes("already have an active booking")) {
          setPaymentModalVisible(false);
          await loadState();
          return;
        }

        setPaymentMessage(t("gameCard.couldNotSubmitPayment"));
        return;
      }

      if (data?.success) {
        await saveSelectedBookingPlayers(user.id);
        setBookingStatus("pending_payment");
        setPaymentStatus("submitted");

        if (typeof data?.spots_left === "number") {
          updateSpots(Number(data.spots_left));
        }

        setPaymentModalVisible(false);
        setPaymentSubmittedModalVisible(true);
      }
    } finally {
      setJoining(false);
    }
  }

  function getButtonText() {
    if (joining)
      return isFull ? t("gameCard.joiningWaitlist") : t("gameCard.joining");
    if (isConfirmed) return t("gameCard.joined");
    if (isWaitlisted) return t("gameCard.waitlisted");
    if (isPendingPayment && isPaymentSubmitted)
      return t("gameCard.waitingForOrganizer");
    if (isPendingPayment) return t("gameCard.ivePaid");
    if (isFull) return t("gameCard.joinWaitlist");
    return t("gameCard.joinGame");
  }

  const actionDisabled =
    stateLoading ||
    joining ||
    isCancelled ||
    isConfirmed ||
    isWaitlisted ||
    (isPendingPayment && isPaymentSubmitted);

  const selectedPaymentInfo = selectedPaymentMethod
    ? getSelectedPaymentInfo()
    : null;

  return (
    <>
      {stateLoading ? null : isCancelled ? (
        <View style={styles.cancelledFooter}>
          <View style={styles.cancelledIcon}>
            <Ionicons name="close" size={18} color="#B42318" />
          </View>
          <View style={styles.cancelledContent}>
            <Text style={styles.cancelledTitle}>
              {t("bookingAction.gameCancelled")}
            </Text>
            <Text style={styles.cancelledText}>
              {t("bookingAction.gameCancelledDescription")}
            </Text>
          </View>
        </View>
      ) : isConfirmed ? null : isPendingPayment && isPaymentSubmitted ? null : (
        <View style={styles.wrapper}>
          <View style={styles.footerInfo}>
            <Text style={styles.price}>
              {numericPrice === 0 ? t("gameCard.free") : `${numericPrice} ETB`}
            </Text>
            <Text style={[styles.spots, isFull && styles.spotsFull]}>
              {isFull
                ? t("gameCard.gameFull")
                : `${spotsLeft} ${t("gameCard.spotsLeft")}`}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.actionButtonPressable,
              pressed && !actionDisabled && styles.buttonPressed,
              actionDisabled && styles.disabledButton,
            ]}
            onPress={handleJoinGame}
            disabled={actionDisabled}
          >
            {isFull && !bookingStatus ? (
              <View style={[styles.actionButton, styles.waitlistButton]}>
                <Text
                  style={[styles.actionButtonText, styles.waitlistButtonText]}
                >
                  {getButtonText()}
                </Text>
              </View>
            ) : (
              <LinearGradient
                colors={ACTION_GRADIENT}
                start={ACTION_GRADIENT_START}
                end={ACTION_GRADIENT_END}
                style={styles.actionButton}
              >
                {joining ? (
                  <ActivityIndicator size="small" color="#F7F8FA" />
                ) : (
                  <Text style={styles.gradientButtonText}>
                    {getButtonText()}
                  </Text>
                )}
              </LinearGradient>
            )}
          </Pressable>
        </View>
      )}

      {!!paymentMessage && (
        <View style={styles.message}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color="#9A6700"
          />
          <Text style={styles.messageText}>{paymentMessage}</Text>
        </View>
      )}

      {/* HOW MANY PLAYERS */}
      <Modal
        visible={quantityModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setQuantityModalVisible(false)}
      >
        <View style={styles.checkoutBackdrop}>
          <View style={[styles.checkoutScreen, styles.quantityCheckoutScreen]}>
            <View style={styles.checkoutHeader}>
              <Pressable
                style={styles.checkoutBackButton}
                onPress={() => setQuantityModalVisible(false)}
              >
                <Ionicons name="chevron-back" size={24} color="#14201B" />
              </Pressable>
            </View>

            <View style={styles.checkoutContent}>
              <Text style={styles.checkoutTitle}>How many spots?</Text>
              <Text style={styles.checkoutSubtitle}>
                {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} available
              </Text>

              <View style={styles.checkoutStepperRow}>
                <Pressable
                  style={[
                    styles.checkoutStepperButton,
                    selectedQuantity <= 1 &&
                      styles.checkoutStepperButtonDisabled,
                  ]}
                  onPress={decreaseQuantity}
                  disabled={selectedQuantity <= 1}
                >
                  <Ionicons name="remove" size={28} color="#14201B" />
                </Pressable>

                <Text style={styles.checkoutQuantity}>{selectedQuantity}</Text>

                <Pressable
                  style={[
                    styles.checkoutStepperAddPressable,
                    selectedQuantity >= maxQuantity &&
                      styles.checkoutStepperButtonDisabled,
                  ]}
                  onPress={increaseQuantity}
                  disabled={selectedQuantity >= maxQuantity}
                >
                  <LinearGradient
                    colors={ACTION_GRADIENT}
                    start={ACTION_GRADIENT_START}
                    end={ACTION_GRADIENT_END}
                    style={styles.checkoutStepperAddGradient}
                  >
                    <Ionicons name="add" size={28} color="#F7F8FA" />
                  </LinearGradient>
                </Pressable>
              </View>

              <View style={styles.checkoutPriceCard}>
                <View>
                  <Text style={styles.checkoutPriceLabel}>
                    {numericPrice === 0
                      ? `${selectedQuantity} ${
                          selectedQuantity === 1 ? "spot" : "spots"
                        }`
                      : `${selectedQuantity} ${
                          selectedQuantity === 1 ? "spot" : "spots"
                        } × ${numericPrice} ETB`}
                  </Text>
                  <Text style={styles.checkoutPriceSubtext}>Total</Text>
                </View>

                <Text style={styles.checkoutPriceValue}>
                  {numericPrice === 0 ? "Free" : `${totalAmount} ETB`}
                </Text>
              </View>
            </View>

            <View style={styles.checkoutFooter}>
              <Pressable
                style={({ pressed }) => [
                  styles.checkoutPrimaryPressable,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleQuantityContinue}
              >
                <LinearGradient
                  colors={ACTION_GRADIENT}
                  start={ACTION_GRADIENT_START}
                  end={ACTION_GRADIENT_END}
                  style={styles.checkoutPrimaryButton}
                >
                  <Text style={styles.gradientButtonText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={22} color="#F7F8FA" />
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* MULTIPLE SPOTS CONFIRMATION */}
      <Modal
        visible={multiSpotConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMultiSpotConfirmVisible(false)}
      >
        <View style={styles.multiSpotBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setMultiSpotConfirmVisible(false)}
          />

          <View style={styles.multiSpotCard}>
            <View style={styles.multiSpotIcon}>
              <Ionicons name="people-outline" size={26} color="#00B77A" />
            </View>

            <Text style={styles.multiSpotTitle}>
              Reserve {selectedQuantity} spots
            </Text>

            <Text style={styles.multiSpotDescription}>
              You're reserving {selectedQuantity} spots for this game. Please
              make sure the other players are joining you, since these spots
              won't be available to other players.
            </Text>

            <View style={styles.multiSpotSummary}>
              <View>
                <Text style={styles.multiSpotSummaryLabel}>
                  {selectedQuantity} spots
                </Text>
                {numericPrice > 0 && (
                  <Text style={styles.multiSpotSummaryCalculation}>
                    {numericPrice} ETB × {selectedQuantity}
                  </Text>
                )}
              </View>

              <Text style={styles.multiSpotSummaryTotal}>
                {numericPrice === 0 ? "Free" : `${totalAmount} ETB`}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.multiSpotConfirmPressable,
                pressed && styles.buttonPressed,
              ]}
              onPress={confirmMultipleSpots}
            >
              <LinearGradient
                colors={ACTION_GRADIENT}
                start={ACTION_GRADIENT_START}
                end={ACTION_GRADIENT_END}
                style={styles.multiSpotConfirmButton}
              >
                <Text style={styles.gradientButtonText}>
                  Confirm {selectedQuantity} spots
                </Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.multiSpotBackButton,
                pressed && styles.multiSpotBackButtonPressed,
              ]}
              onPress={() => {
                setMultiSpotConfirmVisible(false);
                setQuantityModalVisible(true);
              }}
            >
              <Text style={styles.multiSpotBackText}>Go back</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* SELECT PLAYERS */}
      <Modal
        visible={playerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPlayerModalVisible(false)}
      >
        <View style={styles.checkoutBackdrop}>
          <View style={styles.checkoutScreen}>
            <View style={styles.checkoutHeader}>
              <Pressable
                style={styles.checkoutBackButton}
                onPress={() => {
                  setPlayerModalVisible(false);
                  setQuantityModalVisible(true);
                }}
              >
                <Ionicons name="chevron-back" size={24} color="#14201B" />
              </Pressable>
            </View>
            <View style={styles.checkoutContent}>
              <Text style={styles.checkoutTitle}>
                Select players ({selectedQuantity})
              </Text>
              <Text style={styles.checkoutSubtitle}>
                Choose who will join this game.
              </Text>
              <View style={styles.playerSelectedCard}>
                <View style={styles.playerAvatarFallback}>
                  <Ionicons name="person" size={18} color="#14201B" />
                </View>
                <Text style={styles.playerName}>You</Text>
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>You</Text>
                </View>
              </View>
              {selectedQuantity > 1 && (
                <Text style={styles.playerSectionTitle}>
                  Your friends · choose {selectedQuantity - 1}
                </Text>
              )}
              <ScrollView
                style={styles.friendPickerList}
                showsVerticalScrollIndicator={false}
              >
                {friends.map((friend: any) => {
                  const selected = selectedFriendIds.includes(friend.id);
                  return (
                    <Pressable
                      key={friend.id}
                      style={styles.friendPickerRow}
                      onPress={() =>
                        setSelectedFriendIds((current) =>
                          selected
                            ? current.filter((id) => id !== friend.id)
                            : current.length < selectedQuantity - 1
                              ? [...current, friend.id]
                              : current,
                        )
                      }
                    >
                      {friend.avatar_url ? (
                        <Image
                          source={{ uri: friend.avatar_url }}
                          style={styles.playerAvatar}
                        />
                      ) : (
                        <View style={styles.playerAvatarFallback}>
                          <Ionicons name="person" size={18} color="#14201B" />
                        </View>
                      )}
                      <Text style={styles.playerName}>
                        {friend.full_name || "Player"}
                      </Text>
                      <View
                        style={[
                          styles.friendAddButton,
                          selected && styles.friendAddButtonSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.friendAddText,
                            selected && styles.friendAddTextSelected,
                          ]}
                        >
                          {selected ? "Added" : "Add"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
                {selectedQuantity > 1 && friends.length === 0 && (
                  <Pressable
                    style={styles.addFriendsEmpty}
                    onPress={() => {
                      setPlayerModalVisible(false);
                      router.push("/friends/add" as any);
                    }}
                  >
                    <Ionicons
                      name="person-add-outline"
                      size={22}
                      color="#00B77A"
                    />
                    <Text style={styles.addFriendsEmptyText}>
                      Add friends first
                    </Text>
                  </Pressable>
                )}
              </ScrollView>
            </View>
            <View style={styles.checkoutFooter}>
              <Pressable
                style={styles.checkoutPrimaryPressable}
                onPress={handlePlayersContinue}
              >
                <LinearGradient
                  colors={ACTION_GRADIENT}
                  start={ACTION_GRADIENT_START}
                  end={ACTION_GRADIENT_END}
                  style={styles.checkoutPrimaryButton}
                >
                  <Text style={styles.gradientButtonText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={22} color="#F7F8FA" />
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* PAYMENT */}
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.checkoutBackdrop}>
          <View style={styles.checkoutScreen}>
            <View style={styles.checkoutHeader}>
              <Pressable
                style={styles.checkoutBackButton}
                onPress={() => {
                  setPaymentModalVisible(false);
                  setPaymentNumberCopied(false);
                }}
              >
                <Ionicons name="chevron-back" size={24} color="#14201B" />
              </Pressable>
            </View>

            {selectedPaymentMethod === null ? (
              <View style={styles.checkoutContent}>
                <Text style={styles.checkoutTitle}>Choose payment method</Text>
                <Text style={styles.checkoutSubtitle}>
                  Pay {totalAmount} ETB for {selectedQuantity}{" "}
                  {selectedQuantity === 1 ? "player" : "players"}
                </Text>
                {numericPrice > 0 && (
                  <Text style={styles.checkoutCalculation}>
                    ({numericPrice} ETB × {selectedQuantity})
                  </Text>
                )}

                <View style={styles.checkoutPaymentList}>
                  <CheckoutPaymentChoice
                    logoUri={TELEBIRR_LOGO}
                    title="Telebirr"
                    subtitle="Pay with Telebirr"
                    enabled={Boolean(paymentDetails.payment_phone)}
                    onPress={() => selectPaymentMethod("telebirr")}
                  />
                  <CheckoutPaymentChoice
                    logoUri={CBE_BIRR_LOGO}
                    title="CBE Birr"
                    subtitle="Pay with CBE Birr"
                    enabled={Boolean(paymentDetails.bank_account_number)}
                    onPress={() => selectPaymentMethod("cbe_birr")}
                  />
                  <CheckoutPaymentChoice
                    logoSource={CBE_MOBILE_LOGO}
                    title="CBE Mobile Banking"
                    subtitle="Commercial Bank of Ethiopia"
                    enabled={Boolean(paymentDetails.bank_account_number)}
                    onPress={() => selectPaymentMethod("cbe_mobile")}
                  />
                </View>
              </View>
            ) : (
              <>
                <View style={styles.checkoutContent}>
                  <Text style={styles.checkoutTitle}>
                    {selectedPaymentInfo?.label} payment
                  </Text>
                  <Text style={styles.checkoutSubtitle}>
                    Send the exact amount below. After paying, tap "I've paid"
                    to notify the organizer.
                  </Text>

                  <View style={styles.checkoutAmountCard}>
                    <Text style={styles.checkoutFieldLabel}>
                      Send this amount
                    </Text>
                    <Text style={styles.checkoutAmount}>{totalAmount} ETB</Text>
                  </View>

                  <View style={styles.checkoutPaymentField}>
                    <View style={styles.checkoutPaymentFieldText}>
                      <Text style={styles.checkoutFieldLabel}>
                        {selectedPaymentMethod === "telebirr"
                          ? "To this number"
                          : "To this account"}
                      </Text>
                      <Text style={styles.checkoutFieldValue}>
                        {selectedPaymentInfo?.number ?? "Not provided"}
                      </Text>
                    </View>

                    {!!selectedPaymentInfo?.number && (
                      <Pressable
                        style={styles.checkoutCopyButton}
                        onPress={handleCopyPaymentNumber}
                      >
                        <Ionicons
                          name={
                            paymentNumberCopied ? "checkmark" : "copy-outline"
                          }
                          size={20}
                          color={paymentNumberCopied ? "#F72585" : "#14201B"}
                        />
                      </Pressable>
                    )}
                  </View>

                  {!!selectedPaymentInfo?.accountName && (
                    <View style={styles.checkoutPaymentField}>
                      <View style={styles.checkoutPaymentFieldText}>
                        <Text style={styles.checkoutFieldLabel}>
                          Account name
                        </Text>
                        <Text style={styles.checkoutFieldValue}>
                          {selectedPaymentInfo.accountName}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.checkoutInstructions}>
                    <View style={styles.checkoutInstructionRow}>
                      <View style={styles.checkoutInstructionNumber}>
                        <Text style={styles.checkoutInstructionNumberText}>
                          1
                        </Text>
                      </View>
                      <Text style={styles.checkoutInstructionText}>
                        Copy the Telebirr number
                      </Text>
                    </View>
                    <View style={styles.checkoutInstructionRow}>
                      <View style={styles.checkoutInstructionNumber}>
                        <Text style={styles.checkoutInstructionNumberText}>
                          2
                        </Text>
                      </View>
                      <Text style={styles.checkoutInstructionText}>
                        Open {selectedPaymentInfo?.label}
                      </Text>
                    </View>
                    <View style={styles.checkoutInstructionRow}>
                      <View style={styles.checkoutInstructionNumber}>
                        <Text style={styles.checkoutInstructionNumberText}>
                          3
                        </Text>
                      </View>
                      <Text style={styles.checkoutInstructionText}>
                        Send exactly {totalAmount} ETB
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.checkoutFooter}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.checkoutPrimaryPressable,
                      (joining || !selectedPaymentInfo?.number) &&
                        styles.disabledButton,
                      pressed && !joining && styles.buttonPressed,
                    ]}
                    onPress={handleSubmitPayment}
                    disabled={joining || !selectedPaymentInfo?.number}
                  >
                    <LinearGradient
                      colors={ACTION_GRADIENT}
                      start={ACTION_GRADIENT_START}
                      end={ACTION_GRADIENT_END}
                      style={styles.checkoutPrimaryButton}
                    >
                      {joining ? (
                        <ActivityIndicator size="small" color="#F7F8FA" />
                      ) : (
                        <>
                          <Text style={styles.gradientButtonText}>
                            I've paid
                          </Text>
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={22}
                            color="#F7F8FA"
                          />
                        </>
                      )}
                    </LinearGradient>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* FREE / IMMEDIATE CONFIRMATION */}
      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.successBackdrop}>
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={42} color="#F7F8FA" />
            </View>
            <Text style={styles.successTitle}>
              {t("bookingSuccess.youreIn")}
            </Text>
            <Text style={styles.successGameTitle}>{title}</Text>
            <Text style={styles.successText}>
              {selectedQuantity} {selectedQuantity === 1 ? "spot" : "spots"}{" "}
              confirmed
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => {
                setSuccessModalVisible(false);
                router.push("/bookings");
              }}
            >
              <Text style={styles.primaryButtonText}>
                {t("bookingSuccess.viewMyBookings")}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* WAITLIST */}
      <Modal
        visible={waitlistModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWaitlistModalVisible(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setWaitlistModalVisible(false)}
          />
          <View style={styles.sheetCentered}>
            <View style={styles.handle} />
            <View style={styles.waitlistIcon}>
              <Ionicons name="time-outline" size={32} color="#18C8FF" />
            </View>
            <Text style={styles.sheetTitle}>
              {t("gameCard.waitlistSuccessTitle")}
            </Text>
            <Text style={styles.sheetSubtitle}>
              {t("gameCard.waitlistSuccessSubtitle")}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setWaitlistModalVisible(false)}
            >
              <Text style={styles.primaryButtonText}>
                {t("gameCard.gotIt")}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* PAYMENT SUBMITTED */}
      {/* PAYMENT SUBMITTED */}
      <Modal
        visible={paymentSubmittedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPaymentSubmittedModalVisible(false)}
      >
        <View style={styles.paymentSubmittedBackdrop}>
          <View style={styles.paymentSubmittedCard}>
            {/* Clock icon */}
            <View style={styles.paymentSubmittedIconCircle}>
              <Ionicons name="time-outline" size={42} color="#00B77A" />
            </View>

            {/* Title */}
            <Text style={styles.paymentSubmittedTitle}>Payment submitted</Text>

            {/* Message */}
            <Text style={styles.paymentSubmittedSubtitle}>
              Your payment has been submitted.
              Waiting for organizer confirmation.
            </Text>

            {/* Amount */}
            <View style={styles.paymentSubmittedAmountCard}>
              <View style={styles.paymentSubmittedLockCircle}>
                <Ionicons
                  name="lock-closed-outline"
                  size={22}
                  color="#00B77A"
                />
              </View>

              <View style={styles.paymentSubmittedAmountContent}>
                <Text style={styles.paymentSubmittedAmount}>
                  {totalAmount} ETB
                </Text>

                <Text style={styles.paymentSubmittedAmountLabel}>
                  Waiting for confirmation
                </Text>
              </View>
            </View>

            {/* View game */}
            <Pressable
              style={({ pressed }) => [
                styles.paymentSubmittedButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setPaymentSubmittedModalVisible(false)}
            >
              <Text style={styles.paymentSubmittedButtonText}>View game</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

type CheckoutPaymentChoiceProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  logoUri?: string;
  logoSource?: number;
  title: string;
  subtitle: string;
  enabled: boolean;
  onPress: () => void;
};

function CheckoutPaymentChoice({
  icon,
  logoUri,
  logoSource,
  title,
  subtitle,
  enabled,
  onPress,
}: CheckoutPaymentChoiceProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.checkoutPaymentChoice,
        !enabled && styles.checkoutPaymentChoiceDisabled,
        pressed && enabled && styles.buttonPressed,
      ]}
      onPress={onPress}
      disabled={!enabled}
    >
      <View style={styles.checkoutPaymentIcon}>
        {logoSource ? (
          <Image
            source={logoSource}
            style={styles.checkoutPaymentBrandLogo}
            resizeMode="contain"
          />
        ) : logoUri ? (
          <Image
            source={{ uri: logoUri }}
            style={styles.checkoutPaymentBrandLogo}
            resizeMode="contain"
          />
        ) : icon ? (
          <Ionicons name={icon} size={24} color={c.primary} />
        ) : null}
      </View>

      <View style={styles.checkoutPaymentChoiceText}>
        <Text style={styles.checkoutPaymentChoiceTitle}>{title}</Text>
        <Text style={styles.checkoutPaymentChoiceSubtitle}>
          {enabled ? subtitle : "Unavailable"}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={21}
        color={enabled ? "#A9BAC4" : "#52646E"}
      />
    </Pressable>
  );
}

type PaymentChoiceProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  enabled: boolean;
  onPress: () => void;
};

function PaymentChoice({ icon, title, enabled, onPress }: PaymentChoiceProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.paymentChoice,
        !enabled && styles.paymentChoiceDisabled,
        pressed && enabled && styles.buttonPressed,
      ]}
      onPress={onPress}
      disabled={!enabled}
    >
      <View style={styles.paymentChoiceIcon}>
        <Ionicons name={icon} size={22} color="#00B77A" />
      </View>
      <Text style={styles.paymentChoiceTitle}>{title}</Text>
      {!enabled ? (
        <Text style={styles.unavailableText}>Unavailable</Text>
      ) : (
        <Ionicons name="chevron-forward" size={20} color="#66766F" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  multiSpotBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  multiSpotCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 20,
    alignItems: "center",
  },

  multiSpotIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#E7F8F1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  multiSpotTitle: {
    color: "#14201B",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    textAlign: "center",
  },

  multiSpotDescription: {
    color: "#66766F",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },

  multiSpotSummary: {
    width: "100%",
    minHeight: 72,
    marginTop: 20,
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },

  multiSpotSummaryLabel: {
    color: "#14201B",
    fontSize: 15,
    fontWeight: "800",
  },

  multiSpotSummaryCalculation: {
    color: "#66766F",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },

  multiSpotSummaryTotal: {
    color: "#14201B",
    fontSize: 18,
    fontWeight: "900",
  },

  multiSpotConfirmPressable: {
    width: "100%",
    borderRadius: 15,
    overflow: "hidden",
  },

  multiSpotConfirmButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  multiSpotBackButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },

  multiSpotBackButtonPressed: {
    opacity: 0.6,
  },

  multiSpotBackText: {
    color: "#66766F",
    fontSize: 14,
    fontWeight: "800",
  },

  wrapper: {
    minHeight: 86,
    backgroundColor: "#F7F8FA",
    borderTopWidth: 1,
    borderTopColor: "#DDE6E2",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
  },
  footerInfo: { flexShrink: 0, minWidth: 82 },
  price: { color: "#14201B", fontSize: 18, fontWeight: "800" },
  spots: { color: "#66766F", fontSize: 12, marginTop: 2 },
  spotsFull: { color: "#C13515", fontWeight: "700" },
  actionButtonPressable: {
    minWidth: 142,
    borderRadius: 14,
    overflow: "hidden",
  },
  actionButton: {
    minWidth: 142,
    minHeight: 50,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: { color: "#F7F8FA", fontSize: 15, fontWeight: "900" },
  waitlistButton: {
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#00B77A",
  },
  waitlistButtonText: { color: "#00B77A" },
  buttonPressed: { opacity: 0.68, transform: [{ scale: 0.99 }] },
  disabledButton: { opacity: 0.48 },

  confirmedFooter: {
    minHeight: 82,
    backgroundColor: "#F7F8FA",
    borderTopWidth: 1,
    borderTopColor: "#DDE6E2",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  directionsButton: {
    width: "100%",
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: c.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  directionsButtonText: { color: "#F7F8FA", fontSize: 16, fontWeight: "900" },

  pendingFooter: {
    minHeight: 82,
    backgroundColor: "#F7F8FA",
    borderTopWidth: 1,
    borderTopColor: "#DDE6E2",
    paddingHorizontal: 20,
    paddingTop: 13,
    paddingBottom: 14,
  },
  pendingFooterTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  pendingPaymentSummary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pendingCheckIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#00B77A",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingPaymentSummaryText: {
    flexShrink: 1,
    color: "#14201B",
    fontSize: 15,
    fontWeight: "900",
  },
  pendingWaiting: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pendingWaitingText: {
    color: "#66766F",
    fontSize: 13,
    fontWeight: "800",
  },
  pendingFooterText: {
    color: "#66766F",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
    marginLeft: 30,
  },

  cancelledFooter: {
    minHeight: 86,
    backgroundColor: "#F7F8FA5F4",
    borderTopWidth: 1,
    borderTopColor: "#F5C2BD",
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cancelledIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFF1F2",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelledContent: { flex: 1 },
  cancelledTitle: { color: "#B42318", fontSize: 16, fontWeight: "900" },
  cancelledText: {
    color: "#7A4540",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },

  message: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F7F8FA8E7",
    borderTopWidth: 1,
    borderTopColor: "#F2D38B",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  messageText: { color: "#7A5200", fontSize: 14, fontWeight: "600", flex: 1 },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(3,11,18,0.58)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#F7F8FA",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
  },
  quantitySheet: {
    backgroundColor: "#F7F8FA",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 20,
  },

  sheetCentered: {
    backgroundColor: "#F7F8FA",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
    alignItems: "center",
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#CBD8D2",
    alignSelf: "center",
    marginBottom: 18,
  },
  closeButton: {
    position: "absolute",
    top: 14,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  sheetTitle: {
    color: "#14201B",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  sheetSubtitle: {
    color: "#66766F",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 8,
  },

  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 26,
    marginTop: 22,
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#CBD8D2",
    backgroundColor: "#F7F8FA",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonDisabled: { opacity: 0.3 },
  quantityNumber: {
    minWidth: 42,
    color: "#14201B",
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
  },
  guestLabel: {
    color: "#14201B",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 13,
  },
  eachPrice: {
    color: "#66766F",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#DDE6E2",
    marginTop: 18,
    marginBottom: 15,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalLabel: { color: "#14201B", fontSize: 16, fontWeight: "700" },
  totalValue: { color: "#14201B", fontSize: 19, fontWeight: "900" },

  primaryButton: {
    width: "100%",
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  quantityContinueButton: {
    marginTop: 14,
  },

  primaryButtonText: {
    color: "#F7F8FA",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },

  paymentTotal: {
    color: "#14201B",
    fontSize: 34,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 10,
  },
  paymentQuantityText: {
    color: "#66766F",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 5,
    marginBottom: 22,
  },
  paymentChoice: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: "#DDE6E2",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  paymentChoiceDisabled: { opacity: 0.42 },
  paymentChoiceIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#F0F5F3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  paymentChoiceTitle: {
    flex: 1,
    color: "#14201B",
    fontSize: 16,
    fontWeight: "800",
  },
  unavailableText: { color: "#66766F", fontSize: 12, fontWeight: "700" },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 8,
  },
  backButtonText: { color: "#00B77A", fontSize: 13, fontWeight: "800" },
  bankName: {
    color: "#33433C",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
  },
  accountCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E2",
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    alignItems: "center",
  },
  accountLabel: { color: "#66766F", fontSize: 12, fontWeight: "700" },
  accountNumber: {
    color: "#14201B",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 5,
    textAlign: "center",
  },
  accountName: {
    color: "#66766F",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 5,
    textAlign: "center",
  },
  copyButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#F0F5F3",
    borderWidth: 1,
    borderColor: "#CDEFFA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  copyButtonDone: { backgroundColor: "#F0F5F3", borderColor: "#DDE6E2" },
  copyButtonText: { color: "#00B77A", fontSize: 15, fontWeight: "900" },
  copyButtonTextDone: { color: "#00B77A" },
  instructions: { gap: 9, marginTop: 20, paddingHorizontal: 4 },
  instructionText: {
    color: "#33433C",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },

  checkoutBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.58)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  checkoutScreen: {
    width: "100%",
    maxWidth: 430,
    minHeight: 610,
    maxHeight: 720,
    backgroundColor: "#F7F8FA",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#DDE6E2",
    overflow: "hidden",
    shadowColor: "#14201B",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 14,
  },
  quantityCheckoutScreen: {
    minHeight: 0,
    height: 440,
    maxHeight: 440,
  },
  checkoutHeader: {
    height: 58,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  checkoutBackButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkoutContent: {
    flex: 1,
    paddingHorizontal: 22,
  },
  checkoutTitle: {
    color: "#14201B",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  checkoutSubtitle: {
    color: "#66766F",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
    marginTop: 5,
  },
  checkoutCalculation: {
    color: "#66766F",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
  checkoutStepperRow: {
    height: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    marginTop: 12,
  },
  checkoutStepperButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#F7F8FA",
    borderWidth: 1.5,
    borderColor: "#CBD8D2",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutStepperAddPressable: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: "hidden",
    shadowColor: "#F72585",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  checkoutStepperAddGradient: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutStepperButtonDisabled: {
    opacity: 0.3,
  },
  checkoutQuantity: {
    width: 64,
    color: "#14201B",
    fontSize: 44,
    lineHeight: 52,
    fontWeight: "900",
    textAlign: "center",
  },
  checkoutPlayerLabelSlot: {
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutPlayerLabel: {
    color: "#14201B",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  checkoutPriceCard: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDE6E2",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  checkoutPriceLabel: {
    color: "#14201B",
    fontSize: 16,
    fontWeight: "800",
  },
  checkoutPriceSubtext: {
    color: "#66766F",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  checkoutPriceValue: {
    color: "#14201B",
    fontSize: 22,
    fontWeight: "900",
  },
  checkoutFooter: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 18,
  },
  checkoutPrimaryPressable: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#F72585",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 7,
  },
  checkoutPrimaryButton: {
    width: "100%",
    minHeight: 56,
    borderRadius: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  gradientButtonText: {
    color: "#F7F8FA",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  checkoutPrimaryButtonText: {
    color: "#F7F8FA",
    fontSize: 16,
    fontWeight: "900",
  },
  playerSelectedCard: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#DDE6E2",
    borderRadius: 14,
    paddingHorizontal: 12,
    marginTop: 18,
  },
  playerAvatar: { width: 38, height: 38, borderRadius: 19 },
  playerAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F0F5F3",
    alignItems: "center",
    justifyContent: "center",
  },
  playerName: { flex: 1, fontSize: 15, fontWeight: "700", color: "#14201B" },
  youBadge: {
    backgroundColor: "#F0F5F3",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  youBadgeText: { color: "#00B77A", fontSize: 12, fontWeight: "800" },
  playerSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#14201B",
    marginTop: 20,
    marginBottom: 6,
  },
  friendPickerList: { maxHeight: 280 },
  friendPickerRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F5F3",
  },
  friendAddButton: {
    backgroundColor: "#F0F5F3",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 11,
  },
  friendAddButtonSelected: { backgroundColor: "#00B77A" },
  friendAddText: { color: "#00B77A", fontWeight: "800", fontSize: 13 },
  friendAddTextSelected: { color: "#F7F8FA" },
  addFriendsEmpty: {
    marginTop: 18,
    minHeight: 58,
    borderWidth: 1,
    borderColor: "#ABEFC6",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ECFDF3",
  },
  addFriendsEmptyText: { color: "#00B77A", fontWeight: "800" },
  checkoutPaymentList: {
    gap: 12,
    marginTop: 28,
  },
  checkoutPaymentChoice: {
    minHeight: 78,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#DDE6E2",
    backgroundColor: "#F7F8FA",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    shadowColor: "#14201B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  checkoutPaymentChoiceDisabled: {
    opacity: 0.38,
  },
  checkoutPaymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F4F3FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  checkoutPaymentBrandLogo: {
    width: 38,
    height: 38,
  },
  checkoutPaymentChoiceText: {
    flex: 1,
  },
  checkoutPaymentChoiceTitle: {
    color: "#14201B",
    fontSize: 16,
    fontWeight: "900",
  },
  checkoutPaymentChoiceSubtitle: {
    color: "#66766F",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  checkoutAmountCard: {
    minHeight: 82,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDE6E2",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    justifyContent: "center",
    marginTop: 24,
  },
  checkoutFieldLabel: {
    color: "#66766F",
    fontSize: 12,
    fontWeight: "700",
  },
  checkoutAmount: {
    color: "#14201B",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 3,
  },
  checkoutPaymentField: {
    minHeight: 68,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDE6E2",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  checkoutPaymentFieldText: {
    flex: 1,
  },
  checkoutFieldValue: {
    color: "#14201B",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 3,
  },
  checkoutCopyButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#DDE6E2",
  },
  checkoutInstructions: {
    gap: 12,
    marginTop: 22,
  },
  checkoutInstructionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  checkoutInstructionNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFE4EE",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutInstructionNumberText: {
    color: "#C11574",
    fontSize: 12,
    fontWeight: "900",
  },
  checkoutInstructionText: {
    flex: 1,
    color: "#14201B",
    fontSize: 14,
    fontWeight: "600",
  },

  successBackdrop: {
    flex: 1,
    backgroundColor: "rgba(3,11,18,0.82)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  successCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#F7F8FA",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#183044",
    paddingHorizontal: 22,
    paddingVertical: 30,
    alignItems: "center",
  },
  successIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#00B77A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successTitle: {
    color: "#14201B",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    textAlign: "center",
  },
  successGameTitle: {
    color: "#33433C",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 6,
  },
  successText: {
    color: "#66766F",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 5,
  },
  waitlistIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F0F5F3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  submittedIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#00B77A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  paymentSubmittedBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.58)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  paymentSubmittedCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: "center",

    shadowColor: "#14201B",
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.16,
    shadowRadius: 26,
    elevation: 12,
  },

  paymentSubmittedIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E7F8F1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  paymentSubmittedTitle: {
    color: "#14201B",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    textAlign: "center",
  },

  paymentSubmittedSubtitle: {
    color: "#66766F",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 8,
  },

  paymentSubmittedAmountCard: {
    width: "100%",
    minHeight: 72,
    borderRadius: 17,
    backgroundColor: "#EAF8F3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 22,
  },

  paymentSubmittedLockCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  paymentSubmittedAmountContent: {
    justifyContent: "center",
  },

  paymentSubmittedAmount: {
    color: "#14201B",
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "900",
  },

  paymentSubmittedAmountLabel: {
    color: "#66766F",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    marginTop: 1,
  },

  paymentSubmittedButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: "#00B77A",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },

  paymentSubmittedButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
});
