import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../constants/colors";
import { useLanguage } from "../../i18n/LanguageContext";
import { supabase } from "../../lib/supabase";

const GOOGLE_ICON = require("../../../assets/images/google-g-icon.png");

const NATIVE_REDIRECT_URL = "addisfootball://auth/callback";

export default function LoginScreen() {
  const { width, height } = useWindowDimensions();

  const isSmallScreen = width <= 375 || height <= 700;
  const isLargeScreen = width >= 430 && height >= 850;

  const horizontalPadding = isSmallScreen ? 18 : 26;

  const brandTitleSize = isSmallScreen ? 34 : isLargeScreen ? 46 : 43;
  const taglineSize = isSmallScreen ? 20 : isLargeScreen ? 25 : 24;
  const subTaglineSize = isSmallScreen ? 18 : isLargeScreen ? 22 : 21;

  const authButtonHeight = isSmallScreen ? 50 : isLargeScreen ? 60 : 58;

  const brandBottomSpacing = isSmallScreen ? 18 : 26;
  const authGap = isSmallScreen ? 8 : 12;

  const [loadingProvider, setLoadingProvider] = useState<
    "google" | "telegram" | null
  >(null);

  const { t } = useLanguage();

  const loading = loadingProvider !== null;

  function showMessage(title: string, message: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
      return;
    }

    Alert.alert(title, message);
  }

  async function finishNativeOAuth(url: string) {
    console.log("OAuth callback URL:", url);

    const parsed = Linking.parse(url);

    const queryParams = parsed.queryParams ?? {};

    const code =
      typeof queryParams.code === "string" ? queryParams.code : null;

    if (code) {
      console.log("OAuth callback contains PKCE code");

      const { data, error } =
        await supabase.auth.exchangeCodeForSession(code);

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

    /*
     * Support implicit-flow tokens too.
     */
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

  async function startNativeOAuth(
    provider: "google" | "custom:telegram",
  ) {
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

    if (
      result.type === "success" &&
      "url" in result &&
      result.url
    ) {
      await finishNativeOAuth(result.url);
      return;
    }

    console.log("OAuth finished without a callback URL:", result);
  }

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

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        {/* Background */}

        <LinearGradient
          pointerEvents="none"
          colors={["#06231A", "#031711", "#020D09"]}
          locations={[0, 0.52, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        <View pointerEvents="none" style={styles.topGlow} />

        {/* =====================================================
            TOP VISUAL
        ====================================================== */}

        <View pointerEvents="none" style={styles.visualArea}>
          <View style={styles.pitch}>
            <View style={styles.pitchHalfLine} />

            <View style={styles.pitchCenterCircle}>
              <View style={styles.pitchCenterDot} />
            </View>

            <View style={styles.penaltyAreaLeft} />
            <View style={styles.penaltyAreaRight} />
          </View>
        </View>

        {/* Soft transition between artwork and content */}

        <LinearGradient
          pointerEvents="none"
          colors={[
            "rgba(2,13,9,0)",
            "rgba(2,13,9,0.65)",
            "#020D09",
          ]}
          locations={[0, 0.58, 1]}
          style={styles.visualFade}
        />

        {/* =====================================================
            BOTTOM LOGIN SECTION
        ====================================================== */}

        <View
          style={[
            styles.loginSection,
            {
              paddingHorizontal: horizontalPadding,
              paddingBottom: isSmallScreen ? 16 : 30,
            },
          ]}
        >
          <View
            style={[
              styles.brandArea,
              {
                marginBottom: brandBottomSpacing,
              },
            ]}
          >
            <Text
              style={[
                styles.brandTitle,
                {
                  fontSize: brandTitleSize,
                  lineHeight: brandTitleSize + 7,
                },
              ]}
            >
              Addis <Text style={styles.brandAccent}>Football</Text>
            </Text>

            <Text
              style={[
                styles.tagline,
                {
                  fontSize: taglineSize,
                  lineHeight: taglineSize + 6,
                },
              ]}
            >
              Find your game.
            </Text>

            <Text
              style={[
                styles.subTagline,
                {
                  fontSize: subTaglineSize,
                  lineHeight: subTaglineSize + 7,
                },
              ]}
            >
              Join. Play. Connect.
            </Text>
          </View>

          <View style={[styles.authArea, { gap: authGap }]}>
            {/* GOOGLE */}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("login.continueGoogle")}
              disabled={loading}
              onPress={handleGoogleSignIn}
              style={({ pressed }) => [
                styles.googleButton,
                {
                  height: authButtonHeight,
                  borderRadius: authButtonHeight / 2,
                },
                pressed && !loading && styles.googleButtonPressed,
                loading && styles.authButtonDisabled,
              ]}
            >
              {loadingProvider === "google" ? (
                <ActivityIndicator size="small" color="#4285F4" />
              ) : (
                <>
                  <Image
                    source={GOOGLE_ICON}
                    style={styles.googleGImage}
                    resizeMode="contain"
                  />

                  <Text style={styles.googleButtonText}>
                    {t("login.continueGoogle")}
                  </Text>
                </>
              )}
            </Pressable>

            {/* TELEGRAM */}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("login.continueTelegram")}
              disabled={loading}
              onPress={handleTelegramSignIn}
              style={({ pressed }) => [
                styles.telegramButton,
                {
                  height: authButtonHeight,
                  borderRadius: authButtonHeight / 2,
                },
                pressed && !loading && styles.telegramButtonPressed,
                loading && styles.authButtonDisabled,
              ]}
            >
              {loadingProvider === "telegram" ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />

                  <Text style={styles.telegramButtonText}>
                    {t("login.connecting")}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="paper-plane"
                    size={24}
                    color="#FFFFFF"
                  />

                  <Text style={styles.telegramButtonText}>
                    {t("login.continueTelegram")}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020D09",
  },

  container: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#020D09",
  },

  /* =========================================================
     BACKGROUND
  ========================================================== */

  topGlow: {
    position: "absolute",
    top: -180,
    alignSelf: "center",
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: "rgba(15,190,110,0.08)",
  },

  /* =========================================================
     TOP VISUAL
  ========================================================== */

  visualArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "48%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  pitch: {
    position: "absolute",
    top: "9%",
    width: "88%",
    height: "72%",

    borderWidth: 1,
    borderColor: "rgba(94,218,153,0.14)",
    borderRadius: 22,

    overflow: "hidden",
  },

  pitchHalfLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 1,
    backgroundColor: "rgba(94,218,153,0.14)",
  },

  pitchCenterCircle: {
    position: "absolute",
    left: "50%",
    top: "50%",

    width: 116,
    height: 116,

    marginLeft: -58,
    marginTop: -58,

    borderRadius: 58,

    borderWidth: 1,
    borderColor: "rgba(94,218,153,0.16)",

    alignItems: "center",
    justifyContent: "center",
  },

  pitchCenterDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(94,218,153,0.28)",
  },

  penaltyAreaLeft: {
    position: "absolute",
    left: -1,
    top: "29%",

    width: "19%",
    height: "42%",

    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: "rgba(94,218,153,0.14)",
  },

  penaltyAreaRight: {
    position: "absolute",
    right: -1,
    top: "29%",

    width: "19%",
    height: "42%",

    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: "rgba(94,218,153,0.14)",
  },

  visualFade: {
    position: "absolute",
    top: "34%",
    left: 0,
    right: 0,
    height: "18%",
  },

  /* =========================================================
     LOGIN SECTION
  ========================================================== */

  loginSection: {
    position: "absolute",

    left: 0,
    right: 0,
    bottom: 0,

    zIndex: 20,
    elevation: 20,

    ...(Platform.OS === "web"
      ? {
          width: "100%",
          maxWidth: 560,
          alignSelf: "center",
          left: "auto",
          right: "auto",
        }
      : {}),
  },

  brandArea: {
    width: "100%",
  },

  brandTitle: {
    color: "#FFFFFF",

    fontSize: 43,
    lineHeight: 50,

    fontWeight: "900",
    letterSpacing: -1.8,
  },

  brandAccent: {
    color: COLORS.primary,
  },

  tagline: {
    color: "#FFFFFF",

    fontSize: 24,
    lineHeight: 30,

    fontWeight: "600",

    marginTop: 8,

    letterSpacing: -0.4,
  },

  subTagline: {
    color: "rgba(255,255,255,0.68)",

    fontSize: 21,
    lineHeight: 28,

    fontWeight: "400",

    marginTop: 2,

    letterSpacing: -0.3,
  },

  /* =========================================================
     AUTH
  ========================================================== */

  authArea: {
    width: "100%",
  },

  googleButton: {
    width: "100%",

    backgroundColor: "#FFFFFF",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 13,

    paddingHorizontal: 22,

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",

    elevation: 5,

    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
  },

  googleGImage: {
    width: 24,
    height: 24,
  },

  googleButtonText: {
    color: "#1C211F",

    fontSize: 16,
    lineHeight: 21,

    fontWeight: "800",
    textAlign: "center",
  },

  googleButtonPressed: {
    transform: [{ scale: 0.99 }],
    backgroundColor: "#F4F5F4",
  },

  telegramButton: {
    width: "100%",

    backgroundColor: "#229ED9",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 12,

    paddingHorizontal: 22,

    borderWidth: 1,
    borderColor: "#4DC5F7",

    elevation: 5,

    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
  },

  telegramButtonPressed: {
    backgroundColor: "#168BC4",
    transform: [{ scale: 0.99 }],
  },

  telegramButtonText: {
    color: "#FFFFFF",

    fontSize: 16,
    lineHeight: 21,

    fontWeight: "800",
    textAlign: "center",

    flexShrink: 1,
  },

  authButtonDisabled: {
    opacity: 0.65,
  },
});
