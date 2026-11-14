import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import ServiceBanner from "../components/system/ServiceBanner";

vi.mock("../../api/axiosClient", () => ({
    default: {
        get: vi.fn(() => Promise.resolve({ status: 200 })),
    },
}));

describe("ServiceBanner", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("appears on 503 service-unavailable event and clears on recovery", async () => {
        const retryMock = vi.fn(() => Promise.resolve());

        render(<ServiceBanner />);

        // Initially health is 200, so banner is hidden
        expect(screen.queryByText(/service is briefly unavailable/i)).toBeNull();

        // Dispatch 503 / unavailable event
        act(() => {
            window.dispatchEvent(
                new CustomEvent("app:service-unavailable", {
                    detail: { service: "user", retry: retryMock },
                })
            );
        });

        // Banner should now be visible
        const bannerText = screen.getByText("The user service is briefly unavailable");
        expect(bannerText).toBeDefined();

        // Retry button should be present
        const retryBtn = screen.getByRole("button", { name: "Retry" });
        expect(retryBtn).toBeDefined();

        // Trigger retry and verify clearance
        await act(async () => {
            fireEvent.click(retryBtn);
        });

        expect(retryMock).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("The user service is briefly unavailable")).toBeNull();
    });
});
