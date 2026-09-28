import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// True when the signed-in visitor is on the admin list. Everyone starts as false; the database
// enforces the same rule, so this only decides which controls to show.
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return setIsAdmin(false);
      const { data } = await supabase.rpc("is_admin");
      setIsAdmin(data === true);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void check());
    return () => sub.subscription.unsubscribe();
  }, []);

  return isAdmin;
}
