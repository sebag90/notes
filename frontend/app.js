// Configuration
const API_BASE = '/api';

// Application State
let state = {
    token: localStorage.getItem('notes_token') || null,
    username: localStorage.getItem('notes_username') || null,
    folders: [],
    notes: [],
    activeNoteId: null,
    editorMode: localStorage.getItem('notes_editor_mode') || 'split', // edit, split, preview
    expandedFolders: new Set(JSON.parse(localStorage.getItem('notes_expanded_folders') || '[]')),
    saveTimeout: null
};

// DOM Elements
const el = {
    loginOverlay: document.getElementById('login-overlay'),
    loginForm: document.getElementById('login-form'),
    loginError: document.getElementById('login-error'),
    usernameInput: document.getElementById('username'),
    passwordInput: document.getElementById('password'),
    
    workspace: document.getElementById('workspace'),
    logoutBtn: document.getElementById('logout-btn'),
    loggedInUser: document.getElementById('logged-in-user'),
    treeContainer: document.getElementById('tree-container'),
    
    welcomePane: document.getElementById('welcome-pane'),
    editorPane: document.getElementById('editor-pane'),
    
    noteBreadcrumbs: document.getElementById('note-breadcrumbs'),
    noteTitleInput: document.getElementById('note-title-input'),
    markdownTextarea: document.getElementById('markdown-textarea'),
    panePreview: document.getElementById('pane-preview'),
    paneEditor: document.getElementById('pane-editor'),
    paneDivider: document.getElementById('pane-divider'),
    
    modeEdit: document.getElementById('mode-edit'),
    modeSplit: document.getElementById('mode-split'),
    modePreview: document.getElementById('mode-preview'),
    
    saveStatus: document.getElementById('save-status'),
    saveStatusSaved: document.getElementById('save-status-saved'),
    saveStatusSaving: document.getElementById('save-status-saving'),
    saveStatusText: document.getElementById('save-status-text'),
    
    noteWordCount: document.getElementById('note-word-count'),
    noteDatesDisplay: document.getElementById('note-dates-display'),
    
    btnNewRootFolder: document.getElementById('btn-new-root-folder'),
    btnNewRootNote: document.getElementById('btn-new-root-note'),
    toolbarMoveNote: document.getElementById('toolbar-move-note'),
    toolbarDeleteNote: document.getElementById('toolbar-delete-note'),
    
    // Modals
    folderModal: document.getElementById('folder-modal'),
    folderForm: document.getElementById('folder-form'),
    folderModalTitle: document.getElementById('folder-modal-title'),
    folderModalParentId: document.getElementById('folder-modal-parent-id'),
    folderModalEditId: document.getElementById('folder-modal-edit-id'),
    folderNameInput: document.getElementById('folder-name-input'),
    
    moveModal: document.getElementById('move-modal'),
    moveForm: document.getElementById('move-form'),
    moveModalItemId: document.getElementById('move-modal-item-id'),
    moveModalItemType: document.getElementById('move-modal-item-type'),
    moveFolderSelect: document.getElementById('move-folder-select')
};

// Initialize Application
function init() {
    setupEventListeners();
    applyEditorMode(state.editorMode);
    
    if (state.token) {
        showWorkspace();
    } else {
        showLogin();
    }
}

