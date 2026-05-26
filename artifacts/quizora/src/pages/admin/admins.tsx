import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Search, UserPlus, Trash2, ShieldCheck, Building2, ArrowLeft, Plus, Copy, RefreshCw, Link2 } from "lucide-react";
import { Link } from "wouter";

interface Category { id: string; name: string; slug: string; icon: string | null; }
interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  institute_name: string | null;
  category_id: string | null;
  categories?: { name: string; icon: string | null } | null;
}
interface Institute {
  id: string;
  name: string;
  join_code: string | null;
  category_id: string | null;
  categories?: { name: string; icon: string | null } | null;
}

function randomCode(prefix: string): string {
  const clean = prefix.replace(/\W/g, "").toUpperCase().slice(0, 4).padEnd(2, "X");
  const num = Math.floor(100 + Math.random() * 900);
  return (clean + num).slice(0, 8);
}

export default function AdminAdmins() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);

  // ── Admins ──────────────────────────────────────────────
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<AdminUser | null>(null);
  const [searchDone, setSearchDone] = useState(false);
  const [promoteRole, setPromoteRole] = useState<"institute_admin" | "super_admin">("institute_admin");
  const [promoteInstituteId, setPromoteInstituteId] = useState("");
  const [promoteCategoryId, setPromoteCategoryId] = useState("");
  const [promoting, setPromoting] = useState(false);

  // ── Institutes ───────────────────────────────────────────
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loadingInstitutes, setLoadingInstitutes] = useState(true);
  const [instName, setInstName] = useState("");
  const [instCategoryId, setInstCategoryId] = useState("");
  const [instCode, setInstCode] = useState("");
  const [addingInst, setAddingInst] = useState(false);
  const [showInstForm, setShowInstForm] = useState(false);

  useEffect(() => {
    supabase.from("categories").select("*").order("name").then(({ data }) => {
      setCategories((data as Category[]) ?? []);
    });
    loadAdmins();
    loadInstitutes();
  }, []);

  // ── Admin helpers ────────────────────────────────────────
  async function loadAdmins() {
    setLoadingAdmins(true);
    const { data } = await supabase
      .from("users")
      .select("id, email, full_name, avatar_url, role, institute_name, category_id, categories(name, icon)")
      .in("role", ["institute_admin", "super_admin", "admin"])
      .order("role");
    setAdmins((data as unknown as AdminUser[]) ?? []);
    setLoadingAdmins(false);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    setSearching(true);
    setFoundUser(null);
    setSearchDone(false);
    const { data } = await supabase
      .from("users")
      .select("id, email, full_name, avatar_url, role, institute_name, category_id")
      .ilike("email", searchEmail.trim())
      .single();
    setFoundUser(data as AdminUser ?? null);
    setSearchDone(true);
    if (data) {
      setPromoteCategoryId((data as AdminUser).category_id ?? "");
    }
    setSearching(false);
  }

  async function handlePromote() {
    if (!foundUser) return;
    setPromoting(true);
    const selectedInst = institutes.find(i => i.id === promoteInstituteId) ?? null;
    const { error } = await supabase.from("users").update({
      role: promoteRole,
      institute_id: selectedInst?.id ?? null,
      institute_name: selectedInst?.name ?? null,
      category_id: promoteCategoryId || selectedInst?.category_id || null,
      updated_at: new Date().toISOString(),
    }).eq("id", foundUser.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${foundUser.email} is now ${promoteRole === "super_admin" ? "Super Admin" : "Institute Admin"}` });
      setFoundUser(null); setSearchEmail(""); setSearchDone(false); setPromoteInstituteId("");
      await loadAdmins();
    }
    setPromoting(false);
  }

  async function handleRevoke(userId: string, email: string) {
    const { error } = await supabase.from("users").update({ role: "user", updated_at: new Date().toISOString() }).eq("id", userId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else { toast({ title: `Admin access revoked for ${email}` }); setAdmins(prev => prev.filter(a => a.id !== userId)); }
  }

  // ── Institute helpers ─────────────────────────────────────
  async function loadInstitutes() {
    setLoadingInstitutes(true);
    const { data } = await supabase
      .from("institutes")
      .select("id, name, join_code, category_id, categories(name, icon)")
      .order("name");
    setInstitutes((data as unknown as Institute[]) ?? []);
    setLoadingInstitutes(false);
  }

  function handleInstNameChange(val: string) {
    setInstName(val);
    if (!instCode) setInstCode(randomCode(val));
  }

  async function handleAddInstitute(e: React.FormEvent) {
    e.preventDefault();
    if (!instName.trim()) return;
    setAddingInst(true);
    const code = instCode.trim().toUpperCase() || randomCode(instName);
    const { error } = await supabase.from("institutes").insert({
      name: instName.trim(),
      category_id: instCategoryId || null,
      join_code: code,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Institute "${instName.trim()}" created`, description: `Join code: ${code}` });
      setInstName(""); setInstCategoryId(""); setInstCode(""); setShowInstForm(false);
      await loadInstitutes();
    }
    setAddingInst(false);
  }

  async function handleDeleteInstitute(id: string, name: string) {
    const { error } = await supabase.from("institutes").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else { toast({ title: `"${name}" deleted` }); setInstitutes(prev => prev.filter(i => i.id !== id)); }
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}?code=${code}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied!", description: url });
  }

  if (!isSuperAdmin) {
    return <div className="p-6 text-center text-muted-foreground">Only Super Admins can manage admins and institutes.</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Admins & Institutes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage institute codes and admin access</p>
        </div>
      </div>

      {/* ── INSTITUTES ── */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Institutes & Join Codes</h2>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowInstForm(v => !v)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New Institute
          </Button>
        </div>

        {showInstForm && (
          <form onSubmit={handleAddInstitute} className="border border-border rounded-xl p-4 space-y-4 bg-background">
            <p className="text-sm font-medium">Create Institute</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Institute Name *</label>
                <Input
                  value={instName}
                  onChange={e => handleInstNameChange(e.target.value)}
                  placeholder="e.g. Allen Kota"
                  className="h-10"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Category</label>
                <Select value={instCategoryId || "_all"} onValueChange={v => setInstCategoryId(v === "_all" ? "" : v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All categories</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Join Code (auto-generated, editable)</label>
              <div className="flex gap-2">
                <Input
                  value={instCode}
                  onChange={e => setInstCode(e.target.value.toUpperCase().replace(/\W/g, "").slice(0, 10))}
                  placeholder="e.g. ALLEN01"
                  className="h-10 font-mono tracking-widest uppercase flex-1"
                />
                <Button type="button" variant="outline" className="h-10 px-3" onClick={() => setInstCode(randomCode(instName || "INST"))}>
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Students enter this code or use the shareable link to join your institute.</p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={addingInst} className="flex-1">
                {addingInst ? "Creating…" : "Create Institute"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowInstForm(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {loadingInstitutes ? (
          <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}</div>
        ) : institutes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No institutes yet. Create one above.</p>
        ) : (
          <div className="space-y-2">
            {institutes.map(inst => (
              <div key={inst.id} className="flex items-center gap-3 bg-background border border-border rounded-xl px-4 py-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{inst.name}</div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {inst.join_code && (
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded tracking-widest text-foreground">
                        {inst.join_code}
                      </span>
                    )}
                    {inst.categories && (
                      <span className="text-xs text-muted-foreground">{inst.categories.icon} {inst.categories.name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {inst.join_code && (
                    <>
                      <Button
                        variant="ghost" size="sm"
                        className="h-8 px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => copyLink(inst.join_code!)}
                        title="Copy shareable link"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="h-8 px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => { navigator.clipboard.writeText(inst.join_code!); toast({ title: "Code copied!" }); }}
                        title="Copy code only"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost" size="sm"
                    className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteInstitute(inst.id, inst.name)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ADMINS ── */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Add New Admin</h2>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={searchEmail}
            onChange={e => { setSearchEmail(e.target.value); setSearchDone(false); setFoundUser(null); }}
            placeholder="Search user by email…"
            type="email"
            className="flex-1 h-10"
          />
          <Button type="submit" disabled={searching} className="h-10 px-4">
            <Search className="w-4 h-4 mr-1.5" />
            {searching ? "Searching…" : "Search"}
          </Button>
        </form>

        {searchDone && !foundUser && (
          <p className="text-sm text-destructive">No user found. They must sign in at least once first.</p>
        )}

        {foundUser && (
          <div className="border border-border rounded-xl p-4 space-y-4 bg-background">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback>{foundUser.full_name?.charAt(0) ?? foundUser.email.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{foundUser.full_name ?? "—"}</div>
                <div className="text-sm text-muted-foreground">{foundUser.email}</div>
                <div className="text-xs text-primary mt-0.5 capitalize">{foundUser.role}</div>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Admin Role</label>
              <Select value={promoteRole} onValueChange={v => setPromoteRole(v as typeof promoteRole)}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="institute_admin">Institute Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Institute / Coaching</label>
              <Select
                value={promoteInstituteId || "_none"}
                onValueChange={v => {
                  const id = v === "_none" ? "" : v;
                  setPromoteInstituteId(id);
                  const inst = institutes.find(i => i.id === id);
                  if (inst?.category_id) setPromoteCategoryId(inst.category_id);
                }}
              >
                <SelectTrigger className="h-10"><SelectValue placeholder="Select institute (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No institute / Super Admin</SelectItem>
                  {institutes.map(inst => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.name}{inst.join_code ? ` — ${inst.join_code}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {institutes.length === 0 && (
                <p className="text-xs text-muted-foreground">No institutes yet — create one in the Institutes section above first.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Category <span className="text-muted-foreground font-normal">(auto-filled from institute)</span></label>
              <Select value={promoteCategoryId || "_all"} onValueChange={v => setPromoteCategoryId(v === "_all" ? "" : v)}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Categories</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handlePromote} disabled={promoting} className="w-full">
              <ShieldCheck className="w-4 h-4 mr-2" />
              {promoting ? "Saving…" : `Grant ${promoteRole === "super_admin" ? "Super Admin" : "Institute Admin"} Access`}
            </Button>
          </div>
        )}
      </div>

      {/* ── CURRENT ADMINS ── */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Current Admins</h2>
        </div>
        {loadingAdmins ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}</div>
        ) : admins.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No admins yet.</p>
        ) : (
          <div className="space-y-2">
            {admins.map(admin => (
              <div key={admin.id} className="flex items-center gap-3 bg-background border border-border rounded-xl px-4 py-3">
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarImage src={admin.avatar_url ?? undefined} />
                  <AvatarFallback className="text-sm">{admin.full_name?.charAt(0) ?? admin.email.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{admin.full_name ?? admin.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{admin.email}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${admin.role === "super_admin" || admin.role === "admin" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-400"}`}>
                      {admin.role === "super_admin" || admin.role === "admin" ? "Super Admin" : "Institute Admin"}
                    </span>
                    {admin.institute_name && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {admin.institute_name}
                      </span>
                    )}
                    {admin.categories && (
                      <span className="text-xs text-muted-foreground">{admin.categories.icon} {admin.categories.name}</span>
                    )}
                  </div>
                </div>
                {admin.role === "institute_admin" && (
                  <Button variant="ghost" size="sm" className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleRevoke(admin.id, admin.email)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
