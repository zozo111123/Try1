// SimuVerse AI - Runner Application
// Handles simulation execution for end users

class SimulationRunner {
    constructor() {
        this.config = null;
        this.session = null;
        this.currentScreen = 'entry';
        this.chatHistory = [];
        this.reflectionHistory = [];
        this.surveyAnswers = { pre: {}, post: {} };
        this.currentQuestionIndex = 0;
        this.isListening = false;
        this.isSpeaking = false;
        this.recognition = null;
        this.apiKey = null; // Will be set from config or prompt

        this.init();
    }

    init() {
        this.loadConfiguration();
        this.setupSpeechRecognition();
        this.setupKeyboardListeners();
    }

    // ==================== CONFIGURATION ====================

    loadConfiguration() {
        try {
            // Get data from URL parameter
            const urlParams = new URLSearchParams(window.location.search);
            const data = urlParams.get('data');

            if (!data) {
                this.showError('לא נמצא קוד סימולציה תקף. אנא בדוק את הקישור.');
                return;
            }

            // Decode payload
            const decoded = decodeURIComponent(atob(data));
            const payload = JSON.parse(decoded);

            this.config = payload;

            // Update UI with simulation info
            if (payload.simulation && payload.simulation.name) {
                document.getElementById('entry-description').textContent =
                    payload.simulation.description || 'ברוכים הבאים לסימולציה אינטראקטיבית';
                document.getElementById('chat-title').textContent = payload.simulation.name;
            }

            // Prompt for API key if not in config
            this.promptForApiKey();

        } catch (error) {
            console.error('Configuration error:', error);
            this.showError('שגיאה בטעינת הסימולציה. אנא בדוק את הקישור ונסה שוב.');
        }
    }

    promptForApiKey() {
        // In production, you'd want to handle this more securely
        // For now, we'll prompt the user or use environment variable
        const stored = localStorage.getItem('gemini_api_key');

        if (!stored) {
            const key = prompt('הזן Gemini API Key (המפתח לא יישמר):');
            if (key) {
                this.apiKey = key;
                // Optionally store in session
                sessionStorage.setItem('gemini_api_key', key);
            } else {
                alert('נדרש API Key להפעלת הסימולציה');
            }
        } else {
            this.apiKey = stored;
        }
    }

    // ==================== SCREEN MANAGEMENT ====================

