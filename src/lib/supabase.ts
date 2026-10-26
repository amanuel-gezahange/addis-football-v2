import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      // Native apps need persistent storage.
      // On web, Supabase uses the browser's normal storage.
      ...(Platform.OS !== "web"
        ? {
            storage: AsyncStorage,
          }
        : {}),

      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === "web",
    },
  }
);