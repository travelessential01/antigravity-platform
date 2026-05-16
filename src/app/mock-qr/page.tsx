"use client"

import { useState } from "react"

interface Hospital {
    id: string
    name: string
}

export default function QRAssetsPage() {
    const [hospitals, setHospitals] = useState<Hospital[]>([])
    const [loaded, setLoaded] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [downloading, setDownloading] = useState<string | null>(null)
    const [downloadError, setDownloadError] = useState<string | null>(null)

    async function loadHospitals() {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/hospitals')
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body?.error ?? `Failed to load hospitals (${res.status})`)
            }
            const data: Hospital[] = await res.json()
            setHospitals(data)
            setLoaded(true)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load hospitals')
        } finally {
            setLoading(false)
        }
    }

    async function downloadQR(hospitalId: string, format: 'png' | 'svg') {
        setDownloading(`${hospitalId}-${format}`)
        setDownloadError(null)
        try {
            const res = await fetch(`/api/qr/generate?hospitalId=${hospitalId}&format=${format}`)
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                setDownloadError(body?.error ?? `Download failed (${res.status})`)
                return
            }

            // Stream response into a temporary object URL and trigger browser save
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            const cd = res.headers.get('Content-Disposition') ?? ''
            const match = cd.match(/filename="([^"]+)"/)
            a.download = match?.[1] ?? `qr_${hospitalId.slice(0, 8)}.${format}`
            a.click()
            URL.revokeObjectURL(url)
        } catch (e: unknown) {
            setDownloadError(e instanceof Error ? e.message : 'Network error during QR download')
        } finally {
            setDownloading(null)
        }
    }

    const APP_BASE = process.env.NEXT_PUBLIC_APP_URL
        ?? (typeof window !== 'undefined' ? window.location.origin : '')

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">QR Code Asset Generation</h1>
                    <p className="text-slate-500 mt-1 text-sm">
                        Task 7.4 — Generate hospital-specific patient intake QR codes for physical kit inserts.
                        PNG output is 1200×1200 px (300 DPI for 4×4 inch print). SVG is fully scalable.
                    </p>
                </div>

                {/* Info banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                    <strong>Encoded URL structure:</strong>{" "}
                    <code className="bg-blue-100 px-1 rounded text-xs">
                        {APP_BASE}/intake?hospital_id=[uuid]
                    </code>
                    <br />
                    <span className="text-xs text-blue-600 mt-1 block">
                        QR contains zero PHI. Only the hospital UUID is encoded. Error correction level: H (30% damage tolerance for kit box inserts).
                    </span>
                </div>

                {/* Load hospitals */}
                {!loaded && (
                    <button
                        onClick={loadHospitals}
                        disabled={loading}
                        className="px-6 py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Loading hospitals…' : 'Load Hospitals from DB'}
                    </button>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
                        {error}
                    </div>
                )}

                {downloadError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
                        ⚠️ {downloadError}
                    </div>
                )}

                {/* Hospital QR table */}
                {loaded && hospitals.length === 0 && (
                    <p className="text-slate-500 text-sm">No hospitals found in the database.</p>
                )}

                {hospitals.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Hospital</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Intake URL Preview</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Download</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {hospitals.map((h) => (
                                    <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">{h.name}</td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{h.id.slice(0, 8)}…</td>
                                        <td className="px-6 py-4">
                                            <code className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded break-all">
                                                /intake?hospital_id={h.id.slice(0, 8)}…
                                            </code>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => downloadQR(h.id, 'png')}
                                                    disabled={!!downloading}
                                                    className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                                >
                                                    {downloading === `${h.id}-png` ? 'Generating…' : 'PNG (300 DPI)'}
                                                </button>
                                                <button
                                                    onClick={() => downloadQR(h.id, 'svg')}
                                                    disabled={!!downloading}
                                                    className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                                >
                                                    {downloading === `${h.id}-svg` ? 'Generating…' : 'SVG'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Validation note */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                    <strong>Post-download validation:</strong> Scan each PNG with a physical device to confirm it opens
                    the Service Worker-cached offline intake form. Cross-check hospital_id matches the facility.
                    Deliver assets to Hospital Operations team for print run.
                </div>
            </div>
        </div>
    )
}
