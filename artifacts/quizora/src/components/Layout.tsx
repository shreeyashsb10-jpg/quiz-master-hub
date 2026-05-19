import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LayoutDashboard, BookOpen, Trophy, User, Settings, Zap } from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/quizzes", icon: BookOpen, label: "Quizzes" },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { href: "/profile", icon: User, label: "Profile" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-60 border-r border-border shrink-0">
        <div className="flex items-center gap-2.5 px-6 py-5 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">Quizora</span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => {
            const active = location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <div data-testid={`nav-${item.label.toLowerCase()}`} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}

          {profile?.role === "admin" && (
            <Link href="/admin">
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${location.startsWith("/admin") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
                <Settings className="w-4 h-4" />
                Admin
              </div>
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-border">
          <Link href="/profile">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <Avatar className="w-7 h-7">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">{profile?.full_name?.charAt(0) ?? "U"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{profile?.full_name ?? "Your Name"}</div>
                <div className="text-xs text-muted-foreground capitalize">{profile?.plan_type ?? "free"} plan</div>
              </div>
            </div>
          </Link>
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
              <Link key={item.href} href={item.href}>
                <div className={`flex flex-col items-center gap-1 p-2 rounded-lg ${active ? "text-primary" : "text-muted-foreground"}`}>
                  <item.icon className="w-5 h-5" />
                  <span className="text-xs">{item.label}</span>
                </div>
              </Link>
            );
          })}
          {profile?.role === "admin" && (
            <Link href="/admin">
              <div className={`flex flex-col items-center gap-1 p-2 rounded-lg ${location.startsWith("/admin") ? "text-primary" : "text-muted-foreground"}`}>
                <Settings className="w-5 h-5" />
                <span className="text-xs">Admin</span>
              </div>
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}
