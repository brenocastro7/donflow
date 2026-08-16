import { describe, expect, it } from 'vitest';
import { isStrongPassword, passwordStrength } from './password-policy';

describe('password strength', () => {
  it('reports missing requirements for a weak password', () => {
    const result = passwordStrength('password');
    expect(result.label).toBe('Muito fraca');
    expect(result.requirements.length).toBe(false);
    expect(result.requirements.uppercase).toBe(false);
    expect(isStrongPassword('password')).toBe(false);
  });

  it('marks a policy-compliant password as strong', () => {
    const result = passwordStrength('UmaPalavraPasse9!');
    expect(result.label).toBe('Forte');
    expect(Object.values(result.requirements).every(Boolean)).toBe(true);
    expect(isStrongPassword('UmaPalavraPasse9!')).toBe(true);
  });

  it('does not mark a blocked common password as strong', () => {
    const result = passwordStrength('Password123!');
    expect(result.requirements.uncommon).toBe(false);
    expect(result.label).not.toBe('Forte');
  });
});
