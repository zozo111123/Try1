// SimuVerse AI - Admin Dashboard Application
// Main application logic for simulation builder and research space manager

class SimuVerseApp {
    constructor() {
        this.simulations = [];
        this.spaces = [];
        this.currentSimulation = null;
        this.currentSimulationId = null;
        this.init();
    }

    init() {
        this.loadData();
        this.renderSimulations();
        this.renderSpaces();
        this.updateStats();
        this.setupFileUpload();
        this.setupAutoSave();
    }

    // ==================== DATA MANAGEMENT ====================

    loadData() {
        // Load simulations from localStorage
        const simsData = localStorage.getItem('simuverse_simulations');
        if (simsData) {
            this.simulations = JSON.parse(simsData);
        }

        // Load research spaces
        const spacesData = localStorage.getItem('simuverse_spaces');
        if (spacesData) {
            this.spaces = JSON.parse(spacesData);
        }
    }

    saveData() {
        localStorage.setItem('simuverse_simulations', JSON.stringify(this.simulations));
        localStorage.setItem('simuverse_spaces', JSON.stringify(this.spaces));
        this.updateAutosaveStatus();
    }

    updateAutosaveStatus() {
        const statusEl = document.getElementById('autosave-status');
        if (statusEl) {
            statusEl.textContent = '✓ נשמר אוטומטית';
            statusEl.style.color = 'var(--accent-color)';

            setTimeout(() => {
                statusEl.style.color = 'var(--text-secondary)';
            }, 2000);
        }
    }

