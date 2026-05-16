'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge } from "@/components/ui/badge";

function QRContextBridgeContent() {
  const searchParams = useSearchParams();
  // Derive directly from searchParams — no state needed, avoids setState-in-effect warning
  const hospitalId = searchParams.get('hospital_id') ?? searchParams.get('hospitalId');

  if (!hospitalId) return null;

  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3">
      <Badge variant="outline" className="text-xs">
        Facility Locked
      </Badge>
      <span className="truncate font-mono text-xs text-muted-foreground">
        {hospitalId}
      </span>
    </div>
  );
}

export function QRContextBridge() {
  return (
    <Suspense fallback={null}>
      <QRContextBridgeContent />
    </Suspense>
  );
}
