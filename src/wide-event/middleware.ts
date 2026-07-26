/**
 * HTTP middleware that emits one Wide Event (canonical log line) per request.
 *
 * Accumulates context during the lifecycle; emits once in `finally`
 * (Logging Sucks / Sprint 9 binding). No multipoint `logger.info` diary.
 *
 * Logger primitives are injected (local contracts) — zero `@ninots/*` deps.
 *
 * @packageDocumentation
 */

import type { Middleware } from "../types";

/**
 * Local duck-typed handle for a request-scoped wide event.
 */
type WideEventHandle = {
    readonly fields: Record<string, unknown>;
    set(fields: Record<string, unknown>): void;
    emit(): void;
};

/**
 * Initial request identity for {@link WideEventMiddlewareDeps.createWideEvent}.
 */
type WideEventInit = {
    method: string;
    path: string;
    request_id?: string;
    timestamp?: string;
};

/**
 * Injected logger-side primitives (typically from `@ninots/logger` in the app).
 */
type WideEventMiddlewareDeps = {
    createWideEvent: (init: WideEventInit) => WideEventHandle;
    runWithContext: <R>(context: Record<string, unknown>, callback: () => R) => R;
};

/**
 * Optional overrides for tests / custom id generation.
 */
type WideEventMiddlewareOptions = WideEventMiddlewareDeps & {
    /**
     * Override request id (default: crypto.randomUUID via createWideEvent).
     */
    requestId?: string;
    /**
     * Override timestamp at start (default: now ISO-8601 via createWideEvent).
     */
    timestamp?: string;
};

/**
 * Create middleware that starts a wide-event context and emits once in `finally`.
 *
 * Happy path: exactly one flat JSON line via injected `emit`.
 * Errors: same emit with `outcome: "error"` and `error.type` / `error.message`.
 */
function wideEventMiddleware(options: WideEventMiddlewareOptions): Middleware {
    const { createWideEvent, runWithContext } = options;

    return async (request, next) => {
        const url = new URL(request.url);
        const event = createWideEvent({
            method: request.method,
            path: url.pathname,
            request_id: options.requestId,
            timestamp: options.timestamp,
        });
        const startedAt = performance.now();

        return runWithContext(event.fields, async () => {
            let response: Response | undefined;
            let thrown: unknown;

            try {
                response = await next(request);
                return response;
            } catch (error: unknown) {
                thrown = error;
                throw error;
            } finally {
                const durationMs = Math.round(performance.now() - startedAt);

                if (thrown !== undefined) {
                    const err = toError(thrown);
                    event.set({
                        status_code: 500,
                        duration_ms: durationMs,
                        outcome: "error",
                        error: {
                            type: err.name,
                            message: err.message,
                        },
                    });
                } else if (response !== undefined) {
                    const statusCode = response.status;
                    const outcome = statusCode >= 500 ? "error" : "success";
                    if (outcome === "error") {
                        event.set({
                            status_code: statusCode,
                            duration_ms: durationMs,
                            outcome,
                            error: {
                                type: "HttpError",
                                message: `HTTP ${statusCode}`,
                            },
                        });
                    } else {
                        event.set({
                            status_code: statusCode,
                            duration_ms: durationMs,
                            outcome,
                        });
                    }
                }

                event.emit();
            }
        });
    };
}

function toError(value: unknown): Error {
    if (value instanceof Error) {
        return value;
    }
    return new Error(String(value));
}

export type { WideEventMiddlewareOptions, WideEventMiddlewareDeps, WideEventHandle, WideEventInit };
export { wideEventMiddleware };
