import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";

import CreateGameForm from "@/components/games/CreateGameForm";
import { supabase } from "@/lib/supabase";

export default function OrganizerCreateGameScreen() {
  const router = useRouter();

  const [organizerName, setOrganizerName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrganizer();
  }, []);

  async function loadOrganizer() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      if (!user) {
        router.replace("/");
        return;
      }

      const [profileResult, applicationResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .maybeSingle(),

          supabase
            .from("organizer_applications")
            .select("organizer_name")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

      if (profileResult.error) {
        console.log(
          "Load organizer profile error:",
          profileResult.error.message,
        );
      }

      if (applicationResult.error) {
        console.log(
          "Load organizer application error:",
          applicationResult.error.message,
        );
      }

      const resolvedOrganizerName =
        profileResult.data?.full_name?.trim() ||
        applicationResult.data?.organizer_name?.trim() ||
        "Organizer";

      setOrganizerName(resolvedOrganizerName);
    } catch (error) {
      console.log("Load organizer error:", error);
      setOrganizerName("Organizer");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <CreateGameForm
      organizerName={organizerName}
      allowOrganizerEditing={false}
      onBack={() =>
        router.replace("/(organizer)/games")
      }
      onSuccess={() =>
        router.replace("/(organizer)/games")
      }
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    alignItems: "center",
    justifyContent: "center",
  },
});