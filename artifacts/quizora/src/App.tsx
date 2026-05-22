import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import AuthPage from "@/pages/auth";
import Dashboard from "@/pages/dashboard";
import QuizzesPage from "@/pages/quizzes";
import QuizDetail from "@/pages/quiz-detail";
import LeaderboardPage from "@/pages/leaderboard";
import ProfilePage from "@/pages/profile";
import AdminDashboard from "@/pages/admin/index";
import AdminQuestions from "@/pages/admin/questions";
import AdminQuizzes from "@/pages/admin/quizzes";
import AdminSubjects from "@/pages/admin/subjects";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route>
          <Redirect to="/auth" />
        </Route>
      </Switch>
    );
  }

  return (
    <Layout>
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
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter>  
            <ProtectedRoutes />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
