const path = require("path");

const WINDOWS_ICON_PATH = path.join(__dirname, "src", "renderer", "favicon.ico");

module.exports = {
    packagerConfig: {
        asar: true,
        icon: WINDOWS_ICON_PATH,
    },
    rebuildConfig: {},
    makers: [
        {
            name: "@electron-forge/maker-squirrel",
            config: {
                name: "repo_reader",
                shortcutName: "Repo Reader",
                executableName: "repo-reader",
                setupExe: "repo-reader-installer.exe",
                setupIcon: WINDOWS_ICON_PATH,
            },
        },
        {
            name: "@electron-forge/maker-zip",
            platforms: ["win32"],
        },
    ],
};
