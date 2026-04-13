const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(process.env.REPO_READER_ROOT || process.cwd());
const DEFAULT_PATH = fs.existsSync(path.join(ROOT, "docs")) ? "docs" : "";

function toPosixPath(value) {
    return String(value || "").replace(/\\/g, "/");
}

function resolveWithinRoot(relativePath = "") {
    const safeRelativePath = toPosixPath(relativePath);
    const absolutePath = path.resolve(ROOT, safeRelativePath || ".");
    const relativeToRoot = path.relative(ROOT, absolutePath);

    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
        throw new Error("Percorso non valido");
    }

    return absolutePath;
}

function isVisibleEntry(entry) {
    const lowerName = entry.name.toLowerCase();
    const extension = path.extname(entry.name).toLowerCase();
    const visibleDotFiles = new Set([
        ".gitignore",
        ".gitattributes",
        ".editorconfig",
        ".npmrc",
        ".nvmrc",
        ".prettierrc",
        ".prettierignore",
        ".eslintrc",
        ".eslintignore",
        ".stylelintrc",
        ".dockerignore",
        ".lintstagedrc",
        ".commitlintrc",
    ]);
    const visiblePlainNames = new Set([
        "readme",
        "license",
        "changelog",
        "contributing",
        "code_of_conduct",
        "security",
        "codeowners",
        "makefile",
        "gnumakefile",
        "procfile",
        "jenkinsfile",
        "gemfile",
        "rakefile",
    ]);

    if (entry.name.startsWith(".")) {
        if (entry.isDirectory()) {
            return false;
        }

        if (lowerName.startsWith(".env")) {
            return true;
        }

        if (visibleDotFiles.has(lowerName)) {
            return true;
        }
    }

    if (lowerName.startsWith("dockerfile")) {
        return true;
    }

    if (!extension && visiblePlainNames.has(lowerName)) {
        return true;
    }

    if (entry.isDirectory()) {
        return true;
    }

    return [
        ".md",
        ".mdx",
        ".txt",
        ".json",
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".css",
        ".html",
        ".yml",
        ".yaml",
        ".xml",
        ".ini",
        ".toml",
        ".csv",
        ".env",
        ".example",
        ".lock",
        ".log",
        ".conf",
        ".properties",
        ".sh",
        ".bat",
        ".cmd",
        ".ps1",
    ].includes(extension);
}

function listDirectory(relativePath = "") {
    const absolutePath = resolveWithinRoot(relativePath);
    const items = fs.readdirSync(absolutePath, { withFileTypes: true })
        .filter(isVisibleEntry)
        .sort((left, right) => {
            if (left.isDirectory() !== right.isDirectory()) {
                return left.isDirectory() ? -1 : 1;
            }

            return left.name.localeCompare(right.name, "it", { sensitivity: "base" });
        })
        .map(entry => {
            const itemPath = toPosixPath(path.join(relativePath, entry.name));
            const extension = path.extname(entry.name).toLowerCase();

            return {
                name: entry.name,
                path: itemPath,
                type: entry.isDirectory() ? "dir" : "file",
                extension,
                isMarkdown: [".md", ".mdx"].includes(extension),
            };
        });

    const normalizedPath = toPosixPath(relativePath);
    const parent = normalizedPath ? toPosixPath(path.posix.dirname(normalizedPath)) : null;

    return {
        current: normalizedPath,
        parent: parent === "." ? "" : parent,
        items,
    };
}

function readTextFile(relativePath) {
    const absolutePath = resolveWithinRoot(relativePath);
    return fs.readFileSync(absolutePath, "utf8");
}

function writeTextFile(relativePath, content) {
    const absolutePath = resolveWithinRoot(relativePath);
    fs.writeFileSync(absolutePath, content, "utf8");
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function sanitizeFileName(value) {
    return String(value || "documento")
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[. ]+$/g, "") || "documento";
}

