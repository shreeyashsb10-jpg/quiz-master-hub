import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { QuizGuardProvider } from "@/contexts/QuizGuardContext";
import Layout from "@/components/Layout";

const AuthPage        = lazy(() => import("@/pages/auth"));
const ProfileSetup    = lazy(() => import("@/pages/profile-setup"));
const Dashboard       = lazy(() => import("@/pages/dashboard"));
const QuizzesPage     = lazy(() => import("@/pages/quizzes"));
const QuizDetail      = lazy(() => import("@/pages/quiz-detail"));
const LeaderboardPage = lazy(() => import("@/pages/leaderboard"));
const ProfilePage     = lazy(() => import("@/pages/profile"));
const AdminDashboard  = lazy(() => import("@/pages/admin/index"));
const AdminQuestions  = lazy(() => import("@/pages/admin/questions"));
const AdminQuizzes    = lazy(() => import("@/pages/admin/quizzes"));
const AdminSubjects   = lazy(() => import("@/pages/admin/subjects"));
const AdminAdmins     = lazy(() => import("@/pages/admin/admins"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/** Paths that should NOT be saved as a return URL */
const SKIP_RETURN_PATHS = new Set(["/", "/auth", "/profile-setup"]);

/** Check whether a stored return URL is worth redirecting to */
function isValidReturnUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  if (SKIP_RETURN_PATHS.has(url)) return false;
  if (url.startsWith("/join/")) return false;
  return true;
}

/** Read + clear the saved return URL from sessionStorage */
function popReturnUrl(): string {
  const url = sessionStorage.getItem("quizora_return_url");
  sessionStorage.removeItem("quizora_return_url");
  return isValidReturnUrl(url) ? url : "/dashboard";
}

function ProtectedRoutes() {
  const { user, loading, profileLoaded, isAdmin, isSuperAdmin, isProfileComplete } = useAuth();
  const [location] = useLocation();

  // ── 1. Still checking auth session ────────────────────────────────────────
  if (loading) return <PageLoader />;

  // ── 2. Not authenticated ──────────────────────────────────────────────────
  if (!user) {
    // Save the intended URL so we can restore it after login.
    // Skip saving /auth itself, root, join paths.
    if (!SKIP_RETURN_PATHS.has(location) && !location.startsWith("/join/")) {
      sessionStorage.setItem("quizora_return_url", location);
    }

    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          {/* The login page — always accessible when signed out */}
          <Route path="/auth" component={AuthPage} />

          {/* Invite links: save code, then ask user to sign in */}
          <Route path="/join/:code">
            {(params) => {
              if (params.code) {
                sessionStorage.setItem("quizora_join_code", params.code.toUpperCase());
              }
              return <Redirect to="/auth" />;
            }}
          </Route>

          {/* Everything else → sign in first */}
          <Route><Redirect to="/auth" /></Route>
        </Switch>
      </Suspense>
    );
  }

  // ── 3. Authenticated but profile is still being fetched/created ───────────
  if (!profileLoaded) return <PageLoader />;

  // ── 4. Handle /join/:code for signed-in users ─────────────────────────────
  const joinMatch = location.match(/^\/join\/([A-Z0-9]+)$/i);
  if (joinMatch) {
    sessionStorage.setItem("quizora_join_code", joinMatch[1].toUpperCase());
    if (!isProfileComplete && !isAdmin) return <Redirect to="/profile-setup" />;
    return <Redirect to="/dashboard" />;
  }

  // ── 5. Post-login smart redirect (user landed on /auth after OTP verify) ──
  if (location === "/auth") {
    // Admins always go straight to admin dashboard
    if (isAdmin) {
      sessionStorage.removeItem("quizora_return_url");
      return <Redirect to="/admin" />;
    }
    // Students with no profile → setup first
    if (!isProfileComplete) {
      // Preserve the return URL for after they finish setup
      return <Redirect to="/profile-setup" />;
    }
    // Completed students → restore intended destination or dashboard
    return <Redirect to={popReturnUrl()} />;
  }

  // ── 6. Profile-setup guard (unauthenticated access prevention already done) ─
  if (!isProfileComplete && !isAdmin && location !== "/profile-setup") {
    return <Redirect to="/profile-setup" />;
  }

  // Profile setup page (outside Layout)
  if (location === "/profile-setup") {
    // Admins don't need profile setup → send to admin panel
    if (isAdmin) {
      sessionStorage.removeItem("quizora_return_url");
      return <Redirect to="/admin" />;
    }
    // Student just finished setup → go to return URL or dashboard
    if (isProfileComplete) {
      return <Redirect to={popReturnUrl()} />;
    }
    return (
      <Suspense fallback={<PageLoader />}>
        <ProfileSetup />
      </Suspense>
    );
  }

  // ── 7. Main authenticated app ──────────────────────────────────────────────
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={() => <Redirect to="/dashboard" />} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/quizzes" component={QuizzesPage} />
          <Route path="/quiz/:id" component={QuizDetail} />
          <Route path="/leaderboard" component={LeaderboardPage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin/questions" component={AdminQuestions} />
          <Route path="/admin/quizzes" component={AdminQuizzes} />
          <Route path="/admin/subjects" component={AdminSubjects} />
          <Route path="/admin/admins" component={AdminAdmins} />
          {/* Catch-all: unknown routes → dashboard */}
          <Route component={() => <Redirect to="/dashboard" />} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  useEffect(() => {
    // Capture join codes from both ?code= and /join/CODE URL patterns
    // before React router takes over (handles hard links / page refreshes)
    const params = new URLSearchParams(window.location.search);
    const qsCode = params.get("code");
    if (qsCode) sessionStorage.setItem("quizora_join_code", qsCode.toUpperCase());

    const joinMatch = window.location.pathname.match(/^\/join\/([A-Z0-9]+)$/i);
    if (joinMatch) sessionStorage.setItem("quizora_join_code", joinMatch[1].toUpperCase());
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <QuizGuardProvider>
            <WouterRouter>
              <ProtectedRoutes />
            </WouterRouter>
          </QuizGuardProvider>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
