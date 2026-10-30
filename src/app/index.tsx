import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { COLORS } from "../constants/colors";
import { supabase } from "../lib/supabase";

type UserRole = "player" | "organizer" | "admin";

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState<UserRole>("player");

  useEffect(() => {
    let active = true;
    let authRequestId = 0;

    async function loadRole(userId: string, requestId: number) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

        if (!active || requestId !== authRequestId) {
          return;
        }

        if (error) {
          console.error("Error loading user role:", error);
          setRole("player");
          return;
        }

        const profileRole = data?.role;

        if (profileRole === "organizer") {
          setRole("organizer");
        } else if (profileRole === "admin") {
          setRole("admin");
        } else {
          setRole("player");
        }
      } catch (error) {
        if (!active || requestId !== authRequestId) {
          return;
        }

        console.error("Error loading user role:", error);
        setRole("player");
      } finally {
        if (active && requestId === authRequestId) {
          setLoading(false);
        }
      }
    }

    async function handleAuthenticatedUser(userId: string) {
      const requestId = ++authRequestId;

      setIsLoggedIn(true);
      setLoading(true);

      await loadRole(userId, requestId);
    }

    async function initializeAuth() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!active) {
          return;
        }

        if (error) {
          console.error("Error restoring session:", error);
        }

        if (!session?.user) {
          ++authRequestId;

          setIsLoggedIn(false);
          setRole("player");
          setLoading(false);
          return;
        }

        await handleAuthenticatedUser(session.user.id);
      } catch (error) {
        if (!active) {
          return;
        }

        console.error("Error checking session:", error);

        ++authRequestId;

        setIsLoggedIn(false);
        setRole("player");
        setLoading(false);
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) {
        return;
      }

      if (event === "SIGNED_OUT") {
        ++authRequestId;

        setIsLoggedIn(false);
        setRole("player");
        setLoading(false);
        return;
      }

      if (
        (event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED") &&
        session?.user
      ) {
        void handleAuthenticatedUser(session.user.id);
      }
    });

    void initializeAuth();

    return () => {
      active = false;
      ++authRequestId;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F7F8FA",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!isLoggedIn) {
    return <Redirect href="/login" />;
  }

  if (role === "organizer") {
    return <Redirect href="/(organizer)" />;
  }

  return <Redirect href="/(tabs)" />;
}