import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { BookOpen, Layers, HelpCircle, BarChart3, Plus } from "lucide-react";

export default function AdminDashboard() {
  const { profile } = useAuth();
  if (profile?.role !== "admin") {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="text-sm mt-1">You need admin privileges to access this area.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage quizzes, questions, and subjects</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { href: "/admin/questions", icon: HelpCircle, label: "Questions", desc: "Add, edit, bulk upload MCQs", color: "text-sky-400" },
          { href: "/admin/quizzes", icon: Layers, label: "Quizzes", desc: "Create and schedule quizzes", color: "text-emerald-400" },
          { href: "/admin/subjects", icon: BookOpen, label: "Subjects & Topics", desc: "Manage subjects and topics", color: "text-purple-400" },
        ].map(item => (
          <Link key={item.href} href={item.href}>
            <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors cursor-pointer">
              <item.icon className={`w-8 h-8 ${item.color} mb-3`} />
              <div className="font-semibold">{item.label}</div>
              <div className="text-sm text-muted-foreground mt-1">{item.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
