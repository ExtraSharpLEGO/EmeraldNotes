// marked and DOMPurify are loaded via CDN in index.html
// They are available as global variables

// App State
let state = {
  basePath: localStorage.getItem('notesBasePath') || null,
  currentFile: localStorage.getItem('lastOpenedFile') || null,
  directoryStructure: null,
  saveTimeout: null,
  renderTimeout: null,
  ignoreInputCount: 0  // Counter to skip handlePreviewInput during programmatic changes
};

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM Content Loaded - Initializing app...');
  console.log('marked available:', typeof marked !== 'undefined');
  console.log('DOMPurify available:', typeof DOMPurify !== 'undefined');
  console.log('electronAPI available:', typeof window.electronAPI !== 'undefined');
  
  setupEventListeners();
  setupMenuListeners();
  
  if (state.basePath) {
    await loadDirectory(state.basePath);
    
    // Restore the last opened file if it exists
    if (state.currentFile) {
      // Verify the file still exists before opening it
      const result = await window.electronAPI.readFile(state.basePath, state.currentFile);
      if (result.success) {
        await openFile(state.currentFile);
      } else {
        // File no longer exists, clear it
        state.currentFile = null;
        localStorage.removeItem('lastOpenedFile');
      }
    }
  }
  
  setupMarkdownRenderer();
  console.log('App initialized successfully');
});

// Event Listeners
function setupEventListeners() {
  console.log('Setting up event listeners...');
  
  // Home logo - navigate back to home screen
  const homeLogo = document.getElementById('home-logo');
  if (homeLogo) {
    homeLogo.addEventListener('click', () => {
      console.log('Home logo clicked');
      navigateToHome();
    });
  }
  
  // Directory selection
  const selectDirBtn = document.getElementById('select-dir-btn');
  const selectDirEmpty = document.getElementById('select-dir-empty');
  const welcomeSelectDir = document.getElementById('welcome-select-dir');
  
  if (selectDirBtn) {
    selectDirBtn.addEventListener('click', () => {
      console.log('Select directory button clicked');
      selectDirectory();
    });
  }
  if (selectDirEmpty) {
    selectDirEmpty.addEventListener('click', () => {
      console.log('Select directory (empty) button clicked');
      selectDirectory();
    });
  }
  if (welcomeSelectDir) {
    welcomeSelectDir.addEventListener('click', () => {
      console.log('Welcome select directory button clicked');
      selectDirectory();
    });
  }
  
  // Create new note/folder
  const newNoteBtn = document.getElementById('new-note-btn');
  const newFolderBtn = document.getElementById('new-folder-btn');
  const welcomeNewNote = document.getElementById('welcome-new-note');
  
  if (newNoteBtn) {
    newNoteBtn.addEventListener('click', () => {
      console.log('New note button clicked');
      createNewItem('note');
    });
  }
  if (newFolderBtn) {
    newFolderBtn.addEventListener('click', () => {
      console.log('New folder button clicked');
      createNewItem('folder');
    });
  }
  if (welcomeNewNote) {
    welcomeNewNote.addEventListener('click', () => {
      console.log('Welcome new note button clicked');
      createNewItem('note');
    });
  }
  
  // Restore from backup button
  const restoreBackupBtn = document.getElementById('restore-backup-btn');
  if (restoreBackupBtn) {
    restoreBackupBtn.addEventListener('click', async () => {
      console.log('Restore from backup button clicked');
      await restoreFileFromBackup();
    });
  }
  
  // Delete note
  const deleteNoteBtn = document.getElementById('delete-note-btn');
  if (deleteNoteBtn) {
    deleteNoteBtn.addEventListener('click', () => {
      console.log('Delete note button clicked');
      deleteCurrentNote();
    });
  }
  
  // Toggle code view
  const toggleCodeBtn = document.getElementById('toggle-code-btn');
  if (toggleCodeBtn) {
    toggleCodeBtn.addEventListener('click', () => {
      console.log('Toggle code view button clicked');
      toggleCodeView();
    });
  }
  
  // Markdown input (hidden by default)
  const markdownInput = document.getElementById('markdown-input');
  markdownInput.addEventListener('input', handleMarkdownInput);
  
  // Editable preview
  const markdownPreview = document.getElementById('markdown-preview');
  markdownPreview.addEventListener('input', handlePreviewInput);
  markdownPreview.addEventListener('paste', handlePreviewPaste);
  markdownPreview.addEventListener('keydown', handlePreviewKeydown);
  
  // Global keyboard shortcuts
  document.addEventListener('keydown', handleGlobalKeydown);
  
  // Drag and drop for images
  markdownPreview.addEventListener('dragover', handleDragOver);
  markdownPreview.addEventListener('drop', handleDrop);
  
  // Modal
  document.getElementById('modal-cancel').addEventListener('click', hideModal);
  document.getElementById('modal-confirm').addEventListener('click', handleModalConfirm);
  document.getElementById('modal-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleModalConfirm();
  });
  
  // Context menu
  document.addEventListener('click', hideContextMenu);
  document.getElementById('context-menu').addEventListener('click', (e) => {
    e.stopPropagation();
    handleContextMenuAction(e);
  });
}

// Directory Operations
async function selectDirectory() {
  console.log('selectDirectory called');
  try {
    const dirPath = await window.electronAPI.selectNotesDirectory();
    console.log('Selected directory:', dirPath);
    if (dirPath) {
      state.basePath = dirPath;
      localStorage.setItem('notesBasePath', dirPath);
      await loadDirectory(dirPath);
    }
  } catch (error) {
    console.error('Error selecting directory:', error);
  }
}

async function loadDirectory(dirPath) {
  const result = await window.electronAPI.loadDirectoryStructure(dirPath);
  
  if (result.success) {
    state.directoryStructure = result.data;
    renderFileTree(result.data);
    hideWelcomeScreen();
  } else {
    console.error('Failed to load directory:', result.error);
  }
}

function renderFileTree(structure, parentElement = null, depth = 0) {
  const container = parentElement || document.getElementById('file-tree');
  
  if (!parentElement) {
    container.innerHTML = '';
  }
  
  // Render folders
  structure.folders.forEach(folder => {
    const folderEl = createFolderElement(folder, depth);
    container.appendChild(folderEl);
  });
  
  // Render files
  structure.files.forEach(file => {
    const fileEl = createFileElement(file, depth);
    container.appendChild(fileEl);
  });
}

function createFolderElement(folder, depth = 0) {
  const folderDiv = document.createElement('div');
  folderDiv.className = 'folder-item collapsed';
  folderDiv.dataset.path = folder.path;
  folderDiv.dataset.depth = depth;
  
  // Only add padding-left for nested items (depth > 0)
  if (depth > 0) {
    folderDiv.style.paddingLeft = `${8 + (depth * 16)}px`;
  }
  
  folderDiv.innerHTML = `
    <svg class="folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
    <svg class="folder-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>
    <span>${folder.name}</span>
  `;
  
  // Store folder structure data for later rendering
  folderDiv._folderData = folder;
  folderDiv._depth = depth;
  
  // Toggle folder
  folderDiv.addEventListener('click', (e) => {
    e.stopPropagation();
    const isCollapsed = folderDiv.classList.contains('collapsed');
    
    if (isCollapsed) {
      // Expand - render children after this element
      folderDiv.classList.remove('collapsed');
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'folder-children-temp';
      renderFileTree(folderDiv._folderData, childrenContainer, depth + 1);
      
      // Insert all children after the folder element
      const children = Array.from(childrenContainer.children);
      let insertAfter = folderDiv;
      children.forEach(child => {
        insertAfter.parentNode.insertBefore(child, insertAfter.nextSibling);
        insertAfter = child;
      });
    } else {
      // Collapse - remove children
      folderDiv.classList.add('collapsed');
      removeChildrenOfFolder(folderDiv, depth);
    }
  });
  
  // Drag over
  folderDiv.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    folderDiv.style.backgroundColor = 'rgba(74, 222, 128, 0.2)';
  });
  
  // Drag leave
  folderDiv.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    folderDiv.style.backgroundColor = '';
  });
  
  // Drop
  folderDiv.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    folderDiv.style.backgroundColor = '';
    
    const filePath = e.dataTransfer.getData('text/plain');
    if (!filePath) return;
    
    // Don't allow dropping into self
    if (filePath === folder.path) return;
    
    // Don't allow dropping a parent folder into its child
    if (folder.path.startsWith(filePath + '\\') || folder.path.startsWith(filePath + '/')) {
      alert('Cannot move a folder into its own subfolder');
      return;
    }
    
    await moveFileToFolder(filePath, folder.path);
  });
  
  // Context menu
  folderDiv.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e, folder.path, 'folder');
  });
  
  return folderDiv;
}

function removeChildrenOfFolder(folderElement, folderDepth) {
  let nextElement = folderElement.nextSibling;
  while (nextElement) {
    const nextDepth = parseInt(nextElement.dataset?.depth);
    if (isNaN(nextDepth) || nextDepth <= folderDepth) {
      break;
    }
    const toRemove = nextElement;
    nextElement = nextElement.nextSibling;
    toRemove.remove();
  }
}

function createFileElement(file, depth = 0) {
  const fileDiv = document.createElement('div');
  fileDiv.className = 'file-item';
  fileDiv.dataset.path = file.path;
  fileDiv.dataset.depth = depth;
  
  // Only add padding-left for nested items (depth > 0)
  if (depth > 0) {
    fileDiv.style.paddingLeft = `${8 + (depth * 16)}px`;
  }
  
  // Make file draggable
  fileDiv.draggable = true;
  
  // Remove .md extension for display
  const displayName = file.name.replace(/\.md$/i, '');
  
  fileDiv.innerHTML = `
    <svg class="file-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
    </svg>
    <span>${displayName}</span>
  `;
  
  fileDiv.addEventListener('click', () => openFile(file.path));
  
  // Drag start
  fileDiv.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', file.path);
    fileDiv.classList.add('dragging');
  });
  
  // Drag end
  fileDiv.addEventListener('dragend', (e) => {
    fileDiv.classList.remove('dragging');
  });
  
  // Context menu
  fileDiv.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e, file.path, 'file');
  });
  
  return fileDiv;
}

// File Operations
async function openFile(filePath) {
  // Notify that we're navigating away from the current file
  if (state.currentFile) {
    await window.electronAPI.fileNavigatedAway(state.basePath, state.currentFile);
  }
  
  const result = await window.electronAPI.readFile(state.basePath, filePath);
  
  if (result.success) {
    state.currentFile = filePath;
    
    // Save the last opened file to localStorage
    localStorage.setItem('lastOpenedFile', filePath);
    
    // Update UI - use attribute matching instead of querySelector to avoid escaping issues
    document.querySelectorAll('.file-item').forEach(el => {
      el.classList.remove('active');
      // Check if this element matches the current file path
      if (el.dataset.path === filePath) {
        el.classList.add('active');
      }
    });
    
    // Set content
    const markdownInput = document.getElementById('markdown-input');
    markdownInput.value = result.content;
    
    // Set title
    const fileName = filePath.split('\\').pop().split('/').pop().replace('.md', '');
    document.getElementById('note-title').value = fileName;
    
    // Show editor
    showEditor();
    
    // Reset to preview-only mode
    const editorContent = document.getElementById('editor-content');
    const markdownPreview = document.getElementById('markdown-preview');
    editorContent.classList.add('preview-only');
    markdownInput.style.display = 'none';
    
    // Temporarily disable contentEditable so the preview renders
    markdownPreview.contentEditable = 'false';
    markdownPreview.classList.remove('editable');
    
    // Render preview with force flag
    renderMarkdownPreview(result.content, true);
    
    // After a brief delay, enable editable mode
    setTimeout(() => {
      markdownPreview.contentEditable = 'true';
      markdownPreview.classList.add('editable');
    }, 50);
  } else {
    console.error('Failed to read file:', result.error);
  }
}

