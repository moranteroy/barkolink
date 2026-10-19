import { requireSupabase } from './supabase';

export type MfaSettings = { role: string; enabled: boolean; authenticatorLinked?: boolean; staffRequired: boolean; policyRequired: boolean; mfaRequired: boolean };
export async function loadMfaSettings(): Promise<MfaSettings> {
  const { data, error } = await requireSupabase().rpc('my_mfa_settings');
  if (error) throw error;
  if (!data || typeof data.mfaRequired !== 'boolean') throw new Error('Could not check two-factor authentication.');
  return data as MfaSettings;
}
export async function setStaffMfaRequired(required: boolean): Promise<MfaSettings> {
  const { data, error } = await requireSupabase().rpc('set_staff_mfa_required', { p_required: required });
  if (error) throw error;
  return data as MfaSettings;
}
export async function activateAccountMfaAfterVerification(): Promise<MfaSettings> {
  const { data, error } = await requireSupabase().rpc('set_account_mfa_enabled', { p_enabled: true });
  if (error) throw error;
  return data as MfaSettings;
}
export async function setAccountMfaEnabled(enabled: boolean, code: string): Promise<MfaSettings> {
  if (!/^\d{6}$/.test(code)) throw new Error('Enter the six-digit authenticator code.');
  const settings = await loadMfaSettings();
  if (!enabled && settings.policyRequired) throw new Error('Your administrator requires staff two-factor authentication.');
  const client = requireSupabase();
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw error;
  const factor = data.totp.find(factor => factor.status === 'verified');
  if (!factor) throw new Error('No linked authenticator was found. Set up your authenticator first.');
  const verification = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (verification.error) throw new Error('Could not verify the code. Check your authenticator and try again.');
  const result = await client.rpc('set_account_mfa_enabled', { p_enabled: enabled });
  if (result.error) throw new Error(result.error.message || 'Could not change two-factor authentication.');
  return result.data as MfaSettings;
}
export const disableAccountMfa = (code: string) => setAccountMfaEnabled(false, code);
export const enableAccountMfa = (code: string) => setAccountMfaEnabled(true, code);
