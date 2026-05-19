import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const { signInWithGoogle, signInWithOtp, verifyOtp } = useAuth();
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

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Button
                data-testid="button-google"
                variant="outline"
                className="w-full h-11"
                onClick={signInWithGoogle}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>
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