async function saveCurrentFile(content) {
  if (!state.currentFile) {
    return;
  }
  
  // Safety check: Don't save if content is null, undefined
  if (content === null || content === undefined) {
    console.error('Attempted to save null/undefined content, aborting');
    showErrorModal(
      'Save Error',
      'Cannot save file: content is null or undefined. This is likely a bug in the application. Your file was not modified.'
    );
    return;
  }
  
  // Additional type checking
  if (typeof content !== 'string') {
    console.error('Attempted to save non-string content:', typeof content);
    showErrorModal(
      'Save Error',
      'Cannot save file: content must be a string. This is likely a bug in the application. Your file was not modified.'
    );
    return;
  }
  
  // CRITICAL: If file currently has content but we're trying to save empty content, block it
  // This prevents accidental file wiping from conversion errors
  const markdownInput = document.getElementById('markdown-input');
  const currentContent = markdownInput ? markdownInput.value : '';
  
  if (currentContent && currentContent.trim().length > 10 && content.trim().length === 0) {
    console.error('BLOCKED: Attempted to save empty content when file has existing content');
    showErrorModal(
      'Save Blocked - Data Protection',
      'Attempted to save an empty file when your document has content. This could be a conversion error. Your file was not modified. Please report this issue if it persists.'
    );
    return;
  }
  
  // If content is suspiciously short (less than 5 chars) and we had more, block it
  if (currentContent && currentContent.trim().length > 50 && content.trim().length < 5) {
    console.error('BLOCKED: Attempted to save suspiciously short content');
    showErrorModal(
      'Save Blocked - Data Protection',
      `Attempted to save only ${content.trim().length} characters when your document has ${currentContent.trim().length} characters. This could be a conversion error. Your file was not modified.`
    );
    return;
  }
  
  const result = await window.electronAPI.writeFile(state.basePath, state.currentFile, content);
  
  if (!result.success) {
    console.error('Failed to save file:', result.error);
    showErrorModal(
      'Save Failed',
      `Failed to save file: ${result.error}`
    );
  }
}

async function createNewItem(type) {
  if (!state.basePath) {
    await selectDirectory();
    if (!state.basePath) return;
  }
  
  showModal(
    type === 'note' ? 'Create New Note' : 'Create New Folder',
    type === 'note' ? 'Note name' : 'Folder name',
    async (name) => {
      if (type === 'note') {
        const result = await window.electronAPI.createNote(state.basePath, '', name);
        if (result.success) {
          await loadDirectory(state.basePath);
          await openFile(result.path);
        } else {
          alert('Failed to create note: ' + result.error);
        }
      } else {
        const result = await window.electronAPI.createFolder(state.basePath, '', name);
        if (result.success) {
          await loadDirectory(state.basePath);
        } else {
          alert('Failed to create folder: ' + result.error);
        }
      }
    }
  );
}

async function restoreFileFromBackup() {
  if (!state.currentFile) {
    alert('No file is currently open');
    return;
  }
  
  // Get available backup options
  const optionsResult = await window.electronAPI.getBackupOptions(state.basePath, state.currentFile);
  
  if (!optionsResult.success || optionsResult.options.length === 0) {
    alert('No backups found for this file');
    return;
  }
  
  // Create a modal to show backup options
  showBackupRestoreModal(optionsResult.options);
}

