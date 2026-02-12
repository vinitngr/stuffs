console.log('ExcaliVault loaded');

const STORAGE_KEY = 'excaliVault_projects';

const pendingLoadId = sessionStorage.getItem('excaliVault_loadOnStart');
if (pendingLoadId) {
    console.log('ExcaliVault: Found pending load on startup, project ID:', pendingLoadId);
    
    sessionStorage.removeItem('excaliVault_loadOnStart');
    
    try {
        const projectsData = localStorage.getItem(STORAGE_KEY);
        if (projectsData) {
            const projects = JSON.parse(projectsData);
            const project = projects.find(p => p.id === parseInt(pendingLoadId));
            
            if (project) {
                console.log('ExcaliVault: Restoring project:', project.name);
                const savedData = JSON.parse(project.canvasData);
                
                if (savedData.elements) {
                    localStorage.setItem('excalidraw', savedData.elements);
                    console.log('ExcaliVault: Set excalidraw elements');
                }
                
                if (savedData.state) {
                    localStorage.setItem('excalidraw-state', savedData.state);
                    console.log('ExcaliVault: Set excalidraw state');
                }
                
                console.log('ExcaliVault: Project data restored to localStorage');
            }
        }
    } catch (error) {
        console.error('ExcaliVault: Error loading project on startup:', error);
    }
}

function initExcaliVault() {
    const topRight = document.querySelector('.layer-ui__wrapper__top-right');
    
    if (!topRight) {
        setTimeout(initExcaliVault, 500);
        return;
    }

    createVaultButton(topRight);
    createModalOverlay();
}

function createVaultButton(container) {
    const button = document.createElement('button');
    button.className = 'excalivault-button excalidraw-button';
    button.title = 'ExcaliVault - Save & Load Projects';
    button.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
        </svg>
        <span>Vault</span>
    `;
    
    button.addEventListener('click', openVaultModal);
    
      const firstChild = container.querySelector('.excalidraw-ui-top-right');
    if (firstChild) {
        container.insertBefore(button, firstChild);
    } else {
        container.appendChild(button);
    }
}

function createModalOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'excalivault-overlay';
    overlay.id = 'excalivault-overlay';
    
    overlay.innerHTML = `
        <div class="excalivault-modal" id="excalivault-modal">
            <div class="excalivault-header">
                <h2>ExcaliVault Projects</h2>
                <button class="excalivault-close" id="excalivault-close">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="excalivault-body" id="excalivault-body">
                <!-- Projects will be rendered here -->
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeVaultModal();
    });
    
    document.getElementById('excalivault-close').addEventListener('click', closeVaultModal);
}

function openVaultModal() {
    showProjectsView();
    document.getElementById('excalivault-overlay').classList.add('active');
}

function closeVaultModal() {
    document.getElementById('excalivault-overlay').classList.remove('active');
}

function showProjectsView() {
    const body = document.getElementById('excalivault-body');
    const projects = getProjects();
    
    if (projects.length === 0) {
        body.innerHTML = `
            <div class="excalivault-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                </svg>
                <p>No projects yet</p>
                <span>Create a drawing and save it to get started</span>
                <button class="excalivault-btn-primary" id="save-new-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Save Current Canvas
                </button>
            </div>
        `;
    } else {
        body.innerHTML = `
            <div style="text-align: right; margin-bottom: 20px;">
                <button class="excalivault-btn-primary" id="save-new-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Save Current Canvas
                </button>
            </div>
            <div class="excalivault-grid">
                ${projects.map(project => `
                    <div class="excalivault-card" data-id="${project.id}">
                        <div class="excalivault-preview">
                            ${project.preview ? `<img src="${project.preview}" alt="${project.name}">` : '<span class="excalivault-preview-text">No preview</span>'}
                        </div>
                        <div class="excalivault-info">
                            <div class="excalivault-name" title="${project.name}">${project.name}</div>
                            <div class="excalivault-date">${project.timestamp}</div>
                            <div class="excalivault-actions">
                                <button class="excalivault-btn excalivault-btn-load" data-id="${project.id}" data-action="load">Load</button>
                                <button class="excalivault-btn excalivault-btn-delete" data-id="${project.id}" data-action="delete">Delete</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    document.getElementById('save-new-btn')?.addEventListener('click', showSaveForm);
    
    document.querySelectorAll('[data-action="load"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            loadProject(parseInt(btn.dataset.id));
        });
    });
    
    document.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteProject(parseInt(btn.dataset.id));
        });
    });
}

