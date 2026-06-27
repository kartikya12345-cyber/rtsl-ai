document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('webcam-video');
    const canvas = document.getElementById('webcam-canvas');
    const overlayCanvas = document.getElementById('overlay-canvas');
    const predAlphabet = document.getElementById('pred-alphabet');
    const predConf = document.getElementById('pred-conf');
    const confBar = document.getElementById('conf-bar');
    const historyList = document.getElementById('history-list');
    const modelSelect = document.getElementById('model-select');
    const logoutBtn = document.getElementById('logout-btn');
    const toast = document.getElementById('toast');
    const themeToggle = document.getElementById('theme-toggle');
    const roiBox = document.querySelector('.roi-box');
    const kerasInfo = document.getElementById('keras-info');

    const fpsEl = document.getElementById('fps-counter');
    const notifBar = document.getElementById('notification-bar');
    const notifText = document.getElementById('notif-text');
    const notifClose = document.getElementById('notif-close');
    const detStatusBadge = document.getElementById('det-status-badge');
    const detStatusLabel = document.getElementById('det-status-label');
    const detStatusDot = document.getElementById('det-status-dot');
    const recordBtn = document.getElementById('record-btn');
    const screenshotBtn = document.getElementById('screenshot-btn');
    const aiStatusText = document.getElementById('ai-status-text');

    let isDetecting = true;
    let detectionStarted = false;
    let stream = null;
    let lastHistoryPrediction = null;
    let detectionInterval = 60;
    let currentModelType = 'yolo';

    let frameCount = 0;
    let fpsLastCheck = performance.now();
    let currentFps = 0;

    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;

    const HAND_CONNECTIONS = [
        [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
        [0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],
        [0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17]
    ];

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        themeToggle.innerHTML = isLight ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        localStorage.setItem('asl_theme', isLight ? 'light' : 'dark');
    });

    if (localStorage.getItem('asl_theme') === 'light') {
        document.body.classList.add('light-mode');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }

    function showToast(message, type) {
        if (!toast) return;
        type = type || 'success';
        toast.textContent = message;
        toast.style.borderLeft = `4px solid ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#00f2ff'}`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    let notifTimer = null;

    function showNotification(message, type) {
        notifBar.className = 'notification-bar';
        notifBar.style.display = 'flex';
        if (type === 'error') {
            notifBar.style.background = '#ef4444';
            notifBar.style.border = '1px solid rgba(255,255,255,0.2)';
            notifText.innerHTML = '<i class="fas fa-exclamation-circle" style="margin-right:6px;"></i> ' + message;
        } else if (type === 'info') {
            notifBar.style.background = 'var(--accent-primary)';
            notifText.innerHTML = '<i class="fas fa-info-circle" style="margin-right:6px;"></i> ' + message;
        } else {
            notifBar.style.background = '#10b981';
            notifText.innerHTML = '<i class="fas fa-check-circle" style="margin-right:6px;"></i> ' + message;
        }
        if (notifTimer) clearTimeout(notifTimer);
        notifTimer = setTimeout(() => { notifBar.style.display = 'none'; }, 5000);
    }

    if (notifClose) {
        notifClose.addEventListener('click', () => {
            notifBar.style.display = 'none';
            if (notifTimer) { clearTimeout(notifTimer); notifTimer = null; }
        });
    }

    function setStatus(label, isOnline) {
        if (detStatusLabel) detStatusLabel.textContent = label;
        if (detStatusDot) {
            detStatusDot.className = 'status-indicator ' + (isOnline ? 'status-online' : 'status-offline');
        }
        if (detStatusBadge) {
            detStatusBadge.className = 'status-badge ' + (isOnline ? 'online' : 'offline');
        }
    }

    function updateFps() {
        frameCount++;
        const now = performance.now();
        const delta = now - fpsLastCheck;
        if (delta >= 1000) {
            currentFps = Math.round(frameCount / (delta / 1000));
            if (fpsEl) fpsEl.textContent = currentFps + ' FPS';
            frameCount = 0;
            fpsLastCheck = now;
        }
    }

    function updateCameraUI(modelType) {
        if (modelType === 'keras') {
            roiBox.style.display = 'none';
            overlayCanvas.style.display = 'block';
            kerasInfo.style.display = 'block';
            currentModelType = 'keras';
            detectionInterval = 60;
        } else {
            roiBox.style.display = 'block';
            overlayCanvas.style.display = 'none';
            kerasInfo.style.display = 'none';
            currentModelType = 'yolo';
            detectionInterval = 60;
        }
    }

    function drawHandLandmarks(hands, w, h) {
        const ctx = overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        for (const hand of hands) {
            const lm = hand.landmarks;
            const isRight = hand.type === 'Right';
            const color = isRight ? '#ff6b6b' : '#4fc3f7';
            const label = hand.type;
            for (const [i, j] of HAND_CONNECTIONS) {
                if (i < lm.length && j < lm.length) {
                    const x1 = (1 - lm[i][0]) * w;
                    const y1 = lm[i][1] * h;
                    const x2 = (1 - lm[j][0]) * w;
                    const y2 = lm[j][1] * h;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.7;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }
            for (let i = 0; i < lm.length; i++) {
                const x = (1 - lm[i][0]) * w;
                const y = lm[i][1] * h;
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            if (lm.length > 0) {
                const wristX = (1 - lm[0][0]) * w;
                const wristY = Math.max(0, lm[0][1] * h - 20);
                ctx.font = 'bold 14px sans-serif';
                ctx.fillStyle = color;
                ctx.shadowColor = '#000';
                ctx.shadowBlur = 4;
                ctx.fillText(label, wristX - 15, wristY);
                ctx.shadowBlur = 0;
            }
        }
    }

    async function initWebcam() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' }
            });
            video.srcObject = stream;
            setStatus('Running', true);
            if (aiStatusText) aiStatusText.textContent = 'processing';

            function tryStartDetection() {
                if (detectionStarted) return;
                detectionStarted = true;
                video.play().then(() => {
                    startDetectionLoop();
                }).catch(err => {
                    console.error("Video play error:", err);
                    detectionStarted = false;
                    setTimeout(tryStartDetection, 500);
                });
            }

            video.onloadedmetadata = tryStartDetection;
            setTimeout(() => {
                if (!detectionStarted) {
                    tryStartDetection();
                }
            }, 3000);
        } catch (err) {
            console.error("Webcam Error:", err);
            showToast("Camera access denied!", "error");
            setStatus('Camera Error', false);
            if (aiStatusText) aiStatusText.textContent = 'error - no camera';
        }
    }

    async function startDetectionLoop() {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = 640;
        canvas.height = 480;
        overlayCanvas.width = 640;
        overlayCanvas.height = 480;

        while (isDetecting) {
            try {
                if (video.readyState >= video.HAVE_CURRENT_DATA) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    const blob = await Promise.race([
                        new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.6)),
                        new Promise(resolve => setTimeout(() => resolve(null), 200))
                    ]);
                    if (blob) {
                        const formData = new FormData();
                        formData.append('file', blob, 'frame.jpg');
                        const userData = JSON.parse(localStorage.getItem('asl_user') || '{}');
                        if (userData.user_id) formData.append('user_id', userData.user_id);

                        const response = await fetch('/predict', {
                            method: 'POST',
                            body: formData
                        });

                        if (response.ok) {
                            const data = await response.json();
                            updateUI(data);
                            updateFps();
                            if (data.model_type === 'loading') {
                                showNotification('Models are still loading...', 'info');
                            }
                        } else {
                            const errText = await response.text().catch(() => response.statusText);
                            console.error("Server responded with error:", response.status, errText);
                            if (response.status >= 500) {
                                showNotification(`Server error (${response.status})`, 'error');
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Detection Loop Error:", err);
                showNotification(`Detection error: ${err.message || 'Unknown error'}`, 'error');
            }
            await new Promise(resolve => setTimeout(resolve, detectionInterval));
        }
    }

    function updateUI(data) {
        let prediction = "None";
        if (data.prediction && data.prediction !== "None") prediction = data.prediction;
        else if (data.alphabet && data.alphabet !== "None") prediction = data.alphabet;
        else if (data.label && data.label !== "None") prediction = data.label;

        let confidence = 0;
        if (typeof data.confidence === 'number') {
            confidence = data.confidence > 1 ? data.confidence / 100 : data.confidence;
        }

        if (prediction !== "None" && prediction !== "") {
            predAlphabet.textContent = prediction;
            const confPercent = Math.round(confidence * 100);
            predConf.textContent = `${confPercent}%`;
            confBar.style.width = `${confPercent}%`;
            if (typeof slPanel !== 'undefined' && slPanel) slPanel.highlight(prediction);

            if (prediction !== lastHistoryPrediction) {
                addToHistory(prediction, confidence);
                lastHistoryPrediction = prediction;
            }
        } else {
            predAlphabet.textContent = "-";
            predConf.textContent = "0%";
            confBar.style.width = "0%";
        }

        if (data.model_type === 'keras') {
            const hc = data.hand_count || 0;
            document.getElementById('ki-model-name').textContent = data.model_name || '-';
            document.getElementById('ki-hand-count').textContent = hc;

            let leftStatus = 'Not detected', rightStatus = 'Not detected';
            if (data.hands) {
                for (const h of data.hands) {
                    if (h.type === 'Left') leftStatus = 'Detected';
                    if (h.type === 'Right') rightStatus = 'Detected';
                }
            }
            document.getElementById('ki-hand-left').textContent = leftStatus;
            document.getElementById('ki-hand-right').textContent = rightStatus;

            const bp = data.buffer_progress || 0;
            const bt = data.buffer_total || 45;
            const pct = Math.min((bp / bt) * 100, 100);
            document.getElementById('buffer-bar').style.width = `${pct}%`;
            document.getElementById('buffer-text').textContent = `${bp}/${bt}`;

            if (data.hands && data.hands.length > 0) {
                drawHandLandmarks(data.hands, overlayCanvas.width, overlayCanvas.height);
            } else {
                const octx = overlayCanvas.getContext('2d');
                octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
            }
        }
    }

    function addToHistory(prediction, confidence) {
        const item = document.createElement('div');
        item.className = 'history-item';
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const confPercent = Math.round(confidence * 100);
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-weight: 800; color: var(--accent-primary); font-size: 1.2rem;">${prediction}</span>
                <span style="color: var(--text-dim); font-size: 0.8rem;">${time}</span>
            </div>
            <span style="font-size: 0.8rem; color: #10b981; font-weight: 600;">${confPercent}%</span>
        `;
        historyList.prepend(item);
        if (historyList.children.length > 15) {
            historyList.removeChild(historyList.lastChild);
        }
    }

    async function loadAvailableModels() {
        try {
            const response = await fetch("/available_models");
            if (!response.ok) throw new Error("Failed to fetch models");
            const models = await response.json();
            modelSelect.innerHTML = "";
            models.forEach(model => {
                const option = document.createElement("option");
                option.value = JSON.stringify(model);
                option.textContent = `${model.name} (${model.type.toUpperCase()})`;
                modelSelect.appendChild(option);
            });

            if (models.length > 0) {
                const firstModel = models[0];
                updateCameraUI(firstModel.type);
            }
        } catch (err) {
            console.error("Model Loading Error:", err);
            showToast("Failed to load models", "error");
            showNotification("Failed to load models from server", "error");
        }
    }

    modelSelect.addEventListener('change', async (e) => {
        try {
            const modelInfo = JSON.parse(e.target.value);
            const response = await fetch("/select_model", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(modelInfo)
            });

            if (response.ok) {
                showToast(`Switched to ${modelInfo.name}`);
                updateCameraUI(modelInfo.type);
                if (typeof slPanel !== 'undefined' && slPanel) {
                    slPanel.setModelType(modelInfo.type);
                }
                lastHistoryPrediction = null;
                predAlphabet.textContent = "-";
                predConf.textContent = "0%";
                confBar.style.width = "0%";

                const octx = overlayCanvas.getContext('2d');
                octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
                if (aiStatusText) aiStatusText.textContent = 'processing';
            } else {
                showToast("Failed to switch model", "error");
            }
        } catch (err) {
            console.error("Model Switch Error:", err);
            showToast("Error switching model", "error");
        }
    });

    const fullscreenBtn = document.getElementById('fullscreen-btn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            const wrapper = document.querySelector('.webcam-wrapper');
            if (!document.fullscreenElement) {
                wrapper.requestFullscreen().catch(() => showToast("Fullscreen error", "error"));
            } else {
                document.exitFullscreen();
            }
        });
    }

    const cameraToggle = document.getElementById('camera-toggle');
    if (cameraToggle) {
        cameraToggle.addEventListener('click', () => {
            if (stream) {
                const tracks = stream.getVideoTracks();
                tracks.forEach(track => {
                    track.enabled = !track.enabled;
                    showToast(track.enabled ? "Camera Enabled" : "Camera Disabled");
                });
            }
        });
    }

    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', captureScreenshot);
    }

    function captureScreenshot() {
        const shotCanvas = document.createElement('canvas');
        shotCanvas.width = video.videoWidth || 640;
        shotCanvas.height = video.videoHeight || 480;
        const sCtx = shotCanvas.getContext('2d');
        sCtx.drawImage(video, 0, 0);
        const pred = predAlphabet.textContent;
        if (pred !== '-') {
            sCtx.font = 'bold 48px sans-serif';
            sCtx.fillStyle = '#00f2ff';
            sCtx.shadowColor = '#000';
            sCtx.shadowBlur = 8;
            sCtx.fillText(pred, 20, 60);
        }
        shotCanvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rtsl-screenshot-${Date.now()}.png`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Screenshot saved');
        }, 'image/png');
    }

    if (recordBtn) {
        recordBtn.addEventListener('click', toggleRecording);
    }

    function toggleRecording() {
        if (isRecording) { stopRecording(); }
        else { startRecording(); }
    }

    function startRecording() {
        if (!stream) { showToast('No camera stream', 'error'); return; }
        recordedChunks = [];
        try {
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
        } catch (e) {
            try {
                mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
            } catch (e2) {
                showToast('Recording not supported in this browser', 'error');
                return;
            }
        }
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rtsl-recording-${Date.now()}.webm`;
            a.click();
            URL.revokeObjectURL(url);
            showNotification('Recording saved!', 'info');
            setTimeout(() => { if (notifBar) notifBar.style.display = 'none'; }, 4000);
        };
        mediaRecorder.start(1000);
        isRecording = true;
        recordBtn.innerHTML = '<i class="fas fa-stop"></i>';
        recordBtn.style.color = '#ef4444';
        showToast('Recording started');
        showNotification('Recording... Press R or click stop to save', 'info');
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        isRecording = false;
        recordBtn.innerHTML = '<i class="fas fa-circle"></i>';
        recordBtn.style.color = '';
        showToast('Recording stopped');
        if (notifBar) notifBar.style.display = 'none';
    }

    document.getElementById('export-txt').addEventListener('click', () => {
        const historyItems = Array.from(historyList.querySelectorAll('.history-item')).map(item => {
            const spans = item.querySelectorAll('span');
            return `[${spans[1].textContent}] Prediction: ${spans[0].textContent} | Confidence: ${spans[2].textContent}`;
        });
        if (historyItems.length === 0) { showToast("History is empty", "error"); return; }
        const blob = new Blob([historyItems.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rtsl_history_${new Date().getTime()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('export-pdf').addEventListener('click', () => {
        if (!window.jspdf) { showToast("PDF library error", "error"); return; }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text("RTSL Detection History", 20, 20);
        doc.setFontSize(10);
        doc.text(`Report generated: ${new Date().toLocaleString()}`, 20, 30);
        let y = 45;
        const historyItems = Array.from(historyList.querySelectorAll('.history-item'));
        if (historyItems.length === 0) { showToast("History is empty", "error"); return; }
        historyItems.forEach((item, index) => {
            if (y > 280) { doc.addPage(); y = 20; }
            const spans = item.querySelectorAll('span');
            doc.text(`${index + 1}. [${spans[1].textContent}] ${spans[0].textContent} (${spans[2].textContent})`, 20, y);
            y += 10;
        });
        doc.save('rtsl_history.pdf');
    });

    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isDetecting = false;
        if (stream) { stream.getTracks().forEach(t => t.stop()); }
        localStorage.removeItem('asl_user');
        window.location.href = 'index.html';
    });

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        const key = e.key.toLowerCase();
        if (key === 'r') { e.preventDefault(); toggleRecording(); }
        else if (key === 's') { e.preventDefault(); captureScreenshot(); }
        else if (key === 'f') { e.preventDefault(); if (fullscreenBtn) fullscreenBtn.click(); }
        else if (key === 'c') { e.preventDefault(); if (cameraToggle) cameraToggle.click(); }
        else if (key === 'l') { e.preventDefault(); document.getElementById('sl-search')?.focus(); }
    });

    // ─── SIGN LANGUAGE REFERENCE PANEL ────────────────────────────
    const slPanel = {
        grid: document.getElementById('sl-grid'),
        search: document.getElementById('sl-search'),
        searchClear: document.getElementById('sl-search-clear'),
        cats: document.getElementById('sl-categories'),
        modal: document.getElementById('gesture-modal'),
        modalPreview: document.getElementById('modal-preview-area'),
        modalTitle: document.getElementById('modal-title'),
        modalDesc: document.getElementById('modal-desc'),
        modalFingers: document.getElementById('modal-fingers'),
        modalTip: document.getElementById('modal-tip'),
        title: document.getElementById('sl-title'),
        subtitle: document.getElementById('sl-subtitle'),
        stats: document.getElementById('sl-stats'),
        statTotal: document.getElementById('sl-stat-total'),
        statLearned: document.getElementById('sl-stat-learned'),
        statFavs: document.getElementById('sl-stat-favs'),
        recent: document.getElementById('sl-recent'),
        recentList: document.getElementById('sl-recent-list'),
        learnBtn: document.getElementById('sl-learn-btn'),
        modeLetters: document.getElementById('sl-mode-letters'),
        modeWords: document.getElementById('sl-mode-words'),

        focusedLetter: null,
        mode: 'letters',
        isLearning: false,
        learningOrder: [],
        learningIdx: 0,
        favorites: JSON.parse(localStorage.getItem('asl_favs') || '[]'),
        learned: JSON.parse(localStorage.getItem('asl_learned') || '[]'),
        recentDetections: [],

        init() {
            this.renderCategories();
            this.renderAlphabetGrid();
            this.bindEvents();
            this.updateStats();
            this.updateFavCount();
            this.syncFavorites();
        },

        bindEvents() {
            const self = this;
            this.search.addEventListener('input', () => {
                this.searchClear.style.display = this.search.value ? 'block' : 'none';
                this.filter();
            });
            this.searchClear.addEventListener('click', () => {
                this.search.value = '';
                this.searchClear.style.display = 'none';
                this.filter();
                this.search.focus();
            });

            document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
            this.modal.addEventListener('click', (e) => { if (e.target === this.modal) this.closeModal(); });
            document.getElementById('modal-practice').addEventListener('click', () => this.startPractice());

            this.modeLetters.addEventListener('click', () => this.setMode('letters'));
            this.modeWords.addEventListener('click', () => this.setMode('words'));

            this.learnBtn.addEventListener('click', () => this.toggleLearning());

            this.grid.addEventListener('click', (e) => {
                const card = e.target.closest('.sl-card');
                const fav = e.target.closest('.sl-fav');
                if (fav) { e.stopPropagation(); this.toggleFav(fav.dataset.letter); return; }
                if (card) this.openPreview(card.dataset.letter);
            });
        },

        renderCategories() {
            const active = this.cats.dataset.active || 'all';
            this.cats.innerHTML = ASL_CATEGORIES.map(c =>
                `<span class="sl-cat${c.id === active ? ' active' : ''}" data-cat="${c.id}">${c.label}</span>`
            ).join('');
            this.cats.addEventListener('click', (e) => {
                const span = e.target.closest('.sl-cat');
                if (!span) return;
                this.cats.querySelectorAll('.sl-cat').forEach(el => el.classList.remove('active'));
                span.classList.add('active');
                this.cats.dataset.active = span.dataset.cat;
                this.filter();
            });
        },

        renderAlphabetGrid() {
            this.mode = 'letters';
            this.title.textContent = 'Sign Language Alphabet';
            this.subtitle.textContent = '3D Hand Gesture Reference';
            this.modeLetters.style.background = 'var(--accent-primary)';
            this.modeLetters.style.color = '#000';
            this.modeWords.style.background = '';
            this.modeWords.style.color = '';
            this.renderGrid(this.getCurrentLetters());
        },

        renderWordsGrid() {
            this.mode = 'words';
            this.title.textContent = 'Gesture Dictionary';
            this.subtitle.textContent = 'Common Sign Language Gestures';
            this.modeWords.style.background = 'var(--accent-primary)';
            this.modeWords.style.color = '#000';
            this.modeLetters.style.background = '';
            this.modeLetters.style.color = '';
            this.renderGrid(this.getCurrentWords());
        },

        setMode(mode) {
            if (mode === this.mode) return;
            this.search.value = '';
            this.searchClear.style.display = 'none';
            if (mode === 'letters') {
                this.renderAlphabetGrid();
            } else {
                this.renderWordsGrid();
            }
            this.updateStats();
            this.cats.dataset.active = 'all';
            this.cats.querySelectorAll('.sl-cat').forEach(el => el.classList.remove('active'));
            this.cats.querySelector('[data-cat="all"]')?.classList.add('active');
        },

        setModelType(type) {
            if (type === 'keras') {
                this.setMode('words');
            }
        },

        getCurrentLetters() {
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => ({
                letter,
                category: getLetterDifficulty(letter),
                desc: HAND_POSES[letter]?.txt || '',
            }));
            return letters;
        },

        getCurrentWords() {
            return KERAS_GESTURES.map(g => ({
                letter: g.label,
                origId: g.id,
                category: 'all',
                desc: g.desc,
                hand: null
            }));
        },

        renderGrid(items) {
            if (this.mode === 'letters') {
                this.grid.innerHTML = items.map(l => {
                    const fav = this.favorites.includes(l.letter) ? ' favorited' : '';
                    const learned = this.learned.includes(l.letter) ? ' learned' : '';
                    return `<div class="sl-card${fav}${learned}" data-letter="${l.letter}" title="${l.desc}">
                        <div class="sl-card-hand"><img src="reference/asl_${l.letter.toLowerCase()}.png" alt="${l.letter}" class="sl-card-img" loading="lazy"></div>
                        <span class="sl-card-desc">${l.desc}</span>
                        <button class="sl-fav" data-letter="${l.letter}"><i class="fas fa-star"></i></button>
                    </div>`;
                }).join('');
            } else {
                this.grid.innerHTML = items.map(g => {
                    const fav = this.favorites.includes(g.letter) ? ' favorited' : '';
                    const learned = this.learned.includes(g.letter) ? ' learned' : '';
                    const short = g.letter.length > 8 ? g.letter.slice(0, 7) + '…' : g.letter;
                    return `<div class="sl-card sl-word-card${fav}${learned}" data-letter="${g.letter}" data-orig-id="${g.origId}" title="${g.desc}">
                        <div class="sl-card-hand"><img src="reference/gesture_${g.origId}.png" alt="${g.letter}" class="sl-card-img" loading="lazy"></div>
                        <div class="sl-card-label">${g.letter}</div>
                        <button class="sl-fav" data-letter="${g.letter}"><i class="fas fa-star"></i></button>
                    </div>`;
                }).join('');
            }
            this.syncFavorites();
        },

        filter() {
            const q = this.search.value.toLowerCase();
            const cat = this.cats.dataset.active || 'all';

            if (this.mode === 'letters') {
                let items = this.getCurrentLetters();
                if (q) items = items.filter(l => l.letter.toLowerCase().includes(q));
                if (cat === 'vowels') items = items.filter(l => 'aeiou'.includes(l.letter.toLowerCase()));
                else if (cat === 'easy') items = items.filter(l => l.category === 'easy');
                else if (cat === 'medium') items = items.filter(l => l.category === 'medium');
                else if (cat === 'hard') items = items.filter(l => l.category === 'hard');
                this.renderGrid(items);
                this.statTotal.textContent = items.length;
            } else {
                let items = this.getCurrentWords();
                if (q) items = items.filter(g => g.letter.toLowerCase().includes(q));
                this.renderGrid(items);
                this.statTotal.textContent = items.length;
            }
        },

        highlight(letter) {
            if (!letter || letter === 'None' || letter === '-') return;
            this.focusedLetter = letter;

            const attr = this.mode === 'letters' ? 'data-letter' : 'data-letter';
            this.grid.querySelectorAll('.sl-card').forEach(c => {
                const isMatch = c.getAttribute(attr)?.toUpperCase() === letter.toUpperCase() ||
                               c.getAttribute('data-orig-id') === letter ||
                               c.getAttribute('data-orig-id')?.toLowerCase() === letter.toLowerCase();
                c.classList.toggle('matched', isMatch);
                if (isMatch) {
                    this.learnItem(letter);
                }
            });
            const matched = this.grid.querySelector(`.sl-card.matched`);
            if (matched) {
                matched.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            this.addRecent(letter);
        },

        openPreview(letter) {
            if (this.mode === 'letters') {
                const data = HAND_POSES[letter];
                if (!data) return;
                this.modalPreview.innerHTML = `<img src="reference/asl_${letter.toLowerCase()}.png" alt="${letter}" class="modal-preview-img" loading="lazy">`;
                this.modalTitle.textContent = `Letter ${letter}`;
                this.modalDesc.textContent = data.txt || getLetterDescription(letter);
                this.modalFingers.textContent = getLetterDescription(letter);
                this.modalTip.textContent = 'Practice making this shape slowly, then try to hold it steady. Mirror the gesture with your non-dominant hand for comparison.';
            } else {
                const data = KERAS_GESTURES.find(g => g.label === letter);
                if (!data) return;
                this.modalPreview.innerHTML = `<img src="reference/gesture_${data.id}.png" alt="${data.label}" class="modal-preview-img" loading="lazy">`;
                this.modalTitle.textContent = data.label;
                this.modalDesc.textContent = data.desc;
                this.modalFingers.textContent = 'This is a whole-word gesture. Practice the motion several times until it feels natural.';
                this.modalTip.textContent = 'Focus on the hand shape and movement pattern. Speed comes with practice.';
            }
            this.modal.classList.add('open');
        },

        closeModal() {
            this.modal.classList.remove('open');
        },

        toggleFav(letter) {
            const idx = this.favorites.indexOf(letter);
            if (idx > -1) this.favorites.splice(idx, 1);
            else this.favorites.push(letter);
            localStorage.setItem('asl_favs', JSON.stringify(this.favorites));
            this.syncFavorites();
            this.updateFavCount();
        },

        syncFavorites() {
            this.grid.querySelectorAll('.sl-card').forEach(c => {
                const letter = c.getAttribute('data-letter');
                if (letter) c.classList.toggle('favorited', this.favorites.includes(letter));
            });
        },

        updateFavCount() {
            this.statFavs.textContent = this.favorites.length;
        },

        learnItem(letter) {
            if (this.learned.includes(letter)) return;
            this.learned.push(letter);
            localStorage.setItem('asl_learned', JSON.stringify(this.learned));
            this.statLearned.textContent = this.learned.length;
            const card = this.grid.querySelector(`.sl-card[data-letter="${letter}"]`);
            if (card) card.classList.add('learned');
        },

        updateStats() {
            this.statTotal.textContent = this.mode === 'letters' ? 26 : KERAS_GESTURES.length;
            this.statLearned.textContent = this.learned.length;
        },

        addRecent(letter) {
            if (!letter || letter === 'None') return;
            this.recentDetections = this.recentDetections.filter(r => r !== letter);
            this.recentDetections.unshift(letter);
            if (this.recentDetections.length > 5) this.recentDetections.pop();

            this.recent.style.display = this.recentDetections.length ? 'block' : 'none';
            this.recentList.innerHTML = this.recentDetections.map(r =>
                `<span class="sl-recent-chip" data-letter="${r}">${r}</span>`
            ).join('');

            this.recentList.querySelectorAll('.sl-recent-chip').forEach(chip => {
                chip.addEventListener('click', () => this.openPreview(chip.dataset.letter));
            });
        },

        toggleLearning() {
            this.isLearning = !this.isLearning;
            if (this.isLearning) {
                if (this.mode !== 'letters') this.setMode('letters');
                this.learningOrder = this.getCurrentLetters()
                    .filter(l => !this.learned.includes(l.letter))
                    .sort(() => Math.random() - 0.5);
                if (this.learningOrder.length === 0) {
                    this.learningOrder = this.getCurrentLetters().sort(() => Math.random() - 0.5);
                }
                this.learningIdx = 0;
                this.learnBtn.innerHTML = '<i class="fas fa-stop"></i> Exit Learning Mode';
                this.learnBtn.classList.add('active');
                this.showLearningCard();
            } else {
                this.learnBtn.innerHTML = '<i class="fas fa-graduation-cap"></i> Quick Learning Mode';
                this.learnBtn.classList.remove('active');
                this.grid.querySelectorAll('.sl-card').forEach(c => c.classList.remove('learning'));
            }
        },

        showLearningCard() {
            if (!this.isLearning || this.learningIdx >= this.learningOrder.length) {
                this.toggleLearning();
                showToast('Learning session complete! Great job! 🎉', 'success');
                return;
            }
            const item = this.learningOrder[this.learningIdx];
            this.grid.querySelectorAll('.sl-card').forEach(c => c.classList.remove('learning'));
            const card = this.grid.querySelector(`.sl-card[data-letter="${item.letter}"]`);
            if (card) {
                card.classList.add('learning');
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                this.openPreview(item.letter);
            }
            this.learningIdx++;
        },

        startPractice() {
            this.closeModal();
            if (this.isLearning) {
                setTimeout(() => this.showLearningCard(), 1500);
            }
            if (this.focusedLetter) {
                const card = this.grid.querySelector(`.sl-card[data-letter="${this.focusedLetter}"]`);
                if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            showToast('Show the gesture to the camera and watch live detection!', 'info');
        }
    };

    slPanel.init();
    // ─── End Sign Language Panel ────────────────────────

    loadAvailableModels().then(() => {
        initWebcam();
    });
});
