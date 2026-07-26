import type { Middleware, MiddlewareHandler } from "../types";

/**
 * Contract for the Middleware Pipeline.
 */
export interface PipelineInterface {
    pipe(middleware: Middleware): this;
    through(middlewares: Middleware[]): this;
    then(handler: MiddlewareHandler): this;
    handle(request: Request): Promise<Response>;
}
