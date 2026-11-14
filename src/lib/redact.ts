// Strips anything that looks like a credential before text reaches a log.
// Pure and dependency-free so middleware (Edge runtime) can use it too.

const PATTERNS: [RegExp, string][] = [
  [/ya29\.[\w.-]+/g, "[access-token]"],
  [/\b1\/\/[\w-]{10,}/g, "[refresh-token]"],
  [/AIza[\w-]{20,}/g, "[api-key]"],
  [/Bearer\s+[\w.~+/-]+=*/gi, "Bearer [redacted]"],
  [/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[jwt]"],
  [
    /\b(key|code|token|access_token|refresh_token|id_token|client_secret)(["']?\s*[=:]\s*["']?)[^&\s"',}]+/gi,
    "$1$2[redacted]",
  ],
];

export function redact(input: unknown): string {
  let text: string;
  if (input instanceof Error) text = `${input.name}: ${input.message}`;
  else if (typeof input === "string") text = input;
  else {
    try {
      text = JSON.stringify(input) ?? String(input);
    } catch {
      text = String(input);
    }
  }
  for (const [pattern, replacement] of PATTERNS) text = text.replace(pattern, replacement);
  return text.length > 2000 ? `${text.slice(0, 2000)}…` : text;
}
