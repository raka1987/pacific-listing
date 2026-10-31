"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Finishes email links that land on an ordinary page instead of /auth/callback, e.g. a
 * password reset sent from the Supabase dashboard, which puts the login in the address
 * after "#" (access_token=…&type=recovery).
 */
export function AuthLinkHandler() {
  useEffect(() => {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const type = hash.get("type");
    const clean = () => history.replaceState(null, "", location.pathname + location.search);

    if (hash.get("error_code") || hash.get("error")) {
      clean();
      location.replace(type === "recovery" ? "/forgot-password?error=link" : "/login?error=link");
      return;
    }
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (accessToken && refreshToken) {
      createClient()
        .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          clean();
          if (error) location.replace(type === "recovery" ? "/forgot-password?error=link" : "/login?error=link");
          else location.replace(type === "recovery" ? "/update-password" : type === "signup" ? "/?welcome=1" : location.pathname);
        });
      return;
    }
    // A sign-in code that arrived on a normal page: hand it to the page that finishes logins.
    const code = new URLSearchParams(location.search).get("code");
    if (code && /^[0-9a-f-]{20,}$/i.test(code)) location.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(location.pathname)}`);
  }, []);
  return null;
}
