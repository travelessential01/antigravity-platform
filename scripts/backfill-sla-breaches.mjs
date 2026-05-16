import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

function parseArgs(argv) {
  const args = new Map()
  for (const arg of argv) {
    if (arg === '--apply') args.set('apply', true)
    if (arg === '--dry-run') args.set('dryRun', true)
    if (arg === '--json') args.set('json', true)
    if (arg.startsWith('--limit=')) args.set('limit', Number(arg.slice('--limit='.length)))
  }

  return {
    apply: args.get('apply') === true,
    json: args.get('json') === true,
    limit: Number.isFinite(args.get('limit')) ? args.get('limit') : 100,
  }
}

async function loadDotEnv() {
  const envPath = path.join(repoRoot, '.env')
  const text = await readFile(envPath, 'utf8')

  for (const line of text.split(/\r?\n/)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*=/.test(line)) continue
    const index = line.indexOf('=')
    const key = line.slice(0, index)
    let value = line.slice(index + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] ??= value
  }
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function calculateAcknowledgementSlaMinutes(complaint) {
  const createdAtMs = Date.parse(complaint.created_at)
  const deadlineMs = Date.parse(complaint.sla_deadline)
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(deadlineMs)) {
    return 0
  }

  return Math.max(0, Math.round((deadlineMs - createdAtMs) / 60_000))
}

async function loadOverdueComplaints(supabase, limit) {
  const { data, error } = await supabase
    .from('complaints')
    .select('id, created_at, sla_deadline')
    .eq('status', 'submitted')
    .not('sla_deadline', 'is', null)
    .lte('sla_deadline', new Date().toISOString())
    .order('sla_deadline', { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`Overdue complaint scan failed: ${error.message}`)
  }

  return data ?? []
}

function unwrapRpcResult(data) {
  return Array.isArray(data) ? data[0] ?? null : data ?? null
}

async function escalateComplaint({ supabase, complaint, createAcknowledgeToken }) {
  const secureLinkId = randomUUID()
  const token = createAcknowledgeToken({
    complaintId: complaint.id,
    linkId: secureLinkId,
  })
  const deepLink =
    `/dashboard/escalations?context=${complaint.id}` +
    `&token=${encodeURIComponent(token)}`
  const clinicalSlaMinutes = calculateAcknowledgementSlaMinutes(complaint)

  const { data, error } = await supabase.rpc('escalate_primary_acknowledgement_breach', {
    p_complaint_id: complaint.id,
    p_clinical_sla_minutes: clinicalSlaMinutes,
    p_secure_link_id: secureLinkId,
    p_deep_link: deepLink,
  })

  if (error) {
    return {
      complaintId: complaint.id,
      clinicalSlaMinutes,
      outcome: 'error',
      recipientId: null,
      error: error.message,
    }
  }

  const result = unwrapRpcResult(data)
  return {
    complaintId: complaint.id,
    clinicalSlaMinutes,
    outcome: result?.outcome ?? 'error',
    recipientId: result?.recipient_id ?? null,
    error: result ? undefined : 'Primary escalation RPC returned no row.',
  }
}

function printHumanSummary({ apply, complaints, results }) {
  if (!apply) {
    console.log(`Dry run: ${complaints.length} overdue submitted complaint(s) would be escalated.`)
    for (const complaint of complaints) {
      console.log(` - ${complaint.id} deadline=${complaint.sla_deadline}`)
    }
    return
  }

  console.log(`Apply complete: processed ${results.length} overdue submitted complaint(s).`)
  for (const result of results) {
    const suffix = result.error ? ` error=${result.error}` : ''
    console.log(
      ` - ${result.complaintId} outcome=${result.outcome} recipient=${result.recipientId ?? 'none'}${suffix}`
    )
  }
}

async function refreshMaterializedViewsIfNeeded(supabase, results) {
  const shouldRefresh = results.some(
    (result) => result.outcome === 'escalated' || result.outcome === 'escalated_unassigned'
  )

  if (!shouldRefresh) return null

  const { error } = await supabase.rpc('refresh_materialized_views')
  return error?.message ?? null
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  await loadDotEnv()

  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )

  const { createAcknowledgeToken } = await import('../src/lib/acknowledgement-links.ts')
  const complaints = await loadOverdueComplaints(supabase, args.limit)

  if (!args.apply) {
    if (args.json) {
      console.log(JSON.stringify({ mode: 'dry-run', complaints }, null, 2))
    } else {
      printHumanSummary({ apply: false, complaints, results: [] })
    }
    return
  }

  const results = []
  for (const complaint of complaints) {
    results.push(await escalateComplaint({ supabase, complaint, createAcknowledgeToken }))
  }

  const refreshError = await refreshMaterializedViewsIfNeeded(supabase, results)

  if (args.json) {
    console.log(JSON.stringify({ mode: 'apply', results, refreshError }, null, 2))
  } else {
    printHumanSummary({ apply: true, complaints, results })
    if (refreshError) {
      console.warn(`Materialized view refresh failed: ${refreshError}`)
    }
  }

  if (results.some((result) => result.outcome === 'error') || refreshError) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
