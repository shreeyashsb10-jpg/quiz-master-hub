import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Zap } from "lucide-react";

export default function AuthPage() {
  const { signInWithOtp, verifyOtp } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await signInWithOtp(email);
      setStep("otp");
      toast({ title: "Code sent", description: "Check your email for the one-time code." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Failed to send code", description: msg, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp) return;
    setLoading(true);
    try {
      // After this resolves, AuthContext fires onAuthStateChange which fetches/creates
      // the profile. ProtectedRoutes will then redirect based on role + return URL.
      await verifyOtp(email, otp);
    } catch {
      toast({ title: "Invalid code", description: "Please check the code and try again.", variant: "destructive" });
      setLoading(false);
    }
    // Don't clear loading — the redirect will unmount this component
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <Zap className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Quizora</h1>
          <p className="text-muted-foreground mt-2">Competitive Quiz Platform</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
          {step === "email" ? (
            <>
              <div>
                <h2 className="text-xl font-semibold mb-1">Sign in</h2>
                <p className="text-sm text-muted-foreground">We'll send a one-time code to your email</p>
              </div>
              <form onSubmit={handleSendOtp} className="space-y-4">
                <Input
                  data-testid="input-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="h-11"
                />
                <Button data-testid="button-send-otp" type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? "Sending…" : "Send Login Code"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-semibold mb-1">Enter your code</h2>
                <p className="text-sm text-muted-foreground">
                  Code sent to <strong>{email}</strong>
                </p>
              </div>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <Input
                  data-testid="input-otp"
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                  maxLength={6}
                  autoFocus
                  className="h-11 text-center text-2xl tracking-widest"
                />
                <Button data-testid="button-verify-otp" type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? "Signing in…" : "Sign In"}
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  className="w-full"
                  onClick={() => { setStep("email"); setOtp(""); }}
                  disabled={loading}
                >
                  ← Use a different email
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