// Event Listeners
function setupEventListeners() {
    // Login
    el.loginForm.addEventListener('submit', handleLogin);
    el.logoutBtn.addEventListener('click', handleLogout);
    
    // Root Actions
    el.btnNewRootFolder.addEventListener('click', () => openFolderModal(null));
    el.btnNewRootNote.addEventListener('click', () => createNote(null));
    
    // Editor Modes
    el.modeEdit.addEventListener('click', () => setEditorMode('edit'));
    el.modeSplit.addEventListener('click', () => setEditorMode('split'));
    el.modePreview.addEventListener('click', () => setEditorMode('preview'));
    
    // Textarea Indentation support (Tab key)
    el.markdownTextarea.addEventListener('keydown', handleTextareaKeydown);
    
    // Auto-save typing listeners
    el.markdownTextarea.addEventListener('input', triggerAutoSave);
    el.noteTitleInput.addEventListener('input', triggerAutoSave);
    
    // Toolbar operations
    el.toolbarDeleteNote.addEventListener('click', () => {
        if (state.activeNoteId) {
            confirmAndDeleteNote(state.activeNoteId);
        }
    });
    el.toolbarMoveNote.addEventListener('click', () => {
        if (state.activeNoteId) {
            openMoveModal(state.activeNoteId, 'note');
        }
    });
    
    // Folder Forms & Modals
    el.folderForm.addEventListener('submit', handleFolderFormSubmit);
    el.moveForm.addEventListener('submit', handleMoveFormSubmit);
    
    // Close modals on clicking backdrop or close buttons
    document.querySelectorAll('.modal-close').forEach(button => {
        button.addEventListener('click', closeAllModals);
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === el.folderModal) el.folderModal.classList.add('hidden');
        if (e.target === el.moveModal) el.moveModal.classList.add('hidden');
    });

    // Drag and Drop over tree container (to move to root)
    el.treeContainer.addEventListener('dragover', (e) => {
        if (!e.target.closest('.folder-row')) {
            e.preventDefault();
            el.treeContainer.classList.add('bg-slate-800/20');
        }
    });
    
    el.treeContainer.addEventListener('dragleave', (e) => {
        if (!e.relatedTarget || !el.treeContainer.contains(e.relatedTarget)) {
            el.treeContainer.classList.remove('bg-slate-800/20');
        }
    });
    
    el.treeContainer.addEventListener('drop', (e) => {
        if (e.target.closest('.folder-row')) return;
        
        e.preventDefault();
        el.treeContainer.classList.remove('bg-slate-800/20');
        const noteId = e.dataTransfer.getData('text/plain');
        if (noteId) {
            moveNoteToFolder(noteId, null);
        }
    });
}

