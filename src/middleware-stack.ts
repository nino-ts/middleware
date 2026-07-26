/**
 * Middleware Stack for managing named middleware.
 *
 * @packageDocumentation
 */

import type { Middleware } from "./types";

/**
 * Manages a collection of named middleware.
 *
 * Allows registering middleware with names and resolving them by name.
 * Useful for defining middleware once and applying them by name in routes.
 *
 * @example
 * ```typescript
 * const stack = new MiddlewareStack();
 *
 * stack.add('auth', authMiddleware);
 * stack.add('log', logMiddleware);
 * stack.add('admin', adminMiddleware);
 *
 * // Resolve middleware by names
 * const middleware = stack.resolve(['log', 'auth']);
 *
 * // Use middleware aliases
 * stack.alias('web', ['log', 'session', 'csrf']);
 * const webMiddleware = stack.resolve(['web']);
 * ```
 */
export class MiddlewareStack {
    /**
     * Map of middleware by name.
     */
    private middlewares: Map<string, Middleware> = new Map();

    /**
     * Map of middleware group aliases.
     */
    private groups: Map<string, string[]> = new Map();

    /**
     * Register a middleware with a name.
     *
     * @param name - The middleware name
     * @param middleware - The middleware function
     * @returns This stack for chaining
     *
     * @example
     * ```typescript
     * stack.add('auth', async (request, next) => {
     *   // Check authentication
     *   return next(request);
     * });
     * ```
     */
    add(name: string, middleware: Middleware): this {
        this.middlewares.set(name, middleware);
        return this;
    }

    /**
     * Get a middleware by name.
     *
     * @param name - The middleware name
     * @returns The middleware or undefined
     */
    get(name: string): Middleware | undefined {
        return this.middlewares.get(name);
    }

    /**
     * Check if a middleware exists.
     *
     * @param name - The middleware name
     * @returns True if the middleware exists
     */
    has(name: string): boolean {
        return this.middlewares.has(name) || this.groups.has(name);
    }

    /**
     * Remove a middleware by name.
     *
     * @param name - The middleware name
     * @returns True if the middleware was removed
     */
    remove(name: string): boolean {
        return this.middlewares.delete(name);
    }

    /**
     * Create a middleware group alias.
     *
     * @param name - The group name
     * @param middlewareNames - Array of middleware names in the group
     * @returns This stack for chaining
     *
     * @example
     * ```typescript
     * stack.alias('web', ['log', 'session', 'csrf']);
     * stack.alias('api', ['log', 'throttle']);
     * ```
     */
    alias(name: string, middlewareNames: string[]): this {
        this.groups.set(name, middlewareNames);
        return this;
    }

    /**
     * Resolve middleware by names.
     *
     * Expands group aliases and returns the middleware functions.
     *
     * @param names - Array of middleware/group names
     * @returns Array of middleware functions
     * @throws Error if a middleware name is not found
     * @throws Error if circular group dependency is detected
     *
     * @example
     * ```typescript
     * const middleware = stack.resolve(['log', 'auth']);
     * ```
     */
    resolve(names: string[]): Middleware[] {
        return this.resolveWithVisited(names, new Set());
    }

    /**
     * Internal resolve method that tracks visited groups to detect circular dependencies.
     *
     * @param names - Array of middleware/group names
     * @param visited - Set of visited group names
     * @returns Array of middleware functions
     * @throws Error if circular dependency is detected
     */
    private resolveWithVisited(names: string[], visited: Set<string>): Middleware[] {
        const resolved: Middleware[] = [];

        for (const name of names) {
            // Check if it's a group
            const groupNames = this.groups.get(name);
            if (groupNames) {
                // Detect circular dependency
                if (visited.has(name)) {
                    throw new Error(`Circular dependency detected in middleware group: ${name}`);
                }

                // Mark as visited and recursively resolve
                visited.add(name);
                resolved.push(...this.resolveWithVisited(groupNames, visited));
                visited.delete(name); // Remove after resolving to allow sibling groups
                continue;
            }

            // Get individual middleware
            const middleware = this.middlewares.get(name);
            if (!middleware) {
                throw new Error(`Middleware not found: ${name}`);
            }

            resolved.push(middleware);
        }

        return resolved;
    }

    /**
     * Get all registered middleware names.
     *
     * @returns Array of middleware names
     */
    getNames(): string[] {
        return Array.from(this.middlewares.keys());
    }

    /**
     * Get all group names.
     *
     * @returns Array of group names
     */
    getGroups(): string[] {
        return Array.from(this.groups.keys());
    }

    /**
     * Clear all middleware and groups.
     */
    clear(): void {
        this.middlewares.clear();
        this.groups.clear();
    }
}
