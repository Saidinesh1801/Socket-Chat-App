export function sanitizeText(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 2000);
}

export function sanitizeRoomName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name
    .replace(/[<>"'&\\]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 32);
}
