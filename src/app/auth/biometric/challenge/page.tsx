"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/types";

const DEFAULT_NEXT_PATH = "/auth/post-login";

function BiometricChallengeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || DEFAULT_NEXT_PATH;
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const handleChallenge = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const optRes = await fetch("/api/auth/webauthn/authenticate/options");
      if (!optRes.ok) throw new Error("Failed to fetch authentication options.");
      const options = await optRes.json() as PublicKeyCredentialRequestOptionsJSON;

      const authResponse = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/webauthn/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: authResponse }),
      });

      const result = await verifyRes.json() as {
        success?: boolean;
        error?: string;
      };

      if (!verifyRes.ok || !result.success) {
        throw new Error(result.error ?? "Verification failed.");
      }

      setStatus("success");
      setTimeout(() => window.location.replace(nextPath), 900);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.includes("cancelled") || msg.includes("NotAllowedError")
          ? "Biometric prompt was dismissed. Please try again."
          : msg
      );
      setStatus("error");
    }
  }, [nextPath]);

  useEffect(() => {
    void handleChallenge();
  }, [handleChallenge]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="flex justify-center">
          <div
            className={`inline-flex h-20 w-20 items-center justify-center rounded-3xl ring-1 transition-colors duration-500
              ${status === "success"
                ? "bg-emerald-500/20 ring-emerald-500/50"
                : status === "error"
                  ? "bg-red-500/10 ring-red-500/30"
                  : "bg-emerald-500/10 ring-emerald-500/30 animate-pulse"
              }`}
          >
            <svg
              className={`h-10 w-10 transition-colors ${status === "error" ? "text-red-400" : "text-emerald-400"}`}
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

        {status === "loading" && (
          <>
            <h1 className="text-2xl font-bold text-white">Biometric verification</h1>
            <p className="text-sm text-slate-400">Follow the prompt on your device...</p>
            <div className="flex justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <h1 className="text-2xl font-bold text-white">Identity verified</h1>
            <p className="text-sm text-emerald-400">Taking you to your workspace...</p>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-2xl font-bold text-white">Verification failed</h1>
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-xs text-red-400">{error}</p>
            </div>
            <div className="space-y-3">
              <button
                id="retry-biometric-challenge-btn"
                onClick={() => void handleChallenge()}
                className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
              >
                Try Again
              </button>
              <button
                id="use-totp-fallback-btn"
                onClick={() => router.push(`/auth/mfa/challenge?next=${encodeURIComponent(nextPath)}`)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-700"
              >
                Use Authenticator App Instead
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function BiometricChallengePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
        </div>
      }
    >
      <BiometricChallengeContent />
    </Suspense>
  );
}
