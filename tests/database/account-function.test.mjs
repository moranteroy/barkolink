import { before, beforeEach, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

let handler, verifiedUser, lastCreate, creates;
const previousDeno = globalThis.Deno;
const previousFactory = globalThis.__barkolinkCreateClient;
describe("Supabase account Edge Function", () => {
  before(async () => {
    globalThis.Deno = {
      env: { get: () => "test-only" },
      serve: (callback) => {
        handler = callback;
      },
    };
    globalThis.__barkolinkCreateClient = () => ({
      auth: {
        getUser: async (token) => ({
          data: { user: token === "valid-token" ? verifiedUser : null },
          error: null,
        }),
        admin: {
          createUser: async (input) => {
            creates++;
            lastCreate = input;
            return { data: { user: { id: "new-user" } }, error: null };
          },
        },
      },
    });
    const source = fs
      .readFileSync("supabase/functions/manage-account/index.ts", "utf8")
      .replace(
        /import\s*\{\s*createClient\s*\}\s*from\s*(['"])npm:[^'"]+\1\s*;?/,
        "const createClient = globalThis.__barkolinkCreateClient",
      );
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    });
    await import(
      `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
    );
  });
  after(() => {
    globalThis.Deno = previousDeno;
    globalThis.__barkolinkCreateClient = previousFactory;
  });
  beforeEach(() => {
    verifiedUser = { id: "admin-user", app_metadata: { role: "ADMIN" } };
    lastCreate = null;
    creates = 0;
  });
  const request = (body, token = "valid-token") =>
    new Request("https://example.com/manage-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  it("rejects missing and invalid authentication", async () => {
    assert.equal((await handler(request({}, null))).status, 401);
    assert.equal((await handler(request({}, "invalid-token"))).status, 401);
    assert.equal(creates, 0);
  });
  it("rejects non-admin callers even if they send an ADMIN role", async () => {
    verifiedUser = {
      id: "passenger",
      app_metadata: { role: "PASSENGER" },
      user_metadata: { role: "ADMIN" },
    };
    assert.equal(
      (
        await handler(
          request({ action: "createManagedUser", input: { role: "ADMIN" } }),
        )
      ).status,
      403,
    );
    assert.equal(creates, 0);
  });
  it("validates managed roles and stores staff permissions in trusted metadata", async () => {
    const input = {
      fullName: "Ticketing Staff",
      email: "staff@example.com",
      password: "Test-password123",
      role: "ADMIN",
    };
    assert.equal(
      (await handler(request({ action: "createManagedUser", input }))).status,
      400,
    );
    assert.equal(creates, 0);
    const result = await handler(
      request({
        action: "createManagedUser",
        input: { ...input, role: "TICKETING" },
      }),
    );
    assert.equal(result.status, 200);
    assert.deepEqual(lastCreate.app_metadata, { role: "TICKETING" });
    assert.deepEqual(lastCreate.user_metadata, { fullName: "Ticketing Staff" });
    assert.equal((await result.json()).uid, "new-user");
  });
  it("generates strong temporary passwords and rejects unknown operations", async () => {
    const result = await handler(
      request({ action: "generateTemporaryPassword" }),
    );
    assert.match((await result.json()).password, /^[0-9a-f]{36}$/);
    assert.equal((await handler(request({ action: "unknown" }))).status, 400);
  });
});
