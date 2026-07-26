/**
 * CSRF token helpers built on `Bun.CSRF`.
 *
 * @packageDocumentation
 */

import type { CsrfConfig, CsrfOptions, SessionResolution } from "./types";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const DEFAULT_TOKEN_FIELD = "_token";
const DEFAULT_SESSION_COOKIE = "ninots_session";
const DEFAULT_FAILURE_STATUS = 419;
const DEFAULT_FAILURE_MESSAGE = "CSRF token mismatch.";

/**
 * Resolve CSRF options with defaults.
 */
export function resolveCsrfConfig(options: CsrfOptions = {}): CsrfConfig {
    const secret = options.secret ?? Bun.env.CSRF_SECRET;
    if (!secret) {
        throw new Error("CSRF secret is required. Set CSRF_SECRET or pass secret in options.");
    }

    return {
        secret,
        tokenFieldName: options.tokenFieldName ?? DEFAULT_TOKEN_FIELD,
        sessionCookieName: options.sessionCookieName ?? DEFAULT_SESSION_COOKIE,
        failureStatus: options.failureStatus ?? DEFAULT_FAILURE_STATUS,
        failureMessage: options.failureMessage ?? DEFAULT_FAILURE_MESSAGE,
    };
}

/**
 * Whether the HTTP method skips CSRF verification.
 */
export function isSafeMethod(method: string): boolean {
    return SAFE_METHODS.has(method.toUpperCase());
}

/**
 * Parse cookies from a Request `Cookie` header.
 */
export function parseRequestCookies(request: Request): Record<string, string> {
    const cookieHeader = request.headers.get("Cookie");
    if (!cookieHeader) {
        return {};
    }

    const cookies: Record<string, string> = {};
    for (const part of cookieHeader.split(";")) {
        const trimmed = part.trim();
        if (!trimmed) {
            continue;
        }

        const separator = trimmed.indexOf("=");
        if (separator === -1) {
            continue;
        }

        const name = trimmed.slice(0, separator).trim();
        const value = trimmed.slice(separator + 1).trim();
        if (name) {
            cookies[name] = decodeURIComponent(value);
        }
    }

    return cookies;
}

/**
 * Read the session identifier from the configured session cookie.
 */
export function getSessionIdFromRequest(request: Request, sessionCookieName: string): string | undefined {
    return parseRequestCookies(request)[sessionCookieName];
}

/**
 * Resolve an existing session id or create a new one for token binding.
 */
export function resolveSessionId(request: Request, sessionCookieName: string): SessionResolution {
    const existing = getSessionIdFromRequest(request, sessionCookieName);
    if (existing) {
        return { sessionId: existing, isNew: false };
    }

    return { sessionId: crypto.randomUUID(), isNew: true };
}

/**
 * Format a `Set-Cookie` header value for the web session.
 */
export function formatSessionCookie(sessionId: string, sessionCookieName: string): string {
    return `${sessionCookieName}=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Lax; Path=/`;
}

/**
 * Generate a CSRF token bound to the given session.
 */
export function generateCsrfToken(sessionId: string, config: CsrfConfig): string {
    return Bun.CSRF.generate(getSessionSecret(sessionId, config));
}

/**
 * Verify a CSRF token for the given session.
 */
export function verifyCsrfToken(token: string, sessionId: string, config: CsrfConfig): boolean {
    return Bun.CSRF.verify(token, { secret: getSessionSecret(sessionId, config) });
}

function getSessionSecret(sessionId: string, config: CsrfConfig): string {
    return `${config.secret}:${sessionId}`;
}

/**
 * Extract a CSRF token from headers or form body without consuming the original request body.
 */
export async function extractCsrfToken(request: Request, tokenFieldName: string): Promise<string | undefined> {
    const headerToken = request.headers.get("X-CSRF-TOKEN");
    if (headerToken) {
        return headerToken;
    }

    const contentType = request.headers.get("Content-Type") ?? "";
    if (
        !contentType.includes("application/x-www-form-urlencoded") &&
        !contentType.includes("multipart/form-data")
    ) {
        return undefined;
    }

    const formData = await request.clone().formData();
    const value = formData.get(tokenFieldName);
    return typeof value === "string" ? value : undefined;
}

/**
 * Build a failure response for invalid CSRF tokens.
 */
export function createCsrfFailureResponse(config: CsrfConfig): Response {
    return new Response(config.failureMessage, { status: config.failureStatus });
}

/**
 * Append the session cookie to an existing response when a new session was created.
 */
export function withSessionCookie(
    response: Response,
    session: SessionResolution,
    sessionCookieName: string,
): Response {
    if (!session.isNew) {
        return response;
    }

    const headers = new Headers(response.headers);
    headers.append("Set-Cookie", formatSessionCookie(session.sessionId, sessionCookieName));

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}
