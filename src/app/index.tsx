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

    async function initializeAuth() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;

        if (!session?.user) {
          setIsLoggedIn(false);
          setRole("player");
          setLoading(false);
          return;
        }

        setIsLoggedIn(true);
        await loadRole(session.user.id);
      } catch (error) {
        console.error("Error checking session:", error);

        if (active) {
          setIsLoggedIn(false);
          setRole("player");
          setLoading(false);
        }
      }
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "SIGNED_OUT") {
        setIsLoggedIn(false);
        setRole("player");
        setLoading(false);
        return;
      }

      if (event === "SIGNED_IN" && session?.user) {
        setIsLoggedIn(true);
        loadRole(session.user.id);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadRole(userId: string) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

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
      console.error("Error loading user role:", error);
      setRole("player");
    } finally {
      setLoading(false);
    }
  }

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
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
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