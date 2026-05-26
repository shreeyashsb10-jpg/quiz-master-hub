import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useSubjects } from "@/hooks/useSubjects";
import { parseBulkMCQ } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Upload, Trash2, Search } from "lucide-react";

interface ParsedQuestion {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string;
  image_file?: File | null;
  preview_url?: string;
}

interface StoredQuestion {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string | null;
  difficulty: string;
  subjects?: { name: string } | null;
  topics?: { name: string } | null;
}

export default function AdminQuestions() {
  const { profile, isAdmin } = useAuth();
  const { subjects } = useSubjects();
  const { toast } = useToast();

  // Bulk upload state
  const [tab, setTab] = useState<"bulk" | "bank">("bulk");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [topicName, setTopicName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [parsed, setParsed] = useState<ParsedQuestion[]>([]);
  const [saving, setSaving] = useState(false);

  // Bank state
  const [questions, setQuestions] = useState<StoredQuestion[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [bankSubject, setBankSubject] = useState("all");

  useEffect(() => {
    if (tab === "bank") loadBank();
  }, [tab, bankSubject]);

  async function loadBank() {
    setLoadingBank(true);
    let q = supabase.from("questions").select("*, subjects(name), topics(name)").order("created_at", { ascending: false }).limit(100);
    if (bankSubject !== "all") q = q.eq("subject_id", bankSubject);
    const { data } = await q;
    setQuestions((data as StoredQuestion[]) ?? []);
    setLoadingBank(false);
  }

  function handleParse() {
    if (!bulkText.trim()) return;
    const result = parseBulkMCQ(bulkText);
    if (result.length === 0) {
      toast({ title: "Parse failed", description: "No valid questions found. Check the format.", variant: "destructive" });
      return;
    }
    setParsed(result.map(q => ({ ...q, image_file: null })));
    toast({ title: `Parsed ${result.length} question${result.length !== 1 ? "s" : ""}` });
  }

  async function handleImageUpload(idx: number, file: File) {
    if (file.size > 2 * 1024 * 1024) { toast({ title: "Max 2MB per image", variant: "destructive" }); return; }
    const url = URL.createObjectURL(file);
    setParsed(prev => prev.map((q, i) => i === idx ? { ...q, image_file: file, preview_url: url } : q));
  }

  async function handleSaveAll() {
    if (!selectedSubjectId) { toast({ title: "Select a subject first", variant: "destructive" }); return; }
    if (parsed.length === 0) { toast({ title: "No questions to save", variant: "destructive" }); return; }
    setSaving(true);

    try {
      // Ensure topic exists
      let topicId: string | null = null;
      if (topicName.trim()) {
        const { data: existingTopic } = await supabase.from("topics").select("id").eq("subject_id", selectedSubjectId).eq("name", topicName.trim()).single();
        if (existingTopic) {
          topicId = existingTopic.id;
        } else {
          const { data: newTopic } = await supabase.from("topics").insert({ subject_id: selectedSubjectId, name: topicName.trim() }).select("id").single();
          topicId = newTopic?.id ?? null;
        }
      }

      for (const q of parsed) {
        let imageUrl: string | null = null;
        if (q.image_file) {
          const ext = q.image_file.name.split(".").pop();
          const path = `questions/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          await supabase.storage.from("question-images").upload(path, q.image_file);
          const { data } = supabase.storage.from("question-images").getPublicUrl(path);
          imageUrl = data.publicUrl;
        }
        await supabase.from("questions").insert({
          subject_id: selectedSubjectId,
          topic_id: topicId,
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_answer: q.correct_answer,
          explanation: q.explanation || null,
          image_url: imageUrl,
        });
      }

      toast({ title: `Saved ${parsed.length} questions!` });
      setParsed([]);
      setBulkText("");
      setTopicName("");
    } catch (err) {
      toast({ title: "Save failed", description: String(err), variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("questions").delete().eq("id", id);
    setQuestions(prev => prev.filter(q => q.id !== id));
    toast({ title: "Question deleted" });
  }

  if (!isAdmin) return <div className="p-6 text-center text-muted-foreground">Access Denied</div>;

  const filteredBank = questions.filter(q =>
    !searchText || q.question_text.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Questions</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button variant={tab === "bulk" ? "default" : "outline"} size="sm" onClick={() => setTab("bulk")}>Bulk Upload</Button>
        <Button variant={tab === "bank" ? "default" : "outline"} size="sm" onClick={() => setTab("bank")}>Question Bank</Button>
      </div>

      {/* BULK UPLOAD */}
      {tab === "bulk" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="font-semibold">Step 1 — Select Subject & Topic</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger data-testid="select-subject-bulk">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input data-testid="input-topic" value={topicName} onChange={e => setTopicName(e.target.value)} placeholder="Topic name (optional)" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="font-semibold">Step 2 — Paste Questions</h2>
            <p className="text-xs text-muted-foreground">
              Format per question:<br />
              Question: ...<br />
              A. ...<br />B. ...<br />C. ...<br />D. ...<br />
              Answer: C<br />
              Explanation: ...
            </p>
            <textarea
              data-testid="textarea-bulk"
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={"Question: What is the powerhouse of the cell?\nA. Nucleus\nB. Ribosome\nC. Mitochondria\nD. Golgi body\nAnswer: C\nExplanation: Mitochondria produce ATP."}
              className="w-full h-56 bg-background border border-border rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button data-testid="button-parse" onClick={handleParse} variant="outline">
              Parse Questions
            </Button>
          </div>

          {/* Preview */}
          {parsed.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Step 3 — Preview & Save ({parsed.length} questions)</h2>
                <Button data-testid="button-save-all" onClick={handleSaveAll} disabled={saving}>
                  {saving ? "Saving..." : `Save All ${parsed.length} Questions`}
                </Button>
              </div>
              {parsed.map((q, idx) => (
                <div key={idx} data-testid={`parsed-question-${idx}`} className="bg-card border border-border rounded-xl p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm flex-1">{idx + 1}. {q.question_text}</p>
                    <Button variant="ghost" size="sm" onClick={() => setParsed(p => p.filter((_, i) => i !== idx))}>
                      <XCircle className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {(["A", "B", "C", "D"] as const).map(opt => (
                      <div key={opt} className={`flex items-center gap-2 p-2 rounded-lg ${q.correct_answer === opt ? "bg-emerald-500/10 text-emerald-400" : "bg-background"}`}>
                        {q.correct_answer === opt ? <CheckCircle className="w-3 h-3 shrink-0" /> : <span className="w-3 h-3" />}
                        <span className="font-medium">{opt}.</span>
                        <span className="truncate">{q[`option_${opt.toLowerCase()}` as keyof ParsedQuestion] as string}</span>
                      </div>
                    ))}
                  </div>
                  {q.explanation && <p className="text-xs text-muted-foreground italic">{q.explanation}</p>}
                  {/* Image upload */}
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                      <Upload className="w-3 h-3" />
                      {q.preview_url ? "Change image" : "Add image"}
                      <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload(idx, e.target.files[0])} />
                    </label>
                    {q.preview_url && <img src={q.preview_url} alt="preview" className="h-12 rounded object-contain border border-border" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* QUESTION BANK */}
      {tab === "bank" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input data-testid="input-search-bank" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search questions..." className="pl-9" />
            </div>
            <Select value={bankSubject} onValueChange={setBankSubject}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All subjects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loadingBank ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {filteredBank.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No questions found</div>
              ) : filteredBank.map(q => (
                <div key={q.id} data-testid={`bank-question-${q.id}`} className="flex items-start justify-between gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2">{q.question_text}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{q.subjects?.name}</span>
                      {q.topics?.name && <span className="text-xs text-muted-foreground">· {q.topics.name}</span>}
                      <span className={`text-xs ${q.correct_answer ? "text-emerald-400" : "text-muted-foreground"}`}>Ans: {q.correct_answer}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(q.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
