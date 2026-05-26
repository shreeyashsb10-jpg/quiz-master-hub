import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Search, UserPlus, Trash2, ShieldCheck, Building2, ArrowLeft } from "lucide-react";
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

export default function AdminAdmins() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);

  // Search state
  const [searchEmail, setSearchEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<AdminUser | null>(null);
  const [searchDone, setSearchDone] = useState(false);

  // Promotion form
  const [promoteRole, setPromoteRole] = useState<"institute_admin" | "super_admin">("institute_admin");
  const [promoteInstitute, setPromoteInstitute] = useState("");
  const [promoteCategoryId, setPromoteCategoryId] = useState("");
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    supabase.from("categories").select("*").order("name").then(({ data }) => {
      setCategories((data as Category[]) ?? []);
    });
    loadAdmins();
  }, []);

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
      setPromoteInstitute((data as AdminUser).institute_name ?? "");
      setPromoteCategoryId((data as AdminUser).category_id ?? "");
    }
    setSearching(false);
  }

  async function handlePromote() {
    if (!foundUser) return;
    setPromoting(true);
    const { error } = await supabase.from("users").update({
      role: promoteRole,
      institute_name: promoteInstitute.trim() || null,
      category_id: promoteCategoryId || null,
      updated_at: new Date().toISOString(),
    }).eq("id", foundUser.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${foundUser.email} is now ${promoteRole === "super_admin" ? "Super Admin" : "Institute Admin"}` });
      setFoundUser(null);
      setSearchEmail("");
      setSearchDone(false);
      await loadAdmins();
    }
    setPromoting(false);
  }

  async function handleRevoke(userId: string, email: string) {
    const { error } = await supabase.from("users").update({
      role: "user",
      updated_at: new Date().toISOString(),
    }).eq("id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Admin access revoked for ${email}` });
      setAdmins(prev => prev.filter(a => a.id !== userId));
    }
  }

  if (!isSuperAdmin) {
    return <div className="p-6 text-center text-muted-foreground">Only Super Admins can manage institute admins.</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Manage Admins</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Search a user by email to grant or revoke admin access</p>
        </div>
      </div>

      {/* Search & Promote */}
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
          <p className="text-sm text-destructive">No user found with that email. They must sign in at least once first.</p>
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

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Admin Role</label>
                <Select value={promoteRole} onValueChange={v => setPromoteRole(v as typeof promoteRole)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="institute_admin">Institute Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Category</label>
                <Select value={promoteCategoryId} onValueChange={setPromoteCategoryId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Categories</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Institute / Coaching Name</label>
              <Input
                value={promoteInstitute}
                onChange={e => setPromoteInstitute(e.target.value)}
                placeholder="e.g. Allen Kota, AIIMS Delhi"
                className="h-10"
              />
            </div>

            <Button onClick={handlePromote} disabled={promoting} className="w-full">
              <ShieldCheck className="w-4 h-4 mr-2" />
              {promoting ? "Saving…" : `Grant ${promoteRole === "super_admin" ? "Super Admin" : "Institute Admin"} Access`}
            </Button>
          </div>
        )}
      </div>

      {/* Existing Admins */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Current Admins</h2>
        </div>

        {loadingAdmins ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}
          </div>
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
                      <span className="text-xs text-muted-foreground">
                        {admin.categories.icon} {admin.categories.name}
                      </span>
                    )}
                  </div>
                </div>

                {(admin.role === "institute_admin") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRevoke(admin.id, admin.email)}
                    title="Revoke admin access"
                  >
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
