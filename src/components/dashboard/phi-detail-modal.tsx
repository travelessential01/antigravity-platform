"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { readComplaintPHI } from "@/actions/complaints"
import { ShieldCheck, AlertTriangle, Loader2, Eye } from "lucide-react"

type ModalState = "confirming" | "loading" | "decrypted" | "error"

interface PhiData {
  description: string
  reporterName?: string
  reporterContact?: string
  [key: string]: unknown
}

interface PhiDetailModalProps {
  complaintId: string | null
  onClose: () => void
}

export function PhiDetailModal({ complaintId, onClose }: PhiDetailModalProps) {
  const isOpen = !!complaintId
  const [state, setState] = useState<ModalState>("confirming")
  const [phiData, setPhiData] = useState<PhiData | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const isLoading = state === "loading"

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setState("confirming")
      setPhiData(null)
      setErrorMsg(null)
      onClose()
    }
  }

  const handleConfirmIdentity = () => {
    if (!complaintId) return
    setState("loading")
    void (async () => {
      try {
        const result = await readComplaintPHI({ complaintId })
        if (result?.success && 'data' in result && result.data) {
          setPhiData(result.data as PhiData)
          setState("decrypted")
        } else {
          setErrorMsg((result && 'error' in result ? result.error : undefined) ?? "Unknown decryption error.")
          setState("error")
        }
      } catch (error) {
        setErrorMsg(error instanceof Error ? error.message : "Unknown decryption error.")
        setState("error")
      }
    })()
  }

  const handleRetry = () => {
    setState("confirming")
    setPhiData(null)
    setErrorMsg(null)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Eye className="w-5 h-5 text-indigo-600" />
            Complaint PHI Details
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Ticket{" "}
            <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              {complaintId}
            </span>
          </DialogDescription>
        </DialogHeader>

        {state === "confirming" && (
          <div className="flex flex-col items-center gap-5 py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Identity Re-Confirmation Required
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-xs">
                Access to protected health information requires re-confirming your
                active session. An audit event will be recorded.
              </p>
            </div>
            <DialogFooter className="w-full sm:justify-center">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmIdentity}
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Confirm Identity and Decrypt
              </Button>
            </DialogFooter>
          </div>
        )}

        {state === "loading" && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm text-slate-500">Verifying session and decrypting...</p>
          </div>
        )}

        {state === "decrypted" && phiData && (
          <div className="flex flex-col gap-4 py-2">
            {(phiData.reporterName || phiData.reporterContact) && (
              <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                {phiData.reporterName && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reporter
                    </p>
                    <p className="mt-1 text-sm text-slate-800">{phiData.reporterName}</p>
                  </div>
                )}
                {phiData.reporterContact && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Contact
                    </p>
                    <p className="mt-1 text-sm text-slate-800">{phiData.reporterContact}</p>
                  </div>
                )}
              </div>
            )}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-1">
                Decrypted Description
              </p>
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {phiData.description}
              </p>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              Access logged to local_audit_reads
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Decryption Failed</p>
              <p className="mt-1 text-xs text-red-500 max-w-xs">{errorMsg}</p>
            </div>
            <DialogFooter className="w-full sm:justify-center">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button
                onClick={handleRetry}
                className="bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Retry
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