    setupAutoSave() {
        // Auto-save on input changes
        const inputs = ['sim-name', 'sim-description', 'sim-objectives',
                       'roleplay-prompt', 'mentor-prompt', 'reflection-prompt',
                       'evaluation-prompt', 'evaluation-criteria'];

        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    if (this.currentSimulation) {
                        this.autoSaveSimulation();
                    }
                });
            }
        });
    }

    autoSaveSimulation() {
        if (!this.currentSimulation) return;

        // Update current simulation with form values
        this.currentSimulation.name = document.getElementById('sim-name').value;
        this.currentSimulation.description = document.getElementById('sim-description').value;
        this.currentSimulation.objectives = document.getElementById('sim-objectives').value;
        this.currentSimulation.roleplay.prompt = document.getElementById('roleplay-prompt').value;
        this.currentSimulation.roleplay.voice = document.getElementById('roleplay-voice').value;
        this.currentSimulation.roleplay.voiceStyle = document.getElementById('roleplay-voice-style').value;
        this.currentSimulation.mentor.prompt = document.getElementById('mentor-prompt').value;
        this.currentSimulation.mentor.enabled = document.getElementById('mentor-enabled').checked;
        this.currentSimulation.reflection.prompt = document.getElementById('reflection-prompt').value;
        this.currentSimulation.reflection.enabled = document.getElementById('reflection-enabled').checked;
        this.currentSimulation.evaluation.prompt = document.getElementById('evaluation-prompt').value;

        try {
            const criteria = document.getElementById('evaluation-criteria').value;
            if (criteria.trim()) {
                this.currentSimulation.evaluation.criteria = JSON.parse(criteria);
            }
        } catch (e) {
            // Invalid JSON, don't update
        }

        this.currentSimulation.updatedAt = new Date().toISOString();
        this.saveData();
    }

    // ==================== NAVIGATION ====================

    showMainTab(tabName) {
        // Update tab buttons
        const tabBtns = document.querySelectorAll('.tabs-nav .tab-btn');
        tabBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent.includes(this.getTabLabel(tabName))) {
                btn.classList.add('active');
            }
        });

        // Update tab content
        const tabs = ['overview', 'simulations', 'spaces'];
        tabs.forEach(tab => {
            const el = document.getElementById(`tab-${tab}`);
            if (el) {
                el.classList.toggle('active', tab === tabName);
            }
        });

        // Refresh content
        if (tabName === 'simulations') {
            this.renderSimulations();
        } else if (tabName === 'spaces') {
            this.renderSpaces();
        } else if (tabName === 'overview') {
            this.updateStats();
        }
    }

    getTabLabel(tabName) {
        const labels = {
            'overview': 'סקירה כללית',
            'simulations': 'סימולציות',
            'spaces': 'מרחבי מחקר'
        };
        return labels[tabName] || tabName;
    }

    showEditorTab(tabName) {
        // Update tab buttons in editor
        const modal = document.getElementById('modal-editor');
        const tabBtns = modal.querySelectorAll('.tabs-nav .tab-btn');
        tabBtns.forEach((btn, idx) => {
            const tabs = ['general', 'roleplay', 'mentor', 'reflection', 'evaluation', 'surveys'];
            btn.classList.toggle('active', tabs[idx] === tabName);
        });

        // Update tab content in editor
        const tabs = ['general', 'roleplay', 'mentor', 'reflection', 'evaluation', 'surveys'];
        tabs.forEach(tab => {
            const el = document.getElementById(`editor-tab-${tab}`);
            if (el) {
                el.classList.toggle('active', tab === tabName);
            }
        });
    }

    // ==================== SIMULATIONS ====================

    createNewSimulation() {
        const simulation = {
            id: this.generateId(),
            name: 'סימולציה חדשה',
            description: '',
            objectives: '',
            roleplay: {
                prompt: '',
                files: [],
                voice: 'female',
                voiceStyle: ''
            },
            mentor: {
                prompt: '',
                enabled: false
            },
            reflection: {
                prompt: '',
                enabled: true
            },
            evaluation: {
                prompt: '',
                criteria: []
            },
            surveys: {
                pre: [],
                post: []
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.simulations.push(simulation);
        this.saveData();
        this.editSimulation(simulation.id);
        this.showMainTab('simulations');
    }

    editSimulation(id) {
        const sim = this.simulations.find(s => s.id === id);
        if (!sim) return;

        this.currentSimulation = sim;
        this.currentSimulationId = id;

        // Populate form
        document.getElementById('sim-name').value = sim.name || '';
        document.getElementById('sim-description').value = sim.description || '';
        document.getElementById('sim-objectives').value = sim.objectives || '';
        document.getElementById('roleplay-prompt').value = sim.roleplay.prompt || '';
        document.getElementById('roleplay-voice').value = sim.roleplay.voice || 'female';
        document.getElementById('roleplay-voice-style').value = sim.roleplay.voiceStyle || '';
        document.getElementById('mentor-prompt').value = sim.mentor.prompt || '';
        document.getElementById('mentor-enabled').checked = sim.mentor.enabled || false;
        document.getElementById('reflection-prompt').value = sim.reflection.prompt || '';
        document.getElementById('reflection-enabled').checked = sim.reflection.enabled !== false;
        document.getElementById('evaluation-prompt').value = sim.evaluation.prompt || '';

        if (sim.evaluation.criteria && sim.evaluation.criteria.length > 0) {
            document.getElementById('evaluation-criteria').value = JSON.stringify(sim.evaluation.criteria, null, 2);
        }

        // Render survey builders
        this.renderSurveyBuilder('pre', sim.surveys.pre || []);
        this.renderSurveyBuilder('post', sim.surveys.post || []);

        // Render uploaded files
        this.renderFilesList(sim.roleplay.files || []);

        // Show modal
        document.getElementById('modal-editor').classList.add('active');
        this.showEditorTab('general');
    }

    saveSimulation() {
        if (!this.currentSimulation) return;

        // Update simulation from form
        this.currentSimulation.name = document.getElementById('sim-name').value;
        this.currentSimulation.description = document.getElementById('sim-description').value;
        this.currentSimulation.objectives = document.getElementById('sim-objectives').value;
        this.currentSimulation.roleplay.prompt = document.getElementById('roleplay-prompt').value;
        this.currentSimulation.roleplay.voice = document.getElementById('roleplay-voice').value;
        this.currentSimulation.roleplay.voiceStyle = document.getElementById('roleplay-voice-style').value;
        this.currentSimulation.mentor.prompt = document.getElementById('mentor-prompt').value;
        this.currentSimulation.mentor.enabled = document.getElementById('mentor-enabled').checked;
        this.currentSimulation.reflection.prompt = document.getElementById('reflection-prompt').value;
        this.currentSimulation.reflection.enabled = document.getElementById('reflection-enabled').checked;
        this.currentSimulation.evaluation.prompt = document.getElementById('evaluation-prompt').value;

        // Parse evaluation criteria
        try {
            const criteria = document.getElementById('evaluation-criteria').value;
            if (criteria.trim()) {
                this.currentSimulation.evaluation.criteria = JSON.parse(criteria);
            }
        } catch (e) {
            alert('שגיאה בפורמט JSON של קריטריוני ההערכה');
            return;
        }

        // Validate
        if (!this.currentSimulation.name.trim()) {
            alert('יש להזין שם לסימולציה');
            return;
        }

        this.currentSimulation.updatedAt = new Date().toISOString();
        this.saveData();
        this.closeEditor();
        this.renderSimulations();
        this.updateStats();
    }

    deleteCurrentSimulation() {
        if (!this.currentSimulationId) return;

        if (!confirm('האם אתה בטוח שברצונך למחוק סימולציה זו?')) return;

        this.simulations = this.simulations.filter(s => s.id !== this.currentSimulationId);
        this.saveData();
        this.closeEditor();
        this.renderSimulations();
        this.updateStats();
    }

    duplicateSimulation(id) {
        const sim = this.simulations.find(s => s.id === id);
        if (!sim) return;

        const duplicate = JSON.parse(JSON.stringify(sim));
        duplicate.id = this.generateId();
        duplicate.name = sim.name + ' (עותק)';
        duplicate.createdAt = new Date().toISOString();
        duplicate.updatedAt = new Date().toISOString();

        this.simulations.push(duplicate);
        this.saveData();
        this.renderSimulations();
    }

    closeEditor() {
        document.getElementById('modal-editor').classList.remove('active');
        this.currentSimulation = null;
        this.currentSimulationId = null;
    }

    renderSimulations() {
        const container = document.getElementById('simulations-list');
        if (!container) return;

        if (this.simulations.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px; color: var(--text-secondary);">
                    <div style="font-size: 64px; margin-bottom: 16px;">🎭</div>
                    <h3 style="margin-bottom: 8px;">אין עדיין סימולציות</h3>
                    <p>לחץ על "יצירת סימולציה חדשה" כדי להתחיל</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.simulations.map(sim => {
            const date = new Date(sim.updatedAt).toLocaleDateString('he-IL');
            return `
                <div class="simulation-card">
                    <div class="simulation-card-title">${this.escapeHtml(sim.name)}</div>
                    <div class="simulation-card-meta">
                        📅 עודכן: ${date}
                    </div>
                    <div class="simulation-card-meta">
                        ${sim.description ? this.escapeHtml(sim.description.substring(0, 100)) + '...' : 'אין תיאור'}
                    </div>
                    <div class="simulation-card-actions">
                        <button class="btn btn-primary" onclick="app.editSimulation('${sim.id}')" style="flex: 1;">
                            ✏️ ערוך
                        </button>
                        <button class="btn btn-secondary" onclick="app.duplicateSimulation('${sim.id}')">
                            📋
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ==================== RESEARCH SPACES ====================

    createNewSpace() {
        const spaceName = prompt('הזן שם למרחב המחקר:');
        if (!spaceName) return;

        const simId = this.selectSimulationForSpace();
        if (!simId) return;

        const space = {
            id: this.generateId(),
            name: spaceName,
            simulationId: simId,
            createdAt: new Date().toISOString(),
            sessions: []
        };

        this.spaces.push(space);
        this.saveData();
        this.renderSpaces();
    }

    selectSimulationForSpace() {
        if (this.simulations.length === 0) {
            alert('יש ליצור סימולציה לפני יצירת מרחב מחקר');
            return null;
        }

        const options = this.simulations.map((sim, idx) =>
            `${idx + 1}. ${sim.name}`
        ).join('\n');

        const choice = prompt(`בחר סימולציה:\n${options}\n\nהזן מספר:`);
        if (!choice) return null;

        const idx = parseInt(choice) - 1;
        if (idx >= 0 && idx < this.simulations.length) {
            return this.simulations[idx].id;
        }

        return null;
    }

    generateShareLink(spaceId) {
        const space = this.spaces.find(s => s.id === spaceId);
        if (!space) return '';

        const simulation = this.simulations.find(s => s.id === space.simulationId);
        if (!simulation) return '';

        // Create payload
        const payload = {
            spaceId: space.id,
            spaceName: space.name,
            simulation: simulation
        };

        // Convert to base64
        const jsonStr = JSON.stringify(payload);
        const encoded = btoa(encodeURIComponent(jsonStr));

        // Generate URL
        const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
        return `${baseUrl}runner.html?data=${encoded}`;
    }

    copyShareLink(spaceId) {
        const link = this.generateShareLink(spaceId);
        navigator.clipboard.writeText(link).then(() => {
            alert('הלינק הועתק ללוח!');
        });
    }

    testLink(spaceId) {
        const link = this.generateShareLink(spaceId);
        window.open(link, '_blank');
    }

    deleteSpace(spaceId) {
        if (!confirm('האם אתה בטוח שברצונך למחוק מרחב זה?')) return;

        this.spaces = this.spaces.filter(s => s.id !== spaceId);
        this.saveData();
        this.renderSpaces();
    }

    renderSpaces() {
        const container = document.getElementById('spaces-list');
        if (!container) return;

        if (this.spaces.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px; color: var(--text-secondary);">
                    <div style="font-size: 64px; margin-bottom: 16px;">🔬</div>
                    <h3 style="margin-bottom: 8px;">אין עדיין מרחבי מחקר</h3>
                    <p>מרחב מחקר מאפשר לך לשתף סימולציה עם קבוצת נבדקים ולאסוף נתונים</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.spaces.map(space => {
            const sim = this.simulations.find(s => s.id === space.simulationId);
            const simName = sim ? sim.name : 'סימולציה לא נמצאה';
            const link = this.generateShareLink(space.id);

            return `
                <div class="space-card">
                    <div class="space-header">
                        <div>
                            <div class="space-name">${this.escapeHtml(space.name)}</div>
                            <div style="color: var(--text-secondary); font-size: 14px; margin-top: 4px;">
                                סימולציה: ${this.escapeHtml(simName)}
                            </div>
                        </div>
                        <button class="btn btn-danger" onclick="app.deleteSpace('${space.id}')">
                            🗑️
                        </button>
                    </div>

                    <div class="space-link">
                        <div class="space-link-url">${link}</div>
                        <button class="btn btn-secondary" onclick="app.copyShareLink('${space.id}')">
                            📋 העתק
                        </button>
                        <button class="btn btn-primary" onclick="app.testLink('${space.id}')">
                            🔗 בדוק
                        </button>
                    </div>

                    <div style="color: var(--text-secondary); font-size: 14px;">
                        📊 סשנים שהתבצעו: ${space.sessions ? space.sessions.length : 0}
                    </div>
                </div>
            `;
        }).join('');
    }

    // ==================== SURVEY BUILDER ====================

    addSurveyQuestion(type) {
        if (!this.currentSimulation) return;

        const question = {
            id: this.generateId(),
            text: '',
            type: 'likert-5',
            required: true,
            options: {
                min: 1,
                max: 5,
                minLabel: 'בכלל לא',
                maxLabel: 'במידה רבה מאוד'
            }
        };

        if (type === 'pre') {
            this.currentSimulation.surveys.pre.push(question);
            this.renderSurveyBuilder('pre', this.currentSimulation.surveys.pre);
        } else {
            this.currentSimulation.surveys.post.push(question);
            this.renderSurveyBuilder('post', this.currentSimulation.surveys.post);
        }

        this.saveData();
    }

    removeSurveyQuestion(type, questionId) {
        if (!this.currentSimulation) return;

        if (type === 'pre') {
            this.currentSimulation.surveys.pre = this.currentSimulation.surveys.pre.filter(q => q.id !== questionId);
            this.renderSurveyBuilder('pre', this.currentSimulation.surveys.pre);
        } else {
            this.currentSimulation.surveys.post = this.currentSimulation.surveys.post.filter(q => q.id !== questionId);
            this.renderSurveyBuilder('post', this.currentSimulation.surveys.post);
        }

        this.saveData();
    }

    renderSurveyBuilder(type, questions) {
        const container = document.getElementById(`${type}-survey-builder`);
        if (!container) return;

        if (questions.length === 0) {
            container.innerHTML = `<div style="color: var(--text-secondary); padding: 20px; text-align: center;">אין שאלות</div>`;
            return;
        }

        container.innerHTML = questions.map((q, idx) => `
            <div class="glass" style="padding: 16px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <strong>שאלה ${idx + 1}</strong>
                    <button class="btn btn-danger" onclick="app.removeSurveyQuestion('${type}', '${q.id}')" style="padding: 4px 12px; font-size: 14px;">
                        ×
                    </button>
                </div>
                <div class="form-group">
                    <input type="text" class="form-input" value="${this.escapeHtml(q.text)}"
                           onchange="app.updateSurveyQuestion('${type}', '${q.id}', 'text', this.value)"
                           placeholder="טקסט השאלה">
                </div>
                <div class="form-group" style="margin-bottom: 12px;">
                    <select class="form-select" onchange="app.updateSurveyQuestion('${type}', '${q.id}', 'type', this.value)">
                        <option value="likert-5" ${q.type === 'likert-5' ? 'selected' : ''}>ליקרט 1-5</option>
                        <option value="likert-10" ${q.type === 'likert-10' ? 'selected' : ''}>ליקרט 1-10</option>
                        <option value="text" ${q.type === 'text' ? 'selected' : ''}>טקסט חופשי</option>
                        <option value="multiple" ${q.type === 'multiple' ? 'selected' : ''}>בחירה מרובה</option>
                    </select>
                </div>
                <label style="display: flex; align-items: center; gap: 8px; font-size: 14px;">
                    <input type="checkbox" ${q.required ? 'checked' : ''}
                           onchange="app.updateSurveyQuestion('${type}', '${q.id}', 'required', this.checked)">
                    שאלת חובה
                </label>
            </div>
        `).join('');
    }

    updateSurveyQuestion(type, questionId, field, value) {
        if (!this.currentSimulation) return;

        const questions = type === 'pre' ? this.currentSimulation.surveys.pre : this.currentSimulation.surveys.post;
        const question = questions.find(q => q.id === questionId);

        if (question) {
            question[field] = value;
            this.saveData();
        }
    }

    // ==================== FILE UPLOAD ====================

    setupFileUpload() {
        const dropZone = document.getElementById('roleplay-files-drop');
        const fileInput = document.getElementById('roleplay-files-input');

        if (!dropZone || !fileInput) return;

        dropZone.addEventListener('click', () => fileInput.click());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            this.handleFiles(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });
    }

    async handleFiles(files) {
        if (!this.currentSimulation) return;

        for (let file of files) {
            if (file.type === 'application/pdf' || file.type === 'text/plain') {
                const base64 = await this.fileToBase64(file);
                this.currentSimulation.roleplay.files.push({
                    name: file.name,
                    type: file.type,
                    data: base64
                });
            }
        }

        this.renderFilesList(this.currentSimulation.roleplay.files);
        this.saveData();
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    renderFilesList(files) {
        const container = document.getElementById('roleplay-files-list');
        if (!container) return;

        if (files.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = files.map((file, idx) => `
            <div class="glass" style="padding: 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                <span>📄 ${this.escapeHtml(file.name)}</span>
                <button class="btn btn-danger" onclick="app.removeFile(${idx})" style="padding: 4px 12px; font-size: 14px;">
                    ×
                </button>
            </div>
        `).join('');
    }

    removeFile(index) {
        if (!this.currentSimulation) return;
        this.currentSimulation.roleplay.files.splice(index, 1);
        this.renderFilesList(this.currentSimulation.roleplay.files);
        this.saveData();
    }

    // ==================== STATS & EXPORT ====================

    updateStats() {
        document.getElementById('stats-simulations').textContent = this.simulations.length;
        document.getElementById('stats-spaces').textContent = this.spaces.length;

        let totalSessions = 0;
        this.spaces.forEach(space => {
            totalSessions += space.sessions ? space.sessions.length : 0;
        });
        document.getElementById('stats-sessions').textContent = totalSessions;
    }

    exportAllData() {
        const data = {
            simulations: this.simulations,
            spaces: this.spaces,
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simuverse-export-${Date.now()}.json`;
        a.click();
    }

    // ==================== UTILITIES ====================

    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showHelp() {
        alert('SimuVerse AI - עזרה\n\nלמידע נוסף, עיין במסמך האפיון או צור קשר עם התמיכה.');
    }
}

// Initialize app
const app = new SimuVerseApp();
