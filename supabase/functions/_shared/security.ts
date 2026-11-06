import type { SupabaseClient } from '@supabase/supabase-js';

export class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Bound the stream itself; Content-Length alone is not trustworthy.
export async function readBody(request: Request, limit = 16384): Promise<string> {
  if (Number(request.headers.get('content-length')) > limit)
    throw new RequestError(413, 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, 'Send a JSON request.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RequestError(413, 'Request is too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
export function jsonObject(raw: string): Record<string, unknown> {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new RequestError(400, 'Send valid JSON.');
  }
  if (!value || Array.isArray(value) || typeof value !== 'object')
    throw new RequestError(400, 'Send a JSON object.');
  return value;
}
export async function allowance(client: SupabaseClient, actor: string, bucket: string) {
  const { data, error } = await client.rpc('consume_api_allowance', {
    p_actor: actor,
    p_bucket: bucket,
  });
  if (error) throw new RequestError(503, 'Request protection is temporarily unavailable.');
  if (data !== true)
    throw new RequestError(429, 'Too many requests. Please try again in a minute.');
}
export async function requireAdminMfa(client: SupabaseClient, token: string, uid: string) {
  const { data, error } = await client.auth.getClaims(token);
  if (error || data?.claims?.sub !== uid)
    throw new RequestError(403, 'Could not verify your administrator session.');
  if (data.claims.aal === 'aal2') return;
  const requirement = await client.rpc('admin_mfa_requirement', { p_actor: uid });
  if (requirement.error || typeof requirement.data !== 'boolean')
    throw new RequestError(503, 'Could not check your administrator security settings.');
  if (requirement.data)
    throw new RequestError(403, 'Verify your authenticator code before managing accounts.');
}
