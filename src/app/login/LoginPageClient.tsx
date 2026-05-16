"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBanner } from "@/components/ui/status-banner";

export default function LoginPageClient() {
  const router = useRouter();
  const [hospitalCode, setHospitalCode] = useState("");
  const [phone, setPhone] = useState("+91");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const code = hospitalCode.trim().toUpperCase();
    const phoneVal = phone.trim();

    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setError("Hospital code must be exactly 6 alphanumeric characters.");
      setLoading(false);
      return;
    }

    if (!/^\+[1-9]\d{7,14}$/.test(phoneVal)) {
      setError("Enter a valid phone number in international format (e.g. +919876543210).");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneVal, hospitalCode: code }),
      });

      const json = await res.json() as { success?: boolean; error?: string };

      if (!res.ok || !json.success) {
        setError(json.error ?? "Failed to send OTP. Please try again.");
        setLoading(false);
        return;
      }

      sessionStorage.setItem("sa_otp_phone", phoneVal);
      sessionStorage.setItem("sa_otp_hospital", code);
      router.push("/auth/otp/verify");
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <AuthShell
      icon={<KeyRound className="size-5" />}
      title="StayAssist"
      description="Staff portal sign-in with hospital code and mobile OTP."
      footer="Having trouble? Contact your hospital administrator."
    >
      {isDev && (
        <StatusBanner variant="warning" title="Development OTP">
          Use a provisioned staff phone number. Enter{" "}
          <span className="font-mono font-semibold">000000</span> to verify.
        </StatusBanner>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="hospital-code" className="block text-sm font-medium">
            Hospital Code
          </label>
          <Input
            id="hospital-code"
            type="text"
            inputMode="text"
            autoComplete="organization"
            maxLength={6}
            placeholder="e.g. NHDELH"
            value={hospitalCode}
            onChange={(e) => setHospitalCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            className="h-11 font-mono"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="phone-number" className="block text-sm font-medium">
            Mobile Number
          </label>
          <Input
            id="phone-number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+919876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-11 font-mono"
            required
          />
          <p className="text-xs text-muted-foreground">
            Include country code, for example +91 for India.
          </p>
        </div>

        {error && (
          <StatusBanner variant="error">{error}</StatusBanner>
        )}

        <Button
          id="send-otp-btn"
          type="submit"
          disabled={loading}
          className="h-11 w-full"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Sending OTP...
            </>
          ) : (
            "Send OTP"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
