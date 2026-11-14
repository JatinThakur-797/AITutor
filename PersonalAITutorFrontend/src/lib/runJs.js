/**
 * Executes JavaScript code safely in a sandboxed iframe.
 * Captures console.log output and errors.
 * Terminates after a 3-second hard timeout.
 *
 * @param {string} code
 * @returns {Promise<{ logs: string[], error: string | null, timedOut: boolean }>}
 */
export function runJs(code) {
    return new Promise((resolve) => {
        let finished = false;
        const logs = [];

        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.setAttribute("sandbox", "allow-scripts");

        const timer = setTimeout(() => {
            if (!finished) {
                finished = true;
                cleanup();
                resolve({ logs, error: null, timedOut: true });
            }
        }, 3000);

        function handleMessage(event) {
            if (!event.data || event.data.source !== "sandbox-eval") return;

            if (event.data.type === "log") {
                logs.push(event.data.message);
            } else if (event.data.type === "error") {
                if (!finished) {
                    finished = true;
                    cleanup();
                    resolve({ logs, error: event.data.message, timedOut: false });
                }
            } else if (event.data.type === "done") {
                if (!finished) {
                    finished = true;
                    cleanup();
                    resolve({ logs, error: null, timedOut: false });
                }
            }
        }

        function cleanup() {
            clearTimeout(timer);
            window.removeEventListener("message", handleMessage);
            if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
            }
        }

        window.addEventListener("message", handleMessage);

        const htmlContent = `<!DOCTYPE html>
<html>
<head>
<script>
(function() {
    console.log = function(...args) {
        window.parent.postMessage({
            source: 'sandbox-eval',
            type: 'log',
            message: args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
        }, '*');
    };

    window.onerror = function(msg) {
        window.parent.postMessage({
            source: 'sandbox-eval',
            type: 'error',
            message: String(msg)
        }, '*');
        return true;
    };

    try {
        ${code}
        window.parent.postMessage({ source: 'sandbox-eval', type: 'done' }, '*');
    } catch (e) {
        window.parent.postMessage({
            source: 'sandbox-eval',
            type: 'error',
            message: e.message || String(e)
        }, '*');
    }
})();
<\/script>
</head>
<body></body>
</html>`;

        document.body.appendChild(iframe);
        iframe.srcdoc = htmlContent;
    });
}
