import { useEffect, useState } from "react";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useQuizzes } from "@/hooks/useQuizzes";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Trophy, RefreshCw, Clock, ChevronDown } from "lucide-react";
import { formatTime } from "@/lib/utils";

export default function LeaderboardPage() {
  // Read quiz param from URL directly — avoids wouter hook timing issues
  const quizParam = new URLSearchParams(window.location.search).get("quiz") ?? "";

  const [period, setPeriod] = useState<"global" | "weekly" | "quiz">(quizParam ? "quiz" : "global");
  const [selectedQuizId, setSelectedQuizId] = useState<string>(quizParam);
  const [quizPickerOpen, setQuizPickerOpen] = useState(false);

  const { quizzes } = useQuizzes();
  const { entries, loading, error, refetch } = useLeaderboard(period, selectedQuizId || undefined);
  const { profile } = useAuth();

  // Auto-select first quiz when switching to quiz tab with no selection
  useEffect(() => {
    if (period === "quiz" && !selectedQuizId && quizzes.length > 0) {
      setSelectedQuizId(quizzes[0].id);
    }
  }, [period, quizzes, selectedQuizId]);

  const myRank = entries.findIndex(e => e.user_id === profile?.id) + 1;
  const selectedQuiz = quizzes.find(q => q.id === selectedQuizId);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-400" /> Leaderboard
        </h1>
        <Button variant="outline" size="sm" onClick={refetch}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Period tabs */}
      <div className="flex gap-2">
        {(["global", "weekly", "quiz"] as const).map(p => (
          <Button
            key={p}
            variant={period === p ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(p)}
          >
            {p === "global" ? "Global" : p === "weekly" ? "Weekly" : "Per Quiz"}
          </Button>
        ))}
      </div>

      {/* Quiz picker — shown only when quiz tab is active */}
      {period === "quiz" && (
        <div className="relative">
          <button
            onClick={() => setQuizPickerOpen(o => !o)}
            className="w-full flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <span className="truncate">
              {selectedQuiz ? selectedQuiz.title : "Select a quiz…"}
            </span>
            <ChevronDown className={`w-4 h-4 ml-2 shrink-0 transition-transform ${quizPickerOpen ? "rotate-180" : ""}`} />
          </button>

          {quizPickerOpen && (
            <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
              {quizzes.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">No quizzes yet</div>
              ) : (
                quizzes.map(q => (
                  <button
                    key={q.id}
                    onClick={() => { setSelectedQuizId(q.id); setQuizPickerOpen(false); }}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-muted/50 transition-colors border-b border-border last:border-0 ${selectedQuizId === q.id ? "text-primary font-medium" : ""}`}
                  >
                    <div className="font-medium truncate">{q.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {q.subjects?.name ?? "General"} · {q.quiz_type}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* My rank badge */}
      {myRank > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm font-medium">Your Rank</span>
          <span className="text-2xl font-bold text-primary">#{myRank}</span>
        </div>
      )}

      {/* Column headers for quiz mode */}
      {period === "quiz" && entries.length > 0 && (
        <div className="flex items-center gap-4 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wide">
          <div className="w-8" />
          <div className="w-9" />
          <div className="flex-1">Student</div>
          <div className="text-right w-20">Score</div>
          <div className="text-right w-16">Time</div>
          <div className="text-right w-14">Acc</div>
        </div>
      )}

      {/* Entries */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 text-center space-y-2">
          <p className="text-destructive font-medium text-sm">Failed to load leaderboard</p>
          <p className="text-xs text-muted-foreground font-mono">{error}</p>
          <button onClick={refetch} className="text-xs text-primary underline mt-1">Try again</button>
        </div>
      ) : period === "quiz" && !selectedQuizId ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
          Select a quiz above to see its leaderboard
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
          {period === "quiz" ? "No one has completed this quiz yet." : "No scores yet. Complete a quiz to appear here!"}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {entries.map((entry, i) => {
            const isMe = entry.user_id === profile?.id;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 p-4 ${isMe ? "bg-primary/5" : ""}`}
              >
                {/* Rank */}
                <div className={`w-8 text-center font-bold shrink-0 ${i === 0 ? "text-amber-400 text-lg" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-muted-foreground text-sm"}`}>
                  {medal ?? `#${i + 1}`}
                </div>

                {/* Avatar */}
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarImage src={entry.users?.avatar_url ?? undefined} />
                  <AvatarFallback>{entry.users?.full_name?.charAt(0) ?? "?"}</AvatarFallback>
                </Avatar>

                {/* Name & college */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {entry.users?.full_name ?? "Anonymous"}
                    {isMe && <span className="text-xs text-primary ml-1">(you)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {entry.users?.college_name ?? ""}
                  </div>
                </div>

                {/* Stats */}
                {period === "quiz" ? (
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="font-semibold text-sm">{entry.score} pts</div>
                      <div className="text-xs text-muted-foreground">{entry.accuracy}% acc</div>
                    </div>
                    <div className="text-right min-w-[52px]">
                      <div className="flex items-center gap-1 text-sky-400 font-semibold text-sm justify-end">
                        <Clock className="w-3 h-3" />
                        {formatTime(entry.time_taken_seconds)}
                      </div>
                      <div className="text-xs text-muted-foreground">time</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-sm">{entry.score} pts</div>
                    <div className="text-xs text-muted-foreground">{entry.accuracy}% acc</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tiebreaker note for quiz mode */}
      {period === "quiz" && entries.length > 1 && (
        <p className="text-xs text-muted-foreground text-center">
          Ranked by score · then fastest time · then accuracy
        </p>
      )}
    </div>
  );
}
