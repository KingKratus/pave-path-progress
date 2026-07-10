import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export function useUserRole() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setAuthReady(true);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      const { data: userData } = await supabase.auth.getUser();
      setSession(userData.user ? data.session : null);
      setAuthReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setIsAdmin(false);
      setRoleLoading(false);
      return;
    }
    let cancelled = false;
    setRoleLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setIsAdmin(!!data && !error);
        setRoleLoading(false);
      });
    return () => { cancelled = true; };
  }, [session]);

  const loading = !authReady || roleLoading;

  return { session, isAdmin, loading };
}
