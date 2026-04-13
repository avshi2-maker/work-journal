// claude-proxy — Supabase Edge Function
// Handles: Claude API calls + URL fetching (bypasses CORS)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // ── ACTION: fetch_url — fetch any URL server-side (bypasses browser CORS) ──
    if (body.action === "fetch_url") {
      const url = body.url;
      if (!url || !url.startsWith("http")) {
        return new Response(JSON.stringify({ error: "Invalid URL" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      try {
        const fetchRes = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; BeniCRM/1.0)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!fetchRes.ok) {
          return new Response(
            JSON.stringify({ error: `HTTP ${fetchRes.status}`, text: "" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const html = await fetchRes.text();

        // Strip HTML → clean text
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/\s{3,}/g, "\n")
          .trim()
          .substring(0, 15000);

        return new Response(JSON.stringify({ text, url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (fetchErr) {
        return new Response(
          JSON.stringify({ error: String(fetchErr), text: "" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── ACTION: Claude API call (existing behavior) ──────────────────────────
    const { model, max_tokens, system, messages, tools, stream } = body;

    const claudePayload: Record<string, unknown> = {
      model: model || "claude-sonnet-4-20250514",
      max_tokens: max_tokens || 1024,
      messages,
    };
    if (system) claudePayload.system = system;
    if (tools)  claudePayload.tools  = tools;
    if (stream) claudePayload.stream = stream;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(claudePayload),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      status: response.status,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