function showBackupRestoreModal(options) {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  // Create modal content
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: #2a2a2a;
    border: 1px solid #3a3a3a;
    border-radius: 8px;
    padding: 24px;
    max-width: 500px;
    width: 90%;
    color: #e0e0e0;
  `;
  
  const title = document.createElement('h2');
  title.textContent = 'Restore from Backup';
  title.style.cssText = 'margin: 0 0 16px 0; color: #4ade80; font-size: 20px;';
  
  const description = document.createElement('p');
  description.textContent = 'Choose which backup to restore:';
  description.style.cssText = 'margin: 0 0 16px 0; color: #a0a0a0;';
  
  const optionsList = document.createElement('div');
  optionsList.style.cssText = 'margin-bottom: 20px; max-height: 300px; overflow-y: auto;';
  
  // Create radio buttons for each backup option
  options.forEach((option, index) => {
    const optionDiv = document.createElement('div');
    optionDiv.style.cssText = `
      padding: 12px;
      margin-bottom: 8px;
      background: #1a1a1a;
      border: 2px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
    `;
    
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'backup-option';
    radio.value = index;
    radio.id = `backup-option-${index}`;
    radio.style.cssText = 'margin-right: 10px; cursor: pointer;';
    if (index === 0) radio.checked = true;
    
    const badge = document.createElement('span');
    badge.textContent = option.type === 'session' ? 'SESSION' : 'FILE';
    badge.style.cssText = `
      display: inline-block;
      margin-right: 10px;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: bold;
      background: ${option.type === 'session' ? '#4ade80' : '#60a5fa'};
      color: #000;
      border-radius: 4px;
    `;
    
    const label = document.createElement('label');
    label.htmlFor = `backup-option-${index}`;
    // Remove the [SESSION] or [FILE] prefix from the label
    label.textContent = option.label.replace(/^\[SESSION\]\s*/, '').replace(/^\[FILE\]\s*/, '');
    label.style.cssText = 'cursor: pointer; flex: 1;';
    
    optionDiv.appendChild(radio);
    optionDiv.appendChild(badge);
    optionDiv.appendChild(label);
    
    optionDiv.addEventListener('click', () => {
      radio.checked = true;
    });
    
    optionDiv.addEventListener('mouseenter', () => {
      optionDiv.style.borderColor = '#4ade80';
    });
    
    optionDiv.addEventListener('mouseleave', () => {
      optionDiv.style.borderColor = 'transparent';
    });
    
    optionsList.appendChild(optionDiv);
  });
  
  // Buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end;';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    padding: 8px 16px;
    background: #3a3a3a;
    color: #e0e0e0;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  cancelBtn.addEventListener('click', () => overlay.remove());
  
  const restoreBtn = document.createElement('button');
  restoreBtn.textContent = 'Restore';
  restoreBtn.style.cssText = `
    padding: 8px 16px;
    background: #4ade80;
    color: #000;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
  `;
  restoreBtn.addEventListener('click', async () => {
    const selectedRadio = document.querySelector('input[name="backup-option"]:checked');
    const selectedOption = options[parseInt(selectedRadio.value)];
    
    overlay.remove();
    
    if (confirm(`Are you sure you want to restore from this ${selectedOption.type} backup? This will overwrite the current content.`)) {
      // Construct full path manually (cross-platform)
      const fullPath = state.basePath + (state.basePath.endsWith('\\') || state.basePath.endsWith('/') ? '' : '\\') + state.currentFile;
      const result = await window.electronAPI.restoreFromBackup(selectedOption.path, fullPath);
      
      if (result.success) {
        // Reload the entire window to ensure clean state
        location.reload();
      } else {
        alert('Failed to restore: ' + result.message);
      }
    }
  });
  
  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(restoreBtn);
  
  modal.appendChild(title);
  modal.appendChild(description);
  modal.appendChild(optionsList);
  modal.appendChild(buttonContainer);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// Setup Menu Listeners (for menu bar events)
function setupMenuListeners() {
  // Listen for "Restore to Previous Session" from Help menu
  window.electronAPI.onShowSessionRestore(() => {
    showSessionRestoreModal();
  });
  
  // Listen for "About" from Help menu
  window.electronAPI.onShowAbout(() => {
    showAboutModal();
  });
}

// Show Help Menu (legacy, no longer used)
async function showHelpMenu() {
  if (!state.basePath) {
    alert('Please select a notes directory first.');
    return;
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  // Create modal content
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: #2a2a2a;
    border: 1px solid #3a3a3a;
    border-radius: 8px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    color: #e0e0e0;
  `;
  
  const title = document.createElement('h2');
  title.textContent = 'Help';
  title.style.cssText = 'margin: 0 0 16px 0; color: #4ade80; font-size: 20px;';
  
  const description = document.createElement('p');
  description.textContent = 'EmeraldNotes - Markdown Notes App';
  description.style.cssText = 'margin: 0 0 20px 0; color: #a0a0a0;';
  
  // Restore to previous session button
  const restoreSessionBtn = document.createElement('button');
  restoreSessionBtn.textContent = 'Restore to Previous Session';
  restoreSessionBtn.style.cssText = `
    width: 100%;
    padding: 12px;
    margin-bottom: 12px;
    background: #4ade80;
    color: #000;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    transition: background 0.2s;
  `;
  restoreSessionBtn.addEventListener('mouseenter', () => {
    restoreSessionBtn.style.background = '#22c55e';
  });
  restoreSessionBtn.addEventListener('mouseleave', () => {
    restoreSessionBtn.style.background = '#4ade80';
  });
  restoreSessionBtn.addEventListener('click', async () => {
    overlay.remove();
    await showSessionRestoreModal();
  });
  
  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = `
    width: 100%;
    padding: 12px;
    background: #3a3a3a;
    color: #e0e0e0;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  `;
  closeBtn.addEventListener('click', () => overlay.remove());
  
  modal.appendChild(title);
  modal.appendChild(description);
  modal.appendChild(restoreSessionBtn);
  modal.appendChild(closeBtn);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// Show Session Restore Modal
async function showSessionRestoreModal() {
  if (!state.basePath) {
    alert('No notes directory selected.');
    return;
  }

  const result = await window.electronAPI.getSessionBackups(state.basePath);
  
  if (!result.success || result.sessions.length === 0) {
    alert('No session backups found.');
    return;
  }

  const sessions = result.sessions;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  // Create modal content
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: #2a2a2a;
    border: 1px solid #3a3a3a;
    border-radius: 8px;
    padding: 24px;
    max-width: 500px;
    width: 90%;
    color: #e0e0e0;
  `;
  
  const title = document.createElement('h2');
  title.textContent = 'Restore to Previous Session';
  title.style.cssText = 'margin: 0 0 16px 0; color: #4ade80; font-size: 20px;';
  
  const description = document.createElement('p');
  description.textContent = 'This will restore all files to a previous session.';
  description.style.cssText = 'margin: 0 0 16px 0; color: #a0a0a0;';
  
  const optionsList = document.createElement('div');
  optionsList.style.cssText = 'margin-bottom: 20px; max-height: 300px; overflow-y: auto;';
  
  // Create radio buttons for each session
  sessions.forEach((session, index) => {
    const optionDiv = document.createElement('div');
    optionDiv.style.cssText = `
      padding: 12px;
      margin-bottom: 8px;
      background: #1a1a1a;
      border: 2px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
    `;
    
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'session-option';
    radio.value = index;
    radio.id = `session-option-${index}`;
    radio.style.cssText = 'margin-right: 10px; cursor: pointer;';
    if (index === 0) radio.checked = true;
    
    const badge = document.createElement('span');
    badge.textContent = 'SESSION';
    badge.style.cssText = `
      display: inline-block;
      margin-right: 10px;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: bold;
      background: #4ade80;
      color: #000;
      border-radius: 4px;
    `;
    
    const label = document.createElement('label');
    label.htmlFor = `session-option-${index}`;
    // Remove the [SESSION] prefix from the label
    label.textContent = session.label.replace(/^\[SESSION\]\s*/, '');
    label.style.cssText = 'cursor: pointer; flex: 1;';
    
    optionDiv.appendChild(radio);
    optionDiv.appendChild(badge);
    optionDiv.appendChild(label);
    
    optionDiv.addEventListener('click', () => {
      radio.checked = true;
    });
    
    optionDiv.addEventListener('mouseenter', () => {
      optionDiv.style.borderColor = '#4ade80';
    });
    
    optionDiv.addEventListener('mouseleave', () => {
      optionDiv.style.borderColor = 'transparent';
    });
    
    optionsList.appendChild(optionDiv);
  });
  
  // Buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end;';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    padding: 8px 16px;
    background: #3a3a3a;
    color: #e0e0e0;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  cancelBtn.addEventListener('click', () => overlay.remove());
  
  const restoreBtn = document.createElement('button');
  restoreBtn.textContent = 'Restore All Files';
  restoreBtn.style.cssText = `
    padding: 8px 16px;
    background: #4ade80;
    color: #000;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
  `;
  restoreBtn.addEventListener('click', async () => {
    const selectedRadio = document.querySelector('input[name="session-option"]:checked');
    const selectedSession = sessions[parseInt(selectedRadio.value)];
    
    overlay.remove();
    
    if (confirm(`Are you sure you want to restore ALL files to this session? This will overwrite current files.`)) {
      const result = await window.electronAPI.restoreSessionBackup(selectedSession.sessionDir, state.basePath);
      
      if (result.success) {
        // Reload the entire window to ensure clean state
        location.reload();
      } else {
        alert('Failed to restore session: ' + result.message);
      }
    }
  });
  
  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(restoreBtn);
  
  modal.appendChild(title);
  modal.appendChild(description);
  modal.appendChild(optionsList);
  modal.appendChild(buttonContainer);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// Show About Modal
function showAboutModal() {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  // Create modal content
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
    border: 2px solid #4ade80;
    border-radius: 12px;
    padding: 32px;
    max-width: 500px;
    width: 90%;
    color: #e0e0e0;
    box-shadow: 0 10px 40px rgba(74, 222, 128, 0.2);
  `;
  
  // App Icon/Logo
  const icon = document.createElement('div');
  icon.innerHTML = '📝';
  icon.style.cssText = `
    font-size: 64px;
    text-align: center;
    margin-bottom: 16px;
  `;
  
  // App Name
  const title = document.createElement('h1');
  title.textContent = 'EmeraldNotes';
  title.style.cssText = `
    margin: 0 0 8px 0;
    color: #4ade80;
    font-size: 32px;
    text-align: center;
    font-weight: bold;
  `;
  
  // Version
  const version = document.createElement('div');
  version.textContent = 'Version 1.0.2';
  version.style.cssText = `
    text-align: center;
    color: #a0a0a0;
    font-size: 14px;
    margin-bottom: 24px;
  `;
  
  // Description
  const description = document.createElement('p');
  description.textContent = 'A beautiful, feature-rich markdown notes application with real-time preview and comprehensive backup system.';
  description.style.cssText = `
    margin: 0 0 24px 0;
    color: #c0c0c0;
    text-align: center;
    line-height: 1.6;
  `;
  
  // Divider
  const divider = document.createElement('hr');
  divider.style.cssText = `
    border: none;
    border-top: 1px solid #3a3a3a;
    margin: 24px 0;
  `;
  
  // Developer Info
  const developerSection = document.createElement('div');
  developerSection.style.cssText = 'margin-bottom: 20px;';
  
  const developerLabel = document.createElement('div');
  developerLabel.textContent = '👨‍💻 Developer';
  developerLabel.style.cssText = `
    color: #4ade80;
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
  `;
  
  const developerName = document.createElement('div');
  developerName.textContent = 'Peyton Winn';
  developerName.style.cssText = `
    color: #e0e0e0;
    font-size: 16px;
  `;
  
  developerSection.appendChild(developerLabel);
  developerSection.appendChild(developerName);
  
  // Tech Stack
  const techSection = document.createElement('div');
  techSection.style.cssText = 'margin-bottom: 20px;';
  
  const techLabel = document.createElement('div');
  techLabel.textContent = '⚡ Tech Stack';
  techLabel.style.cssText = `
    color: #4ade80;
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8px;
  `;
  
  const techStack = [
    { name: 'Electron', version: '39.1.2' },
    { name: 'Marked.js', version: 'Markdown Parser' },
    { name: 'Highlight.js', version: 'Syntax Highlighting' },
    { name: 'DOMPurify', version: 'Security' }
  ];
  
  const techList = document.createElement('div');
  techList.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px;';
  
  techStack.forEach(tech => {
    const badge = document.createElement('div');
    badge.style.cssText = `
      padding: 6px 12px;
      background: #1a1a1a;
      border: 1px solid #3a3a3a;
      border-radius: 6px;
      font-size: 12px;
      color: #c0c0c0;
    `;
    badge.innerHTML = `<strong style="color: #4ade80;">${tech.name}</strong> <span style="color: #808080;">• ${tech.version}</span>`;
    techList.appendChild(badge);
  });
  
  techSection.appendChild(techLabel);
  techSection.appendChild(techList);
  
  // Features
  const featuresSection = document.createElement('div');
  featuresSection.style.cssText = 'margin-bottom: 24px;';
  
  const featuresLabel = document.createElement('div');
  featuresLabel.textContent = '✨ Key Features';
  featuresLabel.style.cssText = `
    color: #4ade80;
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8px;
  `;
  
  const features = [
    'Real-time Markdown Preview',
    'Two-Tier Backup System',
    'Subfolder Image Support',
    'Interactive Checkboxes',
    'Dark Theme with Emerald Accents'
  ];
  
  const featuresList = document.createElement('ul');
  featuresList.style.cssText = `
    margin: 0;
    padding-left: 20px;
    color: #c0c0c0;
    font-size: 13px;
    line-height: 1.8;
  `;
  
  features.forEach(feature => {
    const li = document.createElement('li');
    li.textContent = feature;
    featuresList.appendChild(li);
  });
  
  featuresSection.appendChild(featuresLabel);
  featuresSection.appendChild(featuresList);
  
  // Footer
  const footer = document.createElement('div');
  footer.textContent = 'Made with ❤️ for better note-taking';
  footer.style.cssText = `
    text-align: center;
    color: #808080;
    font-size: 12px;
    font-style: italic;
    margin-top: 24px;
  `;
  
  // Close Button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = `
    width: 100%;
    margin-top: 24px;
    padding: 12px;
    background: #4ade80;
    color: #000;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    transition: all 0.2s;
  `;
  
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.background = '#22c55e';
    closeBtn.style.transform = 'translateY(-1px)';
  });
  
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.background = '#4ade80';
    closeBtn.style.transform = 'translateY(0)';
  });
  
  closeBtn.addEventListener('click', () => overlay.remove());
  
  // Assemble modal
  modal.appendChild(icon);
  modal.appendChild(title);
  modal.appendChild(version);
  modal.appendChild(description);
  modal.appendChild(divider);
  modal.appendChild(developerSection);
  modal.appendChild(techSection);
  modal.appendChild(featuresSection);
  modal.appendChild(footer);
  modal.appendChild(closeBtn);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

async function deleteCurrentNote() {
  if (!state.currentFile) return;
  
  if (confirm('Are you sure you want to delete this note?')) {
    const result = await window.electronAPI.deleteItem(state.basePath, state.currentFile);
    
    if (result.success) {
      state.currentFile = null;
      localStorage.removeItem('lastOpenedFile');
      await loadDirectory(state.basePath);
      hideEditor();
      
      // Reload the window to fix read-only bug
      window.location.reload();
    } else {
      alert('Failed to delete note: ' + result.error);
    }
  }
}

async function moveFileToFolder(filePath, targetFolderPath) {
  try {
    const fileName = filePath.split('\\').pop().split('/').pop();
    const result = await window.electronAPI.moveItem(state.basePath, filePath, targetFolderPath, fileName);
    
    if (result.success) {
      // If the moved file was currently open, update the current file path
      if (state.currentFile === filePath) {
        state.currentFile = result.newPath;
      }
      
      // Reload the directory tree
      await loadDirectory(state.basePath);
      
      // If a file is open, keep it selected
      if (state.currentFile) {
        const fileEl = document.querySelector(`.file-item[data-path="${state.currentFile}"]`);
        if (fileEl) fileEl.classList.add('active');
      }
    } else {
      alert('Failed to move file: ' + result.error);
    }
  } catch (error) {
    console.error('Error moving file:', error);
    alert('Failed to move file: ' + error.message);
  }
}

// Markdown Rendering
function setupMarkdownRenderer() {
  // Configure marked if available
  if (typeof marked !== 'undefined') {
    if (marked.setOptions) {
      marked.setOptions({
        breaks: true,  // Treat single \n as <br>
        gfm: true,  // GitHub Flavored Markdown (includes task lists)
        highlight: function(code, lang) {
          // Use Highlight.js for syntax highlighting
          if (lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(code, { language: lang }).value;
            } catch (err) {
              console.error('Highlight error:', err);
            }
          }
          // Auto-detect language if not specified
          try {
            return hljs.highlightAuto(code).value;
          } catch (err) {
            return code;
          }
        }
      });
    }
    
    console.log('Marked configured with GFM support and syntax highlighting');
  }
}

function toggleCodeView() {
  const editorContent = document.getElementById('editor-content');
  const markdownInput = document.getElementById('markdown-input');
  const markdownPreview = document.getElementById('markdown-preview');
  
  if (editorContent.classList.contains('preview-only')) {
    // Switching from preview-only to code view
    // First, convert current preview HTML back to markdown to preserve any edits
    let currentMarkdown;
    try {
      currentMarkdown = htmlToMarkdown(markdownPreview);
      
      // Validate conversion
      if (!currentMarkdown && markdownPreview.textContent.trim().length > 0) {
        console.error('htmlToMarkdown returned empty when switching views');
        showErrorModal(
          'View Switch Error',
          'Failed to convert preview content to markdown. View was not switched to prevent data loss.'
        );
        return; // Don't switch views if conversion failed
      }
    } catch (error) {
      console.error('Error converting preview to markdown during view switch:', error);
      showErrorModal(
        'View Switch Error',
        `Failed to switch views: ${error.message}. Your content is safe in preview mode.`
      );
      return; // Don't switch views on error
    }
    
    markdownInput.value = currentMarkdown;
    
    // Disable editing on preview
    markdownPreview.contentEditable = 'false';
    markdownPreview.classList.remove('editable');
    
    // Re-render the preview to ensure it's in sync
    renderMarkdownPreview(currentMarkdown, true);
    
    // Show both views
    editorContent.classList.remove('preview-only');
    markdownInput.style.display = 'block';
  } else {
    // Switching from code view to preview-only
    // Sync the markdown from the textarea
    const currentContent = markdownInput.value;
    
    // Re-render preview
    markdownPreview.contentEditable = 'false';
    markdownPreview.classList.remove('editable');
    renderMarkdownPreview(currentContent, true);
    
    // Hide code view
    editorContent.classList.add('preview-only');
    markdownInput.style.display = 'none';
    
    // After render completes, make preview editable again
    setTimeout(() => {
      markdownPreview.contentEditable = 'true';
      markdownPreview.classList.add('editable');
    }, 50);
  }
}

function handleGlobalKeydown(e) {
  // Handle Ctrl+Z (Undo) and Ctrl+Y (Redo)
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    // Allow native undo in contenteditable
    return;
  }
  
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    // Allow native redo in contenteditable
    return;
  }
  
  // Handle Ctrl+B (Bold)
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    document.execCommand('bold');
    return;
  }
  
  // Handle Ctrl+I (Italic)
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
    e.preventDefault();
    document.execCommand('italic');
    return;
  }
  
  // Handle Ctrl+K (Insert Link) - for future implementation
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    // Future: show link dialog
    return;
  }
}

function handleMarkdownInput(e) {
  const content = e.target.value;
  renderMarkdownPreview(content);
  
  // Debounced save
  clearTimeout(state.saveTimeout);
  state.saveTimeout = setTimeout(() => {
    saveCurrentFile(content);
  }, 500);
}

function handlePreviewKeydown(e) {
  // Only handle special cases, let browser handle normal text entry
  const preview = document.getElementById('markdown-preview');
  const selection = window.getSelection();
  
  // Handle ArrowDown in code blocks - exit if on last line
  if (e.key === 'ArrowDown') {
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    let currentNode = range.startContainer;
    
    // Check if we're in a code block
    let codeBlock = null;
    let tempNode = currentNode;
    while (tempNode && tempNode !== preview) {
      if (tempNode.nodeType === Node.ELEMENT_NODE && tempNode.tagName === 'PRE') {
        codeBlock = tempNode;
        break;
      }
      tempNode = tempNode.parentNode;
    }
    
    if (codeBlock) {
      // Get the code element inside pre
      const codeElement = codeBlock.querySelector('code');
      if (codeElement) {
        // Check if cursor is on the last line
        const codeText = codeElement.textContent;
        const lines = codeText.split('\n');
        
        // Get cursor position in the code
        let cursorOffset = 0;
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(codeElement);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        cursorOffset = preCaretRange.toString().length;
        
        // Find which line cursor is on
        let currentLineStart = 0;
        let currentLineIndex = 0;
        for (let i = 0; i < lines.length; i++) {
          const lineEnd = currentLineStart + lines[i].length + (i < lines.length - 1 ? 1 : 0); // +1 for \n
          if (cursorOffset <= lineEnd) {
            currentLineIndex = i;
            break;
          }
          currentLineStart = lineEnd;
        }
        
        // If on the last line, exit the code block
        if (currentLineIndex === lines.length - 1) {
          e.preventDefault();
          
          // Find or create a paragraph after the code block wrapper
          const codeBlockWrapper = codeBlock.closest('.code-block-wrapper') || codeBlock;
          let nextElement = codeBlockWrapper.nextElementSibling;
          
          if (!nextElement || nextElement.tagName === 'PRE' || nextElement.classList.contains('code-block-wrapper')) {
            // No paragraph after, create one
            const newPara = document.createElement('p');
            newPara.innerHTML = '<br>';
            
            // If code block is last element, append to preview, otherwise insert after
            if (codeBlockWrapper.nextSibling) {
              codeBlockWrapper.parentNode.insertBefore(newPara, codeBlockWrapper.nextSibling);
            } else {
              codeBlockWrapper.parentNode.appendChild(newPara);
            }
            nextElement = newPara;
          }
          
          // Move cursor to the next element
          const newRange = document.createRange();
          const newSel = window.getSelection();
          newRange.selectNodeContents(nextElement);
          newRange.collapse(true);
          newSel.removeAllRanges();
          newSel.addRange(newRange);
          
          return;
        }
      }
    }
  }
  
  if (e.key === 'Enter' && !e.shiftKey) {
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    let currentNode = range.startContainer;
    
    // Find if we're in a list item
    let listItem = null;
    let tempNode = currentNode;
    while (tempNode && tempNode !== preview) {
      if (tempNode.nodeType === Node.ELEMENT_NODE && tempNode.tagName === 'LI') {
        listItem = tempNode;
        break;
      }
      tempNode = tempNode.parentNode;
    }
    
    // Check if we're typing a header - if so, let it transform instead of creating new line
    if (!listItem) {
      // Get the current container
      let container = currentNode;
      while (container && container !== preview) {
        if (container.nodeType === Node.ELEMENT_NODE && 
            (container.tagName === 'P' || container.tagName === 'DIV')) {
          break;
        }
        container = container.parentNode;
      }
      
      if (container && container !== preview) {
        const text = container.textContent.trim();
        // Check if this looks like a header pattern
        if (text.match(/^#{1,6}\s*$/)) {
          e.preventDefault();
          // Trigger transformation after a brief delay
          setTimeout(() => {
            transformMarkdownPatterns(true);
          }, 10);
          return;
        }
        // Check if this looks like a horizontal rule pattern
        if (text.match(/^---$/)) {
          e.preventDefault();
          // Trigger transformation after a brief delay
          setTimeout(() => {
            transformMarkdownPatterns(true);
          }, 10);
          return;
        }
      }
    }
    
    if (listItem) {
      e.preventDefault();
      
      // Get the text content of the list item (excluding checkbox)
      const checkbox = listItem.querySelector('input[type="checkbox"]');
      let textContent = listItem.textContent.trim();
      
      // Check if list item is empty
      if (textContent === '' || (checkbox && textContent === '')) {
        // Exit the list - insert a paragraph after the list
        const list = listItem.parentElement;
        const newPara = document.createElement('p');
        newPara.innerHTML = '<br>';
        
        // Remove the empty list item
        listItem.remove();
        
        // If list is now empty, remove it too
        if (list.children.length === 0) {
          list.parentNode.insertBefore(newPara, list.nextSibling);
          list.remove();
        } else {
          list.parentNode.insertBefore(newPara, list.nextSibling);
        }
        
        // Place cursor in new paragraph
        const newRange = document.createRange();
        const newSel = window.getSelection();
        newRange.selectNodeContents(newPara);
        newRange.collapse(true);
        newSel.removeAllRanges();
        newSel.addRange(newRange);
      } else {
        // Create new list item after current one
        const newListItem = document.createElement('li');
        
        if (checkbox) {
          // Create a new checkbox for the new item
          const newCheckbox = document.createElement('input');
          newCheckbox.type = 'checkbox';
          newCheckbox.addEventListener('change', (e) => {
            setTimeout(() => {
              preview.dispatchEvent(new Event('input', { bubbles: true }));
            }, 10);
          });
          newListItem.appendChild(newCheckbox);
          newListItem.appendChild(document.createTextNode(' '));
        }
        
        newListItem.innerHTML += '<br>';
        listItem.parentNode.insertBefore(newListItem, listItem.nextSibling);
        
        // Place cursor in new list item
        const newRange = document.createRange();
        const newSel = window.getSelection();
        const textNode = checkbox ? newListItem.childNodes[2] : newListItem.firstChild;
        if (textNode) {
          newRange.setStart(textNode, 0);
          newRange.collapse(true);
          newSel.removeAllRanges();
          newSel.addRange(newRange);
        }
      }
      
      // Trigger input to save changes
      preview.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    
    // Check if we're in a blockquote
    let blockquote = null;
    tempNode = currentNode;
    while (tempNode && tempNode !== preview) {
      if (tempNode.nodeType === Node.ELEMENT_NODE && tempNode.tagName === 'BLOCKQUOTE') {
        blockquote = tempNode;
        break;
      }
      tempNode = tempNode.parentNode;
    }
    
    if (blockquote) {
      e.preventDefault();
      
      // Get the current paragraph within the blockquote
      let currentPara = currentNode;
      while (currentPara && currentPara !== blockquote) {
        if (currentPara.nodeType === Node.ELEMENT_NODE && currentPara.tagName === 'P') {
          break;
        }
        currentPara = currentPara.parentNode;
      }
      
      if (!currentPara || currentPara === blockquote) {
        // Fallback: create paragraph in blockquote
        currentPara = document.createElement('p');
        blockquote.appendChild(currentPara);
      }
      
      const textContent = currentPara.textContent.trim();
      
      // Check if current paragraph is empty
      if (textContent === '') {
        // Exit the blockquote - insert a paragraph after it
        const newPara = document.createElement('p');
        newPara.innerHTML = '<br>';
        
        // Remove the empty paragraph
        currentPara.remove();
        
        // If blockquote is now empty, remove it too
        if (blockquote.children.length === 0 || blockquote.textContent.trim() === '') {
          blockquote.parentNode.insertBefore(newPara, blockquote.nextSibling);
          blockquote.remove();
        } else {
          blockquote.parentNode.insertBefore(newPara, blockquote.nextSibling);
        }
        
        // Place cursor in new paragraph
        const newRange = document.createRange();
        const newSel = window.getSelection();
        newRange.selectNodeContents(newPara);
        newRange.collapse(true);
        newSel.removeAllRanges();
        newSel.addRange(newRange);
      } else {
        // Create new paragraph in blockquote
        const newPara = document.createElement('p');
        newPara.innerHTML = '<br>';
        
        // Insert after current paragraph
        if (currentPara.nextSibling) {
          blockquote.insertBefore(newPara, currentPara.nextSibling);
        } else {
          blockquote.appendChild(newPara);
        }
        
        // Place cursor in new paragraph
        const newRange = document.createRange();
        const newSel = window.getSelection();
        newRange.selectNodeContents(newPara);
        newRange.collapse(true);
        newSel.removeAllRanges();
        newSel.addRange(newRange);
      }
      
      // Trigger input to save changes
      preview.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
  }
  
  // Check for markdown patterns after typing
  // Trigger on space, enter, backtick, or any other printable character
  // Don't trigger on modifier keys, arrows, etc.
  const isPrintableKey = e.key.length === 1 || e.key === ' ' || e.key === 'Enter';
  if (isPrintableKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    setTimeout(() => {
      transformMarkdownPatterns(e.key === 'Enter');
    }, 10);
  }
}

// Safe HTML transformation wrapper - provides rollback on error
function safeTransformHTML(container, transformFunc) {
  // Store original content for rollback
  const originalHTML = container.innerHTML;
  const originalContent = container.cloneNode(true);
  
  try {
    // Attempt the transformation
    transformFunc();
    
    // Validate that transformation didn't result in empty content unexpectedly
    if (!container.innerHTML || container.innerHTML.trim().length === 0) {
      if (originalHTML && originalHTML.trim().length > 0) {
        console.error('Transformation resulted in empty container, rolling back');
        container.innerHTML = originalHTML;
        return false; // Transformation failed
      }
    }
    
    return true; // Transformation succeeded
  } catch (error) {
    console.error('Error during HTML transformation, rolling back:', error);
    container.innerHTML = originalHTML;
    showErrorModal(
      'Formatting Error',
      `Failed to apply formatting: ${error.message}. Your content has been preserved.`
    );
    return false; // Transformation failed
  }
}

function transformMarkdownPatterns(triggeredByEnter = false) {
  const preview = document.getElementById('markdown-preview');
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  
  // Store a snapshot of preview content before transformations for emergency rollback
  const previewSnapshot = preview.innerHTML;
  
  try {
    const range = selection.getRangeAt(0);
    let currentNode = range.startContainer;
  
  // Find the current paragraph or container
  let container = currentNode;
  while (container && container !== preview) {
    if (container.nodeType === Node.ELEMENT_NODE && 
        (container.tagName === 'P' || container.tagName === 'DIV' || container.tagName === 'PRE')) {
      break;
    }
    container = container.parentNode;
  }
  
  // If cursor is directly in preview (no container), wrap content in a paragraph
  if (!container || container === preview) {
    // Check if we're at a text node directly in preview
    if (currentNode.nodeType === Node.TEXT_NODE && currentNode.parentNode === preview) {
      // Wrap the text node in a paragraph
      const para = document.createElement('p');
      currentNode.parentNode.insertBefore(para, currentNode);
      para.appendChild(currentNode);
      container = para;
      
      // Restore cursor position
      const newRange = document.createRange();
      const newSel = window.getSelection();
      newRange.setStart(currentNode, range.startOffset);
      newRange.collapse(true);
      newSel.removeAllRanges();
      newSel.addRange(newRange);
    } else {
      // Can't find or create container, exit
      return;
    }
  }
  
  // Don't transform if we're already inside a code block (PRE tag)
  if (container.tagName === 'PRE') return;
  
  // Get the text content of the current line
  const text = container.textContent;
  
  // Save cursor position relative to text
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(container);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  const cursorOffset = preCaretRange.toString().length;
  
  let transformed = false;
  let newElement = null;
  let cursorAdjustment = 0;
  
  // Check for headings (must be at start of line)
  // Match if there's a space after # OR if triggered by Enter (new line)
  const h1Match = triggeredByEnter ? text.match(/^#\s*(.*)$/) : text.match(/^#\s+(.+)$/);
  const h2Match = triggeredByEnter ? text.match(/^##\s*(.*)$/) : text.match(/^##\s+(.+)$/);
  const h3Match = triggeredByEnter ? text.match(/^###\s*(.*)$/) : text.match(/^###\s+(.+)$/);
  const h4Match = triggeredByEnter ? text.match(/^####\s*(.*)$/) : text.match(/^####\s+(.+)$/);
  const h5Match = triggeredByEnter ? text.match(/^#####\s*(.*)$/) : text.match(/^#####\s+(.+)$/);
  const h6Match = triggeredByEnter ? text.match(/^######\s*(.*)$/) : text.match(/^######\s+(.+)$/);
  
  if (h6Match) {
    newElement = document.createElement('h6');
    newElement.textContent = h6Match[1];
    transformed = true;
    cursorAdjustment = -7; // "###### "
  } else if (h5Match) {
    newElement = document.createElement('h5');
    newElement.textContent = h5Match[1];
    transformed = true;
    cursorAdjustment = -6; // "##### "
  } else if (h4Match) {
    newElement = document.createElement('h4');
    newElement.textContent = h4Match[1];
    transformed = true;
    cursorAdjustment = -5; // "#### "
  } else if (h3Match) {
    newElement = document.createElement('h3');
    newElement.textContent = h3Match[1];
    transformed = true;
    cursorAdjustment = -4; // "### "
  } else if (h2Match) {
    newElement = document.createElement('h2');
    newElement.textContent = h2Match[1];
    transformed = true;
    cursorAdjustment = -3; // "## "
  } else if (h1Match) {
    newElement = document.createElement('h1');
    newElement.textContent = h1Match[1];
    transformed = true;
    cursorAdjustment = -2; // "# "
  }
  
  // Check for horizontal rule (---) 
  // Match "---" at the start when Enter is pressed
  const hrMatch = text.match(/^---\s*$/);
  if (hrMatch && !transformed) {
    newElement = document.createElement('hr');
    const nextPara = document.createElement('p');
    nextPara.innerHTML = '<br>';
    
    container.parentNode.replaceChild(newElement, container);
    newElement.parentNode.insertBefore(nextPara, newElement.nextSibling);
    
    // Place cursor in the new paragraph after the hr
    const newRange = document.createRange();
    const newSel = window.getSelection();
    newRange.selectNodeContents(nextPara);
    newRange.collapse(true);
    newSel.removeAllRanges();
    newSel.addRange(newRange);
    
    preview.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  
  // Check for inline code blocks: ```code``` or ```language code```
  const inlineCodeBlock = text.match(/^```(\w*)(.*?)```$/);
  if (inlineCodeBlock && !transformed) {
    // Complete inline code block - trigger full re-render
    triggerMarkdownTransform(false);
    return;
  }
  
  // Check for multi-line code blocks (triple backticks)
  const codeBlockMatch = text.match(/^```(\w*)\s*$/);
  if (codeBlockMatch && !transformed) {
    // Check if we're closing a code block by looking at previous elements
    let prevElement = container.previousElementSibling;
    let foundCodeStart = false;
    
    while (prevElement && !foundCodeStart) {
      if (prevElement.getAttribute('data-code-block-start')) {
        foundCodeStart = true;
        break;
      }
      prevElement = prevElement.previousElementSibling;
    }
    
    if (foundCodeStart) {
      // This is the closing ``` - trigger full re-render to format the code block
      triggerMarkdownTransform(false);
      return;
    } else {
      // Start of a code block - mark it and wait for closing
      container.setAttribute('data-code-block-start', codeBlockMatch[1] || '');
      return;
    }
  }
  
  // Check for list patterns at the start of the line
  // For bullets, require at least one character after "- " BUT exclude '[' and ']' 
  // to allow typing "- [ ]" without triggering bullet transformation
  // Match "- " followed by ONE character that's not '[' or ']', then optionally more
  const bulletMatch = text.match(/^-\s([^\[\]])(.*)$/);
  const checkboxMatch = text.match(/^-\s\[\s?\]\s/);
  
  if ((bulletMatch || checkboxMatch) && !transformed) {
    // Create a list
    const list = document.createElement('ul');
    const listItem = document.createElement('li');
    
    if (checkboxMatch) {
      // Create checkbox
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.addEventListener('change', (e) => {
        setTimeout(() => {
          preview.dispatchEvent(new Event('input', { bubbles: true }));
        }, 10);
      });
      listItem.appendChild(checkbox);
      
      // Add text after the checkbox pattern
      const remainingText = text.substring(checkboxMatch[0].length);
      listItem.appendChild(document.createTextNode(' ' + remainingText));
      cursorAdjustment = -checkboxMatch[0].length;
    } else {
      // Add text after the bullet pattern "- "
      // bulletMatch[1] is the first char, bulletMatch[2] is the rest
      const remainingText = (bulletMatch[1] || '') + (bulletMatch[2] || '');
      listItem.appendChild(document.createTextNode(remainingText));
      // cursorAdjustment accounts for removing "- " (2 characters)
      cursorAdjustment = -2;
    }
    
    list.appendChild(listItem);
    newElement = list;
    transformed = true;
    
    // For lists, we need to place cursor in the list item, not the list itself
    if (newElement) {
      container.parentNode.replaceChild(newElement, container);
      
      const newRange = document.createRange();
      const newSel = window.getSelection();
      
      const textNode = checkboxMatch ? listItem.childNodes[1] : listItem.firstChild;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const newOffset = Math.min(Math.max(0, cursorOffset + cursorAdjustment), textNode.length);
        newRange.setStart(textNode, newOffset);
        newRange.collapse(true);
        newSel.removeAllRanges();
        newSel.addRange(newRange);
      }
      
      preview.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return;
  }
  
  // Check for blockquote pattern at the start of the line
  // Match "> " followed by any content (or nothing if triggered by Enter)
  const blockquoteMatch = text.match(/^>\s(.*)$/);
  
  if (blockquoteMatch && !transformed) {
    // Create a blockquote
    const blockquote = document.createElement('blockquote');
    const para = document.createElement('p');
    
    // Add text after the "> " pattern
    const remainingText = blockquoteMatch[1];
    if (remainingText) {
      para.textContent = remainingText;
    } else {
      para.innerHTML = '<br>';
    }
    
    blockquote.appendChild(para);
    newElement = blockquote;
    transformed = true;
    cursorAdjustment = -2; // "> "
    
    // Replace container with blockquote
    container.parentNode.replaceChild(newElement, container);
    
    // Place cursor in the paragraph inside the blockquote
    const newRange = document.createRange();
    const newSel = window.getSelection();
    
    const textNode = para.firstChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      const newOffset = Math.min(Math.max(0, cursorOffset + cursorAdjustment), textNode.length);
      newRange.setStart(textNode, newOffset);
      newRange.collapse(true);
      newSel.removeAllRanges();
      newSel.addRange(newRange);
    } else {
      // If it's a BR, place cursor at the start of the paragraph
      newRange.selectNodeContents(para);
      newRange.collapse(true);
      newSel.removeAllRanges();
      newSel.addRange(newRange);
    }
    
    preview.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  
  // Check for tables (pipes with content)
  // Tables need multiple columns separated by pipes
  const tableMatch = text.match(/^\|(.+\|)+/);
  if (tableMatch && !transformed) {
    // This looks like a table row - trigger a full re-render to properly format
    const markdownInput = document.getElementById('markdown-input');
    triggerMarkdownTransform(false);
    return;
  }
  
  // Check for inline formatting (bold, italic, code)
  // IMPORTANT: Check the starting pattern to determine which to match
  // This prevents ***test** from matching as bold instead of waiting for bold-italic
  // Only transform if there's a space after the closing marker or end of line
  
  // First, check what pattern we're starting with
  let boldItalicMatch = null;
  let boldMatch = null;
  let italicMatch = null;
  
  // Determine which pattern to match based on the opening
  if (text.includes('***')) {
    // If text has ***, only match bold-italic (don't let ** or * match first)
    boldItalicMatch = text.match(/\*\*\*(.+?)\*\*\*(\s|$)/);
  } else if (text.includes('**')) {
    // If text has ** but not ***, only match bold (don't let * match first)
    boldMatch = text.match(/\*\*(.+?)\*\*(\s|$)/);
  } else if (text.includes('*')) {
    // Only if we have single *, match italic
    italicMatch = text.match(/\*(.+?)\*(\s|$)/);
  }
  
  // Check if text contains triple backticks - if so, DON'T match single backticks yet
  const hasTripleBackticks = text.includes('```');
  const inlineCodeMatch = !hasTripleBackticks ? text.match(/`(.+?)`(\s|$)/) : null;
  
  if (boldItalicMatch && !transformed) {
    // Bold and italic
    const beforeMatch = text.substring(0, text.indexOf(boldItalicMatch[0]));
    const afterMatch = text.substring(text.indexOf(boldItalicMatch[0]) + boldItalicMatch[0].length);
    
    container.innerHTML = '';
    if (beforeMatch) container.appendChild(document.createTextNode(beforeMatch));
    
    const strong = document.createElement('strong');
    const em = document.createElement('em');
    em.textContent = boldItalicMatch[1];
    strong.appendChild(em);
    container.appendChild(strong);
    
    if (boldItalicMatch[2]) container.appendChild(document.createTextNode(boldItalicMatch[2]));
    if (afterMatch) container.appendChild(document.createTextNode(afterMatch));
    
    transformed = true;
    
    // Place cursor after the bold-italic element
    setTimeout(() => {
      const newRange = document.createRange();
      const newSel = window.getSelection();
      
      // Place cursor after the <strong><em> element
      const strongElement = container.querySelector('strong');
      if (strongElement && strongElement.nextSibling) {
        // If there's a text node after, place cursor at its start
        const nextNode = strongElement.nextSibling;
        if (nextNode.nodeType === Node.TEXT_NODE) {
          newRange.setStart(nextNode, 0);
          newRange.collapse(true);
          newSel.removeAllRanges();
          newSel.addRange(newRange);
        }
      } else if (strongElement) {
        // If no next sibling, place cursor right after the strong element
        newRange.setStartAfter(strongElement);
        newRange.collapse(true);
        newSel.removeAllRanges();
        newSel.addRange(newRange);
      }
    }, 0);
    
    preview.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  } else if (boldMatch && !transformed) {
    // Bold only
    const beforeMatch = text.substring(0, text.indexOf(boldMatch[0]));
    const afterMatch = text.substring(text.indexOf(boldMatch[0]) + boldMatch[0].length);
    
    container.innerHTML = '';
    if (beforeMatch) container.appendChild(document.createTextNode(beforeMatch));
    
    const strong = document.createElement('strong');
    strong.textContent = boldMatch[1];
    container.appendChild(strong);
    
    if (boldMatch[2]) container.appendChild(document.createTextNode(boldMatch[2]));
    if (afterMatch) container.appendChild(document.createTextNode(afterMatch));
    
    transformed = true;
    
    // Place cursor after the bold element
    setTimeout(() => {
      const newRange = document.createRange();
      const newSel = window.getSelection();
      
      // Place cursor after the <strong> element
      const strongElement = container.querySelector('strong');
      if (strongElement && strongElement.nextSibling) {
        // If there's a text node after, place cursor at its start
        const nextNode = strongElement.nextSibling;
        if (nextNode.nodeType === Node.TEXT_NODE) {
          newRange.setStart(nextNode, 0);
          newRange.collapse(true);
          newSel.removeAllRanges();
          newSel.addRange(newRange);
        }
      } else if (strongElement) {
        // If no next sibling, place cursor right after the strong element
        newRange.setStartAfter(strongElement);
        newRange.collapse(true);
        newSel.removeAllRanges();
        newSel.addRange(newRange);
      }
    }, 0);
    
    preview.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  } else if (italicMatch && !transformed) {
    // Italic only
    const beforeMatch = text.substring(0, text.indexOf(italicMatch[0]));
    const afterMatch = text.substring(text.indexOf(italicMatch[0]) + italicMatch[0].length);
    
    container.innerHTML = '';
    if (beforeMatch) container.appendChild(document.createTextNode(beforeMatch));
    
    const em = document.createElement('em');
    em.textContent = italicMatch[1];
    container.appendChild(em);
    
    if (italicMatch[2]) container.appendChild(document.createTextNode(italicMatch[2]));
    if (afterMatch) container.appendChild(document.createTextNode(afterMatch));
    
    transformed = true;
    
    // Place cursor after the italic element
    setTimeout(() => {
      const newRange = document.createRange();
      const newSel = window.getSelection();
      
      // Place cursor after the <em> element
      const emElement = container.querySelector('em');
      if (emElement && emElement.nextSibling) {
        // If there's a text node after, place cursor at its start
        const nextNode = emElement.nextSibling;
        if (nextNode.nodeType === Node.TEXT_NODE) {
          newRange.setStart(nextNode, 0);
          newRange.collapse(true);
          newSel.removeAllRanges();
          newSel.addRange(newRange);
        }
      } else if (emElement) {
        // If no next sibling, place cursor right after the em element
        newRange.setStartAfter(emElement);
        newRange.collapse(true);
        newSel.removeAllRanges();
        newSel.addRange(newRange);
      }
    }, 0);
    
    preview.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  } else if (inlineCodeMatch && !transformed) {
    // Inline code
    const beforeMatch = text.substring(0, text.indexOf(inlineCodeMatch[0]));
    const afterMatch = text.substring(text.indexOf(inlineCodeMatch[0]) + inlineCodeMatch[0].length);
    
    container.innerHTML = '';
    if (beforeMatch) container.appendChild(document.createTextNode(beforeMatch));
    
    const code = document.createElement('code');
    code.textContent = inlineCodeMatch[1];
    container.appendChild(code);
    
    // Add a zero-width space after code to ensure cursor can be placed outside
    if (!inlineCodeMatch[2] && !afterMatch) {
      container.appendChild(document.createTextNode('\u200B'));
    }
    
    if (inlineCodeMatch[2]) container.appendChild(document.createTextNode(inlineCodeMatch[2]));
    if (afterMatch) container.appendChild(document.createTextNode(afterMatch));
    
    transformed = true;
    
    // Place cursor after the code element
    setTimeout(() => {
      const newRange = document.createRange();
      const newSel = window.getSelection();
      
      if (inlineCodeMatch[2] || afterMatch) {
        // There's a space or text after the code - place cursor there
        const targetNode = inlineCodeMatch[2] ? container.childNodes[2] : container.lastChild;
        if (targetNode && targetNode.nodeType === Node.TEXT_NODE) {
          newRange.setStart(targetNode, 1); // After the space
          newRange.collapse(true);
          newSel.removeAllRanges();
          newSel.addRange(newRange);
        }
      } else {
        // No space after code - we added a zero-width space, place cursor there
        // The structure is: [beforeMatch (text)] [code element] [zero-width space]
        const zeroWidthNode = container.lastChild;
        if (zeroWidthNode && zeroWidthNode.nodeType === Node.TEXT_NODE) {
          newRange.setStart(zeroWidthNode, 1); // After the zero-width space
          newRange.collapse(true);
          newSel.removeAllRanges();
          newSel.addRange(newRange);
        }
      }
    }, 0);
    
    preview.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  
  // If we transformed a heading or other block element, replace and restore cursor
  if (newElement && !bulletMatch && !checkboxMatch) {
    container.parentNode.replaceChild(newElement, container);
    
    // Restore cursor position
    const newRange = document.createRange();
    const newSel = window.getSelection();
    
    const textNode = newElement.firstChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      const newOffset = Math.min(Math.max(0, cursorOffset + cursorAdjustment), textNode.length);
      newRange.setStart(textNode, newOffset);
      newRange.collapse(true);
      newSel.removeAllRanges();
      newSel.addRange(newRange);
    }
    
    preview.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (transformed) {
    // For inline transformations, try to restore cursor position
    const newRange = document.createRange();
    const newSel = window.getSelection();
    
    // Find the text node closest to our cursor position
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let currentOffset = 0;
    let targetNode = null;
    let targetOffset = 0;
    
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (currentOffset + node.length >= cursorOffset) {
        targetNode = node;
        targetOffset = cursorOffset - currentOffset;
        break;
      }
      currentOffset += node.length;
    }
    
    if (targetNode) {
      newRange.setStart(targetNode, Math.min(targetOffset, targetNode.length));
      newRange.collapse(true);
      newSel.removeAllRanges();
      newSel.addRange(newRange);
    }
    
    preview.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  } catch (error) {
    // CRITICAL ERROR HANDLING: If transformation fails, rollback to snapshot
    console.error('Critical error in transformMarkdownPatterns, rolling back:', error);
    preview.innerHTML = previewSnapshot;
    
    showErrorModal(
      'Formatting Error',
      `A critical error occurred while applying markdown formatting: ${error.message}. Your content has been restored to prevent data loss.`
    );
    
    // Restore selection if possible
    try {
      const newRange = document.createRange();
      const newSel = window.getSelection();
      if (preview.firstChild) {
        newRange.selectNodeContents(preview.firstChild);
        newRange.collapse(false);
        newSel.removeAllRanges();
        newSel.addRange(newRange);
      }
    } catch (selError) {
      console.error('Could not restore cursor after rollback:', selError);
    }
  }
}

