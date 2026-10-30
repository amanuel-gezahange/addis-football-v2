import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AppColors,
  DARK_COLORS,
  LIGHT_COLORS,
  ThemeMode,
} from "../constants/colors";

const THEME_STORAGE_KEY = "addis-football-theme";

type ThemeContextValue = {
  theme: ThemeMode;
  colors: AppColors;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
};

const ThemeContext =
  createContext<ThemeContextValue | null>(null);

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({
  children,
}: ThemeProviderProps) {
  const [theme, setThemeState] =
    useState<ThemeMode>("light");

  useEffect(() => {
    void loadSavedTheme();
  }, []);

  async function loadSavedTheme() {
    try {
      const savedTheme =
        await AsyncStorage.getItem(
          THEME_STORAGE_KEY,
        );

      if (
        savedTheme === "light" ||
        savedTheme === "dark"
      ) {
        setThemeState(savedTheme);
      }
    } catch (error) {
      console.log(
        "Could not load theme:",
        error,
      );
    }
  }

  const setTheme = useCallback(
    async (nextTheme: ThemeMode) => {
      setThemeState(nextTheme);

      try {
        await AsyncStorage.setItem(
          THEME_STORAGE_KEY,
          nextTheme,
        );
      } catch (error) {
        console.log(
          "Could not save theme:",
          error,
        );
      }
    },
    [],
  );

  const toggleTheme = useCallback(async () => {
    const nextTheme: ThemeMode =
      theme === "dark" ? "light" : "dark";

    await setTheme(nextTheme);
  }, [setTheme, theme]);

  const colors =
    theme === "dark"
      ? DARK_COLORS
      : LIGHT_COLORS;

  const value = useMemo(
    () => ({
      theme,
      colors,
      isDark: theme === "dark",
      setTheme,
      toggleTheme,
    }),
    [colors, setTheme, theme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider",
    );
  }

  return context;
}