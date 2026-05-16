import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
    scheduleSlaBreach,
    slaBreachReconciliation,
    escalationWakeUp,
    refreshMaterializedViewsOnEvent,
    nightlyComplianceAudit,
    capa30DayCheckpoint
} from "@/inngest/functions";

const isProduction = process.env.NODE_ENV === "production";

// Next.js App Router API Route for Inngest Webhook Callbacks
export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [
        scheduleSlaBreach,
        slaBreachReconciliation,
        escalationWakeUp,
        refreshMaterializedViewsOnEvent,
        nightlyComplianceAudit,
        capa30DayCheckpoint
    ],
});
