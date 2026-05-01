/**
 * Synergy-AI — API proxy server
 * Handles Twilio SMS + SendGrid email calls server-side (no CORS).
 *
 * Usage:  node scripts/api-server.cjs
 * Port:   3001
 */

const http = require('http');
const https = require('https');

// ── Load .env ──
const fs = require('fs');
const path = require('path');
const envPath = path.resolve(__dirname, '..', '.env');
const envVars = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) {
      // Strip surrounding single or double quotes that editors sometimes add
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      envVars[m[1]] = val;
    }
  });
}
function env(k) { return envVars[k] || process.env[k] || ''; }

const TWILIO_SID   = env('VITE_TWILIO_ACCOUNT_SID') || env('TWILIO_ACCOUNT_SID');
const TWILIO_TOKEN = env('VITE_TWILIO_AUTH_TOKEN') || env('TWILIO_AUTH_TOKEN');
const TWILIO_FROM  = env('VITE_TWILIO_FROM') || env('TWILIO_FROM');
const TWILIO_MSG_SID = env('VITE_TWILIO_MESSAGING_SERVICE_SID') || env('TWILIO_MESSAGING_SERVICE_SID');
const TWILIO_WA_FROM = env('VITE_TWILIO_WHATSAPP_FROM') || env('TWILIO_WHATSAPP_FROM') || 'whatsapp:+14155238886'; // sandbox default
const DEMO_PHONE   = env('VITE_DEMO_PHONE') || env('DEMO_PHONE');
const SENDGRID_KEY = env('VITE_SENDGRID_API_KEY') || env('SENDGRID_API_KEY');
const SENDGRID_FROM = env('VITE_SENDGRID_FROM_EMAIL') || env('SENDGRID_FROM_EMAIL');
const RESEND_KEY = env('VITE_RESEND_API_KEY') || env('RESEND_API_KEY');
const RESEND_FROM = env('VITE_RESEND_FROM_EMAIL') || env('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
const ZENMUX_KEY = env('VITE_ZENMUX_API_KEY');
const ZENMUX_BASE = (env('VITE_ZENMUX_BASE_URL') || 'https://zenmux.ai/api/v1').replace(/^https?:\/\//, '').replace(/\/$/, '');
const PORT = 3001;

// ── Helpers ──

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON (len=' + raw.length + ')')); }
    });
    req.on('error', reject);
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function jsonReply(res, status, data) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function httpsPost(hostname, urlPath, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path: urlPath, method: 'POST', headers }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/** Same as httpsPost but returns the full Buffer (for binary responses like audio). */
function httpsPostBinary(hostname, urlPath, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path: urlPath, method: 'POST', headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        contentType: res.headers['content-type'] || '',
        buffer: Buffer.concat(chunks),
      }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Find the account's SMS-capable number ──

let smsNumber = null;

