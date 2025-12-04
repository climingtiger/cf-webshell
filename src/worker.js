export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 根路径: 返回 WebShell 页面
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(HTML, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // Shell API
    if (url.pathname === "/api/shell") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response("Invalid JSON", { status: 400 });
      }

      const cmd = (body.cmd || "").trim();
      const output = await handleCommand(cmd);

      return new Response(output, {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};

/**
 * 伪 Shell 命令处理
 * 支持:
 *  - help
 *  - echo <text>
 *  - curl <url>
 *  - clear (由前端自己清屏，这里只返回约定字符串)
 */
async function handleCommand(cmd) {
  if (!cmd) return "";

  // help
  if (cmd === "help") {
    return [
      "Cloudflare WebShell - pseudo Bash",
      "",
      "可用命令:",
      "  help              显示帮助",
      "  echo <text>       输出文本",
      "  curl <url>        请求指定 URL 并显示响应文本",
      "  clear             清屏 (由前端实现)",
      "",
      "示例:",
      "  echo hello",
      "  curl https://example.com",
    ].join("\n");
  }

  // clear: 前端识别这个特殊标记
  if (cmd === "clear") {
    return "__CLEAR__";
  }

  // echo
  if (cmd.startsWith("echo ")) {
    return cmd.slice(5);
  }

  // curl <url>
  if (cmd.startsWith("curl ")) {
    const url = cmd.slice(5).trim();

    // 简单校验一下 URL
    let target;
    try {
      target = new URL(url);
    } catch (e) {
      return `curl: invalid URL: ${url}`;
    }

    try {
      const resp = await fetch(target.toString(), {
        // 只做 GET 简单请求，防止误操作
        method: "GET",
      });

      const text = await resp.text();
      const statusLine = `# HTTP ${resp.status} ${resp.statusText}`;
      return `${statusLine}\n${text}`;
    } catch (e) {
      return `curl: request failed: ${e.message || e.toString()}`;
    }
  }

  // 未知命令
  return `Command not found: ${cmd}\n输入 'help' 查看可用命令。`;
}

// 页面 HTML (前端 WebShell)
const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>Cloudflare WebShell</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- xterm.js from CDN -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js"></script>

  <style>
    :root {
      color-scheme: dark;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: #0b1020;
      color: #e5e7eb;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    }
    header {
      padding: 10px 14px;
      border-bottom: 1px solid #1f2933;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: radial-gradient(circle at top left, #1f2937, #020617);
    }
    header .title {
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    header .title span.logo {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: #22c55e;
      box-shadow: 0 0 12px rgba(34, 197, 94, 0.8);
    }
    header .subtitle {
      font-size: 12px;
      opacity: 0.7;
    }
    header .actions {
      display: flex;
      gap: 8px;
    }
    header button {
      border-radius: 999px;
      border: 1px solid #4b5563;
      background: #020617;
      color: #e5e7eb;
      padding: 4px 10px;
      font-size: 11px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
    }
    header button:hover {
      background: #111827;
      border-color: #6b7280;
      transform: translateY(-0.5px);
    }
    #terminal-container {
      flex: 1;
      padding: 8px;
      min-height: 0; /* 关键: 防止 flex 子元素被挤压，导致只有半屏 */
    }
    #terminal {
      width: 100%;
      height: 100%;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #1f2933;
      background: radial-gradient(circle at top, #020617, #020617 55%, #020617 60%, #000000);
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.6);
    }
    footer {
      font-size: 11px;
      padding: 4px 12px 6px;
      color: #6b7280;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #020617;
    }
    footer a {
      color: #9ca3af;
      text-decoration: none;
    }
    footer a:hover {
      text-decoration: underline;
    }
    @media (max-width: 640px) {
      header {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }
      header .actions {
        width: 100%;
        justify-content: flex-start;
        flex-wrap: wrap;
      }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="title">
        <span class="logo"></span>
        Cloudflare WebShell
      </div>
      <div class="subtitle">pseudo bash · curl via Cloudflare Workers</div>
    </div>
    <div class="actions">
      <button id="btn-clear">clear</button>
      <button id="btn-help">help</button>
    </div>
  </header>

  <div id="terminal-container">
    <div id="terminal"></div>
  </div>

  <footer>
    <div>输入 <code>help</code> 查看可用命令 · 本质是 JS 仿真 Shell</div>
  </footer>

  <script>
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "Menlo, Monaco, Consolas, 'Courier New', monospace",
      scrollback: 50000,   // 加大滚动缓冲，避免长输出被吃掉
      convertEol: true,    // 正确处理 \\n 换行
      cols: 160,           // 默认列数
      rows: 60,            // 默认行数
      theme: {
        background: "#020617",
        foreground: "#e5e7eb",
        cursor: "#22c55e",
      },
    });

    const promptText = "$ ";
    let currentLine = "";
    let isBusy = false;
    const history = [];
    let historyIndex = -1;

    function writeSlowly(text) {
      // 简单逐行输出
      const lines = text.split("\\n");
      lines.forEach((line, idx) => {
        term.write(line);
        if (idx < lines.length - 1) term.write("\\r\\n");
      });
    }

    function printPrompt() {
      term.write("\\r\\n" + promptText);
      currentLine = "";
    }

    function clearTerminal() {
      term.clear();
      term.write("Cloudflare WebShell (pseudo bash)\\r\\n");
      term.write("输入 'help' 查看可用命令。\\r\\n");
      term.write(promptText);
      currentLine = "";
    }

    async function sendCommand(cmd) {
      if (!cmd.trim()) {
        term.write("\\r\\n");
        printPrompt();
        return;
      }

      isBusy = true;
      history.push(cmd);
      historyIndex = history.length;

      try {
        const res = await fetch("/api/shell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cmd }),
        });

        const text = await res.text();

        if (text === "__CLEAR__") {
          clearTerminal();
        } else {
          term.write("\\r\\n");
          writeSlowly(text);
          printPrompt();
        }
      } catch (e) {
        term.write("\\r\\nError: " + (e.message || e.toString()));
        printPrompt();
      } finally {
        isBusy = false;
      }
    }

    function initTerminal() {
      term.open(document.getElementById("terminal"));
      clearTerminal();

      term.onData(async (data) => {
        if (isBusy) return;

        const code = data.charCodeAt(0);

        // Enter
        if (code === 13) {
          term.write("\\r\\n");
          const cmd = currentLine;
          currentLine = "";
          await sendCommand(cmd);
          return;
        }

        // Backspace
        if (code === 127) {
          if (currentLine.length > 0) {
            currentLine = currentLine.slice(0, -1);
            term.write("\\b \\b");
          }
          return;
        }

        // 上下方向键: 历史记录
        if (data === "\\x1b[A") { // up
          if (history.length && historyIndex > 0) {
            historyIndex--;
            // 清理当前行
            while (currentLine.length > 0) {
              term.write("\\b \\b");
              currentLine = currentLine.slice(0, -1);
            }
            const cmd = history[historyIndex];
            currentLine = cmd;
            term.write(cmd);
          }
          return;
        }
        if (data === "\\x1b[B") { // down
          if (history.length && historyIndex < history.length - 1) {
            historyIndex++;
            // 清理当前行
            while (currentLine.length > 0) {
              term.write("\\b \\b");
              currentLine = currentLine.slice(0, -1);
            }
            const cmd = history[historyIndex];
            currentLine = cmd;
            term.write(cmd);
          } else if (historyIndex >= history.length - 1) {
            // 清空到空行
            historyIndex = history.length;
            while (currentLine.length > 0) {
              term.write("\\b \\b");
              currentLine = currentLine.slice(0, -1);
            }
          }
          return;
        }

        // 其他可打印字符
        if (code >= 32 && code <= 126) {
          currentLine += data;
          term.write(data);
        }
      });

      document.getElementById("btn-clear").addEventListener("click", () => {
        clearTerminal();
      });

      document.getElementById("btn-help").addEventListener("click", () => {
        if (isBusy) return;
        const fakeCmd = "help";
        term.write(fakeCmd);
        sendCommand(fakeCmd);
      });
    }

    window.addEventListener("load", initTerminal);
  </script>
</body>
</html>`;
