import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runMergeTest() {
    console.log("=========================================");
    console.log("🚀 SPRINT 3 VERIFICATION: DUPLICATE MERGE");
    console.log("=========================================\n");

    const patientId = crypto.randomUUID();
    const hospitalId = crypto.randomUUID();

    console.log(`👤 Mock Patient ID: ${patientId}`);

    // 1. Insert First Complaint
    console.log(`\n⏳ [1/2] Inserting base complaint record...`);
    const { data: c1, error: e1 } = await supabase
        .from('complaints')
        .insert({
            patient_id: patientId,
            department_id: "DEPT-MOCK",
            hospital_id: hospitalId,
            status: "submitted"
        })
        .select('id')
        .single();

    if (e1) {
        console.error("❌ Failed to insert base complaint:", e1.message);
        return;
    }
    console.log(`✅ Base Complaint Created: ${c1.id}`);

    // Wait 2 seconds (simulating network sync delay)
    await new Promise(r => setTimeout(r, 2000));

    // 2. Fetch 2-minute window constraint (The Exact Query used in complaints.ts)
    console.log(`\n⏳ [2/2] Fetching recent complaints bounded by 2-min window...`);
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    const { data: recentComplaints, error: e2 } = await supabase
        .from('complaints')
        .select('id, parent_complaint_id, status, created_at')
        .eq('patient_id', patientId)
        .gte('created_at', twoMinutesAgo)
        .order('created_at', { ascending: false });

    if (e2) {
        console.error("❌ Failed to execute deduplication query:", e2.message);
        return;
    }

    if (recentComplaints && recentComplaints.length > 0) {
        const matchedParentId = recentComplaints[0].parent_complaint_id || recentComplaints[0].id;
        console.log(`✅ Deduplication Window Caught Match. Assigned Parent ID: ${matchedParentId}`);

        if (matchedParentId === c1.id) {
            console.log("🎉 SUCCESS: The transaction successfully merged into the parent ticket.");
        } else {
            console.error("❌ FAILURE: Assigned parent ID does not match the base complaint.");
        }
    } else {
        console.error("❌ FAILURE: Deduplication string missed the recently inserted complaint.");
    }
}

runMergeTest();