async function findSmsNumber() {
  return new Promise(resolve => {
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
    const req = https.request({
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json`,
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const nums = JSON.parse(d).incoming_phone_numbers || [];
          const sms = nums.find(n => n.capabilities?.sms);
          resolve(sms ? sms.phone_number : null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

/**
 * Prepare SMS body for actual delivery on Oman/Gulf carriers.
 *
 * Why this is aggressive about Arabic:
 *   Twilio Trial → +1 US numbers → Oman/KSA carriers (Omantel, Ooredoo, STC)
 *   reject Arabic Unicode SMS with error 30044 "Carrier Filtered" — verified
 *   in production logs. Pure ASCII messages from the same trial number deliver
 *   successfully (status: delivered). So we drop to clean English for delivery.
 *
 * The original Arabic body still goes out via Email + WhatsApp Web links;
 * SMS is just the fallback nudge.
 */
function smsBody(longBody) {
  const hasArabic = /[\u0600-\u06FF]/.test(longBody);

  if (!hasArabic) {
    // Pure English — trim to 440 chars (3 GSM segments minus trial prefix)
    return longBody.slice(0, 440);
  }

  // Arabic detected — try to extract amount/currency/days from the body so
  // the recipient still gets the key info in deliverable English.
  const amountMatch = longBody.match(/([\u0660-\u06690-9][\u0660-\u06690-9,\.]*)\s*(SAR|USD|OMR|AED|EUR|EGP|BHD|KWD|QAR|ر\.س|د\.إ|د\.ب|د\.ك|ر\.ع)/i);
  const daysMatch   = longBody.match(/(\d+)\s*(?:days?|يوم|يوما|يومًا)/);

  const amount = amountMatch ? amountMatch[1] : '';
  const currency = amountMatch ? amountMatch[2].replace(/[\u0600-\u06FF\.\u200f]/g, '').toUpperCase() || 'SAR' : '';
  const days = daysMatch ? daysMatch[1] : '';

  let line = 'Synergy-AI: Payment reminder';
  if (amount && currency) line += ` for ${currency} ${amount}`;
  if (days) line += ` (overdue ${days} days)`;
  line += '. Please pay or contact us to arrange a plan. Thank you.';

  return line.slice(0, 440);
}

// ══════════ ROUTES ══════════

async function handleSendMessage(req, res) {
  try {
    const { to, body: msgBody, channel: rawChannel, invoiceRef } = await readBody(req);
    void invoiceRef;
    if (!to || !msgBody) return jsonReply(res, 400, { sent: false, error: 'Missing to or body' });
    if (!TWILIO_SID || !TWILIO_TOKEN) return jsonReply(res, 500, { sent: false, error: 'Twilio env vars missing (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)' });

    const channel = (rawChannel === 'whatsapp') ? 'whatsapp' : 'sms';
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
    const cleanTo = String(to).replace(/^whatsapp:/, '').trim();
    const toNorm = cleanTo.startsWith('+') ? cleanTo : '+' + cleanTo.replace(/^00/, '');

    // ── Build params for chosen channel ──
    let fromValue = '';
    let toValue = toNorm;
    let outBody = msgBody;
    const params = new URLSearchParams();

    if (channel === 'whatsapp') {
      fromValue = TWILIO_WA_FROM.startsWith('whatsapp:') ? TWILIO_WA_FROM : `whatsapp:${TWILIO_WA_FROM}`;
      toValue = `whatsapp:${toNorm}`;
      params.set('From', fromValue);
      params.set('To', toValue);
      params.set('Body', outBody); // WhatsApp supports Unicode/Arabic natively
    } else {
      // SMS — prefer Messaging Service SID, then explicit FROM, then auto-discovered SMS number
      outBody = smsBody(msgBody);
      if (TWILIO_MSG_SID) {
        params.set('MessagingServiceSid', TWILIO_MSG_SID);
        fromValue = `MessagingService:${TWILIO_MSG_SID}`;
      } else {
        if (!TWILIO_FROM && !smsNumber) smsNumber = await findSmsNumber();
        fromValue = TWILIO_FROM || smsNumber;
        if (!fromValue) {
          return jsonReply(res, 500, {
            sent: false,
            error: 'No SMS sender configured. Set TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID, or add an SMS-capable number to the Twilio account.',
          });
        }
        params.set('From', fromValue);
      }
      params.set('To', toValue);
      params.set('Body', outBody);
    }

    const sendOnce = async (formParams) => {
      const r = await httpsPost('api.twilio.com',
        `/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        formParams.toString());
      let parsed = {};
      try { parsed = JSON.parse(r.body); } catch { parsed = { raw: r.body }; }
      return { status: r.status, data: parsed };
    };

    const first = await sendOnce(params);
    if (first.status >= 200 && first.status < 300) {
      console.log(`[OK] ${channel.toUpperCase()} → ${toValue} | SID: ${first.data.sid} | From: ${fromValue}`);
      return jsonReply(res, 200, {
        sent: true,
        sid: first.data.sid,
        channel,
        to: toValue,
        from: fromValue,
      });
    }

    // Twilio Trial: unverified recipient (21608 / 21610) or unsupported region (21408)
    // — retry to verified DEMO_PHONE so demos work even for unverified client numbers.
    const code = first.data.code;
    if ((code === 21608 || code === 21610 || code === 21408) && DEMO_PHONE) {
      const demoNorm = DEMO_PHONE.startsWith('+') ? DEMO_PHONE : '+' + DEMO_PHONE.replace(/^00/, '');
      const retryParams = new URLSearchParams(params);
      retryParams.set('To', channel === 'whatsapp' ? `whatsapp:${demoNorm}` : demoNorm);
      const retry = await sendOnce(retryParams);
      if (retry.status >= 200 && retry.status < 300) {
        console.log(`[OK] ${channel.toUpperCase()} (demo redirect) → ${demoNorm} | Originally: ${toValue} | SID: ${retry.data.sid}`);
        return jsonReply(res, 200, {
          sent: true,
          sid: retry.data.sid,
          channel,
          to: channel === 'whatsapp' ? `whatsapp:${demoNorm}` : demoNorm,
          from: fromValue,
          redirected: true,
          originalTo: toValue,
        });
      }
      console.error(`[FAIL] ${channel} retry: ${retry.data.message} (${retry.data.code})`);
      return jsonReply(res, 400, {
        sent: false,
        error: retry.data.message || `Twilio ${retry.status}`,
        twilioCode: retry.data.code,
        twilioMessage: retry.data.message,
        twilioMoreInfo: retry.data.more_info,
        channel,
      });
    }

    console.error(`[FAIL] ${channel}: ${first.data.message} (${code})`);
    return jsonReply(res, 400, {
      sent: false,
      error: first.data.message || `Twilio ${first.status}`,
      twilioCode: code,
      twilioMessage: first.data.message,
      twilioMoreInfo: first.data.more_info,
      channel,
    });

  } catch (err) {
    console.error('[ERR] send-message:', err.message);
    return jsonReply(res, 500, { sent: false, error: err.message });
  }
}

async function handleSendEmail(req, res) {
  try {
    const { to, subject, text, html, attachments } = await readBody(req);
    if (!to || !subject) return jsonReply(res, 400, { sent: false, error: 'Missing to or subject' });

    // ── Prefer Resend (modern, developer-friendly) ──
    if (RESEND_KEY) {
      const payload = {
        from: `Synergy-AI <${RESEND_FROM}>`,
        to: Array.isArray(to) ? to : [to],
        subject,
        text: text || '',
      };
      if (html) payload.html = html;
      if (attachments && attachments.length) {
        payload.attachments = attachments.map(a => ({
          filename: a.filename,
          content: a.contentBase64,
        }));
      }

      const bodyStr = JSON.stringify(payload);
      const r = await httpsPost('api.resend.com', '/emails', {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      }, bodyStr);

      let d = {};
      try { d = JSON.parse(r.body); } catch { /**/ }

      if (r.status >= 200 && r.status < 300) {
        console.log(`[OK] Resend → ${to} | ID: ${d.id} | Subject: ${subject.slice(0, 40)}`);
        return jsonReply(res, 200, { sent: true, to, subject, id: d.id, provider: 'resend' });
      }

      // Resend free-tier blocks sending to unverified domains (403).
      // Re-send the same email to the owner's inbox so it actually arrives.
      if (r.status === 403 || r.status === 422) {
        const ownerEmail = env('VITE_BANK_EMAIL') || RESEND_FROM;
        const fallbackPayload = Object.assign({}, payload, { to: [ownerEmail] });
        const fb = JSON.stringify(fallbackPayload);
        const fr = await httpsPost('api.resend.com', '/emails', {
          Authorization: `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(fb),
        }, fb);
        let fd = {};
        try { fd = JSON.parse(fr.body); } catch { /**/ }
        if (fr.status >= 200 && fr.status < 300) {
          console.log(`[OK] Resend (owner redirect) → ${ownerEmail} | Originally for: ${to}`);
          return jsonReply(res, 200, { sent: true, to: ownerEmail, subject, id: fd.id, provider: 'resend', redirected: true });
        }
      }

      console.error(`[FAIL] Resend ${r.status}: ${r.body}`);
      return jsonReply(res, r.status || 500, { sent: false, error: d.message || r.body || `HTTP ${r.status}` });
    }

    // ── Fallback to SendGrid if Resend not configured ──
    if (!SENDGRID_KEY || !SENDGRID_FROM) return jsonReply(res, 500, { sent: false, error: 'No email provider configured (set VITE_RESEND_API_KEY or VITE_SENDGRID_API_KEY + VITE_SENDGRID_FROM_EMAIL)' });

    const content = [{ type: 'text/plain', value: text || '' }];
    if (html) content.push({ type: 'text/html', value: html });

    const payload = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: SENDGRID_FROM, name: 'Synergy-AI Treasurer' },
      subject,
      content,
    };

    if (attachments && attachments.length) {
      payload.attachments = attachments.map(a => ({
        content: a.contentBase64,
        filename: a.filename,
        type: a.mime,
        disposition: 'attachment',
      }));
    }

    const bodyStr = JSON.stringify(payload);
    const r = await httpsPost('api.sendgrid.com', '/v3/mail/send', {
      Authorization: `Bearer ${SENDGRID_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
    }, bodyStr);

    if (r.status === 202 || r.status === 200) {
      console.log(`[OK] SendGrid → ${to} | Subject: ${subject.slice(0, 40)}...`);
      return jsonReply(res, 200, { sent: true, to, subject, provider: 'sendgrid' });
    }

    // Parse SendGrid structured errors
    let sgErrors = [];
    let sgRaw = r.body;
    try {
      const parsed = JSON.parse(r.body);
      if (Array.isArray(parsed.errors)) sgErrors = parsed.errors;
    } catch { /* keep raw */ }

    console.error(`[FAIL] SendGrid ${r.status}: ${sgRaw}`);

    // Auto-retry via Resend on auth/forbidden
    if ((r.status === 401 || r.status === 403) && RESEND_KEY) {
      console.log('[INFO] SendGrid auth failed — retrying via Resend');
      const fb = JSON.stringify({
        from: `Synergy-AI <${RESEND_FROM}>`,
        to: Array.isArray(to) ? to : [to],
        subject,
        text: text || '',
        ...(html ? { html } : {}),
        ...(attachments && attachments.length ? {
          attachments: attachments.map(a => ({ filename: a.filename, content: a.contentBase64 })),
        } : {}),
      });
      const fr = await httpsPost('api.resend.com', '/emails', {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(fb),
      }, fb);
      let fd = {};
      try { fd = JSON.parse(fr.body); } catch { /* */ }
      if (fr.status >= 200 && fr.status < 300) {
        console.log(`[OK] Resend (sendgrid-fallback) → ${to} | ID: ${fd.id}`);
        return jsonReply(res, 200, {
          sent: true, to, subject, id: fd.id, provider: 'resend',
          note: 'SendGrid failed auth; delivered via Resend fallback',
        });
      }
      return jsonReply(res, fr.status || 500, {
        sent: false,
        error: fd.message || `SendGrid ${r.status} + Resend ${fr.status}`,
        sendgridErrors: sgErrors,
        sendgridStatus: r.status,
        resendStatus: fr.status,
        resendError: fd.message || fr.body,
      });
    }

    return jsonReply(res, r.status || 500, {
      sent: false,
      error: (sgErrors[0] && sgErrors[0].message) || sgRaw || `HTTP ${r.status}`,
      sendgridErrors: sgErrors,
      sendgridStatus: r.status,
    });

  } catch (err) {
    console.error('[ERR] send-email:', err.message);
    return jsonReply(res, 500, { sent: false, error: err.message });
  }
}

// ── httpsGet helper ──

function httpsGet(hostname, urlPath, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path: urlPath, method: 'GET', headers }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

// ── /api/twilio/verify ──

async function handleTwilioVerify(_req, res) {
  if (!TWILIO_SID || !TWILIO_TOKEN)
    return jsonReply(res, 400, { ok: false, error: 'Twilio credentials missing in .env' });
  try {
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
    const r = await httpsGet(
      'api.twilio.com',
      `/2010-04-01/Accounts/${TWILIO_SID}.json`,
      { Authorization: `Basic ${auth}` }
    );
    const d = JSON.parse(r.body);
    if (r.status === 200)
      return jsonReply(res, 200, {
        ok: true,
        friendlyName: d.friendly_name,
        status: d.status,
        phone: env('VITE_TWILIO_WHATSAPP_FROM') || smsNumber || 'none',
      });
    return jsonReply(res, 400, { ok: false, error: d.message || 'Auth failed' });
  } catch (err) { return jsonReply(res, 500, { ok: false, error: err.message }); }
}

// ── /api/sendgrid/verify ──

async function handleSendGridVerify(_req, res) {
  if (!SENDGRID_KEY)
    return jsonReply(res, 400, { ok: false, error: 'SendGrid key missing in .env' });
  try {
    const r = await httpsGet(
      'api.sendgrid.com', '/v3/user/profile',
      { Authorization: `Bearer ${SENDGRID_KEY}` }
    );
    const d = JSON.parse(r.body);
    if (r.status === 200)
      return jsonReply(res, 200, { ok: true, email: d.email, username: d.username });
    return jsonReply(res, 400, { ok: false, error: 'Invalid API key' });
  } catch (err) { return jsonReply(res, 500, { ok: false, error: err.message }); }
}

// ── /api/proxy-get (allowlisted hosts for external API key verification) ──

const PROXY_ALLOWLIST = [
  // Arab Freelance
  'api.mostaql.com',
  'api.khamsat.com',
  'api.ureed.com',
  'api.salla.dev',
  'www.nabbesh.com',
  // Global Freelance
  'api.upwork.com',
  'api.fiverr.com',
  'www.freelancer.com',
  'www.toptal.com',
  'www.peopleperhour.com',
  'api.guru.com',
  // Creative & Productivity
  'api.figma.com',
  'www.behance.net',
  'api.behance.net',
  'api.medium.com',
  'api.notion.com',
  'api.telegram.org',
  'api.trello.com',
  'api.clickup.com',
  'app.asana.com',
  // Dev & Tech
  'api.github.com',
  'api.vercel.com',
  'api.netlify.com',
  'api.webflow.com',
  // Finance
  'api.stripe.com',
  'api.wise.com',
  'developer.payoneer.com',
  // Google
  'www.googleapis.com',
  'accounts.google.com',
];

async function handleZenmuxTTS(req, res) {
  try {
    const { text, voice, model } = await readBody(req);
    if (!text || typeof text !== 'string') return jsonReply(res, 400, { ok: false, error: 'Missing text' });
    if (!ZENMUX_KEY) return jsonReply(res, 500, { ok: false, error: 'VITE_ZENMUX_API_KEY not set' });

    // Truncate to 4096 chars (OpenAI tts-1 hard limit)
    const safeText = text.slice(0, 4096);

    const payload = JSON.stringify({
      model: model || 'openai/tts-1',
      input: safeText,
      voice: voice || 'onyx',     // onyx = deep, authoritative bank-grade
      response_format: 'mp3',
      speed: 1.0,
    });

    // ZENMUX_BASE looks like 'zenmux.ai/api/v1' — split host + path
    const hostEnd = ZENMUX_BASE.indexOf('/');
    const host = hostEnd === -1 ? ZENMUX_BASE : ZENMUX_BASE.slice(0, hostEnd);
    const basePath = hostEnd === -1 ? '' : ZENMUX_BASE.slice(hostEnd);

    const r = await httpsPostBinary(host, `${basePath}/audio/speech`, {
      Authorization: `Bearer ${ZENMUX_KEY}`,
      'Content-Type': 'application/json',
    }, payload);

    if (r.status >= 200 && r.status < 300 && r.contentType.startsWith('audio/')) {
      console.log(`[OK] Zenmux TTS → ${safeText.length} chars · ${r.buffer.length} bytes`);
      cors(res);
      res.writeHead(200, {
        'Content-Type': r.contentType || 'audio/mpeg',
        'Content-Length': r.buffer.length,
        'Cache-Control': 'no-store',
      });
      return res.end(r.buffer);
    }

    // Error path — body is JSON or text with error
    const errText = r.buffer.toString('utf8').slice(0, 600);
    console.error(`[FAIL] Zenmux TTS ${r.status}: ${errText}`);
    return jsonReply(res, r.status || 500, { ok: false, error: errText || `HTTP ${r.status}` });
  } catch (err) {
    console.error('[ERR] zenmux-tts:', err.message);
    return jsonReply(res, 500, { ok: false, error: err.message });
  }
}

async function handleProxyGet(req, res) {
  try {
    const { url, headers: extra } = await readBody(req);
    if (!url) return jsonReply(res, 400, { ok: false, error: 'Missing url' });
    const parsed = new URL(url);
    if (!PROXY_ALLOWLIST.includes(parsed.hostname))
      return jsonReply(res, 403, { ok: false, error: `Host not in allowlist: ${parsed.hostname}` });
    const r = await httpsGet(
      parsed.hostname,
      parsed.pathname + parsed.search,
      { 'User-Agent': 'SynergyAI/1.0', ...extra }
    );
    return jsonReply(res, 200, { status: r.status, body: r.body });
  } catch (err) { return jsonReply(res, 500, { ok: false, error: err.message }); }
}

// ── /api/proxy-post (webhook / REST endpoint testing) ──

async function handleProxyPost(req, res) {
  try {
    const { url, body: postBody } = await readBody(req);
    if (!url) return jsonReply(res, 400, { ok: false, error: 'Missing url' });
    const parsed = new URL(url);
    const bodyStr = JSON.stringify(postBody || {});
    const r = await httpsPost(
      parsed.hostname,
      parsed.pathname + parsed.search,
      {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'User-Agent': 'SynergyAI-Webhook/1.0',
      },
      bodyStr
    );
    return jsonReply(res, 200, { status: r.status, body: r.body.slice(0, 500) });
  } catch (err) { return jsonReply(res, 500, { ok: false, error: err.message }); }
}

// ── Server ──

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }

  if (req.method === 'POST' && req.url === '/api/send-message')    return handleSendMessage(req, res);
  if (req.method === 'POST' && req.url === '/api/send-email')      return handleSendEmail(req, res);
  if (req.method === 'GET'  && req.url === '/api/twilio/verify')   return handleTwilioVerify(req, res);
  if (req.method === 'GET'  && req.url === '/api/sendgrid/verify') return handleSendGridVerify(req, res);
  if (req.method === 'POST' && req.url === '/api/proxy-get')       return handleProxyGet(req, res);
  if (req.method === 'POST' && req.url === '/api/proxy-post')      return handleProxyPost(req, res);
  if (req.method === 'POST' && req.url === '/api/zenmux-tts')      return handleZenmuxTTS(req, res);
  if (req.url === '/api/health') return jsonReply(res, 200, {
    ok: true,
    twilio: !!(TWILIO_SID && TWILIO_TOKEN),
    twilioFrom: TWILIO_FROM || smsNumber || null,
    twilioMessagingService: !!TWILIO_MSG_SID,
    twilioWhatsappFrom: TWILIO_WA_FROM,
    sendgrid: !!SENDGRID_KEY,
    resend: !!RESEND_KEY,
    sms: smsNumber,
    zenmux: !!ZENMUX_KEY,
    demoPhone: !!DEMO_PHONE,
  });

  jsonReply(res, 404, { error: 'Not found' });
});

server.listen(PORT, async () => {
  smsNumber = await findSmsNumber();
  console.log('');
  console.log('  Synergy-AI API Proxy');
  console.log('  ────────────────────');
  console.log(`  http://localhost:${PORT}`);
  console.log(`  Twilio SMS:  ${smsNumber || 'NOT FOUND'}`);
  console.log(`  Email:       ${RESEND_KEY ? `Resend (${RESEND_FROM})` : (SENDGRID_FROM ? `SendGrid (${SENDGRID_FROM})` : 'NOT SET')}`);
  console.log(`  Zenmux TTS:  ${ZENMUX_KEY ? 'enabled (openai/tts-1)' : 'disabled (VITE_ZENMUX_API_KEY missing)'}`);
  console.log('');
});
