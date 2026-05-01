const BASE_URL = import.meta.env.VITE_ZENMUX_BASE_URL || 'https://zenmux.ai/api/v1';
const API_KEY  = import.meta.env.VITE_ZENMUX_API_KEY;

export interface CallAgentOptions {
  model: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AgentUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Wall-clock ms spent on the API call. */
  latencyMs: number;
}

export interface CallAgentResult {
  content: string;
  usage: AgentUsage;
}

/**
 * Same as callAgent but returns real token usage + latency from the API.
 * Use this when you need to display verifiable telemetry to the user.
 */
export async function callAgentDetailed(opts: CallAgentOptions): Promise<CallAgentResult> {
  const t0 = performance.now();
  const isReasoningModel = /^(openai\/(gpt-5|o[1-9])|deepseek\/deepseek-r1)/.test(opts.model);
  const tokenBudget = opts.maxTokens ?? 4096;

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user',   content: opts.userMessage  },
      ],
      ...(isReasoningModel
        ? { max_completion_tokens: tokenBudget }
        : { max_tokens: tokenBudget }),
      temperature: opts.temperature ?? 0.3,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Zenmux ${res.status}: ${txt}`);
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  const finishReason = data.choices?.[0]?.finish_reason;
  const rawContent  = msg?.content  || null;
  const rawReasoning = msg?.reasoning || null;
  const content = rawContent ?? rawReasoning ?? null;

  if (content == null) {
    console.error('[zenmux] Full API response:', JSON.stringify(data, null, 2));
    throw new Error(`Model returned empty content â€” increase token budget`);
  }

  const finalContent = rawContent || rawReasoning!;
  if (finishReason === 'length') {
    console.warn(`[zenmux] Response truncated (finish_reason=length) for ${opts.model}`);
  }

  const u = data.usage || {};
  const usage: AgentUsage = {
    promptTokens: u.prompt_tokens ?? u.input_tokens ?? 0,
    completionTokens: u.completion_tokens ?? u.output_tokens ?? 0,
    totalTokens: u.total_tokens ?? ((u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0)),
    latencyMs: Math.round(performance.now() - t0),
  };
  return { content: finalContent, usage };
}

export async function callAgent(
  modelOrOpts: string | CallAgentOptions,
  systemPrompt?: string,
  userMessage?: string,
): Promise<string> {
  const opts: CallAgentOptions =
    typeof modelOrOpts === 'string'
      ? { model: modelOrOpts, systemPrompt: systemPrompt!, userMessage: userMessage! }
      : modelOrOpts;

  // Reasoning models (DeepSeek R1, o-series) need max_completion_tokens
  const isReasoningModel = /^(openai\/(gpt-5|o[1-9])|deepseek\/deepseek-r1)/.test(opts.model);
  const tokenBudget = opts.maxTokens ?? 4096;

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user',   content: opts.userMessage  },
      ],
      ...(isReasoningModel
        ? { max_completion_tokens: tokenBudget }
        : { max_tokens: tokenBudget }),
      temperature: opts.temperature ?? 0.3,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Zenmux ${res.status}: ${txt}`);
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  const finishReason = data.choices?.[0]?.finish_reason;

  // Reasoning models (DeepSeek R1) return content="" and put the actual
  // answer in `reasoning`.  We need to handle empty-string content too.
  const rawContent  = msg?.content  || null;   // "" â†’ null
  const rawReasoning = msg?.reasoning || null;  // "" â†’ null
  const content = rawContent ?? rawReasoning ?? null;

  if (content == null) {
    console.error('[zenmux] Full API response:', JSON.stringify(data, null, 2));
    throw new Error(`Model returned empty content â€” increase token budget`);
  }

  // For reasoning models: if content was empty but reasoning has the data,
  // try to extract JSON from the reasoning text (the actual answer is often
  // embedded at the end of the reasoning chain).
  const finalContent = rawContent || rawReasoning!;

  // Warn in console if truncated (still attempt parse â€” repairJSON may fix it)
  if (finishReason === 'length') {
    console.warn(`[zenmux] Response truncated (finish_reason=length) for ${opts.model}`);
  }
  return finalContent;
}

