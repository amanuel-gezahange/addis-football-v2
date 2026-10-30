export const LIGHT_COLORS = {
  background: "#F7F8FA",
  surface: "#FFFFFF",
  surfaceAlt: "#F0F5F3",
  surfaceRaised: "#E8F0EC",

  primary: "#00B77A",
  primaryPressed: "#009B68",
  primarySoft: "#E7F8F1",

  text: "#14201B",
  textSecondary: "#66766F",
  textMuted: "#8A9791",

  border: "#DDE6E2",
  borderStrong: "#CBD8D2",

  success: "#00B77A",
  warning: "#F59E0B",
  danger: "#D92D3A",

  white: "#FFFFFF",
  black: "#000000",
} as const;

export const DARK_COLORS = {
  // Main background from the old Addis Football design
  background: "#03131B",

  // Cards / panels
  surface: "#0B2630",
  surfaceAlt: "#0D3040",
  surfaceRaised: "#103442",

  // Cyan / blue accent from the old Addis Football design
  primary: "#20C2F2",
  primaryPressed: "#10A9D8",
  primarySoft: "#0C3140",

  // Text
  text: "#F7FAFC",
  textSecondary: "#91A5B0",
  textMuted: "#687F8B",

  // Borders / dividers
  border: "#17404D",
  borderStrong: "#245463",

  // Status colors
  success: "#20C2F2",
  warning: "#F5A623",
  danger: "#FF5A67",

  white: "#FFFFFF",
  black: "#000000",
} as const;

// Keep existing screens on the current light theme
// until they are connected to useTheme().
export const COLORS = LIGHT_COLORS;

export type AppColors =
  | typeof LIGHT_COLORS
  | typeof DARK_COLORS;

export type ThemeMode = "light" | "dark";