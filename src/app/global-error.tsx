"use client";

/**
 * global-error.tsx — Root Error Boundary with Sentry Capture
 * Sprint Warning Fix W-2
 *
 * Required by @sentry/nextjs to capture React rendering errors from the
 * App Router root layout. Without this file, errors thrown during RSC
 * rendering are silently swallowed and not forwarded to Sentry.
 *
 * This file MUST be a Client Component ("use client") — React error boundaries
 * only work in client components. It must also include its own <html> and
 * <body> tags since it replaces the root layout.tsx on crash.
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    fontFamily: "'Inter', system-ui, sans-serif",
                    background: "#0f172a",
                    color: "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "100vh",
                }}
            >
                <div
                    style={{
                        textAlign: "center",
                        padding: "2rem",
                        maxWidth: "480px",
                    }}
                >
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
                    <h1
                        style={{
                            fontSize: "1.5rem",
                            fontWeight: 700,
                            color: "#f87171",
                            marginBottom: "0.75rem",
                        }}
                    >
                        Something went wrong
                    </h1>
                    <p
                        style={{
                            fontSize: "0.875rem",
                            color: "#94a3b8",
                            marginBottom: "1.5rem",
                            lineHeight: 1.6,
                        }}
                    >
                        A critical error occurred. The incident has been automatically
                        reported to our engineering team.
                    </p>
                    {error?.digest && (
                        <p
                            style={{
                                fontSize: "0.75rem",
                                color: "#475569",
                                fontFamily: "monospace",
                                marginBottom: "1.5rem",
                                padding: "0.5rem",
                                background: "#1e293b",
                                borderRadius: "0.5rem",
                            }}
                        >
                            Error ID: {error.digest}
                        </p>
                    )}
                    <button
                        onClick={reset}
                        style={{
                            padding: "0.625rem 1.5rem",
                            background: "#4f46e5",
                            color: "#fff",
                            border: "none",
                            borderRadius: "0.5rem",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}
