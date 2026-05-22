import { useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuizzes } from "@/hooks/useQuizzes";
import { useSubjects } from "@/hooks/useSubjects";
import { getQuizStatusInfo, formatCountdown } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Clock, Filter } from "lucide-react";

export default function QuizzesPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const [statusFilter, setStatusFilter] = useState(params.get("status") ?? "all");
  const [typeFilter, setTypeFilter] = useState(params.get("type") ?? "all");
  const [subjectFilter, setSubjectFilter] = useState(params.get("subject") ?? "all");

  const { quizzes, loading } = useQuizzes({
    type: typeFilter !== "all" ? typeFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    subject_id: subjectFilter !== "all" ? subjectFilter : undefined,
  });
  const { subjects } = useSubjects();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quizzes</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger data-testid="select-type" className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="practice">Practice</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger data-testid="select-status" className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="ended">Ended</SelectItem>
          </SelectContent>
        </Select>

        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger data-testid="select-subject" className="w-44">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Quiz Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          No quizzes found. Try adjusting your filters.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map(quiz => {
            const statusInfo = getQuizStatusInfo(quiz.status, quiz.start_time, quiz.end_time);
            return (
              <div key={quiz.id} data-testid={`card-quiz-${quiz.id}`} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.bg} ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {quiz.duration_minutes}m
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">{quiz.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{quiz.subjects?.name ?? "Mixed Subject"}</p>
                  {quiz.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{quiz.description}</p>}
                </div>
                {quiz.start_time && statusInfo.label === "Upcoming" && (
                  <div className="text-xs text-amber-400 font-mono">Starts in {formatCountdown(quiz.start_time)}</div>
                )}
                {quiz.end_time && statusInfo.label === "Live" && (
                  <div className="text-xs text-emerald-400 font-mono">Ends in {formatCountdown(quiz.end_time)}</div>
                )}
                <div className="flex gap-2 mt-auto">
                  <Link href={`/quiz/${quiz.id}`} className="flex-1">
                    <Button data-testid={`button-join-${quiz.id}`} className="w-full" size="sm">
                      <Play className="w-3 h-3 mr-1" />
                      {statusInfo.label === "Upcoming" ? "Preview" : statusInfo.label === "Ended" ? "Review" : "Start"}
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const shareUrl = `${window.location.origin}/quiz/${quiz.id}`;

                      if (navigator.share) {
                        try {
                          await navigator.share({
                            title: quiz.title,
                            text: `Try this quiz: ${quiz.title}`,
                            url: shareUrl,
                          });
                        } catch (err) {
                          console.log(err);
                        }
                      } else {
                        await navigator.clipboard.writeText(shareUrl);
                        alert("Quiz link copied!");
                      }
                    }}
                  >
                    Share
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
