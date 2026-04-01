#!/usr/bin/env node

const path = require("path");
const { spawn } = require("child_process");

function getElectronBinary() {
    return require("electron");
}

function parseRootArgument(argv) {
    for (const argument of argv) {
        if (argument.startsWith("--root=")) {
            return argument.slice("--root=".length);
        }
    }

    const positional = argv.find(argument => !argument.startsWith("-"));
    return positional || process.cwd();
}

function run() {
    const electronBinary = getElectronBinary();
    const appRoot = path.resolve(__dirname, "..");
    const repoRoot = path.resolve(parseRootArgument(process.argv.slice(2)));
    const forwardedArgs = process.argv.slice(2).filter(argument => !argument.startsWith("--root="));
    const env = {
        ...process.env,
        REPO_READER_ROOT: repoRoot,
    };

    const child = spawn(electronBinary, [appRoot, ...forwardedArgs], {
        cwd: repoRoot,
        env,
        stdio: "inherit",
        windowsHide: true,
    });

    child.on("exit", code => {
        process.exitCode = code || 0;
    });

    child.on("error", error => {
        console.error("Impossibile avviare Electron:", error.message);
        process.exitCode = 1;
    });
}

run();