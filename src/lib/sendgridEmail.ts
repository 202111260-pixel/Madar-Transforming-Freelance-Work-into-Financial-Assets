/**
 * SendGrid / Resend email sender — via backend proxy.
 * Browser → /api/send-email → Node proxy (scripts/api-server.cjs) → Resend or SendGrid v3 API
 *
 * Errors from the server (sendgridErrors[], status codes) are surfaced verbatim
 * so the UI can show the real reason a button "didn't work".
 */

export interface EmailAttachment {
  filename: string;
  contentBase64: string;
  mime: string;
}

export interface SendgridErrorItem {
  message?: string;
  field?: string | null;
  help?: string | null;
}

export interface EmailSendResult {
  sent: boolean;
  simulated: boolean;
  to: string;
  subject: string;
  provider?: 'resend' | 'sendgrid';
  id?: string;
  redirected?: boolean;
  note?: string;
  error?: string;
  sendgridErrors?: SendgridErrorItem[];
  sendgridStatus?: number;
  resendStatus?: number;
  resendError?: string;
  rawStatus?: number;
}

export async function sendEmail({
  to, subject, text, html, attachments,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}): Promise<EmailSendResult> {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, text, html, attachments }),
    });
    const txt = await res.text();
    let data: Record<string, unknown> = {};
    if (txt) { try { data = JSON.parse(txt); } catch { data = { error: txt }; } }

    if (data.sent) {
      return {
        sent: true,
        simulated: false,
        to,
        subject,
        provider: data.provider as EmailSendResult['provider'],
        id: data.id as string | undefined,
        redirected: data.redirected as boolean | undefined,
        note: data.note as string | undefined,
      };
    }

    const sgErrors = Array.isArray(data.sendgridErrors)
      ? (data.sendgridErrors as SendgridErrorItem[])
      : undefined;

    const composedError =
      (data.error as string) ||
      (sgErrors && sgErrors[0] && sgErrors[0].message) ||
      `HTTP ${res.status}`;

    return {
      sent: false,
      simulated: false,
      to,
      subject,
      error: composedError,
      sendgridErrors: sgErrors,
      sendgridStatus: data.sendgridStatus as number | undefined,
      resendStatus: data.resendStatus as number | undefined,
      resendError: data.resendError as string | undefined,
      rawStatus: res.status,
    };
  } catch (err) {
    return {
      sent: false,
      simulated: true,
      to,
      subject,
      error:
        (err as Error).message +
        ' — backend unreachable. Start it with: npm run dev:api  (or:  node scripts/api-server.cjs)',
    };
  }
}

