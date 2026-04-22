const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

let currentRoot = path.resolve(process.env.REPO_READER_ROOT || process.cwd());

const APP_ICON_PATH = path.join(__dirname, "renderer", "favicon.png");

function getRoot() {
    return currentRoot;
}

function getDefaultPath() {
    return fs.existsSync(path.join(getRoot(), "docs")) ? "docs" : "";
}

function toPosixPath(value) {
    return String(value || "").replace(/\\/g, "/");
}

function resolveWithinRoot(relativePath = "") {
    const safeRelativePath = toPosixPath(relativePath);
    const root = getRoot();
    const absolutePath = path.resolve(root, safeRelativePath || ".");
    const relativeToRoot = path.relative(root, absolutePath);

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

function getPrintPreset(snapshot = {}) {
    const presetId = snapshot.preset && typeof snapshot.preset.id === "string" ? snapshot.preset.id : "public";
    const authorName = String(snapshot.authorName || "").trim();
    const organizationName = String(snapshot.organizationName || snapshot.companyName || "").trim();

    const presets = {
        restricted: {
            label: "Riservato",
            shortLabel: "Riservato",
            note: "Documento strettamente riservato. Distribuzione vietata salvo autorizzazione espressa del titolare del documento.",
            accent: "#8b1e2d",
            soft: "#fdf2f3",
            watermark: "STRETTAMENTE RISERVATO",
            footer: "Classificazione massima: uso strettamente limitato.",
        },
        internal: {
            label: "Interno",
            shortLabel: "Interno",
            note: organizationName
                ? `Documento per uso interno a ${organizationName}.`
                : "Documento destinato esclusivamente all'uso interno del personale aziendale.",
            accent: "#8a5b14",
            soft: "#fff7ed",
            watermark: "USO INTERNO",
            footer: "Non distribuire fuori dall'organizzazione.",
        },
        nda: {
            label: "Partner",
            shortLabel: "Partner",
            note: organizationName
                ? `Documento condiviso da ${organizationName} con i partner e regolato da accordi di non divulgazione.`
                : "Condivisione consentita solo con partner coperti da accordo di non divulgazione.",
            accent: "#155eef",
            soft: "#eff4ff",
            watermark: "NDA",
            footer: "Documento condivisibile solo entro i perimetri previsti dagli accordi NDA.",
        },
        public: {
            label: "Pubblico",
            shortLabel: "Pubblico",
            note: "Documento distribuibile senza restrizioni di confidenzialita'.",
            accent: "#027a48",
            soft: "#ecfdf3",
            watermark: "",
            footer: "Documento destinato alla distribuzione pubblica.",
        },
    };

    const selectedPreset = presets[presetId] || presets.public;

    return {
        ...selectedPreset,
        authorName,
        organizationName,
    };
}

function getPrintableBaseName(snapshot = {}) {
    const rawTitle = String(snapshot.title || "").trim();
    const sourcePath = String(snapshot.sourcePath || "");
    const candidate = rawTitle || path.posix.basename(sourcePath) || "documento";
    const parsed = path.posix.parse(candidate);

    if (parsed.name) {
        return parsed.name;
    }

    return candidate;
}
function buildPrintableHtml(snapshot = {}) {
    const title = escapeHtml(getPrintableBaseName(snapshot) || "Documento");
    const generatedAt = escapeHtml(formatTimestamp());
    const contentHtml = snapshot.html || '<p class="print-empty">Nessun contenuto disponibile.</p>';
    const preset = getPrintPreset(snapshot);
    const presetLabel = escapeHtml(preset.label);
    const presetNote = escapeHtml(preset.note);
    const watermark = escapeHtml(preset.watermark);
    const authorName = escapeHtml(preset.authorName || "");
    const organizationName = escapeHtml(preset.organizationName || "");
    const watermarkPlacements = [
        { top: "12%", left: "18%", rotate: "-26deg", size: "19pt" },
        { top: "24%", left: "74%", rotate: "-27deg", size: "19pt" },
        { top: "40%", left: "42%", rotate: "-26deg", size: "24pt" },
        { top: "58%", left: "17%", rotate: "-27deg", size: "19pt" },
        { top: "74%", left: "77%", rotate: "-26deg", size: "19pt" },
        { top: "88%", left: "36%", rotate: "-27deg", size: "18pt" },
    ];
    const watermarkMarkup = watermark
        ? watermarkPlacements.map((placement, index) => '<div class="page-watermark-item page-watermark-item-' + (index + 1) + '" style="top:' + placement.top + ';left:' + placement.left + ';--watermark-size:' + placement.size + ';transform:translate(-50%, -50%) rotate(' + placement.rotate + ');">' + watermark + '</div>').join("")
        : "";

    return `<!doctype html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        :root {
            color-scheme: light;
            --page-text: #1f2937;
            --page-muted: #667085;
            --page-accent: ${preset.accent};
            --page-soft: ${preset.soft};
            --page-line: #d0d5dd;
        }

        @page {
            size: A4;
            margin: 0;
        }

        * {
            box-sizing: border-box;
        }

        html,
        body {
            margin: 0;
            min-height: 100%;
            width: 100%;
            background: #ffffff;
        }

        body {
            font-family: "Aptos", "Segoe UI", "Calibri", sans-serif;
            color: var(--page-text);
            background: #ffffff;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
            text-rendering: optimizeLegibility;
        }

        .print-document {
            width: 100%;
            margin: 0;
            background: #ffffff;
        }

        .print-page {
            position: relative;
            width: 210mm;
            height: 297mm;
            margin: 0 auto;
            background: #ffffff;
            overflow: hidden;
            break-after: page;
            page-break-after: always;
        }

        .print-page:last-child {
            break-after: auto;
            page-break-after: auto;
        }

        .page-surface {
            position: relative;
            width: 100%;
            height: 100%;
            padding: 16mm 18mm;
            z-index: 1;
        }

        .page-watermark {
            position: absolute;
            inset: 0;
            overflow: hidden;
            pointer-events: none;
            user-select: none;
            z-index: 0;
        }

        .page-watermark-item {
            position: absolute;
            display: block;
            font-size: var(--watermark-size, 20pt);
            font-weight: 700;
            line-height: 1;
            letter-spacing: 0.24em;
            color: rgba(17, 24, 39, 0.075);
            white-space: nowrap;
            opacity: 0.95;
            mix-blend-mode: multiply;
            transform-origin: center;
        }

        .cover-page .page-surface {
            padding: 22mm 20mm;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .cover-card {
            position: relative;
            width: 100%;
            min-height: 228mm;
            padding: 22mm 18mm;
            border: 1.4pt solid var(--page-line);
            background: rgba(255, 255, 255, 0.82);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 14mm;
        }

        .cover-brand {
            font-size: 10pt;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--page-accent);
        }

        .cover-title-block {
            display: grid;
            gap: 5mm;
        }

        .cover-title {
            margin: 0;
            font-size: 28pt;
            font-weight: 700;
            line-height: 1.15;
            letter-spacing: -0.02em;
            color: #111827;
        }

        .cover-note {
            max-width: 140mm;
            font-size: 12pt;
            color: #475467;
        }

        .cover-meta {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10mm 12mm;
            padding-top: 8mm;
            border-top: 1px solid var(--page-line);
        }

        .cover-meta-item {
            display: grid;
            gap: 2mm;
        }

        .cover-meta-label {
            font-size: 9pt;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--page-muted);
        }

        .cover-meta-value {
            font-size: 13pt;
            color: #111827;
        }

        .cover-meta-value.is-empty {
            color: var(--page-muted);
            font-style: italic;
        }

        .cover-classification {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            width: fit-content;
            padding: 4mm 5mm;
            border-left: 4px solid var(--page-accent);
            background: var(--page-soft);
        }

        .cover-classification-title {
            font-size: 11pt;
            font-weight: 700;
            color: #111827;
        }

        .cover-classification-note {
            font-size: 10pt;
            color: #475467;
        }

        .standard-page .page-header,
        .standard-page .page-footer {
            position: absolute;
            left: 16mm;
            right: 16mm;
            display: grid;
            gap: 2mm;
            z-index: 1;
        }

        .standard-page .page-header {
            top: 12mm;
            padding-bottom: 3mm;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: end;
            border-bottom: 1px solid var(--page-line);
        }

        .standard-page .page-footer {
            bottom: 11mm;
            padding-top: 3mm;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            align-items: start;
            border-top: 1px solid var(--page-line);
        }

        .header-title {
            font-size: 10pt;
            font-weight: 700;
            color: #111827;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .header-note,
        .footer-item {
            font-size: 9pt;
            color: #475467;
        }

        .footer-item.is-center {
            text-align: center;
        }

        .footer-item.is-right {
            text-align: right;
        }

        .page-body {
            position: absolute;
            top: 28mm;
            bottom: 24mm;
            left: 16mm;
            right: 16mm;
            overflow: hidden;
            z-index: 1;
            background: transparent;
        }

        .toc-title {
            margin: 0 0 8mm;
            font-size: 22pt;
            font-weight: 700;
            color: #111827;
        }

        .toc-subtitle {
            margin: 0 0 8mm;
            font-size: 10pt;
            color: var(--page-muted);
        }

        .toc-list {
            display: grid;
            gap: 3.2mm;
        }

        .toc-page.is-continuation .toc-title {
            margin-bottom: 4mm;
            font-size: 18pt;
        }

        .toc-page.is-continuation .toc-subtitle {
            margin-bottom: 6mm;
        }

        .export-summary {
            display: grid;
            gap: 7mm;
            align-content: start;
        }

        .export-summary-title {
            margin: 0;
            font-size: 22pt;
            font-weight: 700;
            color: #111827;
        }

        .export-summary-text {
            margin: 0;
            font-size: 10.5pt;
            color: var(--page-muted);
        }

        .export-summary-grid {
            display: grid;
            gap: 5mm;
        }

        .export-summary-item {
            display: grid;
            gap: 1.8mm;
            padding: 4mm 0;
            border-bottom: 1px solid #e4e7ec;
        }

        .export-summary-label {
            font-size: 9pt;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--page-muted);
        }

        .export-summary-value {
            font-size: 12pt;
            color: #111827;
        }

        .toc-row {
            display: grid;
            grid-template-columns: auto auto minmax(0, 1fr) 12mm;
            gap: 3mm;
            align-items: baseline;
            font-size: 11pt;
            color: #1f2937;
        }

        .toc-row[data-level="3"] {
            padding-left: 6mm;
            font-size: 10.5pt;
        }

        .toc-row[data-level="4"] {
            padding-left: 12mm;
            font-size: 10pt;
        }

        .toc-number,
        .toc-page {
            font-weight: 700;
            color: #111827;
        }

        .toc-leader {
            border-bottom: 1px dotted #98a2b3;
            transform: translateY(-1.5mm);
        }

        .document-content :is(h2, h3, h4, h5, h6, p, ul, ol, blockquote, pre, table) {
            margin-top: 0;
        }

        .document-content h2 {
            margin: 0 0 4.5mm;
            padding-bottom: 0.16em;
            font-size: 16pt;
            font-weight: 700;
            color: #111827;
            border-bottom: 1px solid var(--page-line);
        }

        .document-content h3 {
            margin: 0 0 3.5mm;
            font-size: 13pt;
            font-weight: 700;
            color: #1f2937;
        }

        .document-content h4 {
            margin: 0 0 3mm;
            font-size: 11.5pt;
            font-weight: 700;
            color: #344054;
        }

        .document-content h5,
        .document-content h6 {
            margin: 0 0 3mm;
            font-size: 11pt;
            font-weight: 700;
            color: #475467;
        }

        .heading-number {
            display: inline-block;
            min-width: 18mm;
            margin-right: 1mm;
            color: var(--page-accent);
        }

        .flow-unit {
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .flow-unit.flow-unit-code {
            break-inside: auto;
            page-break-inside: auto;
        }

        .flow-unit + .flow-unit {
            margin-top: 2mm;
        }

        .document-content p,
        .document-content li,
        .document-content blockquote {
            font-size: 11pt;
            color: #2b3444;
        }

        .document-content p,
        .document-content ul,
        .document-content ol,
        .document-content blockquote,
        .document-content pre {
            margin-bottom: 4mm;
        }

        .document-content ul,
        .document-content ol {
            padding-left: 22px;
            margin: 0 0 4mm;
        }

        .document-content ul ul {
            list-style-type: circle;
        }

        .document-content ul ul ul {
            list-style-type: square;
        }

        .document-content ol ol {
            list-style-type: lower-alpha;
        }

        .document-content ol ol ol {
            list-style-type: lower-roman;
        }

        .document-content li > ul,
        .document-content li > ol {
            margin-top: 2mm;
            margin-bottom: 1mm;
            padding-left: 20px;
        }

        .document-content li {
            margin-bottom: 6px;
        }

        .document-content blockquote {
            margin-left: 0;
            padding: 12px 16px;
            border-left: 3px solid #98a2b3;
            border-radius: 0 12px 12px 0;
            background: #f7f7f8;
        }

        .document-content pre {
            padding: 14px 16px;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            background: linear-gradient(180deg, #eef2f7 0%, #f7f7f8 14px, #f7f7f8 calc(100% - 14px), #eef2f7 100%);
            white-space: pre-wrap;
            word-break: break-word;
            overflow: visible;
            break-inside: auto;
            page-break-inside: auto;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
        }

        .document-content pre.code-block-fragment {
            margin: 0;
            border-radius: 0;
            border-top: 0;
            border-bottom: 0;
            background: #f7f7f8;
        }

        .document-content pre.code-block-fragment.is-first {
            border-top: 1px solid #e4e7ec;
            border-top-left-radius: 12px;
            border-top-right-radius: 12px;
            background: linear-gradient(180deg, #eef2f7 0%, #f7f7f8 14px, #f7f7f8 100%);
        }

        .document-content pre.code-block-fragment.is-last {
            border-bottom: 1px solid #e4e7ec;
            border-bottom-left-radius: 12px;
            border-bottom-right-radius: 12px;
            background: linear-gradient(180deg, #f7f7f8 0%, #f7f7f8 calc(100% - 14px), #eef2f7 100%);
        }

        .document-content pre.code-block-fragment:not(.is-first):not(.is-last) {
            padding-top: 10px;
            padding-bottom: 10px;
        }

        .document-content .md-table-wrap {
            margin: 0 0 4mm;
            overflow: hidden;
            border: 1px solid #d0d5dd;
            border-radius: 12px;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .document-content .md-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        .document-content .md-table th,
        .document-content .md-table td {
            padding: 9px 10px;
            border-bottom: 1px solid #e4e7ec;
            font-size: 10pt;
            color: #2b3444;
            vertical-align: top;
            overflow-wrap: anywhere;
        }

        .document-content .md-table th {
            font-weight: 700;
            color: #111827;
            background: #f5f7fa;
        }

        .document-content .md-table tbody tr:nth-child(even) td {
            background: #fafbfc;
        }

        .document-content .md-table tbody tr:last-child td {
            border-bottom: 0;
        }

        .document-content code {
            font-family: "Cascadia Mono", "Consolas", monospace;
            font-size: 0.95em;
            background: #f2f4f7;
            color: #344054;
            padding: 0.16em 0.4em;
            border-radius: 6px;
        }

        .document-content pre code {
            padding: 0;
            background: transparent;
            color: inherit;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }

        .document-content a {
            color: var(--page-accent);
            text-decoration: underline;
            text-underline-offset: 2px;
        }

        .document-content strong {
            color: #111827;
        }

        .document-content hr {
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

            .print-page {
                margin: 0;
            }

            .page-watermark-item {
                color: rgba(17, 24, 39, 0.065);
            }
        }
    </style>
</head>
<body>
    <main class="print-document">
        <section class="print-page cover-page">
            ${watermarkMarkup}
            <div class="page-surface">
                <article class="cover-card">
                    <div class="cover-brand">Documentazione tecnica</div>
                    <div class="cover-title-block">
                        <h1 class="cover-title">${title}</h1>
                        <div class="cover-note">${presetNote}</div>
                    </div>
                    <div class="cover-classification">
                        <div class="cover-classification-title">${presetLabel}</div>
                        <div class="cover-classification-note">Classificazione del documento</div>
                    </div>
                    <div class="cover-meta">
                        <div class="cover-meta-item">
                            <div class="cover-meta-label">Autore</div>
                            <div class="cover-meta-value${authorName ? "" : " is-empty"}">${authorName || "Non indicato"}</div>
                        </div>
                        <div class="cover-meta-item">
                            <div class="cover-meta-label">Data esportazione</div>
                            <div class="cover-meta-value">${generatedAt}</div>
                        </div>
                    </div>
                </article>
            </div>
        </section>

        <section id="toc-pages"></section>

        <section id="content-pages"></section>

        <section class="print-page standard-page export-summary-page">
            ${watermarkMarkup}
            <header class="page-header">
                <div class="header-title">${title}</div>
                <div class="header-note">${presetLabel}</div>
            </header>
            <div class="page-body export-summary">
                <h2 class="export-summary-title">Dati esportazione</h2>
                <p class="export-summary-text">Riepilogo finale dei metadati associati al documento esportato.</p>
                <div class="export-summary-grid">
                    <div class="export-summary-item">
                        <div class="export-summary-label">Data esportazione</div>
                        <div class="export-summary-value">${generatedAt}</div>
                    </div>
                    ${authorName ? `
                    <div class="export-summary-item">
                        <div class="export-summary-label">Autore</div>
                        <div class="export-summary-value">${authorName}</div>
                    </div>` : ""}
                    ${organizationName ? `
                    <div class="export-summary-item">
                        <div class="export-summary-label">Organizzazione</div>
                        <div class="export-summary-value">${organizationName}</div>
                    </div>` : ""}
                </div>
            </div>
            <footer class="page-footer">
                <div class="footer-item">Autore: ${authorName || "Non indicato"}</div>
                <div class="footer-item is-center">Data esportazione: ${generatedAt}</div>
                <div class="footer-item is-right">Pagina <span data-page-current></span> / <span data-page-total></span></div>
            </footer>
        </section>
    </main>

    <template id="standard-page-template">
        <section class="print-page standard-page">
            ${watermarkMarkup}
            <header class="page-header">
                <div class="header-title">${title}</div>
                <div class="header-note">${presetLabel}</div>
            </header>
            <div class="page-body document-content"></div>
            <footer class="page-footer">
                <div class="footer-item">Autore: ${authorName || "Non indicato"}</div>
                <div class="footer-item is-center">Data esportazione: ${generatedAt}</div>
                <div class="footer-item is-right">Pagina <span data-page-current></span> / <span data-page-total></span></div>
            </footer>
        </section>
    </template>

    <template id="toc-page-template">
        <section class="print-page standard-page toc-page">
            ${watermarkMarkup}
            <header class="page-header">
                <div class="header-title">${title}</div>
                <div class="header-note">${presetLabel}</div>
            </header>
            <div class="page-body">
                <h2 class="toc-title" data-toc-title>Indice</h2>
                <p class="toc-subtitle" data-toc-subtitle>Sezioni numerate del documento, livelli da H2 a H4.</p>
                <div class="toc-list" data-toc-body></div>
            </div>
            <footer class="page-footer">
                <div class="footer-item">Autore: ${authorName || "Non indicato"}</div>
                <div class="footer-item is-center">Data esportazione: ${generatedAt}</div>
                <div class="footer-item is-right">Pagina <span data-page-current></span> / <span data-page-total></span></div>
            </footer>
        </section>
    </template>

    <template id="content-template">${contentHtml}</template>

    <script>
        (() => {
            const contentTemplate = document.getElementById("content-template");
            const contentPages = document.getElementById("content-pages");
            const tocPages = document.getElementById("toc-pages");

            layoutDocument();
            updatePageNumbers();

            function layoutDocument() {
                let tocPageCount = 1;

                for (let pass = 0; pass < 3; pass += 1) {
                    const sourceContainer = createSourceContainer();
                    const tocEntries = numberDocumentHeadings(sourceContainer);

                    contentPages.innerHTML = "";
                    tocPages.innerHTML = "";

                    const units = createFlowUnits(sourceContainer);
                    const pageMap = paginateUnits(units, contentPages, 1 + tocPageCount);
                    const actualTocPageCount = paginateTocEntries(tocEntries, pageMap, tocPages);

                    if (actualTocPageCount === tocPageCount) {
                        return;
                    }

                    tocPageCount = actualTocPageCount;
                }
            }

            function createSourceContainer() {
                const container = document.createElement("div");
                container.append(contentTemplate.content.cloneNode(true));
                removePrimaryHeading(container);
                return container;
            }

            function removePrimaryHeading(container) {
                const firstElement = Array.from(container.children).find(node => node.textContent.trim());

                if (firstElement && firstElement.tagName === "H1") {
                    firstElement.remove();
                }

                container.querySelectorAll("h1").forEach(node => node.remove());
            }

            function numberDocumentHeadings(container) {
                const counters = [0, 0, 0];
                const entries = [];
                let headingIndex = 0;

                container.querySelectorAll("h2, h3, h4").forEach(heading => {
                    const level = Number(heading.tagName.slice(1));

                    if (level === 2) {
                        counters[0] += 1;
                        counters[1] = 0;
                        counters[2] = 0;
                    } else if (level === 3) {
                        if (!counters[0]) {
                            counters[0] = 1;
                        }

                        counters[1] += 1;
                        counters[2] = 0;
                    } else if (level === 4) {
                        if (!counters[0]) {
                            counters[0] = 1;
                        }

                        if (!counters[1]) {
                            counters[1] = 1;
                        }

                        counters[2] += 1;
                    }

                    const prefix = counters.slice(0, level - 1).filter(Boolean).join(".");
                    const headingId = "section-" + headingIndex;
                    const originalHtml = heading.innerHTML;
                    const headingTextProbe = document.createElement("div");

                    headingTextProbe.innerHTML = originalHtml;

                    heading.id = headingId;
                    heading.dataset.headingId = headingId;
                    heading.innerHTML = "";

                    const numberNode = document.createElement("span");
                    numberNode.className = "heading-number";
                    numberNode.textContent = prefix + " ";

                    const textNode = document.createElement("span");
                    textNode.className = "heading-text";
                    textNode.innerHTML = originalHtml;

                    heading.append(numberNode, textNode);
                    entries.push({
                        id: headingId,
                        level,
                        number: prefix,
                        text: headingTextProbe.textContent.trim(),
                    });
                    headingIndex += 1;
                });

                return entries;
            }

            function createFlowUnits(container) {
                const units = [];
                const nodes = Array.from(container.children);

                for (let index = 0; index < nodes.length; index += 1) {
                    const currentNode = nodes[index];
                    const unit = document.createElement("section");
                    unit.className = "flow-unit";
                    unit.append(currentNode);

                    const currentTag = currentNode.tagName || "";
                    const nextNode = nodes[index + 1];
                    const isHeading = /^H[2-6]$/.test(currentTag);
                    const nextIsHeading = nextNode ? /^H[1-6]$/.test(nextNode.tagName || "") : false;
                    const nextIsCodeBlock = nextNode instanceof HTMLElement && nextNode.matches("pre.code-block, pre.code-block-fragment");

                    if (isHeading && nextNode && !nextIsHeading && !nextIsCodeBlock) {
                        unit.append(nextNode);
                        index += 1;
                    }

                    if (currentNode instanceof HTMLElement && currentNode.matches("pre.code-block, pre.code-block-fragment")) {
                        unit.classList.add("flow-unit-code");
                    }

                    units.push(unit);
                }

                return units;
            }

            function createStandardPage() {
                return document.getElementById("standard-page-template").content.firstElementChild.cloneNode(true);
            }

            function createTocPage(isContinuation) {
                const page = document.getElementById("toc-page-template").content.firstElementChild.cloneNode(true);
                const titleNode = page.querySelector("[data-toc-title]");
                const subtitleNode = page.querySelector("[data-toc-subtitle]");

                if (isContinuation) {
                    page.classList.add("is-continuation");
                    titleNode.textContent = "Indice (continua)";
                    subtitleNode.textContent = "Prosecuzione della tabella dei contenuti del documento.";
                }

                return page;
            }

            function paginateUnits(units, mountNode, leadingPageCount) {
                const pageLookup = new Map();
                let currentPage = createStandardPage();
                let currentBody = currentPage.querySelector(".page-body");
                mountNode.append(currentPage);

                for (const unit of units) {
                    currentBody.append(unit);

                    if (currentBody.scrollHeight > currentBody.clientHeight + 2 && currentBody.children.length > 1) {
                        currentBody.removeChild(unit);
                        currentPage = createStandardPage();
                        currentBody = currentPage.querySelector(".page-body");
                        mountNode.append(currentPage);
                        currentBody.append(unit);
                    }

                    const pageNumber = leadingPageCount + mountNode.children.length;
                    unit.querySelectorAll("[data-heading-id]").forEach(heading => {
                        pageLookup.set(heading.dataset.headingId, pageNumber);
                    });
                }

                return pageLookup;
            }

            function createTocRow(entry, pageLookup) {
                const row = document.createElement("div");
                row.className = "toc-row";
                row.dataset.level = String(entry.level);

                const number = document.createElement("span");
                number.className = "toc-number";
                number.textContent = entry.number;

                const label = document.createElement("span");
                label.className = "toc-label";
                label.textContent = entry.text;

                const leader = document.createElement("span");
                leader.className = "toc-leader";

                const page = document.createElement("span");
                page.className = "toc-page";
                page.textContent = String(pageLookup.get(entry.id) || "-");

                row.append(number, label, leader, page);
                return row;
            }

            function paginateTocEntries(entries, pageLookup, mountNode) {
                if (!entries.length) {
                    const page = createTocPage(false);
                    const emptyState = document.createElement("p");
                    emptyState.className = "print-empty";
                    emptyState.textContent = "Nessuna sezione H2-H4 disponibile per l'indice.";
                    page.querySelector("[data-toc-body]").append(emptyState);
                    mountNode.append(page);
                    return 1;
                }

                let pageCount = 0;
                let currentPage = createTocPage(false);
                let currentBody = currentPage.querySelector(".page-body");
                let currentList = currentPage.querySelector("[data-toc-body]");
                mountNode.append(currentPage);
                pageCount += 1;

                for (const entry of entries) {
                    const row = createTocRow(entry, pageLookup);
                    currentList.append(row);

                    if (currentBody.scrollHeight > currentBody.clientHeight + 2 && currentList.children.length > 1) {
                        currentList.removeChild(row);
                        currentPage = createTocPage(true);
                        currentBody = currentPage.querySelector(".page-body");
                        currentList = currentPage.querySelector("[data-toc-body]");
                        currentList.append(row);
                        mountNode.append(currentPage);
                        pageCount += 1;
                    }
                }

                return pageCount;
            }

            function updatePageNumbers() {
                const pages = Array.from(document.querySelectorAll(".print-page"));
                const total = pages.length;

                pages.forEach((page, index) => {
                    const current = index + 1;

                    page.querySelectorAll("[data-page-current]").forEach(node => {
                        node.textContent = String(current);
                    });

                    page.querySelectorAll("[data-page-total]").forEach(node => {
                        node.textContent = String(total);
                    });
                });
            }
        })();
    </script>
</body>
</html>`;
}

function getDefaultPdfPath(snapshot = {}) {
    const sourcePath = String(snapshot.sourcePath || "");
    const baseName = sanitizeFileName(getPrintableBaseName(snapshot));
    const directoryName = sourcePath ? path.posix.dirname(sourcePath) : "";

    return path.join(getRoot(), directoryName || ".", `${baseName}.pdf`);
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

async function chooseWorkspace(browserWindow) {
    const result = await dialog.showOpenDialog(browserWindow, {
        title: "Seleziona workspace",
        properties: ["openDirectory", "createDirectory"],
        defaultPath: getRoot(),
    });

    if (result.canceled || !result.filePaths.length) {
        return { canceled: true, root: getRoot(), defaultPath: getDefaultPath() };
    }

    const selectedRoot = path.resolve(result.filePaths[0]);
    currentRoot = selectedRoot;

    return {
        canceled: false,
        root: currentRoot,
        defaultPath: getDefaultPath(),
    };
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
        backgroundColor: "#ffffff",
        autoHideMenuBar: true,
        icon: APP_ICON_PATH,
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
            await launchDetached(candidate.command, candidate.args, { cwd: getRoot() });
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
        icon: APP_ICON_PATH,
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
    if (process.platform === "win32") {
        app.setAppUserModelId("com.github.deviloper.repo-reader");
    }

    ipcMain.handle("repo:get-bootstrap", () => ({
        root: getRoot(),
        defaultPath: getDefaultPath(),
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
    ipcMain.handle("repo:choose-workspace", event => chooseWorkspace(BrowserWindow.fromWebContents(event.sender)));

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