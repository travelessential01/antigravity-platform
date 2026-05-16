import { Inngest } from "inngest";

const isProduction = process.env.NODE_ENV === "production";
const localInngestKey = "local";

// Define the absolute events that StayAssist V4 can trigger
type Events = {
    "complaint/submitted": {
        data: {
            complaintId: string;
            patientId: string;
            // Default SLA is 24h, Critical is 2h. We use 10 mins as a mock local testing default.
            clinicalSlaMinutes: number;
        };
    };
    "complaint/resolved": {
        data: {
            complaintId: string;
        };
    };
    "complaint/acknowledged": {
        data: {
            complaintId: string;
        };
    };
    "complaint/escalated": {
        data: {
            complaintId: string;
        }
    },
    "complaint/notification_read": {
        data: {
            complaintId: string;
        }
    },
    "complaint/closed": {
        data: {
            complaintId: string;
        }
    },
    "complaint/sla_breached": {
        data: {
            complaintId: string;
        }
    },
    "capa/validated": {
        data: {
            complaintId: string;
            msdId: string;
            msId: string;
        }
    },
    "sla/config-updated": {
        data: {
            ackHours: number;
            resHours: number;
            hospitalId: string | null;
            updatedBy: string;
        }
    };
    // Task 4.3 — notification engine telemetry
    "sla/breach-notification-sent": {
        data: {
            complaintId: string;
            channel: 'sms' | 'email' | 'in-app';
            /** true when MockSmsProvider was used (no real keys) */
            stub: boolean;
            messageId?: string;
        }
    };
};

export const inngest = new Inngest({
    id: "stayassist-clinical-engine",
    isDev: !isProduction,
    eventKey: isProduction ? process.env.INNGEST_EVENT_KEY : localInngestKey,
    signingKey: isProduction ? process.env.INNGEST_SIGNING_KEY : localInngestKey,
});

export type InngestEvents = Events;