function triggerMarkdownTransform(placeCursorAtEnd = false) {
  const preview = document.getElementById('markdown-preview');
  const markdownInput = document.getElementById('markdown-input');
  
  console.log('Transforming markdown, placeCursorAtEnd:', placeCursorAtEnd);
  
  // Calculate current cursor position before transform
  let cursorOffset = 0;
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(preview);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    cursorOffset = preCaretRange.toString().length;
  }
  
  console.log('Cursor offset before transform:', cursorOffset);
  
  // Get the current markdown from the textarea (which is kept up to date by handlePreviewInput)
  let markdown = markdownInput.value;
  
  console.log('Markdown after transform:', JSON.stringify(markdown));
  
  // Disable editing temporarily
  preview.contentEditable = 'false';
  renderMarkdownPreview(markdown, true);
  
  // Re-enable editing and restore cursor
  setTimeout(() => {
    preview.contentEditable = 'true';
    preview.focus();
    
    try {
      const range = document.createRange();
      const sel = window.getSelection();
      
      // Get all text nodes
      const walker = document.createTreeWalker(
        preview,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      const textNodes = [];
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
      }
      
      console.log('Found', textNodes.length, 'text nodes after render');
      
      if (placeCursorAtEnd) {
        // Place cursor in the empty paragraph/element that comes AFTER the content
        // When we have markdown like "hello\n\n", marked creates: <p>hello</p><p><br></p>
        // We want cursor in that second <p>, not after "hello"
        
        // Debug: log the entire HTML structure
        console.log('Preview HTML after render:', preview.innerHTML);
        console.log('Preview children count:', preview.children.length);
        
        // Strategy: Find the last ELEMENT child in preview, place cursor there
        const lastElement = preview.lastElementChild;
        if (lastElement) {
          console.log('Last element:', lastElement.tagName, 'textContent:', JSON.stringify(lastElement.textContent));
          
          // If it's a paragraph with just whitespace/br, place cursor at its start
          if (lastElement.tagName === 'P') {
            // Check if this paragraph is empty or just has a <br>
            const textContent = lastElement.textContent.trim();
            if (textContent === '') {
              // Check if this empty paragraph contains an image wrapper (or other non-editable content)
              const hasImageWrapper = lastElement.querySelector('.resizable-image-wrapper');
              if (hasImageWrapper) {
                console.log('Empty paragraph contains image, creating new paragraph after it');
                const newParagraph = document.createElement('p');
                newParagraph.setAttribute('data-cursor-placeholder', 'true');
                const br = document.createElement('br');
                newParagraph.appendChild(br);
                preview.appendChild(newParagraph);
                
                // Place cursor at the start of the new paragraph
                const textNode = document.createTextNode('');
                newParagraph.insertBefore(textNode, br);
                range.setStart(textNode, 0);
                range.collapse(true);
              } else {
                console.log('Found empty paragraph, placing cursor there');
                // Place cursor at the start of this empty paragraph
                let textNode = lastElement.firstChild;
                if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
                  // Create a text node if needed
                  textNode = document.createTextNode('');
                  lastElement.insertBefore(textNode, lastElement.firstChild);
                }
                range.setStart(textNode, 0);
                range.collapse(true);
              }
            } else {
              // This is a paragraph with content - we need to create a NEW paragraph after it!
              console.log('Last paragraph has content, CREATING NEW PARAGRAPH');
              const newParagraph = document.createElement('p');
              newParagraph.setAttribute('data-cursor-placeholder', 'true');
              const br = document.createElement('br');
              newParagraph.appendChild(br);
              preview.appendChild(newParagraph);
              
              // Place cursor at the start of the new paragraph
              const textNode = document.createTextNode('');
              newParagraph.insertBefore(textNode, br);
              range.setStart(textNode, 0);
              range.collapse(true);
            }
          } else {
            // Not a paragraph, create a new paragraph after it
            console.log('Last element is not <p>, creating new paragraph');
            const newParagraph = document.createElement('p');
            newParagraph.setAttribute('data-cursor-placeholder', 'true');
            const br = document.createElement('br');
            newParagraph.appendChild(br);
            preview.appendChild(newParagraph);
            
            // Place cursor at the start of the new paragraph
            const textNode = document.createTextNode('');
            newParagraph.insertBefore(textNode, br);
            range.setStart(textNode, 0);
            range.collapse(true);
          }
        } else {
          // No children at all
          console.log('Preview has no children, placing at start');
          range.selectNodeContents(preview);
          range.collapse(false);
        }
      } else {
        // Restore cursor to previous position based on offset
        let currentOffset = 0;
        let found = false;
        
        for (let node of textNodes) {
          const nodeLength = node.textContent.length;
          
          if (currentOffset + nodeLength >= cursorOffset) {
            const offset = Math.min(cursorOffset - currentOffset, node.textContent.length);
            console.log('Restoring cursor to node:', node.textContent, 'offset:', offset);
            range.setStart(node, offset);
            range.collapse(true);
            found = true;
            break;
          }
          currentOffset += nodeLength;
        }
        
        if (!found && textNodes.length > 0) {
          console.log('Offset not found, placing at end');
          const lastNode = textNodes[textNodes.length - 1];
          range.setStart(lastNode, lastNode.textContent.length);
          range.collapse(true);
        }
      }
      
      sel.removeAllRanges();
      sel.addRange(range);
      console.log('Cursor placed successfully');
    } catch (error) {
      console.error('Error placing cursor:', error);
    }
  }, 50);
}

