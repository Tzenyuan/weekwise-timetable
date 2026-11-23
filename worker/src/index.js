const MAX_BODY_BYTES = 64_000;
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_HISTORY_CHARS = 12_000;
const REQUEST_TIMEOUT_MS = 30_000;

function jsonResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);
}

function validateMessages(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MESSAGES) return null;
  let totalChars = 0;
  const messages = [];
  for (const message of value) {
    if (!message || !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" || !message.content.trim() ||
      message.content.length > MAX_MESSAGE_CHARS) return null;
    totalChars += message.content.length;
    if (totalChars > MAX_HISTORY_CHARS) return null;
    messages.push({ role: message.role, content: message.content.trim() });
  }
  return messages.at(-1).role === "user" ? messages : null;
}

function replyText(content) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .filter(part => part && part.type === "text" && typeof part.text === "string")
    .map(part => part.text)
    .join("\n")
    .trim();
}

async function readLimitedBody(request) {
  if (!request.body) return { body: "", tooLarge: false };
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return { body: "", tooLarge: true };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body: new TextDecoder().decode(bytes), tooLarge: false };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/chat") return new Response("Not found", { status: 404 });
    if (request.method !== "POST" && request.method !== "OPTIONS") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "POST, OPTIONS" } });
    }

    const origin = request.headers.get("Origin");
    const headers = origin && allowedOrigins(env).includes(origin) ? corsHeaders(origin) : null;
    if (!headers) return jsonResponse({ error: "Origin is not allowed." }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    if (!env.OPENROUTER_API_KEY) {
      return jsonResponse({ error: "AI service is not configured yet." }, 503, headers);
    }
    if (!env.CHAT_LIMITER) {
      return jsonResponse({ error: "Chat service is temporarily unavailable." }, 503, headers);
    }

    const declaredLength = Number(request.headers.get("Content-Length") || 0);
    if (declaredLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: "That conversation is too long. Start a new chat or shorten your message." }, 413, headers);
    }

    let payload;
    try {
      const { body, tooLarge } = await readLimitedBody(request);
      if (tooLarge) {
        return jsonResponse({ error: "That conversation is too long. Start a new chat or shorten your message." }, 413, headers);
      }
      payload = JSON.parse(body);
    } catch {
      return jsonResponse({ error: "The chat request was not valid JSON." }, 400, headers);
    }

    const messages = validateMessages(payload?.messages);
    if (!messages) {
      return jsonResponse({ error: "Send up to 12 recent messages, with your question as the last message." }, 400, headers);
    }

    const ip = request.headers.get("CF-Connecting-IP");
    if (!ip) return jsonResponse({ error: "Could not verify this request." }, 403, headers);
    const { success } = await env.CHAT_LIMITER.limit({ key: ip });
    if (!success) return jsonResponse({ error: "Too many messages. Please wait a minute and try again." }, 429, headers);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://tzenyuan.github.io/weekwise-timetable/",
          "X-Title": "Weekwise AI"
        },
        body: JSON.stringify({
          model: env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are Weekwise AI, a helpful general-purpose assistant for students. Answer a broad range of questions clearly and accurately. Be concise by default, explain uncertainty, and never claim to have taken actions you cannot perform."
            },
            ...messages
          ],
          max_tokens: 700,
          temperature: 0.7
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        return jsonResponse({ error: "The AI service could not answer right now. Please try again." }, 502, headers);
      }
      const result = await response.json();
      const reply = replyText(result?.choices?.[0]?.message?.content);
      if (!reply) return jsonResponse({ error: "The AI service returned an empty reply. Please try again." }, 502, headers);
      return jsonResponse({ reply }, 200, headers);
    } catch (error) {
      const message = error?.name === "AbortError"
        ? "The AI service took too long to respond. Please try again."
        : "The AI service could not answer right now. Please try again.";
      return jsonResponse({ error: message }, 502, headers);
    } finally {
      clearTimeout(timeout);
    }
  }
};