    showScreen(screenName) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show requested screen
        const screen = document.getElementById(`screen-${screenName}`);
        if (screen) {
            screen.classList.add('active');
            this.currentScreen = screenName;
        }
    }

    showError(message) {
        document.getElementById('error-message').textContent = message;
        this.showScreen('error');
    }

    showLoading(message = 'מעבד נתונים...') {
        document.getElementById('loading-text').textContent = message;
        this.showScreen('loading');
    }

    // ==================== SESSION START ====================

    startSession(event) {
        event.preventDefault();

        // Collect user info
        const userName = document.getElementById('user-name').value;
        const userAge = document.getElementById('user-age').value;
        const userGender = document.getElementById('user-gender').value;

        if (!userName) {
            alert('יש להזין שם');
            return;
        }

        // Initialize session
        this.session = {
            id: this.generateId(),
            spaceId: this.config.spaceId,
            spaceName: this.config.spaceName,
            simulationId: this.config.simulation.id,
            simulationName: this.config.simulation.name,
            user: {
                name: userName,
                age: userAge,
                gender: userGender
            },
            startTime: new Date().toISOString(),
            chatHistory: [],
            reflectionHistory: [],
            surveyAnswers: { pre: {}, post: {} },
            evaluation: null
        };

        // Check if there are pre-survey questions
        const preSurvey = this.config.simulation.surveys?.pre || [];
        if (preSurvey.length > 0) {
            this.startPreSurvey();
        } else {
            this.startChat();
        }
    }

    // ==================== PRE-SURVEY ====================

    startPreSurvey() {
        const questions = this.config.simulation.surveys.pre;
        this.currentQuestionIndex = 0;
        this.renderSurveyQuestion(questions[0], 0, questions.length);
        this.updateSurveyProgress(0, questions.length);
        this.showScreen('pre-survey');
    }

    renderSurveyQuestion(question, index, total) {
        const container = document.getElementById('survey-questions');

        let inputHtml = '';

        if (question.type === 'likert-5' || question.type === 'likert-10') {
            const max = question.type === 'likert-5' ? 5 : 10;
            const buttons = [];
            for (let i = 1; i <= max; i++) {
                const selected = this.surveyAnswers.pre[question.id] === i ? 'selected' : '';
                buttons.push(`
                    <button type="button" class="likert-btn ${selected}" onclick="runner.selectLikert('pre', '${question.id}', ${i})">
                        ${i}
                    </button>
                `);
            }

            inputHtml = `
                <div class="likert-scale">${buttons.join('')}</div>
                <div class="likert-labels">
                    <span>${question.options?.minLabel || 'בכלל לא'}</span>
                    <span>${question.options?.maxLabel || 'במידה רבה מאוד'}</span>
                </div>
            `;
        } else if (question.type === 'text') {
            const value = this.surveyAnswers.pre[question.id] || '';
            inputHtml = `
                <textarea class="form-input" id="survey-text-${question.id}" rows="4"
                          onchange="runner.surveyAnswers.pre['${question.id}'] = this.value">${value}</textarea>
            `;
        }

        container.innerHTML = `
            <div class="survey-question">
                <div class="survey-question-text">
                    ${this.escapeHtml(question.text)}
                    ${question.required ? '<span style="color: var(--danger-color);">*</span>' : ''}
                </div>
                ${inputHtml}
            </div>
        `;

        // Update button states
        document.getElementById('btn-prev-question').disabled = index === 0;
        const isLastQuestion = index === total - 1;
        const nextBtn = document.getElementById('btn-next-question');
        nextBtn.textContent = isLastQuestion ? 'התחל סימולציה →' : 'הבא →';
    }

    selectLikert(surveyType, questionId, value) {
        this.surveyAnswers[surveyType][questionId] = value;

        // Update UI
        const buttons = document.querySelectorAll('.likert-btn');
        buttons.forEach((btn, idx) => {
            if (idx + 1 === value) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    }

    nextQuestion() {
        const questions = this.config.simulation.surveys.pre;
        const currentQuestion = questions[this.currentQuestionIndex];

        // Validate required
        if (currentQuestion.required && !this.surveyAnswers.pre[currentQuestion.id]) {
            alert('יש לענות על שאלה זו');
            return;
        }

        // Move to next or finish
        if (this.currentQuestionIndex < questions.length - 1) {
            this.currentQuestionIndex++;
            this.renderSurveyQuestion(questions[this.currentQuestionIndex], this.currentQuestionIndex, questions.length);
            this.updateSurveyProgress(this.currentQuestionIndex, questions.length);
        } else {
            this.session.surveyAnswers.pre = this.surveyAnswers.pre;
            this.startChat();
        }
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            const questions = this.config.simulation.surveys.pre;
            this.renderSurveyQuestion(questions[this.currentQuestionIndex], this.currentQuestionIndex, questions.length);
            this.updateSurveyProgress(this.currentQuestionIndex, questions.length);
        }
    }

    updateSurveyProgress(current, total) {
        const percent = ((current + 1) / total) * 100;
        document.getElementById('survey-progress').style.width = percent + '%';
    }

    // ==================== CHAT INTERFACE ====================

    async startChat() {
        this.showScreen('chat');

        // Send initial greeting from character
        await this.sendAgentMessage('roleplay', null, true);
    }

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message) return;

        // Add user message to UI
        this.addChatMessage('user', message);

        // Add to history
        this.chatHistory.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });

        // Clear input
        input.value = '';

        // Get response from roleplay agent
        await this.sendAgentMessage('roleplay', message);

        // Check if mentor should give a tip
        if (this.config.simulation.mentor?.enabled) {
            await this.checkMentorTip();
        }
    }

    async sendAgentMessage(agentType, userMessage, isInitial = false) {
        this.updateStatus('מקליד...');

        try {
            let systemPrompt = '';
            let context = '';

            if (agentType === 'roleplay') {
                systemPrompt = this.config.simulation.roleplay.prompt;
                context = this.buildChatContext();
            }

            const response = await this.callGeminiAPI(systemPrompt, context, userMessage, isInitial);

            if (response) {
                // Add to UI
                this.addChatMessage('agent', response);

                // Add to history
                this.chatHistory.push({
                    role: 'assistant',
                    content: response,
                    timestamp: new Date().toISOString()
                });

                // Speak the response if TTS is enabled
                await this.speak(response);
            }

        } catch (error) {
            console.error('Agent error:', error);
            this.updateStatus('שגיאה בתקשורת');
        }

        this.updateStatus('מוכן');
    }

    async callGeminiAPI(systemPrompt, context, userMessage, isInitial = false) {
        if (!this.apiKey) {
            alert('API Key לא נמצא');
            return null;
        }

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`;

            let prompt = systemPrompt + '\n\n';
            if (context) {
                prompt += 'הקשר השיחה:\n' + context + '\n\n';
            }
            if (userMessage) {
                prompt += 'משתמש: ' + userMessage + '\n';
            }
            if (isInitial) {
                prompt += 'התחל את השיחה עם ברכה קצרה והצגה.';
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.9,
                        maxOutputTokens: 500
                    }
                })
            });

            if (!response.ok) {
                throw new Error('API request failed');
            }

            const data = await response.json();
            return data.candidates[0].content.parts[0].text;

        } catch (error) {
            console.error('Gemini API error:', error);
            throw error;
        }
    }

    buildChatContext() {
        return this.chatHistory.map(msg => {
            const role = msg.role === 'user' ? 'משתמש' : 'אתה';
            return `${role}: ${msg.content}`;
        }).join('\n');
    }

    async checkMentorTip() {
        // Check if we should show a mentor tip (every 3-4 exchanges)
        if (this.chatHistory.length % 6 !== 0) return;

        try {
            const mentorPrompt = this.config.simulation.mentor.prompt;
            const context = this.buildChatContext();

            const tip = await this.callGeminiAPI(
                mentorPrompt,
                context,
                'האם יש טיפ שאתה רוצה לתת למשתמש כעת? אם כן, תן טיפ קצר (משפט אחד). אם לא, השב "לא".'
            );

            if (tip && tip.toLowerCase() !== 'לא' && tip.length > 10) {
                this.showMentorTip(tip);
            }
        } catch (error) {
            console.error('Mentor error:', error);
        }
    }

    showMentorTip(tip) {
        const container = document.getElementById('chat-messages');
        const tipEl = document.createElement('div');
        tipEl.className = 'mentor-tip';
        tipEl.innerHTML = `
            <div class="mentor-tip-header">
                💡 טיפ מהמנטור
            </div>
            <div class="mentor-tip-text">${this.escapeHtml(tip)}</div>
        `;
        container.appendChild(tipEl);
        container.scrollTop = container.scrollHeight;
    }

    addChatMessage(role, content) {
        const container = document.getElementById('chat-messages');
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${role}`;

        const avatar = role === 'user' ? '👤' : '🎭';

        messageEl.innerHTML = `
            <div class="chat-avatar">${avatar}</div>
            <div class="chat-bubble">${this.escapeHtml(content)}</div>
        `;

        container.appendChild(messageEl);
        container.scrollTop = container.scrollHeight;
    }

    updateStatus(status) {
        document.getElementById('chat-status').textContent = status;
    }

    undoLastExchange() {
        if (this.chatHistory.length < 2) {
            alert('אין מה לבטל');
            return;
        }

        if (!confirm('האם לבטל את חילופי הדברים האחרונים?')) return;

        // Remove last two messages (user + agent)
        this.chatHistory.splice(-2);

        // Re-render chat
        const container = document.getElementById('chat-messages');
        container.innerHTML = '';

        this.chatHistory.forEach(msg => {
            this.addChatMessage(msg.role === 'user' ? 'user' : 'agent', msg.content);
        });
    }

    finishSimulation() {
        if (!confirm('האם אתה בטוח שברצונך לסיים את הסימולציה?')) return;

        this.session.chatHistory = this.chatHistory;
        this.session.endTime = new Date().toISOString();

        // Check if reflection is enabled
        if (this.config.simulation.reflection?.enabled) {
            this.startReflection();
        } else {
            this.startPostSurvey();
        }
    }

    // ==================== REFLECTION ====================

    async startReflection() {
        this.showScreen('reflection');

        // Generate reflection questions
        await this.generateReflectionQuestions();
    }

    async generateReflectionQuestions() {
        this.showLoading('מכין שאלות רפלקציה...');

        try {
            const prompt = this.config.simulation.reflection.prompt;
            const transcript = this.buildChatContext();

            const questions = await this.callGeminiAPI(
                prompt,
                'תמליל השיחה:\n' + transcript,
                'צור 3-4 שאלות רפלקציה מעמיקות.'
            );

            if (questions) {
                this.addReflectionMessage('agent', questions);
                this.showScreen('reflection');
            }

        } catch (error) {
            console.error('Reflection error:', error);
            this.startPostSurvey();
        }
    }

    addReflectionMessage(role, content) {
        const container = document.getElementById('reflection-messages');
        const messageEl = document.createElement('div');
        messageEl.style.marginBottom = '16px';
        messageEl.style.padding = '12px';
        messageEl.style.background = role === 'user' ? 'var(--accent-bg)' : 'transparent';
        messageEl.style.borderRadius = '8px';
        messageEl.innerHTML = `
            <strong style="color: ${role === 'user' ? 'var(--accent-color)' : 'var(--text-secondary)'};">
                ${role === 'user' ? 'אני' : 'מאמן'}:
            </strong><br>
            ${this.escapeHtml(content)}
        `;
        container.appendChild(messageEl);
    }

    sendReflectionResponse() {
        const input = document.getElementById('reflection-input');
        const response = input.value.trim();

        if (!response) {
            alert('יש להקליד תשובה');
            return;
        }

        this.reflectionHistory.push({
            role: 'user',
            content: response,
            timestamp: new Date().toISOString()
        });

        this.addReflectionMessage('user', response);
        input.value = '';

        // Check if we should ask another question or finish
        if (this.reflectionHistory.length < 3) {
            // Could generate follow-up question here
        } else {
            setTimeout(() => this.startPostSurvey(), 1000);
        }
    }

    skipReflection() {
        this.startPostSurvey();
    }

    // ==================== POST-SURVEY ====================

    startPostSurvey() {
        const postSurvey = this.config.simulation.surveys?.post || [];
        if (postSurvey.length > 0) {
            this.currentQuestionIndex = 0;
            this.renderPostSurveyQuestion(postSurvey[0], 0, postSurvey.length);
            this.updatePostSurveyProgress(0, postSurvey.length);
            this.showScreen('post-survey');
        } else {
            this.startEvaluation();
        }
    }

    renderPostSurveyQuestion(question, index, total) {
        // Similar to pre-survey
        const container = document.getElementById('post-survey-questions');

        let inputHtml = '';

        if (question.type === 'likert-5' || question.type === 'likert-10') {
            const max = question.type === 'likert-5' ? 5 : 10;
            const buttons = [];
            for (let i = 1; i <= max; i++) {
                const selected = this.surveyAnswers.post[question.id] === i ? 'selected' : '';
                buttons.push(`
                    <button type="button" class="likert-btn ${selected}" onclick="runner.selectLikert('post', '${question.id}', ${i})">
                        ${i}
                    </button>
                `);
            }

            inputHtml = `
                <div class="likert-scale">${buttons.join('')}</div>
                <div class="likert-labels">
                    <span>${question.options?.minLabel || 'בכלל לא'}</span>
                    <span>${question.options?.maxLabel || 'במידה רבה מאוד'}</span>
                </div>
            `;
        } else if (question.type === 'text') {
            const value = this.surveyAnswers.post[question.id] || '';
            inputHtml = `
                <textarea class="form-input" id="post-survey-text-${question.id}" rows="4"
                          onchange="runner.surveyAnswers.post['${question.id}'] = this.value">${value}</textarea>
            `;
        }

        container.innerHTML = `
            <div class="survey-question">
                <div class="survey-question-text">
                    ${this.escapeHtml(question.text)}
                    ${question.required ? '<span style="color: var(--danger-color);">*</span>' : ''}
                </div>
                ${inputHtml}
            </div>
        `;

        document.getElementById('btn-prev-post').disabled = index === 0;
        const isLastQuestion = index === total - 1;
        const nextBtn = document.getElementById('btn-next-post');
        nextBtn.textContent = isLastQuestion ? 'סיום →' : 'הבא →';
    }

    nextPostQuestion() {
        const questions = this.config.simulation.surveys.post;
        const currentQuestion = questions[this.currentQuestionIndex];

        if (currentQuestion.required && !this.surveyAnswers.post[currentQuestion.id]) {
            alert('יש לענות על שאלה זו');
            return;
        }

        if (this.currentQuestionIndex < questions.length - 1) {
            this.currentQuestionIndex++;
            this.renderPostSurveyQuestion(questions[this.currentQuestionIndex], this.currentQuestionIndex, questions.length);
            this.updatePostSurveyProgress(this.currentQuestionIndex, questions.length);
        } else {
            this.session.surveyAnswers.post = this.surveyAnswers.post;
            this.startEvaluation();
        }
    }

    previousPostQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            const questions = this.config.simulation.surveys.post;
            this.renderPostSurveyQuestion(questions[this.currentQuestionIndex], this.currentQuestionIndex, questions.length);
            this.updatePostSurveyProgress(this.currentQuestionIndex, questions.length);
        }
    }

    updatePostSurveyProgress(current, total) {
        const percent = ((current + 1) / total) * 100;
        document.getElementById('post-survey-progress').style.width = percent + '%';
    }

    // ==================== EVALUATION ====================

    async startEvaluation() {
        this.showLoading('מעריך את הביצועים...');

        try {
            const evaluationPrompt = this.config.simulation.evaluation.prompt;
            const criteria = this.config.simulation.evaluation.criteria;

            const fullContext = `
תמליל השיחה:
${this.buildChatContext()}

רפלקציה:
${this.reflectionHistory.map(r => r.content).join('\n')}

קריטריוני הערכה:
${JSON.stringify(criteria, null, 2)}

נתח את הביצועים והחזר JSON בפורמט הבא:
{
  "scores": [
    {"criterion": "שם הקריטריון", "score": 0-10, "feedback": "הסבר"}
  ],
  "strengths": "נקודות חוזק",
  "improvements": "נקודות לשיפור",
  "overallScore": 0-100
}
            `;

            const evaluation = await this.callGeminiAPI(
                evaluationPrompt,
                fullContext,
                'נתח והחזר JSON בלבד.'
            );

            if (evaluation) {
                // Try to parse JSON from response
                const jsonMatch = evaluation.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    this.session.evaluation = JSON.parse(jsonMatch[0]);
                    this.displayFeedback();
                } else {
                    throw new Error('Invalid JSON response');
                }
            }

        } catch (error) {
            console.error('Evaluation error:', error);
            // Show generic feedback
            this.session.evaluation = {
                scores: [],
                strengths: 'תודה על ההשתתפות!',
                improvements: 'המשך להתאמן ולשפר.',
                overallScore: 75
            };
            this.displayFeedback();
        }
    }

    displayFeedback() {
        this.showScreen('feedback');

        const evaluation = this.session.evaluation;

        // Display text feedback
        document.getElementById('feedback-strengths').textContent = evaluation.strengths || 'אין משוב זמין';
        document.getElementById('feedback-improvements').textContent = evaluation.improvements || 'אין משוב זמין';

        // Draw radar chart
        this.drawRadarChart(evaluation.scores || []);

        // Save session
        this.saveSession();
    }

    drawRadarChart(scores) {
        const canvas = document.getElementById('radar-chart');
        const ctx = canvas.getContext('2d');

        // Simple radar chart implementation
        // In production, use Chart.js or similar library

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (scores.length === 0) {
            ctx.fillStyle = 'var(--text-secondary)';
            ctx.textAlign = 'center';
            ctx.font = '16px Arial';
            ctx.fillText('אין נתונים להצגה', canvas.width / 2, canvas.height / 2);
            return;
        }

        // Draw simple bar chart instead of radar for simplicity
        const barWidth = canvas.width / (scores.length + 1);
        const maxHeight = canvas.height - 60;

        scores.forEach((item, idx) => {
            const x = (idx + 1) * barWidth;
            const height = (item.score / 10) * maxHeight;
            const y = canvas.height - height - 30;

            // Draw bar
            ctx.fillStyle = '#4ecca3';
            ctx.fillRect(x - 20, y, 40, height);

            // Draw score
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.font = 'bold 14px Arial';
            ctx.fillText(item.score, x, y - 10);

            // Draw label
            ctx.save();
            ctx.translate(x, canvas.height - 10);
            ctx.rotate(-Math.PI / 4);
            ctx.font = '12px Arial';
            ctx.fillText(item.criterion, 0, 0);
            ctx.restore();
        });
    }

    // ==================== SPEECH & AUDIO ====================

    setupSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'he-IL';
            this.recognition.continuous = false;
            this.recognition.interimResults = false;

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                document.getElementById('chat-input').value = transcript;
                this.sendMessage();
            };

            this.recognition.onend = () => {
                this.isListening = false;
                document.getElementById('mic-btn').classList.remove('listening');
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.isListening = false;
                document.getElementById('mic-btn').classList.remove('listening');
            };
        }
    }

    toggleVoice() {
        if (!this.recognition) {
            alert('הדפדפן לא תומך בזיהוי קול');
            return;
        }

        if (this.isListening) {
            this.recognition.stop();
            this.isListening = false;
            document.getElementById('mic-btn').classList.remove('listening');
        } else {
            this.recognition.start();
            this.isListening = true;
            document.getElementById('mic-btn').classList.add('listening');
        }
    }

    async speak(text) {
        // Simple TTS implementation
        // In production, use Google TTS API or ElevenLabs
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'he-IL';
            utterance.rate = 0.9;

            // Show visualizer
            document.getElementById('audio-visualizer').classList.remove('hidden');

            utterance.onend = () => {
                document.getElementById('audio-visualizer').classList.add('hidden');
                this.isSpeaking = false;
            };

            this.isSpeaking = true;
            window.speechSynthesis.speak(utterance);
        }
    }

    // ==================== DATA MANAGEMENT ====================

    saveSession() {
        // Save to localStorage
        const sessions = JSON.parse(localStorage.getItem('simuverse_sessions') || '[]');
        sessions.push(this.session);
        localStorage.setItem('simuverse_sessions', JSON.stringify(sessions));
    }

    downloadReport() {
        const report = {
            ...this.session,
            generatedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simuverse-session-${this.session.id}.json`;
        a.click();
    }

    // ==================== UTILITIES ====================

    setupKeyboardListeners() {
        const input = document.getElementById('chat-input');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
    }

    generateId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize runner
const runner = new SimulationRunner();
