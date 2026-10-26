/**
 * Global Addis Football theme.
 *
 * Main visual direction:
 * Midnight Navy + Addis Green
 */

import "@/global.css";

import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#14201B",
    background: "#F7F8FA",
    backgroundElement: "#FFFFFF",
    backgroundSelected: "#F0F5F3",
    textSecondary: "#66766F",
    surface: "#FFFFFF",
    surfaceSoft: "#F0F5F3",
    border: "#DDE6E2",
    primary: "#00B77A",
    primaryText: "#F7F8FA",
    textMuted: "#8A9791",
    success: "#00B77A",
    successDark: "#009B68",
    danger: "#FF5A62",
    dangerDark: "#D92D3A",
    skill: "#F0F5F3",
    skillText: "#14201B",
  },
  dark: {
    text: "#14201B",
    textSecondary: "#66766F",
    textMuted: "#8A9791",
    background: "#F7F8FA",
    backgroundElement: "#FFFFFF",
    backgroundSelected: "#F0F5F3",
    surface: "#FFFFFF",
    surfaceSoft: "#F0F5F3",
    border: "#DDE6E2",
    primary: "#00B77A",
    primaryText: "#F7F8FA",
    success: "#00B77A",
    successDark: "#009B68",
    danger: "#FF5A62",
    dangerDark: "#D92D3A",
    skill: "#F0F5F3",
    skillText: "#14201B",
  },
} as const;

export type ThemeColor =
  keyof typeof Colors.light &
  keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS system font */
    sans: "system-ui",

    /** iOS serif font */
    serif: "ui-serif",

    /** iOS rounded font */
    rounded: "ui-rounded",

    /** iOS monospace font */
    mono: "ui-monospace",
  },

  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },

  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset =
  Platform.select({
    ios: 50,
    android: 80,
  }) ?? 0;

export const MaxContentWidth = 800;