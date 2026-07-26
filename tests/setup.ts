/**
 * Test setup for @ninots/middleware.
 *
 * @packageDocumentation
 */

import type { Middleware } from "../src/types";

/**
 * Creates a mock request for testing.
 *
 * @param url - The request URL
 * @param options - Request options
 * @returns A new Request object
 */
export function createMockRequest(url: string = "/test", options: RequestInit = {}): Request {
    const fullUrl = url.startsWith("http") ? url : `http://localhost${url}`;
    return new Request(fullUrl, options);
}

/**
 * Creates a passthrough middleware for testing.
 *
 * @returns A middleware that just calls next
 */
export function createPassthroughMiddleware(): Middleware {
    return async (request, next) => {
        return next(request);
    };
}

/**
 * Creates a middleware that adds a header for testing.
 *
 * @param headerName - The header name to add
 * @param headerValue - The header value to add
 * @returns A middleware that adds a header
 */
export function createHeaderMiddleware(headerName: string, headerValue: string): Middleware {
    return async (request, next) => {
        const response = await next(request);
        const newResponse = new Response(response.body, response);
        newResponse.headers.set(headerName, headerValue);
        return newResponse;
    };
}

/**
 * Creates a middleware that logs to an array for testing.
 *
 * @param log - Array to push log entries to
 * @param name - Name to log
 * @returns A middleware that logs
 */
export function createLoggingMiddleware(log: string[], name: string): Middleware {
    return async (request, next) => {
        log.push(`${name}:before`);
        const response = await next(request);
        log.push(`${name}:after`);
        return response;
    };
}
