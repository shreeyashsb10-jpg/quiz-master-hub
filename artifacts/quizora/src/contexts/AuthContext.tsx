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
  // Admins never need profile setup
  if (p.role === "admin" || p.role === "super_admin" || p.role === "institute_admin") return true;
  // If category_id column doesn't exist yet (pre-migration), treat as complete
  if (!("category_id" in p)) return true;
  // Student must have name + category selected
  const hasName = !!p.full_name && p.full_name.trim() !== "" && p.full_name !== "Anonymous";
  const hasCategory = !!p.category_id;
  return hasName && hasCategory;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
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

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin" || profile?.role === "institute_admin";
  const isSuperAdmin = profile?.role === "super_admin" || profile?.role === "admin";
  const isInstituteAdmin = profile?.role === "institute_admin";
  const isProfileComplete = checkProfileComplete(profile);

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
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
