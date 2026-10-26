import en from "./en";
import am from "./am";
import om from "./om";

export type Language = "en" | "am" | "om";

export const translations = {
  en,
  am,
  om,
};

export const languageOptions = [
  {
    code: "en" as Language,
    label: "English",
  },

  // Temporarily hidden until translations are updated.
  // Do not delete — re-enable later.
  /*
  {
    code: "am" as Language,
    label: "አማርኛ",
  },
  {
    code: "om" as Language,
    label: "Afaan Oromoo",
  },
  */
];

export function translate(
  language: Language,
  key: string
): string {
  const keys = key.split(".");

  let value: any =
    translations[language] ??
    translations.en;

  for (const part of keys) {
    value = value?.[part];

    if (value === undefined) {
      break;
    }
  }

  if (
    typeof value === "string"
  ) {
    return value;
  }

  // English fallback
  let fallback: any =
    translations.en;

  for (const part of keys) {
    fallback =
      fallback?.[part];

    if (fallback === undefined) {
      break;
    }
  }

  return typeof fallback === "string"
    ? fallback
    : key;
}