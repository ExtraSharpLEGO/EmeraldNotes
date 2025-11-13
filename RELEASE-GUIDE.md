# Creating a GitHub Release for EmeraldNotes

This guide explains how to create a release on GitHub and upload the MSI installer so users can download it.

## Steps to Create a Release

### 1. Navigate to Releases

1. Go to your GitHub repository: https://github.com/ExtraSharpLEGO/EmeraldNotes
2. Click on **"Releases"** in the right sidebar (or go to `/releases`)
3. Click **"Draft a new release"**

### 2. Create a New Tag

1. In the "Choose a tag" dropdown, type: `v1.0.0`
2. Click **"Create new tag: v1.0.0 on publish"**

### 3. Fill in Release Information

**Release title:** `EmeraldNotes v1.0.0 - Initial Release`

**Description (copy this):**

```markdown
# 📝 EmeraldNotes v1.0.0

First official release of EmeraldNotes - a beautiful markdown notes application!

## ✨ What's New

- **VS Code-Style File Explorer** - Collapsible folders with inline expansion
- **Drag & Drop** - Move files between folders effortlessly  
- **Real-time Markdown Preview** - WYSIWYG editing with live rendering
- **Interactive Checkboxes** - Click to toggle task list items
- **Comprehensive Backup System** - Two-tier backup (file + session)
- **Dark Theme** - Easy on the eyes with emerald green accents
- **Auto-save** - Never lose your work

## 📥 Installation

1. Download `EmeraldNotes-1.0.0.msi` below
2. Run the installer
3. Launch from Start Menu

**Requirements:** Windows 10+ • 512 MB RAM • 200 MB disk space

## 🐛 Known Issues

None reported yet!

## 💚 Feedback

Found a bug or have a suggestion? [Open an issue](https://github.com/ExtraSharpLEGO/EmeraldNotes/issues)!
```

### 4. Upload the MSI Installer

1. Scroll down to **"Attach binaries by dropping them here or selecting them"**
2. Click to browse or drag and drop: `dist/EmeraldNotes 1.0.0.msi`
3. Wait for the upload to complete (~106 MB)

### 5. Publish the Release

1. Make sure **"Set as the latest release"** is checked
2. Click **"Publish release"**

## Done! 🎉

Users can now download the installer from:
`https://github.com/ExtraSharpLEGO/EmeraldNotes/releases/latest`

## For Future Releases

When you make updates:

1. Update the version in `package.json`
2. Rebuild the MSI: `npm run build:msi`
3. Create a new release with the new version tag (e.g., `v1.1.0`)
4. Include a changelog of what changed
5. Upload the new MSI

---

**Pro Tip:** You can also mark releases as "Pre-release" if you want to test with a smaller group before the official release!
