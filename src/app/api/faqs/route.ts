/**
 * /api/faqs - FAQ Management API Routes
 * Sprint A.8 - StayAssist V1 API Route Security
 *
 * SECURITY CHANGE FROM PRE-SPRINT:
 *   POST, PUT, DELETE previously had zero authentication.
 *   Privileged reads/writes now enforce Admin role plus MFA via requireApiPrivileged().
 *   Write operations use a user-scoped client and still respect RLS.
 *
 * GET -> Public for published FAQs. Draft access requires Admin + MFA.
 * POST -> Admin + MFA required
 * PUT -> Admin + MFA required
 * DELETE -> Admin + MFA required
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth-guard'
import { requireApiPrivileged } from '@/lib/api-auth'

async function requireAdminForApi() {
  return requireApiPrivileged(['Admin'])
}

const publicSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const hospitalId = searchParams.get('hospitalId')
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const wantsDrafts = searchParams.get('published') === 'false'

  if (wantsDrafts) {
    const { errorResponse } = await requireAdminForApi()
    if (errorResponse) return errorResponse
  }

  let query = publicSupabase()
    .from('faqs')
    .select('*')
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })

  if (hospitalId) query = query.eq('hospital_id', hospitalId)
  if (category) query = query.eq('category', category)
  if (!wantsDrafts) query = query.eq('is_published', true)
  if (search) {
    query = query.or(`question.ilike.%${search}%,answer.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const { errorResponse } = await requireAdminForApi()
  if (errorResponse) return errorResponse

  const body = await request.json()
  const { question, answer, category, hospital_id, target_audience, tags, is_published, sort_order } =
    body

  if (!question || !answer) {
    return NextResponse.json({ error: 'Question and answer are required.' }, { status: 400 })
  }

  const supabase = await createAuthenticatedClient()
  const { data, error } = await supabase
    .from('faqs')
    .insert({
      question,
      answer,
      category: category || 'General',
      hospital_id: hospital_id || null,
      target_audience: target_audience || 'patient',
      tags: tags || [],
      is_published: is_published ?? false,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const { errorResponse } = await requireAdminForApi()
  if (errorResponse) return errorResponse

  const body = await request.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'FAQ id is required.' }, { status: 400 })
  }

  const supabase = await createAuthenticatedClient()
  const { data, error } = await supabase
    .from('faqs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(request: NextRequest) {
  const { errorResponse } = await requireAdminForApi()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'FAQ id is required.' }, { status: 400 })
  }

  const supabase = await createAuthenticatedClient()
  const { error } = await supabase.from('faqs').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