function handlePreviewInput(e) {
  const preview = e.target;
  
  // Skip if this is a programmatic change (like language dropdown change)
  if (state.ignoreInputCount > 0) {
    console.log('Ignoring input event (programmatic change, count:', state.ignoreInputCount, ')');
    state.ignoreInputCount--;
    return;
  }
  
  // Remove data-cursor-placeholder from any paragraphs that now have content
  const placeholders = preview.querySelectorAll('p[data-cursor-placeholder]');
  placeholders.forEach(p => {
    // If the paragraph has text content (not just whitespace/br), remove the placeholder attribute
    const hasContent = p.textContent.trim().length > 0 || (p.childNodes.length > 0 && !p.querySelector('br'));
    if (hasContent) {
      p.removeAttribute('data-cursor-placeholder');
    }
  });
  
  // Convert HTML back to markdown with error handling
  let markdown;
  try {
    markdown = htmlToMarkdown(preview);
    
    // Validate the conversion result
    if (markdown === null || markdown === undefined) {
      console.error('htmlToMarkdown returned null/undefined');
      showErrorModal(
        'Conversion Error',
        'Failed to convert your edits to markdown format. Your changes were not saved. Please try again or report this issue.'
      );
      return; // Don't save corrupted content
    }
    
    // Additional validation: If preview has text content but markdown is empty, something went wrong
    const previewText = preview.textContent.trim();
    if (previewText.length > 0 && markdown.trim().length === 0) {
      console.error('htmlToMarkdown conversion resulted in empty string despite visible content');
      showErrorModal(
        'Conversion Error',
        'Your edits could not be properly converted to markdown. Your changes were not saved. Please try again or report this issue.'
      );
      return; // Don't save corrupted content
    }
    
  } catch (error) {
    console.error('Error in htmlToMarkdown:', error);
    showErrorModal(
      'Conversion Error',
      `An error occurred while converting your edits: ${error.message}. Your changes were not saved.`
    );
    return; // Don't save on conversion error
  }
  
  // Update the hidden textarea
  const markdownInput = document.getElementById('markdown-input');
  markdownInput.value = markdown;
  
  // Debounced save - no automatic re-rendering
  clearTimeout(state.saveTimeout);
  state.saveTimeout = setTimeout(() => {
    saveCurrentFile(markdown);
  }, 500);
}

