import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useLanguage } from "../../i18n/LanguageContext";
import { supabase } from "../../lib/supabase";

const GOOGLE_ICON = require("../../../assets/images/google-g-icon.png");

const NATIVE_REDIRECT_URL = "addisfootball://auth/callback";

/* =========================================================
   COLORS
========================================================= */

const CREAM = "#061513";
const INK = "#F4F7F5";
const GREEN = "#18D98B";
const MUTED = "#91A8A0";
const BORDER = "#DDE7E2";

/* =========================================================
   LOGIN
========================================================= */

export default function LoginScreen() {
  const { width, height } = useWindowDimensions();

  const isSmallScreen = width <= 375 || height <= 700;

  const isLargeScreen = width >= 430 && height >= 850;

  const horizontalPadding = isSmallScreen ? 24 : 30;

  const brandSize = isSmallScreen ? 57 : isLargeScreen ? 72 : 64;

  const [loadingProvider, setLoadingProvider] = useState<
    "google" | "telegram" | null
  >(null);

  const [showAuthSheet, setShowAuthSheet] = useState(false);

  const { t } = useLanguage();

  const loading = loadingProvider !== null;

  /* =======================================================
     SPORTS-TECH MOTION
  ======================================================== */

  const intro = useSharedValue(0);
  const pulse = useSharedValue(0);
  const orb = useSharedValue(0);
  const tacticalBall = useSharedValue(0);
  const tacticalPulse = useSharedValue(0);

  useEffect(() => {
    intro.value = withTiming(1, {
      duration: 850,
      easing: Easing.out(Easing.cubic),
    });

    pulse.value = withDelay(
      450,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: 2600,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0, {
            duration: 2600,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      ),
    );

    orb.value = withDelay(
      700,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: 3100,
            easing: Easing.inOut(Easing.cubic),
          }),
          withTiming(0, { duration: 900 }),
          withTiming(0, { duration: 1400 }),
        ),
        -1,
        false,
      ),
    );

    tacticalBall.value = withDelay(
      1100,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: 4200,
            easing: Easing.inOut(Easing.cubic),
          }),
          withTiming(1, { duration: 650 }),
          withTiming(0, { duration: 1 }),
          withTiming(0, { duration: 850 }),
        ),
        -1,
        false,
      ),
    );

    tacticalPulse.value = withDelay(
      900,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: 1100,
            easing: Easing.out(Easing.cubic),
          }),
          withTiming(0, {
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      ),
    );
  }, [intro, orb, pulse, tacticalBall, tacticalPulse]);

  const brandIntroStyle = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [{ translateY: interpolate(intro.value, [0, 1], [22, 0]) }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.16, 0.34]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.92, 1.08]) }],
  }));

  const orbStyle = useAnimatedStyle(() => {
    const p = orb.value;
    const x = interpolate(p, [0, 0.28, 0.62, 1], [-18, 58, 166, 282]);
    const y = interpolate(p, [0, 0.28, 0.62, 1], [34, -10, 18, -2]);
    const arc = Math.sin(p * Math.PI * 2) * -8;

    return {
      opacity: interpolate(p, [0, 0.08, 0.9, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: x },
        { translateY: y + arc },
        { scale: interpolate(p, [0, 0.5, 1], [0.8, 1.08, 0.86]) },
      ],
    };
  });

  const tacticalBallStyle = useAnimatedStyle(() => {
    const p = tacticalBall.value;

    const x = interpolate(
      p,
      [0, 0.18, 0.4, 0.62, 0.82, 1],
      [22, 92, 58, 190, 245, 302],
    );

    const y = interpolate(
      p,
      [0, 0.18, 0.4, 0.62, 0.82, 1],
      [188, 128, 72, 106, 48, 118],
    );

    return {
      opacity: interpolate(p, [0, 0.03, 0.94, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: interpolate(p, [0, 0.5, 1], [0.88, 1.08, 0.92]) },
      ],
    };
  });

  const tacticalPulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tacticalPulse.value, [0, 1], [0.12, 0.42]),
    transform: [
      { scale: interpolate(tacticalPulse.value, [0, 1], [0.72, 1.45]) },
    ],
  }));

  /* =======================================================
     MESSAGE
  ======================================================== */

  function showMessage(title: string, message: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);

      return;
    }

    Alert.alert(title, message);
  }

  /* =======================================================
     FINISH NATIVE OAUTH
  ======================================================== */

  async function finishNativeOAuth(url: string) {
    console.log("OAuth callback URL:", url);

    const parsed = Linking.parse(url);

    const queryParams = parsed.queryParams ?? {};

    const code = typeof queryParams.code === "string" ? queryParams.code : null;

    /* -----------------------------------------------------
       PKCE
    ------------------------------------------------------ */

    if (code) {
      console.log("OAuth callback contains PKCE code");

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.log("OAuth code exchange error:", error);

        throw error;
      }

      if (!data.session) {
        throw new Error(
          "Authentication completed but no session was returned.",
        );
      }

      console.log("OAuth session created successfully");

      router.replace("/");

      return;
    }

    /* -----------------------------------------------------
       IMPLICIT HASH TOKENS
    ------------------------------------------------------ */

    const hashIndex = url.indexOf("#");

    if (hashIndex !== -1) {
      const hash = url.substring(hashIndex + 1);

      const hashParams = new URLSearchParams(hash);

      const accessToken = hashParams.get("access_token");

      const refreshToken = hashParams.get("refresh_token");

      const errorDescription = hashParams.get("error_description");

      if (errorDescription) {
        throw new Error(decodeURIComponent(errorDescription));
      }

      if (accessToken && refreshToken) {
        console.log("OAuth callback contains session tokens");

        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,

          refresh_token: refreshToken,
        });

        if (error) {
          console.log("OAuth setSession error:", error);

          throw error;
        }

        if (!data.session) {
          throw new Error(
            "Authentication completed but no session was returned.",
          );
        }

        console.log("OAuth session restored successfully");

        router.replace("/");

        return;
      }
    }

    /* -----------------------------------------------------
       SESSION FALLBACK
    ------------------------------------------------------ */

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (session) {
      console.log("Existing OAuth session found successfully");

      router.replace("/");

      return;
    }

    throw new Error(
      "Login finished, but no authentication session was returned.",
    );
  }

  /* =======================================================
     START NATIVE OAUTH
  ======================================================== */

  async function startNativeOAuth(provider: "google" | "custom:telegram") {
    console.log("Starting native OAuth:", provider);

    console.log("Native redirect URL:", NATIVE_REDIRECT_URL);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,

      options: {
        redirectTo: NATIVE_REDIRECT_URL,

        skipBrowserRedirect: true,
      },
    });

    if (error) {
      console.log("Supabase OAuth start error:", error);

      throw error;
    }

    if (!data?.url) {
      throw new Error("Supabase did not return an OAuth URL.");
    }

    console.log("Opening OAuth provider...");

    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      NATIVE_REDIRECT_URL,
    );

    console.log("OAuth browser result type:", result.type);

    if (result.type === "cancel" || result.type === "dismiss") {
      return;
    }

    if (result.type === "success" && "url" in result && result.url) {
      await finishNativeOAuth(result.url);

      return;
    }

    console.log("OAuth finished without a callback URL:", result);
  }

  /* =======================================================
     GOOGLE
  ======================================================== */

  async function handleGoogleSignIn() {
    if (loading) return;

    try {
      Keyboard.dismiss();

      setLoadingProvider("google");

      if (Platform.OS === "web") {
        const redirectTo = `${window.location.origin}/auth/callback`;

        console.log("Google web redirect:", redirectTo);

        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",

          options: {
            redirectTo,
          },
        });

        if (error) {
          throw error;
        }

        return;
      }

      await startNativeOAuth("google");
    } catch (error: any) {
      console.log("Google sign-in error:", error);

      showMessage(
        t("login.signInFailed"),
        error?.message || t("login.tryAgain"),
      );
    } finally {
      setLoadingProvider(null);
    }
  }

  /* =======================================================
     TELEGRAM
  ======================================================== */

  async function handleTelegramSignIn() {
    if (loading) return;

    try {
      Keyboard.dismiss();

      setLoadingProvider("telegram");

      if (Platform.OS === "web") {
        const redirectTo = `${window.location.origin}/auth/callback`;

        console.log("Telegram web redirect:", redirectTo);

        const { error } = await supabase.auth.signInWithOAuth({
          provider: "custom:telegram",

          options: {
            redirectTo,
          },
        });

        if (error) {
          throw error;
        }

        return;
      }

      await startNativeOAuth("custom:telegram");
    } catch (error: any) {
      console.log("Telegram sign-in error:", error);

      showMessage(
        t("login.signInFailed"),
        error?.message || t("login.tryAgain"),
      );
    } finally {
      setLoadingProvider(null);
    }
  }

  /* =======================================================
     UI
  ======================================================== */

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.screen}>
        <View pointerEvents="none" style={styles.motionCanvas}>
          <Animated.View style={[styles.ambientGlow, glowStyle]} />

          <View style={styles.pitchGeometry}>
            <View style={styles.pitchLineTop} />
            <View style={styles.pitchLineBottom} />
            <View style={styles.pitchCircle} />
          </View>
        </View>
        <View
          style={[
            styles.page,
            {
              paddingHorizontal: horizontalPadding,

              paddingTop: isSmallScreen ? 28 : isLargeScreen ? 58 : 42,

              paddingBottom: isSmallScreen ? 14 : 20,
            },
          ]}
        >
          {/* SPORTS-TECH BRAND */}

          <View style={styles.hero}>
            <Animated.View style={[styles.brandBlock, brandIntroStyle]}>
              <Text
                style={[
                  styles.brand,
                  {
                    fontSize: brandSize,
                    lineHeight: brandSize * 0.88,
                  },
                ]}
              >
                ADDIS
              </Text>

              <View style={styles.footballBrandRow}>
                <Text
                  style={[
                    styles.brand,
                    styles.brandGreen,
                    {
                      fontSize: brandSize,
                      lineHeight: brandSize * 0.88,
                    },
                  ]}
                >
                  FOOTBALL
                </Text>

                <View style={styles.brandAccent} />
              </View>
            </Animated.View>

            <Text
              style={[styles.heroTitle, isSmallScreen && styles.heroTitleSmall]}
            >
              Your game starts here.
            </Text>

            <Text
              style={[styles.heroCopy, isSmallScreen && styles.heroCopySmall]}
            >
              Find and join football games
              {"\n"}
              around Addis Ababa.
            </Text>
          </View>

          <View pointerEvents="none" style={styles.themeBreathingRoom}>
            <View style={styles.tacticalStage}>
              <View style={styles.tacticalPitch}>
                <View style={styles.tacticalHalfway} />
                <View style={styles.tacticalCenterCircle} />

                <View style={[styles.tacticalBox, styles.tacticalBoxLeft]} />
                <View style={[styles.tacticalBox, styles.tacticalBoxRight]} />

                <View style={[styles.tacticalNode, { left: 24, top: 181 }]} />
                <View style={[styles.tacticalNode, { left: 92, top: 121 }]} />
                <View style={[styles.tacticalNode, { left: 58, top: 65 }]} />
                <View style={[styles.tacticalNode, { left: 190, top: 99 }]} />
                <View style={[styles.tacticalNode, { left: 245, top: 41 }]} />
                <View style={[styles.tacticalNode, { right: 23, top: 111 }]} />

                <View style={[styles.routeSegment, styles.routeOne]} />
                <View style={[styles.routeSegment, styles.routeTwo]} />
                <View style={[styles.routeSegment, styles.routeThree]} />
                <View style={[styles.routeSegment, styles.routeFour]} />
                <View style={[styles.routeSegment, styles.routeFive]} />

                <Animated.View
                  style={[styles.tacticalBallGlow, tacticalBallStyle]}
                >
                  <Animated.View
                    style={[styles.tacticalBallPulse, tacticalPulseStyle]}
                  />
                  <View style={styles.tacticalBallCore} />
                </Animated.View>
              </View>

              <View style={styles.tacticalCaptionRow}>
                <View style={styles.liveDot} />
                <Text style={styles.tacticalCaption}>FIND. JOIN. PLAY.</Text>
              </View>
            </View>
          </View>

          {/* GET STARTED */}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get started"
            onPress={() => setShowAuthSheet(true)}
            style={({ pressed }) => [
              styles.getStartedButton,

              isSmallScreen && styles.getStartedButtonSmall,

              pressed && styles.getStartedPressed,
            ]}
          >
            <Text style={styles.getStartedText}>Get started</Text>

            <View style={styles.arrowCircle}>
              <Ionicons
                name="arrow-forward"
                size={isSmallScreen ? 21 : 23}
                color="#FFFFFF"
              />
            </View>
          </Pressable>
        </View>

        {/* AUTH SHEET */}

        <Modal
          visible={showAuthSheet}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => {
            if (!loading) {
              setShowAuthSheet(false);
            }
          }}
        >
          <View style={styles.modalRoot}>
            <Pressable
              style={styles.backdrop}
              disabled={loading}
              onPress={() => setShowAuthSheet(false)}
            />

            <View style={styles.authSheet}>
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeading}>
                  <Text style={styles.sheetTitle}>
                    Welcome to Addis Football
                  </Text>

                  <Text style={styles.sheetSubtitle}>
                    Choose an account to continue.
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  disabled={loading}
                  onPress={() => setShowAuthSheet(false)}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.closeButton,

                    pressed && !loading && styles.providerPressed,
                  ]}
                >
                  <Ionicons name="close" size={21} color="#073B3C" />
                </Pressable>
              </View>

              <View style={styles.providerRow}>
                {/* GOOGLE */}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("login.continueGoogle")}
                  disabled={loading}
                  onPress={handleGoogleSignIn}
                  style={({ pressed }) => [
                    styles.providerButton,

                    pressed && !loading && styles.providerPressed,

                    loading && styles.authButtonDisabled,
                  ]}
                >
                  <View style={styles.providerIcon}>
                    {loadingProvider === "google" ? (
                      <ActivityIndicator size="small" color="#4285F4" />
                    ) : (
                      <Image
                        source={GOOGLE_ICON}
                        style={styles.googleIcon}
                        resizeMode="contain"
                      />
                    )}
                  </View>

                  <Text style={styles.providerText}>Google</Text>
                </Pressable>

                {/* TELEGRAM */}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("login.continueTelegram")}
                  disabled={loading}
                  onPress={handleTelegramSignIn}
                  style={({ pressed }) => [
                    styles.providerButton,

                    pressed && !loading && styles.providerPressed,

                    loading && styles.authButtonDisabled,
                  ]}
                >
                  <View style={[styles.providerIcon, styles.telegramIcon]}>
                    {loadingProvider === "telegram" ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons
                        name="paper-plane"
                        size={24}
                        color="#FFFFFF"
                        style={styles.telegramPlane}
                      />
                    )}
                  </View>

                  <Text style={styles.providerText}>Telegram</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* =======================================================
     SCREEN
  ======================================================== */

  safeArea: {
    flex: 1,
    backgroundColor: CREAM,
  },

  screen: {
    flex: 1,
    backgroundColor: CREAM,
    overflow: "hidden",
  },

  motionCanvas: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },

  ambientGlow: {
    position: "absolute",
    width: 430,
    height: 430,
    borderRadius: 215,
    right: -190,
    top: 120,
    backgroundColor: "#0D8F61",
  },

  pitchGeometry: {
    position: "absolute",
    left: -30,
    right: -30,
    top: "36%",
    height: 230,
    opacity: 0.12,
    transform: [{ rotate: "-7deg" }],
  },

  pitchLineTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 18,
    height: 1,
    backgroundColor: "#A9D8C5",
  },

  pitchLineBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 18,
    height: 1,
    backgroundColor: "#A9D8C5",
  },

  pitchCircle: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: "#A9D8C5",
    left: "50%",
    top: 40,
    marginLeft: -75,
  },

  motionOrb: {
    position: "absolute",
    left: 18,
    top: "42%",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(24,217,139,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },

  motionOrbCore: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: GREEN,
  },

  page: {
    flex: 1,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    justifyContent: "space-between",
  },

  /* =======================================================
     HERO
  ======================================================== */

  hero: {
    width: "100%",
    zIndex: 2,
  },

  brandBlock: {
    alignSelf: "flex-start",
    zIndex: 3,
  },

  brand: {
    color: INK,
    fontWeight: "900",
    letterSpacing: -3.5,
  },

  brandGreen: {
    color: GREEN,
  },

  footballBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },

  brandAccent: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginLeft: 10,
    marginTop: 10,
    backgroundColor: GREEN,
  },

  heroTitle: {
    marginTop: 36,

    color: INK,

    fontSize: 29,
    lineHeight: 35,

    fontWeight: "900",

    letterSpacing: -1,
  },

  heroTitleSmall: {
    marginTop: 27,

    fontSize: 24,
    lineHeight: 30,
  },

  heroCopy: {
    marginTop: 13,

    color: MUTED,

    fontSize: 17,
    lineHeight: 27,

    fontWeight: "600",

    letterSpacing: -0.35,
  },

  heroCopySmall: {
    fontSize: 16,
    lineHeight: 23,
  },

  /* =======================================================
     MOVING THEME SPACE
  ======================================================== */

  themeBreathingRoom: {
    flex: 1,
    minHeight: 260,
    justifyContent: "center",
  },

  tacticalStage: {
    width: "100%",
    marginTop: 18,
  },

  tacticalPitch: {
    height: 236,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(169,216,197,0.16)",
    backgroundColor: "rgba(10,48,41,0.34)",
    overflow: "hidden",
    position: "relative",
  },

  tacticalHalfway: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 1,
    backgroundColor: "rgba(169,216,197,0.12)",
  },

  tacticalCenterCircle: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: "rgba(169,216,197,0.12)",
    left: "50%",
    top: "50%",
    marginLeft: -46,
    marginTop: -46,
  },

  tacticalBox: {
    position: "absolute",
    width: 54,
    height: 116,
    top: 60,
    borderWidth: 1,
    borderColor: "rgba(169,216,197,0.10)",
  },

  tacticalBoxLeft: {
    left: -1,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },

  tacticalBoxRight: {
    right: -1,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },

  tacticalNode: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(169,216,197,0.34)",
  },

  routeSegment: {
    position: "absolute",
    height: 1,
    backgroundColor: "rgba(24,217,139,0.28)",
    transformOrigin: "left center",
  },

  routeOne: {
    left: 27,
    top: 184,
    width: 92,
    transform: [{ rotate: "-41deg" }],
  },

  routeTwo: {
    left: 61,
    top: 68,
    width: 75,
    transform: [{ rotate: "52deg" }],
  },

  routeThree: {
    left: 95,
    top: 124,
    width: 104,
    transform: [{ rotate: "-10deg" }],
  },

  routeFour: {
    left: 193,
    top: 102,
    width: 76,
    transform: [{ rotate: "-48deg" }],
  },

  routeFive: {
    left: 248,
    top: 44,
    width: 82,
    transform: [{ rotate: "62deg" }],
  },

  tacticalBallGlow: {
    position: "absolute",
    left: -7,
    top: -7,
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  tacticalBallPulse: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(24,217,139,0.22)",
  },

  tacticalBallCore: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: GREEN,
    shadowColor: GREEN,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },

  tacticalCaptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 13,
    paddingLeft: 4,
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREEN,
  },

  tacticalCaption: {
    color: "#6F9186",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 1.8,
  },

  /* =======================================================
     GET STARTED
  ======================================================== */

  getStartedButton: {
    width: "100%",

    marginTop: 18,

    minHeight: 66,

    borderRadius: 22,

    backgroundColor: GREEN,

    position: "relative",

    flexDirection: "row",

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 24,

    shadowColor: "#000000",

    shadowOpacity: 0.28,

    shadowRadius: 16,

    shadowOffset: {
      width: 0,
      height: 8,
    },

    elevation: 5,
  },

  getStartedButtonSmall: {
    minHeight: 58,

    borderRadius: 19,
  },

  getStartedPressed: {
    opacity: 0.91,

    transform: [
      {
        scale: 0.993,
      },
    ],
  },

  getStartedText: {
    color: "#FFFFFF",

    fontSize: 17,
    lineHeight: 22,

    fontWeight: "900",

    letterSpacing: -0.15,
  },

  arrowCircle: {
    position: "absolute",

    right: 10,

    width: 48,
    height: 48,

    borderRadius: 24,

    backgroundColor: "rgba(255,255,255,0.12)",

    alignItems: "center",
    justifyContent: "center",
  },

  /* =======================================================
     MODAL
  ======================================================== */

  modalRoot: {
    flex: 1,

    justifyContent: "flex-end",
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,

    backgroundColor: "rgba(4,32,28,0.44)",
  },

  authSheet: {
    width: "100%",
    maxWidth: 560,

    alignSelf: "center",

    backgroundColor: "#FFFFFF",

    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,

    paddingTop: 10,
    paddingHorizontal: 24,

    paddingBottom: Platform.OS === "ios" ? 34 : 26,

    shadowColor: "#000000",

    shadowOpacity: 0.12,

    shadowRadius: 24,

    shadowOffset: {
      width: 0,
      height: -6,
    },

    elevation: 18,
  },

  /* =======================================================
     AUTH SHEET HEADER
  ======================================================== */

  sheetHandle: {
    alignSelf: "center",

    width: 42,
    height: 4,

    borderRadius: 2,

    backgroundColor: "#D8E0DD",

    marginBottom: 20,
  },

  sheetHeader: {
    flexDirection: "row",

    alignItems: "flex-start",
    justifyContent: "space-between",

    gap: 14,
  },

  sheetHeading: {
    flex: 1,
  },

  sheetTitle: {
    color: "#073B3C",

    fontSize: 22,
    lineHeight: 28,

    fontWeight: "900",

    letterSpacing: -0.55,
  },

  sheetSubtitle: {
    marginTop: 4,

    color: "#7A8B86",

    fontSize: 14,
    lineHeight: 20,

    fontWeight: "500",
  },

  closeButton: {
    width: 36,
    height: 36,

    borderRadius: 18,

    backgroundColor: "#F1F5F3",

    alignItems: "center",
    justifyContent: "center",
  },

  /* =======================================================
     PROVIDERS
  ======================================================== */

  providerRow: {
    flexDirection: "row",

    gap: 14,

    marginTop: 24,
  },

  providerButton: {
    flex: 1,

    minHeight: 110,

    borderRadius: 20,

    borderWidth: 1,
    borderColor: BORDER,

    backgroundColor: "#FBFCFB",

    alignItems: "center",
    justifyContent: "center",

    gap: 10,
  },

  providerPressed: {
    opacity: 0.78,

    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  providerIcon: {
    width: 48,
    height: 48,

    borderRadius: 24,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#E6ECE9",

    alignItems: "center",
    justifyContent: "center",
  },

  googleIcon: {
    width: 25,
    height: 25,
  },

  telegramIcon: {
    backgroundColor: "#229ED9",

    borderColor: "#229ED9",
  },

  telegramPlane: {
    marginLeft: -2,

    marginTop: 1,
  },

  providerText: {
    color: "#073B3C",

    fontSize: 14,
    lineHeight: 18,

    fontWeight: "800",
  },

  authButtonDisabled: {
    opacity: 0.55,
  },
});
