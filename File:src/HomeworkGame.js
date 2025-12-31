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

    /* -------------------------------------------------- */
    /* ------------------ SUBMIT IA ---------------------- */
    /* -------------------------------------------------- */

    async submit() {
        const txt = this.input ? this.input.value : "";
        const file = (this.fileInput && this.fileInput.files) ? this.fileInput.files[0] : null;
        if(!txt && !file) return alert("Réponse vide !");
        
        if(this.btnSubmit) this.btnSubmit.disabled = true;
        if(this.aiModal) {
            this.aiModal.style.display = "flex";
            if(this.overlay) this.overlay.style.display = "block";
            if(this.aiContent) {
                this.aiContent.innerHTML = "<p style='text-align:center;'>🧠 L'IA analyse ton travail...</p>";
            }
        }

        try {
            let imgUrl = null;
            if(file) {
                const r = await window.api.upload(file); 
                if(r && r.ok) imgUrl = r.imageUrl;
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

            this.renderAiFeedback(res);

            if(this.btnModify) this.btnModify.style.display = "inline-block";
            if(this.btnNextQ) {
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

    /* -------------------------------------------------- */
    /* ----------- RENDU FEEDBACK + ORTHO --------------- */
    /* -------------------------------------------------- */

    renderAiFeedback(res) {
        if(!this.aiContent) return;

        const feedback = res.feedback || "";
        const spellingMap = res.spellingMap || {};

        let html = `<div class="ai-feedback">${feedback}</div>`;

        const entries = Object.entries(spellingMap);
        if(entries.length > 0) {
            let rows = "";
            for(let i = 0; i < entries.length; i++) {
                const wrong = entries[i][0];
                const correct = entries[i][1];
                if(wrong && correct && wrong.toLowerCase() != correct.toLowerCase()) {
                    rows += `<tr><td>${wrong}</td><td>${correct}</td></tr>`;
                }
            }

            if(rows) {
                html += `
                <div class="ai-spelling" style="margin-top:14px;">
                    <div style="font-weight:600;margin-bottom:6px;">✍️ Corrections d’orthographe</div>
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr>
                                <th style="text-align:left;border-bottom:1px solid #ccc;padding:4px;">Mot écrit</th>
                                <th style="text-align:left;border-bottom:1px solid #ccc;padding:4px;">Correction</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
            }
        }

        this.aiContent.innerHTML = html;
    }

    /* -------------------------------------------------- */
    /* ------------------ UI NAV ------------------------ */
    /* -------------------------------------------------- */

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