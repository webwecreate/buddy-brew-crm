// Supabase Edge Function: create-order-token
// Called by Staff Panel. Given a menu item (+ optional bean choice), looks up its
// point_value and creates a single-use claim token the customer scans to collect points.
//
// NOTE: this endpoint has no staff-login check yet — that's a follow-up task once
// Staff Panel auth (Supabase email/password, Option A) is built. Fine for internal testing.

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
    const { menu_item_id, bean_option_id, channel } = await req.json();
    if (!menu_item_id) {
      return new Response(JSON.stringify({ error: "missing menu_item_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: menuItem, error: menuError } = await supabase
      .from("menu_items")
      .select("point_value")
      .eq("id", menu_item_id)
      .single();

    if (menuError || !menuItem) {
      console.error("menu item lookup failed:", menuError?.message);
      return new Response(JSON.stringify({ error: "menu item not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    const { data: created, error: insertError } = await supabase
      .from("order_claim_tokens")
      .insert({
        token,
        channel: channel ?? "in_store",
        menu_item_id,
        bean_option_id: bean_option_id ?? null,
        point_value: menuItem.point_value,
        expires_at: expiresAt,
      })
      .select("token, expires_at")
      .single();

    if (insertError) {
      console.error("create token failed:", insertError.message);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(created), {
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