async function handlePreviewPaste(e) {
  // Check if clipboard contains image
  const items = e.clipboardData.items;
  let hasImage = false;
  
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      e.preventDefault();
      hasImage = true;
      
      const blob = items[i].getAsFile();
      await handleImageInsert(blob);
      return;
    }
  }
  
  // If no image, handle text paste
  if (!hasImage) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    
    // Transform markdown after paste
    setTimeout(() => {
      triggerMarkdownTransform();
    }, 10);
  }
}

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // Visual feedback
  const preview = document.getElementById('markdown-preview');
  preview.style.backgroundColor = 'rgba(0, 255, 136, 0.1)';
}

async function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // Remove visual feedback
  const preview = document.getElementById('markdown-preview');
  preview.style.backgroundColor = '';
  
  const files = e.dataTransfer.files;
  
  // Process each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    // Check if it's an image
    if (file.type.startsWith('image/')) {
      await handleImageInsert(file);
    }
  }
}

async function handleImageInsert(file) {
  if (!state.currentFile) {
    alert('Please open a note first before inserting images.');
    return;
  }
  
  try {
    // Generate a unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const fileName = `image-${timestamp}.${extension}`;
    
    // Read the file as base64
    const reader = new FileReader();
    
    reader.onload = async function(e) {
      const base64Data = e.target.result.split(',')[1];
      
      // Save the image via IPC, passing current file path for subfolder support
      const result = await window.electronAPI.saveImage(
        state.basePath, 
        fileName, 
        base64Data,
        state.currentFile // Pass current file path so img folder is created in same directory
      );
      
      if (result.success) {
        // Insert markdown image syntax at cursor
        // Always use img/ relative to the current file (img folder is in same directory as the markdown file)
        const relativePath = `img/${fileName}`;
        const imageMarkdown = `![${fileName}](${relativePath})`;
        
        // Get current cursor position
        const selection = window.getSelection();
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        
        if (range) {
          // Insert the image markdown
          document.execCommand('insertText', false, imageMarkdown);
          
          // Update the markdown textarea
          const preview = document.getElementById('markdown-preview');
          const markdownInput = document.getElementById('markdown-input');
          
          let markdown;
          try {
            markdown = htmlToMarkdown(preview);
            
            // Validate conversion
            if (!markdown && preview.textContent.trim().length > 0) {
              console.error('htmlToMarkdown failed after image insertion');
              showErrorModal(
                'Image Insertion Error',
                'Failed to update document after image insertion. Please undo and try again.'
              );
              return;
            }
          } catch (error) {
            console.error('Error in htmlToMarkdown after image insertion:', error);
            showErrorModal(
              'Image Insertion Error',
              `Failed to process image insertion: ${error.message}`
            );
            return;
          }
          
          markdownInput.value = markdown;
          
          // Force re-render to show the image immediately
          preview.contentEditable = 'false';
          renderMarkdownPreview(markdown, true);
          
          setTimeout(() => {
            preview.contentEditable = 'true';
            
            // Restore cursor position after the image
            const images = preview.querySelectorAll('img');
            const lastImage = images[images.length - 1];
            if (lastImage) {
              const newRange = document.createRange();
              const newSelection = window.getSelection();
              
              // Place cursor after the image
              if (lastImage.nextSibling) {
                newRange.setStart(lastImage.nextSibling, 0);
              } else {
                // Create a text node after the image if there isn't one
                const textNode = document.createTextNode('\n');
                lastImage.parentNode.insertBefore(textNode, lastImage.nextSibling);
                newRange.setStart(textNode, 0);
              }
              newRange.collapse(true);
              newSelection.removeAllRanges();
              newSelection.addRange(newRange);
            }
          }, 50);
          
          // Save the file
          saveCurrentFile(markdown);
        }
      } else {
        alert('Failed to save image: ' + result.error);
      }
    };
    
    reader.readAsDataURL(file);
  } catch (error) {
    console.error('Error inserting image:', error);
    alert('Failed to insert image: ' + error.message);
  }
}

