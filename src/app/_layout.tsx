import { Stack } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";

import { LanguageProvider } from "../i18n/LanguageContext";

export default function RootLayout() {
  return (
    <LanguageProvider>
      {/* Web-only SEO metadata.
          Prevents expo-router/head from running on iOS/Android. */}
      {Platform.OS === "web" && (
        <Head>
          <title>
            Addis Football | Find & Join Football Games in Ethiopia
          </title>

          <meta
            name="description"
            content="Discover and join football games in Addis Ababa and across Ethiopia with Addis Football."
          />

          <meta name="robots" content="index, follow" />

          <meta
            property="og:title"
            content="Addis Football | Find & Join Football Games in Ethiopia"
          />

          <meta
            property="og:description"
            content="Discover and join football games in Addis Ababa and across Ethiopia with Addis Football."
          />

          <meta property="og:type" content="website" />

          <meta
            property="og:url"
            content="https://addisfootball.com/"
          />
        </Head>
      )}

      <StatusBar style="dark" />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: "#F7F8FA",
          },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(organizer)" />

        <Stack.Screen name="admin/create-game" />
        <Stack.Screen name="admin/edit-game" />
        <Stack.Screen name="admin/manage-games" />
      </Stack>
    </LanguageProvider>
  );
}