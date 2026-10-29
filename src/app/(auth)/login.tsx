import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { Image as ExpoImage } from "expo-image";
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
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../constants/colors";
import { useLanguage } from "../../i18n/LanguageContext";
import { supabase } from "../../lib/supabase";

const LOGIN_HERO = require("../../../assets/images/home.jpg");
const GOOGLE_ICON = require("../../../assets/images/google-g-icon.png");

const NATIVE_REDIRECT_URL = "addisfootball://auth/callback";

/*
 * Replace these with your real public URLs.
 */
const TERMS_URL = "YOUR_TERMS_URL";
const PRIVACY_URL = "YOUR_PRIVACY_URL";

export default function LoginScreen() {
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

  async function openLegalLink(url: string) {
    if (!url || url.startsWith("YOUR_")) {
      showMessage(
        "Coming soon",
        "This page is not available yet.",
      );
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        throw new Error("This link could not be opened.");
      }

      await Linking.openURL(url);
    } catch (error) {
      console.log("Legal link error:", error);

      showMessage(
        "Unable to open page",
        "Please try again.",
      );
    }
  }

  async function finishNativeOAuth(url: string) {
    console.log("OAuth callback URL:", url);

    const parsed = Linking.parse(url);

    const queryParams = parsed.queryParams ?? {};

    const code =
      typeof queryParams.code === "string"
        ? queryParams.code
        : null;

    if (code) {
      console.log("OAuth callback contains PKCE code");

      const { data, error } =
        await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.log(
          "OAuth code exchange error:",
          error,
        );

        throw error;
      }

      if (!data.session) {
        throw new Error(
          "Authentication completed but no session was returned.",
        );
      }

      console.log(
        "OAuth session created successfully",
      );

      router.replace("/");
      return;
    }

    /*
     * Support implicit-flow tokens too.
     *
     * Depending on the OAuth/Supabase configuration,
     * access_token and refresh_token may be returned
     * in the URL fragment instead of query parameters.
     */
    const hashIndex = url.indexOf("#");

    if (hashIndex !== -1) {
      const hash = url.substring(hashIndex + 1);

      const hashParams = new URLSearchParams(hash);

      const accessToken =
        hashParams.get("access_token");

      const refreshToken =
        hashParams.get("refresh_token");

      const errorDescription =
        hashParams.get("error_description");

      if (errorDescription) {
        throw new Error(
          decodeURIComponent(errorDescription),
        );
      }

      if (accessToken && refreshToken) {
        console.log(
          "OAuth callback contains session tokens",
        );

        const { data, error } =
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

        if (error) {
          console.log(
            "OAuth setSession error:",
            error,
          );

          throw error;
        }

        if (!data.session) {
          throw new Error(
            "Authentication completed but no session was returned.",
          );
        }

        console.log(
          "OAuth session restored successfully",
        );

        router.replace("/");
        return;
      }
    }

    /*
     * Final check in case Supabase already persisted
     * the session before the callback was processed.
     */
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (session) {
      console.log(
        "Existing OAuth session found successfully",
      );

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
    console.log(
      "Starting native OAuth:",
      provider,
    );

    console.log(
      "Native redirect URL:",
      NATIVE_REDIRECT_URL,
    );

    const { data, error } =
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: NATIVE_REDIRECT_URL,

          /*
           * Critical for native:
           * Supabase gives us the provider URL,
           * but we open it ourselves.
           */
          skipBrowserRedirect: true,
        },
      });

    if (error) {
      console.log(
        "Supabase OAuth start error:",
        error,
      );

      throw error;
    }

    if (!data?.url) {
      throw new Error(
        "Supabase did not return an OAuth URL.",
      );
    }

    console.log("Opening OAuth provider...");

    const result =
      await WebBrowser.openAuthSessionAsync(
        data.url,
        NATIVE_REDIRECT_URL,
      );

    console.log(
      "OAuth browser result type:",
      result.type,
    );

    if (
      result.type === "cancel" ||
      result.type === "dismiss"
    ) {
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

    console.log(
      "OAuth finished without a callback URL:",
      result,
    );
  }

  async function handleGoogleSignIn() {
    if (loading) return;

    try {
      Keyboard.dismiss();

      setLoadingProvider("google");

      /*
       * WEB
       */
      if (Platform.OS === "web") {
        const redirectTo =
          `${window.location.origin}/auth/callback`;

        console.log(
          "Google web redirect:",
          redirectTo,
        );

        const { error } =
          await supabase.auth.signInWithOAuth({
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

      /*
       * IOS / ANDROID
       */
      await startNativeOAuth("google");
    } catch (error: any) {
      console.log(
        "Google sign-in error:",
        error,
      );

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

      /*
       * WEB
       */
      if (Platform.OS === "web") {
        const redirectTo =
          `${window.location.origin}/auth/callback`;

        console.log(
          "Telegram web redirect:",
          redirectTo,
        );

        const { error } =
          await supabase.auth.signInWithOAuth({
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

      /*
       * IOS / ANDROID
       */
      await startNativeOAuth(
        "custom:telegram",
      );
    } catch (error: any) {
      console.log(
        "Telegram sign-in error:",
        error,
      );

      showMessage(
        t("login.signInFailed"),
        error?.message || t("login.tryAgain"),
      );
    } finally {
      setLoadingProvider(null);
    }
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <View style={styles.container}>
        <ExpoImage
          source={LOGIN_HERO}
          style={styles.heroImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="high"
          transition={0}
        />

        <View
          pointerEvents="none"
          style={styles.photoOverlay}
        />

        <LinearGradient
          pointerEvents="none"
          colors={[
            "rgba(7,9,8,0)",
            "rgba(7,9,8,0.04)",
            "rgba(7,9,8,0.12)",
            "rgba(7,9,8,0.32)",
            "rgba(7,9,8,0.58)",
            "rgba(7,9,8,0.78)",
            "rgba(7,9,8,0.90)",
          ]}
          locations={[
            0,
            0.12,
            0.25,
            0.42,
            0.6,
            0.8,
            1,
          ]}
          style={styles.bottomGradient}
        />

        <View
          pointerEvents="box-none"
          style={styles.content}
        >
          <View style={styles.loginPanel}>
            <View style={styles.brandArea}>
              <Text style={styles.brandTitle}>
                Addis{" "}
                <Text style={styles.brandAccent}>
                  Football
                </Text>
              </Text>

              <Text style={styles.tagline}>
                Find your game.
              </Text>

              <Text style={styles.subTagline}>
                Join. Play. Connect.
              </Text>
            </View>

            <View style={styles.authArea}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  "login.continueGoogle",
                )}
                disabled={loading}
                onPress={handleGoogleSignIn}
                style={({ pressed }) => [
                  styles.googleButton,
                  pressed &&
                    !loading &&
                    styles.googleButtonPressed,
                  loading &&
                    styles.authButtonDisabled,
                ]}
              >
                {loadingProvider === "google" ? (
                  <ActivityIndicator
                    size="small"
                    color="#4285F4"
                  />
                ) : (
                  <>
                    <Image
                      source={GOOGLE_ICON}
                      style={styles.googleGImage}
                      resizeMode="contain"
                    />

                    <Text
                      style={styles.googleButtonText}
                    >
                      {t("login.continueGoogle")}
                    </Text>
                  </>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  "login.continueTelegram",
                )}
                disabled={loading}
                onPress={handleTelegramSignIn}
                style={({ pressed }) => [
                  styles.telegramButton,
                  pressed &&
                    !loading &&
                    styles.telegramButtonPressed,
                  loading &&
                    styles.authButtonDisabled,
                ]}
              >
                {loadingProvider ===
                "telegram" ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.telegramButtonText
                      }
                    >
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

                    <Text
                      style={
                        styles.telegramButtonText
                      }
                    >
                      {t(
                        "login.continueTelegram",
                      )}
                    </Text>
                  </>
                )}
              </Pressable>

              <View style={styles.legalRow}>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Terms of Service"
                  hitSlop={10}
                  onPress={() =>
                    openLegalLink(TERMS_URL)
                  }
                  style={({ pressed }) => [
                    styles.legalPressable,
                    pressed &&
                      styles.legalPressablePressed,
                  ]}
                >
                  <Text style={styles.legalText}>
                    Terms of Service
                  </Text>
                </Pressable>

                <Text
                  style={styles.legalDot}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  •
                </Text>

                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Privacy Policy"
                  hitSlop={10}
                  onPress={() =>
                    openLegalLink(PRIVACY_URL)
                  }
                  style={({ pressed }) => [
                    styles.legalPressable,
                    pressed &&
                      styles.legalPressablePressed,
                  ]}
                >
                  <Text style={styles.legalText}>
                    Privacy Policy
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0D0C",
  },

  container: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#0B0D0C",
  },

  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },

  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,8,6,0.08)",
  },

  bottomGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "66%",
  },

  content: {
    ...StyleSheet.absoluteFillObject,

    ...(Platform.OS === "web"
      ? {
          width: "100%",
          maxWidth: 560,
          alignSelf: "center",
        }
      : {}),
  },

  loginPanel: {
    position: "absolute",

    ...(Platform.OS === "web"
      ? {
          left: 26,
          right: 26,
          top: 40,
        }
      : {
          left: 26,
          right: 26,
          bottom: 30,
        }),
  },

  brandArea: {
    marginBottom: 28,
  },

  brandTitle: {
    color: "#FFFFFF",
    fontSize: 43,
    lineHeight: 50,
    fontWeight: "900",
    letterSpacing: -1.8,

    textShadowColor: "rgba(0,0,0,0.28)",
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 8,
  },

  brandAccent: {
    color: COLORS.primary,
  },

  tagline: {
    color: "#FFFFFF",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "500",
    marginTop: 8,
    letterSpacing: -0.4,

    textShadowColor: "rgba(0,0,0,0.32)",
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 6,
  },

  subTagline: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "400",
    marginTop: 2,
    letterSpacing: -0.3,

    textShadowColor: "rgba(0,0,0,0.32)",
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 6,
  },

  authArea: {
    width: "100%",
    gap: 12,
  },

  googleButton: {
    width: "100%",
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 13,

    paddingHorizontal: 22,

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",

    elevation: 6,

    shadowColor: "#000000",
    shadowOpacity: 0.2,
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
    height: 58,
    borderRadius: 29,
    backgroundColor: "#229ED9",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,

    paddingHorizontal: 22,

    borderWidth: 1,
    borderColor: "#4DC5F7",

    elevation: 6,

    shadowColor: "#000000",
    shadowOpacity: 0.22,
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

  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 12,
    paddingBottom: 2,
  },

  legalPressable: {
    paddingVertical: 4,
  },

  legalPressablePressed: {
    opacity: 0.6,
  },

  legalText: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },

  legalDot: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
  },

  authButtonDisabled: {
    opacity: 0.65,
  },
});