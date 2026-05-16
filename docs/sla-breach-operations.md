# SLA Breach Operations

SLA breach logging is driven by Inngest workers. Creating a complaint only sends
the `complaint/submitted` event; the row in `sla_breach_log` is written later
when the Inngest SLA function or reconciliation job calls the database
escalation RPC.

## Local Development

Local development is forced into Inngest dev-server mode. Use local placeholder
keys so a stale or wrong Cloud key cannot accidentally receive test events:

```env
INNGEST_DEV=http://localhost:8288
INNGEST_EVENT_KEY=local
INNGEST_SIGNING_KEY=local
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Run both services when testing SLA timers locally:

```bash
pnpm dev
pnpm dev:inngest
```

Without the Next.js server and Inngest dev server/tunnel, submitted complaints
can pass their `sla_deadline` without the worker being called. In local mode,
that failure should look like a connection error to `localhost:8288`, not an
Inngest Cloud `401 Event key not found`.

## Production

Inngest must be configured with the public application URL for:

```text
https://<production-domain>/api/inngest
```

Do not register `http://localhost:3000/api/inngest` for production. The app must
also have real `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` values copied from
the same Inngest Cloud project/environment. `SUPABASE_SERVICE_ROLE_KEY`,
`ACKNOWLEDGE_LINK_SECRET`, and the Supabase URL must also be configured in the
runtime environment.

## Backfill Existing Overdue Complaints

Preview overdue submitted complaints:

```bash
pnpm sla:breaches:dry-run
```

Apply the catch-up escalation:

```bash
pnpm sla:breaches:apply
```

The apply command does not read PHI. It scans `submitted` complaints whose
`sla_deadline` is in the past, calls the primary acknowledgement escalation RPC,
inserts `sla_breach_log`, creates the pending notification when a recipient is
available, and marks the complaint `escalated`.

## Safety Net

The normal per-complaint Inngest timer remains the primary path. A second
Inngest cron function runs every five minutes and reconciles overdue submitted
complaints that were missed because a worker, tunnel, or deployment was offline.
