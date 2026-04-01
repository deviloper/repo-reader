const state = {
    root: "",
    currentPath: "",
    currentItems: [],
    selectedPath: "",
    selectedType: "",
    selectedContent: "",
    editable: false,
    dirty: false,
};

const elements = {
    rootPath: document.getElementById("root-path"),
    breadcrumbs: document.getElementById("breadcrumbs"),
    fileList: document.getElementById("file-list"),
    entryCount: document.getElementById("entry-count"),
    preview: document.getElementById("preview"),
    selectedFile: document.getElementById("selected-file"),
    selectedType: document.getElementById("selected-type"),
    editor: document.getElementById("editor"),
    status: document.getElementById("status"),
    saveFile: document.getElementById("save-file"),
};

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function isExternalUrl(href) {
    return /^(https?:|mailto:|tel:)/i.test(href);
}

function renderInline(text) {
    let html = escapeHtml(text);
    const codeTokens = [];

    html = html.replace(/`([^`]+)`/g, (_, code) => {
        const token = `@@CODE_${codeTokens.length}@@`;
        codeTokens.push(`<code>${escapeHtml(code)}</code>`);
        return token;
    });

    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
        const cleanHref = href.trim();
        const linkClass = isExternalUrl(cleanHref) ? "md-link external" : "md-link internal";
        return `<a href="${escapeHtml(cleanHref)}" class="${linkClass}">${escapeHtml(label)}</a>`;
    });

    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    html = html.replace(/@@CODE_(\d+)@@/g, (_, index) => codeTokens[Number(index)] || "");

    return html;
}

function renderMarkdown(markdown) {
    const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let paragraph = [];
    let listType = null;
    let listItems = [];
    let inCodeBlock = false;
    let codeLines = [];
    let sectionDepth = 0;

    function blockClass(depth) {
        const safeDepth = Math.max(0, Math.min(Number(depth) || 0, 6));
        return safeDepth ? ` md-depth-${safeDepth}` : "";
    }

    function flushParagraph() {
        if (!paragraph.length) {
            return;
        }

        blocks.push(`<p class="md-block${blockClass(sectionDepth)}">${renderInline(paragraph.join(" ").trim())}</p>`);
        paragraph = [];
    }

    function flushList() {
        if (!listType) {
            return;
        }

        const tagName = listType === "ol" ? "ol" : "ul";
        const itemsHtml = listItems.map(item => `<li>${renderInline(item)}</li>`).join("");

        blocks.push(`<${tagName} class="md-block${blockClass(sectionDepth)}">${itemsHtml}</${tagName}>`);
        listType = null;
        listItems = [];
    }

    for (const rawLine of lines) {
        const trimmed = rawLine.trim();

        if (inCodeBlock) {
            if (trimmed.startsWith("```")) {
                blocks.push(`<pre class="code-block md-block${blockClass(sectionDepth)}"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
                inCodeBlock = false;
                codeLines = [];
            } else {
                codeLines.push(rawLine);
            }

            continue;
        }

        if (!trimmed) {
            flushParagraph();
            flushList();
            continue;
        }

        if (trimmed.startsWith("```")) {
            flushParagraph();
            flushList();
            inCodeBlock = true;
            codeLines = [];
            continue;
        }

        const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
        if (heading) {
            flushParagraph();
            flushList();
            const level = heading[1].length;
            sectionDepth = level;
            blocks.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
            continue;
        }

        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
            flushParagraph();
            flushList();
            blocks.push(`<hr class="md-block${blockClass(sectionDepth)}">`);
            continue;
        }

        const unorderedList = /^\s*[-*+]\s+(.+)$/.exec(rawLine);
        if (unorderedList) {
            flushParagraph();
            if (listType && listType !== "ul") {
                flushList();
            }
            listType = "ul";
            listItems.push(unorderedList[1]);
            continue;
        }

        const orderedList = /^\s*\d+\.\s+(.+)$/.exec(rawLine);
        if (orderedList) {
            flushParagraph();
            if (listType && listType !== "ol") {
                flushList();
            }
            listType = "ol";
            listItems.push(orderedList[1]);
            continue;
        }

        const blockquote = /^>\s?(.*)$/.exec(rawLine);
        if (blockquote) {
            flushParagraph();
            flushList();
            blocks.push(`<blockquote class="md-block${blockClass(sectionDepth)}">${renderInline(blockquote[1])}</blockquote>`);
            continue;
        }

        flushList();
        paragraph.push(trimmed);
    }

    flushParagraph();
    flushList();

    if (inCodeBlock) {
        blocks.push(`<pre class="code-block md-block${blockClass(sectionDepth)}"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    }

    return blocks.length ? blocks.join("\n") : '<p class="empty-markdown">Nessun contenuto.</p>';
}

function setStatus(message, tone = "") {
    elements.status.textContent = message;
    elements.status.dataset.tone = tone;
}

function normalizePath(relativePath) {
    return String(relativePath || "").replace(/\\/g, "/");
}

function splitPath(relativePath) {
    return normalizePath(relativePath).split("/").filter(Boolean);
}

function buildBreadcrumbs(currentPath) {
    const fragments = splitPath(currentPath);
    const container = document.createDocumentFragment();

    const rootButton = document.createElement("button");
    rootButton.type = "button";
    rootButton.textContent = "Root";
    rootButton.dataset.path = "";
    rootButton.className = "breadcrumb";
    container.appendChild(rootButton);

    let prefix = "";

    for (const fragment of fragments) {
        prefix = prefix ? `${prefix}/${fragment}` : fragment;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = fragment;
        button.dataset.path = prefix;
        button.className = "breadcrumb";
        container.appendChild(button);
    }

    elements.breadcrumbs.replaceChildren(container);
}

function renderFileList(items) {
    const fragment = document.createDocumentFragment();

    for (const item of items) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `file-entry ${item.type}`;
        button.dataset.path = item.path;
        button.dataset.type = item.type;

        const name = document.createElement("span");
        name.className = "file-name";
        name.textContent = item.name;

        const meta = document.createElement("span");
        meta.className = "file-meta";
        meta.textContent = item.type === "dir" ? "Cartella" : (item.isMarkdown ? "Markdown" : item.extension || "File");

        button.append(name, meta);
        fragment.appendChild(button);
    }

    elements.fileList.replaceChildren(fragment);
    elements.entryCount.textContent = `${items.length} elementi`;
}

function updateSelectionInfo(pathName, type) {
    elements.selectedFile.textContent = pathName || "Nessun file selezionato";
    elements.selectedType.textContent = type || "";
}

function setEditorContent(value, enabled) {
    elements.editor.value = value || "";
    elements.editor.disabled = !enabled;
    elements.saveFile.disabled = !enabled;
}

async function loadDirectory(relativePath = "") {
    const normalized = normalizePath(relativePath);
    setStatus("Caricamento cartella...");

    try {
        const result = await window.repoReader.listDirectory(normalized);
        state.currentPath = result.current || "";
        state.currentItems = result.items || [];

        buildBreadcrumbs(state.currentPath);
        renderFileList(state.currentItems);
        elements.rootPath.textContent = `${state.root}${state.currentPath ? ` / ${state.currentPath}` : ""}`;
        setStatus("Cartella caricata.");

        if (!state.currentItems.length) {
            elements.preview.innerHTML = '<p class="empty-state">Nessun file visibile in questa cartella.</p>';
        } else if (!state.selectedPath || splitPath(state.selectedPath).slice(0, -1).join("/") !== state.currentPath) {
            clearSelection();
        }
    } catch (error) {
        setStatus(error.message, "error");
        elements.preview.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
    }
}

function clearSelection() {
    state.selectedPath = "";
    state.selectedType = "";
    state.selectedContent = "";
    state.editable = false;
    state.dirty = false;
    updateSelectionInfo("Nessun file selezionato", "");
    elements.preview.innerHTML = '<p class="empty-state">Seleziona una cartella o un file per vedere il contenuto.</p>';
    setEditorContent("", false);
}

async function openDirectory(relativePath) {
    await loadDirectory(relativePath);
}

async function openFile(relativePath, itemType = "file") {
    const normalized = normalizePath(relativePath);
    setStatus("Caricamento file...");

    try {
        const content = await window.repoReader.readFile(normalized);
        state.selectedPath = normalized;
        state.selectedType = itemType;
        state.selectedContent = content;
        state.editable = true;
        state.dirty = false;

        updateSelectionInfo(normalized, itemType === "dir" ? "Cartella" : "File modificabile");
        elements.preview.innerHTML = renderMarkdown(content);
        setEditorContent(content, true);
        setStatus("File pronto per la modifica.");
    } catch (error) {
        state.selectedPath = normalized;
        state.selectedType = itemType;
        state.selectedContent = "";
        state.editable = false;
        updateSelectionInfo(normalized, itemType);
        elements.preview.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
        setEditorContent("", false);
        setStatus(error.message, "error");
    }
}

async function handleSave() {
    if (!state.editable || !state.selectedPath) {
        return;
    }

    try {
        await window.repoReader.writeFile(state.selectedPath, elements.editor.value);
        state.selectedContent = elements.editor.value;
        state.dirty = false;
        elements.preview.innerHTML = renderMarkdown(state.selectedContent);
        setStatus("File salvato correttamente.");
    } catch (error) {
        setStatus(error.message, "error");
    }
}

function handleSelection(pathName, type) {
    if (type === "dir") {
        openDirectory(pathName);
        return;
    }

    openFile(pathName, type);
}

async function bootstrap() {
    const bootstrapState = await window.repoReader.getBootstrapState();
    state.root = bootstrapState.root;
    elements.rootPath.textContent = bootstrapState.root;

    elements.fileList.addEventListener("click", event => {
        const target = event.target.closest("[data-path]");
        if (!target) {
            return;
        }

        handleSelection(target.dataset.path, target.dataset.type);
    });

    elements.breadcrumbs.addEventListener("click", event => {
        const target = event.target.closest("[data-path]");
        if (!target) {
            return;
        }

        openDirectory(target.dataset.path);
    });

    document.querySelectorAll("[data-action]").forEach(button => {
        button.addEventListener("click", async () => {
            const action = button.dataset.action;

            if (action === "up") {
                await openDirectory(state.currentPath ? state.currentPath.split("/").slice(0, -1).join("/") : "");
                return;
            }

            if (action === "refresh") {
                await loadDirectory(state.currentPath);
                return;
            }

            if (action === "open-folder") {
                await window.repoReader.openFolder(state.currentPath || "");
                return;
            }

            if (action === "open-code") {
                try {
                    await window.repoReader.openInCode(state.currentPath || "");
                    setStatus("Repository aperto in VS Code.");
                } catch (error) {
                    setStatus(error.message, "error");
                }
            }
        });
    });

    elements.saveFile.addEventListener("click", handleSave);

    elements.editor.addEventListener("input", () => {
        state.dirty = elements.editor.value !== state.selectedContent;
        setStatus(state.dirty ? "Modifiche non salvate." : "Nessuna modifica in sospeso.");
    });

    await loadDirectory(bootstrapState.defaultPath);

    if (!state.currentItems.length) {
        clearSelection();
    }
}

bootstrap().catch(error => {
    setStatus(error.message, "error");
    elements.preview.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
});