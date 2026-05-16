'use client';

/**
 * IntakeForm.tsx — Patient Complaint Intake Form
 * Sprint A.4 — Offline-Sync Removal
 *
 * CHANGES FROM PRE-SPRINT:
 *   [A.4] Removed useOfflineQueueStore import and usage.
 *         Removed `isOffline` branch (QUEUED-OFFLINE path) entirely.
 *         Removed offline banner ("Offline Mode Active").
 *         Removed QUEUED-OFFLINE success screen branch.
 *         Form now submits DIRECTLY and ONLY via createComplaint Server Action.
 *   [i18n] Updated description strings — removed "offline-first" wording.
 *
 * The mock OTP (0000) is RETAINED per decision (a) — no changes to OTP logic.
 */

import React from 'react';
import { CheckCircle2, Languages, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBanner } from "@/components/ui/status-banner";
import { Textarea } from "@/components/ui/textarea";
import { QRContextBridge } from "@/components/patient/qr-bridge";
import { createComplaint } from "@/actions/complaints";
import { normalizePatientContact } from "@/lib/patient-contact";
import {
    TRIAGE_CARE_CONTEXT_OPTIONS,
    TRIAGE_CATEGORY_OPTIONS,
    type ComplaintTriageCareContext,
    type ComplaintTriageCategory,
} from "@/lib/complaint-severity";

const i18n = {
    en: {
        title: "Patient Complaint Intake",
        desc: "Submit your concern securely. Your privacy is protected under DPDP Act 2023.",
        submit: "Submit Complaint",
        consent: "I agree to the DPDP Act 2023 processing of this metadata."
    },
    hi: {
        title: "रोगी शिकायत दर्ज",
        desc: "अपनी चिंता सुरक्षित रूप से दर्ज करें। आपकी गोपनीयता DPDP अधिनियम 2023 के तहत सुरक्षित है।",
        submit: "शिकायत दर्ज करें",
        consent: "मैं इस मेटाडेटा के DPDP अधिनियम 2023 प्रसंस्करण से सहमत हूँ।"
    },
    bn: {
        title: "রোগীর অভিযোগ গ্রহণ",
        desc: "আপনার উদ্বেগ নিরাপদে জমা দিন। আপনার গোপনীয়তা DPDP আইন ২০২৩ এর অধীনে সুরক্ষিত।",
        submit: "অভিযোগ জমা দিন",
        consent: "আমি এই মেটাডেটার DPDP আইন ২০২৩ প্রক্রিয়াকরণে সম্মত।"
    }
};

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readHospitalContext(): string {
    if (typeof window === 'undefined') return '';

    const searchParams = new URLSearchParams(window.location.search);
    return (
        searchParams.get('hospital_id')?.trim()
        || searchParams.get('hospitalId')?.trim()
        || ''
    );
}

