// ==================================================
// PLUS D'IMPORTS ! On utilise window.state et window.api

export class HomeworkGame {
    constructor(container, controller) {
        this.c = container; 
        this.controller = controller;

        console.log("📚 HomeworkGame Loaded (Global Mode) with Fit-to-screen");

        // --- UI ---
        this.listView = this.c.querySelector("#hw-list"); 
        this.workView = this.c.querySelector("#hw-workspace");
        this.viewerContainer = this.c.querySelector("#doc-viewer"); 
        this.panZoomContent = this.c.querySelector("#pan-zoom-content");
        this.imgEl = this.c.querySelector("#current-doc-img");
        this.pdfEl = this.c.querySelector("#current-doc-pdf");
        this.noDocMsg = this.c.querySelector("#no-doc-msg");
        this.counterEl = this.c.querySelector("#page-counter");
        
        this.qIndexEl = this.c.querySelector("#q-index");
        this.qTextEl = this.c.querySelector("#q-text");
        this.qImgZone = this.c.querySelector("#q-image-container"); 
        this.qPanZoomContent = this.c.querySelector("#pan-zoom-question-content"); 
        this.btnZoomInQ = this.c.querySelector("#btn-zoom-in-q");
        this.btnZoomOutQ = this.c.querySelector("#btn-zoom-out-q");

        this.input = this.c.querySelector("#hw-text");
        this.fileInput = this.c.querySelector("#hw-file");
        this.fileName = this.c.querySelector("#file-name");
        this.btnSubmit = this.c.querySelector("#hw-submit");
        this.btnQuit = this.c.querySelector("#btn-close-work");
        
        this.aiModal = document.getElementById("ai-feedback-modal");
        this.aiContent = document.getElementById("ai-content");
        this.btnModify = document.getElementById("btn-modify");
        this.btnNextQ = document.getElementById("btn-next");
        this.overlay = document.getElementById("ai-overlay");

        this.currentHw = null; 
        this.currentLevelIndex = 0;
        this.docs = []; 
        this.docIndex = 0;
        
        this.view = { x: 0, y: 0, scale: 1.3 }; 
        this.viewQ = { x: 0, y: 0, scale: 1.0 }; 

        this.initEvents();
        this.setupPanZoom(this.viewerContainer, 'doc');
        this.setupPanZoom(this.qImgZone, 'q');
        this.loadHomeworks();
    }

    initEvents() {
        if(this.btnQuit) this.btnQuit.onclick = () => this.showList();
        if(this.btnSubmit) this.btnSubmit.onclick = (e) => { e.preventDefault(); this.submit(); };
        
        this.c.querySelector("#btn-prev-doc").onclick = () => this.changeDoc(-1);
        this.c.querySelector("#btn-next-doc").onclick = () => this.changeDoc(1);
        this.c.querySelector("#btn-zoom-in").onclick = () => this.zoom(0.2, 'doc');
        this.c.querySelector("#btn-zoom-out").onclick = () => this.zoom(-0.2, 'doc');
        
        if(this.btnZoomInQ) this.btnZoomInQ.onclick = () => this.zoom(0.2, 'q');
        if(this.btnZoomOutQ) this.btnZoomOutQ.onclick = () => this.zoom(-0.2, 'q');

        if(this.btnModify) this.btnModify.onclick = () => this.closeModal();
        if(this.btnNextQ) this.btnNextQ.onclick = () => { this.closeModal(); this.nextQuestion(); };
        
        if(this.fileInput) {
            this.fileInput.onchange = () => { 
                if(this.fileInput.files.length) this.fileName.textContent = "📸 Photo OK"; 
            };
        }
    }

    setupPanZoom(container, type) {
        if(!container) return;
        let isDown = false, startX, startY;

        container.addEventListener('mousedown', (e) => {
            if(e.target.tagName === 'BUTTON') return;
            isDown = true;
            container.style.cursor = 'grabbing';
            const v = (type === 'doc') ? this.view : this.viewQ;
            startX = e.clientX - v.x;
            startY = e.clientY - v.y;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            const v = (type === 'doc') ? this.view : this.viewQ;
            v.x = e.clientX - startX;
            v.y = e.clientY - startY;
            this.updateTransform(type);
        });

        window.addEventListener('mouseup', () => {
            isDown = false;
            container.style.cursor = 'grab';
        });
    }

