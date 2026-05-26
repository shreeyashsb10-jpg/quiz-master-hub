import { lazy, Suspense } from "react";
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

function ProtectedRoutes() {
  const { user, loading, isAdmin, isProfileComplete } = useAuth();
  const [location] = useLocation();

  if (loading) return <PageLoader />;

  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/auth" component={AuthPage} />
          <Route><Redirect to="/auth" /></Route>
        </Switch>
      </Suspense>
    );
  }

  // Student with incomplete profile → force setup (but not while already on setup page)
  if (!isProfileComplete && !isAdmin && location !== "/profile-setup") {
    return <Redirect to="/profile-setup" />;
  }

  // Completed profile but visiting setup page → send to dashboard
  if (isProfileComplete && location === "/profile-setup") {
    return <Redirect to="/dashboard" />;
  }

  // Profile setup page (no Layout wrapper)
  if (location === "/profile-setup") {
    return (
      <Suspense fallback={<PageLoader />}>
        <ProfileSetup />
      </Suspense>
    );
  }

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
          <Route component={() => <Redirect to="/dashboard" />} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
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
