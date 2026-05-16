/**
 * SMS Provider Strategy — Task 4.3
 *
 * Abstraction layer for multi-gateway SMS dispatch.
 * Active provider is selected automatically:
 *   - MSG91_API_KEY present  → Msg91SmsProvider (with Twilio fallback)
 *   - Otherwise              → MockSmsProvider (dev stub, logs via logger)
 *
 * TRAI/DLT Template ID is always embedded in the payload structure,
 * even in stub mode, so the shape is production-correct from day one.
 *
 * To activate real SMS at staging: add MSG91_API_KEY to .env — zero code changes needed.
 */

import { logger } from '@/lib/logger'

export interface SmsResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface SmsSendOptions {
  to: string
  /** Pre-registered TRAI/DLT Template ID — mandatory in all payloads */
  dltTemplateId: string
  /** Ticket reference (non-PHI) */
  complaintRef: string
  /** e.g. "HIGH", "CRITICAL" */
  severity: string
}

// ---------------------------------------------------------------------------
// Abstract interface
// ---------------------------------------------------------------------------
export interface SmsProvider {
  send(options: SmsSendOptions): Promise<SmsResult>
}

// ---------------------------------------------------------------------------
// MockSmsProvider — active in development, no network calls
// ---------------------------------------------------------------------------
export class MockSmsProvider implements SmsProvider {
  async send(options: SmsSendOptions): Promise<SmsResult> {
    const messageId = `STUB-${crypto.randomUUID()}`
    logger.info('[MOCK SMS] Message suppressed because MockSmsProvider is active.', {
      to: options.to,
      dltTemplateId: options.dltTemplateId,
      complaintRef: options.complaintRef,
      severity: options.severity,
      messageId,
      timestamp: new Date().toISOString(),
      note: 'No real SMS sent. Configure MSG91_API_KEY to activate the real gateway.',
    })
    return { success: true, messageId }
  }
}

// ---------------------------------------------------------------------------
// Msg91SmsProvider — primary gateway (INACTIVE until MSG91_API_KEY is set)
// ---------------------------------------------------------------------------
export class Msg91SmsProvider implements SmsProvider {
  private readonly apiKey: string
  private readonly senderId: string
  private readonly fallback: SmsProvider

  constructor(apiKey: string, senderId: string, fallback: SmsProvider) {
    this.apiKey = apiKey
    this.senderId = senderId
    this.fallback = fallback
  }

  async send(options: SmsSendOptions): Promise<SmsResult> {
    try {
      const response = await fetch('https://api.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          authkey: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flow_id: options.dltTemplateId,
          sender: this.senderId,
          mobiles: options.to,
          complaintRef: options.complaintRef,
          severity: options.severity,
        }),
      })

      if (!response.ok) {
        logger.warn('[MSG91] Non-200 response, attempting fallback provider.', {
          status: response.status,
        })
        return this.fallback.send(options)
      }

      const data = (await response.json()) as { request_id?: string }
      return { success: true, messageId: data.request_id }
    } catch (err) {
      logger.error('[MSG91] Network error, attempting fallback provider.', {
        error: err instanceof Error ? err.message : String(err),
      })
      return this.fallback.send(options)
    }
  }
}

// ---------------------------------------------------------------------------
// TwilioSmsProvider — fallback gateway (INACTIVE until TWILIO_ACCOUNT_SID is set)
// ---------------------------------------------------------------------------
export class TwilioSmsProvider implements SmsProvider {
  private readonly accountSid: string
  private readonly authToken: string
  private readonly fromNumber: string

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.accountSid = accountSid
    this.authToken = authToken
    this.fromNumber = fromNumber
  }

  async send(options: SmsSendOptions): Promise<SmsResult> {
    try {
      // DLT Template ID embedded in the message body for TRAI compliance
      const body = `[DLT:${options.dltTemplateId}] Ref: ${options.complaintRef} | Priority: ${options.severity}. Log in to review.`

      const credentials = btoa(`${this.accountSid}:${this.authToken}`)
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: options.to,
            From: this.fromNumber,
            Body: body,
          }).toString(),
        }
      )

      if (!response.ok) {
        const err = await response.text()
        return { success: false, error: `Twilio error: ${err}` }
      }

      const data = (await response.json()) as { sid?: string }
      return { success: true, messageId: data.sid }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
}

// ---------------------------------------------------------------------------
// Factory — returns the correct provider based on available env vars
// ---------------------------------------------------------------------------
export function getSmsProvider(): SmsProvider {
  const msg91Key = process.env.MSG91_API_KEY
  const msg91Sender = process.env.MSG91_SENDER_ID

  const twilioSid = process.env.TWILIO_ACCOUNT_SID
  const twilioToken = process.env.TWILIO_AUTH_TOKEN
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER

  // Build the Twilio instance unconditionally (used as MSG91 fallback)
  const twilio =
    twilioSid && twilioToken && twilioPhone
      ? new TwilioSmsProvider(twilioSid, twilioToken, twilioPhone)
      : new MockSmsProvider()

  if (msg91Key && msg91Sender) {
    return new Msg91SmsProvider(msg91Key, msg91Sender, twilio)
  }

  return new MockSmsProvider()
}
