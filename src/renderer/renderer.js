const TEXT_FILE_EXTENSIONS = new Set([
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
    ".htm",
    ".yml",
    ".yaml",
    ".xml",
    ".ini",
    ".toml",
    ".csv",
    ".env",
    ".sh",
    ".bat",
    ".cmd",
    ".ps1",
    ".log",
    ".conf",
    ".properties",
    ".gitignore",
    ".gitattributes",
    ".editorconfig",
    ".npmrc",
    ".nvmrc",
    ".prettierrc",
    ".eslintrc",
    ".stylelintrc",
    ".example",
    ".lock",
]);

const TEXT_FILE_NAMES = new Set([
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

const TEXT_FILE_PREFIXES = [".env"];

const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx"]);

const MONACO_LANGUAGE_BY_EXTENSION = new Map([
    [".md", "markdown"],
    [".mdx", "markdown"],
    [".json", "json"],
    [".js", "javascript"],
    [".jsx", "javascript"],
    [".ts", "typescript"],
    [".tsx", "typescript"],
    [".css", "css"],
    [".html", "html"],
    [".htm", "html"],
    [".yml", "yaml"],
    [".yaml", "yaml"],
    [".xml", "xml"],
    [".ini", "ini"],
    [".toml", "ini"],
    [".csv", "plaintext"],
    [".env", "ini"],
    [".sh", "shell"],
    [".bat", "bat"],
    [".cmd", "bat"],
    [".ps1", "powershell"],
]);

const PRINT_PRESETS = {
    restricted: {
        id: "restricted",
        label: "Riservato",
        shortLabel: "Riservato",
        note: "Distribuzione vietata salvo autorizzazione espressa del titolare del documento.",
    },
    internal: {
        id: "internal",
        label: "Interno",
        shortLabel: "Interno",
        note: "Documento destinato esclusivamente all'uso interno del personale aziendale.",
    },
    nda: {
        id: "nda",
        label: "Partner",
        shortLabel: "Partner",
        note: "Condivisione consentita solo con partner coperti da accordo di non divulgazione.",
    },
    public: {
        id: "public",
        label: "Pubblico",
        shortLabel: "Pubblico",
        note: "Documento distribuibile senza restrizioni di confidenzialita'.",
    },
};

const PRINT_PROFILE_STORAGE_KEY = "repo-reader.print-profile";

const state = {
    root: "",
    currentPath: "",
    currentItems: [],
    filteredItems: [],
    filterQuery: "",
    selectedPath: "",
    selectedType: "",
    selectedExtension: "",
    selectedContent: "",
    draftContent: "",
    editable: false,
    dirty: false,
    mode: "view",
    sidebarCollapsed: false,
    printPreset: "public",
    printProfile: {
        authorName: "",
        organizationName: "",
        includeOrganization: false,
    },
    pendingPrintMode: "print",
    editorKind: "fallback",
    monaco: null,
    monacoLoadPromise: null,
    editor: null,
    editorCreatePromise: null,
    themeDefined: false,
    suppressEditorEvent: false,
};

const elements = {
    rootPath: document.getElementById("root-path"),
    parentFolderButton: document.getElementById("parent-folder-button"),
    breadcrumbs: document.getElementById("breadcrumbs"),
    fileList: document.getElementById("file-list"),
    entryCount: document.getElementById("entry-count"),
    preview: document.getElementById("preview"),
    selectedFile: document.getElementById("selected-file"),
    selectedType: document.getElementById("selected-type"),
    sidebar: document.getElementById("sidebar"),
    sidebarToggle: document.getElementById("sidebar-toggle"),
    searchInput: document.getElementById("search-input"),
    clearFilter: document.getElementById("clear-filter"),
    modeView: document.querySelector('[data-mode="view"]'),
    modeEdit: document.querySelector('[data-mode="edit"]'),
    editorHost: document.getElementById("editor-host"),
    editorFallback: document.getElementById("editor"),
    overflowActions: document.getElementById("overflow-actions"),
    overflowButton: document.getElementById("overflow-button"),
    overflowMenu: document.getElementById("overflow-menu"),
    printDialog: document.getElementById("print-dialog"),
    closePrintDialog: document.getElementById("close-print-dialog"),
    cancelPrintDialog: document.getElementById("cancel-print-dialog"),
    confirmPrintDialog: document.getElementById("confirm-print-dialog"),
    printDialogPreset: document.getElementById("print-dialog-preset"),
    printDialogAuthorName: document.getElementById("print-dialog-author-name"),
    printDialogIncludeOrganization: document.getElementById("print-dialog-include-organization"),
    printDialogOrganizationName: document.getElementById("print-dialog-organization-name"),
    overflowMenuPrint: document.querySelector('[data-print-mode="print"]'),
    overflowMenuPdf: document.querySelector('[data-print-mode="pdf"]'),
    status: document.getElementById("status"),
    saveFile: document.getElementById("save-file"),
};

function getSelectedPrintPreset() {
    return PRINT_PRESETS[state.printPreset] || PRINT_PRESETS.public;
}

function loadPrintProfile() {
    try {
        const rawValue = window.localStorage.getItem(PRINT_PROFILE_STORAGE_KEY);

        if (!rawValue) {
            return;
        }

        const parsedValue = JSON.parse(rawValue);
        state.printProfile.authorName = String(parsedValue.authorName || "").trim();
        state.printProfile.organizationName = String(parsedValue.organizationName || parsedValue.companyName || "").trim();
        state.printProfile.includeOrganization = Boolean(parsedValue.includeOrganization);
    } catch {
        state.printProfile.authorName = "";
        state.printProfile.organizationName = "";
        state.printProfile.includeOrganization = false;
    }
}

function persistPrintProfile() {
    try {
        window.localStorage.setItem(PRINT_PROFILE_STORAGE_KEY, JSON.stringify(state.printProfile));
    } catch {
        // Ignore storage errors and keep the in-memory values.
    }
}

function syncPrintProfileInputs() {
    elements.printDialogPreset.value = state.printPreset;
    elements.printDialogAuthorName.value = state.printProfile.authorName;
    elements.printDialogIncludeOrganization.checked = state.printProfile.includeOrganization;
    elements.printDialogOrganizationName.value = state.printProfile.organizationName;
    updatePrintDialogOrganizationState();
}

function updatePrintProfileFromInputs() {
    state.printPreset = elements.printDialogPreset.value;
    state.printProfile.authorName = elements.printDialogAuthorName.value.trim();
    state.printProfile.includeOrganization = elements.printDialogIncludeOrganization.checked;
    state.printProfile.organizationName = elements.printDialogOrganizationName.value.trim();
    persistPrintProfile();
}

function isOrganizationRequiredForPreset(presetId = state.printPreset) {
    return presetId === "internal" || presetId === "nda";
}

function updatePrintDialogOrganizationState() {
    const organizationRequired = isOrganizationRequiredForPreset(elements.printDialogPreset.value);

    if (organizationRequired) {
        elements.printDialogIncludeOrganization.checked = true;
        elements.printDialogIncludeOrganization.disabled = true;
    } else {
        elements.printDialogIncludeOrganization.disabled = false;
    }

    elements.printDialogOrganizationName.disabled = !elements.printDialogIncludeOrganization.checked;
}

function openPrintDialog(printMode) {
    state.pendingPrintMode = printMode === "pdf" ? "pdf" : "print";
    syncPrintProfileInputs();
    elements.confirmPrintDialog.textContent = state.pendingPrintMode === "pdf" ? "Esporta PDF" : "Stampa";
    elements.printDialog.hidden = false;
    document.body.dataset.modal = "print";
    queueMicrotask(() => elements.printDialogAuthorName.focus());
}

function closePrintDialog() {
    elements.printDialog.hidden = true;
    delete document.body.dataset.modal;
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizePath(value) {
    return String(value || "").replace(/\\/g, "/");
}

function splitPath(value) {
    return normalizePath(value).split("/").filter(Boolean);
}

function getParentPath(value) {
    const fragments = splitPath(value);
    fragments.pop();
    return fragments.join("/");
}

function getExtension(value) {
    const normalized = normalizePath(value);
    const baseName = normalized.split("/").pop() || "";
    const index = baseName.lastIndexOf(".");

    if (index > 0) {
        return baseName.slice(index).toLowerCase();
    }

    if (baseName.startsWith(".")) {
        return baseName.toLowerCase();
    }

    return "";
}

function getBaseName(value) {
    return normalizePath(value).split("/").pop() || "";
}

function isExternalUrl(href) {
    return /^(https?:|mailto:|tel:|file:)/i.test(href);
}

function stripQueryAndFragment(href) {
    return String(href || "").trim().replace(/[?#].*$/, "");
}

function isEditableFilePath(filePath) {
    const extension = getExtension(filePath);
    const baseName = getBaseName(filePath).toLowerCase();

    return TEXT_FILE_EXTENSIONS.has(extension)
        || TEXT_FILE_NAMES.has(baseName)
    || TEXT_FILE_PREFIXES.some(prefix => baseName.startsWith(prefix))
    || baseName.startsWith("dockerfile");
}

function getFileTypeLabel(filePath, type) {
    if (type === "dir") {
        return "Cartella";
    }

    const extension = getExtension(filePath);

    if (MARKDOWN_EXTENSIONS.has(extension)) {
        return "Markdown";
    }

    if (extension === ".json") {
        return "JSON";
    }

    if (TEXT_FILE_EXTENSIONS.has(extension)) {
        return "Testo";
    }

    const baseName = getBaseName(filePath).toLowerCase();
    if (TEXT_FILE_NAMES.has(baseName) || TEXT_FILE_PREFIXES.some(prefix => baseName.startsWith(prefix)) || baseName.startsWith("dockerfile")) {
        return "Testo";
    }

    return extension ? extension.slice(1).toUpperCase() : "File";
}

function getPreviewContent() {
    return state.dirty ? state.draftContent : state.selectedContent;
}

function guessMonacoLanguage(filePath) {
    return MONACO_LANGUAGE_BY_EXTENSION.get(getExtension(filePath)) || "plaintext";
}

function resolveRelativeTarget(basePath, href) {
    const cleanedHref = stripQueryAndFragment(href);

    if (!cleanedHref) {
        return normalizePath(basePath);
    }

    if (isExternalUrl(cleanedHref)) {
        return cleanedHref;
    }

    const normalizedHref = normalizePath(cleanedHref);
    const targetFragments = normalizedHref.startsWith("/")
        ? []
        : splitPath(basePath);

    if (!normalizedHref.startsWith("/")) {
        targetFragments.pop();
    }

    for (const fragment of normalizedHref.replace(/^\//, "").split("/")) {
        if (!fragment || fragment === ".") {
            continue;
        }

        if (fragment === "..") {
            targetFragments.pop();
            continue;
        }

        targetFragments.push(fragment);
    }

    return targetFragments.join("/");
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

function renderPlainPreview(content) {
    return `<pre class="code-block md-block"><code>${escapeHtml(content || "")}</code></pre>`;
}

function renderJsonPreview(content) {
    try {
        return renderPlainPreview(JSON.stringify(JSON.parse(content), null, 2));
    } catch {
        return renderPlainPreview(content);
    }
}

function renderFilePreview(content, filePath) {
    const extension = getExtension(filePath);

    if (MARKDOWN_EXTENSIONS.has(extension)) {
        return renderMarkdown(content);
    }

    if (extension === ".json") {
        return renderJsonPreview(content);
    }

    return renderPlainPreview(content);
}

function setStatus(message, tone = "") {
    elements.status.textContent = message;

    if (tone) {
        elements.status.dataset.tone = tone;
        return;
    }

    delete elements.status.dataset.tone;
}

function updateModeButtons() {
    const isViewMode = state.mode === "view";

    elements.modeView.classList.toggle("is-active", isViewMode);
    elements.modeEdit.classList.toggle("is-active", !isViewMode);
    elements.modeView.setAttribute("aria-pressed", String(isViewMode));
    elements.modeEdit.setAttribute("aria-pressed", String(!isViewMode));
    document.body.dataset.mode = state.mode;
}

function updateEntryCount() {
    const visibleCount = state.filteredItems.length;
    const totalCount = state.currentItems.length;

    if (visibleCount === totalCount) {
        elements.entryCount.textContent = `${visibleCount} elementi`;
        return;
    }

    elements.entryCount.textContent = `${visibleCount}/${totalCount} elementi`;
}

function updateSelectionHeader() {
    if (!state.selectedPath) {
        elements.selectedFile.textContent = "Nessun file selezionato";
        elements.selectedType.textContent = "";
        return;
    }

    elements.selectedFile.textContent = state.selectedPath;
    elements.selectedType.textContent = getFileTypeLabel(state.selectedPath, state.selectedType);
}

function updateSaveButtonState() {
    elements.saveFile.disabled = !(state.editable && state.dirty);
}

function closeOverflowMenu() {
    if (elements.overflowMenu) {
        elements.overflowMenu.hidden = true;
        elements.overflowMenu.dataset.open = "false";
    }

    if (elements.overflowButton) {
        elements.overflowButton.setAttribute("aria-expanded", "false");
    }
}

function updateToolbarState() {
    const canPrint = state.selectedType === "file" && Boolean(state.selectedPath);

    if (elements.overflowMenuPrint) {
        elements.overflowMenuPrint.disabled = !canPrint;
    }

    if (elements.overflowMenuPdf) {
        elements.overflowMenuPdf.disabled = !canPrint;
    }

    if (!canPrint) {
        closeOverflowMenu();
    }

    if (elements.parentFolderButton) {
        elements.parentFolderButton.disabled = !state.currentPath;
    }
}

function openOverflowMenu() {
    if (!elements.overflowMenu || !elements.overflowButton) {
        return;
    }

    elements.overflowMenu.hidden = false;
    elements.overflowMenu.dataset.open = "true";
    elements.overflowButton.setAttribute("aria-expanded", "true");
}

function toggleOverflowMenu() {
    if (!elements.overflowMenu || !elements.overflowButton) {
        return;
    }

    if (elements.overflowMenu.hidden) {
        openOverflowMenu();
        return;
    }

    closeOverflowMenu();
}

function setSidebarCollapsed(collapsed) {
    state.sidebarCollapsed = Boolean(collapsed);
    document.body.dataset.sidebar = state.sidebarCollapsed ? "collapsed" : "open";

    if (elements.sidebarToggle) {
        elements.sidebarToggle.setAttribute("aria-pressed", String(!state.sidebarCollapsed));
        elements.sidebarToggle.textContent = state.sidebarCollapsed ? "Mostra indice" : "Nascondi indice";
    }

    if (state.editor && state.mode === "edit") {
        state.editor.layout();
    }
}

function validatePrintProfile() {
    const preset = getSelectedPrintPreset();

    if (!state.printProfile.authorName) {
        return "Inserisci nome e cognome dell'autore prima di stampare.";
    }

    if (isOrganizationRequiredForPreset(preset.id) && !state.printProfile.organizationName) {
        return "Inserisci il nome dell'organizzazione per il preset di stampa selezionato.";
    }

    if (state.printProfile.includeOrganization && !state.printProfile.organizationName) {
        return "Inserisci il nome dell'organizzazione oppure disattiva la relativa opzione.";
    }

    return "";
}

async function applyWorkspaceState(workspaceState, statusMessage) {
    if (!workspaceState || !workspaceState.root) {
        return;
    }

    closeOverflowMenu();
    state.root = workspaceState.root;
    state.currentPath = "";
    state.currentItems = [];
    state.filteredItems = [];
    state.filterQuery = "";
    elements.searchInput.value = "";
    clearSelection();
    elements.rootPath.textContent = workspaceState.root;

    await loadDirectory(workspaceState.defaultPath || "");
    updateSelectionHeader();
    syncEditorSurface();
    setStatus(statusMessage || "Workspace aggiornato.");
}

async function chooseWorkspace() {
    try {
        const result = await window.repoReader.chooseWorkspace();

        if (!result || result.canceled) {
            setStatus("Cambio workspace annullato.");
            return;
        }

        await applyWorkspaceState(result, `Workspace attivo: ${result.root}`);
    } catch (error) {
        setStatus(error.message, "error");
    }
}

function buildPrintSnapshot() {
    if (state.selectedType !== "file" || !state.selectedPath) {
        return null;
    }

    const preset = getSelectedPrintPreset();

    return {
        title: getBaseName(state.selectedPath) || "Documento",
        sourcePath: state.selectedPath,
        preset,
        authorName: state.printProfile.authorName,
        organizationName: state.printProfile.includeOrganization ? state.printProfile.organizationName : "",
        html: renderFilePreview(getPreviewContent(), state.selectedPath),
    };
}

async function printCurrentDocument(printMode) {
    updatePrintProfileFromInputs();

    const validationMessage = validatePrintProfile();

    if (validationMessage) {
        setStatus(validationMessage, "error");
        return;
    }

    const snapshot = buildPrintSnapshot();

    if (!snapshot) {
        setStatus("Seleziona un file da stampare.", "error");
        return;
    }

    closeOverflowMenu();
    closePrintDialog();
    setStatus(printMode === "pdf" ? "Esportazione PDF in corso..." : "Apertura finestra di stampa...");

    try {
        const result = await window.repoReader.printDocument(snapshot, { mode: printMode });

        if (printMode === "pdf") {
            if (result && result.canceled) {
                setStatus("Esportazione PDF annullata.");
                return;
            }

            setStatus(result?.savedPath ? `PDF salvato in ${result.savedPath}` : "PDF esportato.");
            return;
        }

        setStatus("Finestra di stampa pronta.");
    } catch (error) {
        setStatus(error.message, "error");
    }
}

function renderBreadcrumbs() {
    const container = document.createDocumentFragment();

    if (!state.currentPath) {
        const rootLabel = document.createElement("span");
        rootLabel.className = "breadcrumb breadcrumb-current";
        rootLabel.textContent = "Workspace";
        container.appendChild(rootLabel);
        elements.breadcrumbs.replaceChildren(container);
        return;
    }

    const rootButton = document.createElement("button");
    rootButton.type = "button";
    rootButton.textContent = "Workspace";
    rootButton.dataset.path = "";
    rootButton.className = "breadcrumb breadcrumb-root";
    container.appendChild(rootButton);

    let prefix = "";

    for (const fragment of splitPath(state.currentPath)) {
        prefix = prefix ? `${prefix}/${fragment}` : fragment;

        const separator = document.createElement("span");
        separator.className = "breadcrumb-separator";
        separator.textContent = "/";
        container.appendChild(separator);

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = fragment;
        button.dataset.path = prefix;
        button.className = "breadcrumb breadcrumb-link";
        container.appendChild(button);
    }

    elements.breadcrumbs.replaceChildren(container);
}

function renderFileList() {
    const normalizedFilter = state.filterQuery.trim().toLowerCase();
    state.filteredItems = state.currentItems.filter(item => {
        if (!normalizedFilter) {
            return true;
        }

        return item.name.toLowerCase().includes(normalizedFilter);
    });

    updateEntryCount();
    updateToolbarState();

    if (!state.filteredItems.length) {
        const empty = document.createElement("div");
        closeOverflowMenu();
        empty.className = "empty-state sidebar-empty";
        empty.textContent = state.filterQuery ? "Nessun risultato per il filtro corrente." : "Nessun file visibile in questa cartella.";
        elements.fileList.replaceChildren(empty);
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const item of state.filteredItems) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `file-entry ${item.type}${item.path === state.selectedPath ? " active" : ""}`;
        button.dataset.path = item.path;
        button.dataset.type = item.type;

        const icon = document.createElement("span");
        icon.className = `file-entry-icon ${item.type === "dir" ? "is-folder" : "is-file"}`;
        icon.setAttribute("aria-hidden", "true");

        const name = document.createElement("span");
        name.className = "file-name";
        name.textContent = item.name;

        button.title = item.type === "dir"
            ? `Cartella: ${item.name}`
            : `${item.name} - ${getFileTypeLabel(item.path, item.type)}`;

        button.append(icon, name);
        fragment.appendChild(button);
    }

    elements.fileList.replaceChildren(fragment);
}

function renderPreview() {
    if (!state.selectedPath) {
        elements.preview.innerHTML = '<p class="empty-state">Seleziona un file per aprire l’anteprima oppure passa alla modalità modifica.</p>';
        return;
    }

    if (state.selectedType === "dir") {
        elements.preview.innerHTML = '<p class="empty-state">Cartella selezionata. Usa il pannello a sinistra per aprire una sottocartella o un file.</p>';
        return;
    }

    elements.preview.innerHTML = renderFilePreview(getPreviewContent(), state.selectedPath);
}

function updateEditorSurfaceVisibility() {
    if (state.editorKind === "monaco" && state.editor) {
        elements.editorHost.hidden = false;
        elements.editorFallback.hidden = true;
        return;
    }

    elements.editorHost.hidden = true;
    elements.editorFallback.hidden = false;
}

function syncEditorSurface() {
    const content = getPreviewContent();
    const language = guessMonacoLanguage(state.selectedPath);

    updateEditorSurfaceVisibility();

    if (state.editorKind === "monaco" && state.editor && state.monaco) {
        state.suppressEditorEvent = true;

        const model = state.editor.getModel();
        if (model) {
            state.monaco.editor.setModelLanguage(model, language);
        }

        state.editor.updateOptions({
            readOnly: !state.editable,
        });
        state.editor.setValue(content || "");

        state.suppressEditorEvent = false;
        updateSaveButtonState();
        return;
    }

    elements.editorFallback.readOnly = !state.editable;
    elements.editorFallback.value = content || "";
    updateSaveButtonState();
}

function setSelection(pathName, type, content, editable) {
    state.selectedPath = normalizePath(pathName);
    state.selectedType = type;
    state.selectedExtension = getExtension(pathName);
    state.selectedContent = content || "";
    state.draftContent = content || "";
    state.editable = Boolean(editable);
    state.dirty = false;

    updateSelectionHeader();
    renderFileList();
    renderPreview();
    syncEditorSurface();
}

function clearSelection() {
    closeOverflowMenu();
    state.selectedPath = "";
    state.selectedType = "";
    state.selectedExtension = "";
    state.selectedContent = "";
    state.draftContent = "";
    state.editable = false;
    state.dirty = false;

    updateSelectionHeader();
    renderFileList();
    renderPreview();
    syncEditorSurface();
}

async function openDirectory(relativePath = "") {
    await loadDirectory(relativePath);
}

async function openFile(relativePath) {
    const normalizedPath = normalizePath(relativePath);
    setStatus("Caricamento file...");

    try {
        const content = await window.repoReader.readFile(normalizedPath);
        setSelection(normalizedPath, "file", content, isEditableFilePath(normalizedPath));

        if (state.mode === "edit") {
            await ensureMonacoEditor();
            syncEditorSurface();
        }

        setStatus("File caricato.");
    } catch (error) {
        state.selectedPath = normalizedPath;
        state.selectedType = "file";
        state.selectedExtension = getExtension(normalizedPath);
        state.selectedContent = "";
        state.draftContent = "";
        state.editable = false;
        state.dirty = false;

        updateSelectionHeader();
        renderFileList();
        elements.preview.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
        syncEditorSurface();
        setStatus(error.message, "error");
    }
}

async function loadDirectory(relativePath = "") {
    const normalizedPath = normalizePath(relativePath);
    setStatus("Caricamento cartella...");

    try {
        const result = await window.repoReader.listDirectory(normalizedPath);
        const previousSelection = state.selectedPath;
        const shouldKeepSelection = previousSelection && getParentPath(previousSelection) === (result.current || "");

        state.currentPath = result.current || "";
        state.currentItems = result.items || [];

        elements.rootPath.textContent = `${state.root}${state.currentPath ? ` / ${state.currentPath}` : ""}`;
        renderBreadcrumbs();
        renderFileList();

        if (shouldKeepSelection && state.selectedType === "file" && !state.dirty) {
            const content = await window.repoReader.readFile(previousSelection);
            state.selectedContent = content;
            state.draftContent = content;
            renderPreview();
            syncEditorSurface();
        } else if (!shouldKeepSelection) {
            clearSelection();
        }

        if (!state.selectedPath) {
            renderPreview();
        }

        setStatus("Cartella caricata.");
    } catch (error) {
        setStatus(error.message, "error");
        elements.preview.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
    }
}

function readEditorValue() {
    if (state.editorKind === "monaco" && state.editor) {
        return state.editor.getValue();
    }

    return elements.editorFallback.value;
}

async function loadMonaco() {
    if (state.monaco) {
        return state.monaco;
    }

    if (state.monacoLoadPromise) {
        return state.monacoLoadPromise;
    }

    if (!window.require || typeof window.require.config !== "function") {
        throw new Error("loader Monaco non disponibile");
    }

    state.monacoLoadPromise = new Promise((resolve, reject) => {
        const monacoBaseUrl = new URL("../../node_modules/monaco-editor/min/vs", window.location.href)
            .toString()
            .replace(/\/$/, "");

        window.require.config({
            paths: {
                vs: monacoBaseUrl,
            },
        });

        window.MonacoEnvironment = {
            getWorkerUrl() {
                const workerSource = [
                    `self.MonacoEnvironment = { baseUrl: ${JSON.stringify(monacoBaseUrl)} };`,
                    `importScripts(${JSON.stringify(`${monacoBaseUrl}/base/worker/workerMain.js`)});`,
                ].join("\n");

                return `data:text/javascript;charset=utf-8,${encodeURIComponent(workerSource)}`;
            },
        };

        window.require(["vs/editor/editor.main"], () => {
            if (!window.monaco) {
                reject(new Error("Monaco non inizializzato"));
                return;
            }

            resolve(window.monaco);
        }, error => {
            reject(error instanceof Error ? error : new Error(String(error)));
        });
    }).then(monaco => {
        state.monaco = monaco;
        return monaco;
    });

    return state.monacoLoadPromise;
}

async function ensureMonacoEditor() {
    if (state.editorKind === "monaco" && state.editor) {
        return state.editor;
    }

    if (state.editorCreatePromise) {
        return state.editorCreatePromise;
    }

    state.editorCreatePromise = (async () => {
        try {
            setStatus("Caricamento Monaco Editor...");

            const monaco = await loadMonaco();
            state.monaco = monaco;

            if (!state.themeDefined) {
                try {
                    monaco.editor.defineTheme("repo-reader-dark", {
                        base: "vs-dark",
                        inherit: true,
                        rules: [
                            { token: "comment", foreground: "7c8aa8", fontStyle: "italic" },
                            { token: "string", foreground: "b5e48c" },
                            { token: "keyword", foreground: "7fb5ff" },
                        ],
                        colors: {
                            "editor.background": "#050b16",
                            "editor.foreground": "#eef4ff",
                            "editorLineNumber.foreground": "#547096",
                            "editorCursor.foreground": "#7fb5ff",
                            "editor.selectionBackground": "#28497c",
                            "editor.inactiveSelectionBackground": "#1d3355",
                            "editorLineNumber.activeForeground": "#a5c2ee",
                        },
                    });
                    state.themeDefined = true;
                } catch {
                    state.themeDefined = true;
                }
            }

            state.editorKind = "monaco";
            elements.editorHost.hidden = false;
            elements.editorFallback.hidden = true;
            elements.editorHost.replaceChildren();

            state.editor = monaco.editor.create(elements.editorHost, {
                value: getPreviewContent(),
                language: guessMonacoLanguage(state.selectedPath),
                theme: "repo-reader-dark",
                automaticLayout: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                fontSize: 14,
                lineNumbers: "on",
                tabSize: 2,
                renderWhitespace: "selection",
                readOnly: !state.editable,
            });

            state.editor.onDidChangeModelContent(() => {
                if (state.suppressEditorEvent) {
                    return;
                }

                state.draftContent = state.editor.getValue();
                state.dirty = state.draftContent !== state.selectedContent;
                updateSaveButtonState();
                setStatus(state.dirty ? "Modifiche non salvate." : "Nessuna modifica in sospeso.");
            });

            syncEditorSurface();

            if (state.mode === "edit") {
                state.editor.layout();
            }

            return state.editor;
        } catch (error) {
            state.editorKind = "fallback";
            elements.editorHost.hidden = true;
            elements.editorFallback.hidden = false;
            setStatus(`Monaco non disponibile: ${error.message}`, "error");
            syncEditorSurface();
            return null;
        } finally {
            state.editorCreatePromise = null;
        }
    })();

    return state.editorCreatePromise;
}

async function setMode(nextMode) {
    if (nextMode !== "view" && nextMode !== "edit") {
        return;
    }

    closeOverflowMenu();
    state.mode = nextMode;
    updateModeButtons();

    if (nextMode === "edit") {
        await ensureMonacoEditor();
        syncEditorSurface();

        if (state.editor && state.mode === "edit") {
            state.editor.layout();
        }

        if (state.selectedPath) {
            setStatus(state.dirty ? "Modifica attiva con modifiche non salvate." : "Modifica attiva.");
        } else {
            setStatus("Seleziona un file per iniziare a modificare.");
        }

        return;
    }

    renderPreview();
    setStatus("Visualizzazione attiva.");
}

function filterItems(items, query) {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
        return items;
    }

    return items.filter(item => item.name.toLowerCase().includes(normalizedQuery));
}

function handlePreviewLinkClick(event) {
    const target = event.target.closest("a.md-link");

    if (!target) {
        return;
    }

    event.preventDefault();

    const href = target.getAttribute("href") || "";

    if (isExternalUrl(href)) {
        window.repoReader.openExternal(href).catch(error => setStatus(error.message, "error"));
        return;
    }

    const resolvedTarget = resolveRelativeTarget(state.selectedPath || state.currentPath || "", href);

    if (!resolvedTarget) {
        return;
    }

    openResolvedTarget(resolvedTarget).catch(error => setStatus(error.message, "error"));
}

async function saveCurrentFile() {
    if (!state.editable || !state.selectedPath) {
        return;
    }

    try {
        const content = readEditorValue();
        await window.repoReader.writeFile(state.selectedPath, content);

        state.selectedContent = content;
        state.draftContent = content;
        state.dirty = false;

        renderPreview();
        syncEditorSurface();
        setStatus("File salvato correttamente.");
    } catch (error) {
        setStatus(error.message, "error");
    }
}

async function openResolvedTarget(resolvedTarget) {
    const extension = getExtension(resolvedTarget);

    if (extension) {
        await openFile(resolvedTarget);
        return;
    }

    try {
        await window.repoReader.readFile(resolvedTarget);
        await openFile(resolvedTarget);
    } catch {
        await openDirectory(resolvedTarget);
    }
}

function bindEvents() {
    elements.fileList.addEventListener("click", event => {
        const target = event.target.closest("[data-path]");

        if (!target) {
            return;
        }

        const pathName = target.dataset.path || "";
        const type = target.dataset.type || "file";

        if (type === "dir") {
            openDirectory(pathName).catch(error => setStatus(error.message, "error"));
            return;
        }

        openFile(pathName).catch(error => setStatus(error.message, "error"));
    });

    elements.breadcrumbs.addEventListener("click", event => {
        const target = event.target.closest("[data-path]");

        if (!target) {
            return;
        }

        openDirectory(target.dataset.path || "").catch(error => setStatus(error.message, "error"));
    });

    if (elements.parentFolderButton) {
        elements.parentFolderButton.addEventListener("click", () => {
            openDirectory(state.currentPath ? getParentPath(state.currentPath) : "").catch(error => setStatus(error.message, "error"));
        });
    }

    elements.preview.addEventListener("click", handlePreviewLinkClick);

    elements.searchInput.addEventListener("input", () => {
        state.filterQuery = elements.searchInput.value;
        renderFileList();
    });

    elements.searchInput.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            elements.searchInput.value = "";
            state.filterQuery = "";
            renderFileList();
            elements.searchInput.blur();
        }
    });

    elements.clearFilter.addEventListener("click", () => {
        elements.searchInput.value = "";
        state.filterQuery = "";
        renderFileList();
        elements.searchInput.focus();
    });

    elements.modeView.addEventListener("click", () => {
        setMode("view").catch(error => setStatus(error.message, "error"));
    });

    elements.modeEdit.addEventListener("click", () => {
        setMode("edit").catch(error => setStatus(error.message, "error"));
    });

    elements.sidebarToggle.addEventListener("click", () => {
        setSidebarCollapsed(!state.sidebarCollapsed);
    });

    elements.printDialogPreset.addEventListener("change", () => {
        state.printPreset = elements.printDialogPreset.value;
        updatePrintDialogOrganizationState();
        setStatus(`Preset stampa: ${getSelectedPrintPreset().label}.`);
    });

    elements.printDialogAuthorName.addEventListener("input", updatePrintProfileFromInputs);
    elements.printDialogIncludeOrganization.addEventListener("change", () => {
        updatePrintDialogOrganizationState();
        updatePrintProfileFromInputs();
    });
    elements.printDialogOrganizationName.addEventListener("input", updatePrintProfileFromInputs);
    elements.closePrintDialog.addEventListener("click", closePrintDialog);
    elements.cancelPrintDialog.addEventListener("click", closePrintDialog);
    elements.confirmPrintDialog.addEventListener("click", () => {
        printCurrentDocument(state.pendingPrintMode).catch(error => setStatus(error.message, "error"));
    });

    elements.overflowButton.addEventListener("click", event => {
        event.preventDefault();
        toggleOverflowMenu();
    });

    elements.saveFile.addEventListener("click", () => {
        saveCurrentFile().catch(error => setStatus(error.message, "error"));
    });

    elements.editorFallback.addEventListener("input", () => {
        if (state.editorKind === "monaco" && state.editor) {
            return;
        }

        state.draftContent = elements.editorFallback.value;
        state.dirty = state.draftContent !== state.selectedContent;
        updateSaveButtonState();
        setStatus(state.dirty ? "Modifiche non salvate." : "Nessuna modifica in sospeso.");
    });

    window.addEventListener("beforeunload", () => {
        if (state.editor) {
            state.editor.dispose();
        }
    });

    document.querySelectorAll("[data-overflow-action]").forEach(button => {
        button.addEventListener("click", async () => {
            const action = button.dataset.overflowAction;
            closeOverflowMenu();

            if (action === "choose-workspace") {
                await chooseWorkspace();
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
                await window.repoReader.openInCode(state.currentPath || "");
                setStatus("Repository aperto in VS Code.");
                return;
            }
        });
    });

    if (elements.overflowMenu) {
        elements.overflowMenu.addEventListener("click", event => {
            const target = event.target.closest("[data-print-mode]");

            if (!target) {
                return;
            }

            event.preventDefault();
            openPrintDialog(target.dataset.printMode);
        });
    }

    elements.printDialog.addEventListener("click", event => {
        if (event.target.closest("[data-modal-close='print']")) {
            closePrintDialog();
        }
    });

    document.addEventListener("click", event => {
        if (!elements.overflowActions || elements.overflowMenu.hidden) {
            return;
        }

        if (event.target instanceof Node && elements.overflowActions.contains(event.target)) {
            return;
        }

        closeOverflowMenu();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            if (!elements.printDialog.hidden) {
                closePrintDialog();
                return;
            }

            closeOverflowMenu();
        }
    });
}

async function bootstrap() {
    loadPrintProfile();
    updateModeButtons();
    setSidebarCollapsed(false);
    updateToolbarState();
    syncPrintProfileInputs();
    elements.editorHost.hidden = true;
    elements.editorFallback.hidden = false;
    bindEvents();

    const bootstrapState = await window.repoReader.getBootstrapState();
    await applyWorkspaceState(bootstrapState, "Pronto.");

    if (!state.currentItems.length) {
        renderPreview();
    }

    updateSelectionHeader();
    syncEditorSurface();
}

bootstrap().catch(error => {
    setStatus(error.message, "error");
    elements.preview.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
});
