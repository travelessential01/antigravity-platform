"use server";

import { requireUser, AuthError } from "@/lib/auth-guard";
import { createAdminClient } from "@/lib/supabase-admin";
import { inngest } from "@/inngest/client";

// In a real system, we'd accept real signatures (e.g. RSA or hardware tokens).
// For StayAssist V4, we simulate JWT hashes based on the authenticated user.
interface SignCapaPayload {
    complaintId: string;
    userId: string;
    role: "MSD" | "MS"; // Medico-Social Department OR Medical Superintendent
    signatureHash: string; // Simulated cryptosignature
}

export async function signCapaWorkflow(payload: SignCapaPayload) {
    let user
    try {
        user = await requireUser()
    } catch (error) {
        if (error instanceof AuthError) {
            throw new Error(error.message)
        }
        throw new Error("Unauthorized")
    }

    if (user.id !== payload.userId) {
        throw new Error("Authenticated user does not match requested CAPA signer.")
    }

    const supabase = createAdminClient();

    // 2. Fetch current CAPA state
    const { data: complaint, error: fetchError } = await supabase
        .from("complaints")
        .select("msd_signature_jwt, ms_signature_jwt, status")
        .eq("id", payload.complaintId)
        .single();

    if (fetchError || !complaint) {
        throw new Error(`Failed to retrieve complaint: ${fetchError?.message}`);
    }

    // 3. Determine which signature to apply
    const updatePayload: Record<string, unknown> = {};
    if (payload.role === "MSD") {
        updatePayload.msd_signature_jwt = payload.signatureHash;
    } else if (payload.role === "MS") {
        updatePayload.ms_signature_jwt = payload.signatureHash;
    }

    // 4. Check if this is the final signature required
    const isFinalSignature =
        (payload.role === "MSD" && complaint.ms_signature_jwt) ||
        (payload.role === "MS" && complaint.msd_signature_jwt);

    // If final, move status to capa_validated
    if (isFinalSignature) {
        // Double check we're not retro-validating an already closed complaint
        if (complaint.status !== 'resolved' && complaint.status !== 'capa_validated') {
             throw new Error(`CAPA validation requires the complaint to be 'resolved' first. Current status: ${complaint.status}`);
        }

        updatePayload.status = 'capa_validated';
        updatePayload.capa_validation_date = new Date().toISOString();
    }

    // 5. Commit the signature
    const { error: updateError } = await supabase
        .from("complaints")
        .update(updatePayload)
        .eq("id", payload.complaintId);

    if (updateError) throw new Error(`Signature committal failed: ${updateError.message}`);

    // 6. Trigger Audit Log & Rules Engine if Fully Validated
    if (isFinalSignature) {

        // Log to immutable Audit trail
        await supabase.from("audit_logs").insert({
            action: 'capa_dual_signed',
            entity_type: 'complaint',
            entity_id: payload.complaintId,
            user_id: payload.userId, // The MS applying the final sign
            metadata: {
                msd_sig: updatePayload.msd_signature_jwt || complaint.msd_signature_jwt,
                ms_sig: updatePayload.ms_signature_jwt || complaint.ms_signature_jwt,
                timestamp: updatePayload.capa_validation_date
            }
        });

        // Trigger Inngest Engine to handle 30-day Quality Coordinator Checkpoint
        await inngest.send({
            name: "capa/validated",
            data: {
                complaintId: payload.complaintId,
                msdId: payload.role === 'MSD' ? payload.userId : 'PREVIOUS_MSD_ID', // Real implementation would fetch via JWT
                msId: payload.role === 'MS' ? payload.userId : 'PREVIOUS_MS_ID'
            }
        });
    }

    return {
        success: true,
        isFullyValidated: !!isFinalSignature
    };
}
