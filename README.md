# EmeraldNotes

A beautiful, feature-rich markdown notes application built with Electron. Dark theme with emerald green accents, real-time preview, and comprehensive backup system.

![Version](https://img.shields.io/badge/version-1.0.1-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Electron](https://img.shields.io/badge/electron-39.1.2-blue)

## 📥 Download & Installation

### Quick Install (Recommended)

1. **Download** the latest release from [GitHub Releases](https://github.com/ExtraSharpLEGO/EmeraldNotes/releases/latest)
2. **Download** the `EmeraldNotes-1.0.1.msi` installer file
3. **Run** the installer by double-clicking the downloaded `.msi` file
4. **Follow** the installation wizard (no configuration needed!)
5. **Launch** EmeraldNotes from your Start Menu or Desktop shortcut

> **System Requirements**: Windows 10 or higher • 512 MB RAM • 200 MB disk space
> 
> **Note**: The MSI installer is ~106 MB and includes everything you need to run EmeraldNotes.

### Build from Source

Want to contribute or customize? Build it yourself:

```bash
# Clone the repository
git clone https://github.com/ExtraSharpLEGO/EmeraldNotes.git
cd EmeraldNotes

# Install dependencies
npm install

# Run in development mode
npm start

# Build MSI installer
npm run build:msi
```

## ✨ Features

### 📝 Markdown Editor
- **Real-time Preview**: WYSIWYG-style editing with live markdown rendering
- **Syntax Highlighting**: Code blocks with beautiful syntax highlighting
- **Interactive Checkboxes**: Click to toggle task list items directly in preview
- **Rich Formatting**: Support for all standard markdown features
- **Drag & Drop Images**: Simply drag images into the editor
- **Auto-save**: Changes save automatically as you type

### 📁 File Management
- **VS Code-Style Explorer**: Collapsible folder tree with inline expansion
- **Drag & Drop**: Move files between folders effortlessly
- **Folder Organization**: Hierarchical folder structure in sidebar
- **Quick Actions**: Create notes and folders with keyboard shortcuts
- **Context Menus**: Right-click to rename, delete, or show in File Explorer
- **Directory Switching**: Easily switch between different note directories
- **Auto-created Sample**: Empty directories get a helpful sample note
- **Perfect Alignment**: Clean, depth-based indentation for nested items

### 💾 Comprehensive Backup System

#### Two-Tier Protection
1. **File Backups** (Continuous)
   - Created when you start editing
   - Updated when you navigate away or close the app
   - One backup per file, always current

2. **Session Backups** (Snapshots)
   - Created when app opens or directory selected
   - Immutable snapshot of all files at that moment
   - Keeps 10 most recent sessions automatically
   - Perfect for time-travel restoration

#### Restore Options
- **Individual File**: Click ↻ button in editor to restore specific file
- **Full Session**: Help menu → Restore to Previous Session for all files

### 🎨 Beautiful UI
- **Dark Theme**: Easy on the eyes with #1a1a1a background
- **Emerald Accents**: Vibrant #4ade80 green highlights
- **Clean Interface**: Intuitive sidebar and editor layout
- **Styled Modals**: Professional dialogs for backups and actions

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Clone or download this repository**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the app**
   ```bash
   npm start
   ```

### Building

To create an MSI installer for distribution:

```bash
npm run build
```

The installer will be created in the `dist/` folder.

## 📖 Usage

### First Launch
1. Click "Choose Folder" to select your notes directory
2. If empty, a sample note will be created automatically
3. Start editing or create new notes and folders

### Creating Notes
- **Button**: Click the + Note button in sidebar
- **Menu**: File → New Note
- **Shortcut**: `Ctrl+N` (Windows) or `Cmd+N` (Mac)

### Creating Folders
- **Button**: Click the + Folder button in sidebar
- **Menu**: File → New Folder
- **Shortcut**: `Ctrl+Shift+N` (Windows) or `Cmd+Shift+N` (Mac)

### Working with Backups

#### Restore a Single File
1. Open the file you want to restore
2. Click the ↻ (restore) button in the editor header
3. Choose from SESSION or FILE backups
4. Confirm to restore

#### Restore All Files to Previous Session
1. Click **Help** menu in the menu bar
2. Select **Restore to Previous Session**
3. Choose which session to restore from
4. Confirm to restore all files

### Interactive Checkboxes
- Type task lists in markdown: `- [ ] Task` or `- [x] Done`
- Click checkboxes directly in the preview panel
- Changes save automatically

## 🗂️ File Structure

```
EmeraldNotes/
├── main.js              # Electron main process
├── renderer.js          # UI logic and editor
├── preload.js           # IPC bridge
├── index.html           # Application structure
├── styles.css           # Dark theme styling
├── package.json         # Dependencies and config
├── SAMPLE_NOTE.md       # Template for new directories
└── README.md           # This file
```

## 🔧 Configuration

### Notes Directory
Your notes are stored as `.md` files in any directory you choose. The app remembers your last selected directory.

### Backup Location
Backups are stored in `.backups/` folder within your notes directory:
- `{filename}.md` - Continuous file backups
- `.backup-session-{timestamp}/` - Session snapshots

### Changing Directory
Click the 🏠 (home) icon in sidebar or use File → Select Directory

## ⌨️ Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|---------------|-----|
| New Note | `Ctrl+N` | `Cmd+N` |
| New Folder | `Ctrl+Shift+N` | `Cmd+Shift+N` |
| Open Directory | `Ctrl+O` | `Cmd+O` |
| Toggle Code View | Click button | Click button |
| Reload | `Ctrl+R` | `Cmd+R` |
| Toggle DevTools | `Ctrl+Shift+I` | `Cmd+Option+I` |
| Quit | `Ctrl+Q` | `Cmd+Q` |

## 🛠️ Technical Details

### Built With
- **Electron** 26.0.12 - Desktop application framework
- **Marked.js** - Markdown parsing and rendering
- **Highlight.js** - Syntax highlighting for code blocks
- **DOMPurify** - Safe HTML sanitization

### Architecture
- **Main Process**: File operations, IPC handlers, backup management
- **Renderer Process**: UI, editor, markdown preview
- **Preload Script**: Secure IPC bridge with context isolation

### Key Features Implementation

#### ContentEditable Editor
The preview panel is contentEditable, allowing direct WYSIWYG editing while maintaining markdown source.

#### Backup Algorithm
- **File Backups**: Copy on edit start, update on navigation/close
- **Session Backups**: Recursive copy on app open, cleanup keeps 10 newest
- **Timestamps**: UTC ISO format, displayed in local time

#### Checkbox Interaction
Checkboxes in preview are clickable. On click:
1. Parse preview HTML back to markdown
2. Toggle checkbox state in markdown
3. Re-render and save

## 🐛 Troubleshooting

### Issue: Notes not saving
**Solution**: Check that you have write permissions to the notes directory

### Issue: Backup not found
**Solution**: Backups are only created after you start editing. Open and edit a file first.

### Issue: Wrong timestamp on backups
**Solution**: This was fixed in v1.0.0. Update to latest version.

### Issue: Checkbox deleted file
**Solution**: This was fixed in v1.0.0. Update to latest version.

## 🤝 Contributing

This is a personal project, but suggestions and bug reports are welcome!

## 📄 License

MIT License - feel free to use this project as you wish.

## 🎯 Roadmap

Potential future enhancements:
- Export to PDF
- Full-text search across all notes
- Tags and categories
- Cloud sync integration
- Custom themes
- Plugin system

## 📝 Version History

### v1.0.1 (Current)
- **Fixed**: Code block language dropdown bug - changing language no longer deletes file content
  - Added event propagation prevention on dropdown change events
  - Improved code block matching using content comparison instead of fragile regex
- **Fixed**: Inline code cursor positioning - cursor now stays outside closing backtick
  - Added zero-width space after inline code for proper cursor placement
  - Enables natural text flow after typing `` `code` ``
- **Fixed**: Backup restore read-only bug - files remain editable after restore
  - Implemented window reload after restore operations
  - Works for both individual file and session restore
  - Files editable in both preview and raw markdown modes

### v1.0.0
- Initial release with full feature set
- Dark theme with emerald accents
- Two-tier backup system
- Interactive checkboxes
- MSI installer distribution
- Automatic session cleanup (10 most recent)

## 💡 Tips

1. **Organize with Folders**: Use nested folders to categorize your notes
2. **Use Backups**: Restore points are automatic - don't worry about losing work
3. **Markdown Shortcuts**: Learn basic markdown for faster note-taking
4. **Context Menus**: Right-click files and folders for quick actions
5. **Session Restore**: Perfect for undoing bulk changes or recovering from mistakes

## 🙏 Acknowledgments

- Markdown syntax by [John Gruber](https://daringfireball.net/projects/markdown/)
- Icons from [Feather Icons](https://feathericons.com/)
- Syntax highlighting by [highlight.js](https://highlightjs.org/)
- Built with [Electron](https://www.electronjs.org/)

---

**Made with ❤️ by Peyton Winn**

*Happy note-taking!* 📝✨
