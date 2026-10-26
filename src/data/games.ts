import { Game } from "../types/game";

export const games: Game[] = [
  {
    id: "1",
    title: "Bole Evening Football",
    organizer: "Addis Football",
    area: "Bole, Addis Ababa",
    distance: "2.1 km",
    time: "7:00 PM to 9:00 PM",
    format: "6v6",
    skill: "Intermediate",
    price: 250,
    spotsLeft: 3,
    status: "available",
    image:
      "https://images.unsplash.com/photo-1553778263-73a83bab9b0c?auto=format&fit=crop&w=1200&q=85",
  },
  {
    id: "2",
    title: "CMC Night Football",
    organizer: "Addis Football",
    area: "CMC, Addis Ababa",
    distance: "6.4 km",
    time: "8:00 PM to 10:00 PM",
    format: "7v7",
    skill: "High-level",
    price: 300,
    spotsLeft: 0,
    status: "full",
    image:
    require("../../assets/images/cmc-football.png"),
  },
];