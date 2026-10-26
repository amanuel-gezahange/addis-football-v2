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
  // ==========================================================
  // CORS
  // ==========================================================

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  // ==========================================================
  // METHOD
  // ==========================================================

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed." },
      405
    );
  }

  // ==========================================================
  // CRON AUTHENTICATION
  // ==========================================================
  //
  // This function uses the Supabase service-role key.
  // It must only be callable by our trusted scheduled job.
  //
  // Expected header:
  //
  // Authorization: Bearer <CRON_SECRET>
  //
  // ==========================================================

  const cronSecret =
    Deno.env.get("CRON_SECRET");

  if (!cronSecret) {
    console.error(
      "CRON_SECRET is not configured."
    );

    return jsonResponse(
      { error: "Server configuration error." },
      500
    );
  }

  const authHeader =
    req.headers.get("Authorization");

  if (
    authHeader !== `Bearer ${cronSecret}`
  ) {
    return jsonResponse(
      { error: "Unauthorized." },
      401
    );
  }

  try {
    // ========================================================
    // SERVER CONFIGURATION
    // ========================================================

    const chapaSecretKey =
      Deno.env.get("CHAPA_SECRET_KEY");

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    if (
      !chapaSecretKey ||
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      console.error(
        "Missing required server configuration."
      );

      return jsonResponse(
        {
          error:
            "Server configuration error.",
        },
        500
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

    // ========================================================
    // 1. FIND REFUNDS THAT NEED VERIFICATION
    // ========================================================
    //
    // Only check payments that:
    // - were successfully paid
    // - have a Chapa refund reference
    // - have not already been finalized as refunded
    //
    // Keep each scheduled batch small.
    // ========================================================

    const {
      data: payments,
      error: paymentsError,
    } = await admin
      .from("payments")
      .select(`
        id,
        booking_id,
        user_id,
        game_id,
        provider,
        status,
        refund_reference,
        refund_status
      `)
      .eq("provider", "chapa")
      .eq("status", "paid")
      .not(
        "refund_reference",
        "is",
        null
      )
      .neq(
        "refund_status",
        "refunded"
      )
      .order(
        "refund_requested_at",
        {
          ascending: true,
          nullsFirst: true,
        }
      )
      .limit(25);

    if (paymentsError) {
      console.error(
        "Could not load pending refunds:",
        paymentsError.message
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
      !payments ||
      payments.length === 0
    ) {
      return jsonResponse({
        success: true,
        checked: 0,
        refunded: 0,
        processing: 0,
        reversed: 0,
        errors: 0,
        message:
          "No pending refunds found.",
      });
    }

    let checked = 0;
    let refunded = 0;
    let processing = 0;
    let reversed = 0;
    let errors = 0;

    const results: Array<{
      payment_id: number;
      booking_id: number | null;
      result: string;
    }> = [];

    // ========================================================
    // 2. VERIFY EACH REFUND
    // ========================================================

    for (const payment of payments) {
      checked++;

      const refundReference =
        String(
          payment.refund_reference ??
            ""
        ).trim();

      if (!refundReference) {
        errors++;

        results.push({
          payment_id: payment.id,
          booking_id:
            payment.booking_id,
          result:
            "missing_refund_reference",
        });

        continue;
      }

      // ======================================================
      // ASK CHAPA FOR REAL REFUND STATUS
      // ======================================================

      let verifyResponse: Response;

      try {
        verifyResponse =
          await fetch(
            `https://api.chapa.co/v1/refund/${encodeURIComponent(
              refundReference
            )}/verify`,
            {
              method: "GET",
              headers: {
                Authorization:
                  `Bearer ${chapaSecretKey}`,
                Accept:
                  "application/json",
              },
            }
          );
      } catch (networkError) {
        console.error(
          `Chapa refund verification network error for payment ${payment.id}:`,
          networkError instanceof Error
            ? networkError.message
            : "Unknown network error"
        );

        errors++;

        results.push({
          payment_id: payment.id,
          booking_id:
            payment.booking_id,
          result:
            "chapa_network_error",
        });

        continue;
      }

      let chapaData: any = null;

      try {
        chapaData =
          await verifyResponse.json();
      } catch {
        chapaData = null;
      }

      if (!verifyResponse.ok) {
        console.error(
          `Chapa refund verification failed for payment ${payment.id}:`,
          verifyResponse.status
        );

        errors++;

        results.push({
          payment_id: payment.id,
          booking_id:
            payment.booking_id,
          result:
            "chapa_verification_error",
        });

        continue;
      }

      const refundStatus =
        String(
          chapaData?.data?.status ??
            chapaData?.status ??
            ""
        )
          .trim()
          .toLowerCase();

      if (!refundStatus) {
        errors++;

        results.push({
          payment_id: payment.id,
          booking_id:
            payment.booking_id,
          result:
            "unknown_refund_status",
        });

        continue;
      }

      // ======================================================
      // 3. REFUND COMPLETED
      // ======================================================
      //
      // Use our atomic RPC so payments + bookings finalize
      // together.
      // ======================================================

      if (refundStatus === "refunded") {
        const {
          data: finalization,
          error: finalizationError,
        } = await admin.rpc(
          "finalize_chapa_refund",
          {
            p_payment_id:
              payment.id,

            p_refund_reference:
              refundReference,
          }
        );

        if (finalizationError) {
          console.error(
            `Atomic refund finalization failed for payment ${payment.id}:`,
            finalizationError.message
          );

          errors++;

          results.push({
            payment_id:
              payment.id,
            booking_id:
              payment.booking_id,
            result:
              "finalization_error",
          });

          continue;
        }

        refunded++;

        results.push({
          payment_id:
            payment.id,

          booking_id:
            finalization?.booking_id ??
            payment.booking_id,

          result:
            finalization?.already_finalized
              ? "already_refunded"
              : "refunded",
        });

        continue;
      }

      // ======================================================
      // 4. REFUND REVERSED
      // ======================================================
      //
      // Keep the booking refund_pending so the problem remains
      // visible rather than falsely showing the user refunded.
      // ======================================================

      if (refundStatus === "reversed") {
        const {
          error: reversedError,
        } = await admin
          .from("payments")
          .update({
            refund_status:
              "reversed",
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            payment.id
          );

        if (reversedError) {
          console.error(
            `Could not save reversed status for payment ${payment.id}:`,
            reversedError.message
          );

          errors++;

          results.push({
            payment_id:
              payment.id,
            booking_id:
              payment.booking_id,
            result:
              "reversed_save_error",
          });

          continue;
        }

        reversed++;

        results.push({
          payment_id:
            payment.id,
          booking_id:
            payment.booking_id,
          result:
            "reversed",
        });

        continue;
      }

      // ======================================================
      // 5. REFUND STILL PROCESSING
      // ======================================================
      //
      // Store Chapa's latest status. The next scheduled run
      // will check it again.
      // ======================================================

      const {
        error: statusError,
      } = await admin
        .from("payments")
        .update({
          refund_status:
            refundStatus,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          payment.id
        );

      if (statusError) {
        console.error(
          `Could not save refund status for payment ${payment.id}:`,
          statusError.message
        );

        errors++;

        results.push({
          payment_id:
            payment.id,
          booking_id:
            payment.booking_id,
          result:
            "status_save_error",
        });

        continue;
      }

      processing++;

      results.push({
        payment_id:
          payment.id,
        booking_id:
          payment.booking_id,
        result:
          refundStatus,
      });
    }

    // ========================================================
    // 6. BATCH SUMMARY
    // ========================================================

    return jsonResponse({
      success: true,
      checked,
      refunded,
      processing,
      reversed,
      errors,
      results,
    });
  } catch (error) {
    console.error(
      "Unexpected pending refund verification error:",
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