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
