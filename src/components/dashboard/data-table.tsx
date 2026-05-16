"use client"

import * as React from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { motion, useReducedMotion } from "framer-motion"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSlaStore } from "@/store/useSlaStore"
import type { SeverityCorrectionPermission } from "@/components/dashboard/severity-correction"

// Framer Motion-wrapped TableRow for breached SLA rows
const MotionTableRow = motion(TableRow)

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  onViewDetails?: (id: string) => void
  severityCorrectionPermission?: SeverityCorrectionPermission
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onViewDetails,
  severityCorrectionPermission = "none",
}: DataTableProps<TData, TValue>) {
  // Read the live NABH ack threshold from the global SLA store
  const ackHours = useSlaStore((s) => s.ackHours)
  const breachThresholdMins = ackHours * 60 * 0.2
  const shouldReduceMotion = useReducedMotion()

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table intentionally opts this component out of React Compiler memoization.
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      onViewDetails,
      severityCorrectionPermission,
    },
  })

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <Table>
        <TableHeader className="bg-muted/40">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="font-semibold text-muted-foreground">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => {
              // Determine SLA breach for this row — works for PublicComplaint shape
              const rowData = row.original as Record<string, unknown>
              const minsRemaining = typeof rowData.time_remaining_mins === "number"
                ? rowData.time_remaining_mins
                : null
              const status = rowData.status
              const hasActiveSla =
                status === "submitted" || status === "pending" || status === "escalated"
              const isBreached =
                hasActiveSla && minsRemaining !== null && minsRemaining <= breachThresholdMins

              if (isBreached) {
                return (
                  <MotionTableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="border-l-4 border-l-destructive bg-destructive/5 transition-colors hover:bg-destructive/10"
                    animate={shouldReduceMotion ? undefined : { opacity: [1, 0.72, 1] }}
                    transition={
                      shouldReduceMotion
                        ? undefined
                        : {
                            repeat: Infinity,
                            duration: 1.8,
                            ease: "easeInOut",
                          }
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </MotionTableRow>
                )
              }

              return (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="transition-colors hover:bg-muted/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-28 text-center text-muted-foreground"
              >
                <div className="space-y-1">
                  <p className="font-medium text-foreground">No active complaints found.</p>
                  <p className="text-sm">New complaint records will appear here after intake.</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
