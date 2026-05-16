import { NextRequest, NextResponse } from 'next/server';
import { transitionComplaintStatus } from '@/actions/workflow';
import { requireApiRole } from '@/lib/api-auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const { errorResponse } = await requireApiRole(['Admin', 'Medical Superintendent']);
    if (errorResponse) return errorResponse;

    try {
        const { complaintId } = await req.json();

        if (!complaintId) {
            return NextResponse.json({ error: 'complaintId is required' }, { status: 400 });
        }

        const result = await transitionComplaintStatus(complaintId, 'acknowledged');
        if (!result.success) {
            return NextResponse.json(
                { error: result.error ?? 'Failed to acknowledge complaint.' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Escalation successfully averted. SLA timer aborted.',
            status: result.currentStatus
        });

    } catch (error: unknown) {
        logger.error('[Escalation API] Failed to resolve escalation.', {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal Server Error'
        }, { status: 400 });
    }
}
