import mermaid from 'mermaid';
import { useEffect, useRef, useState } from 'react';

mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'strict', // 'strict' is safer for user-facing AI generation
    fontFamily: "'JetBrains Mono', monospace",
});

let mermaidCounter = 0;

function sanitizeMermaid(chart) {
    if (!chart) return '';

    let clean = chart
        // 1. Remove semicolons
        .replace(/;/g, '')
        // 2. Remove unquoted parentheses which crash the Mermaid AST parser
        .replace(/[()]/g, '')
        // 3. Normalize horizontal spaces/tabs ONLY
        .replace(/[ \t]+/g, ' ')
        // 4. Remove trailing spaces at the end of lines
        .replace(/ [ \t]+$/gm, '')
        .trim();

    // Auto-prepend graph TD if no diagram type is declared
    const hasType = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram-v2|stateDiagram|erDiagram|journey|gantt|pie|gitGraph|info|mindmap|timeline)/i.test(clean);
    if (!hasType) {
        clean = "graph TD\n" + clean;
    }

    return clean;
}

export default function MermaidViewer({ chart }) {
    const containerRef = useRef(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!chart || !containerRef.current) return;

        const id = `mermaid-diagram-${++mermaidCounter}`;
        setError(null);

        // Clear previous render to prevent duplication bugs
        containerRef.current.innerHTML = '';

        const renderDiagram = async () => {
            try {
                const cleanChart = sanitizeMermaid(chart);

                // Validate syntax before attempting to render
                await mermaid.parse(cleanChart);

                const { svg } = await mermaid.render(id, cleanChart);
                if (containerRef.current) {
                    containerRef.current.innerHTML = svg;
                }
            } catch (err) {
                console.error('Mermaid render error:', err.message);
                setError('Diagram generation failed due to invalid syntax.');
            }
        };

        renderDiagram();
    }, [chart]);

    if (error) {
        return (
            <div className="my-8 p-5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-center">
                <p className="text-rose-400 text-sm font-semibold mb-2">{error}</p>
                <div className="bg-[#0d0d14] p-4 rounded-lg text-left overflow-x-auto border border-zinc-800">
                    <p className="text-xs text-zinc-500 mb-2 uppercase tracking-widest">Raw Output:</p>
                    <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap">{chart}</pre>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="flex justify-center my-8 p-8 bg-[#0a0a0f] rounded-2xl border border-zinc-800/80 shadow-2xl overflow-x-auto transition-all hover:border-indigo-500/30"
        />
    );
}