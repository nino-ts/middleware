/**
 * Unit tests for MiddlewareStack.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { MiddlewareStack } from "../../src/middleware-stack";
import { createPassthroughMiddleware } from "../setup";

describe("MiddlewareStack", () => {
    describe("add()", () => {
        test("should add middleware by name", () => {
            const stack = new MiddlewareStack();
            const middleware = createPassthroughMiddleware();

            stack.add("auth", middleware);

            expect(stack.has("auth")).toBe(true);
        });

        test("should return stack for chaining", () => {
            const stack = new MiddlewareStack();

            const result = stack.add("auth", createPassthroughMiddleware());

            expect(result).toBe(stack);
        });
    });

    describe("get()", () => {
        test("should get middleware by name", () => {
            const stack = new MiddlewareStack();
            const middleware = createPassthroughMiddleware();

            stack.add("auth", middleware);

            expect(stack.get("auth")).toBe(middleware);
        });

        test("should return undefined for non-existent middleware", () => {
            const stack = new MiddlewareStack();

            expect(stack.get("unknown")).toBeUndefined();
        });
    });

    describe("has()", () => {
        test("should return true for existing middleware", () => {
            const stack = new MiddlewareStack();
            stack.add("auth", createPassthroughMiddleware());

            expect(stack.has("auth")).toBe(true);
        });

        test("should return true for existing group", () => {
            const stack = new MiddlewareStack();
            stack.alias("web", ["log", "session"]);

            expect(stack.has("web")).toBe(true);
        });

        test("should return false for non-existent middleware", () => {
            const stack = new MiddlewareStack();

            expect(stack.has("unknown")).toBe(false);
        });
    });

    describe("remove()", () => {
        test("should remove middleware", () => {
            const stack = new MiddlewareStack();
            stack.add("auth", createPassthroughMiddleware());

            const result = stack.remove("auth");

            expect(result).toBe(true);
            expect(stack.has("auth")).toBe(false);
        });

        test("should return false for non-existent middleware", () => {
            const stack = new MiddlewareStack();

            expect(stack.remove("unknown")).toBe(false);
        });
    });

    describe("alias()", () => {
        test("should create middleware group", () => {
            const stack = new MiddlewareStack();
            stack.add("log", createPassthroughMiddleware());
            stack.add("session", createPassthroughMiddleware());

            stack.alias("web", ["log", "session"]);

            expect(stack.getGroups()).toContain("web");
        });

        test("should return stack for chaining", () => {
            const stack = new MiddlewareStack();

            const result = stack.alias("web", ["log"]);

            expect(result).toBe(stack);
        });
    });

    describe("resolve()", () => {
        test("should resolve middleware by names", () => {
            const stack = new MiddlewareStack();
            const auth = createPassthroughMiddleware();
            const log = createPassthroughMiddleware();

            stack.add("auth", auth);
            stack.add("log", log);

            const resolved = stack.resolve(["log", "auth"]);

            expect(resolved).toEqual([log, auth]);
        });

        test("should resolve middleware groups", () => {
            const stack = new MiddlewareStack();
            const log = createPassthroughMiddleware();
            const session = createPassthroughMiddleware();

            stack.add("log", log);
            stack.add("session", session);
            stack.alias("web", ["log", "session"]);

            const resolved = stack.resolve(["web"]);

            expect(resolved).toEqual([log, session]);
        });

        test("should resolve nested groups", () => {
            const stack = new MiddlewareStack();
            const log = createPassthroughMiddleware();
            const session = createPassthroughMiddleware();
            const csrf = createPassthroughMiddleware();

            stack.add("log", log);
            stack.add("session", session);
            stack.add("csrf", csrf);
            stack.alias("base", ["log"]);
            stack.alias("web", ["base", "session", "csrf"]);

            const resolved = stack.resolve(["web"]);

            expect(resolved).toEqual([log, session, csrf]);
        });

        test("should throw error for unknown middleware", () => {
            const stack = new MiddlewareStack();

            expect(() => stack.resolve(["unknown"])).toThrow("Middleware not found: unknown");
        });
    });

    describe("getNames()", () => {
        test("should return all middleware names", () => {
            const stack = new MiddlewareStack();
            stack.add("auth", createPassthroughMiddleware());
            stack.add("log", createPassthroughMiddleware());

            const names = stack.getNames();

            expect(names).toContain("auth");
            expect(names).toContain("log");
        });
    });

    describe("getGroups()", () => {
        test("should return all group names", () => {
            const stack = new MiddlewareStack();
            stack.alias("web", ["log"]);
            stack.alias("api", ["throttle"]);

            const groups = stack.getGroups();

            expect(groups).toContain("web");
            expect(groups).toContain("api");
        });
    });

    describe("clear()", () => {
        test("should clear all middleware and groups", () => {
            const stack = new MiddlewareStack();
            stack.add("auth", createPassthroughMiddleware());
            stack.alias("web", ["log"]);

            stack.clear();

            expect(stack.getNames()).toEqual([]);
            expect(stack.getGroups()).toEqual([]);
        });
    });

    describe("edge cases", () => {
        test("should overwrite middleware with duplicate name", () => {
            const stack = new MiddlewareStack();
            const first = createPassthroughMiddleware();
            const second = createPassthroughMiddleware();

            stack.add("auth", first);
            stack.add("auth", second);

            expect(stack.get("auth")).toBe(second);
        });

        test("should resolve empty array", () => {
            const stack = new MiddlewareStack();

            const resolved = stack.resolve([]);

            expect(resolved).toEqual([]);
        });

        test("should detect circular group dependencies", () => {
            const stack = new MiddlewareStack();
            stack.add("log", createPassthroughMiddleware());

            // Create circular reference: web -> api -> web
            stack.alias("web", ["log", "api"]);
            stack.alias("api", ["web"]);

            // Should throw specific circular dependency error
            expect(() => stack.resolve(["web"])).toThrow("Circular dependency detected in middleware group: web");
        });

        test("should handle deep nested groups", () => {
            const stack = new MiddlewareStack();
            const log = createPassthroughMiddleware();
            const auth = createPassthroughMiddleware();

            stack.add("log", log);
            stack.add("auth", auth);
            stack.alias("level1", ["log"]);
            stack.alias("level2", ["level1"]);
            stack.alias("level3", ["level2", "auth"]);

            const resolved = stack.resolve(["level3"]);

            expect(resolved).toEqual([log, auth]);
        });

        test("should not remove groups with remove()", () => {
            const stack = new MiddlewareStack();
            stack.alias("web", ["log"]);

            const result = stack.remove("web");

            expect(result).toBe(false);
            expect(stack.has("web")).toBe(true);
        });

        test("should throw for unknown middleware in group", () => {
            const stack = new MiddlewareStack();
            stack.alias("web", ["unknown"]);

            expect(() => stack.resolve(["web"])).toThrow("Middleware not found: unknown");
        });

        test("should handle mixed middleware and groups in resolve", () => {
            const stack = new MiddlewareStack();
            const log = createPassthroughMiddleware();
            const auth = createPassthroughMiddleware();
            const csrf = createPassthroughMiddleware();

            stack.add("log", log);
            stack.add("auth", auth);
            stack.add("csrf", csrf);
            stack.alias("security", ["auth", "csrf"]);

            const resolved = stack.resolve(["log", "security"]);

            expect(resolved).toEqual([log, auth, csrf]);
        });
    });
});