// API Fetch Helper
async function apiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });
    
    if (response.status === 401) {
        // Token expired or invalid
        handleLogout();
        throw new Error("Unauthorized. Please log in again.");
    }
    
    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP Error ${response.status}`);
    }
    
    if (response.status === 204) {
        return null;
    }
    
    return await response.json();
}

// Login/Logout Handlers
async function handleLogin(e) {
    e.preventDefault();
    el.loginError.classList.add('hidden');
    
    const username = el.usernameInput.value.trim();
    const password = el.passwordInput.value;
    
    try {
        const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        state.token = data.access_token;
        state.username = username;
        localStorage.setItem('notes_token', data.access_token);
        localStorage.setItem('notes_username', username);
        
        showWorkspace();
    } catch (err) {
        el.loginError.textContent = err.message || "Failed to log in";
        el.loginError.classList.remove('hidden');
    }
}

function handleLogout() {
    state.token = null;
    state.username = null;
    state.activeNoteId = null;
    state.folders = [];
    state.notes = [];
    localStorage.removeItem('notes_token');
    localStorage.removeItem('notes_username');
    
    showLogin();
}

function showLogin() {
    el.loginOverlay.classList.remove('hidden');
    el.workspace.classList.add('hidden');
    el.usernameInput.value = '';
    el.passwordInput.value = '';
    el.loginError.classList.add('hidden');
    lucide.createIcons();
}

async function showWorkspace() {
    el.loginOverlay.classList.add('hidden');
    el.workspace.classList.remove('hidden');
    el.loggedInUser.textContent = state.username;
    
    await loadData();
    lucide.createIcons();
}

// Data Loading
async function loadData() {
    try {
        const [folders, notes] = await Promise.all([
            apiFetch('/folders'),
            apiFetch('/notes')
        ]);
        
        state.folders = folders;
        state.notes = notes;
        
        renderTree();
    } catch (err) {
        console.error("Error loading notes and folders:", err);
    }
}

// Tree Rendering (Infinite levels support)
function renderTree() {
    el.treeContainer.innerHTML = '';
    
    // Sort items alphabetically
    state.folders.sort((a, b) => a.name.localeCompare(b.name));
    state.notes.sort((a, b) => a.title.localeCompare(b.title));
    
    // Render top-level (root) items
    const treeHTML = buildTreeHTML(null, 0);
    el.treeContainer.innerHTML = treeHTML || `<div class="text-slate-500 text-xs text-center py-8">No folders or notes yet</div>`;
    
    // Bind Event Listeners on the rendered elements
    bindTreeEvents();
    lucide.createIcons();
}

function buildTreeHTML(parentId, depth) {
    let html = '';
    
    // Filter folders and notes in this parent
    const currentFolders = state.folders.filter(f => f.parent_id === parentId);
    const currentNotes = state.notes.filter(n => n.folder_id === parentId);
    
    // Render folders first
    currentFolders.forEach(folder => {
        const isExpanded = state.expandedFolders.has(folder.id);
        const childrenHTML = isExpanded ? buildTreeHTML(folder.id, depth + 1) : '';
        const paddingLeft = depth * 12 + 8; // dynamic padding-left
        
        html += `
            <div class="folder-group" data-folder-id="${folder.id}">
                <div class="folder-row flex items-center justify-between py-1 px-2 rounded hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer group transition-all" style="padding-left: ${paddingLeft}px" data-id="${folder.id}">
                    <div class="flex items-center space-x-1.5 min-w-0 flex-1">
                        <button class="expand-btn p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-transform ${isExpanded ? 'rotate-90' : ''}">
                            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
                        </button>
                        <i data-lucide="${isExpanded ? 'folder-open' : 'folder'}" class="w-4 h-4 text-amber-400 flex-shrink-0"></i>
                        <span class="truncate font-medium text-xs">${escapeHTML(folder.name)}</span>
                    </div>
                    <div class="hidden group-hover:flex items-center space-x-1 flex-shrink-0 ml-1">
                        <button class="add-note-btn p-0.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded" title="New Note" data-id="${folder.id}">
                            <i data-lucide="file-plus" class="w-3 h-3"></i>
                        </button>
                        <button class="add-subfolder-btn p-0.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 rounded" title="New Subfolder" data-id="${folder.id}">
                            <i data-lucide="folder-plus" class="w-3 h-3"></i>
                        </button>
                        <button class="rename-folder-btn p-0.5 text-slate-400 hover:text-amber-400 hover:bg-slate-700 rounded" title="Rename" data-id="${folder.id}">
                            <i data-lucide="edit-3" class="w-3 h-3"></i>
                        </button>
                        <button class="delete-folder-btn p-0.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded" title="Delete" data-id="${folder.id}">
                            <i data-lucide="trash" class="w-3 h-3"></i>
                        </button>
                    </div>
                </div>
                <div class="folder-children ${isExpanded ? '' : 'hidden'}" id="children-${folder.id}">
                    ${childrenHTML}
                </div>
            </div>
        `;
    });
    
    // Render notes next
    currentNotes.forEach(note => {
        const isActive = state.activeNoteId === note.id;
        const paddingLeft = depth * 12 + (parentId ? 24 : 12);
        
        html += `
            <div class="note-row flex items-center justify-between py-1 px-2 rounded cursor-pointer group transition-all ${isActive ? 'bg-indigo-600 text-white font-medium shadow-xs' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}" style="padding-left: ${paddingLeft}px" data-id="${note.id}" draggable="true">
                <div class="flex items-center space-x-1.5 min-w-0 flex-1">
                    <i data-lucide="file-text" class="w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}"></i>
                    <span class="truncate text-xs">${escapeHTML(note.title || 'Untitled Note')}</span>
                </div>
                <div class="hidden group-hover:flex items-center flex-shrink-0 ml-1">
                    <button class="delete-note-btn p-0.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded" title="Delete Note" data-id="${note.id}">
                        <i data-lucide="trash" class="w-3 h-3"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    return html;
}

