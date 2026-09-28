// Runs once a day so the free Supabase project never pauses for inactivity. It has no web address.
import { keepAlive } from "../worker/api";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      keepAlive(env).then(
        () => console.log("keep-alive ok"),
        (err) => console.error("keep-alive failed", err),
      ),
    );
  },
} satisfies ExportedHandler<Env>;
