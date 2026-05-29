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

/** Remove all Supabase auth tokens from localStorage (expired, corrupt, or invalid). */
function clearStaleAuthTokens() {
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.includes("-auth-token") || key.startsWith("sb-")) {
        try { localStorage.removeItem(key); } catch { /* ignore */ }
      }
    });
  } catch { /* ignore */ }
}

/**
 * Returns true only if a non-expired Supabase token exists in localStorage.
 * Does NOT clear tokens here — Supabase may still be able to silently refresh them.
 */
function hasStoredSession(): boolean {
  try {
    const key = Object.keys(localStorage).find(
      k => k.endsWith("-auth-token") || (k.startsWith("sb-") && k.endsWith("-auth-token"))
    );
    if (!key) return false;
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data?.access_token) return false;
    // Allow up to 60 s grace period — Supabase can still refresh a recently-expired token
    const expiresAt = (data?.expires_at ?? 0) * 1000;
    return expiresAt > Date.now() - 60_000;
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
  const [loading, setLoading] = useState(hasStoredSession());
  const [profileLoaded, setProfileLoaded] = useState(false);

  /**
   * Fetch or auto-create a profile row for the authenticated user.
   * Serves a cached profile immediately so the UI unblocks fast, then
   * refreshes from the DB in the background.
   */
  async function fetchProfile(userId: string, email?: string) {
    const cacheKey = `quizora_profile_${userId}`;

    // Serve cached profile immediately
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setProfile(JSON.parse(cached) as UserProfile);
        setProfileLoaded(true);
      }
    } catch { /* ignore */ }

    try {
      const { data: byId, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows found — handled below by auto-create
        // Any other error: leave cached profile in place
        setProfileLoaded(true);
        return;
      }

      if (byId) {
        try { sessionStorage.setItem(cacheKey, JSON.stringify(byId)); } catch { /* ignore */ }
        setProfile(byId as UserProfile);
        setProfileLoaded(true);
        return;
      }

      // Auto-create a new profile for first-time login.
      // NOTE: role must be 'user' — the schema CHECK constraint does NOT allow 'student'.
      if (email) {
        const { data: created, error: createErr } = await supabase
          .from("users")
          .insert({
            id: userId,
            email,
            full_name: null,
            role: "user",
            plan_type: "free",
            total_points: 0,
            weekly_points: 0,
            streak: 0,
            category_id: null,
            institute_id: null,
          })
          .select("*")
          .single();

        if (createErr) {
          console.error("[AuthContext] Auto-create profile FAILED", createErr.code, createErr.message);
        } else if (created) {
          try { sessionStorage.setItem(cacheKey, JSON.stringify(created)); } catch { /* ignore */ }
          setProfile(created as UserProfile);
        }
      }
    } catch { /* network error — cached profile (if any) remains visible */ }

    setProfileLoaded(true);
  }

  async function refreshProfile() {
    if (!user) return;
    try {
      const { data } = await supabase.from("users").select("*").eq("id", user.id).single();
      if (data) {
        try { sessionStorage.setItem(`quizora_profile_${user.id}`, JSON.stringify(data)); } catch { /* ignore */ }
        setProfile(data as UserProfile);
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    let cancelled = false;

    // ── Hard bail-out ────────────────────────────────────────────────────────
    // If Supabase is unreachable (slow network, cold start, rate-limit), the
    // getSession() / fetchProfile() awaits could hang for minutes. This timer
    // forces the app to unblock after 6 s so the user always sees something.
    const bail = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setProfileLoaded(true);
      }
    }, 6_000);

    async function initSession() {
      try {
        const { data: { session: s }, error } = await supabase.auth.getSession();
        await supabase.auth.refreshSession();
        if (cancelled) return;

        if (error) {
          // Token is invalid or refresh failed — clear stale tokens and boot as guest
          clearStaleAuthTokens();
          setLoading(false);
          return;
        }

        setSession(s);
        setUser(s?.user ?? null);

        if (s?.user) {
          await fetchProfile(s.user.id, s.user.email ?? undefined);
        }
      } catch {
        // Network error or unexpected failure — unblock the UI as guest
        if (!cancelled) clearStaleAuthTokens();
      } finally {
        clearTimeout(bail);
        if (!cancelled) setLoading(false);
      }
    }

    initSession();

    // Auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        // getSession() above already handles the very first load
        if (event === "INITIAL_SESSION") return;

        if (event === "SIGNED_OUT") {
          // Supabase fires SIGNED_OUT when token refresh fails — treat as full logout
          setSession(null);
          setUser(null);
          setProfile(null);
          setProfileLoaded(false);
          clearStaleAuthTokens();
          return;
        }

        if (event === "TOKEN_REFRESHED" && s) {
          // Only update session/user — no need to re-fetch profile
          setSession(s);
          setUser(s.user);
          return;
        }

        setSession(s);
        setUser(s?.user ?? null);

        if (s?.user) {
          setProfileLoaded(false);
          await fetchProfile(s.user.id, s.user.email ?? undefined);
        } else {
          setProfile(null);
          setProfileLoaded(false);
        }
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(bail);
      subscription.unsubscribe();
    };
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
