"use client";

/**
 * /auth/otp/verify/page.tsx — OTP Verification Page
 * Phase 2.5 — StayAssist V1 Auth Architecture
 *
 * Staff enter their 6-digit OTP here.
 * DEVELOPMENT STAGE: Universal PIN is 000000.
 *
 * On success, the server returns a `nextAction` directive:
 *   'post_login'  → /auth/post-login (MFA paused for non-production walkthroughs)
 *   'admin_dash'  → Bootstrapped first superadmin — straight to /org-dashboard
 *   'totp'        → /auth/mfa/enroll (admin/dpo/high-risk entrypoint)
 *   'biometric'   → /auth/biometric/challenge
 *   'register'    → /auth/biometric/register (first-time enrollment)
 *   'dept_select' → /staff/select-department (float staff)
 *   'dashboard'   → /staff/dashboard
 */

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Smartphone } from "lucide-react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { StatusBanner } from "@/components/ui/status-banner";
import { createBrowserAuthClient } from "@/lib/supabase-client";

const OTP_LENGTH = 6;

const NEXT_ACTION_MAP: Record<string, string> = {
  post_login: "/auth/post-login",
  admin_dash: "/org-dashboard",
  totp: "/auth/mfa/enroll",
  biometric: "/auth/biometric/challenge",
  register: "/auth/biometric/register",
  dept_select: "/select-department",
  dashboard: "/dashboard",
};

export default function OtpVerifyPage() {
  const router = useRouter();
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState<string>("");
  const [hospitalCode, setHospitalCode] = useState<string>("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // Prevents the sessionStorage guard from firing after successful OTP submission
  // clears sessionStorage and calls router.replace() — which could re-trigger this
  // effect and redirect back to /login during the navigation transition.
  const navigatingRef = useRef(false);

  const isDev = process.env.NODE_ENV !== "production";

  useEffect(() => {
    if (navigatingRef.current) return;
    const p = sessionStorage.getItem("sa_otp_phone");
    const h = sessionStorage.getItem("sa_otp_hospital");
    if (!p || !h) {
      router.replace("/login");
      return;
    }
    setPhone(p);
    setHospitalCode(h);
    // Auto-focus first input
    inputRefs.current[0]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── OTP digit input handlers ─────────────────────────────────────────────

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    // Auto-submit when all digits filled
    if (next.every((d) => d !== "") && next.join("").length === OTP_LENGTH) {
      void submitOtp(next.join(""));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (pasted.length === OTP_LENGTH) {
      const next = pasted.split("");
      setOtp(next);
      inputRefs.current[OTP_LENGTH - 1]?.focus();
      void submitOtp(pasted);
    }
    e.preventDefault();
  }

  // ── Submission ────────────────────────────────────────────────────────────

  async function submitOtp(code: string) {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, token: code, hospitalCode }),
      });

      const json = await res.json() as {
        success?: boolean;
        error?: string;
        nextAction?: string;
        accessToken?: string;
        refreshToken?: string;
      };

      if (!res.ok || !json.success) {
        setError(json.error ?? "Incorrect OTP. Please try again.");
        setOtp(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
        setLoading(false);
        return;
      }

      // Establish the Supabase session in the browser (cookies + localStorage) so the
      // proxy middleware and requireUser() can see an authenticated session on navigation.
      // next/headers cookies() in Route Handlers don’t propagate to NextResponse returns,
      // so the server cannot set cookies for us — we must do it client-side.
      if (json.accessToken && json.refreshToken) {
        const browserSupabase = createBrowserAuthClient();
        await browserSupabase.auth.setSession({
          access_token: json.accessToken,
          refresh_token: json.refreshToken,
        });
      }

      // Mark as navigating BEFORE clearing sessionStorage so the mount-guard
      // useEffect cannot race and redirect to /login during the transition.
      navigatingRef.current = true;

      // Clean up sessionStorage
      sessionStorage.removeItem("sa_otp_phone");
      sessionStorage.removeItem("sa_otp_hospital");

      const dest = NEXT_ACTION_MAP[json.nextAction ?? "dashboard"] ?? "/dashboard";
      router.replace(dest);
    } catch {
      setError("Network error. Please check your connection.");
      setLoading(false);
    }
  }

  function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length === OTP_LENGTH) void submitOtp(code);
  }

  // ── Resend ────────────────────────────────────────────────────────────────

  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError(null);
    setResendCooldown(30);
    await fetch("/api/auth/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, hospitalCode }),
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AuthShell
      icon={<Smartphone className="size-5" />}
      title="Verify your identity"
      description={
        isDev ? (
          "Development stage: enter 000000."
        ) : (
          <>
            OTP sent to{" "}
            <span className="font-mono">
              {phone.replace(/(\+\d{2})\d+(\d{4})/, "$1****$2")}
            </span>
          </>
        )
      }
    >
        {isDev && (
          <StatusBanner variant="warning" title="Universal development OTP">
            <span className="font-mono font-semibold">000000</span>
          </StatusBanner>
        )}

        <form onSubmit={handleManualSubmit} className="space-y-6">
          <div
            className="flex justify-center gap-2 sm:gap-3"
            onPaste={handlePaste}
            aria-label="One-time password"
          >
            {Array.from({ length: OTP_LENGTH }).map((_, i) => (
              <input
                key={i}
                id={`otp-digit-${i}`}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={otp[i]}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                aria-label={`OTP digit ${i + 1}`}
                className={`h-12 w-10 rounded-md border bg-background text-center text-lg font-semibold outline-none transition sm:h-14 sm:w-12
                  ${otp[i]
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-input"
                  }
                  focus:border-ring focus:ring-2 focus:ring-ring/40`}
                disabled={loading}
              />
            ))}
          </div>

          {error && (
            <StatusBanner variant="error">{error}</StatusBanner>
          )}

          <Button
            id="verify-otp-btn"
            type="submit"
            disabled={loading || otp.join("").length < OTP_LENGTH}
            className="h-11 w-full"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Verifying…
              </>
            ) : "Verify OTP"}
          </Button>
        </form>

        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push("/login")}
          >
            <ArrowLeft className="size-3" />
            Change number
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={resendCooldown > 0}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
          </Button>
        </div>
    </AuthShell>
  );
}
