'use client'

import dynamic from 'next/dynamic'

// ssr: false is only valid inside Client Components (Next.js 16 restriction)
// This page is a thin client shell that lazy-loads the actual intake form
const IntakeForm = dynamic(
  () => import('./IntakeForm').then(m => ({ default: m.IntakeForm })),
  { ssr: false }
)

export default function IntakePage() {
  return <IntakeForm />
}