    zoom(delta, type) {
        const v = (type === 'doc') ? this.view : this.viewQ;
        v.scale = Math.min(Math.max(0.1, v.scale + delta), 5);
        this.updateTransform(type);
    }

    updateTransform(type) {
        const v = (type === 'doc') ? this.view : this.viewQ;
        const target = (type === 'doc') ? this.panZoomContent : this.qPanZoomContent;
        if(target) {
            target.style.transform = `translate(-50%, -50%) translate(${v.x}px, ${v.y}px) scale(${v.scale})`;
        }
    }

    resetView(type) {
        if(type === 'doc') this.view = { x: 0, y: 0, scale: 1.3 };
        else this.viewQ = { x: 0, y: 0, scale: 1.0 };
        this.updateTransform(type);
    }

    async loadHomeworks() {
        if(this.listView) this.listView.innerHTML = "<p>Chargement...</p>";
        try {
            const list = await window.api.getHomeworks(window.state.currentPlayerData.classroom);
            if(this.listView) {
                this.listView.innerHTML = ""; 
                if (list.length === 0) { this.listView.innerHTML = "<p>Rien à faire.</p>"; return; }
                list.forEach((hw) => {
                    const div = document.createElement("div"); div.className = "hw-list-item";
                    div.innerHTML = `<b>${hw.title}</b><br><small>${new Date(hw.date).toLocaleDateString()}</small>`;
                    div.onclick = () => this.startHomework(hw);
                    this.listView.appendChild(div);
                });
            }
        } catch(e) { console.error(e); }
    }

    startHomework(hw) {
        this.currentHw = hw;
        this.currentLevelIndex = 0;
        if(this.listView) this.listView.style.display = "none";
        if(this.workView) this.workView.style.display = "flex";
        this.loadLevel();
    }

    loadLevel() {
        const levels = this.currentHw.levels || [];
        const currentLevel = levels[this.currentLevelIndex];
        
        if(this.qIndexEl) this.qIndexEl.textContent = `${this.currentLevelIndex + 1}/${levels.length}`;
        
        if(this.qTextEl) {
            if (currentLevel.instruction && currentLevel.instruction.trim() !== "") {
                this.qTextEl.innerHTML = currentLevel.instruction.replace(/\n/g, '<br>');
                this.qTextEl.style.display = "block";
            } else {
                this.qTextEl.style.display = "none";
            }
        }
        
        if(this.qImgZone && this.qPanZoomContent) {
            this.qPanZoomContent.innerHTML = "";
            if (currentLevel.questionImage) {
                this.qImgZone.style.display = "block";
                const img = document.createElement('img');
                img.src = currentLevel.questionImage;
                img.style.display = "block";
                img.style.webkitUserDrag = "none";
                
                // --- FIX : FIT-TO-SCREEN POUR QUESTION ---
                img.style.maxWidth = "none";
                img.style.maxHeight = "none";

                img.onload = () => {
                    const containerW = this.qImgZone.offsetWidth;
                    const containerH = this.qImgZone.offsetHeight;
                    const imgW = img.naturalWidth;
                    const imgH = img.naturalHeight;
                    // Ratio 95%
                    const scaleW = (containerW * 0.95) / imgW;
                    const scaleH = (containerH * 0.95) / imgH;
                    this.viewQ.scale = Math.min(scaleW, scaleH);
                    this.viewQ.x = 0;
                    this.viewQ.y = 0;
                    this.updateTransform('q');
                };
                this.qPanZoomContent.appendChild(img);
            } else {
                this.qImgZone.style.display = "none";
            }
        }

        this.docs = (currentLevel.attachmentUrls || []).filter(u => u !== "BREAK");
        this.docIndex = 0;
        this.renderCurrentDoc();

        if(this.input) this.input.value = "";
        if(this.fileInput) this.fileInput.value = "";
        if(this.fileName) this.fileName.textContent = "";
        if(this.btnSubmit) this.btnSubmit.disabled = false;
    }