function htmlToMarkdown(element) {
  let markdown = '';
  
  // Get all child nodes
  const walk = (node, parentTag = null) => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Skip whitespace-only text nodes between block elements
      const blockElements = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'pre', 'hr'];
      if (parentTag && blockElements.includes(parentTag) && node.textContent.trim() === '') {
        return '';
      }
      return node.textContent;
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      const children = Array.from(node.childNodes).map(child => walk(child, tag)).join('');
      
      switch (tag) {
        case 'h1': return `# ${children}\n`;
        case 'h2': return `## ${children}\n`;
        case 'h3': return `### ${children}\n`;
        case 'h4': return `#### ${children}\n`;
        case 'h5': return `##### ${children}\n`;
        case 'h6': return `###### ${children}\n`;
        case 'p': 
          // Skip cursor placeholder paragraphs
          if (node.hasAttribute('data-cursor-placeholder')) {
            return '';
          }
          return `${children}\n`;
        case 'br': return '\n';
        case 'strong':
        case 'b': return `**${children}**`;
        case 'em':
        case 'i': return `*${children}*`;
        case 'code': return node.parentElement.tagName === 'PRE' ? children : `\`${children}\``;
        case 'pre': {
          // Check if code element has a language class
          const codeElement = node.querySelector('code');
          let lang = '';
          if (codeElement && codeElement.className) {
            const match = codeElement.className.match(/language-(\w+)/);
            if (match && match[1] !== 'plaintext') {
              lang = match[1];
            }
          }
          return `\`\`\`${lang}\n${children}\n\`\`\`\n`;
        }
        case 'a': return `[${children}](${node.getAttribute('href') || ''})`;
        case 'img': {
          let src = node.getAttribute('src') || '';
          const originalPath = node.getAttribute('data-original-path') || '';
          
          // Convert absolute file:// paths back to relative paths
          if (src.startsWith('file:///') && state.basePath) {
            // Extract the path after the base path
            const fileUrl = src.replace('file:///', '').replace(/\//g, '\\');
            const basePath = state.basePath.replace(/\\/g, '\\');
            
            // If the path starts with the base path, make it relative
            if (fileUrl.toLowerCase().startsWith(basePath.toLowerCase())) {
              src = fileUrl.substring(basePath.length).replace(/\\/g, '/');
              // Remove leading slash if present
              if (src.startsWith('/')) {
                src = src.substring(1);
              }
            }
          }
          
          // Check if image has dimensions stored
          const width = node.style.width ? parseInt(node.style.width) : null;
          const dimensionSuffix = width ? ` =${width}x` : '';
          
          // Use original path if available (for resized images), otherwise use src
          const finalPath = originalPath || src;
          
          return `![${node.getAttribute('alt') || ''}](${finalPath}${dimensionSuffix})`;
        }
        case 'ul': return children + '\n';
        case 'ol': return children + '\n';
        case 'li': {
          const checkbox = node.querySelector('input[type="checkbox"]');
          if (checkbox) {
            const checked = checkbox.checked ? 'x' : ' ';
            const text = Array.from(node.childNodes)
              .filter(n => n !== checkbox)
              .map(child => walk(child, 'li'))
              .join('')
              .trim();
            return `- [${checked}] ${text}\n`;
          }
          const parent = node.parentElement;
          if (parent.tagName === 'OL') {
            const index = Array.from(parent.children).indexOf(node) + 1;
            return `${index}. ${children}\n`;
          }
          return `- ${children}\n`;
        }
        case 'blockquote': return children.split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
        case 'hr': return '---\n\n';
        case 'table': {
          // Process table structure
          const thead = node.querySelector('thead');
          const tbody = node.querySelector('tbody');
          
          if (!thead || !tbody) return '';
          
          // Get header row
          const headerRow = thead.querySelector('tr');
          if (!headerRow) return '';
          
          const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => {
            return walk(cell, 'th').trim();
          });
          
          // Detect alignment from th elements
          const alignments = Array.from(headerRow.querySelectorAll('th, td')).map(cell => {
            const align = cell.style.textAlign || cell.getAttribute('align') || '';
            return align;
          });
          
          // Build header line
          let tableMarkdown = '| ' + headers.join(' | ') + ' |\n';
          
          // Build separator line with alignment
          const separators = alignments.map((align, index) => {
            if (align === 'center') return ':---:';
            if (align === 'right') return '---:';
            return ':---'; // left align (default)
          });
          tableMarkdown += '|' + separators.map(s => s).join('|') + '|\n';
          
          // Build body rows
          const rows = tbody.querySelectorAll('tr');
          rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td')).map(cell => {
              return walk(cell, 'td').trim();
            });
            tableMarkdown += '| ' + cells.join(' | ') + ' |\n';
          });
          
          return tableMarkdown + '\n';
        }
        case 'thead':
        case 'tbody':
        case 'tr':
        case 'th':
        case 'td':
          // These are handled by the table case
          return children;
        case 'div':
          // Skip code-language-selector but process its children
          if (node.classList.contains('code-language-selector')) {
            return '';
          }
          // For code-block-wrapper, return children (which contains the pre/code)
          if (node.classList.contains('code-block-wrapper')) {
            return children;
          }
          // Skip resize-handle divs
          if (node.classList.contains('resize-handle')) {
            return '';
          }
          return children;
        case 'select':
          // Skip language dropdown selects
          return '';
        default: return children;
      }
    }
    
    return '';
  };
  
  markdown = walk(element);
  
  // Clean up excessive newlines (but don't trim trailing ones - we need them!)
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  
  // Remove zero-width spaces used for cursor positioning
  markdown = markdown.replace(/\u200B/g, '');
  
  return markdown;
}

function renderMarkdownPreview(markdown, forceRender = false) {
  const preview = document.getElementById('markdown-preview');
  
  // If in editable mode and not forcing, skip render to avoid cursor jumps
  if (preview.contentEditable === 'true' && !forceRender) {
    return;
  }
  
  // Save cursor position if editing
  const selection = window.getSelection();
  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  
  // Store image dimensions from markdown for later application
  const imageDimensions = new Map();
  markdown = markdown.replace(/!\[([^\]]*)\]\(([^\s)]+)\s*=(\d+)x?\)/g, (match, alt, src, width) => {
    // Normalize the path - store both with and without leading slash
    imageDimensions.set(src, width);
    const normalizedSrc = src.startsWith('/') ? src.substring(1) : '/' + src;
    imageDimensions.set(normalizedSrc, width);
    return `![${alt}](${src})`;
  });
  
  // Convert markdown to HTML (marked already converts task lists to checkboxes)
  let html = marked.marked ? marked.marked(markdown) : marked(markdown);
  
  // Sanitize HTML
  html = DOMPurify.sanitize(html);
  
  // Fix image paths - convert relative paths to absolute paths based on notes directory
  if (state.basePath && state.currentFile) {
    const currentDir = state.basePath + '\\' + state.currentFile.split('\\').slice(0, -1).join('\\');
    
    // Replace image src attributes with absolute paths and handle width specifications
    html = html.replace(/<img([^>]+)src=["']([^"']+)["']/gi, (match, before, src) => {
      let originalSrc = src;
      
      // Skip if already absolute (starts with http:// or file://)
      if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('file://')) {
        // Convert relative path to absolute file:// URL
        const absolutePath = src.startsWith('/') 
          ? state.basePath + src.replace(/\//g, '\\')
          : currentDir + '\\' + src.replace(/\//g, '\\');
        
        console.log('Converting image path:', src, '-> file:///' + absolutePath);
        src = 'file:///' + absolutePath.replace(/\\/g, '/');
      }
      
      // Check if we have stored dimensions for this image
      const width = imageDimensions.get(originalSrc);
      const widthAttr = width ? ` style="width: ${width}px; max-width: ${width}px;"` : '';
      
      // Store the original markdown path as a data attribute for later reference
      const dataAttr = ` data-original-path="${originalSrc}"`;
      
      return `<img${before}src="${src}"${widthAttr}${dataAttr}`;
    });
  }
  
  // Set the HTML
  preview.innerHTML = html;
  
  // Add event listeners to all checkboxes (marked already created them)
  attachCheckboxListeners();
  
  // Make images resizable
  makeImagesResizable();
  
  // Make links open in external browser
  makeLinksExternal();
  
  // Add language selectors to code blocks
  addCodeBlockLanguageSelectors();
}

