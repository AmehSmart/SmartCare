const STORAGE_KEY = "smartcare-totp-enrollments";
const LEGACY_STORAGE_KEY = "kofa-totp-enrollments";
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// BACKEND INTEGRATION:
// Replace this browser-only enrollment store with server-side TOTP enrollment,
// secret storage, and verification. Never persist TOTP secrets in browser storage in production.
export function getTotpEnrollment(staffId) {
  const enrollments = readEnrollments();
  const enrollment = enrollments[staffId];
  return enrollment ? { ...enrollment } : null;
}

export function createTotpEnrollment({ staffId, accountName }) {
  if (!staffId || !accountName) {
    throw new Error("A staff account is required to set up TOTP.");
  }

  const existing = getTotpEnrollment(staffId);
  if (existing?.enabled) {
    return existing;
  }

  const secret = encodeBase32(randomBytes(20));
  const enrollment = {
    staffId,
    secret,
    accountName,
    issuer: "SmartCare",
    enabled: false,
    createdAt: new Date().toISOString(),
  };

  saveEnrollment(staffId, enrollment);
  return enrollment;
}

export async function verifyTotpEnrollment({ staffId, secret, code }) {
  const cleanCode = String(code ?? "").replace(/\D/g, "");
  if (!staffId || !secret || cleanCode.length !== 6) {
    throw new Error("Enter the 6-digit code from your authenticator.");
  }

  const currentCounter = Math.floor(Date.now() / 1000 / 30);
  for (let offset = -1; offset <= 1; offset += 1) {
    const expected = await generateTotp(secret, currentCounter + offset);
    if (expected === cleanCode) {
      const enrollment = {
        ...(getTotpEnrollment(staffId) || {}),
        staffId,
        secret,
        enabled: true,
        verifiedAt: new Date().toISOString(),
      };
      saveEnrollment(staffId, enrollment);
      return enrollment;
    }
  }

  throw new Error("That verification code is invalid or expired.");
}

export function disableTotpEnrollment(staffId) {
  if (!staffId) {
    throw new Error("A staff account is required.");
  }

  const current = getTotpEnrollment(staffId);
  if (!current) return null;

  const disabled = { ...current, enabled: false, disabledAt: new Date().toISOString() };
  saveEnrollment(staffId, disabled);
  return disabled;
}

export function buildTotpUri({ secret, accountName, issuer = "SmartCare" }) {
  const account = encodeURIComponent(`${issuer}:${accountName}`);
  return `otpauth://totp/${account}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

async function generateTotp(secret, counter) {
  const keyBytes = decodeBase32(secret);
  const data = new ArrayBuffer(8);
  const view = new DataView(data);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  view.setUint32(0, high);
  view.setUint32(4, low);

  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
  const offset = signature[signature.length - 1] & 0x0f;
  const binary = ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff);

  return String(binary % 1000000).padStart(6, "0");
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function encodeBase32(bytes) {
  let output = "";
  let buffer = 0;
  let bits = 0;

  bytes.forEach((byte) => {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  });

  if (bits > 0) {
    output += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  }

  return output;
}

function decodeBase32(value) {
  const normalized = String(value).toUpperCase().replace(/[^A-Z2-7]/g, "");
  const bytes = [];
  let buffer = 0;
  let bits = 0;

  for (const character of normalized) {
    buffer = (buffer << 5) | BASE32_ALPHABET.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

function readEnrollments() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveEnrollment(staffId, enrollment) {
  const enrollments = readEnrollments();
  enrollments[staffId] = enrollment;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(enrollments));
}
