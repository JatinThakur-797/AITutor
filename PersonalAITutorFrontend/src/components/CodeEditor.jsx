import { Editor } from "@monaco-editor/react";

const CodeEditor = () => {
    return (
        <>
            {/* We pass specific props directly to the Editor component */}
            <Editor
                height="90vh"
                defaultLanguage="java"
                theme="vs-dark"
                defaultValue={`public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`}
            />
        </>
    );
};

export default CodeEditor;