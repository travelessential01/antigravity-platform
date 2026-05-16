/**
 * Supabase Realtime subscription factories — Task 4.2
 *
 * All factories accept the Supabase client instance (which carries the user's
 * JWT). Postgres RLS policies on each table enforce row-level scoping so that:
 *  - Ward Nurses receive ONLY events for their `department_id`
 *  - Quality Coordinators receive events for their entire `hospital_id`
 *  - Cross-tenant isolation: Hospital A users receive ZERO events from Hospital B
 *
 * PHI SAFETY: `subscribeToComplaints` only receives metadata columns as defined
 * by the RLS SELECT policy. Never SELECT PHI columns on this surface.
 */

import type {
    RealtimeChannel,
    RealtimePostgresChangesPayload,
    SupabaseClient,
} from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BreachPayload {
    complaint_id: string;
    hospital_id: string;
    breached_at: string;
    sla_type: 'acknowledgement' | 'resolution';
}

export interface ComplaintMetadataPayload {
    id: string;
    created_at: string;
    updated_at?: string;
    severity_level: string | null;
    status: string;
    department_id: string;
    hospital_id: string;
    sla_deadline?: string | null;
    // NOTE: No PHI columns (patient name, contact, etc.)
}

export interface NotificationPayload {
    id: string;
    recipient_id: string;
    complaint_id: string;
    channel: 'email' | 'sms' | 'in_app';
    deep_link: string | null;
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'expired';
    created_at: string;
    delivered_at: string | null;
    read_at: string | null;
}

// ---------------------------------------------------------------------------
// Factory 1: Complaints (metadata only, zero PHI)
//
// `departmentId` is OPTIONAL by design:
//  - Ward Nurses pass their department_id → filtered to their ward only
//  - Quality Coordinators pass undefined → no client-side filter; RLS policy
//    enforces hospital-level scoping (they see all depts in their hospital)
// ---------------------------------------------------------------------------

export function subscribeToComplaints(
    supabase: SupabaseClient,
    callback: (payload: { new: ComplaintMetadataPayload }) => void,
    departmentId?: string
): RealtimeChannel {
    const channel = supabase.channel('complaints-feed', {
        config: { broadcast: { self: false } },
    });

    channel.on(
        'postgres_changes',
        {
            event: 'INSERT',
            schema: 'public',
            table: 'complaints',
            ...(departmentId ? { filter: `department_id=eq.${departmentId}` } : {}),
        },
        callback
    );

    channel.on(
        'postgres_changes',
        {
            event: 'UPDATE',
            schema: 'public',
            table: 'complaints',
            ...(departmentId ? { filter: `department_id=eq.${departmentId}` } : {}),
        },
        callback
    );

    return channel;
}

// ---------------------------------------------------------------------------
// Factory 2: Notifications (personal feed — scoped to recipient_id)
// ---------------------------------------------------------------------------

export function subscribeToNotifications(
    supabase: SupabaseClient,
    callback: (payload: RealtimePostgresChangesPayload<NotificationPayload>) => void,
    recipientId?: string
): RealtimeChannel {
    const channel = supabase.channel(`notifications-feed-${recipientId ?? 'self'}`, {
        config: { broadcast: { self: false } },
    });

    const baseConfig = {
        schema: 'public' as const,
        table: 'notifications',
        ...(recipientId ? { filter: `recipient_id=eq.${recipientId}` } : {}),
    };

    channel.on(
        'postgres_changes',
        {
            event: 'INSERT',
            ...baseConfig,
        },
        callback
    );

    channel.on(
        'postgres_changes',
        {
            event: 'UPDATE',
            ...baseConfig,
        },
        callback
    );

    return channel;
}

// ---------------------------------------------------------------------------
// Factory 3: SLA Breaches (hospital-wide, RLS enforces cross-tenant isolation)
//
// No client-side filter is set here — the RLS policy on `sla_breach_log`
// ensures each user only receives breach events for their own hospital_id.
// ---------------------------------------------------------------------------

export function subscribeToBreaches(
    supabase: SupabaseClient,
    callback: (payload: { new: BreachPayload }) => void
): RealtimeChannel {
    const channel = supabase.channel('breach-feed', {
        config: { broadcast: { self: false } },
    });

    channel.on(
        'postgres_changes',
        {
            event: 'INSERT',
            schema: 'public',
            table: 'sla_breach_log',
        },
        callback
    );

    return channel;
}