function formatTimestamp(date = new Date()) {
    return new Intl.DateTimeFormat("it-IT", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function buildPrintableHtml(snapshot = {}) {
    const title = escapeHtml(snapshot.title || "Documento");
    const sourcePath = escapeHtml(snapshot.sourcePath || "");
    const documentKind = escapeHtml(snapshot.documentKind || "Documento");
    const modeLabel = escapeHtml(snapshot.mode === "edit" ? "Modifica" : "Visualizzazione");
    const generatedAt = escapeHtml(formatTimestamp());
    const contentHtml = snapshot.html || '<p class="print-empty">Nessun contenuto disponibile.</p>';

    return `<!doctype html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        :root {
            color-scheme: light;
            --page-bg: #eef1f6;
            --page-surface: #ffffff;
            --page-border: #e4e7ec;
            --page-text: #1f2937;
            --page-muted: #667085;
            --page-accent: #3559a8;
            --page-soft: #f5f6f8;
        }

        @page {
            size: A4;
            margin: 14mm;
        }

        * {
            box-sizing: border-box;
        }

        html,
        body {
            margin: 0;
            min-height: 100%;
        }

        body {
            font-family: "Aptos", "Segoe UI", "Calibri", sans-serif;
            color: var(--page-text);
            background: var(--page-bg);
            line-height: 1.55;
            -webkit-font-smoothing: antialiased;
            text-rendering: optimizeLegibility;
        }

        .page {
            width: min(210mm, calc(100vw - 32px));
            min-height: calc(297mm - 28mm);
            margin: 16px auto;
            background: var(--page-surface);
            border: 0;
            border-radius: 0;
            box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
            overflow: hidden;
        }

        .page-inner {
            padding: 18mm 20mm 20mm;
            background: #ffffff;
        }

        .doc-header {
            display: grid;
            gap: 6px;
            padding-bottom: 18px;
            margin-bottom: 22px;
            border-bottom: 1px solid #d0d5dd;
        }

        .doc-brand {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: var(--page-accent);
        }

        h1 {
            margin: 0;
            font-size: 26pt;
            font-weight: 700;
            line-height: 1.12;
            letter-spacing: -0.01em;
            color: #111827;
        }

        .doc-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            color: var(--page-muted);
            font-size: 12px;
        }

        .doc-meta span {
            padding: 4px 0;
            border-radius: 0;
            background: var(--page-soft);
            border: 0;
            background: transparent;
        }

        .doc-content :is(h2, h3, h4, h5, h6, p, ul, ol, blockquote, pre, table) {
            margin-top: 0;
        }

        .doc-content h2 {
            margin: 1.8em 0 0.55em;
            padding-bottom: 0.16em;
            font-size: 16pt;
            font-weight: 700;
            color: #111827;
            border-bottom: 1px solid #d0d5dd;
        }

        .doc-content h3 {
            margin: 1.45em 0 0.42em;
            font-size: 13pt;
            font-weight: 700;
            color: #1f2937;
        }

        .doc-content h4 {
            margin: 1.2em 0 0.4em;
            font-size: 11.5pt;
            font-weight: 700;
            color: #344054;
        }

        .doc-content h5,
        .doc-content h6 {
            margin: 1.1em 0 0.35em;
            font-size: 11pt;
            font-weight: 700;
            color: #475467;
        }

        .doc-content p,
        .doc-content li,
        .doc-content blockquote {
            font-size: 11pt;
            color: #2b3444;
        }

        .doc-content p,
        .doc-content ul,
        .doc-content ol,
        .doc-content blockquote,
        .doc-content pre {
            margin-bottom: 12px;
        }

        .doc-content ul,
        .doc-content ol {
            padding-left: 22px;
        }

        .doc-content li {
            margin-bottom: 6px;
        }

        .doc-content blockquote {
            margin-left: 0;
            padding: 12px 16px;
            border-left: 3px solid #98a2b3;
            border-radius: 0 12px 12px 0;
            background: #f7f7f8;
        }

        .doc-content pre {
            padding: 14px 16px;
            border: 1px solid var(--page-border);
            border-radius: 14px;
            background: #f7f7f8;
            white-space: pre-wrap;
            word-break: break-word;
            overflow: hidden;
        }

        .doc-content code {
            font-family: "Cascadia Mono", "Consolas", monospace;
            font-size: 0.95em;
            background: #f2f4f7;
            color: #344054;
            padding: 0.16em 0.4em;
            border-radius: 6px;
        }

        .doc-content pre code {
            padding: 0;
            background: transparent;
            color: inherit;
            white-space: pre-wrap;
        }

        .doc-content a {
            color: var(--page-accent);
            text-decoration: underline;
            text-underline-offset: 2px;
        }

        .doc-content strong {
            color: #111827;
        }

        .doc-content hr {
            border: 0;
            height: 1px;
            margin: 18px 0;
            background: linear-gradient(90deg, transparent, #c7d2fe, transparent);
        }

        .print-empty {
            color: var(--page-muted);
            font-style: italic;
        }

        @media print {
            body {
                background: #ffffff;
            }

            .page {
                width: auto;
                min-height: auto;
                margin: 0;
                border: 0;
                border-radius: 0;
                box-shadow: none;
            }

            .page-inner {
                padding: 0;
            }
        }
    </style>
</head>
<body>
    <article class="page">
        <div class="page-inner">
            <header class="doc-header">
                <div class="doc-brand">Repo Reader</div>
                <h1>${title}</h1>
                <div class="doc-meta">
                    <span>${documentKind}</span>
                    <span>${modeLabel}</span>
                    <span>${generatedAt}</span>
                    ${sourcePath ? `<span>${sourcePath}</span>` : ""}
                </div>
            </header>
            <main class="doc-content">
                ${contentHtml}
            </main>
        </div>
    </article>
</body>
</html>`;
}

function getDefaultPdfPath(snapshot = {}) {
    const sourcePath = String(snapshot.sourcePath || "");
    const baseName = sanitizeFileName(snapshot.title || path.posix.basename(sourcePath) || "documento");
    const directoryName = sourcePath ? path.posix.dirname(sourcePath) : "";

    return path.join(ROOT, directoryName || ".", `${baseName}.pdf`);
}

function waitForPrintableLayout(printWindow) {
    return printWindow.webContents.executeJavaScript(`
        new Promise(resolve => {
            const finalize = () => {
                const root = document.documentElement;
                const body = document.body;
                resolve({
                    width: Math.max(root?.scrollWidth || 0, body?.scrollWidth || 0, body?.clientWidth || 0),
                    height: Math.max(root?.scrollHeight || 0, body?.scrollHeight || 0, body?.clientHeight || 0),
                });
            };

            const raf = window.requestAnimationFrame || (callback => setTimeout(callback, 16));
            const readyFonts = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => undefined) : Promise.resolve();

            readyFonts.then(() => {
                raf(() => raf(finalize));
            });
        });
    `, true);
}

async function ensurePrintWindowReady(printWindow) {
    const bounds = printWindow.getBounds();
    printWindow.setContentSize(Math.max(bounds.width, 1280), Math.max(bounds.height, 1600));

    const layout = await waitForPrintableLayout(printWindow);

    if (!layout.width || !layout.height) {
        throw new Error("Il documento non ha dimensioni valide per la stampa");
    }

    return layout;
}

function getA4PageSizeMicrons() {
    return {
        width: 210000,
        height: 297000,
    };
}

function createPrintWindow(snapshot) {
    const printWindow = new BrowserWindow({
        show: false,
        width: 1280,
        height: 1600,
        backgroundColor: "#e7ebf3",
        autoHideMenuBar: true,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    const html = buildPrintableHtml(snapshot);
    const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

    return printWindow.loadURL(url)
        .then(() => printWindow)
        .catch(error => {
            if (!printWindow.isDestroyed()) {
                printWindow.destroy();
            }

            throw error;
        });
}

async function printDocument(snapshot, options = {}) {
    if (!snapshot || typeof snapshot.html !== "string") {
        throw new Error("Nessun documento disponibile da stampare");
    }

    const mode = options.mode === "pdf" ? "pdf" : "print";
    const printWindow = await createPrintWindow(snapshot);

    try {
        await ensurePrintWindowReady(printWindow);

        if (mode === "pdf") {
            const pdfBuffer = await printWindow.webContents.printToPDF({
                printBackground: true,
                preferCSSPageSize: true,
                pageSize: "A4",
                marginsType: 1,
            });

            const { canceled, filePath } = await dialog.showSaveDialog(printWindow, {
                title: "Esporta PDF",
                defaultPath: getDefaultPdfPath(snapshot),
                filters: [{ name: "PDF", extensions: ["pdf"] }],
            });

            if (canceled || !filePath) {
                return { canceled: true };
            }

            await fs.promises.writeFile(filePath, pdfBuffer);
            return { canceled: false, savedPath: filePath };
        }

        await new Promise((resolve, reject) => {
            printWindow.webContents.print({
                silent: false,
                printBackground: true,
                pageSize: getA4PageSizeMicrons(),
                margins: {
                    marginType: "default",
                },
                landscape: false,
            }, (success, failureReason) => {
                if (success) {
                    resolve(true);
                    return;
                }

                reject(new Error(failureReason || "Impossibile aprire la finestra di stampa"));
            });
        });

        return { printed: true };
    } finally {
        if (!printWindow.isDestroyed()) {
            printWindow.destroy();
        }
    }
}

function launchDetached(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        let childProcess;

        try {
            childProcess = spawn(command, args, {
                detached: true,
                stdio: "ignore",
                windowsHide: true,
                ...options,
            });
        } catch (error) {
            reject(error);
            return;
        }

        childProcess.once("error", reject);
        childProcess.once("spawn", () => {
            childProcess.unref();
            resolve(childProcess);
        });
    });
}

async function openWithCode(absolutePath) {
    const candidates = [
        { command: "code", args: ["-r", absolutePath] },
    ];

    if (process.platform === "win32") {
        candidates.push(
            {
                command: path.join(process.env.LOCALAPPDATA || "", "Programs", "Microsoft VS Code", "Code.exe"),
                args: ["-r", absolutePath],
            },
            {
                command: path.join(process.env.PROGRAMFILES || "", "Microsoft VS Code", "Code.exe"),
                args: ["-r", absolutePath],
            },
            {
                command: path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft VS Code", "Code.exe"),
                args: ["-r", absolutePath],
            }
        );
    }

    const errors = [];

    for (const candidate of candidates) {
        if (!candidate.command || candidate.command.includes(path.sep) && !fs.existsSync(candidate.command)) {
            continue;
        }

        try {
            await launchDetached(candidate.command, candidate.args, { cwd: ROOT });
            return;
        } catch (error) {
            errors.push(error.message);
        }
    }

    throw new Error(errors[0] || "Impossibile aprire VS Code");
}

function openExternalUrl(url) {
    if (!/^(https?:|mailto:|tel:|file:)/i.test(url)) {
        throw new Error("URL non valido");
    }

    return shell.openExternal(url);
}

function createWindow() {
    const window = new BrowserWindow({
        width: 1480,
        height: 960,
        minWidth: 1200,
        minHeight: 780,
        backgroundColor: "#0b1020",
        title: "Repo Reader",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    window.removeMenu();
    window.loadFile(path.join(__dirname, "renderer", "index.html"));

    return window;
}

app.whenReady().then(() => {
    ipcMain.handle("repo:get-bootstrap", () => ({
        root: ROOT,
        defaultPath: DEFAULT_PATH,
    }));

    ipcMain.handle("repo:list-directory", (_, relativePath = "") => listDirectory(relativePath));
    ipcMain.handle("repo:read-file", (_, relativePath) => readTextFile(relativePath));
    ipcMain.handle("repo:write-file", (_, relativePath, content) => {
        writeTextFile(relativePath, content);
        return true;
    });
    ipcMain.handle("repo:open-folder", async (_, relativePath = "") => {
        const absolutePath = resolveWithinRoot(relativePath);
        const errorMessage = await shell.openPath(absolutePath);

        if (errorMessage) {
            throw new Error(errorMessage);
        }

        return true;
    });
    ipcMain.handle("repo:open-in-code", async (_, relativePath = "") => {
        const absolutePath = resolveWithinRoot(relativePath);
        await openWithCode(absolutePath);
        return true;
    });
    ipcMain.handle("repo:open-external", (_, url) => openExternalUrl(url));
    ipcMain.handle("repo:print-document", async (_, snapshot, options = {}) => printDocument(snapshot, options));

    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});