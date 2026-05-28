import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useSubjects } from "@/hooks/useSubjects";
import { parseBulkMCQ } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Upload, Trash2, Search, Loader2, AlertCircle } from "lucide-react";

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
  correct_answer: string;
  difficulty: string;
  subjects?: { name: string } | null;
  topics?: { name: string } | null;
}

/** Wraps a promise with a max-wait timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s. Check your connection.`)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

export default function AdminQuestions() {
  const { profile, isAdmin, isInstituteAdmin, profileLoaded } = useAuth();
  const { subjects, error: subjectsError } = useSubjects(profile?.category_id, profileLoaded);

  useEffect(() => {
    if (subjectsError) console.error("[AdminQuestions] subjects error:", subjectsError);
  }, [subjectsError]);
  const { toast } = useToast();

  const [tab, setTab] = useState<"bulk" | "bank">("bulk");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [topicName, setTopicName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [parsed, setParsed] = useState<ParsedQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveStep, setSaveStep] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<StoredQuestion[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [bankSubject, setBankSubject] = useState("all");

  useEffect(() => {
    if (tab === "bank") loadBank();
  }, [tab, bankSubject]);

  async function loadBank() {
    setLoadingBank(true);
    let q = supabase
      .from("questions")
      .select("id, question_text, correct_answer, difficulty, subject_id, topic_id, subjects(name), topics(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (bankSubject !== "all") q = q.eq("subject_id", bankSubject);
    if (isInstituteAdmin && profile?.institute_id) {
      q = q.eq("institute_id", profile.institute_id);
    }
    const { data, error } = await q;
    if (error) toast({ title: "Failed to load questions", description: error.message, variant: "destructive" });
    else setQuestions((data as StoredQuestion[]) ?? []);
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
    setSaveError(null);
    toast({ title: `Parsed ${result.length} question${result.length !== 1 ? "s" : ""}` });
  }

  function handleImageUpload(idx: number, file: File) {
    if (file.size > 2 * 1024 * 1024) { toast({ title: "Max 2MB per image", variant: "destructive" }); return; }
    const url = URL.createObjectURL(file);
    setParsed(prev => prev.map((q, i) => i === idx ? { ...q, image_file: file, preview_url: url } : q));
  }

  async function handleSaveAll() {
    if (!selectedSubjectId) { toast({ title: "Select a subject first", variant: "destructive" }); return; }
    if (parsed.length === 0) { toast({ title: "No questions to save", variant: "destructive" }); return; }

    // flushSync forces React to render the loading state BEFORE any async work starts,
    // so the user sees the spinner immediately on slow networks.
    flushSync(() => {
      setSaving(true);
      setSaveStep("Preparing…");
      setSaveError(null);
    });

    try {
      // ── Step 1: resolve or create topic ──────────────────────────────────
      let topicId: string | null = null;
      if (topicName.trim()) {
        flushSync(() => setSaveStep("Resolving topic…"));

        const { data: topicRows, error: topicErr } = await withTimeout(
          supabase
            .from("topics")
            .select("id")
            .eq("subject_id", selectedSubjectId)
            .eq("name", topicName.trim())
            .limit(1),
          15_000,
          "Topic lookup"
        );

        if (topicErr) throw new Error(`Topic lookup failed: ${topicErr.message}`);

        if (topicRows && topicRows.length > 0) {
          topicId = topicRows[0].id;
        } else {
          const { data: newTopic, error: createErr } = await withTimeout(
            supabase
              .from("topics")
              .insert({ subject_id: selectedSubjectId, name: topicName.trim() })
              .select("id")
              .single(),
            15_000,
            "Topic creation"
          );
          if (createErr) throw new Error(`Topic creation failed: ${createErr.message}`);
          topicId = newTopic?.id ?? null;
        }
      }

      // ── Step 2: upload images in parallel batches of 3 ───────────────────
      const imageUrls: (string | null)[] = new Array(parsed.length).fill(null);
      const withImages = parsed.map((q, i) => ({ q, i })).filter(({ q }) => !!q.image_file);

      if (withImages.length > 0) {
        const BATCH = 3;
        let done = 0;
        for (let b = 0; b < withImages.length; b += BATCH) {
          flushSync(() =>
            setSaveStep(`Uploading image ${done + 1}${BATCH > 1 ? `–${Math.min(done + BATCH, withImages.length)}` : ""} of ${withImages.length}…`)
          );
          await withTimeout(
            Promise.all(
              withImages.slice(b, b + BATCH).map(async ({ q, i }) => {
                const ext = q.image_file!.name.split(".").pop() ?? "jpg";
                const path = `questions/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                const { error: upErr } = await supabase.storage.from("question-images").upload(path, q.image_file!);
                if (!upErr) {
                  const { data } = supabase.storage.from("question-images").getPublicUrl(path);
                  imageUrls[i] = data.publicUrl;
                }
                done++;
              })
            ),
            30_000,
            `Image batch upload (${b}–${b + BATCH})`
          );
        }
      }

      // ── Step 3: bulk-insert all rows in ONE request ───────────────────────
      flushSync(() => setSaveStep(`Saving ${parsed.length} question${parsed.length !== 1 ? "s" : ""}…`));

      const rows = parsed.map((q, i) => {
        const row: Record<string, unknown> = {
          subject_id: selectedSubjectId,
          topic_id: topicId,
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_answer: q.correct_answer,
          explanation: q.explanation || null,
          image_url: imageUrls[i],
        };
        if (isInstituteAdmin && profile?.institute_id) {
          row.institute_id = profile.institute_id;
        }
        return row;
      });

      const { error: insertErr } = await withTimeout(
        supabase.from("questions").insert(rows),
        30_000,
        "Bulk question insert"
      );

      if (insertErr) {
        throw new Error(`Insert failed (${insertErr.code}): ${insertErr.message}`);
      }

      toast({ title: `✓ ${parsed.length} question${parsed.length !== 1 ? "s" : ""} saved!` });
      setParsed([]);
      setBulkText("");
      setTopicName("");

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
      setSaveStep("");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this question? This cannot be undone.")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    setQuestions(prev => prev.filter(q => q.id !== id));
    toast({ title: "Question deleted" });
  }

  if (!isAdmin) return <div className="p-6 text-center text-muted-foreground">Access Denied</div>;

  const filteredBank = searchText
    ? questions.filter(q => q.question_text.toLowerCase().includes(searchText.toLowerCase()))
    : questions;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Questions</h1>

      <div className="flex gap-2">
        <Button variant={tab === "bulk" ? "default" : "outline"} size="sm" onClick={() => setTab("bulk")}>Bulk Upload</Button>
        <Button variant={tab === "bank" ? "default" : "outline"} size="sm" onClick={() => setTab("bank")}>Question Bank</Button>
      </div>

      {tab === "bulk" && (
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="font-semibold">Step 1 — Select Subject & Topic</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Select value={selectedSubjectId} onValueChange={v => { setSelectedSubjectId(v); setSaveError(null); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="max-h-64 overflow-y-auto">
                  {subjects.length === 0
                    ? <SelectItem value="__none__" disabled>No subjects available</SelectItem>
                    : subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                  }
                </SelectContent>
              </Select>
              <Input
                value={topicName}
                onChange={e => setTopicName(e.target.value)}
                placeholder="Topic name (optional)"
              />
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="font-semibold">Step 2 — Paste Questions</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              One block per question, separated by a blank line:<br />
              <code className="text-xs">Question: ...<br />A. &nbsp;B. &nbsp;C. &nbsp;D.<br />Answer: C<br />Explanation: ...</code>
            </p>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={"Question: What is the powerhouse of the cell?\nA. Nucleus\nB. Ribosome\nC. Mitochondria\nD. Golgi body\nAnswer: C\nExplanation: Mitochondria produce ATP."}
              className="w-full h-56 bg-background border border-border rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button onClick={handleParse} variant="outline" disabled={!bulkText.trim()}>Parse Questions</Button>
          </div>

          {/* Step 3 */}
          {parsed.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="font-semibold">Step 3 — Preview & Save ({parsed.length} questions)</h2>
                <Button onClick={handleSaveAll} disabled={saving || !selectedSubjectId} className="min-w-44">
                  {saving
                    ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{saveStep}</span>
                    : `Save All ${parsed.length} Questions`
                  }
                </Button>
              </div>

              {/* Inline progress banner */}
              {saving && (
                <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 text-sm text-primary">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>{saveStep}</span>
                </div>
              )}

              {/* Inline error banner (persists after toast disappears) */}
              {saveError && !saving && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Save failed</div>
                    <div className="text-xs mt-0.5 opacity-80">{saveError}</div>
                  </div>
                  <button className="ml-auto text-xs underline opacity-70 hover:opacity-100" onClick={() => setSaveError(null)}>Dismiss</button>
                </div>
              )}

              {parsed.map((q, idx) => (
                <div key={idx} className="bg-card border border-border rounded-xl p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm flex-1">{idx + 1}. {q.question_text}</p>
                    <Button variant="ghost" size="sm" onClick={() => setParsed(p => p.filter((_, i) => i !== idx))}>
                      <XCircle className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {(["A", "B", "C", "D"] as const).map(opt => (
                      <div key={opt} className={`flex items-center gap-2 p-2 rounded-lg ${q.correct_answer === opt ? "bg-emerald-500/10 text-emerald-400" : "bg-background"}`}>
                        {q.correct_answer === opt ? <CheckCircle className="w-3 h-3 shrink-0" /> : <span className="w-3 h-3 shrink-0" />}
                        <span className="font-medium">{opt}.</span>
                        <span className="truncate">{q[`option_${opt.toLowerCase()}` as keyof ParsedQuestion] as string}</span>
                      </div>
                    ))}
                  </div>
                  {q.explanation && <p className="text-xs text-muted-foreground italic">{q.explanation}</p>}
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                      <Upload className="w-3 h-3" />
                      {q.preview_url ? "Change image" : "Add image"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                        onChange={e => e.target.files?.[0] && handleImageUpload(idx, e.target.files[0])} />
                    </label>
                    {q.preview_url && <img src={q.preview_url} alt="preview" className="h-12 rounded object-contain border border-border" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "bank" && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search questions…" className="pl-9" />
            </div>
            <Select value={bankSubject} onValueChange={setBankSubject}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All subjects" /></SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="max-h-64 overflow-y-auto">
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loadingBank ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {filteredBank.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No questions found</div>
              ) : filteredBank.map(q => (
                <div key={q.id} className="flex items-start justify-between gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2">{q.question_text}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {q.subjects?.name && <span className="text-xs text-muted-foreground">{q.subjects.name}</span>}
                      {q.topics?.name && <span className="text-xs text-muted-foreground">· {q.topics.name}</span>}
                      <span className="text-xs text-emerald-400">Ans: {q.correct_answer}</span>
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
