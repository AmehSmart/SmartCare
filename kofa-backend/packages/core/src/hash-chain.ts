import { createHash, timingSafeEqual } from 'node:crypto';
import { canonicalJson } from './canonical-json.js';

export const GENESIS_HASH = '0'.repeat(64);

export type ChainEntry = Record<string, unknown> & {
  previousHash: string;
  hash: string;
};

export function calculateChainHash(
  entryWithoutHash: Record<string, unknown>,
  previousHash: string,
): string {
  if (!/^[a-f0-9]{64}$/.test(previousHash)) throw new TypeError('Invalid previous hash');
  return createHash('sha256')
    .update(canonicalJson(entryWithoutHash), 'utf8')
    .update(previousHash, 'ascii')
    .digest('hex');
}

export function verifyChain(entries: readonly ChainEntry[]): {
  valid: boolean;
  checkedCount: number;
  firstBrokenIndex?: number;
  expectedHash?: string;
  actualHash?: string;
} {
  let previousHash = GENESIS_HASH;
  for (const [index, entry] of entries.entries()) {
    const { hash, previousHash: claimedPreviousHash, ...body } = entry;
    const expectedHash = calculateChainHash(
      { ...body, previousHash: claimedPreviousHash },
      claimedPreviousHash,
    );
    const linksMatch = safeHashEqual(claimedPreviousHash, previousHash);
    if (!linksMatch || !safeHashEqual(hash, expectedHash)) {
      return {
        valid: false,
        checkedCount: index,
        firstBrokenIndex: index,
        expectedHash,
        actualHash: hash,
      };
    }
    previousHash = hash;
  }
  return { valid: true, checkedCount: entries.length };
}

function safeHashEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
