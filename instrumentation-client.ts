import * as Sentry from '@sentry/nextjs';
import { getClientSentryConfig } from '@/lib/sentry-config';

/**
 * instrumentation-client.ts — Client-Side Sentry Initialization
 * Sprint Warning Fix W-3
 *
 * Replaces sentry.client.config.ts per @sentry/nextjs@10.x recommendation.
 * sentry.client.config.ts will not work with Turbopack — this file is the
 * correct convention for both Webpack and Turbopack builds.
 */

Sentry.init(getClientSentryConfig());

// Required by @sentry/nextjs to capture client-side navigation transitions
// in the Next.js App Router (replaces the old pageload/navigation transactions)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
