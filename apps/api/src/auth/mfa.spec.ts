import { describe, expect, it } from '@jest/globals';
import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateMfaSecret,
  generateRecoveryCodes,
  verifyTotp,
} from './mfa';

describe('MFA security primitives', () => {
  it('encrypts secrets with authenticated encryption', () => {
    process.env.JWT_ACCESS_SECRET =
      'unit-test-secret-with-at-least-32-characters';
    const secret = generateMfaSecret();
    const encrypted = encryptMfaSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptMfaSecret(encrypted)).toBe(secret);
  });

  it('validates a standard TOTP vector with a bounded clock window', () => {
    expect(
      verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 59_000),
    ).toBe(true);
    expect(
      verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '000000', 59_000),
    ).toBe(false);
  });

  it('creates unique recovery codes', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
  });
});
