"use client";

import { useState, useCallback, useEffect, type FormEvent } from "react";
import { Download, FileText, Loader2, Search, ShieldAlert, User } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBanner } from "@/components/ui/status-banner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAppTimestamp } from "@/lib/app-time";

interface AuditLog {
  id: string;
  timestamp: string;
  staff_id: string;
  action: string;
  metadata: {
    patient_id_hash?: string;
    ip_address?: string;
    user_agent?: string;
  };
}

type InvestigatorResponse = {
  data?: AuditLog[];
  total?: number | { value?: number };
};

export default function DPODashboard() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [staffId, setStaffId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [actionType, setActionType] = useState("");

  const fetchLogs = useCallback(async (pageNum: number, isReset: boolean = false) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/dpo/investigator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          staffId,
          patientId,
          actionType,
          page: pageNum,
          limit: 25,
        }),
      });

      if (!res.ok) throw new Error("Failed to fetch DPDP logs");

      const responseBody = (await res.json()) as InvestigatorResponse;
      const newLogs = responseBody.data ?? [];
      const nextTotal =
        typeof responseBody.total === "number"
          ? responseBody.total
          : responseBody.total?.value ?? 0;

      setLogs((prev) => (isReset ? newLogs : [...prev, ...newLogs]));
      setTotal(nextTotal);
      setHasMore(newLogs.length === 25);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch DPDP logs.");
    } finally {
      setLoading(false);
    }
  }, [staffId, patientId, actionType]);

  useEffect(() => {
    void fetchLogs(1, true);
  }, [fetchLogs]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    void fetchLogs(1, true);
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      void fetchLogs(nextPage, false);
    }
  };

  const exportForensicReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/dpo/export-forensic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ staffId, patientId, actionType }),
      });

      if (!res.ok) throw new Error("Report generation failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dpdp_forensic_audit_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell
      eyebrow="DPO Workspace"
      title="Forensic audit review"
      description="Search immutable read-audit telemetry for PHI access, exports, and access-review evidence."
      actions={
        <Button onClick={exportForensicReport} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Export DPDP PDF
        </Button>
      }
    >
      {error ? <StatusBanner variant="error">{error}</StatusBanner> : null}

      <Card>
        <CardHeader>
          <CardTitle>Audit filters</CardTitle>
          <CardDescription>
            Narrow the immutable audit stream by staff, anonymised patient identifier, or action type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label htmlFor="staff-id" className="text-sm font-medium">
                Staff ID Identifier
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  id="staff-id"
                  type="text"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  placeholder="e.g. DOC-4592"
                  className="h-11 pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="patient-id" className="text-sm font-medium">
                Anonymised Patient ID
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  id="patient-id"
                  type="text"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  placeholder="SHA-256 hash"
                  className="h-11 pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="action-type" className="text-sm font-medium">
                Action Vector
              </label>
              <select
                id="action-type"
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Any Action</option>
                <option value="VIEW_PHI">View PHI Envelope</option>
                <option value="EXPORT_CLINICAL">Export Clinical Data</option>
                <option value="LOGIN_ATTEMPT">System Access</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                Execute Query
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Badge variant="outline">
          <ShieldAlert className="size-3.5 text-amber-600" />
          Restricted audit surface
        </Badge>
        <p className="text-sm text-muted-foreground">Result pool: {total} logs found</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Immutable audit stream</CardTitle>
          <CardDescription>
            Timestamps are rendered in the configured application timezone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-48">Timestamp</TableHead>
                  <TableHead className="w-36">Vector</TableHead>
                  <TableHead className="w-36">Staff ID</TableHead>
                  <TableHead className="w-80">Metadata Payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatAppTimestamp(log.timestamp)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{log.staff_id}</TableCell>
                    <TableCell
                      className="max-w-md truncate font-mono text-xs text-muted-foreground"
                      title={JSON.stringify(log.metadata)}
                    >
                      {JSON.stringify(log.metadata)}
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-28 text-center text-muted-foreground">
                      No telemetry found matching the current query.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          {hasMore && logs.length > 0 ? (
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                {loading ? "Loading telemetry..." : "Load more"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </PageShell>
  );
}
