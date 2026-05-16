import crypto from 'crypto'

export const ACKNOWLEDGE_LINK_TTL_SECONDS = 15 * 60

interface SignedAcknowledgePayload {
  v: 1
  complaintId: string
  linkId: string
  exp: number
}

export interface VerifiedAcknowledgeToken {
  complaintId: string
  linkId: string
  exp: number
}

function getSigningSecret(): string {
  const secret = process.env.ACKNOWLEDGE_LINK_SECRET

  if (!secret) {
    throw new Error('Missing ACKNOWLEDGE_LINK_SECRET. Configure a dedicated signing secret for acknowledge links.')
  }

  return secret
}

function signPayload(encodedPayload: string): string {
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url')
}

export function createAcknowledgeToken(input: {
  complaintId: string
  linkId: string
  expiresInSeconds?: number
}): string {
  const payload: SignedAcknowledgePayload = {
    v: 1,
    complaintId: input.complaintId,
    linkId: input.linkId,
    exp: Math.floor(Date.now() / 1000) + (input.expiresInSeconds ?? ACKNOWLEDGE_LINK_TTL_SECONDS),
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = signPayload(encodedPayload)

  return `${encodedPayload}.${signature}`
}

export function verifyAcknowledgeToken(raw: string): VerifiedAcknowledgeToken | null {
  const [encodedPayload, providedSignature, ...rest] = raw.split('.')
  if (!encodedPayload || !providedSignature || rest.length > 0) {
    return null
  }

  const expectedSignature = signPayload(encodedPayload)
  const provided = Buffer.from(providedSignature, 'utf8')
  const expected = Buffer.from(expectedSignature, 'utf8')

  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    return null
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as Partial<SignedAcknowledgePayload>

    if (
      decoded.v !== 1 ||
      typeof decoded.complaintId !== 'string' ||
      typeof decoded.linkId !== 'string' ||
      typeof decoded.exp !== 'number'
    ) {
      return null
    }

    if (Math.floor(Date.now() / 1000) > decoded.exp) {
      return null
    }

    return {
      complaintId: decoded.complaintId,
      linkId: decoded.linkId,
      exp: decoded.exp,
    }
  } catch {
    return null
  }
}
