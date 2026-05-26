import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuizzes } from "@/hooks/useQuizzes";
import { useSubjects } from "@/hooks/useSubjects";
import { useMyAttempts } from "@/hooks/useAttempts";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { formatCountdown, getQuizStatusInfo, calcAccuracy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookOpen, Trophy, Zap, Target, Clock, Users, ChevronRight, Play } from "lucide-react";

export default function Dashboard() {
  const { profile } = useAuth();
  const { quizzes, loading: qLoading } = useQuizzes();
  const { subjects, loading: sLoading } = useSubjects(profile?.category_id);
  const { attempts } = useMyAttempts();
  const { entries: leaderboard } = useLeaderboard("global");
  const [, setTick] = useState(0);

  // Refresh countdown timers every second
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();

  const liveQuizzes = quizzes.filter(q => {
    if (!q.start_time || !q.end_time) return false;

    return (
      new Date(q.start_time).getTime() <= now &&
      new Date(q.end_time).getTime() >= now
    );
  });

  const upcomingQuizzes = quizzes.filter(q => {
    if (!q.start_time) return false;

    return new Date(q.start_time).getTime() > now;
  });

  const recentQuizzes = quizzes.filter(q => {
    if (!q.end_time) return false;

    return new Date(q.end_time).getTime() < now;
  }).slice(0, 3);
  
  const totalAttempted = attempts.length;
  const avgAccuracy = attempts.length
    ? Math.round(attempts.reduce((sum, a) => sum + calcAccuracy(a.correct_answers, a.total_questions), 0) / attempts.length)
    : 0;

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {profile?.full_name?.split(" ")[0] ?? "Doctor"} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {profile?.institute_name ?? profile?.college_name ?? "Student"}{profile?.academic_year ? ` • ${profile.academic_year}` : profile?.mbbs_year ? ` • ${profile.mbbs_year}` : ""}
          </p>
        </div>
        <Link href="/profile">
          <Avatar className="w-10 h-10 cursor-pointer">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback>{profile?.full_name?.charAt(0) ?? "U"}</AvatarFallback>
          </Avatar>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Points", value: profile?.total_points ?? 0, icon: Trophy, color: "text-amber-400" },
          { label: "Streak", value: `${profile?.streak ?? 0} days`, icon: Zap, color: "text-orange-400" },
          { label: "Quizzes Done", value: totalAttempted, icon: BookOpen, color: "text-sky-400" },
          { label: "Avg. Accuracy", value: `${avgAccuracy}%`, icon: Target, color: "text-emerald-400" },
          { label: "Weekly Points", value: profile?.weekly_points ?? 0, icon: Clock, color: "text-purple-400" },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <div className="text-xl font-bold" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Live Quizzes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
            Live Quizzes
          </h2>
          <Link href="/quizzes">
            <Button variant="ghost" size="sm">View all <ChevronRight className="w-4 h-4" /></Button>
          </Link>
        </div>

        {qLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-40 bg-card border border-border rounded-xl animate-pulse" />)}
          </div>
        ) : liveQuizzes.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
            No live or upcoming quizzes right now. Check back soon!
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveQuizzes.slice(0, 6).map(quiz => {
              const statusInfo = getQuizStatusInfo(quiz.status, quiz.start_time, quiz.end_time);
              return (
                <div key={quiz.id} data-testid={`card-quiz-${quiz.id}`} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.bg} ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{quiz.duration_minutes}m</span>
                  </div>
                  <div>
                    <h3 className="font-semibold leading-tight">{quiz.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {quiz.subjects?.name ?? "Mixed Subject"}
                    </p>
                  </div>
                  {quiz.start_time && statusInfo.label === "Upcoming" && (
                    <div className="text-xs text-amber-400 font-mono">
                      Starts in {formatCountdown(quiz.start_time ?? "")}
                    </div>
                  )}
                  {quiz.end_time && statusInfo.label === "Live" && (
                    <div className="text-xs text-emerald-400 font-mono">
                      Ends in {formatCountdown(quiz.end_time)}
                    </div>
                  )}
                  <Link href={`/quiz/${quiz.id}`}>
                    <Button data-testid={`button-join-${quiz.id}`} className="w-full" size="sm">
                      <Play className="w-3 h-3 mr-1" />
                      {statusInfo.label === "Upcoming" ? "View" : "Join Now"}
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Upcoming Quizzes */}
      <div>
        <div className="flex items-center justify-between mb-4 mt-8">
          <h2 className="text-lg font-semibold">
            Upcoming Quizzes
          </h2>
        </div>

        {upcomingQuizzes.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
            No upcoming quizzes
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingQuizzes.slice(0, 6).map(quiz => (
              <div
                key={quiz.id}
                className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3"
              >
                <Badge className="w-fit">
                  Upcoming
                </Badge>

                <div>
                  <h3 className="font-semibold leading-tight">
                    {quiz.title}
                  </h3>

                  <p className="text-sm text-muted-foreground mt-1">
                    {quiz.subjects?.name ?? "Mixed Subject"}
                  </p>
                </div>

                <div className="text-xs text-amber-400 font-mono">
                  Starts in {formatCountdown(quiz.start_time ?? "")}
                </div>

                <Link href={`/quiz/${quiz.id}`}>
                  <Button className="w-full" size="sm" variant="outline">
                    View Quiz
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Recent Quizzes */}
      <div>
        <div className="flex items-center justify-between mb-4 mt-8">
          <h2 className="text-lg font-semibold">
            Recent Quizzes
          </h2>
        </div>

        {recentQuizzes.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
            No recent quizzes
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentQuizzes.map(quiz => (
              <Link key={quiz.id} href={`/quiz/${quiz.id}`}>
                <div className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-primary/40 transition-colors">
                  <h3 className="font-semibold">
                    {quiz.title}
                  </h3>

                  <p className="text-sm text-muted-foreground mt-1">
                    {quiz.subjects?.name ?? "Mixed Subject"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Subjects Grid */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Subjects</h2>
            <Link href="/quizzes">
              <Button variant="ghost" size="sm">Browse <ChevronRight className="w-4 h-4" /></Button>
            </Link>
          </div>
          {sLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {subjects.slice(0, 9).map(subject => (
                <Link key={subject.id} href={`/quizzes?subject=${subject.id}`}>
                  <div data-testid={`card-subject-${subject.id}`} className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 transition-colors">
                    <div className="font-medium text-sm leading-tight">{subject.name}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard Preview */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" /> Top Students
            </h2>
            <Link href="/leaderboard">
              <Button variant="ghost" size="sm">Full <ChevronRight className="w-4 h-4" /></Button>
            </Link>
          </div>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {leaderboard.slice(0, 5).map((entry, i) => (
              <div key={entry.id} className="flex items-center gap-3 p-3">
                <span className={`text-sm font-bold w-5 ${i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                  #{i + 1}
                </span>
                <Avatar className="w-7 h-7">
                  <AvatarImage src={entry.users?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{entry.users?.full_name?.charAt(0) ?? "?"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{entry.users?.full_name ?? "Anonymous"}</div>
                </div>
                <span className="text-sm font-semibold text-amber-400">{entry.score}</span>
              </div>
            ))}
            {leaderboard.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No scores yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {attempts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" /> Recent Activity
          </h2>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {attempts.slice(0, 5).map(attempt => (
              <div key={attempt.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium text-sm">{attempt.quizzes?.title ?? "Quiz"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(attempt.submitted_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-sm">{attempt.score} pts</div>
                  <div className="text-xs text-muted-foreground">
                    {calcAccuracy(attempt.correct_answers, attempt.total_questions)}% accuracy
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
