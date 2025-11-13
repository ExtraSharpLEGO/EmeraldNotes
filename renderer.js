// marked and DOMPurify are loaded via CDN in index.html
// They are available as global variables

// App State
let state = {
  basePath: localStorage.getItem('notesBasePath') || null,
  currentFile: null,
  directoryStructure: null,
  saveTimeout: null,
  renderTimeout: null
};

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - Initializing app...');
  console.log('marked available:', typeof marked !== 'undefined');
  console.log('DOMPurify available:', typeof DOMPurify !== 'undefined');
  console.log('electronAPI available:', typeof window.electronAPI !== 'undefined');
  
  setupEventListeners();
  setupMenuListeners();
  
  if (state.basePath) {
    loadDirectory(state.basePath);
  }
  
  setupMarkdownRenderer();
  console.log('App initialized successfully');
});

// Event Listeners
function setupEventListeners() {
  console.log('Setting up event listeners...');
  
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
  if (!state.currentFile || !content) {
    return;
  }
  
  const result = await window.electronAPI.writeFile(state.basePath, state.currentFile, content);
  
  if (!result.success) {
    console.error('Failed to save file:', result.error);
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
        alert(result.message);
        // Reload the file to show restored content
        await openFile(state.currentFile);
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
        alert(result.message);
        // Reload directory and current file if open
        await loadDirectory(state.basePath);
        if (state.currentFile) {
          await openFile(state.currentFile);
        }
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

async function deleteCurrentNote() {
  if (!state.currentFile) return;
  
  if (confirm('Are you sure you want to delete this note?')) {
    const result = await window.electronAPI.deleteItem(state.basePath, state.currentFile);
    
    if (result.success) {
      state.currentFile = null;
      await loadDirectory(state.basePath);
      hideEditor();
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
    const currentMarkdown = htmlToMarkdown(markdownPreview);
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
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    
    // Get current selection
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const preview = document.getElementById('markdown-preview');
    
    // Check if we're inside a table cell - if so, don't handle Enter
    let currentNode = range.startContainer;
    let tableCell = null;
    let tempNode = currentNode;
    
    while (tempNode && tempNode !== preview) {
      if (tempNode.nodeType === Node.ELEMENT_NODE && 
          (tempNode.tagName === 'TD' || tempNode.tagName === 'TH')) {
        tableCell = tempNode;
        break;
      }
      tempNode = tempNode.parentNode;
    }
    
    if (tableCell) {
      // We're inside a table - allow default behavior (which is to do nothing or add a <br>)
      // Just insert a <br> without triggering re-render
      const br = document.createElement('br');
      range.insertNode(br);
      range.setStartAfter(br);
      range.setEndAfter(br);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    
    // Check if we're in a list item
    let listItem = null;
    
    while (currentNode && currentNode !== preview) {
      if (currentNode.nodeType === Node.ELEMENT_NODE && currentNode.tagName === 'LI') {
        listItem = currentNode;
        break;
      }
      currentNode = currentNode.parentNode;
    }
    
    // Handle list items (bullets and checkboxes)
    if (listItem) {
      const checkbox = listItem.querySelector('input[type="checkbox"]');
      const markdownInput = document.getElementById('markdown-input');
      const currentMarkdown = markdownInput.value;
      
      // Check if the list item is empty (or only has a checkbox)
      const textContent = listItem.textContent.trim();
      const isEmpty = textContent === '' || (checkbox && textContent === '');
      
      if (isEmpty) {
        // Exit the list - remove the empty list item
        const lines = currentMarkdown.split('\n');
        
        // Find and remove the last empty list item (bullet or checkbox)
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          // Match empty bullets or empty checkboxes
          if (line === '-' || line === '- [ ]' || line === '- []' || line === '-  [ ]') {
            lines.splice(i, 1);
            break;
          }
          // Stop if we hit a non-empty line
          if (line !== '') {
            break;
          }
        }
        
        // Add two newlines to create a paragraph break
        markdownInput.value = lines.join('\n') + '\n\n';
      } else {
        // Add new list item
        if (checkbox) {
          markdownInput.value = currentMarkdown + '\n- [ ] ';
        } else {
          markdownInput.value = currentMarkdown + '\n- ';
        }
      }
      
      // Re-render and place cursor at end
      setTimeout(() => {
        renderMarkdownPreview(markdownInput.value, true);
        preview.focus();
        
        if (isEmpty) {
          // Create a new paragraph for the cursor
          const newPara = document.createElement('p');
          const zeroWidthSpace = document.createTextNode('\u200B');
          newPara.appendChild(zeroWidthSpace);
          preview.appendChild(newPara);
          
          const newRange = document.createRange();
          const newSel = window.getSelection();
          newRange.setStart(zeroWidthSpace, 0);
          newRange.setEnd(zeroWidthSpace, 0);
          newSel.removeAllRanges();
          newSel.addRange(newRange);
        } else {
          // Place cursor at the very end
          const newRange = document.createRange();
          const newSel = window.getSelection();
          newRange.selectNodeContents(preview);
          newRange.collapse(false);
          newSel.removeAllRanges();
          newSel.addRange(newRange);
        }
      }, 10);
      
      return;
    }
    
    // For normal text, insert <br>
    range.deleteContents();
    
    const br = document.createElement('br');
    range.insertNode(br);
    
    const textNode = document.createTextNode('\u200B');
    range.setStartAfter(br);
    range.insertNode(textNode);
    
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
    
    preview.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Re-render markdown to transform any markdown syntax
    setTimeout(() => {
      const markdownInput = document.getElementById('markdown-input');
      renderMarkdownPreview(markdownInput.value, true);
      
      preview.focus();
      
      // Create a new paragraph at the end for the cursor
      const newPara = document.createElement('p');
      const zeroWidthSpace = document.createTextNode('\u200B');
      newPara.appendChild(zeroWidthSpace);
      preview.appendChild(newPara);
      
      const newRange = document.createRange();
      const newSel = window.getSelection();
      
      newRange.setStart(zeroWidthSpace, 0);
      newRange.setEnd(zeroWidthSpace, 0);
      
      newSel.removeAllRanges();
      newSel.addRange(newRange);
    }, 10);
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
  
  // Remove data-cursor-placeholder from any paragraphs that now have content
  const placeholders = preview.querySelectorAll('p[data-cursor-placeholder]');
  placeholders.forEach(p => {
    // If the paragraph has text content (not just whitespace/br), remove the placeholder attribute
    const hasContent = p.textContent.trim().length > 0 || (p.childNodes.length > 0 && !p.querySelector('br'));
    if (hasContent) {
      p.removeAttribute('data-cursor-placeholder');
    }
  });
  
  // Convert HTML back to markdown
  const markdown = htmlToMarkdown(preview);
  
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
      
      // Save the image via IPC
      const result = await window.electronAPI.saveImage(state.basePath, fileName, base64Data);
      
      if (result.success) {
        // Insert markdown image syntax at cursor
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
          const markdown = htmlToMarkdown(preview);
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
      
      // Update markdown source
      updateCodeBlockLanguageInMarkdown(pre, newLang, codeContent);
    });
    
    selector.appendChild(select);
    wrapper.insertBefore(selector, pre);
  });
}

// Update markdown source when language changes
function updateCodeBlockLanguageInMarkdown(pre, newLang, codeContent) {
  const markdownInput = document.getElementById('markdown-input');
  const currentMarkdown = markdownInput.value;
  
  // Escape special regex characters in code content
  const escapedContent = codeContent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Try to find and update the code block
  // Match: ```any-language\ncode\n``` or ```\ncode\n```
  const patterns = [
    new RegExp(`\`\`\`\\w*\\n${escapedContent}\\n\`\`\``, 'g'),
    new RegExp(`\`\`\`\\n${escapedContent}\\n\`\`\``, 'g')
  ];
  
  let updated = false;
  for (const pattern of patterns) {
    if (pattern.test(currentMarkdown)) {
      const langTag = newLang === 'plaintext' ? '' : newLang;
      const replacement = `\`\`\`${langTag}\n${codeContent}\n\`\`\``;
      markdownInput.value = currentMarkdown.replace(pattern, replacement);
      updated = true;
      break;
    }
  }
  
  if (updated) {
    saveCurrentFile(markdownInput.value);
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
    
    // Add change event listener
    newCheckbox.addEventListener('change', function(e) {
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
        }
        await loadDirectory(state.basePath);
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
          hideEditor();
        }
        await loadDirectory(state.basePath);
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

function hideWelcomeScreen() {
  const welcomeScreen = document.querySelector('.welcome-screen');
  if (welcomeScreen && state.directoryStructure) {
    // Keep welcome screen visible if no file is open
    if (!state.currentFile) {
      welcomeScreen.style.display = 'flex';
    }
  }
}
