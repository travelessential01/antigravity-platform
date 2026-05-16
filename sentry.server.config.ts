import * as Sentry from '@sentry/nextjs';
import { getServerSentryConfig } from '@/lib/sentry-config';

Sentry.init(getServerSentryConfig());
