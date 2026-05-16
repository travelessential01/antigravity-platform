"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { updateSlaConfig } from "@/actions/sla"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { StatusBanner } from "@/components/ui/status-banner"
import { useSlaStore } from "@/store/useSlaStore"

export function SlaConfigClient() {
  const [ackHours, setAckHours] = useState([2])
  const [resHours, setResHours] = useState([24])
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { setBounds } = useSlaStore()

  const handleSave = () => {
    setStatus("idle")
    setErrorMsg(null)
    startTransition(async () => {
      const result = await updateSlaConfig({
        ackHours: ackHours[0],
        resHours: resHours[0],
      })

      if (result.success) {
        setBounds(ackHours[0], resHours[0])
        setStatus("success")
      } else {
        setErrorMsg(result.error ?? "Unknown error")
        setStatus("error")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SLA Threshold Configuration</CardTitle>
        <CardDescription>
          Adjust acknowledgement deadlines for new complaints. Resolution targets are
          stored for reporting, but automatic resolution escalation is not active yet.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium" htmlFor="ack-slider">
              Max acknowledgement time
            </label>
            <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm">
              {ackHours[0]} hours
            </span>
          </div>
          <Slider
            id="ack-slider"
            value={ackHours}
            onValueChange={setAckHours}
            max={24}
            min={1}
            step={1}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">NABH upper limit: 24 hours.</p>
        </div>

        <div className="space-y-3 border-t pt-6">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium" htmlFor="resolution-slider">
              Max resolution time
            </label>
            <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm">
              {resHours[0]} hours
            </span>
          </div>
          <Slider
            id="resolution-slider"
            value={resHours}
            onValueChange={setResHours}
            max={720}
            min={1}
            step={1}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Stored for reporting only. NABH upper limit: 720 hours, or 30 days.
          </p>
        </div>

        {status === "success" ? (
          <StatusBanner variant="success">
            SLA limits updated. Dashboard countdown thresholds applied.
          </StatusBanner>
        ) : null}

        {status === "error" ? (
          <StatusBanner variant="error">{errorMsg}</StatusBanner>
        ) : null}

        <div className="flex justify-end border-t pt-6">
          <Button onClick={handleSave} disabled={isPending} className="min-w-40">
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Configuration"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
