import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UserDashboard from "../pages/UserDashboard";

vi.mock("../api/pathService", () => ({
    getAllGoals: vi.fn(() => Promise.resolve({ data: [] })),
    getRoadmapDays: vi.fn(() => Promise.resolve({ data: [] })),
}));

describe("Dashboard Empty State", () => {
    it("renders empty state sentence and Create first goal button when goals array is empty", async () => {
        const handleStartNew = vi.fn();

        render(
            <UserDashboard
                onStartNew={handleStartNew}
                onSelectGoal={() => {}}
                onContinueDay={() => {}}
            />
        );

        await waitFor(() => {
            expect(screen.getByText("You have no active learning goals yet.")).toBeDefined();
        });

        const createBtn = screen.getByRole("button", { name: "Create first goal" });
        expect(createBtn).toBeDefined();

        fireEvent.click(createBtn);
        expect(handleStartNew).toHaveBeenCalledTimes(1);
    });
});