    renderCurrentDoc() {
        this.view = { x: 0, y: 0, scale: 1 }; 
        
        if (this.docs.length === 0) {
            if(this.imgEl) this.imgEl.style.display = "none";
            if(this.pdfEl) this.pdfEl.style.display = "none";
            if(this.noDocMsg) this.noDocMsg.style.display = "block";
            return;
        }
        if(this.noDocMsg) this.noDocMsg.style.display = "none";
        
        const url = this.docs[this.docIndex];
        const isPdf = url.toLowerCase().endsWith('.pdf');
        
        if (isPdf) {
            if(this.imgEl) this.imgEl.style.display = "none";
            if(this.pdfEl) { 
                this.pdfEl.style.display = "block"; 
                this.pdfEl.src = url; 
            }
        } else {
            if(this.pdfEl) this.pdfEl.style.display = "none";
            if(this.imgEl) { 
                this.imgEl.style.display = "block"; 
                
                // --- FIX : FIT-TO-SCREEN POUR DOC PRINCIPAL ---
                this.imgEl.onload = () => {
                    const containerW = this.viewerContainer.offsetWidth;
                    const containerH = this.viewerContainer.offsetHeight;
                    const imgW = this.imgEl.naturalWidth;
                    const imgH = this.imgEl.naturalHeight;
                    // Ratio 90%
                    const scaleW = (containerW * 0.9) / imgW;
                    const scaleH = (containerH * 0.9) / imgH;
                    this.view.scale = Math.min(scaleW, scaleH);
                    this.updateTransform('doc');
                };
                
                this.imgEl.src = url; 
            }
        }
        if(this.counterEl) this.counterEl.textContent = `${this.docIndex + 1} / ${this.docs.length}`;
    }

    changeDoc(dir) {
        this.docIndex += dir;
        this.renderCurrentDoc();
    }

    async submit() {
        const txt = this.input ? this.input.value : "";
        const file = (this.fileInput && this.fileInput.files) ? this.fileInput.files[0] : null;
        if(!txt && !file) return alert("Réponse vide !");
        
        if(this.btnSubmit) this.btnSubmit.disabled = true;
        if(this.aiModal) {
            this.aiModal.style.display = "flex";
            if(this.overlay) this.overlay.style.display = "block";
            if(this.aiContent) this.aiContent.innerHTML = "<p style='text-align:center;'>🧠 L'IA analyse ton travail et sauvegarde ta copie...</p>";
        }

        try {
            let imgUrl = null;
            if(file) {
                const fd = new FormData(); fd.append('file', file);
                const r = await window.api.upload(file); 
                if(r.ok) imgUrl = r.imageUrl;
            }
            
            const lvl = this.currentHw.levels[this.currentLevelIndex];
            const res = await window.api.post('/api/analyze-homework', { 
                imageUrl: imgUrl, 
                userText: txt, 
                homeworkInstruction: lvl.instruction,
                homeworkContext: lvl.aiPrompt,
                questionImage: lvl.questionImage,
                teacherDocUrls: this.docs,
                classroom: window.state.currentPlayerData.classroom,
                playerId: window.state.currentPlayerId,
                homeworkId: this.currentHw._id,
                levelIndex: this.currentLevelIndex 
            });
            
            if (this.aiContent) this.aiContent.innerHTML = res.feedback;
            if (this.btnModify) this.btnModify.style.display = "inline-block";
            if (this.btnNextQ) {
                this.btnNextQ.style.display = "inline-block";
                const isLast = (this.currentLevelIndex >= this.currentHw.levels.length - 1);
                this.btnNextQ.textContent = isLast ? "Terminer 🎉" : "Suivant ➔";
            }
        } catch(e) {
            console.error(e);
            if(this.aiContent) this.aiContent.innerHTML = "Erreur technique.";
        }
        if(this.btnSubmit) this.btnSubmit.disabled = false;
    }

    closeModal() {
        if(this.aiModal) this.aiModal.style.display = "none";
        if(this.overlay) this.overlay.style.display = "none";
    }

    nextQuestion() {
        if (this.currentLevelIndex < this.currentHw.levels.length - 1) {
            this.currentLevelIndex++;
            this.loadLevel();
        } else {
            alert("Devoir terminé ! Ta copie a été transmise.");
            this.showList();
        }
    }
    
    showList() { 
        if(this.workView) this.workView.style.display = "none"; 
        if(this.listView) this.listView.style.display = "block"; 
    }
}