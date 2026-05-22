import { useState } from "react";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Trophy, RefreshCw } from "lucide-react";
import { calcAccuracy } from "@/lib/utils";

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<"global" | "weekly" | "quiz">("global");
  const { entries, loading, refetch } = useLeaderboard(period);
  const { profile } = useAuth();

  const myRank = entries.findIndex(e => e.user_id === profile?.id) + 1;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
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
            data-testid={`tab-leaderboard-${p}`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </Button>
        ))}
      </div>

      {myRank > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm font-medium">Your Rank</span>
          <span className="text-2xl font-bold text-primary">#{myRank}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          No scores yet. Complete a quiz to appear here!
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {entries.map((entry, i) => {
            const isMe = entry.user_id === profile?.id;
            return (
              <div key={entry.id} data-testid={`row-leaderboard-${i}`} className={`flex items-center gap-4 p-4 ${isMe ? "bg-primary/5" : ""}`}>
                <div className={`w-8 text-center font-bold ${i === 0 ? "text-amber-400 text-lg" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-muted-foreground text-sm"}`}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </div>
                <Avatar className="w-9 h-9">
                  <AvatarImage src={entry.users?.avatar_url ?? undefined} />
                  <AvatarFallback>{entry.users?.full_name?.charAt(0) ?? "?"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{entry.users?.full_name ?? "Anonymous"} {isMe && <span className="text-xs text-primary ml-1">(you)</span>}</div>
                  <div className="text-xs text-muted-foreground truncate">{entry.users?.college_name ?? ""}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-sm">{entry.score} pts</div>
                  <div className="text-xs text-muted-foreground">{entry.accuracy}% acc</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
