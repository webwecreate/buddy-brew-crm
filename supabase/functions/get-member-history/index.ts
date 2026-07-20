// Supabase Edge Function: get-member-history
// Called by Buddy Book. Verifies the LINE ID token the same way as create-or-get-member,
// then returns the matching member's own recent points_transactions rows. Customers aren't
// Supabase Auth users, so there's no authenticated-role RLS path — identity has to be
// proven via the LINE token, same pattern as create-or-get-member/claim-order-token.

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
    const { idToken, limit } = await req.json();
    if (!idToken) {
      return new Response(JSON.stringify({ error: "missing idToken" }), {
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id")
      .eq("line_user_id", lineUserId)
      .single();

    if (memberError || !member) {
      return new Response(JSON.stringify({ error: "member not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: history, error: historyError } = await supabase
      .from("points_transactions")
      .select("point_change, reason, created_at, menu_items(name)")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(limit && limit > 0 ? limit : 3);

    if (historyError) {
      console.error("history lookup failed:", historyError.message);
      return new Response(JSON.stringify({ error: historyError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formatted = history.map((row) => ({
      point_change: row.point_change,
      label: row.menu_items?.name ?? row.reason ?? "ปรับแต้ม",
      created_at: row.created_at,
    }));

    return new Response(JSON.stringify({ history: formatted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("unhandled error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
