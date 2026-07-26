/**
 * Pipeline class for processing requests through middleware.
 *
 * @packageDocumentation
 */

import type { PipelineInterface } from "./contracts/pipeline-interface";
import type { Middleware, MiddlewareHandler, MiddlewareNext } from "./types";

/**
 * Middleware Pipeline for processing requests through a chain of middleware.
 *
 * Implements the "pipes and filters" pattern, allowing requests to be
 * processed through a series of middleware before reaching a final handler.
 *
 * @example
 * ```typescript
 * const pipeline = new Pipeline();
 *
 * const response = await pipeline
 *   .pipe(authMiddleware)
 *   .pipe(logMiddleware)
 *   .then((request) => new Response('OK'))
 *   .handle(request);
 * ```
 */
export class Pipeline implements PipelineInterface {
    /**
     * Array of middleware to execute.
     */
    private middleware: Middleware[] = [];

    /**
     * The final handler to execute after all middleware.
     */
    private finalHandler: MiddlewareHandler | null = null;

    /**
     * Add a middleware to the pipeline.
     *
     * @param middleware - The middleware to add
     * @returns This pipeline for chaining
     *
     * @example
     * ```typescript
     * pipeline.pipe(authMiddleware).pipe(logMiddleware);
     * ```
     */
    pipe(middleware: Middleware): this {
        this.middleware.push(middleware);
        return this;
    }

    /**
     * Add multiple middleware to the pipeline.
     *
     * @param middlewares - Array of middleware to add
     * @returns This pipeline for chaining
     */
    through(middlewares: Middleware[]): this {
        this.middleware.push(...middlewares);
        return this;
    }

    /**
     * Set the final handler for the pipeline.
     *
     * @param handler - The final handler function
     * @returns This pipeline for chaining
     *
     * @example
     * ```typescript
     * pipeline.then((request) => new Response('OK'));
     * ```
     */

    then(handler: MiddlewareHandler): this {
        this.finalHandler = handler;
        return this;
    }

    /**
     * Process a request through the pipeline.
     *
     * @param request - The request to process
     * @returns The response from the pipeline
     * @throws Error if no final handler is set
     *
     * @example
     * ```typescript
     * const response = await pipeline.handle(request);
     * ```
     */
    async handle(request: Request): Promise<Response> {
        if (!this.finalHandler) {
            throw new Error("Pipeline requires a final handler. Call then() before handle().");
        }

        return this.processMiddleware(request, 0, this.finalHandler);
    }

    /**
     * Recursively process middleware in the chain.
     *
     * @param request - The current request
     * @param index - Current middleware index
     * @param finalHandler - The final handler to call
     * @returns The response from the middleware chain
     */
    private async processMiddleware(
        request: Request,
        index: number,
        finalHandler: MiddlewareHandler,
    ): Promise<Response> {
        const currentMiddleware = this.middleware[index];

        // No more middleware, call final handler
        if (!currentMiddleware) {
            return finalHandler(request);
        }

        // Create next function for this middleware
        const next: MiddlewareNext = (nextRequest: Request) => {
            return this.processMiddleware(nextRequest, index + 1, finalHandler);
        };

        return currentMiddleware(request, next);
    }

    /**
     * Create a new pipeline instance.
     *
     * @returns A new Pipeline instance
     */
    static create(): Pipeline {
        return new Pipeline();
    }
}