function bindTreeEvents() {
    // Click Folder row (Expand / Collapse)
    document.querySelectorAll('.folder-row').forEach(row => {
        row.addEventListener('click', (e) => {
            // Prevent expand if clicking on inline buttons
            if (e.target.closest('button') && !e.target.closest('.expand-btn')) return;
            
            const folderId = row.dataset.id;
            toggleFolder(folderId);
        });
    });
    
    // Folder Expand button
    document.querySelectorAll('.expand-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const folderRow = btn.closest('.folder-row');
            const folderId = folderRow.dataset.id;
            toggleFolder(folderId);
        });
    });
    
    // Click Note row (Select Note)
    document.querySelectorAll('.note-row').forEach(row => {
        row.addEventListener('click', () => {
            const noteId = row.dataset.id;
            selectNote(noteId);
        });
    });
    
    // Folder Actions
    document.querySelectorAll('.add-note-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            createNote(btn.dataset.id);
        });
    });
    document.querySelectorAll('.add-subfolder-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openFolderModal(btn.dataset.id);
        });
    });
    document.querySelectorAll('.rename-folder-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const folderId = btn.dataset.id;
            const folder = state.folders.find(f => f.id === folderId);
            if (folder) {
                openFolderModal(folder.parent_id, folder.id, folder.name);
            }
        });
    });
    document.querySelectorAll('.delete-folder-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmAndDeleteFolder(btn.dataset.id);
        });
    });

    document.querySelectorAll('.delete-note-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmAndDeleteNote(btn.dataset.id);
        });
    });

    // Drag and Drop handlers for notes and folders
    document.querySelectorAll('.note-row').forEach(row => {
        row.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', row.dataset.id);
            row.classList.add('opacity-50');
        });
        
        row.addEventListener('dragend', () => {
            row.classList.remove('opacity-50');
        });
    });
    
    document.querySelectorAll('.folder-row').forEach(row => {
        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            row.classList.add('bg-slate-700', 'text-white');
        });
        
        row.addEventListener('dragleave', () => {
            row.classList.remove('bg-slate-700', 'text-white');
        });
        
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            row.classList.remove('bg-slate-700', 'text-white');
            const noteId = e.dataTransfer.getData('text/plain');
            const folderId = row.dataset.id;
            
            if (noteId && folderId) {
                moveNoteToFolder(noteId, folderId);
            }
        });
    });
}

// Folder Collapsing/Expanding Persistence
function toggleFolder(folderId) {
    const childrenDiv = document.getElementById(`children-${folderId}`);
    const folderGroup = document.querySelector(`.folder-group[data-folder-id="${folderId}"]`);
    const iconSpan = folderGroup.querySelector('.folder-row svg.lucide-folder, .folder-row svg.lucide-folder-open');
    const chevron = folderGroup.querySelector('.expand-btn');
    
    if (state.expandedFolders.has(folderId)) {
        state.expandedFolders.delete(folderId);
        if (childrenDiv) childrenDiv.classList.add('hidden');
        if (chevron) chevron.classList.remove('rotate-90');
        // update folder icon to closed
        if (iconSpan) {
            iconSpan.innerHTML = '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path>';
            iconSpan.setAttribute('class', 'lucide lucide-folder w-4 h-4 text-amber-400 flex-shrink-0');
        }
    } else {
        state.expandedFolders.add(folderId);
        
        // Render sub-elements dynamically if not loaded
        if (childrenDiv) {
            childrenDiv.innerHTML = buildTreeHTML(folderId, getFolderDepth(folderId) + 1);
            childrenDiv.classList.remove('hidden');
            bindTreeEvents();
        }
        
        if (chevron) chevron.classList.add('rotate-90');
        // update folder icon to open
        if (iconSpan) {
            iconSpan.innerHTML = '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path><path d="M2 10h20"></path>';
            iconSpan.setAttribute('class', 'lucide lucide-folder-open w-4 h-4 text-amber-400 flex-shrink-0');
        }
    }
    
    localStorage.setItem('notes_expanded_folders', JSON.stringify(Array.from(state.expandedFolders)));
}

function getFolderDepth(folderId) {
    let depth = 0;
    let currentId = folderId;
    while (currentId) {
        const folder = state.folders.find(f => f.id === currentId);
        if (!folder) break;
        depth++;
        currentId = folder.parent_id;
    }
    return depth;
}

