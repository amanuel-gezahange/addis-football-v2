import { useLocalSearchParams, useRouter } from "expo-router";

import EditGameForm from "../games/EditGameForm";

export default function OrganizerEditGameScreen() {
  const router = useRouter();

  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  return (
    <EditGameForm
      gameId={id ?? ""}
      allowOrganizerEditing={false}
      onBack={() => router.replace("/(organizer)/games")}
      onSuccess={() => router.replace("/(organizer)/games")}
    />
  );
}