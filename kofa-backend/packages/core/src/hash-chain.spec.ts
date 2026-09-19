import { describe, expect, it } from 'vitest';
import { calculateChainHash, GENESIS_HASH, verifyChain } from './hash-chain.js';

describe('hash chain', () => {
  it('detects the first changed entry', () => {
    const firstBody = { sequence: '1', action: 'READ', previousHash: GENESIS_HASH };
    const first = { ...firstBody, hash: calculateChainHash(firstBody, GENESIS_HASH) };
    const secondBody = { sequence: '2', action: 'DENY', previousHash: first.hash };
    const second = { ...secondBody, hash: calculateChainHash(secondBody, first.hash) };
    expect(verifyChain([first, second])).toEqual({ valid: true, checkedCount: 2 });
    expect(verifyChain([first, { ...second, action: 'GRANT' }])).toMatchObject({
      valid: false,
      firstBrokenIndex: 1,
    });
  });
});
