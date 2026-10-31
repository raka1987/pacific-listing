import { createSign } from "node:crypto";

// Sends phone notifications through Firebase Cloud Messaging (HTTP v1).
// Needs FIREBASE_SERVICE_ACCOUNT in Vercel: the whole JSON key file from
// Firebase → Project settings → Service accounts → Generate new private key.

type ServiceAccount = { project_id: string; client_email: string; private_key: string; token_uri?: string };

let cached: { token: string; expires: number } | null = null;

export function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.project_id || !sa.client_email || !sa.private_key) return null;
    return { ...sa, private_key: sa.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

async function accessToken(sa: ServiceAccount) {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
    JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: tokenUri, iat: now, exp: now + 3600 }),
  )}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key);
  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(signature)}` }),
  });
  if (!res.ok) throw new Error(`Google sign-in failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

/** Sends to each phone; returns the phones Firebase says no longer exist. */
export async function sendPush(tokens: string[], msg: PushMessage) {
  const sa = serviceAccount();
  if (!sa) throw new Error("FIREBASE_SERVICE_ACCOUNT is missing or not valid JSON");
  const auth = await accessToken(sa);
  const endpoint = process.env.FCM_ENDPOINT || `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const dead: string[] = [];
  let sent = 0;
  await Promise.all(
    tokens.map(async (token) => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: msg.title, body: msg.body },
            data: { url: msg.url ?? "/" },
            android: {
              priority: "HIGH",
              notification: { channel_id: "messages", icon: "ic_stat_notify", color: "#12857F", sound: "default", tag: msg.tag },
            },
            apns: { payload: { aps: { sound: "default", "thread-id": msg.tag ?? "pacific-listing" } } },
          },
        }),
      });
      if (res.ok) sent++;
      else {
        const text = await res.text();
        if (res.status === 404 || /UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT.*token/i.test(text)) dead.push(token);
        else console.error("Push failed", res.status, text.slice(0, 300));
      }
    }),
  );
  return { sent, dead };
}
