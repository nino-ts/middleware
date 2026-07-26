/**
 * Unit tests for wideEventMiddleware — emit-once in finally.
 *
 * Uses local fakes (zero `@ninots/*` imports).
 *
 * @packageDocumentation
 */

import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { wideEventMiddleware, type WideEventHandle } from "../../src/wide-event/middleware";

const storage = new AsyncLocalStorage<Record<string, unknown>>();

function createWideEvent(init: {
    method: string;
    path: string;
    request_id?: string;
    timestamp?: string;
}): WideEventHandle {
    const fields: Record<string, unknown> = {
        request_id: init.request_id ?? crypto.randomUUID(),
        timestamp: init.timestamp ?? new Date().toISOString(),
        method: init.method,
        path: init.path,
    };

    return {
        fields,
        set(extra: Record<string, unknown>): void {
            Object.assign(fields, extra);
            const store = storage.getStore();
            if (store && store !== fields) {
                Object.assign(store, extra);
            }
        },
        emit(): void {
            void Bun.write(Bun.stdout, `${JSON.stringify(fields)}\n`);
        },
    };
}

function runWithContext<R>(context: Record<string, unknown>, callback: () => R): R {
    return storage.run(context, callback);
}

function enrich(fields: Record<string, unknown>): void {
    const store = storage.getStore();
    if (store) {
        Object.assign(store, fields);
    }
}

function parseWriteCall(writeSpy: ReturnType<typeof spyOn>, index: number): Record<string, unknown> {
    const args = writeSpy.mock.calls[index] as unknown[];
    const payload = args[1];
    if (typeof payload !== "string") {
        throw new Error(`Expected Bun.write string payload at call ${index}`);
    }
    return JSON.parse(payload) as Record<string, unknown>;
}

function assertMinimalFields(line: Record<string, unknown>): void {
    expect(typeof line.request_id).toBe("string");
    expect(typeof line.timestamp).toBe("string");
    expect(typeof line.method).toBe("string");
    expect(typeof line.path).toBe("string");
    expect(typeof line.status_code).toBe("number");
    expect(typeof line.duration_ms).toBe("number");
    expect(line.outcome === "success" || line.outcome === "error").toBe(true);
}

const deps = { createWideEvent, runWithContext };

describe("wideEventMiddleware", () => {
    let writeSpy: ReturnType<typeof spyOn>;

    afterEach(() => {
        writeSpy?.mockRestore();
    });

    test("emits exactly one canonical line on success", async () => {
        writeSpy = spyOn(Bun, "write").mockImplementation(() => Promise.resolve(100));

        const middleware = wideEventMiddleware({
            ...deps,
            requestId: "mw-ok",
            timestamp: "2026-07-16T15:00:00.000Z",
        });
        const request = new Request("http://localhost/hello", { method: "GET" });

        const response = await middleware(request, async () => new Response("ok", { status: 200 }));

        expect(response.status).toBe(200);
        expect(writeSpy).toHaveBeenCalledTimes(1);

        const line = parseWriteCall(writeSpy, 0);
        assertMinimalFields(line);
        expect(line.request_id).toBe("mw-ok");
        expect(line.timestamp).toBe("2026-07-16T15:00:00.000Z");
        expect(line.method).toBe("GET");
        expect(line.path).toBe("/hello");
        expect(line.status_code).toBe(200);
        expect(line.outcome).toBe("success");
        expect(line).not.toHaveProperty("message");
        expect(line).not.toHaveProperty("level");
    });

    test("emits once with error fields when handler throws", async () => {
        writeSpy = spyOn(Bun, "write").mockImplementation(() => Promise.resolve(100));

        const middleware = wideEventMiddleware({
            ...deps,
            requestId: "mw-err",
            timestamp: "2026-07-16T15:00:00.000Z",
        });
        const request = new Request("http://localhost/boom", { method: "POST" });

        await expect(
            middleware(request, async () => {
                throw new TypeError("explode");
            }),
        ).rejects.toThrow("explode");

        expect(writeSpy).toHaveBeenCalledTimes(1);
        const line = parseWriteCall(writeSpy, 0);
        assertMinimalFields(line);
        expect(line.outcome).toBe("error");
        expect(line.status_code).toBe(500);
        expect(line.error).toEqual({ type: "TypeError", message: "explode" });
    });

    test("5xx response is outcome error with HttpError", async () => {
        writeSpy = spyOn(Bun, "write").mockImplementation(() => Promise.resolve(100));

        const middleware = wideEventMiddleware({ ...deps, requestId: "mw-5xx" });
        const request = new Request("http://localhost/down");

        await middleware(request, async () => new Response("fail", { status: 503 }));

        expect(writeSpy).toHaveBeenCalledTimes(1);
        const line = parseWriteCall(writeSpy, 0);
        expect(line.outcome).toBe("error");
        expect(line.status_code).toBe(503);
        expect(line.error).toEqual({ type: "HttpError", message: "HTTP 503" });
    });

    test("handler enrichment via context set appears on the single line", async () => {
        writeSpy = spyOn(Bun, "write").mockImplementation(() => Promise.resolve(100));

        const middleware = wideEventMiddleware({ ...deps, requestId: "mw-enrich" });
        const request = new Request("http://localhost/users");

        await middleware(request, async () => {
            enrich({ user_id: "u-1", action: "list" });
            return new Response("[]", { status: 200 });
        });

        expect(writeSpy).toHaveBeenCalledTimes(1);
        const line = parseWriteCall(writeSpy, 0);
        expect(line.user_id).toBe("u-1");
        expect(line.action).toBe("list");
        expect(line.outcome).toBe("success");
    });
});
