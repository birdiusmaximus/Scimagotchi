/**
 * Strip em/en/horizontal dashes from companion-facing copy and replace them with
 * natural punctuation. Long dashes read as stylised "AI voice", so the companion
 * never shows them. Ordinary hyphens (-) in words like "self-harm" or "worn-down"
 * are left untouched.
 */
export function stripEmDashes(text: string): string {
  if (!text) return text;
  return text
    .replace(/\s*[—–―‒]\s*/g, ', ') // long dash (optionally spaced) -> comma + space
    .replace(/\s+,/g, ',') // tidy "word ,"
    .replace(/,\s*,/g, ', ') // collapse ", ,"
    .replace(/,\s*([.!?;:])/g, '$1') // ", ." -> "."
    .replace(/,\s*$/g, '') // drop a trailing comma
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Strip C0/C1 control characters that occasionally leak into model output mid-word
 * (e.g. a stray byte inside "That"), keeping ordinary whitespace (tab, newline).
 * These never belong in companion-facing copy. Run before stripEmDashes.
 */
export function stripControlChars(text: string): string {
  if (!text) return text;
  // C0 (except tab \x09 and newline \x0A), DEL, and C1 controls.
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
}
