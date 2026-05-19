import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useSubjects } from "@/hooks/useSubjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

interface Topic {
  id: string;
  name: string;
  subject_id: string;
}

export default function AdminSubjects() {
  const { profile } = useAuth();
  const { subjects, loading: sLoading } = useSubjects();
  const { toast } = useToast();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [newTopicName, setNewTopicName] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (selectedSubject) {
      supabase.from("topics").select("*").eq("subject_id", selectedSubject).order("name").then(({ data }) => {
        setTopics((data as Topic[]) ?? []);
      });
    }
  }, [selectedSubject]);

  async function handleAddTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!newTopicName.trim() || !selectedSubject) return;
    setAdding(true);
    const { data, error } = await supabase.from("topics").insert({ subject_id: selectedSubject, name: newTopicName.trim() }).select("*").single();
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setTopics(prev => [...prev, data as Topic]); setNewTopicName(""); toast({ title: "Topic added!" }); }
    setAdding(false);
  }

  async function handleDeleteTopic(id: string) {
    await supabase.from("topics").delete().eq("id", id);
    setTopics(prev => prev.filter(t => t.id !== id));
    toast({ title: "Topic deleted" });
  }

  if (profile?.role !== "admin") return <div className="p-6 text-center text-muted-foreground">Access Denied</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Subjects & Topics</h1>

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Subjects ({subjects.length})</h2>
        <p className="text-sm text-muted-foreground">All 18 MBBS subjects are pre-loaded. Select one to manage its topics.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {subjects.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSubject(s.id)}
              className={`text-left px-3 py-2 rounded-lg text-sm border transition-colors ${selectedSubject === s.id ? "bg-primary/10 border-primary text-primary" : "border-border hover:border-primary/50"}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {selectedSubject && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">Topics for {subjects.find(s => s.id === selectedSubject)?.name}</h2>
          <form onSubmit={handleAddTopic} className="flex gap-2">
            <Input
              data-testid="input-new-topic"
              value={newTopicName}
              onChange={e => setNewTopicName(e.target.value)}
              placeholder="New topic name"
              className="flex-1"
            />
            <Button data-testid="button-add-topic" type="submit" disabled={adding}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </form>
          <div className="space-y-2">
            {topics.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">No topics yet. Add one above.</div>
            ) : topics.map(topic => (
              <div key={topic.id} className="flex items-center justify-between bg-background rounded-lg px-3 py-2">
                <span className="text-sm">{topic.name}</span>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteTopic(topic.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
