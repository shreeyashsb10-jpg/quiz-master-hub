import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuizGuard } from "@/contexts/QuizGuardContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, BookOpen, Trophy, User, Settings, Zap, AlertTriangle, ShieldCheck } from "lucide-react";

const studentNavItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/quizzes", icon: BookOpen, label: "Quizzes" },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { href: "/profile", icon: User, label: "Profile" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { profile, isAdmin } = useAuth();
  const { isQuizActive, setQuizActive } = useQuizGuard();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const navItems = studentNavItems;

  function handleNav(href: string) {
    if (isQuizActive) {
      setPendingHref(href);
    } else {
      navigate(href);
    }
  }

  function confirmExit() {
    if (pendingHref) {
      setQuizActive(false);
      navigate(pendingHref);
      setPendingHref(null);
    }
  }

  function cancelExit() {
    setPendingHref(null);
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-60 border-r border-border shrink-0">
        <div
          className="flex items-center gap-2.5 px-6 py-5 border-b border-border cursor-pointer"
          onClick={() => handleNav("/dashboard")}
        >
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">Quizora</span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => {
            const active = location.startsWith(item.href);
            return (
              <div
                key={item.href}
                data-testid={`nav-${item.label.toLowerCase()}`}
                onClick={() => handleNav(item.href)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </div>
            );
          })}

          {isAdmin && (
            <div
              onClick={() => handleNav("/admin")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${location.startsWith("/admin") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
            >
              <ShieldCheck className="w-4 h-4" />
              Admin
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-border">
          <div
            onClick={() => handleNav("/profile")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <Avatar className="w-7 h-7">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs">{profile?.full_name?.charAt(0) ?? "U"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{profile?.full_name ?? "Your Name"}</div>
              <div className="text-xs text-muted-foreground capitalize">{profile?.plan_type ?? "free"} plan</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          {children}
        </main>

        {/* Bottom nav — mobile */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-center justify-around py-2 px-4 z-40">
          {navItems.map(item => {
            const active = location.startsWith(item.href);
            return (
              <div
                key={item.href}
                onClick={() => handleNav(item.href)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg cursor-pointer ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-xs">{item.label}</span>
              </div>
            );
          })}
          {isAdmin && (
            <div
              onClick={() => handleNav("/admin")}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg cursor-pointer ${location.startsWith("/admin") ? "text-primary" : "text-muted-foreground"}`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-xs">Admin</span>
            </div>
          )}
        </nav>
      </div>

      {/* Exit Quiz Confirmation Dialog */}
      {pendingHref && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <h2 className="font-semibold text-lg">Exit Quiz?</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to exit the quiz? Your progress may be lost.
            </p>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={cancelExit}>Stay in Quiz</Button>
              <Button variant="destructive" className="flex-1" onClick={confirmExit}>Exit Quiz</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
