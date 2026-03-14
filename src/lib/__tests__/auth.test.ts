// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";

// Mock server-only so it doesn't throw outside a server environment
vi.mock("server-only", () => ({}));

const mockSet = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();
const mockCookies = vi.fn().mockResolvedValue({ set: mockSet, get: mockGet, delete: mockDelete });
vi.mock("next/headers", () => ({ cookies: mockCookies }));

// Import after mocks are set up
const { createSession, getSession, deleteSession, verifySession } = await import("@/lib/auth");

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

async function makeToken(
  payload: Record<string, unknown>,
  expiresIn = "7d"
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

beforeEach(() => {
  mockSet.mockClear();
  mockGet.mockClear();
  mockDelete.mockClear();
});

test("sets a cookie with the correct name", async () => {
  await createSession("user-1", "test@example.com");

  expect(mockSet).toHaveBeenCalledOnce();
  const [cookieName] = mockSet.mock.calls[0];
  expect(cookieName).toBe("auth-token");
});

test("cookie is httpOnly with lax sameSite and root path", async () => {
  await createSession("user-1", "test@example.com");

  const [, , options] = mockSet.mock.calls[0];
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
});

test("cookie expires approximately 7 days from now", async () => {
  const before = Date.now();
  await createSession("user-1", "test@example.com");
  const after = Date.now();

  const [, , options] = mockSet.mock.calls[0];
  const expiresMs = options.expires.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(expiresMs).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

test("JWT payload contains userId and email", async () => {
  await createSession("user-42", "hello@example.com");

  const [, token] = mockSet.mock.calls[0];
  const { payload } = await jwtVerify(token, JWT_SECRET);

  expect(payload.userId).toBe("user-42");
  expect(payload.email).toBe("hello@example.com");
});

test("JWT is signed with HS256", async () => {
  await createSession("user-1", "test@example.com");

  const [, token] = mockSet.mock.calls[0];
  const header = JSON.parse(atob(token.split(".")[0]));
  expect(header.alg).toBe("HS256");
});

test("JWT expires in approximately 7 days", async () => {
  const before = Math.floor(Date.now() / 1000);
  await createSession("user-1", "test@example.com");
  const after = Math.floor(Date.now() / 1000);

  const [, token] = mockSet.mock.calls[0];
  const { payload } = await jwtVerify(token, JWT_SECRET);

  const sevenDays = 7 * 24 * 60 * 60;
  expect(payload.exp).toBeGreaterThanOrEqual(before + sevenDays - 5);
  expect(payload.exp).toBeLessThanOrEqual(after + sevenDays + 5);
});

// getSession

test("getSession returns null when cookie is absent", async () => {
  mockGet.mockReturnValue(undefined);

  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns null when cookie value is undefined", async () => {
  mockGet.mockReturnValue({ value: undefined });

  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns the session payload for a valid token", async () => {
  const token = await makeToken({ userId: "user-7", email: "a@b.com" });
  mockGet.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session?.userId).toBe("user-7");
  expect(session?.email).toBe("a@b.com");
});

test("getSession returns null for a token signed with the wrong secret", async () => {
  const wrongSecret = new TextEncoder().encode("wrong-secret");
  const token = await new SignJWT({ userId: "x", email: "x@x.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(wrongSecret);
  mockGet.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns null for an expired token", async () => {
  const token = await makeToken({ userId: "user-1", email: "a@b.com" }, "1s");
  // Wait for expiry
  await new Promise((r) => setTimeout(r, 1500));
  mockGet.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns null for a malformed token string", async () => {
  mockGet.mockReturnValue({ value: "not.a.jwt" });

  const session = await getSession();
  expect(session).toBeNull();
});

// deleteSession

test("deleteSession deletes the auth-token cookie", async () => {
  await deleteSession();

  expect(mockDelete).toHaveBeenCalledOnce();
  expect(mockDelete).toHaveBeenCalledWith("auth-token");
});

test("deleteSession only deletes one cookie", async () => {
  await deleteSession();

  expect(mockDelete).toHaveBeenCalledOnce();
});

// verifySession

function makeRequest(token: string | undefined) {
  return { cookies: { get: (_name: string) => (token ? { value: token } : undefined) } } as any;
}

test("verifySession returns null when cookie is absent", async () => {
  const session = await verifySession(makeRequest(undefined));
  expect(session).toBeNull();
});

test("verifySession returns the session payload for a valid token", async () => {
  const token = await makeToken({ userId: "user-9", email: "x@y.com" });
  const session = await verifySession(makeRequest(token));

  expect(session?.userId).toBe("user-9");
  expect(session?.email).toBe("x@y.com");
});

test("verifySession returns null for a token signed with the wrong secret", async () => {
  const wrongSecret = new TextEncoder().encode("wrong-secret");
  const token = await new SignJWT({ userId: "x", email: "x@x.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(wrongSecret);

  const session = await verifySession(makeRequest(token));
  expect(session).toBeNull();
});

test("verifySession returns null for an expired token", async () => {
  const token = await makeToken({ userId: "user-1", email: "a@b.com" }, "1s");
  await new Promise((r) => setTimeout(r, 1500));

  const session = await verifySession(makeRequest(token));
  expect(session).toBeNull();
});

test("verifySession returns null for a malformed token string", async () => {
  const session = await verifySession(makeRequest("not.a.jwt"));
  expect(session).toBeNull();
});
