const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const phonePattern =
  /(?:\+|00)\d{1,3}[\s.-]?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}|\b\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g;
const longNumberPattern = /\b\d{12,}\b/g;

export function redactPII(text: string): string {
  return text
    .replace(emailPattern, "[REDACTED_EMAIL]")
    .replace(phonePattern, "[REDACTED_PHONE]")
    .replace(longNumberPattern, "[REDACTED_LONG_NUMBER]");
}

export function redactBeforeAI(text: string): string {
  return redactPII(text);
}
