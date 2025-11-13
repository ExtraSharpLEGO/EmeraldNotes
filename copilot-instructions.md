# EmeraldNotes - Development Context for Claude

## Project Overview
**EmeraldNotes** is an Electron-based markdown notes application with a dark theme and green accents. It features real-time markdown preview, automatic backups, and session management.

## Key Features Implemented

### 0. Settings Menu
- **Location**: Native application menu bar → Settings
- **Options**:
  - "Generate Sample Document" (checkbox, checked by default)
  - Controls whether Sample Note.md is created in empty directories
- **Storage**: Saved in `%APPDATA%/emeraldnotes/settings.json`
- **Persistence**: Settings load on app startup and save immediately when changed
- **Implementation**: Lines 8-36 in main.js (loadSettings, saveSettings, appSettings object)

### 1. Core Markdown Editor
- **ContentEditable Preview**: Uses contenteditable div for WYSIWYG-style editing
- **Live Preview**: Real-time markdown rendering with marked.js
- **Syntax Highlighting**: Code blocks highlighted with highlight.js
- **Interactive Checkboxes**: Task lists are clickable in the preview panel
- **Drag & Drop Images**: Images can be dragged into the editor
- **Auto-save**: Files save automatically as you type

### 2. File Management
- **VS Code-Style File Tree**: Flat DOM structure with inline expansion, not nested containers
- **Directory Structure**: Sidebar shows folders and markdown files with depth-based indentation
- **Drag & Drop**: Move files between folders by dragging and dropping
- **Context Menus**: Right-click to rename/delete files and folders, or show in File Explorer
- **File Navigation**: Click files to open them - active file highlights green with bold text
- **Create New**: Buttons to create new notes and folders
- **Sample Note**: Auto-creates `Sample Note.md` in empty directories
- **Perfect Alignment**: Root items at 8px padding, nested items add 16px per depth level

### 3. Comprehensive Backup System

#### File Backups (Continuous)
- Created when a file is first edited
- Updated when navigating away from a file or closing the app
- Stored in `.backups/` folder maintaining directory structure
- One backup per file, continuously updated

#### Session Backups (Snapshot on App Open)
- Created once when app opens or directory is selected
- Immutable snapshot of all markdown files at that moment
- Stored in `.backups/.backup-session-{timestamp}/` folders
- **Timestamp Format**: `YYYY-MM-DDTHH-MM-SS` (UTC time)
- **Auto-cleanup**: Only keeps 10 most recent sessions, deletes oldest when creating 11th

