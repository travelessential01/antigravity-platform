"use client";

/**
 * /staff/select-department/page.tsx
 * Phase 3.4 — Float Staff Department Selector
 *
 * Shown to float staff (>1 active department assignment) after biometric verification.
 * Pre-assigned staff with a single department are auto-routed by the server — this page
 * is only reached by genuine float staff.
 *
 * Flow:
 *  1. Fetch all active department assignments from /api/staff/session-context (GET)
 *  2. If only 1 dept → auto-select and redirect immediately
 *  3. Display department picker UI
 *  4. On select → POST /api/staff/session-context → redirect /staff/dashboard
 *
 * Session is locked for 8 hours after selection. No mid-session changes.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Loader2, LockKeyhole } from "lucide-react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { StatusBanner } from "@/components/ui/status-banner";
import { createBrowserAuthClient } from "@/lib/supabase-client";

interface DeptAssignment {
  department_id: string
  assignment_type: "primary" | "float" | "temporary"
  valid_until: string | null
  departments: Array<{ name: string }> | null
}

export default function SelectDepartmentPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<DeptAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    async function loadDepartments() {
      try {
        const supabase = createBrowserAuthClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/login"); return; }

        // Fetch M2M assignments with department names
        const { data, error: fetchErr } = await supabase
          .from("user_department_assignments")
          .select("department_id, assignment_type, valid_until, departments(name)")
          .eq("is_active", true)
          .order("assignment_type");

        if (fetchErr || !data) {
          setError("Could not load your department assignments. Contact your administrator.");
          setLoading(false);
          return;
        }

        const now = Date.now();
        const activeAssignments = (data as DeptAssignment[]).filter((assignment) => {
          if (!assignment.valid_until) return true;
          return new Date(assignment.valid_until).getTime() > now;
        });

        if (activeAssignments.length === 0) {
          setError("You do not currently have an active department assignment. Contact your administrator.");
          setLoading(false);
          return;
        }

        // If only one dept, auto-select and skip the picker
        if (activeAssignments.length === 1) {
          await submitSelection(activeAssignments[0].department_id);
          return;
        }

        setDepartments(activeAssignments);
        setLoading(false);
      } catch {
        setError("Failed to load departments.");
        setLoading(false);
      }
    }
    void loadDepartments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitSelection(deptId: string) {
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/staff/session-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeDeptId: deptId }),
    });

    const json = await res.json() as { success?: boolean; error?: string };

    if (!res.ok || !json.success) {
      setError(json.error ?? "Failed to set department context.");
      setSubmitting(false);
      return;
    }

    router.replace("/dashboard");
  }

  const assignmentLabel: Record<string, string> = {
    primary: "Primary",
    float: "Float",
    temporary: "Temporary",
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </main>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <AuthShell
      icon={<Building2 className="size-5" />}
      title="Select your department"
      description="You are assigned to multiple departments. Choose which department you are working in today."
    >
      <StatusBanner variant="info" title="Session scope">
        <span className="inline-flex items-center gap-2">
          <LockKeyhole className="size-4" />
          This selection is locked for your 8-hour session. Log out to change department.
        </span>
      </StatusBanner>

      {error && (
        <StatusBanner variant="error">{error}</StatusBanner>
      )}

      <div className="space-y-3">
        {departments.map((assignment) => {
          const rawDepts = assignment.departments as unknown as Array<{ name: string }> | { name: string } | null
          const deptName = Array.isArray(rawDepts)
            ? (rawDepts[0]?.name ?? "Unknown Department")
            : (rawDepts?.name ?? "Unknown Department");
          const isSelected = selected === assignment.department_id;
          return (
            <button
              key={assignment.department_id}
              id={`dept-select-${assignment.department_id}`}
              onClick={() => setSelected(assignment.department_id)}
              disabled={submitting}
              className={`w-full rounded-lg border px-4 py-3 text-left transition
                ${isSelected
                  ? "border-primary bg-primary/10 ring-2 ring-primary/15"
                  : "border-border bg-background hover:bg-muted/40"
                }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{deptName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {assignmentLabel[assignment.assignment_type] ?? assignment.assignment_type}
                  </p>
                </div>
                {isSelected && (
                  <div className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <Button
        id="confirm-department-btn"
        onClick={() => selected && void submitSelection(selected)}
        disabled={!selected || submitting}
        className="h-11 w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Confirming…
          </>
        ) : "Confirm and enter dashboard"}
      </Button>
    </AuthShell>
  );
}
