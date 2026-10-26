import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed." },
      405
    );
  }

  try {
    const chapaSecretKey =
      Deno.env.get("CHAPA_SECRET_KEY");

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const supabaseAnonKey =
      Deno.env.get("SUPABASE_ANON_KEY");

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (
      !chapaSecretKey ||
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey
    ) {
      console.error(
        "Missing required server configuration."
      );

      return jsonResponse(
        { error: "Server configuration error." },
        500
      );
    }

    // ---------------------------------------------------------
    // 1. Authenticate organizer/admin
    // ---------------------------------------------------------

    const authHeader =
      req.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse(
        { error: "Unauthorized." },
        401
      );
    }

    const userClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse(
        { error: "Invalid session." },
        401
      );
    }

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // ---------------------------------------------------------
    // 2. Read game_id
    // ---------------------------------------------------------

    let body: {
      game_id?: number;
    };

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        { error: "Invalid request body." },
        400
      );
    }

    const gameId =
      Number(body.game_id);

    if (
      !Number.isInteger(gameId) ||
      gameId <= 0
    ) {
      return jsonResponse(
        { error: "Valid game_id is required." },
        400
      );
    }

    // ---------------------------------------------------------
    // 3. Load caller profile
    // ---------------------------------------------------------

    const {
      data: profile,
      error: profileError,
    } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile
    ) {
      return jsonResponse(
        { error: "Profile not found." },
        404
      );
    }

    if (
      profile.role !== "admin" &&
      profile.role !== "organizer"
    ) {
      return jsonResponse(
        {
          error:
            "Only organizers or admins can process game refunds.",
        },
        403
      );
    }

    // ---------------------------------------------------------
    // 4. Load cancelled game
    // ---------------------------------------------------------

    const {
      data: game,
      error: gameError,
    } = await admin
      .from("games")
      .select(
        "id, title, status, created_by"
      )
      .eq("id", gameId)
      .single();

    if (
      gameError ||
      !game
    ) {
      return jsonResponse(
        { error: "Game not found." },
        404
      );
    }

    if (
      profile.role !== "admin" &&
      game.created_by !== user.id
    ) {
      return jsonResponse(
        {
          error:
            "You cannot process refunds for this game.",
        },
        403
      );
    }

    if (
      game.status !== "cancelled"
    ) {
      return jsonResponse(
        {
          error:
            "Game must be cancelled before refunds are processed.",
        },
        409
      );
    }

    // ---------------------------------------------------------
    // 5. Find bookings waiting for refunds
    // ---------------------------------------------------------

    const {
      data: bookings,
      error: bookingsError,
    } = await admin
      .from("bookings")
      .select(
        "id, user_id, game_id, status, payment_status, price_paid"
      )
      .eq("game_id", gameId)
      .eq(
        "payment_status",
        "refund_pending"
      );

    if (bookingsError) {
      console.error(
        "Could not load refund bookings:",
        bookingsError.message
      );

      return jsonResponse(
        {
          error:
            "Could not load pending refunds.",
        },
        500
      );
    }

    if (
      !bookings ||
      bookings.length === 0
    ) {
      return jsonResponse({
        success: true,
        game_id: gameId,
        found: 0,
        initiated: 0,
        already_submitted: 0,
        failed: 0,
        message:
          "No refunds are waiting to be processed.",
      });
    }

    // ---------------------------------------------------------
    // 6. Process each refund
    //
    // IMPORTANT:
    // We process sequentially instead of firing every request
    // at Chapa simultaneously.
    // ---------------------------------------------------------

    let initiated = 0;
    let alreadySubmitted = 0;
    let failed = 0;

    const results: Array<{
      booking_id: number;
      payment_id?: number;
      result: string;
    }> = [];

    for (const booking of bookings) {
      // -------------------------------------------------------
      // Find the original successful Chapa payment
      // -------------------------------------------------------

      const {
        data: payment,
        error: paymentError,
      } = await admin
        .from("payments")
        .select(`
          id,
          booking_id,
          user_id,
          game_id,
          provider,
          provider_reference,
          provider_transaction_reference,
          amount,
          currency,
          status,
          refund_reference,
          refund_status
        `)
        .eq(
          "booking_id",
          booking.id
        )
        .eq(
          "user_id",
          booking.user_id
        )
        .eq(
          "game_id",
          gameId
        )
        .eq(
          "provider",
          "chapa"
        )
        .eq(
          "status",
          "paid"
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle();

      if (
        paymentError ||
        !payment
      ) {
        console.error(
          `Paid payment not found for booking ${booking.id}.`
        );

        failed++;

        results.push({
          booking_id:
            booking.id,
          result:
            "payment_not_found",
        });

        continue;
      }

      // -------------------------------------------------------
      // Refund already submitted previously.
      //
      // Do NOT send another refund request.
      // -------------------------------------------------------

      if (
        payment.refund_reference
      ) {
        alreadySubmitted++;

        results.push({
          booking_id:
            booking.id,
          payment_id:
            payment.id,
          result:
            "already_submitted",
        });

        continue;
      }

      // -------------------------------------------------------
      // Refund requires Chapa's actual transaction reference.
      // -------------------------------------------------------

      const chapaTransactionReference =
        String(
          payment.provider_transaction_reference ??
            ""
        ).trim();

      if (
        !chapaTransactionReference
      ) {
        console.error(
          `Missing Chapa transaction reference for payment ${payment.id}.`
        );

        failed++;

        results.push({
          booking_id:
            booking.id,
          payment_id:
            payment.id,
          result:
            "missing_transaction_reference",
        });

        continue;
      }

      if (
        String(
          payment.currency
        ).toUpperCase() !== "ETB"
      ) {
        failed++;

        results.push({
          booking_id:
            booking.id,
          payment_id:
            payment.id,
          result:
            "invalid_currency",
        });

        continue;
      }

      // -------------------------------------------------------
      // 7. Ask Chapa to initiate full refund
      //
      // We intentionally omit amount so this is a full refund.
      // -------------------------------------------------------

      let refundResponse: Response;

      try {
        refundResponse =
          await fetch(
            `https://api.chapa.co/v1/refund/${encodeURIComponent(
              chapaTransactionReference
            )}`,
            {
              method: "POST",
              headers: {
                Authorization:
                  `Bearer ${chapaSecretKey}`,
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json",
              },
              body:
                JSON.stringify({}),
            }
          );
      } catch (networkError) {
        console.error(
          `Could not reach Chapa for booking ${booking.id}:`,
          networkError instanceof Error
            ? networkError.message
            : "Unknown network error"
        );

        failed++;

        results.push({
          booking_id:
            booking.id,
          payment_id:
            payment.id,
          result:
            "chapa_network_error",
        });

        continue;
      }

      let chapaData: any = null;

      try {
        chapaData =
          await refundResponse.json();
      } catch {
        chapaData = null;
      }

      if (!refundResponse.ok) {
        console.error(
          `Chapa refund initiation failed for booking ${booking.id}:`,
          refundResponse.status
        );

        failed++;

        results.push({
          booking_id:
            booking.id,
          payment_id:
            payment.id,
          result:
            "chapa_refund_error",
        });

        continue;
      }

      // -------------------------------------------------------
      // Chapa refund initiation returns ref_id.
      // -------------------------------------------------------

      const refundReference =
        String(
          chapaData?.data?.ref_id ??
            chapaData?.ref_id ??
            ""
        ).trim();

      if (!refundReference) {
        console.error(
          `Chapa returned no refund reference for booking ${booking.id}.`
        );

        failed++;

        results.push({
          booking_id:
            booking.id,
          payment_id:
            payment.id,
          result:
            "missing_refund_reference",
        });

        continue;
      }

      const returnedRefundStatus =
        String(
          chapaData?.data?.status ??
            chapaData?.status ??
            "initiated"
        ).toLowerCase();

      // -------------------------------------------------------
      // 8. Save refund reference
      //
      // Booking stays refund_pending until Chapa verification
      // confirms the refund is actually complete.
      // -------------------------------------------------------

      const {
        error: saveError,
      } = await admin
        .from("payments")
        .update({
          refund_reference:
            refundReference,

          refund_status:
            returnedRefundStatus ||
            "initiated",

          refund_requested_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          payment.id
        )
        .is(
          "refund_reference",
          null
        );

      if (saveError) {
        // Important:
        // Chapa may already have accepted this refund.
        // We MUST NOT automatically retry here because that
        // could create ambiguity / duplicate refund attempts.
        console.error(
          `Refund accepted by Chapa but could not save reference for payment ${payment.id}:`,
          saveError.message
        );

        failed++;

        results.push({
          booking_id:
            booking.id,
          payment_id:
            payment.id,
          result:
            "refund_reference_save_failed",
        });

        continue;
      }

      initiated++;

      results.push({
        booking_id:
          booking.id,
        payment_id:
          payment.id,
        result:
          "refund_initiated",
      });
    }

    // ---------------------------------------------------------
    // 9. Return batch result
    // ---------------------------------------------------------

    return jsonResponse({
      success: true,

      game_id:
        gameId,

      found:
        bookings.length,

      initiated,

      already_submitted:
        alreadySubmitted,

      failed,

      results,

      message:
        failed > 0
          ? "Game refunds were processed, but some require attention."
          : "Game refunds were submitted successfully.",
    });
  } catch (error) {
    console.error(
      "Unexpected game refund processing error:",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    return jsonResponse(
      {
        error:
          "Unexpected server error.",
      },
      500
    );
  }
});