// Note Selection
function selectNote(noteId) {
    // Save any pending changes first
    if (state.saveTimeout) {
        clearTimeout(state.saveTimeout);
        saveNoteImmediately();
    }
    
    state.activeNoteId = noteId;
    const note = state.notes.find(n => n.id === noteId);
    if (!note) return;
    
    // Highlight correct note in sidebar without full re-render
    document.querySelectorAll('.note-row').forEach(row => {
        if (row.dataset.id === noteId) {
            row.setAttribute('class', 'note-row flex items-center justify-between py-1 px-2 rounded cursor-pointer group transition-all bg-indigo-600 text-white font-medium shadow-xs');
            row.querySelector('svg').setAttribute('class', 'lucide lucide-file-text w-3.5 h-3.5 flex-shrink-0 text-white');
        } else {
            row.setAttribute('class', 'note-row flex items-center justify-between py-1 px-2 rounded cursor-pointer group transition-all text-slate-400 hover:bg-slate-800 hover:text-slate-200');
            row.querySelector('svg').setAttribute('class', 'lucide lucide-file-text w-3.5 h-3.5 flex-shrink-0 text-slate-500');
        }
    });
    
    // Display note details
    el.welcomePane.classList.add('hidden');
    el.editorPane.classList.remove('hidden');
    
    el.noteTitleInput.value = note.title;
    el.markdownTextarea.value = note.content;
    
    updateMarkdownPreview();
    updateNoteBreadcrumbs(note);
    updateWordCount(note.content);
    updateDatesDisplay(note);
    
    // Reset save status
    el.saveStatusSaved.classList.remove('hidden');
    el.saveStatusSaving.classList.add('hidden');
    el.saveStatusText.textContent = 'Saved';
}

function updateNoteBreadcrumbs(note) {
    let path = [];
    let currentParentId = note.folder_id;
    
    while (currentParentId) {
        const folder = state.folders.find(f => f.id === currentParentId);
        if (!folder) break;
        path.unshift(folder.name);
        currentParentId = folder.parent_id;
    }
    
    path.unshift('Root');
    
    el.noteBreadcrumbs.innerHTML = path.map((name, index) => {
        if (index === path.length - 1) {
            return `<span class="text-slate-600 font-semibold truncate max-w-[150px]">${escapeHTML(name)}</span>`;
        }
        return `<span>${escapeHTML(name)}</span><i data-lucide="chevron-right" class="w-3 h-3 text-slate-300"></i>`;
    }).join('');
    
    lucide.createIcons();
}

function updateWordCount(content) {
    const text = content.trim();
    const count = text ? text.split(/\s+/).length : 0;
    el.noteWordCount.textContent = `${count} word${count === 1 ? '' : 's'}`;
}

function updateDatesDisplay(note) {
    el.noteDatesDisplay.textContent = `Created: ${formatEuropeDate(note.created_at)} | Updated: ${formatEuropeDate(note.updated_at)}`;
}

// Markdown Preview Rendering
function updateMarkdownPreview() {
    const markdown = el.markdownTextarea.value;
    // Configure marked to be secure
    marked.setOptions({
        gfm: true,
        breaks: true,
        headerIds: false,
        mangle: false
    });
    el.panePreview.innerHTML = marked.parse(markdown || '*No content yet. Start writing!*');
}

// Auto-Save Mechanics
function triggerAutoSave() {
    updateMarkdownPreview();
    updateWordCount(el.markdownTextarea.value);
    
    // Update local state copy immediately
    const note = state.notes.find(n => n.id === state.activeNoteId);
    if (note) {
        note.title = el.noteTitleInput.value;
        note.content = el.markdownTextarea.value;
        
        // Also update the note name inside the sidebar tree immediately without full redraw
        const sidebarNoteRow = document.querySelector(`.note-row[data-id="${state.activeNoteId}"] span`);
        if (sidebarNoteRow) {
            sidebarNoteRow.textContent = note.title || 'Untitled Note';
        }
    }
    
    // Set auto-save indicator
    el.saveStatusSaved.classList.add('hidden');
    el.saveStatusSaving.classList.add('hidden');
    el.saveStatusText.textContent = 'Unsaved changes';
    
    if (state.saveTimeout) clearTimeout(state.saveTimeout);
    
    state.saveTimeout = setTimeout(saveNoteImmediately, 600);
}

