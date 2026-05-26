import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

interface Category { id: string; name: string; slug: string; icon: string | null; }
interface Subject { id: string; name: string; category_id: string | null; }
interface Topic { id: string; name: string; subject_id: string; }

export default function AdminSubjects() {
  const { isAdmin, isInstituteAdmin, isSuperAdmin, profile } = useAuth();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  // Bug 2: institute admins start with their category locked; super admins start with "all"
  const [filterCategory, setFilterCategory] = useState(
    isInstituteAdmin && profile?.category_id ? profile.category_id : "all"
  );
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sLoading, setSLoading] = useState(true);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [newTopicName, setNewTopicName] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    supabase.from("categories").select("*").order("name").then(({ data }) => {
      setCategories((data as Category[]) ?? []);
    });
  }, []);

  // When profile loads, set filter for institute admins
  useEffect(() => {
    if (isInstituteAdmin && profile?.category_id && filterCategory === "all") {
      setFilterCategory(profile.category_id);
    }
  }, [profile?.category_id]);

  useEffect(() => {
    setSLoading(true);
    setSelectedSubject("");
    let query = supabase.from("subjects").select("*").order("name");
    if (filterCategory !== "all") query = query.eq("category_id", filterCategory);
    query.then(({ data }) => {
      setSubjects((data as Subject[]) ?? []);
      setSLoading(false);
    });
  }, [filterCategory]);

  useEffect(() => {
    if (selectedSubject) {
      supabase.from("topics").select("*").eq("subject_id", selectedSubject).order("name").then(({ data }) => {
        setTopics((data as Topic[]) ?? []);
      });
    }
  }, [selectedSubject]);

  async function handleAddTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!newTopicName.trim() || !selectedSubject) return;
    setAdding(true);
    const { data, error } = await supabase.from("topics").insert({ subject_id: selectedSubject, name: newTopicName.trim() }).select("*").single();
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setTopics(prev => [...prev, data as Topic]); setNewTopicName(""); toast({ title: "Topic added!" }); }
    setAdding(false);
  }

  async function handleDeleteTopic(id: string) {
    await supabase.from("topics").delete().eq("id", id);
    setTopics(prev => prev.filter(t => t.id !== id));
    toast({ title: "Topic deleted" });
  }

  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    const catId = filterCategory !== "all" ? filterCategory : null;
    const { data, error } = await supabase.from("subjects").insert({ name: newSubjectName.trim(), category_id: catId }).select("*").single();
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setSubjects(prev => [...prev, data as Subject]); setNewSubjectName(""); toast({ title: "Subject added!" }); }
  }

  if (!isAdmin) return <div className="p-6 text-center text-muted-foreground">Access Denied</div>;

  const currentCategoryName = categories.find(c => c.id === filterCategory)?.name;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Subjects & Topics</h1>

      {/* Category filter — locked for institute admins, full dropdown for super admins */}
      {isSuperAdmin && categories.length > 0 ? (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground shrink-0">Filter by:</span>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ) : isInstituteAdmin && currentCategoryName ? (
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-sm px-3 py-1.5 rounded-lg">
          <span className="font-medium">{currentCategoryName}</span>
          <span className="text-primary/60 text-xs">· Your category</span>
        </div>
      ) : null}

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Subjects ({subjects.length})</h2>
        </div>

        <form onSubmit={handleAddSubject} className="flex gap-2">
          <Input
            value={newSubjectName}
            onChange={e => setNewSubjectName(e.target.value)}
            placeholder="New subject name"
            className="flex-1"
          />
          <Button type="submit" variant="outline">
            <Plus className="w-4 h-4 mr-1" /> Add Subject
          </Button>
        </form>

        {sLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => <div key={i} className="h-9 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {subjects.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedSubject(s.id)}
                className={`text-left px-3 py-2 rounded-lg text-sm border transition-colors ${selectedSubject === s.id ? "bg-primary/10 border-primary text-primary" : "border-border hover:border-primary/50"}`}
              >
                {s.name}
              </button>
            ))}
            {subjects.length === 0 && <p className="text-sm text-muted-foreground col-span-3 py-4 text-center">No subjects found.</p>}
          </div>
        )}
      </div>

      {selectedSubject && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">Topics for {subjects.find(s => s.id === selectedSubject)?.name}</h2>
          <form onSubmit={handleAddTopic} className="flex gap-2">
            <Input
              value={newTopicName}
              onChange={e => setNewTopicName(e.target.value)}
              placeholder="New topic name"
              className="flex-1"
            />
            <Button type="submit" disabled={adding}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </form>
          <div className="space-y-2">
            {topics.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">No topics yet. Add one above.</div>
            ) : topics.map(topic => (
              <div key={topic.id} className="flex items-center justify-between bg-background rounded-lg px-3 py-2">
                <span className="text-sm">{topic.name}</span>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteTopic(topic.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
