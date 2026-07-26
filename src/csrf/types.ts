/**
 * CSRF middleware configuration types.
 *
 * @packageDocumentation
 */

/**
 * Resolved CSRF protection options.
 */
export interface CsrfConfig {
    /** HMAC secret shared across generate/verify. */
    secret: string;
    /** Form field name for the CSRF token. */
    tokenFieldName: string;
    /** Session cookie used to bind tokens to a visitor. */
    sessionCookieName: string;
    /** HTTP status when verification fails. */
    failureStatus: number;
    /** Plain-text body for failed verification. */
    failureMessage: string;
}

/**
 * Options for {@link verifyCsrf} and CSRF helpers.
 */
export interface CsrfOptions {
    secret?: string;
    tokenFieldName?: string;
    sessionCookieName?: string;
    failureStatus?: number;
    failureMessage?: string;
}

/**
 * Result of resolving a web session identifier from a request.
 */
export interface SessionResolution {
    sessionId: string;
    isNew: boolean;
}
