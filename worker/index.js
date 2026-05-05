/**
 * FireGuard TX — Cloudflare Worker
 * Proxies requests to the Gemini API, keeping your API key server-side.
 * Deploy with: wrangler deploy
 *
 * Set your secret: wrangler secret put GEMINI_API_KEY
 * Then paste your Gemini key when prompted.
 */

const ALLOWED_ORIGINS = [
  // Add your GitHub Pages URL here, e.g.:
  // "https://yourusername.github.io",
  // "https://your-custom-domain.com",
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    // Only allow POST to /analyze
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/analyze") {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse incoming body: { parts: [...] }
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    if (!env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY secret not configured. Run: wrangler secret put GEMINI_API_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }

    // Forward to Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`;

    const geminiBody = {
      contents: [{ parts: body.parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    };

    let geminiRes;
    try {
      geminiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Failed to reach Gemini API: " + err.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const data = await geminiRes.json();

    return new Response(JSON.stringify(data), {
      status: geminiRes.status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(origin),
      },
    });
  },
};

function corsHeaders(origin) {
  // In production, check ALLOWED_ORIGINS. For now, allow all (*).
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
