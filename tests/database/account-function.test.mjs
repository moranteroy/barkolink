import { before, beforeEach, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { edgeTestModule } from './edge-test-module.mjs';

let handler,
  verifiedUser,
  lastCreate,
  creates,
  lastProfile,
  portExists,
  profileFails,
  deletes,
  aal,
  allowed,
  mfaRequired;
const previousDeno = globalThis.Deno;
const previousFactory = globalThis.__barkolinkCreateClient;
describe('Supabase account Edge Function', () => {
  before(async () => {
    globalThis.Deno = {
      env: { get: () => 'test-only' },
      serve: (callback) => {
        handler = callback;
      },
    };
    globalThis.__barkolinkCreateClient = () => ({
      rpc: async (operation) => ({
        data: operation === 'admin_mfa_requirement' ? mfaRequired : allowed,
        error: null,
      }),
      auth: {
        getClaims: async () => ({ data: { claims: { sub: verifiedUser.id, aal } }, error: null }),
        getUser: async (token) => ({
          data: { user: token === 'valid-token' ? verifiedUser : null },
          error: null,
        }),
        admin: {
          deleteUser: async () => {
            deletes++;
            return { error: null };
          },
          createUser: async (input) => {
            creates++;
            lastCreate = input;
            return { data: { user: { id: 'new-user' } }, error: null };
          },
        },
      },
      from: (table) => {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({
            data: portExists ? { id: '76a29980-5c27-4c4b-9ead-cae943202001' } : null,
            error: null,
          }),
          update: (values) => {
            lastProfile = values;
            return query;
          },
          delete: () => query,
          then: (resolve, reject) =>
            Promise.resolve({
              error: table === 'app_user' && profileFails ? { message: 'failed' } : null,
            }).then(resolve, reject),
        };
        return query;
      },
    });
    await import(edgeTestModule('manage-account', '__barkolinkCreateClient'));
  });
  after(() => {
    globalThis.Deno = previousDeno;
    globalThis.__barkolinkCreateClient = previousFactory;
  });
  beforeEach(() => {
    verifiedUser = { id: 'admin-user', app_metadata: { role: 'ADMIN' } };
    aal = 'aal2';
    allowed = true;
    mfaRequired = true;
    lastCreate = null;
    creates = 0;
    lastProfile = null;
    portExists = true;
    profileFails = false;
    deletes = 0;
  });
  const request = (body, token = 'valid-token') =>
    new Request('https://example.com/manage-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  it('rejects missing and invalid authentication', async () => {
    assert.equal((await handler(request({}, null))).status, 401);
    assert.equal((await handler(request({}, 'invalid-token'))).status, 401);
    assert.equal(creates, 0);
  });
  it('requires verified MFA and enforces quota before account creation', async () => {
    aal = 'aal1';
    assert.equal((await handler(request({ action: 'generateTemporaryPassword' }))).status, 403);
    aal = 'aal2';
    allowed = false;
    assert.equal((await handler(request({ action: 'generateTemporaryPassword' }))).status, 429);
    assert.equal(creates, 0);
  });
  it('allows an administrator with 2FA off without skipping request protection', async () => {
    aal = 'aal1';
    mfaRequired = false;
    assert.equal((await handler(request({ action: 'generateTemporaryPassword' }))).status, 200);
    allowed = false;
    assert.equal((await handler(request({ action: 'generateTemporaryPassword' }))).status, 429);
  });
  it('rejects coercible objects, invalid phone numbers and oversized bodies', async () => {
    const input = {
      fullName: 'Valid Name',
      email: 'valid@example.invalid',
      password: 'Password123',
      role: 'TICKETING',
    };
    for (const changed of [
      { fullName: {} },
      { phone: '123' },
      { email: [] },
      { fullName: 'bad\u0001name' },
    ]) {
      assert.equal(
        (await handler(request({ action: 'createManagedUser', input: { ...input, ...changed } })))
          .status,
        400,
      );
    }
    assert.equal((await handler(request({ padding: 'x'.repeat(17000) }))).status, 413);
    assert.equal(creates, 0);
  });
  it('rejects non-admin callers even if they send an ADMIN role', async () => {
    verifiedUser = {
      id: 'passenger',
      app_metadata: { role: 'PASSENGER' },
      user_metadata: { role: 'ADMIN' },
    };
    assert.equal(
      (await handler(request({ action: 'createManagedUser', input: { role: 'ADMIN' } }))).status,
      403,
    );
    assert.equal(creates, 0);
  });
  it('validates managed roles and stores staff permissions in trusted metadata', async () => {
    const input = {
      fullName: 'Ticketing Staff',
      email: 'staff@example.com',
      password: 'Test-password123',
      role: 'ADMIN',
    };
    assert.equal((await handler(request({ action: 'createManagedUser', input }))).status, 400);
    assert.equal(creates, 0);
    const result = await handler(
      request({
        action: 'createManagedUser',
        input: { ...input, role: 'TICKETING' },
      }),
    );
    assert.equal(result.status, 200);
    assert.deepEqual(lastCreate.app_metadata, { role: 'TICKETING' });
    assert.deepEqual(lastCreate.user_metadata, { fullName: 'Ticketing Staff' });
    assert.equal((await result.json()).uid, 'new-user');
    assert.equal(lastProfile, null);
  });
  it('creates staff without a port and leaves assignment to the separate admin action', async () => {
    const input = {
      fullName: 'Boarding Staff',
      email: 'boarding@example.com',
      password: 'Test-password123',
      role: 'BOARDING',
    };
    assert.equal((await handler(request({ action: 'createManagedUser', input }))).status, 200);
    assert.equal(creates, 1);
    assert.equal(lastProfile, null);
    input.assignedPortId = '76a29980-5c27-4c4b-9ead-cae943202001';
    assert.equal((await handler(request({ action: 'createManagedUser', input }))).status, 200);
    assert.equal(lastProfile, null);
    profileFails = true;
    input.phone = '09123456789';
    assert.equal((await handler(request({ action: 'createManagedUser', input }))).status, 500);
    assert.equal(deletes, 1);
  });
  it('generates strong temporary passwords and rejects unknown operations', async () => {
    const result = await handler(request({ action: 'generateTemporaryPassword' }));
    assert.match((await result.json()).password, /^[0-9a-f]{36}$/);
    assert.equal((await handler(request({ action: 'unknown' }))).status, 400);
  });
});
