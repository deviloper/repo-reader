const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("repoReader", {
    getBootstrapState: () => ipcRenderer.invoke("repo:get-bootstrap"),
    listDirectory: relativePath => ipcRenderer.invoke("repo:list-directory", relativePath),
    readFile: relativePath => ipcRenderer.invoke("repo:read-file", relativePath),
    writeFile: (relativePath, content) => ipcRenderer.invoke("repo:write-file", relativePath, content),
    openFolder: relativePath => ipcRenderer.invoke("repo:open-folder", relativePath),
    openInCode: relativePath => ipcRenderer.invoke("repo:open-in-code", relativePath),
    openExternal: url => ipcRenderer.invoke("repo:open-external", url),
    printDocument: (snapshot, options) => ipcRenderer.invoke("repo:print-document", snapshot, options),
    chooseWorkspace: () => ipcRenderer.invoke("repo:choose-workspace"),
});