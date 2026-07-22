// Supabase Edge Function: get-member-history
// Called by Buddy Book. Verifies the LINE ID token the same way as create-or-get-member,
// then returns the matching member's own recent points_transactions rows plus their badge
// progress. Customers aren't Supabase Auth users, so there's no authenticated-role RLS path —
// identity has to be proven via the LINE token, same pattern as create-or-get-member/claim-order-token.
//
// Also lazily checks the "Buddy Friend" (1-year anniversary) badge here, since it's date-based
// rather than tied to a points_transactions event — the DB trigger (check_badge_unlocks in
// 20260707060000_badge_seed_and_unlock.sql) only fires on purchases, so this is the one place
// that can catch it, on whatever the member's next Buddy Book visit happens to be.

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
      .select("id, created_at")
      .eq("line_user_id", lineUserId)
      .single();

    if (memberError || !member) {
      return new Response(JSON.stringify({ error: "member not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(member.created_at).getTime() >= oneYearMs) {
      const { data: buddyFriendBadge } = await supabase
        .from("badges")
        .select("id")
        .eq("name", "Buddy Friend")
        .single();
      if (buddyFriendBadge) {
        await supabase
          .from("badges_earned")
          .upsert(
            { member_id: member.id, badge_id: buddyFriendBadge.id },
            { onConflict: "member_id,badge_id", ignoreDuplicates: true },
          );
      }
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

    const [{ data: allBadges }, { data: earned }] = await Promise.all([
      supabase.from("badges").select("id, name, icon").eq("active", true).order("name"),
      supabase.from("badges_earned").select("badge_id, earned_at").eq("member_id", member.id),
    ]);

    const earnedMap = new Map((earned ?? []).map((e) => [e.badge_id, e.earned_at]));
    const badges = (allBadges ?? []).map((b) => ({
      name: b.name,
      icon: b.icon,
      earned: earnedMap.has(b.id),
      earned_at: earnedMap.get(b.id) ?? null,
    }));

    return new Response(JSON.stringify({ history: formatted, badges }), {
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