async function saveNoteImmediately() {
    if (!state.activeNoteId) return;
    
    el.saveStatusSaved.classList.add('hidden');
    el.saveStatusSaving.classList.remove('hidden');
    el.saveStatusText.textContent = 'Saving...';
    
    const title = el.noteTitleInput.value;
    const content = el.markdownTextarea.value;
    
    try {
        const updatedNote = await apiFetch(`/notes/${state.activeNoteId}`, {
            method: 'PATCH',
            body: JSON.stringify({ title, content })
        });
        
        // Sync state list
        const idx = state.notes.findIndex(n => n.id === state.activeNoteId);
        if (idx !== -1) {
            state.notes[idx] = updatedNote;
        }
        
        updateDatesDisplay(updatedNote);
        
        el.saveStatusSaving.classList.add('hidden');
        el.saveStatusSaved.classList.remove('hidden');
        el.saveStatusText.textContent = 'Saved';
    } catch (err) {
        console.error("Auto-save failed:", err);
        el.saveStatusSaving.classList.add('hidden');
        el.saveStatusText.textContent = 'Save failed!';
    }
}

// Action: Create Note
async function createNote(folderId) {
    try {
        const newNote = await apiFetch('/notes', {
            method: 'POST',
            body: JSON.stringify({
                title: 'Untitled Note',
                content: '',
                folder_id: folderId ? folderId : null
            })
        });
        
        state.notes.push(newNote);
        
        // Expand parent folder automatically to show the note
        if (folderId && !state.expandedFolders.has(folderId)) {
            state.expandedFolders.add(folderId);
            localStorage.setItem('notes_expanded_folders', JSON.stringify(Array.from(state.expandedFolders)));
        }
        
        renderTree();
        selectNote(newNote.id);
    } catch (err) {
        alert("Failed to create note: " + err.message);
    }
}

// Action: Move Note (Helper)
async function moveNoteToFolder(noteId, destFolderId) {
    try {
        const updatedNote = await apiFetch(`/notes/${noteId}`, {
            method: 'PATCH',
            body: JSON.stringify({ folder_id: destFolderId })
        });
        
        const idx = state.notes.findIndex(n => n.id === noteId);
        if (idx !== -1) {
            state.notes[idx] = updatedNote;
        }
        
        if (state.activeNoteId === noteId) {
            updateNoteBreadcrumbs(updatedNote);
        }
        
        // Expand destination folder to show moved item
        if (destFolderId) {
            state.expandedFolders.add(destFolderId);
            localStorage.setItem('notes_expanded_folders', JSON.stringify(Array.from(state.expandedFolders)));
        }
        
        renderTree();
    } catch (err) {
        alert("Failed to move note: " + err.message);
    }
}

// Action: Delete Note
async function confirmAndDeleteNote(noteId) {
    const note = state.notes.find(n => n.id === noteId);
    if (!note) return;
    
    if (confirm(`Are you sure you want to delete the note "${note.title || 'Untitled Note'}"?`)) {
        try {
            await apiFetch(`/notes/${noteId}`, { method: 'DELETE' });
            
            state.notes = state.notes.filter(n => n.id !== noteId);
            state.activeNoteId = null;
            
            el.editorPane.classList.add('hidden');
            el.welcomePane.classList.remove('hidden');
            
            renderTree();
        } catch (err) {
            alert("Failed to delete note: " + err.message);
        }
    }
}

// Action: Delete Folder
async function confirmAndDeleteFolder(folderId) {
    const folder = state.folders.find(f => f.id === folderId);
    if (!folder) return;
    
    if (confirm(`Are you sure you want to delete folder "${folder.name}"? This will recursively delete all subfolders and notes inside it!`)) {
        try {
            await apiFetch(`/folders/${folderId}`, { method: 'DELETE' });
            
            // Cascaded delete in UI state
            const childFolders = getAllDescendantFolderIds(folderId);
            const folderIdsToDelete = [folderId, ...childFolders];
            
            state.folders = state.folders.filter(f => !folderIdsToDelete.includes(f.id));
            state.notes = state.notes.filter(n => !folderIdsToDelete.includes(n.folder_id));
            
            // Clean up active selected note if it was deleted
            if (state.activeNoteId && state.notes.findIndex(n => n.id === state.activeNoteId) === -1) {
                state.activeNoteId = null;
                el.editorPane.classList.add('hidden');
                el.welcomePane.classList.remove('hidden');
            }
            
            // Remove from expanded state
            folderIdsToDelete.forEach(id => state.expandedFolders.delete(id));
            localStorage.setItem('notes_expanded_folders', JSON.stringify(Array.from(state.expandedFolders)));
            
            renderTree();
        } catch (err) {
            alert("Failed to delete folder: " + err.message);
        }
    }
}

