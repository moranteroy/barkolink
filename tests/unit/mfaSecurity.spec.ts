import { beforeEach, expect, it, vi } from 'vitest';
import { disableAccountMfa, enableAccountMfa } from '../../src/services/mfaSecurity';
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  listFactors: vi.fn(),
  challengeAndVerify: vi.fn(),
  unenroll: vi.fn(),
  refreshSession: vi.fn(),
}));
vi.mock('../../src/services/supabase', () => ({
  requireSupabase: () => ({
    rpc: mocks.rpc,
    auth: { mfa: mocks, refreshSession: mocks.refreshSession },
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({
    data: { enabled: true, policyRequired: false, mfaRequired: true },
    error: null,
  });
  mocks.listFactors.mockResolvedValue({
    data: { totp: [{ id: 'factor', status: 'verified' }] },
    error: null,
  });
  mocks.challengeAndVerify.mockResolvedValue({ error: null });
  mocks.unenroll.mockResolvedValue({ error: null });
  mocks.refreshSession.mockResolvedValue({ error: null });
});
it.each([true, false])(
  'verifies before toggling to %s without deleting the authenticator',
  async (enabled) => {
    await (enabled ? enableAccountMfa('123456') : disableAccountMfa('123456'));
    expect(mocks.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'factor', code: '123456' });
    expect(mocks.rpc).toHaveBeenLastCalledWith('set_account_mfa_enabled', { p_enabled: enabled });
    expect(mocks.unenroll).not.toHaveBeenCalled();
    expect(mocks.refreshSession).not.toHaveBeenCalled();
    expect(mocks.challengeAndVerify.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.rpc.mock.invocationCallOrder[1],
    );
  },
);
it('rejects policy-required accounts and bad codes without unenrollment', async () => {
  mocks.rpc.mockResolvedValue({ data: { policyRequired: true, mfaRequired: true }, error: null });
  await expect(disableAccountMfa('123456')).rejects.toThrow('administrator requires');
  expect(mocks.challengeAndVerify).not.toHaveBeenCalled();
  await expect(disableAccountMfa('12')).rejects.toThrow('six-digit');
  expect(mocks.unenroll).not.toHaveBeenCalled();
});
it('does not remove factors after a rejected code or a policy change', async () => {
  mocks.challengeAndVerify.mockResolvedValueOnce({ error: new Error('invalid') });
  await expect(disableAccountMfa('123456')).rejects.toThrow('Could not verify');
  expect(mocks.unenroll).not.toHaveBeenCalled();
  mocks.rpc
    .mockResolvedValueOnce({ data: { mfaRequired: true, policyRequired: false }, error: null })
    .mockResolvedValueOnce({
      data: null,
      error: { message: 'Your administrator now requires staff two-factor authentication.' },
    });
  await expect(disableAccountMfa('123456')).rejects.toThrow('now requires');
  expect(mocks.unenroll).not.toHaveBeenCalled();
});
