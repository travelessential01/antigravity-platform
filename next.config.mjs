import { withSentryConfig } from '@sentry/nextjs';
import bundleAnalyzer from '@next/bundle-analyzer';

/**
 * next.config.mjs
 * Sprint A.3 — OpenTelemetry Stripped for V1
 * Sprint A.4 — Offline-Sync (next-pwa, yjs) Removed for V1
 *
 * CHANGES FROM PRE-SPRINT:
 *   [A.3] Removed all @opentelemetry/* and @grpc/* entries from serverExternalPackages.
 *         Removed yjs and y-indexeddb (no longer dependencies).
 *   [A.4] Removed withPWAInit import and withPWA wrapper.
 *         Removed yjs and y-indexeddb from serverExternalPackages.
 */

const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Tree-shake framer-motion ESM via Webpack 5 transpilation (Task 7.2)
    transpilePackages: ['framer-motion'],
    serverExternalPackages: [
        // PDF/CSV generation libraries — server-only, never bundle client-side
        'pdfmake',
        'pdf-lib',
        'json2csv',
        // OTP library — requires crypto internals not available in Edge
        'otplib',
        // Redis client — native Node.js networking, must not be bundled
        'ioredis',
    ]
};

export default withSentryConfig(
    withBundleAnalyzer(nextConfig),
    {
        silent: true,
        org: "antigravity",
        project: "dashboard",
        widenClientFileUpload: true,
        hideSourceMaps: true
    }
);
