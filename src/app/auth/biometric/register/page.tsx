"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/types";

const DEFAULT_NEXT_PATH = "/auth/post-login";

function BiometricRegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || DEFAULT_NEXT_PATH;
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [platformSupported, setPlatformSupported] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkSupport() {
      try {
        const available =
          await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setPlatformSupported(available);
        if (available) void handleRegister();
      } catch {
        setPlatformSupported(false);
      }
    }

    void checkSupport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRegister() {
    setStatus("loading");
    setError(null);

    try {
      const optRes = await fetch("/api/auth/webauthn/register/options");
      if (!optRes.ok) throw new Error("Failed to fetch registration options.");
      const options = await optRes.json() as PublicKeyCredentialCreationOptionsJSON;

      const regResponse = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: regResponse,
          deviceName: navigator.userAgent.split("/")[0] ?? "Device",
        }),
      });

      const result = await verifyRes.json() as { success?: boolean; error?: string };
      if (!verifyRes.ok || !result.success) throw new Error(result.error ?? "Enrollment failed.");

      setStatus("success");
      setTimeout(() => window.location.replace(nextPath), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("cancelled") || msg.includes("NotAllowedError")) {
        setError("Biometric prompt was dismissed. Please try again or use TOTP instead.");
      } else {
        setError(msg);
      }
      setStatus("error");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="flex justify-center">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <svg
              className="h-10 w-10 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33"
              />
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Set up biometrics</h1>
          <p className="text-sm text-slate-400">
            Use Face ID, fingerprint, or Windows Hello to verify your identity on this device.
            Your biometric data never leaves your device.
          </p>
        </div>

        {status === "loading" && (
          <div className="space-y-3">
            <div className="flex justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
            </div>
            <p className="text-sm text-slate-400">Follow your device biometric prompt...</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-sm font-semibold text-emerald-400">Biometrics enrolled.</p>
            <p className="text-xs text-emerald-400/70">Redirecting to your workspace...</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-xs text-red-400">{error}</p>
            </div>
            <button
              id="retry-biometric-btn"
              onClick={() => void handleRegister()}
              className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
            >
              Try Again
            </button>
          </div>
        )}

        {status === "idle" && platformSupported === false && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-xs text-amber-400">
                Biometric authentication is not available on this device or browser.
                Please use a TOTP authenticator app instead.
              </p>
            </div>
            <button
              id="use-totp-instead-btn"
              onClick={() => router.push(`/auth/mfa/enroll?next=${encodeURIComponent(nextPath)}`)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-700"
            >
              Use Authenticator App Instead
            </button>
          </div>
        )}

        {(status === "idle" || status === "error") && platformSupported && (
          <button
            id="skip-biometric-btn"
            onClick={() => router.push(`/auth/mfa/enroll?next=${encodeURIComponent(nextPath)}`)}
            className="text-xs text-slate-600 underline underline-offset-2 transition hover:text-slate-400"
          >
            Skip for now and use an authenticator app
          </button>
        )}
      </div>
    </div>
  );
}

export default function BiometricRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
        </div>
      }
    >
      <BiometricRegisterContent />
    </Suspense>
  );
}
