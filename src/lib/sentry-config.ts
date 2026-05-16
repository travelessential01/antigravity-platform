function resolveSampleRate(rawValue: string | undefined, fallback: number): number {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

export function getServerSentryConfig() {
  return {
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: resolveSampleRate(
      process.env.SENTRY_TRACES_SAMPLE_RATE,
      process.env.NODE_ENV === "production" ? 0.1 : 1
    ),
    debug: false,
  };
}

export function getClientSentryConfig() {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: resolveSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? process.env.SENTRY_TRACES_SAMPLE_RATE,
      process.env.NODE_ENV === "production" ? 0.1 : 1
    ),
    debug: false,
  };
}