/** Attempt to repair truncated JSON (close open strings, arrays, objects) */
function repairJSON(s: string): string {
  let str = s.trim();

  // Count unmatched quotes â€” if odd, the last string is unterminated
  const quoteCount = (str.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) str += '"';

  // Close any unclosed brackets / braces
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of str) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }

  // Remove trailing comma before closing
  str = str.replace(/,\s*$/, '');

  // Append missing closers
  while (stack.length) str += stack.pop();
  return str;
}

/** Strip markdown code fences then parse JSON, with auto-repair for truncated responses */
export function parseAgentJSON<T = unknown>(raw: string): T {
  if (!raw || !raw.trim()) throw new Error('Empty response from model');

  // Step 1: Strip markdown code fences
  let cleaned = raw
    .replace(/^```json\s*/m, '')
    .replace(/^```\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim();

  // Step 2: Direct parse
  try {
    return JSON.parse(cleaned) as T;
  } catch { /* fallthrough */ }

  // Step 3: Extract the LAST complete JSON object from the text.
  // For reasoning models (DeepSeek R1), the chain-of-thought may contain
  // many small JSON snippets; the real answer is usually the last big one.
  // Strategy: find all top-level `{...}` candidates, try parsing from the
  // largest / last one first.
  const candidates: string[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') { if (depth === 0) start = i; depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        candidates.push(cleaned.slice(start, i + 1));
        start = -1;
      }
    }
  }

  // Try candidates from LAST to FIRST (real answer is usually last)
  for (let i = candidates.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(candidates[i]) as T;
    } catch { /* try next */ }
  }

  // Step 4: If no clean parse, try repair on the largest candidate
  if (candidates.length > 0) {
    // Pick the largest candidate (most likely the full JSON)
    const largest = candidates.reduce((a, b) => a.length > b.length ? a : b);
    const repaired = repairJSON(largest);
    try {
      return JSON.parse(repaired) as T;
    } catch { /* fallthrough */ }
  }

  // Step 5: Fallback â€” first `{` to last `}` with repair
  const objStart = cleaned.indexOf('{');
  const objEnd = cleaned.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) {
    const extracted = cleaned.slice(objStart, objEnd + 1);
    const repaired = repairJSON(extracted);
    try {
      return JSON.parse(repaired) as T;
    } catch { /* fallthrough */ }
  }

  // Step 6: Last resort â€” repair the whole cleaned string
  const repaired = repairJSON(cleaned);
  return JSON.parse(repaired) as T;
}


// ????????????????????????????????????????????????????????????
//  Zenmux TTS — real audio synthesis via /audio/speech
//  Goes through the local Node proxy (api-server.cjs) so the
//  Zenmux key never reaches the browser.
// ????????????????????????????????????????????????????????????

export interface TTSOptions {
  text: string;
  /** OpenAI voice id routed through Zenmux: alloy | echo | fable | onyx | nova | shimmer */
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  /** Override the model id (default openai/tts-1). */
  model?: string;
}

export interface TTSResult {
  /** Object URL pointing at the playable audio Blob. Caller must revokeObjectURL when done. */
  url: string;
  /** Raw audio bytes. */
  blob: Blob;
  /** Round-trip latency in ms. */
  latencyMs: number;
}

/**
 * Synthesize speech through the Zenmux router (`openai/tts-1` by default).
 * Returns an object URL ready to plug into `<audio src=...>` or `new Audio(url).play()`.
 */
export async function synthesizeSpeech(opts: TTSOptions): Promise<TTSResult> {
  const t0 = performance.now();
  const res = await fetch('/api/zenmux-tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: opts.text,
      voice: opts.voice ?? 'onyx',
      model: opts.model ?? 'openai/tts-1',
    }),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.error || msg; } catch { /**/ }
    throw new Error(`Zenmux TTS: ${msg}`);
  }

  const blob = await res.blob();
  return {
    url: URL.createObjectURL(blob),
    blob,
    latencyMs: Math.round(performance.now() - t0),
  };
}
