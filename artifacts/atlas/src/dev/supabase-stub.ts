// Stand-in for lib/supabase.ts under `vite --mode adminfixture`: a signed-in admin, and a database
// that answers every query with nothing. Lets the admin page render with no network. Dev only.

const session = { user: { id: "00000000-0000-4000-8000-000000000001", email: "admin@example.test", is_anonymous: false } };

const empty = (): unknown => {
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_t, prop) => (prop === "then" ? (resolve: (v: unknown) => void) => resolve({ data: null, error: null }) : () => chain),
    },
  );
  return chain;
};

export const supabase = {
  auth: {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  rpc: async (name: string) => (name === "is_admin" ? { data: true, error: null } : { data: null, error: null }),
  from: empty,
};
