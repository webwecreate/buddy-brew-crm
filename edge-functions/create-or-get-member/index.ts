// Supabase Edge Function: create-or-get-member
// Verifies a LINE LIFF ID token server-side, then creates or fetches the
// matching member row. The anon key never touches the members table directly —
// this function is the only door in, using the service role key.
//
// Deploy: supabase functions deploy create-or-get-member
// Required secrets: LIFF_CHANNEL_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

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
    const { idToken } = await req.json();
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
    const displayName = linePayload.name ?? "สมาชิก";
    const pictureUrl = linePayload.picture ?? null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: existing, error: selectError } = await supabase
      .from("members")
      .select("id, display_name, picture_url, tier, point, created_at")
      .eq("line_user_id", lineUserId)
      .maybeSingle();

    if (selectError) {
      console.error("select members failed:", selectError.message);
      return new Response(JSON.stringify({ error: selectError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existing) {
      return new Response(JSON.stringify({ member: existing, isNew: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: created, error: insertError } = await supabase
      .from("members")
      .insert({ line_user_id: lineUserId, display_name: displayName, picture_url: pictureUrl })
      .select("id, display_name, picture_url, tier, point, created_at")
      .single();

    if (insertError) {
      console.error("insert member failed:", insertError.message);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ member: created, isNew: true }), {
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