// Make images resizable
function makeImagesResizable() {
  const preview = document.getElementById('markdown-preview');
  const images = preview.querySelectorAll('img');
  
  images.forEach(img => {
    // Add resizable class and wrapper
    if (!img.parentElement.classList.contains('resizable-image-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'resizable-image-wrapper';
      wrapper.contentEditable = 'false';
      
      // Wrap the image
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
      
      // Add resize handle
      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      wrapper.appendChild(handle);
      
      // Store original dimensions
      img.style.maxWidth = img.style.width || '100%';
      img.style.height = 'auto';
      img.style.display = 'block';
      
      let isResizing = false;
      let startX, startWidth;
      
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        startX = e.clientX;
        startWidth = img.offsetWidth;
        
        wrapper.classList.add('resizing');
        document.body.style.cursor = 'ew-resize';
        
        const onMouseMove = (e) => {
          if (!isResizing) return;
          
          const diff = e.clientX - startX;
          const newWidth = Math.max(100, Math.min(startWidth + diff, preview.offsetWidth - 40));
          img.style.maxWidth = newWidth + 'px';
          img.style.width = newWidth + 'px';
        };
        
        const onMouseUp = () => {
          if (!isResizing) return;
          isResizing = false;
          wrapper.classList.remove('resizing');
          document.body.style.cursor = '';
          
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          
          // Update markdown with new width
          const markdownInput = document.getElementById('markdown-input');
          const currentMarkdown = markdownInput.value;
          const width = Math.round(img.offsetWidth);
          
          // Get the original markdown path stored on the image
          const originalPath = img.getAttribute('data-original-path');
          
          console.log('Resizing image - originalPath:', originalPath, 'width:', width);
          
          if (originalPath) {
            // Escape special regex characters in the path
            const escapedPath = originalPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Match the image with optional existing dimensions
            const regex = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedPath}(?:\\s*=\\d+x?)?\\)`, 'g');
            const newMarkdown = currentMarkdown.replace(regex, `![$1](${originalPath} =${width}x)`);
            
            console.log('Regex match found:', newMarkdown !== currentMarkdown);
            
            if (newMarkdown !== currentMarkdown) {
              markdownInput.value = newMarkdown;
              saveCurrentFile(newMarkdown);
              console.log('Image size saved to markdown');
            } else {
              console.log('No match found in markdown for path:', originalPath);
            }
          } else {
            console.log('No data-original-path attribute found on image');
          }
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    }
  });
}

// Make all links open in external browser
function makeLinksExternal() {
  const preview = document.getElementById('markdown-preview');
  const links = preview.querySelectorAll('a[href]');
  
  links.forEach(link => {
    // Remove any existing click handler
    const newLink = link.cloneNode(true);
    link.parentNode.replaceChild(newLink, link);
    
    newLink.addEventListener('click', (e) => {
      e.preventDefault();
      const href = newLink.getAttribute('href');
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        window.electronAPI.openExternal(href);
      }
    });
  });
}

// Add language selector to code blocks
function addCodeBlockLanguageSelectors() {
  const preview = document.getElementById('markdown-preview');
  const codeBlocks = preview.querySelectorAll('pre code');
  
  // Common programming languages
  const languages = [
    'plaintext', 'javascript', 'typescript', 'python', 'java', 'csharp', 'cpp', 'c',
    'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'sql', 'bash', 'powershell',
    'html', 'css', 'scss', 'json', 'xml', 'yaml', 'markdown', 'diff'
  ];
  
  codeBlocks.forEach(code => {
    const pre = code.parentElement;
    
    // Skip if already has a wrapper
    if (pre.parentElement && pre.parentElement.classList.contains('code-block-wrapper')) {
      return;
    }
    
    // Detect current language
    let currentLang = 'plaintext';
    if (code.className) {
      const match = code.className.match(/language-(\w+)/);
      if (match) {
        currentLang = match[1];
      }
    }
    
    // Re-apply syntax highlighting if language is detected and hljs is available
    if (currentLang !== 'plaintext' && typeof hljs !== 'undefined') {
      const codeContent = code.textContent;
      try {
        // Try to highlight with the specified language
        const result = hljs.highlight(codeContent, { language: currentLang });
        code.innerHTML = result.value;
      } catch (err) {
        // If language not found, try auto-detect or fall back to plaintext
        try {
          const result = hljs.highlightAuto(codeContent);
          code.innerHTML = result.value;
        } catch (autoErr) {
          // Silent fail - keep original content
        }
      }
    }
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);
    
    // Create language selector
    const selector = document.createElement('div');
    selector.className = 'code-language-selector';
    
    const select = document.createElement('select');
    select.className = 'language-dropdown';
    
    // Prevent ALL events from the select from bubbling to preview
    ['click', 'mousedown', 'mouseup', 'focus', 'blur', 'input'].forEach(eventType => {
      select.addEventListener(eventType, (e) => {
        e.stopPropagation();
      });
    });
    
    // Add language options
    languages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang;
      option.textContent = lang.charAt(0).toUpperCase() + lang.slice(1);
      if (lang === currentLang) {
        option.selected = true;
      }
      select.appendChild(option);
    });
    
    // Handle language change
    select.addEventListener('change', (e) => {
      // CRITICAL: Stop event propagation to prevent triggering handlePreviewInput
      e.stopPropagation();
      e.preventDefault();
      
      // Increment counter to ignore multiple input events during this operation
      state.ignoreInputCount += 3;  // Increased to handle delayed events
      console.log('Language change: set ignoreInputCount to', state.ignoreInputCount);
      
      // Safety: reset counter after 2 seconds (some events fire late)
      setTimeout(() => {
        if (state.ignoreInputCount > 0) {
          console.log('Safety reset: clearing ignoreInputCount (was', state.ignoreInputCount, ')');
          state.ignoreInputCount = 0;
        }
      }, 2000);
      
      const newLang = e.target.value;
      const codeContent = code.textContent;
      
      // Remove old language classes
      code.className = code.className.replace(/language-\w+/g, '').trim();
      
      // Add new language class
      if (newLang !== 'plaintext') {
        code.classList.add(`language-${newLang}`);
      }
      
      // Re-highlight with new language
      if (typeof hljs !== 'undefined') {
        if (newLang === 'plaintext') {
          code.innerHTML = codeContent;
        } else {
          try {
            code.innerHTML = hljs.highlight(codeContent, { language: newLang }).value;
          } catch (err) {
            console.error('Highlight error:', err);
            code.innerHTML = codeContent;
          }
        }
      }
      
      // Update markdown source - only save if successful
      const success = updateCodeBlockLanguageInMarkdown(pre, newLang, codeContent);
      if (!success) {
        console.warn('Failed to update markdown for language change, file not modified');
      }
    });
    
    selector.appendChild(select);
    wrapper.insertBefore(selector, pre);
  });
}

// Update markdown source when language changes
function updateCodeBlockLanguageInMarkdown(pre, newLang, codeContent) {
  try {
    const markdownInput = document.getElementById('markdown-input');
    if (!markdownInput || !markdownInput.value) {
      console.warn('No markdown input or empty value, skipping language update');
      return false;
    }
    
    const currentMarkdown = markdownInput.value;
    
    // Find all code blocks in the markdown
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)\n```/g;
    let match;
    let bestMatch = null;
    let bestMatchIndex = -1;
    
    // Find the code block that matches our content
    while ((match = codeBlockRegex.exec(currentMarkdown)) !== null) {
      const blockContent = match[2];
      // Compare trimmed content to handle potential whitespace differences
      if (blockContent.trim() === codeContent.trim()) {
        bestMatch = match;
        bestMatchIndex = match.index;
        break;
      }
    }
    
    if (bestMatch) {
      const langTag = newLang === 'plaintext' ? '' : newLang;
      const replacement = `\`\`\`${langTag}\n${bestMatch[2]}\n\`\`\``;
      
      // Replace only this specific code block
      const before = currentMarkdown.substring(0, bestMatchIndex);
      const after = currentMarkdown.substring(bestMatchIndex + bestMatch[0].length);
      const newMarkdown = before + replacement + after;
      
      // Verify the new markdown is not empty
      if (newMarkdown.trim().length === 0) {
        console.error('Language update would result in empty content, aborting');
        return false;
      }
      
      markdownInput.value = newMarkdown;
      
      // Save the file (ignore input events are already blocked by the change handler)
      saveCurrentFile(newMarkdown);
      return true;
    } else {
      console.error('Could not find matching code block in markdown');
      return false;
    }
  } catch (error) {
    console.error('Error updating code block language:', error);
    return false;
  }
}

// Attach checkbox event listeners
function attachCheckboxListeners() {
  const preview = document.getElementById('markdown-preview');
  if (!preview) return;
  
  const checkboxes = preview.querySelectorAll('input[type="checkbox"]');
  
  checkboxes.forEach((checkbox, index) => {
    // Add data attribute for tracking
    checkbox.dataset.checkboxIndex = index;
    checkbox.disabled = false;
    
    // Remove old listeners if any (to prevent duplicates)
    checkbox.replaceWith(checkbox.cloneNode(true));
    const newCheckbox = preview.querySelectorAll('input[type="checkbox"]')[index];
    newCheckbox.dataset.checkboxIndex = index;
    
    // Stop ALL events from bubbling to preview (prevents triggering handlePreviewInput)
    ['click', 'mousedown', 'mouseup', 'focus', 'blur', 'input', 'change'].forEach(eventType => {
      newCheckbox.addEventListener(eventType, (e) => {
        e.stopPropagation();
      });
    });
    
    // Add change event listener
    newCheckbox.addEventListener('change', function(e) {
      e.stopPropagation(); // Extra safety
      toggleCheckbox(this);
    });
    
    // Make sure the checkbox is interactive
    newCheckbox.style.pointerEvents = 'auto';
    newCheckbox.style.cursor = 'pointer';
  });
}

// Checkbox toggle functionality
async function toggleCheckbox(checkbox) {
  // Re-read the file to get the current content (source of truth)
  const result = await window.electronAPI.readFile(state.basePath, state.currentFile);
  
  if (!result.success || !result.content || result.content.trim().length === 0) {
    return;
  }
  
  const content = result.content;
  const lines = content.split('\n');
  
  let checkboxCount = 0;
  let targetLine = -1;
  const clickedIndex = parseInt(checkbox.dataset.checkboxIndex) || 0;
  
  // Find the corresponding line in the markdown
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^\s*-\s*\[(x| )\]/i)) {
      if (checkboxCount === clickedIndex) {
        targetLine = i;
        break;
      }
      checkboxCount++;
    }
  }
  
  if (targetLine !== -1) {
    if (checkbox.checked) {
      // Check the box - replace [ ] with [x]
      lines[targetLine] = lines[targetLine].replace(/\[ \]/, '[x]');
    } else {
      // Uncheck the box - replace [x] with [ ]
      lines[targetLine] = lines[targetLine].replace(/\[x\]/i, '[ ]');
    }
    
    const newContent = lines.join('\n');
    
    // Update the markdown input textarea to keep it in sync
    const markdownInput = document.getElementById('markdown-input');
    if (markdownInput) {
      markdownInput.value = newContent;
    }
    
    // Save the file immediately
    await saveCurrentFile(newContent);
    
    // Re-render preview to ensure consistency (MUST use forceRender=true!)
    renderMarkdownPreview(newContent, true);
    
    // Re-enable contentEditable after brief delay
    setTimeout(() => {
      const markdownPreview = document.getElementById('markdown-preview');
      markdownPreview.contentEditable = 'true';
      markdownPreview.classList.add('editable');
    }, 50);
  }
}

// Context Menu
function showContextMenu(e, itemPath, itemType) {
  const contextMenu = document.getElementById('context-menu');
  contextMenu.style.display = 'block';
  contextMenu.style.left = e.pageX + 'px';
  contextMenu.style.top = e.pageY + 'px';
  contextMenu.dataset.itemPath = itemPath;
  contextMenu.dataset.itemType = itemType;
}

function hideContextMenu() {
  const contextMenu = document.getElementById('context-menu');
  contextMenu.style.display = 'none';
}

async function handleContextMenuAction(e) {
  const action = e.target.dataset.action;
  if (!action) return;
  
  const contextMenu = document.getElementById('context-menu');
  const itemPath = contextMenu.dataset.itemPath;
  const itemType = contextMenu.dataset.itemType;
  
  hideContextMenu();
  
  if (action === 'rename') {
    const oldName = itemPath.split('\\').pop().split('/').pop();
    showModal('Rename', 'New name', async (newName) => {
      if (itemType === 'file' && !newName.endsWith('.md')) {
        newName += '.md';
      }
      
      const result = await window.electronAPI.renameItem(state.basePath, itemPath, newName);
      
      if (result.success) {
        if (state.currentFile === itemPath) {
          state.currentFile = result.newPath;
          localStorage.setItem('lastOpenedFile', result.newPath);
        }
        await loadDirectory(state.basePath);
        
        // Reload the window to fix read-only bug
        window.location.reload();
      } else {
        alert('Failed to rename: ' + result.error);
      }
    }, oldName.replace('.md', ''));
  } else if (action === 'delete') {
    if (confirm(`Are you sure you want to delete this ${itemType}?`)) {
      const result = await window.electronAPI.deleteItem(state.basePath, itemPath);
      
      if (result.success) {
        if (state.currentFile === itemPath) {
          state.currentFile = null;
          localStorage.removeItem('lastOpenedFile');
          hideEditor();
        }
        await loadDirectory(state.basePath);
        
        // Reload the window to fix read-only bug
        window.location.reload();
      } else {
        alert('Failed to delete: ' + result.error);
      }
    }
  } else if (action === 'show-in-explorer') {
    // Show the file/folder in File Explorer
    await window.electronAPI.showInExplorer(state.basePath, itemPath);
  }
}

// Modal
let modalCallback = null;

function showModal(title, placeholder, callback, defaultValue = '') {
  const modal = document.getElementById('input-modal');
  const input = document.getElementById('modal-input');
  
  document.getElementById('modal-title').textContent = title;
  input.placeholder = placeholder;
  input.value = defaultValue;
  
  modal.style.display = 'flex';
  input.focus();
  
  modalCallback = callback;
}

function hideModal() {
  document.getElementById('input-modal').style.display = 'none';
  document.getElementById('modal-input').value = '';
  modalCallback = null;
}

function handleModalConfirm() {
  const input = document.getElementById('modal-input');
  const value = input.value.trim();
  
  if (value && modalCallback) {
    modalCallback(value);
  }
  
  hideModal();
}

// Error modal for displaying errors without user input
function showErrorModal(title, message) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: #2b2b2b;
    border-radius: 8px;
    padding: 24px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  `;

  const titleEl = document.createElement('h3');
  titleEl.textContent = title;
  titleEl.style.cssText = `
    color: #ff6b6b;
    margin: 0 0 16px 0;
    font-size: 18px;
  `;

  const messageEl = document.createElement('p');
  messageEl.textContent = message;
  messageEl.style.cssText = `
    color: #e0e0e0;
    margin: 0 0 24px 0;
    line-height: 1.5;
  `;

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    justify-content: flex-end;
  `;

  const okButton = document.createElement('button');
  okButton.textContent = 'OK';
  okButton.style.cssText = `
    background: #6366f1;
    color: white;
    border: none;
    padding: 8px 24px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  okButton.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  buttonContainer.appendChild(okButton);
  modal.appendChild(titleEl);
  modal.appendChild(messageEl);
  modal.appendChild(buttonContainer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Focus the OK button
  okButton.focus();
}

// UI Helpers
function showEditor() {
  document.querySelector('.welcome-screen').style.display = 'none';
  document.getElementById('editor-wrapper').style.display = 'flex';
}

function hideEditor() {
  document.querySelector('.welcome-screen').style.display = 'flex';
  document.getElementById('editor-wrapper').style.display = 'none';
  document.getElementById('markdown-input').value = '';
  document.getElementById('markdown-preview').innerHTML = '';
  document.getElementById('note-title').value = '';
}

function navigateToHome() {
  // Clear the current file state
  state.currentFile = null;
  localStorage.removeItem('lastOpenedFile');
  
  // Remove active class from all file items
  document.querySelectorAll('.file-item').forEach(el => {
    el.classList.remove('active');
  });
  
  // Hide the editor and show the welcome screen
  hideEditor();
  
  console.log('Navigated to home screen');
}

function hideWelcomeScreen() {
  const welcomeScreen = document.querySelector('.welcome-screen');
  if (welcomeScreen && state.directoryStructure) {
    // Keep welcome screen visible if no file is open
    if (!state.currentFile) {
      welcomeScreen.style.display = 'flex';
    }
  }
}
