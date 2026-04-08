const { app, BrowserWindow, ipcMain, shell } = require("electron");
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