export function IntakeForm() {
    const [lang, setLang] = React.useState<'en' | 'hi' | 'bn'>('en');
    const [description, setDescription] = React.useState('');
    const [hasConsent, setHasConsent] = React.useState(false);
    const [isVerified, setIsVerified] = React.useState(false);
    const [mobile, setMobile] = React.useState('');
    const [otpSent, setOtpSent] = React.useState(false);
    const [otpCode, setOtpCode] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [submittedId, setSubmittedId] = React.useState<string | null>(null);
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const [authError, setAuthError] = React.useState<string | null>(null);
    const [triageCategory, setTriageCategory] =
        React.useState<ComplaintTriageCategory>('other');
    const [triageCareContext, setTriageCareContext] =
        React.useState<ComplaintTriageCareContext>('none');
    const [triageIsOngoing, setTriageIsOngoing] = React.useState(false);

    const text = i18n[lang];

    // Accept both hospital_id and hospitalId to stay compatible with older links.
    const hospitalId = readHospitalContext();
    const hasHospitalContext = UUID_LIKE.test(hospitalId);
    const hospitalContextError = hasHospitalContext
        ? null
        : "This intake link is missing a valid hospital context. Please rescan the hospital QR code.";
    const normalizedMobile = normalizePatientContact(mobile);

    const handleRequestOTP = (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError(null);
        if (!hasHospitalContext) {
            setAuthError("Invalid intake link. Please scan the hospital QR code again.");
            return;
        }
        if (!normalizedMobile) {
            setAuthError("Enter a valid mobile number.");
            return;
        }
        setOtpSent(true);
    };

    // [A.4 / Decision (a)] Mock OTP retained — replace with real OTP provider before production launch.
    const handleVerifyOTP = (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError(null);
        if (otpCode === '0000') {
            setIsVerified(true);
        } else {
            setAuthError("Invalid mock OTP. Use 0000.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hasHospitalContext) {
            setSubmitError("Invalid intake link. Please scan the hospital QR code again.");
            return;
        }
        if (!normalizedMobile) {
            setSubmitError("Enter a valid mobile number.");
            return;
        }
        if (!hasConsent) {
            setSubmitError("Consent is required under DPDP 2023.");
            return;
        }

        setIsSubmitting(true);
        setSubmitError(null);

        // [A.4] Online-only path — offline queue removed entirely.
        // All submissions write directly to Supabase via Server Action.
        try {
            const result = await createComplaint({
                hospitalId,
                description,
                reporterContact: mobile.trim(),
                triage: {
                    category: triageCategory,
                    careContext: triageCareContext,
                    isOngoing: triageIsOngoing,
                },
                consentConfirmed: hasConsent,
            });

            if (result.success) {
                setSubmittedId(result.id ?? 'SUBMITTED');
                setDescription('');
                setTriageCategory('other');
                setTriageCareContext('none');
                setTriageIsOngoing(false);
            } else {
                setSubmitError(result.error ?? 'Submission failed. Please try again.');
            }
        } catch (err: unknown) {
            setSubmitError(err instanceof Error ? err.message : 'Network error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Success screen
    if (submittedId) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
                <section className="flex w-full max-w-md flex-col items-center gap-5 rounded-lg border bg-card p-6 text-center text-card-foreground shadow-sm">
                    <div className="flex size-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                        <CheckCircle2 className="size-6" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight">Complaint Registered</h1>
                        <p className="text-sm text-muted-foreground">
                            Your complaint has been registered. Please save your reference ID.
                        </p>
                    </div>
                    <code className="max-w-full break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">
                        {submittedId}
                    </code>
                    <Button variant="outline" onClick={() => { setSubmittedId(null); setHasConsent(false); }}>
                        Submit Another
                    </Button>
                </section>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-background px-4 py-6 text-foreground">
            {/* [A.4] Offline banner removed */}

            <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
                <div className="flex justify-end">
                    <div className="inline-flex items-center rounded-lg border bg-card p-1 text-sm shadow-sm">
                        <Languages className="mx-2 size-4 text-muted-foreground" />
                        {(['en', 'hi', 'bn'] as const).map((option) => (
                            <button
                                key={option}
                                type="button"
                                aria-pressed={lang === option}
                                className={`rounded-md px-3 py-1 font-medium transition ${
                                    lang === option
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                                onClick={() => setLang(option)}
                            >
                                {option.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <header className="space-y-2">
                    <Badge variant="outline">
                        <ShieldCheck className="size-3" />
                        Secure intake
                    </Badge>
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight">{text.title}</h1>
                        <p className="text-sm text-muted-foreground">{text.desc}</p>
                    </div>
                </header>

                <QRContextBridge />

                {hospitalContextError && (
                    <StatusBanner variant="error">{hospitalContextError}</StatusBanner>
                )}

                {!isVerified ? (
                    <section className="space-y-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
                        <div className="space-y-1">
                            <h2 className="text-sm font-semibold">Patient identity check</h2>
                            <p className="text-sm text-muted-foreground">
                                Confirm a mobile number before submitting a concern.
                            </p>
                        </div>

                        <StatusBanner variant="warning" title="Local development OTP">
                            Use <span className="font-mono font-semibold">0000</span> while the mock OTP flow is enabled.
                        </StatusBanner>

                        {!otpSent ? (
                            <form onSubmit={handleRequestOTP} className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="patient-mobile" className="text-sm font-medium">
                                        Mobile Number
                                    </label>
                                    <Input
                                        id="patient-mobile"
                                        type="tel"
                                        placeholder="Mobile Number"
                                        value={mobile}
                                        onChange={e => setMobile(e.target.value)}
                                        className="h-11"
                                    />
                                </div>
                                {authError && <StatusBanner variant="error">{authError}</StatusBanner>}
                                <Button type="submit" className="h-11 w-full" disabled={!hasHospitalContext}>
                                    Request OTP
                                </Button>
                            </form>
                        ) : (
                            <form onSubmit={handleVerifyOTP} className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="patient-otp" className="text-sm font-medium">
                                        Verification code
                                    </label>
                                    <Input
                                        id="patient-otp"
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="Enter Mock OTP (0000)"
                                        value={otpCode}
                                        onChange={e => setOtpCode(e.target.value)}
                                        className="h-11 text-center font-mono text-lg"
                                    />
                                </div>
                                {authError && <StatusBanner variant="error">{authError}</StatusBanner>}
                                <Button type="submit" className="h-11 w-full" disabled={!hasHospitalContext}>
                                    Verify Patient Identity
                                </Button>
                            </form>
                        )}
                    </section>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
                        <div className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm">
                            <div className="space-y-2">
                                <label htmlFor="triage-category" className="text-sm font-medium">
                                    Concern Type
                                </label>
                                <select
                                    id="triage-category"
                                    value={triageCategory}
                                    onChange={(event) =>
                                        setTriageCategory(event.target.value as ComplaintTriageCategory)
                                    }
                                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                >
                                    {TRIAGE_CATEGORY_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="triage-context" className="text-sm font-medium">
                                    Care Area
                                </label>
                                <select
                                    id="triage-context"
                                    value={triageCareContext}
                                    onChange={(event) =>
                                        setTriageCareContext(event.target.value as ComplaintTriageCareContext)
                                    }
                                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                >
                                    {TRIAGE_CARE_CONTEXT_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <label className="flex items-center gap-3 rounded-md border border-border px-3 py-3 text-sm font-medium">
                                <input
                                    type="checkbox"
                                    className="size-4 accent-primary"
                                    checked={triageIsOngoing}
                                    onChange={(event) => setTriageIsOngoing(event.target.checked)}
                                />
                                This concern is still happening
                            </label>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="incident-description" className="text-sm font-medium">
                                Incident Description
                            </label>
                            <Textarea
                                id="incident-description"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="min-h-32 text-base"
                                placeholder="Describe what occurred..."
                                required
                            />
                        </div>
                        <div className="flex items-start gap-3 rounded-lg border bg-card p-4 text-card-foreground">
                            <input
                                type="checkbox"
                                id="consent"
                                className="mt-1 size-5 shrink-0 accent-primary"
                                checked={hasConsent}
                                onChange={(e) => setHasConsent(e.target.checked)}
                            />
                            <label htmlFor="consent" className="text-[13px] leading-tight text-muted-foreground">
                                {text.consent}
                            </label>
                        </div>
                        {submitError && (
                            <StatusBanner variant="error">{submitError}</StatusBanner>
                        )}
                        <Button
                            disabled={!hasConsent || description.length < 5 || isSubmitting}
                            className="mt-2 h-12 w-full"
                            type="submit"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                text.submit
                            )}
                        </Button>
                    </form>
                )}
            </div>
        </main>
    );
}