#### Restore Options
- **Individual File Restore**: Click ↻ button in editor header
  - Shows modal with both SESSION and FILE backups for current file
  - Restoring from session backup only restores that ONE file
  - Color-coded badges: SESSION (green #4ade80), FILE (blue #60a5fa)
  
- **Full Session Restore**: Help menu → "Restore to Previous Session"
  - Access from application menu bar (top of window)
  - Shows modal with ONLY session backups
  - Restores ALL files to selected session state
  - Warning: "This will restore all files to a previous session"

### 4. UI/UX Details
- **Dark Theme**: #1a1a1a background, #e0e0e0 text
- **Green Accents**: #4ade80 for buttons, headers, borders
- **Menu Bar**: File, Edit, View, Help menus at top of application
- **Sidebar**: File tree on left with action buttons (New Note, New Folder, Change Directory)
- **Editor Header**: Note title, restore button ↻, toggle code view, delete button
- **Modal Dialogs**: Styled overlays for backups, input dialogs
- **Badge Design**: Uppercase text, colored backgrounds, black text, rounded corners, 11px font

## Critical Bug Fixes

### Code Block Language Dropdown Bug (FIXED - v1.0.1)
**Problem**: Changing the language dropdown on code blocks would delete the entire file content
**Root Cause**: Event bubbling - the `change` event was propagating to the preview container, triggering `handlePreviewInput` during the language change operation, which converted the partial/incorrect HTML state to markdown
**Solution**: 
1. Added `e.stopPropagation()` and `e.preventDefault()` to the dropdown change handler
2. Rewrote `updateCodeBlockLanguageInMarkdown()` to use content matching instead of fragile regex
   - Finds all code blocks in markdown
   - Matches by trimmed content comparison
   - Replaces using string concatenation for reliability
**Location**: `renderer.js` lines ~2380-2460
**Key Learning**: Always control event propagation on UI control events in contentEditable containers

### Inline Code Cursor Positioning Bug (FIXED - v1.0.1)
**Problem**: After typing `` `code` ``, cursor would jump to the beginning of the line
**Root Cause**: No text node existed after the code element for the cursor to rest in when no trailing space/text
**Solution**: 
1. Added zero-width space (`\u200B`) after inline code element when no trailing content exists
2. Updated cursor positioning logic to handle zero-width space node
3. Zero-width space is automatically removed during `htmlToMarkdown()` conversion
**Location**: `renderer.js` lines ~1502-1548
**Result**: Cursor stays outside closing backtick, enabling natural text flow after inline code

### Backup Restore Read-Only Bug (FIXED - v1.0.1)
**Problem**: After restoring a backup (both individual file and session), all files became read-only and uneditable in both preview and raw markdown modes
**Root Cause**: Race condition between `alert()` blocking the event loop and the `contentEditable` re-enabling timeout in `openFile()`
**Attempted Solutions**:
1. Reordered operations to await `openFile()` before showing alert - insufficient
2. Increased delay from 100ms to 200ms with explicit contentEditable re-enabling - still failed
**Final Solution**: Replaced alert dialogs with `location.reload()` to trigger full window reload
- Individual file restore: `location.reload()` after successful restore
- Session restore: `location.reload()` after successful restore
- Provides clean slate with all state properly initialized
**Location**: `renderer.js` lines ~604-618 (individual) and ~886-902 (session)
**Key Learning**: `alert()` blocks the JavaScript event loop and can prevent timeouts from executing. For state-sensitive operations, prefer window reload over showing blocking dialogs.

### Checkbox Deletion Bug (FIXED - v1.0.0)
**Problem**: Checking a checkbox would delete the entire markdown file
**Root Cause**: `toggleCheckbox()` was reading from `markdownInput.value` (hidden textarea) which was empty
**Solution**: Changed to `htmlToMarkdown(markdownPreview)` to get content from contentEditable element
**Location**: `renderer.js` line ~1547-1605

### Timestamp Parsing Bug (FIXED - v1.0.0)
**Problem**: Session backup timestamps showed 5 hours in the future
**Root Cause**: ISO timestamp was created without timezone indicator, parsed as local time instead of UTC
**Solution**: Added 'Z' suffix when parsing timestamp back: `isoTimestamp + 'Z'`
**Location**: `main.js` handlers for `get-backup-options` and `get-session-backups`

### Nested File Active State Bug (FIXED - v1.0.0)
**Problem**: Files in subfolders wouldn't highlight green when selected, only root files would
**Root Cause**: Windows paths with backslashes (`folder\file.md`) break CSS selectors in `querySelector()`
**Attempted Fix**: Tried escaping backslashes - didn't work consistently
**Final Solution**: Changed from `querySelector('.file-item[data-path="${filePath}"]')` to:
```javascript
document.querySelectorAll('.file-item').forEach(el => {
  el.classList.remove('active');
  if (el.dataset.path === filePath) {
    el.classList.add('active');
  }
});
```
**Why This Works**: Direct string comparison on `dataset.path` doesn't require CSS escaping
**Location**: `renderer.js` lines ~350-363
**Lesson**: Always use direct dataset comparison for Windows paths, never querySelector with path strings

## File Structure

```
project-root/
├── main.js              # Electron main process, IPC handlers, backup logic
├── preload.js           # IPC bridge between main and renderer
├── renderer.js          # UI logic, editor, backup modals (~2148 lines)
├── index.html           # Application structure
├── styles.css           # Dark theme styling
├── package.json         # Dependencies and build config
└── SAMPLE_NOTE.md       # Template note created in empty directories
```

## Key Code Locations

### main.js (~786 lines)
- `createSessionBackup(notesDir)` - Lines ~128-160: Creates timestamped session backup
- `cleanupOldSessionBackups(backupDir)` - Lines ~162-180: Keeps only 10 recent sessions
- `isDirectoryEmpty(dirPath)` - Lines ~182-203: Checks for .md files
- `createSampleNote(dirPath)` - Lines ~205-318: Creates Sample Note.md
- `get-backup-options` handler - Lines ~650-700: Returns file and session backups for specific file
- `get-session-backups` handler - Lines ~715-740: Returns all session backups
- `restore-from-backup` handler - Lines ~705-712: Restores single file
- `restore-session-backup` handler - Lines ~745-765: Restores all files from session

### renderer.js (~2299 lines)
- `renderFileTree(structure, parentElement, depth)` - Lines ~170-188: Renders file tree with depth tracking
- `createFolderElement(folder, depth)` - Lines ~189-280: VS Code-style folder with inline expansion
- `createFileElement(file, depth)` - Lines ~299-348: File element with depth-based padding and drag support
- `removeChildrenOfFolder(folderElement, folderDepth)` - Lines ~282-297: Removes child elements on collapse
- `showBackupRestoreModal(options)` - Lines ~385-530: Modal for restoring single file
- `showHelpMenu()` - Lines ~540-615: Help menu with "Restore to Previous Session" button
- `showSessionRestoreModal()` - Lines ~620-775: Modal for restoring all files from session
- `toggleCheckbox(checkbox)` - Lines ~1830-1888: Fixed checkbox toggling
- `restoreFileFromBackup()` - Lines ~349-367: Fetches backup options and shows modal
- `moveFileToFolder(filePath, targetFolderPath)` - Lines ~910-938: Handles drag-drop file moving
- **Lines 350-363**: CRITICAL active file selection fix using dataset comparison instead of querySelector

### preload.js (~20 lines)
- Exposes all IPC methods to renderer process
- Key methods: `getBackupOptions`, `restoreFromBackup`, `getSessionBackups`, `restoreSessionBackup`

## Deployment Configuration

### MSI Installer
- **Tool**: electron-builder v26.0.12
- **Target**: MSI (changed from NSIS)
- **Build Command**: `npm run build:msi`
- **Auto-update**: Removed (switched to manual MSI distribution)
- **Output**: `dist/EmeraldNotes 1.0.0.msi`

### package.json Build Config
```json
"build": {
  "appId": "com.emeraldnotes.app",
  "productName": "EmeraldNotes",
  "win": {
    "target": "msi"
  },
  "msi": {
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true
  }
}
```

## Important Notes

### Path Handling
- **Main Process**: Uses Node.js `path` module
- **Renderer Process**: Manual path construction (e.g., `state.basePath + '\\' + state.currentFile`)
- **Reason**: Context isolation enabled, avoid Node.js modules in renderer

### Backup Folder Exclusion
- `.backups` folder excluded from file tree
- All `.backup-session-*` folders hidden from user
- Recursive file scanning skips `.backups` directory

### Timestamp Format
- **Creation**: `new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)`
- **Parsing**: Add 'Z' suffix to indicate UTC timezone
- **Display**: `dateObj.toLocaleString()` for local time display

### ContentEditable vs Textarea
- **Preview Panel**: contentEditable div - user edits here
- **Hidden Textarea**: `markdownInput` - only used for code view toggle
- **Critical**: Always use `htmlToMarkdown(markdownPreview)` to get current content

## Development Commands

```powershell
# Install dependencies
npm install

# Run in development
npm start

# Build MSI installer
npm run build
npm run build:msi

# Output location
dist/EmeraldNotes 1.0.0.msi
```

## User Workflow

### Starting a New Notes Directory
1. Click "Choose Folder" button
2. Select directory
3. If empty, `Sample Note.md` is auto-created
4. Session backup is created immediately

### Editing and Backups
1. Open a file - file backup is created
2. Edit content - auto-saves to file
3. Navigate away - file backup is updated
4. Close app - all file backups are updated

### Restoring Individual File
1. Open file you want to restore
2. Click ↻ button in header
3. Choose from session or file backup (badges show type)
4. Confirm - only that file is restored

### Restoring All Files
1. Click Help menu in menu bar (top of window)
2. Click "Restore to Previous Session"
3. Choose session (all show SESSION badge)
4. Confirm - all files restored to that session

## Testing Checklist

- [ ] Create/edit/delete notes and folders
- [ ] Check checkboxes in preview panel (should not delete file)
- [ ] Verify session backup created on app open
- [ ] Verify file backup created when editing
- [ ] Test individual file restore (should only restore that file)
- [ ] Test full session restore (should restore all files)
- [ ] Open app 11 times, verify oldest session backup deleted
- [ ] Check timestamps show in local time (not 5 hours off)
- [ ] Verify badges show correctly (green SESSION, blue FILE)
- [ ] Test sample note creation in empty directory

## Common Issues & Solutions

### Issue: Timestamps Wrong
- Ensure 'Z' suffix added when parsing ISO timestamps
- Check both `get-backup-options` and `get-session-backups` handlers

### Issue: Checkboxes Deleting Content (FIXED - v2)
**Problem**: Originally was using `htmlToMarkdown(markdownPreview)`, but that was WRONG!
**Root Cause**: The HTML element `editor-content` is a DIV container, not a textarea. Trying to use `.value` on a DIV returns `undefined`
**Correct Solution**: Use `document.getElementById('markdown-input')` which is the hidden TEXTAREA that stores the markdown
**Location**: `renderer.js` line ~2022

**HTML Structure**:
```html
<div id="editor-content">  <!-- Container DIV -->
  <textarea id="markdown-input" style="display:none"></textarea>  <!-- This has .value! -->
  <div id="markdown-preview" contenteditable="true"></div>
</div>
```

### Issue: Checkbox Changes Not Saving (INVESTIGATING)
**Problem**: Checking a checkbox and immediately navigating away doesn't save the change
**Attempted Fix**: Made `toggleCheckbox()` async and added `await saveCurrentFile()`
**Current Status**: Still not working - needs further investigation
**Debugging**: Added extensive logging to `write-file` and `read-file` handlers in main.js
**Next Steps**: Check console logs to see if save is actually being called and completing

### Issue: Session Restore Not Working
- Check `restore-session-backup` handler uses `getAllMarkdownFiles()`
- Verify paths are constructed correctly with `path.join()`

### Issue: Too Many Session Backups
- Check `cleanupOldSessionBackups()` is called before creating new session
- Verify sort order is newest first (descending)

## Future Enhancement Ideas

- Export to PDF
- Search across all notes
- Tags/categories
- Keyboard shortcuts customization
- Themes selector
- Cloud sync integration
- Version history visualization

## CURRENT DEBUGGING: Checkbox Save Issue

**Status**: INVESTIGATING - Checkboxes not persisting when navigating away

**What We've Done**:
1. Made `toggleCheckbox()` async
2. Added `await saveCurrentFile(newContent)` to ensure save completes
3. Added extensive console logging to both renderer and main process

**Debug Logs Added**:
- `toggleCheckbox()` in renderer.js: Shows checkbox state, content being saved
- `saveCurrentFile()` in renderer.js: Shows file path, content preview
- `write-file` handler in main.js: Shows full path, content being written
- `read-file` handler in main.js: Shows content being read

**First Test Results**:
- User tested and NO checkbox debug logs appeared
- Only saw READ FILE logs when navigating between files
- NO CHECKBOX TOGGLE, NO SAVE FILE, NO WRITE FILE logs
- **Conclusion**: The checkbox click event is NOT firing!

**Additional Debugging Added**:
- Added `*** attachCheckboxListeners() CALLED ***` log
- Added `*** CHECKBOX CHANGE EVENT FIRED ***` log
- Need to verify:
  1. Are checkboxes being found? (should see "Found X checkboxes" log)
  2. Are event listeners being attached?
  3. Is the change event actually firing when clicked?

**Second Test - FOUND THE PROBLEM!**:
- Still no `attachCheckboxListeners()` log appearing
- This means `renderMarkdownPreview()` is either not running OR exiting early
- **HYPOTHESIS**: The code has a condition: `if (preview.contentEditable === 'true' && !forceRender) return`
- This SKIPS the render when preview is editable (which it always is after opening a file!)
- If render is skipped, checkbox listeners are NEVER attached!

**The Bug**: 
Line ~1659 in renderer.js has:
```javascript
if (preview.contentEditable === 'true' && !forceRender) {
  console.log('Skipping render - preview is editable');
  return; // ← This prevents attachCheckboxListeners() from being called!
}
```

**Next Test** (one more time):
1. Restart app
2. Open a note with checkboxes
3. Check console for: `*** SKIPPING RENDER - preview is editable ***`
4. If you see this, that's why checkboxes don't work!

**The Fix Applied**:
Changed `toggleCheckbox()` to call `renderMarkdownPreview(newContent, true)` with `forceRender=true`
This ensures the preview re-renders even when contentEditable='true', which:
1. Updates the checkbox visual state
2. Re-attaches all checkbox event listeners
3. Then re-enables contentEditable after 50ms delay

**Status**: FIXED - Ready for final testing

## VS Code File Tree Implementation

### Architecture Decision
**Pattern**: Flat DOM structure, not nested containers
- Children inserted as siblings after parent element
- Depth tracking passed through recursive calls
- Expansion uses `insertBefore` with `nextSibling` navigation
- Collapse removes all siblings with greater depth

### Key Functions
```javascript
// Render with depth tracking
renderFileTree(structure, parentElement, depth = 0)

// Create folder with inline expansion
createFolderElement(folder, depth) {
  // Children inserted AFTER this element, not inside
  // Click handler toggles collapsed class
  // Dynamic insertion on expand, removal on collapse
}

// Create file with depth-based padding
createFileElement(file, depth) {
  if (depth > 0) {
    fileDiv.style.paddingLeft = `${8 + (depth * 16)}px`;
  }
  // Root items (depth=0) use only CSS padding
}

// Remove children on collapse
removeChildrenOfFolder(folderElement, folderDepth) {
  // Loop through siblings after folder
  // Remove any with depth > folderDepth
}
```

### Why This Pattern?
1. **Matches VS Code UX**: Folders expand inline, not in nested containers
2. **Easier Drag-Drop**: Flat structure simplifies drop target logic
3. **Cleaner CSS**: No need for nested `.folder-children` selectors
4. **Better Performance**: Direct sibling manipulation vs DOM tree traversal

### Styling Details
```css
/* VS Code-style compact tree */
.folder-item, .file-item {
  height: 22px;
  padding: 4px 8px;
  line-height: 22px;
}

/* Active file highlighting */
.file-item.active {
  background-color: var(--bg-tertiary) !important;
  color: var(--accent-green) !important;
  font-weight: 600 !important;
}

/* Folder collapse animation */
.folder-icon {
  transition: transform 0.15s;
}
.folder-item.collapsed .folder-icon {
  transform: rotate(-90deg);
}
```

## Recent Fixes (v1.0.1)

### Event Propagation Pattern
When adding UI controls inside contentEditable containers:
1. Always call `e.stopPropagation()` and `e.preventDefault()` on control events
2. This prevents events from bubbling to the contentEditable's input handler
3. Example: Language selector dropdown on code blocks

### Zero-Width Space Pattern
For cursor positioning after inline elements:
1. Add `\u200B` (zero-width space) after element when no trailing content
2. Provides invisible text node for cursor placement
3. Remove during markdown conversion: `text.replace(/\u200B/g, '')`
4. Enables natural text flow after inline code/formatting

### State Reset Pattern
When complex state management becomes unreliable:
1. Consider full page reload: `location.reload()`
2. Especially after file system operations (restore, move, etc.)
3. Provides guaranteed clean state vs. partial re-initialization
4. Trade-off: Slight UX delay for guaranteed correctness

## Recent Changes (v1.0.2)

### Subfolder Image Support Feature
**Problem**: Images dropped into markdown files in subfolders couldn't be accessed because they were being saved to the root-level `img/` folder, but the relative path `img/image.png` doesn't resolve from subdirectories.

**Example of the Problem**:
```
Notes/
  img/                    ← Root img folder
    image.png
  Azure & Infrastructure/
    notes.md              ← File references img/image.png
                          ← Can't find ../img/image.png ✗
```

**Solution**: Images are now saved to an `img/` folder in the same directory as the markdown file being edited.

**Implementation**:

1. **main.js - Enhanced save-image Handler (line ~714)**:
   - Now accepts 4th parameter: `currentFilePath`
   - Determines target directory based on current file location
   - Creates `img` folder adjacent to the markdown file
   - Returns proper relative path
   ```javascript
   ipcMain.handle('save-image', async (event, basePath, fileName, base64Data, currentFilePath = '') => {
     let targetDir;
     if (currentFilePath) {
       const fileDir = path.dirname(path.join(basePath, currentFilePath));
       targetDir = path.join(fileDir, 'img');
     } else {
       targetDir = path.join(basePath, 'img'); // Fallback for backward compatibility
     }
     // ... creates folder and saves image
   });
   ```

2. **main.js - Hidden img Folders from File Tree**:
   - **Line 534**: Updated `buildDirectoryStructure()` to skip `img` folders (like `.backups`)
   - **Line 198**: Session backup skips img directories
   - **Line 248**: `isDirectoryEmpty()` ignores img folders
   - **Line 376**: File backup skips img directories
   - **Line 402**: `getAllMarkdownFiles()` skips img folders
   ```javascript
   if (entry.name === '.backups' || entry.name === 'img') {
     continue; // Skip these folders
   }
   ```

3. **renderer.js - Updated handleImageInsert (line ~1879)**:
   - Now passes `state.currentFile` to the save-image IPC handler
   - Enables backend to determine correct img folder location
   ```javascript
   const result = await window.electronAPI.saveImage(
     state.basePath, 
     fileName, 
     base64Data,
     state.currentFile // ← New parameter
   );
   ```

4. **preload.js - Updated IPC Bridge (line 13)**:
   - Added 4th parameter to bridge function
   ```javascript
   saveImage: (basePath, fileName, base64Data, currentFilePath) => 
     ipcRenderer.invoke('save-image', basePath, fileName, base64Data, currentFilePath)
   ```

**Result**:
```
Notes/
  Azure & Infrastructure/
    notes.md              ← Drops image here
    img/                  ← Folder created automatically (hidden from tree)
      image-123.png       ← Image saved here
  Kubernetes/
    setup.md              ← Drops image here
    img/                  ← Separate img folder (hidden from tree)
      image-456.png       ← Image saved here
```

**Benefits**:
- ✅ Images work correctly at any folder depth
- ✅ `img` folders hidden from file tree (cleaner UI)
- ✅ Each folder is self-contained with its images
- ✅ Moving folders keeps images with their markdown files
- ✅ Backward compatible with existing root-level images

**Key Learning**: When dealing with relative paths in nested folder structures, always calculate paths relative to the current file's location, not the project root.

## Contact & Version

- **Version**: 1.0.2
- **Developer**: Peyton Winn
- **Last Updated**: November 2025
- **Framework**: Electron 39.1.2
- **Status**: Production Ready
- **Node Version**: Check `package.json` for engine requirements
