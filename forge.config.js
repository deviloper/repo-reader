module.exports = {
    packagerConfig: {
        asar: true,
    },
    rebuildConfig: {},
    makers: [
        {
            name: "@electron-forge/maker-squirrel",
            config: {
                name: "repo_reader",
                executableName: "repo-reader",
                setupExe: "repo-reader-installer.exe",
            },
        },
        {
            name: "@electron-forge/maker-zip",
            platforms: ["win32"],
        },
    ],
};