// Modals: Folder Create/Rename
function openFolderModal(parentId, editId = null, currentName = '') {
    el.folderModalParentId.value = parentId || '';
    el.folderModalEditId.value = editId || '';
    el.folderNameInput.value = currentName;
    
    if (editId) {
        el.folderModalTitle.textContent = "Rename Folder";
    } else {
        el.folderModalTitle.textContent = "New Folder";
    }
    
    el.folderModal.classList.remove('hidden');
    el.folderNameInput.focus();
}

async function handleFolderFormSubmit(e) {
    e.preventDefault();
    
    const parentId = el.folderModalParentId.value || null;
    const editId = el.folderModalEditId.value || null;
    const name = el.folderNameInput.value.trim();
    
    if (!name) return;
    
    try {
        if (editId) {
            // Rename
            const updatedFolder = await apiFetch(`/folders/${editId}`, {
                method: 'PATCH',
                body: JSON.stringify({ name })
            });
            const idx = state.folders.findIndex(f => f.id === editId);
            if (idx !== -1) state.folders[idx] = updatedFolder;
        } else {
            // Create
            const newFolder = await apiFetch('/folders', {
                method: 'POST',
                body: JSON.stringify({ name, parent_id: parentId })
            });
            state.folders.push(newFolder);
            
            // Expand parent folder automatically to show subfolder
            if (parentId) {
                state.expandedFolders.add(parentId);
                localStorage.setItem('notes_expanded_folders', JSON.stringify(Array.from(state.expandedFolders)));
            }
        }
        
        el.folderModal.classList.add('hidden');
        renderTree();
    } catch (err) {
        alert("Failed to save folder: " + err.message);
    }
}

// Modals: Move Item (Note / Folder)
function openMoveModal(itemId, itemType) {
    el.moveModalItemId.value = itemId;
    el.moveModalItemType.value = itemType;
    
    // Clear and build options
    el.moveFolderSelect.innerHTML = '<option value="root">Root (No Folder)</option>';
    
    // Filter out invalid destination folders (e.g., self or children when moving folder)
    let invalidDestinations = [];
    if (itemType === 'folder') {
        invalidDestinations = [itemId, ...getAllDescendantFolderIds(itemId)];
    }
    
    // Add eligible folders
    const eligibleFolders = state.folders.filter(f => !invalidDestinations.includes(f.id));
    eligibleFolders.sort((a,b) => a.name.localeCompare(b.name));
    
    eligibleFolders.forEach(folder => {
        // Build breadcrumb-style folder name
        const path = getFolderBreadcrumbPath(folder.id);
        const option = document.createElement('option');
        option.value = folder.id;
        option.textContent = path.join(' / ');
        
        // Select current folder
        if (itemType === 'note') {
            const note = state.notes.find(n => n.id === itemId);
            if (note && note.folder_id === folder.id) {
                option.selected = true;
            }
        } else {
            const f = state.folders.find(fol => fol.id === itemId);
            if (f && f.parent_id === folder.id) {
                option.selected = true;
            }
        }
        
        el.moveFolderSelect.appendChild(option);
    });
    
    // Handle select current root for notes/folders
    if (itemType === 'note') {
        const note = state.notes.find(n => n.id === itemId);
        if (note && !note.folder_id) {
            el.moveFolderSelect.value = 'root';
        }
    } else {
        const f = state.folders.find(fol => fol.id === itemId);
        if (f && !f.parent_id) {
            el.moveFolderSelect.value = 'root';
        }
    }
    
    el.moveModal.classList.remove('hidden');
}

