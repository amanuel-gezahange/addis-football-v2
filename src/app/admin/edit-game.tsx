import { useLocalSearchParams, useRouter } from "expo-router";

import EditGameForm from "../games/EditGameForm";

export default function AdminEditGameScreen() {
  const router = useRouter();

  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  return (
    <EditGameForm
      gameId={id ?? ""}
      allowOrganizerEditing
      onBack={() => router.replace("/admin/manage-games")}
      onSuccess={() => router.replace("/admin/manage-games")}
    />
  );
}