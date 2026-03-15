function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 2000);
}

function sanitizeRoomName(name) {
  if (typeof name !== 'string') return '';
  return name
    .replace(/[<>"'&\\]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 32);
}

module.exports = { sanitizeText, sanitizeRoomName };
