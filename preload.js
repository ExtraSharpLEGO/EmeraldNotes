const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectNotesDirectory: () => ipcRenderer.invoke('select-notes-directory'),
  loadDirectoryStructure: (dirPath) => ipcRenderer.invoke('load-directory-structure', dirPath),
  readFile: (basePath, relativePath) => ipcRenderer.invoke('read-file', basePath, relativePath),
  writeFile: (basePath, relativePath, content) => ipcRenderer.invoke('write-file', basePath, relativePath, content),
  createNote: (basePath, folderPath, noteName) => ipcRenderer.invoke('create-note', basePath, folderPath, noteName),
  createFolder: (basePath, parentPath, folderName) => ipcRenderer.invoke('create-folder', basePath, parentPath, folderName),
  deleteItem: (basePath, relativePath) => ipcRenderer.invoke('delete-item', basePath, relativePath),
  renameItem: (basePath, oldPath, newName) => ipcRenderer.invoke('rename-item', basePath, oldPath, newName),
  moveItem: (basePath, itemPath, targetFolderPath, fileName) => ipcRenderer.invoke('move-item', basePath, itemPath, targetFolderPath, fileName),
  saveImage: (basePath, fileName, base64Data) => ipcRenderer.invoke('save-image', basePath, fileName, base64Data),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  fileNavigatedAway: (basePath, relativePath) => ipcRenderer.invoke('file-navigated-away', basePath, relativePath),
  getBackupOptions: (basePath, relativePath) => ipcRenderer.invoke('get-backup-options', basePath, relativePath),
  restoreFromBackup: (backupPath, targetPath) => ipcRenderer.invoke('restore-from-backup', backupPath, targetPath),
  getSessionBackups: (basePath) => ipcRenderer.invoke('get-session-backups', basePath),
  restoreSessionBackup: (sessionDir, notesDir) => ipcRenderer.invoke('restore-session-backup', sessionDir, notesDir),
  showInExplorer: (basePath, relativePath) => ipcRenderer.invoke('show-in-explorer', basePath, relativePath),
  // Menu event listeners
  onShowSessionRestore: (callback) => ipcRenderer.on('show-session-restore', callback)
});
