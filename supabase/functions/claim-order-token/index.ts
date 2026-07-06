// Supabase Edge Function: claim-order-token
// Called by the customer's LIFF page after scanning the Staff Panel QR.
// Verifies the LINE ID token (same pattern as create-or-get-member), resolves the
// member row, then calls the atomic claim_order_token() Postgres function so the
// token can only ever be claimed once (race-safe).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, idToken } = await req.json();
    if (!token || !idToken) {
      return new Response(JSON.stringify({ error: "missing token or idToken" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: Deno.env.get("LIFF_CHANNEL_ID") ?? "",
      }),
    });

    if (!verifyRes.ok) {
      return new Response(JSON.stringify({ error: "invalid id token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const linePayload = await verifyRes.json();
    const lineUserId = linePayload.sub;
    const displayName = linePayload.name ?? "สมาชิก";
    const pictureUrl = linePayload.picture ?? null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: member, error: memberError } = await supabase
      .from("members")
      .upsert(
        { line_user_id: lineUserId, display_name: displayName, picture_url: pictureUrl },
        { onConflict: "line_user_id" },
      )
      .select("id, point")
      .single();

    if (memberError) {
      console.error("member upsert failed:", memberError.message);
      return new Response(JSON.stringify({ error: memberError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: claimResult, error: claimError } = await supabase.rpc("claim_order_token", {
      p_token: token,
      p_member_id: member.id,
    });

    if (claimError) {
      console.error("claim_order_token rpc failed:", claimError.message);
      return new Response(JSON.stringify({ error: claimError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!claimResult.success) {
      return new Response(JSON.stringify({ error: claimResult.error }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, point_awarded: claimResult.point_awarded, new_total: member.point + claimResult.point_awarded }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("unhandled error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
