/**
 * CSRF verification middleware using `Bun.CSRF`.
 *
 * @packageDocumentation
 */

import {
    createCsrfFailureResponse,
    extractCsrfToken,
    getSessionIdFromRequest,
    isSafeMethod,
    resolveCsrfConfig,
    verifyCsrfToken,
} from "./csrf";
import type { CsrfOptions } from "./types";
import type { Middleware } from "../types";

/**
 * Create middleware that verifies CSRF tokens on unsafe HTTP methods.
 *
 * Safe methods (`GET`, `HEAD`, `OPTIONS`) pass through without verification.
 */
export function verifyCsrf(options: CsrfOptions = {}): Middleware {
    const config = resolveCsrfConfig(options);

    return async (request, next) => {
        if (isSafeMethod(request.method)) {
            return next(request);
        }

        const sessionId = getSessionIdFromRequest(request, config.sessionCookieName);
        if (!sessionId) {
            return createCsrfFailureResponse(config);
        }

        const token = await extractCsrfToken(request, config.tokenFieldName);
        if (!token || !verifyCsrfToken(token, sessionId, config)) {
            return createCsrfFailureResponse(config);
        }

        return next(request);
    };
}
