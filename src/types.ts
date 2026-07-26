/**
 * Type definitions for the Middleware package.
 *
 * @packageDocumentation
 */

/**
 * Next function to call the next middleware in the chain.
 *
 * @param request - The request to pass to the next middleware
 * @returns A Response or Promise of Response
 */
export type MiddlewareNext = (request: Request) => Response | Promise<Response>;

/**
 * Middleware function signature.
 *
 * @param request - The incoming request
 * @param next - Function to call the next middleware
 * @returns A Response or Promise of Response
 *
 * @example
 * ```typescript
 * const authMiddleware: Middleware = async (request, next) => {
 *   const token = request.headers.get('Authorization');
 *   if (!token) {
 *     return new Response('Unauthorized', { status: 401 });
 *   }
 *   return next(request);
 * };
 * ```
 */
export type Middleware = (request: Request, next: MiddlewareNext) => Response | Promise<Response>;

/**
 * Final handler at the end of the middleware chain.
 *
 * @param request - The incoming request
 * @returns A Response or Promise of Response
 */
export type MiddlewareHandler = (request: Request) => Response | Promise<Response>;
