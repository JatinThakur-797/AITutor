import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "../components/system/ErrorBoundary";

function ProblemChild({ shouldThrow }) {
    if (shouldThrow) {
        throw new Error("Simulated component crash");
    }
    return <div>Normal Content</div>;
}

describe("ErrorBoundary", () => {
    it("catches thrown child component and renders fallback card without crashing the app", () => {
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const onResetMock = vi.fn();

        const { rerender } = render(
            <ErrorBoundary onReset={onResetMock}>
                <ProblemChild shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText("Something went wrong")).toBeDefined();
        expect(
            screen.getByText("This section encountered an unexpected error and could not load properly.")
        ).toBeDefined();

        const reloadBtn = screen.getByRole("button", { name: "Reload section" });
        expect(reloadBtn).toBeDefined();

        fireEvent.click(reloadBtn);
        expect(onResetMock).toHaveBeenCalledTimes(1);

        consoleErrorSpy.mockRestore();
    });
});
