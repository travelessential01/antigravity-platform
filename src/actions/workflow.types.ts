// Shared workflow constants and types — NOT a server action file
// Imported by both server and client as a pure module

export const WORKFLOW_STATES = [
    'submitted',
    'acknowledged',
    'investigating',
    'resolved',
    'capa_validated',
    'closed'
] as const;

export type ComplaintStatus = typeof WORKFLOW_STATES[number];
