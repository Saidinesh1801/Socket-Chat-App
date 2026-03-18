// ── End-to-End Encryption (E2EE) ──
const E2E_PREFIX = '\u{1F512}';

function isE2EEnabled() {
    return localStorage.getItem('chat_e2e') === 'true';
}

function toggleE2E(enabled) {
    localStorage.setItem('chat_e2e', enabled ? 'true' : 'false');
}

function getE2EKey() {
    return localStorage.getItem('chat_e2e_key') || '';
}

function setE2EKey(key) {
    localStorage.setItem('chat_e2e_key', key);
}

async function deriveKey(passphrase) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode('socket-chat-e2e'), iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

function bufToBase64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64) {
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf;
}

async function encryptMessage(plaintext, passphrase) {
    const key = await deriveKey(passphrase);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
    return E2E_PREFIX + JSON.stringify({ iv: bufToBase64(iv), ct: bufToBase64(ct) });
}

async function decryptMessage(ciphertext, passphrase) {
    try {
        const json = JSON.parse(ciphertext.slice(E2E_PREFIX.length));
        const key = await deriveKey(passphrase);
        const iv = base64ToBuf(json.iv);
        const ct = base64ToBuf(json.ct);
        const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
        return new TextDecoder().decode(dec);
    } catch {
        return null;
    }
}

function isEncrypted(text) {
    return text && text.startsWith(E2E_PREFIX);
}
