/**
 * Unit tests for CSRF middleware and helpers.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import {
    extractCsrfToken,
    generateCsrfToken,
    isSafeMethod,
    resolveCsrfConfig,
    resolveSessionId,
    verifyCsrf,
    verifyCsrfToken,
} from "../../src/csrf";
import { createMockRequest } from "../setup";
import type { MiddlewareNext } from "../../src/types";

const TEST_SECRET = "test-csrf-secret";
const TEST_COOKIE = "ninots_session";

function testConfig() {
    return resolveCsrfConfig({
        secret: TEST_SECRET,
        sessionCookieName: TEST_COOKIE,
    });
}

function requestWithSession(
    url: string,
    sessionId: string,
    init: RequestInit = {},
): Request {
    const headers = new Headers(init.headers);
    headers.set("Cookie", `${TEST_COOKIE}=${encodeURIComponent(sessionId)}`);
    return createMockRequest(url, { ...init, headers });
}

describe("CSRF helpers", () => {
    describe("isSafeMethod()", () => {
        test("should treat GET, HEAD, and OPTIONS as safe", () => {
            expect(isSafeMethod("GET")).toBe(true);
            expect(isSafeMethod("head")).toBe(true);
            expect(isSafeMethod("OPTIONS")).toBe(true);
        });

        test("should treat POST and PUT as unsafe", () => {
            expect(isSafeMethod("POST")).toBe(false);
            expect(isSafeMethod("PUT")).toBe(false);
        });
    });

    describe("resolveSessionId()", () => {
        test("should reuse an existing session cookie", () => {
            const request = requestWithSession("/contact", "session-123");
            const session = resolveSessionId(request, TEST_COOKIE);

            expect(session.sessionId).toBe("session-123");
            expect(session.isNew).toBe(false);
        });

        test("should create a new session when cookie is missing", () => {
            const request = createMockRequest("/contact");
            const session = resolveSessionId(request, TEST_COOKIE);

            expect(session.sessionId.length).toBeGreaterThan(0);
            expect(session.isNew).toBe(true);
        });
    });

    describe("generateCsrfToken() / verifyCsrfToken()", () => {
        test("should verify a token generated for the same session", () => {
            const config = testConfig();
            const token = generateCsrfToken("session-abc", config);

            expect(verifyCsrfToken(token, "session-abc", config)).toBe(true);
        });

        test("should reject a token signed with a different secret", () => {
            const config = testConfig();
            const token = generateCsrfToken("session-abc", config);

            expect(
                verifyCsrfToken(token, "session-abc", {
                    ...config,
                    secret: "different-secret",
                }),
            ).toBe(false);
            expect(verifyCsrfToken(token, "session-abc", config)).toBe(true);
        });
    });

    describe("extractCsrfToken()", () => {
        test("should read token from form body", async () => {
            const config = testConfig();
            const token = generateCsrfToken("session-abc", config);
            const request = createMockRequest("/contact", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: `_token=${encodeURIComponent(token)}&message=hello`,
            });

            expect(await extractCsrfToken(request, config.tokenFieldName)).toBe(token);
        });

        test("should read token from X-CSRF-TOKEN header", async () => {
            const request = createMockRequest("/contact", {
                method: "POST",
                headers: { "X-CSRF-TOKEN": "header-token" },
            });

            expect(await extractCsrfToken(request, "_token")).toBe("header-token");
        });
    });
});

const okNext: MiddlewareNext = async () => new Response("OK", { status: 200 });

describe("verifyCsrf middleware", () => {
    test("should skip verification for GET requests", async () => {
        const middleware = verifyCsrf({ secret: TEST_SECRET, sessionCookieName: TEST_COOKIE });
        const request = createMockRequest("/contact", { method: "GET" });

        const response = await middleware(request, okNext);

        expect(response.status).toBe(200);
    });

    test("should reject POST without session cookie", async () => {
        const middleware = verifyCsrf({ secret: TEST_SECRET, sessionCookieName: TEST_COOKIE });
        const request = createMockRequest("/contact", { method: "POST" });

        const response = await middleware(request, okNext);

        expect(response.status).toBe(419);
    });

    test("should reject POST without CSRF token", async () => {
        const middleware = verifyCsrf({ secret: TEST_SECRET, sessionCookieName: TEST_COOKIE });
        const request = requestWithSession("/contact", "session-abc", { method: "POST" });

        const response = await middleware(request, okNext);

        expect(response.status).toBe(419);
    });

    test("should accept POST with valid CSRF token", async () => {
        const config = testConfig();
        const sessionId = "session-abc";
        const token = generateCsrfToken(sessionId, config);
        const middleware = verifyCsrf({ secret: TEST_SECRET, sessionCookieName: TEST_COOKIE });
        const request = requestWithSession("/contact", sessionId, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `_token=${encodeURIComponent(token)}&message=hello`,
        });

        const response = await middleware(request, okNext);

        expect(response.status).toBe(200);
    });
});