function showSaveForm() {
    const body = document.getElementById('excalivault-body');
    const canvasData = getCanvasData();
    const preview = getCanvasPreview();
    
    body.innerHTML = `
        <div class="excalivault-form">
            <div class="excalivault-input-group">
                <label for="project-name-input">Project Name</label>
                <input type="text" id="project-name-input" class="excalivault-input" placeholder="My Awesome Design" maxlength="50">
            </div>
            <div class="excalivault-preview-container">
                ${preview ? `<img src="${preview}" alt="Canvas preview">` : '<span style="color: #9ca3af; font-size: 14px;">Loading preview...</span>'}
            </div>
            <div class="excalivault-form-actions">
                <button class="excalivault-btn-secondary" id="cancel-save-btn">Cancel</button>
                <button class="excalivault-btn-primary" id="confirm-save-btn">Save Project</button>
            </div>
        </div>
    `;
    
    const input = document.getElementById('project-name-input');
    input.focus();
    
    document.getElementById('cancel-save-btn').addEventListener('click', showProjectsView);
    document.getElementById('confirm-save-btn').addEventListener('click', () => {
        saveProject(input.value.trim(), canvasData, preview);
    });
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveProject(input.value.trim(), canvasData, preview);
        }
    });
}

function getCanvasData() {
    try {
        const excalidrawData = localStorage.getItem('excalidraw');
        const excalidrawState = localStorage.getItem('excalidraw-state');
        
        console.log('ExcaliVault: Saving canvas data');
        console.log('ExcaliVault: Elements data length:', excalidrawData?.length || 0);
        console.log('ExcaliVault: State data length:', excalidrawState?.length || 0);
        
        return JSON.stringify({
            elements: excalidrawData,
            state: excalidrawState
        });
    } catch (error) {
        console.error('Error getting canvas data:', error);
        return JSON.stringify({ elements: null, state: null });
    }
}

function getCanvasPreview() {
    try {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            return canvas.toDataURL('image/png');
        }
        return '';
    } catch (error) {
        console.error('Error getting preview:', error);
        return '';
    }
}

function saveProject(name, canvasData, preview) {
    if (!name) {
        alert('Please enter a project name');
        return;
    }
    
    if (!canvasData) {
        alert('No canvas data found');
        return;
    }
    
    const projects = getProjects();
    const newProject = {
        id: Date.now(),
        name: name,
        timestamp: new Date().toLocaleString(),
        canvasData: canvasData,
        preview: preview
    };
    
    projects.push(newProject);
    saveProjects(projects);
    
    showProjectsView();
}

function loadProject(projectId) {
    const projects = getProjects();
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
        alert('Project not found');
        return;
    }
    
    if (confirm(`Load "${project.name}"? Your current canvas will be replaced.`)) {
        try {
            console.log('ExcaliVault: Loading project:', project.name);
            
            const savedData = JSON.parse(project.canvasData);
            
            if (!savedData.elements) {
                alert('Project data is invalid or empty');
                return;
            }
            
            console.log('ExcaliVault: Elements data length:', savedData.elements.length);
            
            sessionStorage.setItem('excaliVault_loadOnStart', projectId.toString());
            
            closeVaultModal();
            
            window.location.reload();
            
        } catch (error) {
            console.error('Error loading project:', error);
            alert('Error loading project: ' + error.message);
        }
    }
}

function deleteProject(projectId) {
    if (confirm('Delete this project? This cannot be undone.')) {
        const projects = getProjects();
        const filtered = projects.filter(p => p.id !== projectId);
        saveProjects(filtered);
        showProjectsView();
    }
}

function getProjects() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Error getting projects:', e);
        return [];
    }
}

function saveProjects(projects) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
        console.error('Error saving projects:', e);
        if (e.name === 'QuotaExceededError') {
            alert('Storage quota exceeded. Please delete some projects.');
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExcaliVault);
} else {
    initExcaliVault();
}

console.log('ExcaliVault content script ready');
