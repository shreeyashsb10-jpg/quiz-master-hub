import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, CATEGORY_META } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, CheckCircle2, XCircle, BadgeCheck } from "lucide-react";

interface Category { id: string; name: string; slug: string; icon: string | null; }
interface LinkedInstitute { id: string; name: string; category_id: string | null; }

function getInitialCode(): string {
  const url = new URLSearchParams(window.location.search);
  return (url.get("code") || sessionStorage.getItem("quizora_join_code") || "").toUpperCase();
}

export default function ProfileSetup() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [categoryId, setCategoryId] = useState(profile?.category_id ?? "");
  const [categorySlug, setCategorySlug] = useState("");
  const [examType, setExamType] = useState(profile?.exam_type ?? "");
  const [academicYear, setAcademicYear] = useState(profile?.academic_year ?? "");
  const [instituteName, setInstituteName] = useState(profile?.institute_name ?? profile?.college_name ?? "");

  const [joinCode, setJoinCode] = useState(getInitialCode);
  const [verifying, setVerifying] = useState(false);
  const [linkedInstitute, setLinkedInstitute] = useState<LinkedInstitute | null>(null);
  const [codeVerified, setCodeVerified] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("categories").select("*").order("name").then(({ data }) => {
      setCategories((data as Category[]) ?? []);
    });
    const initial = getInitialCode();
    if (initial.length >= 4) verifyCode(initial);
  }, []);

  async function verifyCode(code: string) {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setCodeError(""); setLinkedInstitute(null); setCodeVerified(false); return; }
    setVerifying(true);
    setCodeError("");
    setLinkedInstitute(null);
    setCodeVerified(false);

    const { data, error } = await supabase
      .from("institutes")
      .select("id, name, category_id")
      .eq("join_code", trimmed)
      .single();

    if (error || !data) {
      setCodeError("Invalid code. Please check with your institute admin.");
    } else {
      const inst = data as LinkedInstitute;
      setLinkedInstitute(inst);
      setCodeVerified(true);
      setInstituteName(inst.name);
      if (inst.category_id) {
        setCategoryId(inst.category_id);
        const cat = categories.find(c => c.id === inst.category_id);
        if (cat) setCategorySlug(cat.slug);
      }
      sessionStorage.removeItem("quizora_join_code");
    }
    setVerifying(false);
  }

  function handleCategoryChange(id: string) {
    setCategoryId(id);
    setExamType("");
    setAcademicYear("");
    const cat = categories.find(c => c.id === id);
    setCategorySlug(cat?.slug ?? "");
  }

  useEffect(() => {
    if (categories.length && categoryId) {
      const cat = categories.find(c => c.id === categoryId);
      if (cat) setCategorySlug(cat.slug);
    }
  }, [categories, categoryId]);

  const meta = categorySlug ? CATEGORY_META[categorySlug] : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!fullName.trim()) { toast({ title: "Please enter your full name", variant: "destructive" }); return; }
    if (!categoryId) { toast({ title: "Please select your category", variant: "destructive" }); return; }

    if (joinCode.trim() && !codeVerified) {
      toast({ title: "Please verify your institute code first", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("users").update({
      full_name: fullName.trim(),
      category_id: categoryId,
      exam_type: examType || null,
      academic_year: academicYear || null,
      institute_name: instituteName.trim() || null,
      college_name: instituteName.trim() || null,
      institute_id: linkedInstitute?.id ?? null,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);

    if (error) {
      toast({ title: "Error saving profile", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Refresh profile — ProtectedRoutes will detect isProfileComplete=true and
    // redirect to the saved return URL (or /dashboard) automatically.
    await refreshProfile();
    toast({ title: "Profile set up! Welcome to Quizora." });
    setSaving(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <GraduationCap className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Set Up Your Profile</h1>
          <p className="text-muted-foreground mt-2 text-sm">Help us personalise your experience</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-8 space-y-5">

          {/* Institute Join Code */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <BadgeCheck className="w-4 h-4 text-primary" />
              Institute / Coaching Code
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <div className="flex gap-2">
              <Input
                value={joinCode}
                onChange={e => {
                  const v = e.target.value.toUpperCase();
                  setJoinCode(v);
                  setCodeVerified(false);
                  setLinkedInstitute(null);
                  setCodeError("");
                }}
                placeholder="e.g. ALLEN01"
                className="h-11 font-mono tracking-widest uppercase"
                maxLength={10}
              />
              <Button
                type="button"
                variant="outline"
                className="h-11 px-4 shrink-0"
                disabled={verifying || !joinCode.trim()}
                onClick={() => verifyCode(joinCode)}
              >
                {verifying ? "Checking…" : "Verify"}
              </Button>
            </div>
            {codeVerified && linkedInstitute && (
              <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Joined <strong>{linkedInstitute.name}</strong></span>
              </div>
            )}
            {codeError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                <XCircle className="w-4 h-4 shrink-0" />
                {codeError}
              </div>
            )}
          </div>

          <div className="border-t border-border" />

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Full Name *</label>
            <Input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="e.g. Dr. Priya Sharma"
              required
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Category *</label>
            <Select
              value={categoryId}
              onValueChange={handleCategoryChange}
              disabled={codeVerified && !!linkedInstitute?.category_id}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select your exam category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                ))}
                {categories.length === 0 && (
                  <SelectItem value="_loading" disabled>Loading categories…</SelectItem>
                )}
              </SelectContent>
            </Select>
            {codeVerified && linkedInstitute?.category_id && (
              <p className="text-xs text-muted-foreground">Category set by your institute</p>
            )}
          </div>

          {meta && meta.examTypes.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Exam Type</label>
              <Select value={examType} onValueChange={setExamType}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select exam type" />
                </SelectTrigger>
                <SelectContent>
                  {meta.examTypes.map(et => <SelectItem key={et} value={et}>{et}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {meta && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Year / Class</label>
              <Select value={academicYear} onValueChange={setAcademicYear}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select year or class" />
                </SelectTrigger>
                <SelectContent>
                  {meta.yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Institute / College / Coaching</label>
            <Input
              value={instituteName}
              onChange={e => setInstituteName(e.target.value)}
              placeholder="e.g. AIIMS Delhi / Allen Kota"
              className="h-11"
              readOnly={codeVerified}
            />
          </div>

          <Button type="submit" className="w-full h-11" disabled={saving}>
            {saving ? "Saving…" : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
