import { useEffect, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuiz } from "@/hooks/useQuizzes";
import { useAuth } from "@/contexts/AuthContext";
import { useQuizAttempt } from "@/hooks/useAttempts";
import { useQuizGuard } from "@/contexts/QuizGuardContext";
import { supabase } from "@/lib/supabase";
import { formatTime, formatCountdown, calcAccuracy, getQuizStatusInfo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Clock, Share2, MessageCircle, Send, ArrowLeft, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

interface Question {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string | null;
  image_url: string | null;
}

type QuizPhase = "lobby" | "question" | "options" | "result";

export default function QuizDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { quiz, loading: quizLoading } = useQuiz(id);
  const { user } = useAuth();
  const { attempt: existingAttempt } = useQuizAttempt(id);
  const { toast } = useToast();
  const { setQuizActive } = useQuizGuard();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [phase, setPhase] = useState<QuizPhase>("lobby");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; correct: number; total: number; timeTaken: number } | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("quiz_questions")
      .select("order_index, questions(*)")
      .eq("quiz_id", id)
      .order("order_index")
      .then(({ data }) => {
        if (data) {
          setQuestions(
            (data as unknown as Array<{ questions: Question }>)
              .map(r => r.questions)
              .filter(Boolean)
          );
        }
      });
  }, [id]);

  // Timer
  useEffect(() => {
    if (phase !== "question" && phase !== "options") return;
    const totalSecs = (quiz?.duration_minutes ?? 30) * 60;
    if (!startedAt) return;
    setTimeLeft(totalSecs - Math.floor((Date.now() - startedAt.getTime()) / 1000));
    const t = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
      const remaining = totalSecs - elapsed;
      setTimeLeft(remaining);
      if (remaining <= 0) { clearInterval(t); handleSubmit(); }
    }, 1000);
    return () => clearInterval(t);
  }, [phase, startedAt]);

  // Anti-cheat: warn on tab switch during live quiz
  useEffect(() => {
    if (quiz?.quiz_type !== "live" || phase === "lobby" || phase === "result") return;
    const handleBlur = () => toast({ title: "Warning", description: "Tab switch detected!", variant: "destructive" });
    const handleContext = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("blur", handleBlur);
    document.addEventListener("contextmenu", handleContext);
    return () => { window.removeEventListener("blur", handleBlur); document.removeEventListener("contextmenu", handleContext); };
  }, [quiz?.quiz_type, phase]);

  // Prevent accidental browser close / refresh during active quiz
  useEffect(() => {
    if (phase === "lobby" || phase === "result") return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [phase]);

  // Intercept browser back button during active quiz
  useEffect(() => {
    if (phase === "lobby" || phase === "result") return;
    window.history.pushState(null, "", window.location.href);
    const handlePop = () => {
      window.history.pushState(null, "", window.location.href);
      setShowBackConfirm(true);
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [phase]);

  const handleStart = useCallback(async () => {
    if (!user) { setLocation("/auth"); return; }
    if (questions.length === 0) { toast({ title: "No questions", description: "This quiz has no questions yet." }); return; }
    setStartedAt(new Date());
    setPhase("question");
    setCurrentIndex(0);
    setAnswers({});
    setQuizActive(true);
  }, [user, questions]);

  const handleNextPhase = useCallback(() => {
    if (phase === "question") setPhase("options");
    else if (phase === "options") {
      if (selectedOption) {
        setAnswers(prev => ({ ...prev, [questions[currentIndex].id]: selectedOption }));
      }
      setSelectedOption(null);
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(i => i + 1);
        setPhase("question");
      } else {
        handleSubmit();
      }
    }
  }, [phase, selectedOption, currentIndex, questions]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (!user) {
      toast({ title: "Not signed in", description: "Please sign in to save your score.", variant: "destructive" });
      return;
    }
    if (!quiz) return;
    setSubmitting(true);
    const finalAnswers = selectedOption
      ? { ...answers, [questions[currentIndex]?.id]: selectedOption }
      : answers;

    let correct = 0;
    questions.forEach(q => {
      if (finalAnswers[q.id] === q.correct_answer) correct++;
    });
    const timeTaken = startedAt ? Math.floor((Date.now() - startedAt.getTime()) / 1000) : 0;
    const score = correct * 10;
    const accuracy = calcAccuracy(correct, questions.length);

    // 1. Save attempt
    const { error: attemptError } = await supabase.from("attempts").upsert({
      user_id: user.id,
      quiz_id: quiz.id,
      score,
      total_questions: questions.length,
      correct_answers: correct,
      time_taken_seconds: timeTaken,
      answers: finalAnswers,
    }, { onConflict: "user_id,quiz_id" });
    if (attemptError) toast({ title: "Attempt save error", description: attemptError.message, variant: "destructive" });

    // 2. Per-quiz leaderboard entry
    const { error: quizLBError } = await supabase.from("leaderboard").upsert(
      { user_id: user.id, quiz_id: quiz.id, period: "quiz", score, accuracy, time_taken_seconds: timeTaken },
      { onConflict: "user_id,quiz_id,period" }
    );
    if (quizLBError) toast({ title: "Quiz leaderboard error", description: quizLBError.message, variant: "destructive" });

    // 3. Global leaderboard — accumulated total
    const { data: existingGlobal, error: globalReadErr } = await supabase
      .from("leaderboard")
      .select("id, score")
      .eq("user_id", user.id)
      .eq("period", "global")
      .is("quiz_id", null)
      .maybeSingle();
    if (globalReadErr) toast({ title: "Global LB read error", description: globalReadErr.message, variant: "destructive" });

    if (existingGlobal) {
      const { error: e } = await supabase.from("leaderboard")
        .update({ score: (existingGlobal.score ?? 0) + score, accuracy, time_taken_seconds: timeTaken })
        .eq("id", existingGlobal.id);
      if (e) toast({ title: "Global LB update error", description: e.message, variant: "destructive" });
    } else {
      const { error: e } = await supabase.from("leaderboard").insert(
        { user_id: user.id, quiz_id: null, period: "global", score, accuracy, time_taken_seconds: timeTaken }
      );
      if (e) toast({ title: "Global LB insert error", description: e.message, variant: "destructive" });
    }

    // 4. Weekly leaderboard — accumulated weekly
    const { data: existingWeekly, error: weeklyReadErr } = await supabase
      .from("leaderboard")
      .select("id, score")
      .eq("user_id", user.id)
      .eq("period", "weekly")
      .is("quiz_id", null)
      .maybeSingle();
    if (weeklyReadErr) toast({ title: "Weekly LB read error", description: weeklyReadErr.message, variant: "destructive" });

    if (existingWeekly) {
      const { error: e } = await supabase.from("leaderboard")
        .update({ score: (existingWeekly.score ?? 0) + score, accuracy, time_taken_seconds: timeTaken })
        .eq("id", existingWeekly.id);
      if (e) toast({ title: "Weekly LB update error", description: e.message, variant: "destructive" });
    } else {
      const { error: e } = await supabase.from("leaderboard").insert(
        { user_id: user.id, quiz_id: null, period: "weekly", score, accuracy, time_taken_seconds: timeTaken }
      );
      if (e) toast({ title: "Weekly LB insert error", description: e.message, variant: "destructive" });
    }

    // 5. Update user total_points
    const { data: userData, error: userReadErr } = await supabase.from("users").select("total_points").eq("id", user.id).single();
    if (userReadErr) toast({ title: "User read error", description: userReadErr.message, variant: "destructive" });
    if (userData) {
      const { error: e } = await supabase.from("users").update({ total_points: (userData.total_points ?? 0) + score }).eq("id", user.id);
      if (e) toast({ title: "Points update error", description: e.message, variant: "destructive" });
    }

    toast({ title: "Score saved!", description: `${score} pts · ${accuracy}% accuracy` });
    setQuizActive(false);
    setResult({ score, correct, total: questions.length, timeTaken });
    setPhase("result");
    setSubmitting(false);

    // Check if answers should be revealed
    const isPractice = quiz.quiz_type === "practice";
    const isEnded = quiz.end_time && new Date(quiz.end_time).getTime() < Date.now();
    setShowAnswers(isPractice || !!isEnded);
  }, [user, quiz, questions, answers, selectedOption, currentIndex, startedAt, submitting]);

  if (quizLoading) return <div className="p-6 text-center text-muted-foreground">Loading quiz...</div>;
  if (!quiz) return <div className="p-6 text-center text-muted-foreground">Quiz not found.</div>;

  const statusInfo = getQuizStatusInfo(quiz.status, quiz.start_time, quiz.end_time);
  const q = questions[currentIndex];

  // RESULT SCREEN
  if (phase === "result" && result) {
    const accuracyPercent = calcAccuracy(result.correct, result.total);
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-lg w-full space-y-6">
          <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Trophy className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold">Quiz Complete!</h1>
            <div className="grid grid-cols-3 gap-4 py-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{result.score}</div>
                <div className="text-xs text-muted-foreground">Points</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-400">{accuracyPercent}%</div>
                <div className="text-xs text-muted-foreground">Accuracy</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-sky-400">{formatTime(result.timeTaken)}</div>
                <div className="text-xs text-muted-foreground">Time</div>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              {result.correct}/{result.total} correct answers
            </p>

            {/* Share */}
            <div className="flex gap-2 justify-center pt-2 flex-wrap">
              <Button
                variant="outline" size="sm"
                onClick={async () => {
                  const shareText = `I scored ${result.score} pts on "${quiz.title}"! 🏆`;
                  if (navigator.share) {
                    try { await navigator.share({ title: quiz.title, text: shareText }); return; } catch {}
                  }
                  await navigator.clipboard.writeText(shareText).catch(() => {});
                  toast({ title: "Copied!", description: "Score copied to clipboard." });
                }}
              >
                <Share2 className="w-3 h-3 mr-1" /> Share
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`I scored ${result.score} pts on "${quiz.title}"! 🏆 Try it on Quizora`)}`, "_blank")}
              >
                <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent("https://quizora.app")}&text=${encodeURIComponent(`I scored ${result.score} pts on "${quiz.title}"! 🏆`)}`, "_blank")}
              >
                <Send className="w-3 h-3 mr-1" /> Telegram
              </Button>
            </div>
          </div>

          {/* Answer Review — only if unlocked */}
          {showAnswers && (
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              <div className="p-4 font-semibold">Answer Review</div>
              {questions.map((question, idx) => {
                const userAns = answers[question.id];
                const correct = userAns === question.correct_answer;

                return (
                  <div key={question.id} className="p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      {correct ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      )}

                      <p className="text-sm font-medium">
                        {idx + 1}. {question.question_text}
                      </p>
                    </div>

                    <div className="ml-6 space-y-2">
                      {(["A", "B", "C", "D"] as const).map(opt => {
                        const optionText =
                          question[`option_${opt.toLowerCase() as "a" | "b" | "c" | "d"}`];

                        const isUser = userAns === opt;
                        const isCorrect = question.correct_answer === opt;

                        return (
                          <div
                            key={opt}
                            className={`p-3 rounded-lg border text-sm ${
                              isCorrect
                                ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                                : isUser
                                ? "border-red-500 bg-red-500/10 text-red-400"
                                : "border-border"
                            }`}
                          >
                            <span className="font-semibold mr-2">{opt}.</span>
                            {optionText}

                            {isUser && (
                              <span className="ml-2 text-xs">(Your Answer)</span>
                            )}

                            {isCorrect && (
                              <span className="ml-2 text-xs">(Correct Answer)</span>
                            )}
                          </div>
                        );
                      })}

                      {question.explanation && (
                        <div className="text-xs text-muted-foreground italic pt-1">
                          Explanation: {question.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!showAnswers && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-400 text-center">
              Answer review will be unlocked after the quiz officially ends.
            </div>
          )}

          <div className="flex gap-3">
            <Link href="/dashboard" className="flex-1">
              <Button variant="outline" className="w-full"><ArrowLeft className="w-4 h-4 mr-1" /> Dashboard</Button>
            </Link>
            <Link href={`/leaderboard?quiz=${quiz.id}`} className="flex-1">
              <Button className="w-full"><Trophy className="w-4 h-4 mr-1" /> Quiz Ranking</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // LOBBY SCREEN
  if (phase === "lobby") {
    const alreadyAttempted = !!existingAttempt;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-lg w-full space-y-6">
          <Link href="/quizzes">
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          </Link>
          <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
            <div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.bg} ${statusInfo.color}`}>{statusInfo.label}</span>
              <h1 className="text-2xl font-bold mt-3">{quiz.title}</h1>
              {quiz.description && <p className="text-muted-foreground mt-2">{quiz.description}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background rounded-xl p-3">
                <div className="text-xs text-muted-foreground mb-1">Subject</div>
                <div className="font-medium">{quiz.subjects?.name ?? "Mixed"}</div>
              </div>
              <div className="bg-background rounded-xl p-3">
                <div className="text-xs text-muted-foreground mb-1">Duration</div>
                <div className="font-medium flex items-center gap-1"><Clock className="w-3 h-3" />{quiz.duration_minutes} min</div>
              </div>
              <div className="bg-background rounded-xl p-3">
                <div className="text-xs text-muted-foreground mb-1">Questions</div>
                <div className="font-medium">{questions.length}</div>
              </div>
              <div className="bg-background rounded-xl p-3">
                <div className="text-xs text-muted-foreground mb-1">Type</div>
                <div className="font-medium capitalize">{quiz.quiz_type}</div>
              </div>
            </div>
            {quiz.start_time && statusInfo.label === "Upcoming" && (
              <div className="text-center text-amber-400 text-sm">
                Starts in {formatCountdown(quiz.start_time)}
              </div>
            )}
            {alreadyAttempted ? (
              <div className="space-y-3">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-sm text-emerald-400 text-center">
                  You've already completed this quiz!<br />
                  Score: {existingAttempt.score} pts · {calcAccuracy(existingAttempt.correct_answers, existingAttempt.total_questions)}% accuracy
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setAnswers(existingAttempt.answers || {});
                      setShowAnswers(true);
                      setPhase("result");

                      setResult({
                        score: existingAttempt.score,
                        correct: existingAttempt.correct_answers,
                        total: existingAttempt.total_questions,
                        timeTaken: existingAttempt.time_taken_seconds,
                      });
                    }}
                  >
                    Review Answers
                  </Button>

                  <Button
                    data-testid="button-start-quiz"
                    className="flex-1"
                    onClick={handleStart}
                  >
                    Retake Quiz
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                data-testid="button-start-quiz"
                className="w-full h-11"
                onClick={handleStart}
                disabled={statusInfo.label === "Upcoming" || questions.length === 0}
              >
                {questions.length === 0 ? "No questions yet" : statusInfo.label === "Upcoming" ? "Not started yet" : "Start Quiz"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!q) return null;

  // Shared back-button confirm dialog (browser back / in-quiz back)
  const BackConfirmDialog = showBackConfirm ? (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <h2 className="font-semibold text-lg">Exit Quiz?</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to exit the quiz? Your progress may be lost.
        </p>
        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={() => setShowBackConfirm(false)}>
            Stay in Quiz
          </Button>
          <Button variant="destructive" className="flex-1" onClick={() => {
            setShowBackConfirm(false);
            setQuizActive(false);
            setLocation("/quizzes");
          }}>
            Exit Quiz
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  // QUESTION SCREEN (page 1)
  if (phase === "question") {
    return (
      <div className="min-h-screen flex flex-col bg-background select-none" onContextMenu={e => quiz.quiz_type === "live" && e.preventDefault()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <span className="text-sm text-muted-foreground">{currentIndex + 1} / {questions.length}</span>
          <div className="flex items-center gap-2 text-sm font-mono">
            <Clock className="w-4 h-4" />
            <span className={timeLeft < 60 ? "text-red-400" : ""}>{formatTime(timeLeft)}</span>
          </div>
          <div className="w-12" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full space-y-6">
          {q.image_url && (
            <img src={q.image_url} alt="Question" className="max-h-48 rounded-xl object-contain border border-border" />
          )}
          <div className="bg-card border border-border rounded-2xl p-6 w-full">
            <p className="text-sm text-muted-foreground mb-3">Question {currentIndex + 1}</p>
            <p className="text-lg font-medium leading-relaxed">{q.question_text}</p>
          </div>
          <div className="flex gap-3 w-full">
  <Button
    variant="outline"
    className="flex-1 h-12"
    onClick={() => {
      if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    }}
    disabled={currentIndex === 0}
  >
    ← Previous Question
  </Button>

  <Button
    data-testid="button-show-options"
    className="flex-1 h-12"
    onClick={handleNextPhase}
  >
    Show Options →
  </Button>
</div>
        </div>
      </div>
      {BackConfirmDialog}
    );
  }

  // OPTIONS SCREEN (page 2)
  return (
    <div className="min-h-screen flex flex-col bg-background select-none" onContextMenu={e => quiz.quiz_type === "live" && e.preventDefault()}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <span className="text-sm text-muted-foreground">{currentIndex + 1} / {questions.length}</span>
        <div className="flex items-center gap-2 text-sm font-mono">
          <Clock className="w-4 h-4" />
          <span className={timeLeft < 60 ? "text-red-400" : ""}>{formatTime(timeLeft)}</span>
        </div>
        <div className="w-12" />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full space-y-4">
        <p className="text-sm text-muted-foreground self-start">Select your answer:</p>
        {(["A", "B", "C", "D"] as const).map(opt => {
          const text = q[`option_${opt.toLowerCase()}` as keyof Question] as string;
          const isSelected = selectedOption === opt;
          return (
            <button
              key={opt}
              data-testid={`option-${opt}`}
              onClick={() => setSelectedOption(opt)}
              className={`w-full text-left p-4 rounded-xl border transition-colors ${isSelected ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:border-primary/50"}`}
            >
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-3 ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {opt}
              </span>
              {text}
            </button>
          );
        })}
        <div className="flex gap-3 w-full mt-2">
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={() => setPhase("question")}
          >
            ← Back to Question
          </Button>

          <Button
            data-testid="button-next-question"
            className="flex-1 h-12"
            onClick={handleNextPhase}
            disabled={submitting}
          >
            {currentIndex < questions.length - 1
              ? "Next Question →"
              : submitting
              ? "Submitting..."
              : "Submit Quiz"}
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleNextPhase}
        >
          Skip
        </Button>
      </div>
      {BackConfirmDialog}
    </div>
  );
}
