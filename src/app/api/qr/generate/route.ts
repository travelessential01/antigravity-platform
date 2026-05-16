/**
 * GET /api/qr/generate?hospitalId=[uuid]&format=png|svg
 *
 * Generates a hospital-specific QR code encoding the patient intake URL.
 * Access is limited to admin, medical superintendent, and quality coordinator.
 */

import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createAuthenticatedClient } from '@/lib/auth-guard';
import { requireApiRole } from '@/lib/api-auth';
import { logger } from '@/lib/logger';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { user, errorResponse } = await requireApiRole([
        'Admin',
        'Medical Superintendent',
        'Quality Coordinator',
    ]);
    if (errorResponse || !user) return errorResponse!;

    const hospitalId = req.nextUrl.searchParams.get('hospitalId');
    const format = (req.nextUrl.searchParams.get('format') ?? 'png') as 'png' | 'svg';

    if (!hospitalId) {
        return NextResponse.json({ error: 'hospitalId is required' }, { status: 400 });
    }
    if (!['png', 'svg'].includes(format)) {
        return NextResponse.json({ error: 'format must be png or svg' }, { status: 400 });
    }

    const requiresHospitalScope =
        user.role === 'quality_coordinator' || user.role === 'medical_superintendent';

    if (requiresHospitalScope && (!user.hospitalId || user.hospitalId !== hospitalId)) {
        return NextResponse.json({ error: 'Forbidden: hospital out of scope.' }, { status: 403 });
    }

    const supabase = await createAuthenticatedClient();
    const { data: hospital, error: hospitalError } = await supabase
        .from('hospitals')
        .select('id, name')
        .eq('id', hospitalId)
        .single();

    if (hospitalError || !hospital) {
        return NextResponse.json({ error: 'Hospital not found' }, { status: 404 });
    }

    const intakeUrl = `${APP_URL}/intake?hospital_id=${hospitalId}`;
    const safeName = hospital.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    try {
        if (format === 'svg') {
            const svg = await QRCode.toString(intakeUrl, {
                type: 'svg',
                errorCorrectionLevel: 'H',
                margin: 4,
                color: {
                    dark: '#0F172A',
                    light: '#FFFFFF',
                },
            });

            return new NextResponse(svg, {
                status: 200,
                headers: {
                    'Content-Type': 'image/svg+xml',
                    'Content-Disposition': `attachment; filename="qr_${safeName}_${hospitalId.slice(0, 8)}.svg"`,
                    'Cache-Control': 'no-store',
                },
            });
        }

        const pngBuffer = await QRCode.toBuffer(intakeUrl, {
            type: 'png',
            errorCorrectionLevel: 'H',
            width: 1200,
            margin: 4,
            color: {
                dark: '#0F172A',
                light: '#FFFFFF',
            },
        });

        return new NextResponse(new Uint8Array(pngBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'image/png',
                'Content-Disposition': `attachment; filename="qr_${safeName}_${hospitalId.slice(0, 8)}_300dpi.png"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (err) {
        logger.error('[QR Generation] Failed to generate QR asset.', {
            error: err instanceof Error ? err.message : String(err),
            hospitalId,
            format,
        });
        return NextResponse.json({ error: 'QR generation failed' }, { status: 500 });
    }
}
