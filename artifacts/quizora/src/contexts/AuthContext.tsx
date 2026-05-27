import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, UserRole } from "@/lib/supabase";

export interface UserProfile {
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
  role: UserRole;
  category_id: string | null;
  exam_type: string | null;
  academic_year: string | null;
  institute_name: string | null;
  institute_id: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoaded: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isInstituteAdmin: boolean;
  isProfileComplete: boolean;
  signInWithOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function hasStoredSession(): boolean {
  try {
    const key = Object.keys(localStorage).find(k => k.endsWith("-auth-token"));
    if (!key) return false;
    const data = JSON.parse(localStorage.getItem(key) ?? "{}");
    return !!data?.access_token && (data?.expires_at ?? 0) > Date.now() / 1000;
  } catch {
    return false;
  }
}

function checkProfileComplete(p: UserProfile | null): boolean {
  if (!p) return false;
  if (p.role === "admin" || p.role === "super_admin" || p.role === "institute_admin") return true;
  if (!("category_id" in p)) return true;
  const hasName = !!p.full_name && p.full_name.trim() !== "" && p.full_name !== "Anonymous";
  const hasCategory = !!p.category_id;
  return hasName && hasCategory;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // loading: true while initial session + profile check is in flight
  const [loading, setLoading] = useState(hasStoredSession);
  // profileLoaded: true once fetchProfile has resolved (even if profile is null)
  const [profileLoaded, setProfileLoaded] = useState(false);

  /**
   * Fetch or auto-create a profile row for the authenticated user.
   * - Serves cached profile immediately for fast re-loads
   * - Fetches fresh data from DB and updates cache
   * - Auto-creates a student profile on first login
   */
  async function fetchProfile(userId: string, email?: string) {
    // Serve cached profile instantly so the UI unblocks immediately
    const cacheKey = `quizora_profile_${userId}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setProfile(JSON.parse(cached) as UserProfile);
        setProfileLoaded(true);
      }
    } catch { /* ignore */ }

    // Fetch fresh from DB
    const { data: byId } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (byId) {
      try { sessionStorage.setItem(cacheKey, JSON.stringify(byId)); } catch { /* ignore */ }
      setProfile(byId as UserProfile);
      setProfileLoaded(true);
      return;
    }

    // Auto-create a new student profile for first-time login
    if (email) {
      const { data: created, error } = await supabase
        .from("users")
        .insert({
          id: userId,
          email,
          full_name: null,
          role: "student",
          plan_type: "free",
          total_points: 0,
          weekly_points: 0,
          streak: 0,
          category_id: null,
          institute_id: null,
        })
        .select("*")
        .single();

      if (!error && created) {
        try { sessionStorage.setItem(cacheKey, JSON.stringify(created)); } catch { /* ignore */ }
        setProfile(created as UserProfile);
      }
    }

    setProfileLoaded(true);
  }

  async function refreshProfile() {
    if (user) {
      const { data } = await supabase.from("users").select("*").eq("id", user.id).single();
      if (data) {
        try { sessionStorage.setItem(`quizora_profile_${user.id}`, JSON.stringify(data)); } catch { /* ignore */ }
        setProfile(data as UserProfile);
      }
    }
  }

  useEffect(() => {
    // Initial session check — await profile before clearing loading
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await fetchProfile(s.user.id, s.user.email ?? undefined);
      }
      setLoading(false);
    });

    // Auth state changes (sign-in, sign-out, token refresh)
    // Skip INITIAL_SESSION — getSession() above already handles the first load.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (event === "INITIAL_SESSION") return;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          // Reset profileLoaded so consumers know to wait
          setProfileLoaded(false);
          await fetchProfile(s.user.id, s.user.email ?? undefined);
        } else {
          setProfile(null);
          setProfileLoaded(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithOtp(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
  }

  async function verifyOtp(email: string, token: string) {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) throw error;
  }

  async function signOut() {
    if (user) {
      try { sessionStorage.removeItem(`quizora_profile_${user.id}`); } catch { /* ignore */ }
    }
    setProfile(null);
    setProfileLoaded(false);
    await supabase.auth.signOut();
  }

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin" || profile?.role === "institute_admin";
  const isSuperAdmin = profile?.role === "super_admin" || profile?.role === "admin";
  const isInstituteAdmin = profile?.role === "institute_admin";
  const isProfileComplete = checkProfileComplete(profile);

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading, profileLoaded,
      isAdmin, isSuperAdmin, isInstituteAdmin, isProfileComplete,
      signInWithOtp, verifyOtp, signOut, refreshProfile,
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
