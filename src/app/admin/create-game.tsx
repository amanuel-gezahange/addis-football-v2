import { useRouter } from "expo-router";

import CreateGameForm from "../../components/games/CreateGameForm";

export default function AdminCreateGameScreen() {
  const router = useRouter();

  return (
    <CreateGameForm
      organizerName="Addis Football"
      allowOrganizerEditing
      onBack={() =>
        router.replace("/admin/manage-games")
      }
      onSuccess={() =>
        router.replace("/admin/manage-games")
      }
    />
  );
}