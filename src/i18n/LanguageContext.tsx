import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import { Language, translate } from "./index";

const LANGUAGE_STORAGE_KEY = "addis-football-language";

type LanguageContextType = {
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  t: (key: string) => string;
  ready: boolean;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadLanguage();
  }, []);

  async function loadLanguage() {
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);

      if (saved === "en" || saved === "am" || saved === "om") {
        setLanguageState(saved);
      }
    } catch (error) {
      console.log("Language load error:", error);
    } finally {
      setReady(true);
    }
  }

  async function setLanguage(nextLanguage: Language) {
    setLanguageState(nextLanguage);

    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch (error) {
      console.log("Language save error:", error);
    }
  }

  function t(key: string) {
    return translate(language, key);
  }

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        ready,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }

  return context;
}
