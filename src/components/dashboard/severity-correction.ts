export type SeverityCorrectionPermission = "none" | "increase_only" | "full"

export function resolveSeverityCorrectionPermission(role: string): SeverityCorrectionPermission {
  if (
    role === "quality_coordinator" ||
    role === "admin" ||
    role === "medical_superintendent"
  ) {
    return "full"
  }

  if (role === "department_manager") {
    return "increase_only"
  }

  return "none"
}
