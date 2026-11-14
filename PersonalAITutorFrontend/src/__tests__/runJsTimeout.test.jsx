import { describe, it, expect, vi, afterEach } from "vitest";
import { runJs } from "../lib/runJs";

describe("runJs Timeout", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("terminates after 3 seconds and returns timedOut: true", async () => {
        vi.useFakeTimers();

        const promise = runJs("while(true) {}");

        // Advance fake timer past the 3000ms hard limit
        vi.advanceTimersByTime(3000);

        const result = await promise;

        expect(result).toBeDefined();
        expect(result.timedOut).toBe(true);
        expect(result.error).toBeNull();
    });
});
