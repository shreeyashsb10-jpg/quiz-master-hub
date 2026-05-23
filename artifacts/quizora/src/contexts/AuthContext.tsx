import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  college_name: string | null;
  mbbs_year: string | null;
  avatar_url: string | null;
  plan_type: "free" | "pro";
  total_points: number;
  weekly_points: number;
  streak: number;
  role: "user" | "admin";
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Check localStorage for a stored, non-expired Supabase session without a network call */
function hasStoredSession(): boolean {
  try {
    const key = Object.keys(localStorage).find(k => k.endsWith("-auth-token"));
    if (!key) return false;
    const data = JSON.parse(localStorage.getItem(key) ?? "{}");
    // expires_at is a Unix timestamp in seconds
    return !!data?.access_token && (data?.expires_at ?? 0) > Date.now() / 1000;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // Only show the loading spinner if there's a stored session to validate.
  // Fresh visitors see the login page immediately without waiting.
  const [loading, setLoading] = useState(hasStoredSession);

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from("users").select("*").eq("id", userId).single();
    if (data) setProfile(data as UserProfile);
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }

  async function signInWithOtp(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
  }

  async function verifyOtp(email: string, token: string) {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      isAdmin: profile?.role === "admin",
      signInWithGoogle, signInWithOtp, verifyOtp, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
