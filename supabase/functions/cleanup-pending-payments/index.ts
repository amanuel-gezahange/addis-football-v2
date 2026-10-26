import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHAPA_SECRET_KEY = Deno.env.get("CHAPA_SECRET_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const TIMEOUT_MINUTES = 10;
const BATCH_SIZE = 25;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function normalizeStatus(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function getTransaction(verifyJson: any) {
  return verifyJson?.data?.data ?? verifyJson?.data ?? null;
}

Deno.serve(async (req) => {
  // ==========================================================
  // METHOD
  // ==========================================================

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed" },
      405
    );
  }

  // ==========================================================
  // CRON AUTHENTICATION
  // ==========================================================
  //
  // This function uses the Supabase service-role key, so it
  // must never be publicly callable.
  //
  // The scheduled job must send:
  //
  // Authorization: Bearer <CRON_SECRET>
  //
  // Never put the actual CRON_SECRET value in this source file.
  // ==========================================================

  if (!CRON_SECRET) {
    console.error("CRON_SECRET is not configured.");

    return jsonResponse(
      { error: "Server configuration error" },
      500
    );
  }

  const authHeader = req.headers.get("Authorization");

  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return jsonResponse(
      { error: "Unauthorized" },
      401
    );
  }

  // ==========================================================
  // REQUIRED SERVER CONFIGURATION
  // ==========================================================

  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !CHAPA_SECRET_KEY
  ) {
    console.error(
      "Missing required server configuration."
    );

    return jsonResponse(
      { error: "Server configuration error" },
      500
    );
  }

  try {
    const cutoff = new Date(
      Date.now() - TIMEOUT_MINUTES * 60 * 1000
    ).toISOString();

    // Only process payment attempts that have been pending
    // longer than our reservation timeout.
    const { data: payments, error: paymentsError } =
      await supabase
        .from("payments")
        .select(
          `
            id,
            booking_id,
            user_id,
            game_id,
            provider_reference,
            amount,
            currency,
            status,
            created_at
          `
        )
        .eq("provider", "chapa")
        .eq("status", "pending")
        .not("booking_id", "is", null)
        .lte("created_at", cutoff)
        .order("created_at", { ascending: true })
        .limit(BATCH_SIZE);

    if (paymentsError) {
      console.error(
        "Pending payment query failed:",
        paymentsError.message
      );

      return jsonResponse(
        { error: "Could not load pending payments." },
        500
      );
    }

    const results: any[] = [];

    for (const payment of payments ?? []) {
      try {
        const txRef = payment.provider_reference;

        if (!txRef) {
          results.push({
            payment_id: payment.id,
            result: "skipped_missing_tx_ref",
          });

          continue;
        }

        // IMPORTANT:
        // Always ask Chapa before releasing the reserved seat.
        const verifyResponse = await fetch(
          `https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(
            txRef
          )}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
              Accept: "application/json",
            },
          }
        );

        if (!verifyResponse.ok) {
          console.error(
            "Chapa verification HTTP error:",
            payment.id,
            verifyResponse.status
          );

          results.push({
            payment_id: payment.id,
            result: "chapa_verification_error",
          });

          // Never release a seat when Chapa could not be checked.
          continue;
        }

        const verifyJson = await verifyResponse.json();
        const transaction = getTransaction(verifyJson);

        const transactionStatus = normalizeStatus(
          transaction?.status
        );

        const verifiedTxRef =
          transaction?.tx_ref ??
          transaction?.txRef ??
          transaction?.reference_id ??
          null;

        const verifiedAmount = Number(
          transaction?.amount
        );

        const verifiedCurrency = String(
          transaction?.currency ?? ""
        ).toUpperCase();

        const expectedAmount = Number(
          payment.amount
        );

        const paymentMatches =
          verifiedTxRef === txRef &&
          Number.isFinite(verifiedAmount) &&
          verifiedAmount === expectedAmount &&
          verifiedCurrency === "ETB";

        // ======================================================
        // PAYMENT SUCCEEDED
        // ======================================================

        if (
          transactionStatus === "success" &&
          paymentMatches
        ) {
          const chapaTransactionReference =
            transaction?.reference ?? null;

          // The payment actually succeeded even though the
          // player left the app. Finalize the booking.
          const {
            data: booking,
            error: bookingError,
          } = await supabase
            .from("bookings")
            .select(
              "id, status, payment_status, game_id"
            )
            .eq("id", payment.booking_id)
            .maybeSingle();

          if (bookingError) {
            console.error(
              "Booking lookup failed:",
              payment.id,
              bookingError.message
            );

            results.push({
              payment_id: payment.id,
              result: "booking_lookup_error",
            });

            continue;
          }

          if (!booking) {
            // Keep the successful payment for manual review.
            // Never silently expire a successful Chapa payment.
            await supabase
              .from("payments")
              .update({
                status: "paid",
                paid_at: new Date().toISOString(),
                provider_transaction_reference:
                  chapaTransactionReference,
              })
              .eq("id", payment.id);

            results.push({
              payment_id: payment.id,
              result:
                "paid_but_booking_missing_manual_review",
            });

            continue;
          }

          const {
            data: game,
            error: gameError,
          } = await supabase
            .from("games")
            .select("id, status")
            .eq("id", payment.game_id)
            .maybeSingle();

          if (gameError) {
            console.error(
              "Game lookup failed:",
              payment.id,
              gameError.message
            );

            results.push({
              payment_id: payment.id,
              result: "game_lookup_error",
            });

            continue;
          }

          const gameCancelled =
            !game || game.status === "cancelled";

          const bookingUpdate = gameCancelled
            ? {
                status: "cancelled_by_organizer",
                payment_status: "refund_pending",
                price_paid: expectedAmount,
              }
            : {
                status: "confirmed",
                payment_status: "paid",
                price_paid: expectedAmount,
              };

          const {
            error: bookingUpdateError,
          } = await supabase
            .from("bookings")
            .update(bookingUpdate)
            .eq("id", booking.id);

          if (bookingUpdateError) {
            console.error(
              "Booking finalize failed:",
              payment.id,
              bookingUpdateError.message
            );

            results.push({
              payment_id: payment.id,
              result: "booking_finalize_error",
            });

            continue;
          }

          const {
            error: paymentUpdateError,
          } = await supabase
            .from("payments")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              provider_transaction_reference:
                chapaTransactionReference,
            })
            .eq("id", payment.id);

          if (paymentUpdateError) {
            console.error(
              "Payment finalize failed:",
              payment.id,
              paymentUpdateError.message
            );

            results.push({
              payment_id: payment.id,
              result: "payment_finalize_error",
            });

            continue;
          }

          results.push({
            payment_id: payment.id,
            result: gameCancelled
              ? "paid_refund_pending"
              : "paid_confirmed",
          });

          continue;
        }

        // ======================================================
        // SUCCESS RESPONSE DOES NOT MATCH OUR PAYMENT
        // ======================================================

        if (
          transactionStatus === "success" &&
          !paymentMatches
        ) {
          // A successful provider response that doesn't match
          // our stored transaction must NEVER be auto-finalized
          // or released.
          console.error(
            "Successful Chapa transaction mismatch:",
            payment.id
          );

          results.push({
            payment_id: payment.id,
            result:
              "successful_transaction_mismatch",
          });

          continue;
        }

        // ======================================================
        // PAYMENT DID NOT SUCCEED
        // ======================================================
        //
        // Chapa says this old payment is not successful.
        // The existing RPC restores the reserved spot,
        // marks the payment expired and removes the
        // temporary booking.
        // ======================================================

        const {
          data: expireData,
          error: expireError,
        } = await supabase.rpc(
          "expire_paid_reservation",
          {
            p_payment_id: payment.id,
          }
        );

        if (expireError) {
          console.error(
            "Expiration failed:",
            payment.id,
            expireError.message
          );

          results.push({
            payment_id: payment.id,
            result: "expiration_error",
          });

          continue;
        }

        results.push({
          payment_id: payment.id,
          result: "expired",
          details: expireData,
        });
      } catch (paymentError) {
        console.error(
          "Cleanup item failed:",
          payment.id,
          paymentError
        );

        results.push({
          payment_id: payment.id,
          result: "unexpected_item_error",
        });
      }
    }

    return jsonResponse({
      success: true,
      checked: payments?.length ?? 0,
      results,
    });
  } catch (error) {
    console.error(
      "Cleanup failed:",
      error
    );

    return jsonResponse(
      {
        error: "Cleanup failed.",
      },
      500
    );
  }
});