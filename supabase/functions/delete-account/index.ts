import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey
    ) {
      throw new Error(
        "Missing required Supabase environment variables.",
      );
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization) {
      return new Response(
        JSON.stringify({
          error: "Missing authorization token.",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Client used only to verify the caller's JWT.
    const userClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized.",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const userId = user.id;

    // Administrative client.
    // The service-role key exists ONLY inside the Edge Function.
    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    /*
     * 1. Delete payment records.
     *
     * payments.user_id has:
     * - NOT NULL
     * - FK to profiles.id
     * - ON DELETE RESTRICT
     *
     * Therefore these must be removed before the profile.
     */
    const { error: paymentsError } = await adminClient
      .from("payments")
      .delete()
      .eq("user_id", userId);

    if (paymentsError) {
      console.error(
        "Delete payments error:",
        paymentsError,
      );

      throw new Error(
        "Unable to delete account payment data.",
      );
    }

    /*
     * 2. Delete bookings.
     *
     * notification_jobs referencing these bookings use
     * ON DELETE CASCADE, so those jobs will automatically
     * be removed.
     *
     * payments.booking_id uses SET NULL, but the user's
     * payment records were already removed above.
     */
    const { error: bookingsError } = await adminClient
      .from("bookings")
      .delete()
      .eq("user_id", userId);

    if (bookingsError) {
      console.error(
        "Delete bookings error:",
        bookingsError,
      );

      throw new Error(
        "Unable to delete account booking data.",
      );
    }

    /*
     * 3. Delete profile.
     *
     * games.created_by uses ON DELETE SET NULL,
     * so games previously created by an organizer
     * can remain without identifying the deleted user.
     */
    const { error: profileError } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.error(
        "Delete profile error:",
        profileError,
      );

      throw new Error(
        "Unable to delete profile.",
      );
    }

    /*
     * 4. Delete the Supabase Auth user last.
     */
    const { error: authDeleteError } =
      await adminClient.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error(
        "Delete auth user error:",
        authDeleteError,
      );

      throw new Error(
        "Unable to delete authentication account.",
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Delete account error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to delete account.";

    return new Response(
      JSON.stringify({
        error: message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});