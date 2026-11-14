import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CodeEditor from "../components/tutor/CodeEditor";

vi.mock("@monaco-editor/react", () => ({
    default: ({ value, onChange }) => (
        <textarea
            data-testid="mock-monaco-editor"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    ),
}));

describe("CodeEditor Storage", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("restores code from localStorage under task:<goalId>:<day> key", () => {
        const storageKey = "task:goal-123:3";
        localStorage.setItem(storageKey, "console.log('restored code');");

        render(
            <CodeEditor
                goalId="goal-123"
                dayNumber={3}
                goal="Learn JavaScript functions"
            />
        );

        const editor = screen.getByTestId("mock-monaco-editor");
        expect(editor.value).toBe("console.log('restored code');");
    });

    it("persists edited code to localStorage under task:<goalId>:<day>", () => {
        const storageKey = "task:goal-999:1";

        render(
            <CodeEditor
                goalId="goal-999"
                dayNumber={1}
                goal="Learn JavaScript variables"
                initialCode="let a = 1;"
            />
        );

        const editor = screen.getByTestId("mock-monaco-editor");
        fireEvent.change(editor, { target: { value: "let a = 42;" } });

        expect(localStorage.getItem(storageKey)).toBe("let a = 42;");
    });
});
