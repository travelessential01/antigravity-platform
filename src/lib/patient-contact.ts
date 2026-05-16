export function normalizePatientContact(input: string): string | null {
  const digitsOnly = input.replace(/\D/g, '')

  if (digitsOnly.length === 10) {
    return digitsOnly
  }

  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return digitsOnly.slice(1)
  }

  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return digitsOnly.slice(2)
  }

  return null
}
