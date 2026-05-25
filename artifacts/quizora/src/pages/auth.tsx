import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

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
      toast({ title: "OTP sent", description: "Check your email for the login code." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Failed to send OTP", description: msg, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp) return;
    setLoading(true);
    try {
      await verifyOtp(email, otp);
    } catch {
      toast({ title: "Invalid OTP", description: "Please check the code and try again.", variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <span className="text-2xl font-bold text-primary">Q</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Quizora</h1>
          <p className="text-muted-foreground mt-2">MBBS Competitive Quiz Platform</p>
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
                  className="h-11"
                />
                <Button data-testid="button-send-otp" type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? "Sending..." : "Send OTP"}
                </Button>
              </form>

             
              
            </>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-semibold mb-1">Enter OTP</h2>
                <p className="text-sm text-muted-foreground">Code sent to <strong>{email}</strong></p>
              </div>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <Input
                  data-testid="input-otp"
                  type="text"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  maxLength={6}
                  className="h-11 text-center text-2xl tracking-widest"
                />
                <Button data-testid="button-verify-otp" type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? "Verifying..." : "Verify & Sign in"}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setStep("email")}>
                  ← Back
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
