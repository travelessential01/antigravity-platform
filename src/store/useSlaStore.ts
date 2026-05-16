import { create } from 'zustand';
import type { PublicComplaint } from '@/components/dashboard/columns';

interface SLAState {
    // SLA counters
    activeBreaches: number;
    criticalHoists: string[]; // array of hoisted complaint_ids (for badge/counter)
    ackHours: number;
    resHours: number;

    // Complaint list — owned by the store so hoist() can reorder in-place
    // Seeded from mock data (Sprint 4); replaced by real fetch in Sprint 5
    complaints: PublicComplaint[];

    // Actions
    addBreach: () => void;
    hoistComplaint: (id: string) => void; // legacy: adds id to criticalHoists[]
    /**
     * hoist() — Task 4.2 Realtime callback target.
     * Moves the complaint with `complaintId` to index 0 of the complaints array
     * AND increments activeBreaches. Called by the SLA breach WebSocket channel.
     */
    hoist: (complaintId: string) => void;
    setComplaints: (data: PublicComplaint[]) => void;
    setBounds: (ack: number, res: number) => void;
    clearSlas: () => void;
}

export const useSlaStore = create<SLAState>((set) => ({
    activeBreaches: 0,
    criticalHoists: [],
    ackHours: 2,
    resHours: 24,
    complaints: [],

    addBreach: () => set((state) => ({ activeBreaches: state.activeBreaches + 1 })),

    hoistComplaint: (id) => set((state) => ({ criticalHoists: [...state.criticalHoists, id] })),

    hoist: (complaintId) =>
        set((state) => {
            const idx = state.complaints.findIndex((c) => c.id === complaintId);
            if (idx <= 0) {
                // Already at top or not found — still increment breach counter
                return { activeBreaches: state.activeBreaches + 1 };
            }
            const updated = [...state.complaints];
            const [item] = updated.splice(idx, 1);
            return {
                complaints: [item, ...updated],
                activeBreaches: state.activeBreaches + 1,
                criticalHoists: [...state.criticalHoists, complaintId],
            };
        }),

    setComplaints: (data) => set({ complaints: data }),

    setBounds: (ack, res) => set({ ackHours: ack, resHours: res }),

    clearSlas: () => set({ activeBreaches: 0, criticalHoists: [], complaints: [] }),
}));
