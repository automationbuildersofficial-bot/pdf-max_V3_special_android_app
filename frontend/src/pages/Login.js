import React, { useState } from "react";
import axios from "axios";
import { useGoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileText, PenTool, Layers, Moon, ShieldCheck, UserRound } from "lucide-react";

const BG_IMAGE =
  "https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzZ8MHwxfHNlYXJjaHwyfHxhYnN0cmFjdCUyMG1pbmltYWwlMjBnZW9tZXRyaWMlMjBsaWdodHxlbnwwfHx8fDE3ODc1MzA5NDR8MA&ixlib=rb-4.1.0&q=85";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

// Only mounts the Google hook when a client id exists (the hook throws otherwise)
function GoogleButton({ busy, setBusy }) {
  const { login, API } = useAuth();
  const navigate = useNavigate();
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const googleLogin = useGoogleLogin({
    flow: "auth-code",
    onSuccess: async (resp) => {
      try {
        setBusy(true);
        const { data } = await axios.post(`${API}/auth/google`, { code: resp.code });
        login(data.user, data.token);
        toast.success(`Welcome, ${data.user.name.split(" ")[0]}!`);
        navigate("/app");
      } catch (e) {
        toast.error(
          e?.response?.data?.detail || "Google sign-in failed. Check server config."
        );
      } finally {
        setBusy(false);
      }
    },
    onError: () => toast.error("Google sign-in was cancelled."),
  });

  return (
    <Button
      data-testid="google-login-btn"
      onClick={() => googleLogin()}
      disabled={busy}
      className="w-full h-12 rounded-lg text-base gap-3 bg-white text-slate-800 border border-border hover:bg-slate-50 dark:bg-card dark:text-foreground dark:hover:bg-secondary shadow-sm"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.9 1.5l2.6-2.6C16.9 3.2 14.7 2.2 12 2.2 6.9 2.2 2.8 6.3 2.8 11.4S6.9 20.6 12 20.6c5.3 0 8.8-3.7 8.8-9 0-.6-.06-1-.15-1.4H12z" />
      </svg>
      {busy ? "Signing in..." : "Continue with Google"}
    </Button>
  );
}

export default function Login() {
  const [busy, setBusy] = useState(false);
  const configured = !!GOOGLE_CLIENT_ID;
  const { loginGuest } = useAuth();
  const navigate = useNavigate();

  const handleGuest = () => {
    loginGuest();
    toast.success("Continuing as guest");
    navigate("/app");
  };

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground">
      {/* Left brand / info panel */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-slate-950">
        <img
          src={BG_IMAGE}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/90 via-slate-950/40 to-transparent" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="text-xl font-bold tracking-tight">PDF Studio</span>
          </div>
          <div className="space-y-6 max-w-md">
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
              Read, annotate &amp; reshape your PDFs — right in the browser.
            </h1>
            <ul className="space-y-3 text-white/80">
              <li className="flex items-center gap-3">
                <PenTool className="h-4 w-4 text-primary" aria-hidden="true" />
                Pens, pencils, highlighters, shapes &amp; comments
              </li>
              <li className="flex items-center gap-3">
                <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
                Reorder, rotate, insert, extract, merge &amp; split pages
              </li>
              <li className="flex items-center gap-3">
                <Moon className="h-4 w-4 text-primary" aria-hidden="true" />
                Beautiful light &amp; night mode
              </li>
            </ul>
          </div>
          <p className="text-xs text-white/50">
            Your documents stay in your browser while you edit.
          </p>
        </div>
      </div>

      {/* Right auth panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <span className="text-xl font-bold tracking-tight">PDF Studio</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            Sign in to continue
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            Accounts are created with Google only. It takes one tap.
          </p>

          {configured ? (
            <GoogleButton busy={busy} setBusy={setBusy} />
          ) : (
            <div className="space-y-3">
              <Button
                data-testid="google-login-btn"
                disabled
                className="w-full h-12 rounded-lg text-base gap-3 bg-white text-slate-800 border border-border shadow-sm opacity-70"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.9 1.5l2.6-2.6C16.9 3.2 14.7 2.2 12 2.2 6.9 2.2 2.8 6.3 2.8 11.4S6.9 20.6 12 20.6c5.3 0 8.8-3.7 8.8-9 0-.6-.06-1-.15-1.4H12z" />
                </svg>
                Continue with Google
              </Button>
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                Google sign-in isn't configured yet. Add your OAuth Client ID to
                enable it.
              </p>
            </div>
          )}

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            data-testid="guest-login-btn"
            variant="outline"
            onClick={handleGuest}
            className="w-full h-12 rounded-lg text-base gap-2"
          >
            <UserRound className="h-5 w-5" aria-hidden="true" />
            Continue as guest
          </Button>
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Guest mode keeps everything on this device — no account needed.
          </p>

          <div className="mt-8 flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              We only request your name, email and profile photo. No documents
              are accessed without your permission.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
