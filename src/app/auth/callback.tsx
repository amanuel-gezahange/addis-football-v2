import { router } from "expo-router";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { COLORS } from "../../constants/colors";
import { supabase } from "../../lib/supabase";

export default function AuthCallbackScreen() {
  useEffect(() => {
    finishSignIn();
  }, []);

  async function finishSignIn() {
    try {
      // Web OAuth can return tokens in the URL hash:
      // #access_token=...&refresh_token=...
      if (Platform.OS === "web") {
        const hash = window.location.hash;

        if (hash) {
          const params = new URLSearchParams(
            hash.substring(1),
          );

          const accessToken =
            params.get("access_token");

          const refreshToken =
            params.get("refresh_token");

          if (accessToken && refreshToken) {
            const { error } =
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

            if (error) {
              console.log(
                "Callback session error:",
                error,
              );
            }
          }
        }

        // Also support PKCE ?code=...
        const searchParams =
          new URLSearchParams(
            window.location.search,
          );

        const code =
          searchParams.get("code");

        if (code) {
          const { error } =
            await supabase.auth.exchangeCodeForSession(
              code,
            );

          if (error) {
            console.log(
              "Callback code exchange error:",
              error,
            );
          }
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.replace("/");
        return;
      }

      router.replace("/login");
    } catch (error) {
      console.log(
        "Auth callback error:",
        error,
      );

      router.replace("/login");
    }
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator
        size="large"
        color={COLORS.primary}
      />

      <Text style={styles.text}>
        Signing you in...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
container: {
  flex: 1,
  backgroundColor: "#F7F8FA",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
},

text: {
  color: "#66766F",
  fontSize: 16,
  fontWeight: "600",
  marginTop: 16,
},
});