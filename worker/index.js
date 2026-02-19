/**
 * Cloudflare Worker: markdownsite.xyz waitlist form handler
 * 
 * Stores signups in Cloudflare KV + sends push notification via ntfy.sh
 * (ntfy.sh is free, no account needed - Vlad subscribes to the topic)
 * 
 * To enable email notifications instead: enable Email Routing in CF dashboard
 * for markdownsite.xyz, then uncomment the send_email binding in wrangler.toml
 */

const NTFY_TOPIC = "markdownsite-waitlist-mavdotso";

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return corsResponse(null, 204);
    }
    if (request.method !== "POST") {
      return corsResponse(JSON.stringify({ success: false, error: "Method not allowed" }), 405);
    }

    // Parse email from form or JSON
    let email = "";
    try {
      const ct = request.headers.get("content-type") || "";
      if (ct.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams(await request.text());
        email = params.get("email") || "";
      } else {
        const body = await request.json();
        email = body.email || "";
      }
    } catch {
      return corsResponse(JSON.stringify({ success: false, error: "Invalid request" }), 400);
    }

    email = email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return corsResponse(JSON.stringify({ success: false, error: "Invalid email" }), 400);
    }

    const ts = Date.now();
    const key = `waitlist:${ts}:${email}`;

    // Store in KV
    await env.WAITLIST.put(key, JSON.stringify({ email, ts, source: "markdownsite.xyz" }));

    // Send push notification via ntfy.sh (fire-and-forget)
    ctx.waitUntil(
      fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
        method: "POST",
        headers: {
          "Title": "New waitlist signup",
          "Tags": "email,tada",
          "Priority": "default",
          "Content-Type": "text/plain",
        },
        body: `📧 ${email} just joined the markdownsite.xyz waitlist!`,
      }).catch((e) => console.error("ntfy error:", e))
    );

    return corsResponse(JSON.stringify({ success: true, message: "You're on the list!" }), 200);
  },
};

function corsResponse(body, status) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": body ? "application/json" : "text/plain",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
