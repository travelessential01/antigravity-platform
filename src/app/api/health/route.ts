/**
 * GET /api/health
 * Lightweight liveness probe for external uptime monitoring (UptimeRobot, Railway, etc.)
 * Returns HTTP 200 with service metadata. No authentication required.
 */
export async function GET() {
    return Response.json({
        status: 'ok',
        service: 'stayassist',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV ?? 'development',
    });
}
