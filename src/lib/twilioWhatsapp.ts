/**
 * Twilio WhatsApp / SMS sender — via backend proxy.
 * Browser → /api/send-message → Node proxy (scripts/api-server.cjs) → Twilio REST API
 *
 * Two channels:
 *   - sendSMS()      → channel='sms'      (regular SMS via TWILIO_FROM / Messaging Service)
 *   - sendWhatsApp() → channel='whatsapp' (uses TWILIO_WHATSAPP_FROM, sandbox by default)
 */

export interface WhatsAppSendResult {
  sent: boolean;
  simulated: boolean;
  sid?: string;
  to: string;
  body: string;
  channel?: 'whatsapp' | 'sms';
  from?: string;
  redirected?: boolean;
  originalTo?: string;
  error?: string;
  twilioCode?: number;
  twilioMessage?: string;
  twilioMoreInfo?: string;
}

function normalizePhone(num: string): string {
  const trimmed = num.trim().replace(/^whatsapp:/, '');
  return trimmed.startsWith('+') ? trimmed : '+' + trimmed.replace(/^00/, '');
}

/** Send via Twilio WhatsApp channel. */
export async function sendWhatsApp(toPhone: string, body: string): Promise<WhatsAppSendResult> {
  return sendMessage(toPhone, body, 'whatsapp');
}

/** Send via Twilio SMS channel (real SMS, not WhatsApp). */
export async function sendSMS(toPhone: string, body: string): Promise<WhatsAppSendResult> {
  return sendMessage(toPhone, body, 'sms');
}

async function sendMessage(
  toPhone: string,
  body: string,
  channel: 'whatsapp' | 'sms',
): Promise<WhatsAppSendResult> {
  const to = normalizePhone(toPhone);

  try {
    const res = await fetch('/api/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, body, channel }),
    });

    const txt = await res.text();
    let data: Record<string, unknown> = {};
    if (txt) {
      try { data = JSON.parse(txt); } catch { data = { error: txt }; }
    }

    if (data.sent) {
      return {
        sent: true,
        simulated: false,
        sid: data.sid as string,
        to: (data.to as string) || to,
        body,
        channel: (data.channel as WhatsAppSendResult['channel']) || channel,
        from: data.from as string | undefined,
        redirected: data.redirected as boolean | undefined,
        originalTo: data.originalTo as string | undefined,
      };
    }

    return {
      sent: false,
      simulated: false,
      to,
      body,
      channel,
      error: (data.error as string) || `Server error ${res.status}`,
      twilioCode: data.twilioCode as number | undefined,
      twilioMessage: data.twilioMessage as string | undefined,
      twilioMoreInfo: data.twilioMoreInfo as string | undefined,
    };
  } catch (err) {
    return {
      sent: false,
      simulated: true,
      to,
      body,
      channel,
      error:
        (err as Error).message +
        ' — backend unreachable. Start it with: npm run dev:api  (or:  node scripts/api-server.cjs)',
    };
  }
}

