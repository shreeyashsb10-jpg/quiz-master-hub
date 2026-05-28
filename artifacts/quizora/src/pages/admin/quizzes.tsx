import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useSubjects } from "@/hooks/useSubjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, X, Check, Search, Loader2 } from "lucide-react";

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
  institute_id?: string | null;
  subjects?: { name: string } | null;
}

interface Question {
  id: string;
  question_text: string;
  subject_id: string | null;
  topic_id: string | null;
  topics?: { name: string } | null;
  subjects?: { name: string } | null;
}

const QUESTION_SELECT = "id, question_text, subject_id, topic_id, topics(name), subjects(name)";
const QUIZ_SELECT = "id, title, description, subject_id, quiz_type, status, start_time, end_time, duration_minutes, is_premium, institute_id, subjects(name)";

export default function AdminQuizzes() {
  const { profile, user, isAdmin, isInstituteAdmin } = useAuth();
  const { subjects } = useSubjects(profile?.category_id);
  const { toast } = useToast();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("none");
  const [quizType, setQuizType] = useState<"live" | "practice">("practice");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [duration, setDuration] = useState("30");
  const [isPremium, setIsPremium] = useState(false);
  const [saving, setSaving] = useState(false);

  // Question picker state
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [quizQuestionIds, setQuizQuestionIds] = useState<Set<string>>(new Set());
  const [pickerLoading, setPickerLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  const [pickerSubject, setPickerSubject] = useState("all");
  const [pickerTopic, setPickerTopic] = useState("all");
  const [formPickerSubject, setFormPickerSubject] = useState("all");
  const [formPickerTopic, setFormPickerTopic] = useState("all");
  const [formSearchQ, setFormSearchQ] = useState("");

  const buildInstituteFilter = useCallback(<T extends { eq: (col: string, val: string) => T }>(q: T): T => {
    if (isInstituteAdmin && profile?.institute_id) {
      return q.eq("institute_id", profile.institute_id);
    }
    return q;
  }, [isInstituteAdmin, profile?.institute_id]);

  async function loadQuizzes() {
    setLoading(true);
    let q = supabase
      .from("quizzes")
      .select(QUIZ_SELECT)
      .order("created_at", { ascending: false });
    if (isInstituteAdmin && profile?.institute_id) {
      q = q.eq("institute_id", profile.institute_id);
    }
    const { data, error } = await q;
    if (error) toast({ title: "Failed to load quizzes", description: error.message, variant: "destructive" });
    else setQuizzes((data as Quiz[]) ?? []);
    setLoading(false);
  }

  async function loadAllQuestions() {
    let q = supabase.from("questions").select(QUESTION_SELECT).order("created_at", { ascending: false }).limit(500);
    q = buildInstituteFilter(q as never) as typeof q;
    const { data } = await q;
    setAllQuestions((data as unknown as Question[]) ?? []);
  }

  useEffect(() => {
    loadQuizzes();
    loadAllQuestions();
  }, []);

  async function openPicker(quizId: string) {
    setSelectedQuizId(quizId);
    setPickerSubject("all");
    setPickerTopic("all");
    setSearchQ("");
    setPickerLoading(true);

    let qQuery = supabase.from("questions").select(QUESTION_SELECT).order("created_at", { ascending: false }).limit(500);
    qQuery = buildInstituteFilter(qQuery as never) as typeof qQuery;

    const [{ data: qs }, { data: qq }] = await Promise.all([
      qQuery,
      supabase.from("quiz_questions").select("question_id").eq("quiz_id", quizId),
    ]);

    setAllQuestions((qs as unknown as Question[]) ?? []);
    setQuizQuestionIds(new Set(qq?.map((r: { question_id: string }) => r.question_id) ?? []));
    setPickerLoading(false);
  }

  async function toggleQuestion(questionId: string) {
    if (!selectedQuizId) return;
    if (quizQuestionIds.has(questionId)) {
      const { error } = await supabase.from("quiz_questions")
        .delete().eq("quiz_id", selectedQuizId).eq("question_id", questionId);
      if (!error) setQuizQuestionIds(prev => { const s = new Set(prev); s.delete(questionId); return s; });
    } else {
      const { error } = await supabase.from("quiz_questions")
        .insert({ quiz_id: selectedQuizId, question_id: questionId, order_index: quizQuestionIds.size });
      if (!error) setQuizQuestionIds(prev => new Set([...prev, questionId]));
    }
  }

  function resetForm() {
    setTitle(""); setDescription(""); setSubjectId("none"); setQuizType("practice");
    setStartTime(""); setEndTime(""); setDuration("30"); setIsPremium(false);
    setSelectedQuestionIds([]);
    setFormPickerSubject("all"); setFormPickerTopic("all"); setFormSearchQ("");
    setEditingId(null);
  }

  function startEdit(quiz: Quiz) {
    setTitle(quiz.title);
    setDescription(quiz.description ?? "");
    setSubjectId(quiz.subject_id ?? "none");
    setQuizType(quiz.quiz_type);
    const toLocal = (iso: string) =>
      new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setStartTime(quiz.start_time ? toLocal(quiz.start_time) : "");
    setEndTime(quiz.end_time ? toLocal(quiz.end_time) : "");
    setDuration(String(quiz.duration_minutes));
    setIsPremium(quiz.is_premium);
    setEditingId(quiz.id);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !user) return;
    setSaving(true);

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description || null,
      subject_id: subjectId === "none" ? null : subjectId,
      quiz_type: quizType,
      status: quizType === "live" && startTime ? "upcoming" : "ended",
      start_time: startTime ? new Date(startTime).toISOString() : null,
      end_time: endTime ? new Date(endTime).toISOString() : null,
      duration_minutes: parseInt(duration) || 30,
      is_premium: isPremium,
    };

    if (isInstituteAdmin && profile?.institute_id) {
      payload.institute_id = profile.institute_id;
    }

    try {
      if (editingId) {
        const { error } = await supabase.from("quizzes").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Quiz updated!" });
      } else {
        const { data: createdQuiz, error } = await supabase
          .from("quizzes")
          .insert({ ...payload, created_by: user.id })
          .select("id")
          .single();

        if (error) throw error;

        // Bulk-insert all selected questions in one request
        if (selectedQuestionIds.length > 0) {
          const rows = selectedQuestionIds.map((qid, index) => ({
            quiz_id: createdQuiz.id,
            question_id: qid,
            order_index: index,
          }));
          const { error: qErr } = await supabase.from("quiz_questions").insert(rows);
          if (qErr) toast({ title: "Quiz created but some questions failed to link", description: qErr.message, variant: "destructive" });
        }

        toast({ title: "Quiz created!" });
      }

      resetForm();
      setShowForm(false);
      loadQuizzes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Error saving quiz", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    setQuizzes(prev => prev.filter(q => q.id !== id));
    toast({ title: "Quiz deleted" });
  }

  async function updateStatus(id: string, status: "upcoming" | "live" | "ended") {
    const { error } = await supabase.from("quizzes").update({ status }).eq("id", id);
    if (error) { toast({ title: "Update failed", variant: "destructive" }); return; }
    setQuizzes(prev => prev.map(q => q.id === id ? { ...q, status } : q));
    toast({ title: `Quiz marked as ${status}` });
  }

  if (!isAdmin) return <div className="p-6 text-center text-muted-foreground">Access Denied</div>;

  // --- Derived lists for the picker modal ---
  const modalSubjectFiltered = pickerSubject === "all" ? allQuestions : allQuestions.filter(q => q.subject_id === pickerSubject);
  const modalTopics = useMemo(() => {
    const seen = new Map<string, string>();
    for (const q of modalSubjectFiltered) {
      if (q.topic_id && q.topics?.name && !seen.has(q.topic_id)) seen.set(q.topic_id, q.topics.name);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [modalSubjectFiltered]);

  const filteredQuestions = useMemo(() => modalSubjectFiltered.filter(q => {
    if (pickerTopic !== "all" && q.topic_id !== pickerTopic) return false;
    if (searchQ && !q.question_text.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  }), [modalSubjectFiltered, pickerTopic, searchQ]);

  // --- Derived lists for the create-quiz form ---
  const formSubjectFiltered = formPickerSubject === "all" ? allQuestions : allQuestions.filter(q => q.subject_id === formPickerSubject);
  const formTopics = useMemo(() => {
    const seen = new Map<string, string>();
    for (const q of formSubjectFiltered) {
      if (q.topic_id && q.topics?.name && !seen.has(q.topic_id)) seen.set(q.topic_id, q.topics.name);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [formSubjectFiltered]);

  const formFilteredQuestions = useMemo(() => formSubjectFiltered.filter(q => {
    if (formPickerTopic !== "all" && q.topic_id !== formPickerTopic) return false;
    if (formSearchQ && !q.question_text.toLowerCase().includes(formSearchQ.toLowerCase())) return false;
    return true;
  }), [formSubjectFiltered, formPickerTopic, formSearchQ]);

  function handleModalSubjectChange(val: string) {
    setPickerSubject(val);
    setPickerTopic("all");
  }

  // Bulk-add all questions from a topic in ONE insert instead of N individual ones
  async function handleModalTopicChange(val: string) {
    setPickerTopic(val);
    if (val !== "all" && selectedQuizId) {
      const topicQIds = allQuestions
        .filter(q => q.topic_id === val && !quizQuestionIds.has(q.id))
        .map(q => q.id);

      if (topicQIds.length > 0) {
        const rows = topicQIds.map((qid, idx) => ({
          quiz_id: selectedQuizId,
          question_id: qid,
          order_index: quizQuestionIds.size + idx,
        }));
        const { error } = await supabase.from("quiz_questions").insert(rows);
        if (!error) {
          setQuizQuestionIds(prev => new Set([...prev, ...topicQIds]));
          toast({ title: `Added ${topicQIds.length} question${topicQIds.length !== 1 ? "s" : ""} from topic` });
        } else {
          toast({ title: "Failed to add questions", description: error.message, variant: "destructive" });
        }
      }
    }
  }

  function handleFormSubjectChange(val: string) {
    setFormPickerSubject(val);
    setFormPickerTopic("all");
  }

  function handleFormTopicChange(val: string) {
    setFormPickerTopic(val);
    if (val !== "all") {
      const topicQIds = allQuestions.filter(q => q.topic_id === val).map(q => q.id);
      setSelectedQuestionIds(prev => {
        const existing = new Set(prev);
        return [...prev, ...topicQIds.filter(id => !existing.has(id))];
      });
    }
  }

  const selectedQSet = useMemo(() => new Set(selectedQuestionIds), [selectedQuestionIds]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quizzes</h1>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> New Quiz
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">{editingId ? "Edit Quiz" : "Create Quiz"}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">Title *</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Anatomy Upper Limb Test" required />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">Description</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Subject</label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue placeholder="Mixed (no specific subject)" /></SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="max-h-64 overflow-y-auto">
                  <SelectItem value="none">Mixed Subject</SelectItem>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Type</label>
              <Select value={quizType} onValueChange={v => setQuizType(v as "live" | "practice")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="practice">Practice</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {quizType === "live" && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Start Time</label>
                  <Input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">End Time</label>
                  <Input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium">Duration (minutes)</label>
              <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} min="1" max="300" />
            </div>
            <div className="flex items-center gap-2 self-end pb-1">
              <input type="checkbox" id="premium" checked={isPremium} onChange={e => setIsPremium(e.target.checked)} className="rounded" />
              <label htmlFor="premium" className="text-sm">Premium only</label>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Select Questions</label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={formPickerSubject} onValueChange={handleFormSubjectChange}>
                <SelectTrigger><SelectValue placeholder="All Subjects" /></SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="max-h-64 overflow-y-auto">
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={formPickerTopic} onValueChange={handleFormTopicChange} disabled={formTopics.length === 0}>
                <SelectTrigger><SelectValue placeholder="All Topics" /></SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="max-h-64 overflow-y-auto">
                  <SelectItem value="all">All Topics</SelectItem>
                  {formTopics.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={formSearchQ} onChange={e => setFormSearchQ(e.target.value)} placeholder="Search questions…" className="pl-9" />
            </div>
            <div className="max-h-64 overflow-y-auto border border-border rounded-xl divide-y divide-border overscroll-contain">
              {formFilteredQuestions.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-6">No questions found</p>
                : formFilteredQuestions.map(q => {
                    const selected = selectedQSet.has(q.id);
                    return (
                      <button type="button" key={q.id}
                        onClick={() => setSelectedQuestionIds(prev => selected ? prev.filter(id => id !== q.id) : [...prev, q.id])}
                        className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${selected ? "bg-primary/10" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded border flex items-center justify-center mt-0.5 shrink-0 ${selected ? "bg-primary border-primary" : "border-border"}`}>
                            {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm line-clamp-2">{q.question_text}</p>
                            <p className="text-xs text-muted-foreground mt-1">{q.subjects?.name ?? "General"}{q.topics?.name ? ` · ${q.topics.name}` : ""}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })
              }
            </div>
            <p className="text-xs text-muted-foreground">{selectedQuestionIds.length} question{selectedQuestionIds.length !== 1 ? "s" : ""} selected</p>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={saving} className="min-w-28">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : editingId ? "Update" : "Create Quiz"}
            </Button>
            <Button variant="outline" type="button" onClick={() => { resetForm(); setShowForm(false); }}>Cancel</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {quizzes.length === 0
            ? <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">No quizzes yet. Create one!</div>
            : quizzes.map(quiz => (
                <div key={quiz.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{quiz.title}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {quiz.subjects?.name ?? "Mixed"} · {quiz.duration_minutes}m · {quiz.quiz_type}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <Select value={quiz.status} onValueChange={v => updateStatus(quiz.id, v as "upcoming" | "live" | "ended")}>
                        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
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
              ))
          }
        </div>
      )}

      {/* Question picker modal */}
      {selectedQuizId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90dvh] sm:max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <h2 className="font-semibold">{quizQuestionIds.size} question{quizQuestionIds.size !== 1 ? "s" : ""} selected</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedQuizId(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 border-b border-border space-y-2 shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <Select value={pickerSubject} onValueChange={handleModalSubjectChange}>
                  <SelectTrigger><SelectValue placeholder="All Subjects" /></SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-56 overflow-y-auto">
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={pickerTopic} onValueChange={handleModalTopicChange} disabled={modalTopics.length === 0}>
                  <SelectTrigger><SelectValue placeholder="All Topics" /></SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-56 overflow-y-auto">
                    <SelectItem value="all">All Topics</SelectItem>
                    {modalTopics.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search questions…" className="pl-9" />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-border overscroll-contain">
              {pickerLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading questions…
                </div>
              ) : filteredQuestions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No questions found</p>
              ) : filteredQuestions.map(q => {
                const selected = quizQuestionIds.has(q.id);
                return (
                  <button key={q.id} onClick={() => toggleQuestion(q.id)}
                    className={`w-full text-left flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors ${selected ? "bg-primary/5" : ""}`}
                  >
                    <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${selected ? "bg-primary border-primary" : "border-border"}`}>
                      {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm line-clamp-2">{q.question_text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {q.subjects?.name ?? "General"}{q.topics?.name ? ` · ${q.topics.name}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-4 border-t border-border shrink-0">
              <Button className="w-full" onClick={() => setSelectedQuizId(null)}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
