import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useSubjects } from "@/hooks/useSubjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, X, Check, Search } from "lucide-react";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  subject_id: string | null;
  quiz_type: "live" | "practice";
  status: "upcoming" | "live" | "ended";
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  is_premium: boolean;
  subjects?: { name: string } | null;
}

interface Question {
  id: string;
  question_text: string;
  subjects?: { name: string } | null;
}

export default function AdminQuizzes() {
  const { profile, user } = useAuth();
  const { subjects } = useSubjects();
  const { toast } = useToast();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("none");
  const [quizType, setQuizType] = useState<"live" | "practice">("practice");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [duration, setDuration] = useState("30");
  const [isPremium, setIsPremium] = useState(false);
  const [saving, setSaving] = useState(false);

  // Question picker
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [quizQuestionIds, setQuizQuestionIds] = useState<Set<string>>(new Set());
  const [searchQ, setSearchQ] = useState("");

  async function loadQuizzes() {
    setLoading(true);
    const { data } = await supabase.from("quizzes").select("*, subjects(name)").order("created_at", { ascending: false });
    setQuizzes((data as Quiz[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { loadQuizzes(); }, []);

  async function openPicker(quizId: string) {
    setSelectedQuizId(quizId);
    const [{ data: qs }, { data: qq }] = await Promise.all([
      supabase.from("questions").select("id, question_text, subjects!inner(name)").limit(200),
      supabase.from("quiz_questions").select("question_id").eq("quiz_id", quizId),
    ]);
    setAllQuestions((qs as unknown as Question[]) ?? []);
    setQuizQuestionIds(new Set(qq?.map((r: { question_id: string }) => r.question_id) ?? []));
  }

  async function toggleQuestion(questionId: string) {
    if (!selectedQuizId) return;
    if (quizQuestionIds.has(questionId)) {
      await supabase.from("quiz_questions").delete().eq("quiz_id", selectedQuizId).eq("question_id", questionId);
      setQuizQuestionIds(prev => { const s = new Set(prev); s.delete(questionId); return s; });
    } else {
      await supabase.from("quiz_questions").insert({ quiz_id: selectedQuizId, question_id: questionId, order_index: quizQuestionIds.size });
      setQuizQuestionIds(prev => new Set([...prev, questionId]));
    }
  }

  function resetForm() {
    setTitle(""); setDescription(""); setSubjectId("none"); setQuizType("practice");
    setStartTime(""); setEndTime(""); setDuration("30"); setIsPremium(false);
    setEditingId(null);
  }

  function startEdit(quiz: Quiz) {
    setTitle(quiz.title);
    setDescription(quiz.description ?? "");
    setSubjectId(quiz.subject_id ?? "none");
    setQuizType(quiz.quiz_type);
    setStartTime(quiz.start_time ? new Date(quiz.start_time).toISOString().slice(0, 16) : "");
    setEndTime(quiz.end_time ? new Date(quiz.end_time).toISOString().slice(0, 16) : "");
    setDuration(String(quiz.duration_minutes));
    setIsPremium(quiz.is_premium);
    setEditingId(quiz.id);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !user) return;
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description || null,
      subject_id: subjectId === "none" ? null : subjectId,
      quiz_type: quizType,
      status: quizType === "live" && startTime ? "upcoming" as const : "ended" as const,
      start_time: startTime || null,
      end_time: endTime || null,
      duration_minutes: parseInt(duration) || 30,
      is_premium: isPremium,
    };

    if (editingId) {
      await supabase.from("quizzes").update(payload).eq("id", editingId);
      toast({ title: "Quiz updated!" });
    } else {
      await supabase.from("quizzes").insert({ ...payload, created_by: user.id });
      toast({ title: "Quiz created!" });
    }

    resetForm(); setShowForm(false); loadQuizzes(); setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("quizzes").delete().eq("id", id);
    setQuizzes(prev => prev.filter(q => q.id !== id));
    toast({ title: "Quiz deleted" });
  }

  async function updateStatus(id: string, status: "upcoming" | "live" | "ended") {
    await supabase.from("quizzes").update({ status }).eq("id", id);
    setQuizzes(prev => prev.map(q => q.id === id ? { ...q, status } : q));
    toast({ title: `Quiz marked as ${status}` });
  }

  if (profile?.role !== "admin") return <div className="p-6 text-center text-muted-foreground">Access Denied</div>;

  const filteredQuestions = allQuestions.filter(q =>
    !searchQ || q.question_text.toLowerCase().includes(searchQ.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quizzes</h1>
        <Button data-testid="button-new-quiz" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> New Quiz
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">{editingId ? "Edit Quiz" : "Create Quiz"}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">Title *</label>
              <Input data-testid="input-quiz-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Anatomy Upper Limb Test" required />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">Description</label>
              <Input data-testid="input-quiz-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Subject</label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue placeholder="Mixed (no specific subject)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Mixed Subject</SelectItem>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Type</label>
              <Select value={quizType} onValueChange={v => setQuizType(v as "live" | "practice")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="practice">Practice</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {quizType === "live" && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Start Time</label>
                  <Input data-testid="input-start-time" type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">End Time</label>
                  <Input data-testid="input-end-time" type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium">Duration (minutes)</label>
              <Input data-testid="input-duration" type="number" value={duration} onChange={e => setDuration(e.target.value)} min="1" max="300" />
            </div>
            <div className="flex items-center gap-2 self-end pb-1">
              <input type="checkbox" id="premium" checked={isPremium} onChange={e => setIsPremium(e.target.checked)} className="rounded" />
              <label htmlFor="premium" className="text-sm">Premium only</label>
            </div>
          </div>
          <div className="flex gap-3">
            <Button data-testid="button-save-quiz" type="submit" disabled={saving}>{saving ? "Saving..." : editingId ? "Update" : "Create Quiz"}</Button>
            <Button variant="outline" type="button" onClick={() => { resetForm(); setShowForm(false); }}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Quiz List */}
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {quizzes.map(quiz => (
            <div key={quiz.id} data-testid={`admin-quiz-${quiz.id}`} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{quiz.title}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {quiz.subjects?.name ?? "Mixed"} · {quiz.duration_minutes}m · {quiz.quiz_type}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select value={quiz.status} onValueChange={v => updateStatus(quiz.id, v as "upcoming" | "live" | "ended")}>
                    <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="ended">Ended</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => openPicker(quiz.id)}>Questions</Button>
                  <Button variant="ghost" size="sm" onClick={() => startEdit(quiz)}><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(quiz.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            </div>
          ))}
          {quizzes.length === 0 && <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">No quizzes yet. Create one!</div>}
        </div>
      )}

      {/* Question Picker Modal */}
      {selectedQuizId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-semibold">Pick Questions ({quizQuestionIds.size} selected)</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedQuizId(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search questions..." className="pl-9" />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-border">
              {filteredQuestions.map(q => {
                const selected = quizQuestionIds.has(q.id);
                return (
                  <button
                    key={q.id}
                    onClick={() => toggleQuestion(q.id)}
                    className={`w-full text-left flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors ${selected ? "bg-primary/5" : ""}`}
                  >
                    <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${selected ? "bg-primary border-primary" : "border-border"}`}>
                      {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <p className="text-sm line-clamp-2">{q.question_text}</p>
                  </button>
                );
              })}
            </div>
            <div className="p-4 border-t border-border">
              <Button className="w-full" onClick={() => setSelectedQuizId(null)}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
