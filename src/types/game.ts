export type GameStatus = "available" | "full";

export type Game = {
  id: string;
  title: string;
  organizer: string;
  area: string;
  distance?: string | null;
  time: string;
  format: string;
  skill: string;
  price: number;
  spotsLeft: number;
  status: GameStatus;
  image: string;
};