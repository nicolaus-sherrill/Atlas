import { supabase } from "./supabase";
import { getTurnstileToken } from "./turnstile";

// Contributions are tied to a person so ratings can be one-per-person and spam can be removed by
// source. Visitors who haven't signed up get an anonymous identity the first time they contribute,
// kept in this browser. Browsing never creates one.

let ready: Promise<void> | null = null;

async function establish(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    // A stored session can outlive its user, for example after an anonymous account is cleaned
    // up. Its token still validates, but anything it writes is rejected. Check once per page load.
    const { data: user, error } = await supabase.auth.getUser();
    if (!error && user.user) return;
    if (!data.session.user.is_anonymous) throw error ?? new Error("Your sign-in has expired. Sign in again.");
    await supabase.auth.signOut({ scope: "local" });
  }
  // Creating an identity is the step bots would automate, so it's the one behind the bot check
  const captchaToken = await getTurnstileToken("contribute");
  const { error } = await supabase.auth.signInAnonymously({ options: { captchaToken } });
  if (error) throw error;
}

export function ensureSession(): Promise<void> {
  ready ??= establish().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

// A new sign-in or sign-out means the next contribution should check again
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT" || event === "SIGNED_IN") ready = null;
});