async function handleMoveFormSubmit(e) {
    e.preventDefault();
    
    const itemId = el.moveModalItemId.value;
    const itemType = el.moveModalItemType.value;
    const destFolderId = el.moveFolderSelect.value === 'root' ? null : el.moveFolderSelect.value;
    
    try {
        if (itemType === 'note') {
            const updatedNote = await apiFetch(`/notes/${itemId}`, {
                method: 'PATCH',
                body: JSON.stringify({ folder_id: destFolderId })
            });
            
            const idx = state.notes.findIndex(n => n.id === itemId);
            if (idx !== -1) {
                state.notes[idx] = updatedNote;
            }
            
            if (state.activeNoteId === itemId) {
                updateNoteBreadcrumbs(updatedNote);
            }
        } else {
            const updatedFolder = await apiFetch(`/folders/${itemId}`, {
                method: 'PATCH',
                body: JSON.stringify({ parent_id: destFolderId })
            });
            
            const idx = state.folders.findIndex(f => f.id === itemId);
            if (idx !== -1) {
                state.folders[idx] = updatedFolder;
            }
        }
        
        // Expand destination folder to show moved item
        if (destFolderId) {
            state.expandedFolders.add(destFolderId);
            localStorage.setItem('notes_expanded_folders', JSON.stringify(Array.from(state.expandedFolders)));
        }
        
        el.moveModal.classList.add('hidden');
        renderTree();
    } catch (err) {
        alert("Failed to move item: " + err.message);
    }
}

// Helpers for navigation / structure
function getFolderBreadcrumbPath(folderId) {
    let path = [];
    let currentId = folderId;
    while (currentId) {
        const folder = state.folders.find(f => f.id === currentId);
        if (!folder) break;
        path.unshift(folder.name);
        currentId = folder.parent_id;
    }
    return path;
}

function getAllDescendantFolderIds(folderId) {
    let descendants = [];
    const children = state.folders.filter(f => f.parent_id === folderId);
    children.forEach(child => {
        descendants.push(child.id);
        descendants = descendants.concat(getAllDescendantFolderIds(child.id));
    });
    return descendants;
}

function closeAllModals() {
    el.folderModal.classList.add('hidden');
    el.moveModal.classList.add('hidden');
}

// Editor Workspace Styling & Tabs
function applyEditorMode(mode) {
    state.editorMode = mode;
    localStorage.setItem('notes_editor_mode', mode);
    
    // Toggle active tab styles
    const btnMap = { edit: el.modeEdit, split: el.modeSplit, preview: el.modePreview };
    Object.keys(btnMap).forEach(key => {
        if (key === mode) {
            btnMap[key].setAttribute('class', 'px-2.5 py-1 rounded-md bg-white text-slate-800 shadow-xs flex items-center space-x-1 transition-all font-semibold');
        } else {
            btnMap[key].setAttribute('class', 'px-2.5 py-1 rounded-md hover:text-slate-800 flex items-center space-x-1 transition-all');
        }
    });
    
    // Show/Hide panes based on mode
    if (mode === 'edit') {
        el.paneEditor.classList.remove('hidden');
        el.panePreview.classList.add('hidden');
        el.paneDivider.classList.add('hidden');
    } else if (mode === 'preview') {
        el.paneEditor.classList.add('hidden');
        el.panePreview.classList.remove('hidden');
        el.paneDivider.classList.add('hidden');
    } else { // split
        el.paneEditor.classList.remove('hidden');
        el.panePreview.classList.remove('hidden');
        el.paneDivider.classList.remove('hidden');
    }
}

function setEditorMode(mode) {
    applyEditorMode(mode);
}

function handleTextareaKeydown(e) {
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.selectionStart;
        const end = this.selectionEnd;
        const value = this.value;
        
        // Insert 4 spaces
        this.value = value.substring(0, start) + "    " + value.substring(end);
        
        // Restore cursor position
        this.selectionStart = this.selectionEnd = start + 4;
        triggerAutoSave();
    }
}

// Date Formatter (DD-MM-YYYY HH:MM)
function formatEuropeDate(dateString) {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "-";
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${day}-${month}-${year} ${hours}:${minutes}`;
}

// Escape HTML utility for securing content
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Start running code
init();
