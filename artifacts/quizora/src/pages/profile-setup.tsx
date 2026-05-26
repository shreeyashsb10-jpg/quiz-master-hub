import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, CATEGORY_META } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

export default function ProfileSetup() {
  const { user, profile, refreshProfile } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [categoryId, setCategoryId] = useState(profile?.category_id ?? "");
  const [categorySlug, setCategorySlug] = useState("");
  const [examType, setExamType] = useState(profile?.exam_type ?? "");
  const [academicYear, setAcademicYear] = useState(profile?.academic_year ?? "");
  const [instituteName, setInstituteName] = useState(profile?.institute_name ?? profile?.college_name ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("categories").select("*").order("name").then(({ data }) => {
      setCategories((data as Category[]) ?? []);
    });
  }, []);

  function handleCategoryChange(id: string) {
    setCategoryId(id);
    setExamType("");
    setAcademicYear("");
    const cat = categories.find(c => c.id === id);
    setCategorySlug(cat?.slug ?? "");
  }

  const meta = categorySlug ? CATEGORY_META[categorySlug] : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!fullName.trim()) { toast({ title: "Please enter your full name", variant: "destructive" }); return; }
    if (!categoryId) { toast({ title: "Please select your category", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("users").update({
      full_name: fullName.trim(),
      category_id: categoryId,
      exam_type: examType || null,
      academic_year: academicYear || null,
      institute_name: instituteName.trim() || null,
      college_name: instituteName.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);

    if (error) {
      toast({ title: "Error saving profile", description: error.message, variant: "destructive" });
    } else {
      await refreshProfile();
      toast({ title: "Profile set up!" });
      navigate("/dashboard");
    }
    setSaving(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <GraduationCap className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Set Up Your Profile</h1>
          <p className="text-muted-foreground mt-2 text-sm">Help us personalise your experience</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-8 space-y-5">
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
            <Select value={categoryId} onValueChange={handleCategoryChange}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select your exam category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </SelectItem>
                ))}
                {categories.length === 0 && (
                  <SelectItem value="_loading" disabled>Loading categories…</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {meta && meta.examTypes.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Exam Type</label>
              <Select value={examType} onValueChange={setExamType}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select exam type" />
                </SelectTrigger>
                <SelectContent>
                  {meta.examTypes.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
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
            />
          </div>

          <Button type="submit" className="w-full h-11" disabled={saving}>
            {saving ? "Saving…" : "Continue to Dashboard"}
          </Button>
        </form>
      </div>
    </div>
  );
}
