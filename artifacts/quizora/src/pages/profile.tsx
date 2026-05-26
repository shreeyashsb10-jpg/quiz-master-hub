import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, CATEGORY_META } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMyAttempts } from "@/hooks/useAttempts";
import { calcAccuracy, formatTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Camera } from "lucide-react";

interface Category { id: string; name: string; slug: string; icon: string | null; }

export default function ProfilePage() {
  const { profile, user, signOut, refreshProfile, isAdmin } = useAuth();
  const { attempts } = useMyAttempts();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [collegeName, setCollegeName] = useState(profile?.institute_name ?? profile?.college_name ?? "");
  const [mbbsYear, setMbbsYear] = useState(profile?.academic_year ?? profile?.mbbs_year ?? "");
  const [categoryId, setCategoryId] = useState(profile?.category_id ?? "");
  const [categorySlug, setCategorySlug] = useState("");
  const [examType, setExamType] = useState(profile?.exam_type ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.from("categories").select("*").order("name").then(({ data }) => {
      const cats = (data as Category[]) ?? [];
      setCategories(cats);
      const current = cats.find(c => c.id === (profile?.category_id ?? ""));
      if (current) setCategorySlug(current.slug);
    });
  }, [profile?.category_id]);

  function handleCategoryChange(id: string) {
    setCategoryId(id);
    setExamType("");
    const cat = categories.find(c => c.id === id);
    setCategorySlug(cat?.slug ?? "");
  }

  const meta = categorySlug ? CATEGORY_META[categorySlug] : null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("users").update({
      full_name: fullName,
      college_name: collegeName,
      mbbs_year: mbbsYear,
      institute_name: collegeName || null,
      academic_year: mbbsYear || null,
      category_id: categoryId || null,
      exam_type: examType || null,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { await refreshProfile(); toast({ title: "Profile saved!" }); }
    setSaving(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !user) return;
    const file = e.target.files[0];
    if (file.size > 2 * 1024 * 1024) { toast({ title: "File too large", description: "Max 2MB", variant: "destructive" }); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { toast({ title: "Upload failed", description: upErr.message, variant: "destructive" }); }
    else {
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("users").update({ avatar_url: data.publicUrl }).eq("id", user.id);
      await refreshProfile();
      toast({ title: "Avatar updated!" });
    }
    setUploading(false);
  }

  const avgAccuracy = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + calcAccuracy(a.correct_answers, a.total_questions), 0) / attempts.length)
    : 0;

  const categoryName = categories.find(c => c.id === categoryId)?.name;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Profile</h1>
        <Button variant="outline" size="sm" onClick={signOut}>
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative">
          <Avatar className="w-20 h-20">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-2xl">{profile?.full_name?.charAt(0) ?? "U"}</AvatarFallback>
          </Avatar>
          <label className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center cursor-pointer">
            <Camera className="w-3.5 h-3.5 text-primary-foreground" />
            <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleAvatarUpload} data-testid="input-avatar" />
          </label>
        </div>
        <div>
          <div className="font-semibold text-lg">{profile?.full_name ?? "Your Name"}</div>
          <div className="text-sm text-muted-foreground">{user?.email}</div>
          {categoryName && <div className="text-xs text-primary mt-1">{categoryName}</div>}
          <div className="text-xs text-muted-foreground capitalize mt-0.5">{profile?.plan_type ?? "free"} plan</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Points", value: profile?.total_points ?? 0 },
          { label: "Streak", value: `${profile?.streak ?? 0}d` },
          { label: "Quizzes", value: attempts.length },
          { label: "Avg Accuracy", value: `${avgAccuracy}%` },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSave} className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-lg">Edit Profile</h2>
        <div className="space-y-1">
          <label className="text-sm font-medium">Full Name</label>
          <Input data-testid="input-full-name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your Name" />
        </div>

        {categories.length > 0 && !isAdmin && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Category</label>
            <Select value={categoryId} onValueChange={handleCategoryChange}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {meta && meta.examTypes.length > 1 && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Exam Type</label>
            <Select value={examType} onValueChange={setExamType}>
              <SelectTrigger><SelectValue placeholder="Select exam type" /></SelectTrigger>
              <SelectContent>
                {meta.examTypes.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {meta && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Year / Class</label>
            <Select value={mbbsYear} onValueChange={setMbbsYear}>
              <SelectTrigger><SelectValue placeholder="Select year/class" /></SelectTrigger>
              <SelectContent>
                {meta.yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {(!meta || isAdmin) && (
          <div className="space-y-1">
            <label className="text-sm font-medium">{isAdmin ? "MBBS Year" : "Year / Class"}</label>
            <Input data-testid="input-mbbs-year" value={mbbsYear} onChange={e => setMbbsYear(e.target.value)} placeholder="e.g. 3rd Year, Intern..." />
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium">Institute / College / Coaching</label>
          <Input data-testid="input-college" value={collegeName} onChange={e => setCollegeName(e.target.value)} placeholder="e.g. AIIMS Delhi" />
        </div>

        <Button data-testid="button-save-profile" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </form>

      {attempts.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-4">Quiz History</h2>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {attempts.map(a => (
              <div key={a.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{a.quizzes?.title ?? "Quiz"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(a.submitted_at).toLocaleDateString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{a.score} pts</div>
                  <div className="text-xs text-muted-foreground">{calcAccuracy(a.correct_answers, a.total_questions)}% · {formatTime(a.time_taken_seconds)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
