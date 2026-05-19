import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatCountdown(targetDate: string): string {
  const diff = new Date(targetDate).getTime() - Date.now();
  if (diff <= 0) return "Starting now";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function calcAccuracy(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

export function getQuizStatusInfo(status: string, startTime: string | null, endTime: string | null) {
  const now = Date.now();
  if (status === "ended") return { label: "Ended", color: "text-slate-400", bg: "bg-slate-400/10" };
  if (startTime && new Date(startTime).getTime() > now) return { label: "Upcoming", color: "text-amber-400", bg: "bg-amber-400/10" };
  if (endTime && new Date(endTime).getTime() < now) return { label: "Ended", color: "text-slate-400", bg: "bg-slate-400/10" };
  if (status === "live") return { label: "Live", color: "text-emerald-400", bg: "bg-emerald-400/10" };
  return { label: "Practice", color: "text-sky-400", bg: "bg-sky-400/10" };
}

export function parseBulkMCQ(text: string) {
  const questions: Array<{
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_answer: string;
    explanation: string;
  }> = [];

  const blocks = text.trim().split(/\n\s*\n(?=Question:|Q\d+[.:])/i);

  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    let questionText = "";
    let optionA = "", optionB = "", optionC = "", optionD = "";
    let correctAnswer = "";
    let explanation = "";
    let inExplanation = false;

    for (const line of lines) {
      if (/^(Question:|Q\d+[.:])/i.test(line)) {
        questionText = line.replace(/^(Question:|Q\d+[.:])\s*/i, "").trim();
        inExplanation = false;
      } else if (/^Options?:/i.test(line)) {
        inExplanation = false;
      } else if (/^Answer:/i.test(line)) {
        inExplanation = false;
        correctAnswer = line.replace(/^Answer:\s*/i, "").trim().toUpperCase().charAt(0);
      } else if (/^Explanation:/i.test(line)) {
        inExplanation = true;
        explanation = line.replace(/^Explanation:\s*/i, "").trim();
      } else if (inExplanation) {
        explanation += " " + line;
      } else if (/^A[.)]\s/i.test(line)) optionA = line.replace(/^A[.)]\s*/i, "").trim();
      else if (/^B[.)]\s/i.test(line)) optionB = line.replace(/^B[.)]\s*/i, "").trim();
      else if (/^C[.)]\s/i.test(line)) optionC = line.replace(/^C[.)]\s*/i, "").trim();
      else if (/^D[.)]\s/i.test(line)) optionD = line.replace(/^D[.)]\s*/i, "").trim();
      else if (!questionText) questionText = line;
    }

    if (questionText && optionA && optionB && optionC && optionD && correctAnswer) {
      questions.push({ question_text: questionText, option_a: optionA, option_b: optionB, option_c: optionC, option_d: optionD, correct_answer: correctAnswer, explanation });
    }
  }
  return questions;
}
