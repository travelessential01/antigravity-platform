const SECRET_PATTERNS = [
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,
  /AKIA[A-Z0-9]{16}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /([A-Za-z0-9_]*SECRET[A-Za-z0-9_]*=)[^\s]+/gi,
  /([A-Za-z0-9_]*KEY[A-Za-z0-9_]*=)[^\s]+/gi,
  /([A-Za-z0-9_]*TOKEN[A-Za-z0-9_]*=)[^\s]+/gi,
]

export function redact(value: unknown): string {
  let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)

  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, (match, prefix?: string) => `${prefix ?? ''}[REDACTED:${Math.min(match.length, 12)}]`)
  }

  return text
}

export function safeLog(label: string, value: unknown) {
  console.info(`${label}: ${redact(value)}`)
}
