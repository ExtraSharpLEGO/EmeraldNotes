const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

let mainWindow;
let currentNotesDirectory = null;
let backupOnNavigate = new Map(); // Track files that need backup on navigation

// Settings
let appSettings = {
  generateSampleDocument: true,
  aiAssistant: {
    enabled: false,
    githubToken: '',
    model: 'gpt-4o-mini',
    maxTokens: 2000,
    temperature: 0.7
  }
};

// Load settings from file
function loadSettings() {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    if (fsSync.existsSync(settingsPath)) {
      const data = fsSync.readFileSync(settingsPath, 'utf-8');
      const loaded = JSON.parse(data);
      // Merge settings, ensuring aiAssistant structure exists
      appSettings = {
        ...appSettings,
        ...loaded,
        aiAssistant: { ...appSettings.aiAssistant, ...(loaded.aiAssistant || {}) }
      };
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

// Save settings to file
function saveSettings() {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    fsSync.writeFileSync(settingsPath, JSON.stringify(appSettings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving settings:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1a1a1a',
    title: 'EmeraldNotes',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: true,
    titleBarStyle: 'default',
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  // Create custom menu without Window option
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Note',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('new-note');
          }
        },
        {
          label: 'New Folder',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => {
            mainWindow.webContents.send('new-folder');
          }
        },
        { type: 'separator' },
        {
          label: 'Select Directory',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('select-directory');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { 
          role: 'zoomIn',
          accelerator: 'CmdOrCtrl+Plus'
        },
        { 
          role: 'zoomIn',
          accelerator: 'CmdOrCtrl+=',
          visible: false
        },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Settings',
      submenu: [
        {
          label: 'AI Assistant Configuration...',
          click: () => {
            mainWindow.webContents.send('open-ai-setup');
          }
        },
        { type: 'separator' },
        {
          label: 'Generate Sample Document',
          type: 'checkbox',
          checked: appSettings.generateSampleDocument,
          click: (menuItem) => {
            appSettings.generateSampleDocument = menuItem.checked;
            saveSettings();
            console.log('Generate Sample Document setting:', menuItem.checked);
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Restore to Previous Session',
          click: () => {
            mainWindow.webContents.send('show-session-restore');
          }
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            mainWindow.webContents.send('show-about');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow.loadFile('index.html');
  
  // Open DevTools automatically if DEVTOOLS environment variable is set
  if (process.env.DEVTOOLS === 'true') {
    mainWindow.webContents.openDevTools();
  }
}

// Backup functions
async function createBackupDirectory(notesDir) {
  const backupDir = path.join(notesDir, '.backups');
  try {
    await fs.mkdir(backupDir, { recursive: true });
    return backupDir;
  } catch (err) {
    console.error('Error creating backup directory:', err);
    return null;
  }
}

async function createSessionBackup(notesDir) {
  try {
    const backupDir = path.join(notesDir, '.backups');
    await fs.mkdir(backupDir, { recursive: true });
    
    // Clean up old session backups - keep only the 10 most recent
    await cleanupOldSessionBackups(backupDir);
    
    // Create session backup folder with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const sessionDir = path.join(backupDir, `.backup-session-${timestamp}`);
    await fs.mkdir(sessionDir, { recursive: true });
    
    const files = await getAllMarkdownFiles(notesDir);
    for (const file of files) {
      // Skip files in .backups and img directories
      if (file.includes('.backups') || file.includes(path.sep + 'img' + path.sep) || file.endsWith(path.sep + 'img')) continue;
      
      const relativePath = path.relative(notesDir, file);
      const sessionPath = path.join(sessionDir, relativePath);
      
      // Create subdirectories if needed
      await fs.mkdir(path.dirname(sessionPath), { recursive: true });
      
      // Copy file to session backup
      await fs.copyFile(file, sessionPath);
    }
    
    console.log(`Created session backup at ${sessionDir} with ${files.length} files`);
    return sessionDir;
  } catch (err) {
    console.error('Error creating session backup:', err);
    return null;
  }
}

async function cleanupOldSessionBackups(backupDir) {
  try {
    const entries = await fs.readdir(backupDir, { withFileTypes: true });
    const sessionDirs = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('.backup-session-'))
      .map(entry => ({
        name: entry.name,
        path: path.join(backupDir, entry.name),
        timestamp: entry.name.replace('.backup-session-', '')
      }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Sort newest first
    
    // If we have 10 or more, delete the oldest ones
    if (sessionDirs.length >= 9) {
      const toDelete = sessionDirs.slice(9); // Keep first 10, delete rest
      for (const dir of toDelete) {
        await fs.rm(dir.path, { recursive: true, force: true });
        console.log(`Deleted old session backup: ${dir.name}`);
      }
    }
  } catch (err) {
    console.error('Error cleaning up old session backups:', err);
  }
}

async function isDirectoryEmpty(dirPath) {
  try {
    const entries = await fs.readdir(dirPath);
    // Check if there are any .md files (excluding .backups and img folders)
    for (const entry of entries) {
      if (entry === '.backups' || entry === 'img') continue;
      const fullPath = path.join(dirPath, entry);
      const stat = await fs.stat(fullPath);
      
      if (stat.isFile() && entry.endsWith('.md')) {
        return false; // Found a markdown file
      } else if (stat.isDirectory()) {
        // Check subdirectories recursively
        const subEmpty = await isDirectoryEmpty(fullPath);
        if (!subEmpty) return false;
      }
    }
    return true; // No markdown files found
  } catch (err) {
    console.error('Error checking if directory is empty:', err);
    return false;
  }
}

async function createSampleNote(dirPath) {
  try {
    const sampleNotePath = path.join(dirPath, 'Sample Note.md');
    const sampleContent = `# Sample Note - Features Demo

Welcome to your Markdown Notes app! This note demonstrates all the markdown features available.

## Headings

You can use headings from H1 to H6:

### This is H3
#### This is H4

## Text Formatting

You can use **bold text**, *italic text*, or even ***bold and italic***.

You can also use ~~strikethrough~~ text.

## Lists

### Bullet Lists
- First item
- Second item
  - Nested item
  - Another nested item
- Third item

### Numbered Lists
1. First step
2. Second step
3. Third step

### Task Lists (Interactive!)
- [ ] Unchecked task - click the checkbox in the preview!
- [x] Completed task
- [ ] Another pending task
- [x] Another completed task

Try clicking the checkboxes in the preview panel →

## Links and Code

You can create [links](https://www.example.com) and inline \`code snippets\`.

### Code Blocks

\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\`

\`\`\`python
def greet(name):
    print("Hello, {name}!")
\`\`\`

## Quotes

> This is a blockquote.
> It can span multiple lines.
>
> - And contain lists
> - Or other elements

## Tables

| Feature | Status | Notes |
|---------|--------|-------|
| Markdown Preview | ✅ | Real-time |
| Task Lists | ✅ | Interactive |
| Code Blocks | ✅ | Syntax highlighting |
| Dark Theme | ✅ | Green accent |

## Horizontal Rules

You can add horizontal rules like this:

---

## Tips

1. **Auto-save**: Your notes save automatically as you type
2. **Folders**: Use folders to organize your notes
3. **Context menus**: Right-click files and folders for more options
4. **File system**: All notes are saved as \`.md\` files on your computer
5. **Backups**: Your files are automatically backed up - click the ↻ button to restore if needed

---

**Happy note-taking!** 📝✨`;

    await fs.writeFile(sampleNotePath, sampleContent, 'utf-8');
    console.log('Created Sample Note.md in empty directory');
  } catch (err) {
    console.error('Error creating sample note:', err);
  }
}

async function backupAllFiles(notesDir) {
  try {
    const backupDir = await createBackupDirectory(notesDir);
    if (!backupDir) return;

    const files = await getAllMarkdownFiles(notesDir);
    for (const file of files) {
      // Skip files in .backups and img directories
      if (file.includes('.backups') || file.includes(path.sep + 'img' + path.sep) || file.endsWith(path.sep + 'img')) continue;
      
      const relativePath = path.relative(notesDir, file);
      const backupPath = path.join(backupDir, relativePath);
      
      // Create subdirectories if needed
      await fs.mkdir(path.dirname(backupPath), { recursive: true });
      
      // Copy file to backup
      await fs.copyFile(file, backupPath);
    }
    
    console.log(`Backed up ${files.length} files to ${backupDir}`);
  } catch (err) {
    console.error('Error backing up files:', err);
  }
}

async function getAllMarkdownFiles(dir, fileList = []) {
  try {
    const files = await fs.readdir(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      
      if (stat.isDirectory() && file !== '.backups' && file !== 'img') {
        await getAllMarkdownFiles(filePath, fileList);
      } else if (file.endsWith('.md')) {
        fileList.push(filePath);
      }
    }
  } catch (err) {
    console.error('Error reading directory:', err);
  }
  
  return fileList;
}

async function createEditBackup(filePath, notesDir) {
  try {
    const backupDir = await createBackupDirectory(notesDir);
    if (!backupDir) return null;

    const relativePath = path.relative(notesDir, filePath);
    const backupPath = path.join(backupDir, relativePath);
    
    // Create subdirectories if needed
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    
    // Copy file to backup
    await fs.copyFile(filePath, backupPath);
    
    console.log(`Created edit backup for: ${relativePath}`);
    return backupPath;
  } catch (err) {
    console.error('Error creating edit backup:', err);
    return null;
  }
}

async function restoreFromBackup(filePath, notesDir) {
  try {
    const backupDir = path.join(notesDir, '.backups');
    const relativePath = path.relative(notesDir, filePath);
    const backupPath = path.join(backupDir, relativePath);
    
    // Check if backup exists
    try {
      await fs.access(backupPath);
    } catch {
      return { success: false, message: 'No backup found for this file' };
    }
    
    // Restore the backup
    await fs.copyFile(backupPath, filePath);
    
    return { success: true, message: 'File restored from backup successfully' };
  } catch (err) {
    console.error('Error restoring from backup:', err);
    return { success: false, message: `Error: ${err.message}` };
  }
}

app.whenReady().then(() => {
  loadSettings();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers for file system operations
ipcMain.handle('select-notes-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Notes Directory'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    currentNotesDirectory = result.filePaths[0];
    
    // Check if directory is empty (no .md files)
    const isEmpty = await isDirectoryEmpty(currentNotesDirectory);
    if (isEmpty && appSettings.generateSampleDocument) {
      await createSampleNote(currentNotesDirectory);
    }
    
    // Create session backup when directory is first opened
    await createSessionBackup(currentNotesDirectory);
    
    // Create backups of all files when directory is selected
    await backupAllFiles(currentNotesDirectory);
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('load-directory-structure', async (event, dirPath) => {
  try {
    currentNotesDirectory = dirPath;
    
    // Check if directory is empty (no .md files)
    const isEmpty = await isDirectoryEmpty(dirPath);
    if (isEmpty && appSettings.generateSampleDocument) {
      await createSampleNote(dirPath);
    }
    
    // Create session backup when directory is loaded (app startup)
    await createSessionBackup(dirPath);
    
    // Create backups of all files when directory is loaded
    await backupAllFiles(dirPath);
    const structure = await buildDirectoryStructure(dirPath);
    return { success: true, data: structure };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

async function buildDirectoryStructure(dirPath, relativePath = '') {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const structure = {
    folders: [],
    files: []
  };

  for (const entry of entries) {
    // Skip .backups and img folders
    if (entry.name === '.backups' || entry.name === 'img') {
      continue;
    }
    
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.join(relativePath, entry.name);

    if (entry.isDirectory()) {
      const subStructure = await buildDirectoryStructure(fullPath, relPath);
      structure.folders.push({
        name: entry.name,
        path: relPath,
        ...subStructure
      });
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      structure.files.push({
        name: entry.name,
        path: relPath
      });
    }
  }

  // Sort folders and files alphabetically
  structure.folders.sort((a, b) => a.name.localeCompare(b.name));
  structure.files.sort((a, b) => a.name.localeCompare(b.name));

  return structure;
}

ipcMain.handle('read-file', async (event, basePath, relativePath) => {
  try {
    const fullPath = path.join(basePath, relativePath);
    console.log('=== READ FILE DEBUG ===');
    console.log('Reading from:', fullPath);
    
    const content = await fs.readFile(fullPath, 'utf-8');
    console.log('Content length:', content.length);
    console.log('Content preview (first 200 chars):', content.substring(0, 200));
    
    // Create a backup when file is first opened for editing
    if (currentNotesDirectory) {
      await createEditBackup(fullPath, currentNotesDirectory);
      backupOnNavigate.set(fullPath, true);
    }
    
    console.log('=== READ FILE COMPLETE ===');
    return { success: true, content };
  } catch (error) {
    console.error('=== READ FILE ERROR ===', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-file', async (event, basePath, relativePath, content) => {
  try {
    const fullPath = path.join(basePath, relativePath);
    const dirPath = path.dirname(fullPath);
    
    console.log('=== WRITE FILE DEBUG ===');
    console.log('Full path:', fullPath);
    console.log('Content length:', content ? content.length : 'undefined/null');
    console.log('Content preview (first 200 chars):', content ? content.substring(0, 200) : 'NO CONTENT');
    
    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    
    console.log('File written successfully!');
    console.log('=== WRITE FILE COMPLETE ===');
    
    return { success: true };
  } catch (error) {
    console.error('=== WRITE FILE ERROR ===', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-note', async (event, basePath, folderPath, noteName) => {
  try {
    const fileName = noteName.endsWith('.md') ? noteName : `${noteName}.md`;
    const fullPath = path.join(basePath, folderPath || '', fileName);
    
    // Check if file already exists
    if (fsSync.existsSync(fullPath)) {
      return { success: false, error: 'File already exists' };
    }
    
    await fs.writeFile(fullPath, '', 'utf-8');
    return { success: true, path: path.join(folderPath || '', fileName) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-folder', async (event, basePath, parentPath, folderName) => {
  try {
    const fullPath = path.join(basePath, parentPath || '', folderName);
    
    // Check if folder already exists
    if (fsSync.existsSync(fullPath)) {
      return { success: false, error: 'Folder already exists' };
    }
    
    await fs.mkdir(fullPath, { recursive: true });
    return { success: true, path: path.join(parentPath || '', folderName) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-item', async (event, basePath, relativePath) => {
  try {
    const fullPath = path.join(basePath, relativePath);
    const stats = await fs.stat(fullPath);
    
    if (stats.isDirectory()) {
      await fs.rm(fullPath, { recursive: true, force: true });
    } else {
      await fs.unlink(fullPath);
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('rename-item', async (event, basePath, oldPath, newName) => {
  try {
    const oldFullPath = path.join(basePath, oldPath);
    const dirPath = path.dirname(oldFullPath);
    const newFullPath = path.join(dirPath, newName);
    
    if (fsSync.existsSync(newFullPath)) {
      return { success: false, error: 'Item with that name already exists' };
    }
    
    await fs.rename(oldFullPath, newFullPath);
    const newRelativePath = path.relative(basePath, newFullPath);
    
    return { success: true, newPath: newRelativePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('show-in-explorer', async (event, basePath, relativePath) => {
  try {
    const { shell } = require('electron');
    const fullPath = path.join(basePath, relativePath);
    
    // Show the file in File Explorer
    shell.showItemInFolder(fullPath);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('move-item', async (event, basePath, itemPath, targetFolderPath, fileName) => {
  try {
    const oldFullPath = path.join(basePath, itemPath);
    const newFullPath = path.join(basePath, targetFolderPath, fileName);
    
    // Check if target already exists
    if (fsSync.existsSync(newFullPath)) {
      return { success: false, error: 'An item with that name already exists in the target folder' };
    }
    
    // Move the file
    await fs.rename(oldFullPath, newFullPath);
    const newRelativePath = path.relative(basePath, newFullPath);
    
    return { success: true, newPath: newRelativePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-image', async (event, basePath, fileName, base64Data, currentFilePath = '') => {
  try {
    // Determine the directory where the img folder should be created
    // If currentFilePath is provided, create img folder in the same directory as the markdown file
    let targetDir;
    if (currentFilePath) {
      // Get the directory of the current markdown file
      const fileDir = path.dirname(path.join(basePath, currentFilePath));
      targetDir = path.join(fileDir, 'img');
    } else {
      // Fallback to root img directory for backward compatibility
      targetDir = path.join(basePath, 'img');
    }
    
    // Create img directory if it doesn't exist
    await fs.mkdir(targetDir, { recursive: true });
    
    // Save the image
    const filePath = path.join(targetDir, fileName);
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(filePath, buffer);
    
    // Return relative path from the markdown file to the image
    let relativePath;
    if (currentFilePath) {
      const fileDir = path.dirname(currentFilePath);
      relativePath = path.join(fileDir, 'img', fileName).replace(/\\/g, '/');
    } else {
      relativePath = path.join('img', fileName).replace(/\\/g, '/');
    }
    
    return { success: true, path: relativePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Open URL in external browser
ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Backup IPC handlers
ipcMain.handle('file-navigated-away', async (event, basePath, relativePath) => {
  try {
    const fullPath = path.join(basePath, relativePath);
    
    // Update backup when navigating away from a file
    if (currentNotesDirectory && backupOnNavigate.has(fullPath)) {
      await createEditBackup(fullPath, currentNotesDirectory);
      backupOnNavigate.delete(fullPath);
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-backup-options', async (event, basePath, relativePath) => {
  try {
    const backupDir = path.join(basePath, '.backups');
    const backupOptions = [];
    
    // Check for current file backup
    const currentBackupPath = path.join(backupDir, relativePath);
    try {
      const stats = await fs.stat(currentBackupPath);
      const localTime = new Date(stats.mtime).toLocaleString();
      backupOptions.push({
        type: 'file',
        label: `[FILE] ${localTime}`,
        timestamp: stats.mtime.toISOString(),
        path: currentBackupPath
      });
    } catch {
      // No current backup exists
    }
    
    // Check for session backups
    const backupEntries = await fs.readdir(backupDir, { withFileTypes: true });
    for (const entry of backupEntries) {
      if (entry.isDirectory() && entry.name.startsWith('.backup-session-')) {
        const sessionPath = path.join(backupDir, entry.name, relativePath);
        try {
          await fs.stat(sessionPath);
          // Extract timestamp from folder name: .backup-session-YYYY-MM-DDTHH-MM-SS
          const timestampStr = entry.name.replace('.backup-session-', '');
          // Convert back to ISO format with Z to indicate UTC: YYYY-MM-DDTHH:MM:SSZ
          const isoTimestamp = timestampStr.slice(0, 10) + 'T' + timestampStr.slice(11).replace(/-/g, ':') + 'Z';
          const dateObj = new Date(isoTimestamp);
          const localTime = dateObj.toLocaleString();
          backupOptions.push({
            type: 'session',
            label: `[SESSION] ${localTime}`,
            timestamp: isoTimestamp,
            path: sessionPath,
            sessionDir: path.join(backupDir, entry.name)
          });
        } catch {
          // File doesn't exist in this session backup
        }
      }
    }
    
    // Sort by timestamp (newest first)
    backupOptions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return { success: true, options: backupOptions };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('restore-from-backup', async (event, backupPath, targetPath) => {
  try {
    // Copy the backup file to the target location
    await fs.copyFile(backupPath, targetPath);
    return { success: true, message: 'File restored from backup successfully' };
  } catch (error) {
    return { success: false, message: `Error: ${error.message}` };
  }
});

// Get all session backups (for Help menu)
ipcMain.handle('get-session-backups', async (event, basePath) => {
  try {
    const backupDir = path.join(basePath, '.backups');
    const sessionBackups = [];
    
    const backupEntries = await fs.readdir(backupDir, { withFileTypes: true });
    for (const entry of backupEntries) {
      if (entry.isDirectory() && entry.name.startsWith('.backup-session-')) {
        // Extract timestamp from folder name
        const timestampStr = entry.name.replace('.backup-session-', '');
        const isoTimestamp = timestampStr.slice(0, 10) + 'T' + timestampStr.slice(11).replace(/-/g, ':') + 'Z';
        const dateObj = new Date(isoTimestamp);
        const localTime = dateObj.toLocaleString();
        
        sessionBackups.push({
          label: `[SESSION] ${localTime}`,
          timestamp: isoTimestamp,
          sessionDir: path.join(backupDir, entry.name)
        });
      }
    }
    
    // Sort by timestamp (newest first)
    sessionBackups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return { success: true, sessions: sessionBackups };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Restore all files from a session backup
ipcMain.handle('restore-session-backup', async (event, sessionDir, notesDir) => {
  try {
    // Get all files in the session backup
    const files = await getAllMarkdownFiles(sessionDir);
    let restoredCount = 0;
    
    for (const file of files) {
      const relativePath = path.relative(sessionDir, file);
      const targetPath = path.join(notesDir, relativePath);
      
      // Create subdirectories if needed
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      
      // Copy file from session backup to notes directory
      await fs.copyFile(file, targetPath);
      restoredCount++;
    }
    
    return { success: true, message: `Restored ${restoredCount} files from session backup!` };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Update backups before app closes
app.on('before-quit', async (event) => {
  if (currentNotesDirectory && backupOnNavigate.size > 0) {
    event.preventDefault();
    
    // Update all modified file backups
    for (const filePath of backupOnNavigate.keys()) {
      await createEditBackup(filePath, currentNotesDirectory);
    }
    
    backupOnNavigate.clear();
    app.quit();
  }
});

// AI Assistant IPC handlers
ipcMain.handle('get-ai-settings', async () => {
  return { success: true, settings: appSettings.aiAssistant };
});

ipcMain.handle('save-ai-settings', async (event, aiSettings) => {
  try {
    appSettings.aiAssistant = { ...appSettings.aiAssistant, ...aiSettings };
    saveSettings();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
