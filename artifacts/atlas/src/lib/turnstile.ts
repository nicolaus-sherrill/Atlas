// Cloudflare Turnstile, the free bot check. Supabase verifies the token itself when it creates a
// visitor's anonymous identity or sends an admin sign-in link, so no server code of ours sees it.
// Most visitors never see a challenge; the widget appears only when Cloudflare needs a click.

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY as string | undefined;
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TIMEOUT_MS = 90_000;

let scriptLoading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoading = null;
      reject(new Error("The bot check couldn't load. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

// Resolves with a single-use token for `action`. Undefined when no site key is configured.
export async function getTurnstileToken(action: string): Promise<string | undefined> {
  if (!SITEKEY) return undefined;
  await loadScript();
  const turnstile = window.turnstile;
  if (!turnstile) throw new Error("The bot check couldn't load. Try again.");

  return new Promise<string>((resolve, reject) => {
    const host = document.createElement("div");
    host.className = "turnstile-host";
    document.body.appendChild(host);

    let widgetId: string | null = null;
    const finish = (fn: () => void) => {
      clearTimeout(timer);
      if (widgetId) turnstile.remove(widgetId);
      host.remove();
      fn();
    };
    const fail = () => finish(() => reject(new Error("Couldn't confirm you're not a bot. Try again.")));
    const timer = setTimeout(fail, TIMEOUT_MS);

    widgetId = turnstile.render(host, {
      sitekey: SITEKEY,
      action,
      appearance: "interaction-only",
      callback: (token: string) => finish(() => resolve(token)),
      "error-callback": fail,
      "expired-callback": fail,
      "timeout-callback": fail,
    });
  });
}
