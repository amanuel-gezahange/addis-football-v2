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
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../constants/colors";
import { useLanguage } from "../../i18n/LanguageContext";
import { supabase } from "../../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

const LOGIN_HERO = require("../../../assets/images/home.jpg");
const GOOGLE_ICON = require("../../../assets/images/google-g-icon.png");

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

  async function handleGoogleSignIn() {
    if (loading) return;

    try {
      Keyboard.dismiss();
      setLoadingProvider("google");

      // WEB
      if (Platform.OS === "web") {
        const redirectTo = `${window.location.origin}/auth/callback`;

        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
          },
        });

        if (error) {
          console.log("Google web OAuth error:", error);
          showMessage(t("login.signInFailed"), error.message);
          setLoadingProvider(null);
        }

        return;
      }

      // NATIVE
      const redirectTo = Linking.createURL("auth/callback", {
        scheme: "addisfootball",
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.log("Google OAuth error:", error);
        showMessage(t("login.signInFailed"), error.message);
        return;
      }

      if (!data?.url) {
        showMessage(t("login.signInFailed"), t("login.unableToStart"));
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );

      if (result.type !== "success" || !result.url) {
        return;
      }

      const returnedUrl = result.url;
      const parsedUrl = Linking.parse(returnedUrl);

      const code =
        typeof parsedUrl.queryParams?.code === "string"
          ? parsedUrl.queryParams.code
          : null;

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          console.log("Google code exchange error:", exchangeError);
          showMessage(t("login.signInFailed"), exchangeError.message);
          return;
        }

        router.replace("/");
        return;
      }

      // Implicit-flow fallback
      const hashIndex = returnedUrl.indexOf("#");

      if (hashIndex !== -1) {
        const hash = returnedUrl.substring(hashIndex + 1);
        const params = new URLSearchParams(hash);

        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.log("Google session error:", sessionError);
            showMessage(t("login.signInFailed"), sessionError.message);
            return;
          }

          router.replace("/");
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.replace("/");
        return;
      }

      showMessage(t("login.signInFailed"), t("login.sessionFailed"));
    } catch (error: any) {
      console.log("Google sign in error:", error);

      showMessage(
        t("login.somethingWrong"),
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

      // WEB
      if (Platform.OS === "web") {
        const redirectTo = `${window.location.origin}/auth/callback`;

        const { error } = await supabase.auth.signInWithOAuth({
          provider: "custom:telegram",
          options: {
            redirectTo,
          },
        });

        if (error) {
          console.log("Telegram web OAuth error:", error);
          showMessage(t("login.signInFailed"), error.message);
          setLoadingProvider(null);
        }

        return;
      }

      // NATIVE
      const redirectTo = Linking.createURL("auth/callback", {
        scheme: "addisfootball",
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "custom:telegram",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.log("Telegram OAuth error:", error);
        showMessage(t("login.signInFailed"), error.message);
        return;
      }

      if (!data?.url) {
        showMessage(t("login.signInFailed"), t("login.unableToStart"));
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );

      if (result.type !== "success" || !result.url) {
        return;
      }

      const returnedUrl = result.url;
      const parsedUrl = Linking.parse(returnedUrl);

      const code =
        typeof parsedUrl.queryParams?.code === "string"
          ? parsedUrl.queryParams.code
          : null;

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          console.log("Telegram code exchange error:", exchangeError);
          showMessage(t("login.signInFailed"), exchangeError.message);
          return;
        }

        router.replace("/");
        return;
      }

      // Implicit-flow fallback
      const hashIndex = returnedUrl.indexOf("#");

      if (hashIndex !== -1) {
        const hash = returnedUrl.substring(hashIndex + 1);
        const params = new URLSearchParams(hash);

        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.log("Telegram session error:", sessionError);
            showMessage(t("login.signInFailed"), sessionError.message);
            return;
          }

          router.replace("/");
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.replace("/");
        return;
      }

      showMessage(t("login.signInFailed"), t("login.sessionFailed"));
    } catch (error: any) {
      console.log("Telegram sign in error:", error);

      showMessage(
        t("login.somethingWrong"),
        error?.message || t("login.tryAgain"),
      );
    } finally {
      setLoadingProvider(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <Image
          source={LOGIN_HERO}
          style={styles.heroImage}
          resizeMode="cover"
        />

        {/* Very light overlay over the whole photograph */}
        <View style={styles.photoOverlay} />

        {/* Smooth transition from the photograph into the dark login area */}
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
          locations={[0, 0.12, 0.25, 0.42, 0.6, 0.8, 1]}
          style={styles.bottomGradient}
        />

        <View style={styles.content}>
          <View style={styles.brandArea}>
            <Text style={styles.brandTitle}>
              Addis <Text style={styles.brandAccent}>Football</Text>
            </Text>

            <Text style={styles.tagline}>Find your game.</Text>

            <Text style={styles.subTagline}>Join. Play. Connect.</Text>
          </View>

          <View style={styles.authArea}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("login.continueGoogle")}
              disabled={loading}
              onPress={handleGoogleSignIn}
              style={({ pressed }) => [
                styles.googleButton,
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

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("login.continueTelegram")}
              disabled={loading}
              onPress={handleTelegramSignIn}
              style={({ pressed }) => [
                styles.telegramButton,
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

            <View style={styles.legalRow}>
              <Text style={styles.legalText}>Terms of Service</Text>
              <Text style={styles.legalDot}>•</Text>
              <Text style={styles.legalText}>Privacy Policy</Text>
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
  flex: 1,
  justifyContent: "flex-end",
  paddingHorizontal: 26,
  paddingBottom: Platform.OS === "web" ? 30 : 18,
  zIndex: 10,

  ...(Platform.OS === "web"
    ? {
        width: "100%",
        maxWidth: 560,
        alignSelf: "center",
      }
    : {}),
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