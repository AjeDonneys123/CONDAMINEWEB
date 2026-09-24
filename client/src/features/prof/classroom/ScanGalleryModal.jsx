import React, { useState, useEffect, useMemo } from 'react';

export default function ScanGalleryModal({
    isOpen,
    onClose,
    student = null,
    students = [],
    classId = '',
    className = '',
    onOpenCapture = null
}) {
    const [scans, setScans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterMode, setFilterMode] = useState(student ? 'student' : 'class'); // 'student' or 'class'
    const [selectedScanIds, setSelectedScanIds] = useState([]);
    const [fullscreenScan, setFullscreenScan] = useState(null); // Scan in lightbox
    const [copyingStatus, setCopyingStatus] = useState(''); // Toast status
    const [toastTimer, setToastTimer] = useState(null);
    const [collapsedDevoirs, setCollapsedDevoirs] = useState({}); // { [devoirId]: boolean }
    const [devoirEditor, setDevoirEditor] = useState(null);
    const [categoryDropdownDevoirId, setCategoryDropdownDevoirId] = useState(null);
    const [tempCategoryName, setTempCategoryName] = useState('');
    const [knownCategories, setKnownCategories] = useState([]);

    const showToast = (message) => {
        setCopyingStatus(message);
        if (toastTimer) clearTimeout(toastTimer);
        const t = setTimeout(() => setCopyingStatus(''), 4000);
        setToastTimer(t);
    };

    // Chargement des scans
    const loadScans = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterMode === 'student' && student?._id) {
                params.append('studentId', student._id);
            } else if (classId) {
                params.append('classId', classId);
            }
            const res = await fetch(`/api/classroom/scans?${params.toString()}`);
            const data = await res.json();
            if (res.ok && Array.isArray(data.scans)) {
                setScans(data.scans);
            } else {
                setScans([]);
            }
            if (res.ok && Array.isArray(data.knownCategories)) {
                setKnownCategories(data.knownCategories);
            }
        } catch (e) {
            console.error("Erreur chargement scans:", e);
            setScans([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setSelectedScanIds([]);
            setFullscreenScan(null);
            void loadScans();
        }
    }, [isOpen, filterMode, student?._id, classId]);

    // Regrouper les scans en dossiers "Devoir"
    const devoirsList = useMemo(() => {
        if (!scans || scans.length === 0) return [];

        const sessionMap = new Map();
        const unassigned = [];

        // Trier par date croissante pour indexer les devoirs
        const sortedScans = [...scans].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        sortedScans.forEach((scan) => {
            const sessId = String(scan.sessionId || '').trim();
            if (sessId) {
                if (!sessionMap.has(sessId)) {
                    sessionMap.set(sessId, []);
                }
                sessionMap.get(sessId).push(scan);
            } else {
                unassigned.push(scan);
            }
        });

        // Pour les scans sans sessionId, regrouper par proximité temporelle (15 min)
        if (unassigned.length > 0) {
            let currentCluster = [];
            let lastTime = null;

            unassigned.forEach((scan) => {
                const t = new Date(scan.createdAt).getTime();
                if (lastTime && t - lastTime > 15 * 60 * 1000) {
                    const fallbackId = `cluster_${currentCluster[0]._id}`;
                    sessionMap.set(fallbackId, currentCluster);
                    currentCluster = [];
                }
                currentCluster.push(scan);
                lastTime = t;
            });

            if (currentCluster.length > 0) {
                const fallbackId = `cluster_${currentCluster[0]._id}`;
                sessionMap.set(fallbackId, currentCluster);
            }
        }

        // Convertir en liste de Devoirs numérotés
        const devoirs = [];
        let index = 1;

        // Trier les sessions par date du premier scan
        const sortedSessions = Array.from(sessionMap.entries()).sort(
            ([, scansA], [, scansB]) => new Date(scansA[0].createdAt) - new Date(scansB[0].createdAt)
        );

        sortedSessions.forEach(([sessionId, items]) => {
            // Trier les pages à l'intérieur du devoir
            const sortedItems = [...items].sort((a, b) => {
                const pageA = Number(a.pageIndex) || 1;
                const pageB = Number(b.pageIndex) || 1;
                if (pageA !== pageB) return pageA - pageB;
                return new Date(a.createdAt) - new Date(b.createdAt);
            });

            const firstScan = sortedItems[0];
            const homeworkNum = firstScan.homeworkNumber || index;

            devoirs.push({
                id: sessionId,
                sessionId,
                homeworkNumber: homeworkNum,
                assignmentInstanceId: firstScan.assignmentInstanceId || `legacy_${homeworkNum}`,
                assignmentName: firstScan.assignmentName || '',
                title: firstScan.assignmentName || `Devoir #${homeworkNum}`,
                studentName: firstScan.studentName || student?.firstName || '',
                correctionPrompt: firstScan.correctionPrompt || '',
                correctionPromptImageUrl: firstScan.correctionPromptImageUrl || '',
                date: firstScan.createdAt,
                scans: sortedItems
            });

            index++;
        });

        // Renvoyer les devoirs du plus récent au plus ancien
        return devoirs.reverse();
    }, [scans, student]);

    const assignmentCategories = useMemo(() => {
        const map = new Map();

        // 1. Initialiser avec les catégories mémorisées de la classe (qui peuvent avoir 0 copie)
        (knownCategories || []).forEach((cat) => {
            const rawTitle = String(cat.title || '').trim();
            const key = rawTitle.toLowerCase();
            if (key && key !== 'none') {
                map.set(key, {
                    id: cat.id || `known_${key}`,
                    homeworkNumber: cat.homeworkNumber || 1,
                    title: rawTitle,
                    count: 0
                });
            }
        });

        // 2. Agréger les devoirs existants par nom (empêche tout doublon de même nom)
        devoirsList.forEach((devoir) => {
            const rawTitle = String(devoir.title || '').trim();
            const key = rawTitle.toLowerCase();
            if (!key || key === 'none') return;

            if (!map.has(key)) {
                map.set(key, {
                    id: devoir.assignmentInstanceId || `legacy_${devoir.homeworkNumber}`,
                    homeworkNumber: devoir.homeworkNumber,
                    title: rawTitle,
                    count: 0
                });
            }
            map.get(key).count += 1;
            if (devoir.assignmentInstanceId && !devoir.assignmentInstanceId.startsWith('legacy_')) {
                map.get(key).id = devoir.assignmentInstanceId;
            }
        });

        return Array.from(map.values()).sort((a, b) => {
            if (a.count === 0 && b.count > 0) return 1;
            if (a.count > 0 && b.count === 0) return -1;
            return a.homeworkNumber - b.homeworkNumber;
        });
    }, [devoirsList, knownCategories]);

    // Basculer l'état déplié/replié d'un devoir
    const toggleDevoirCollapse = (devoirId) => {
        setCollapsedDevoirs((prev) => ({
            ...prev,
            [devoirId]: !prev[devoirId]
        }));
    };

    // Sélection d'une page
    const toggleSelectScan = (scanId, e) => {
        if (e) e.stopPropagation();
        setSelectedScanIds((prev) =>
            prev.includes(scanId) ? prev.filter((id) => id !== scanId) : [...prev, scanId]
        );
    };

    // Sélectionner toutes les pages d'un devoir
    const toggleSelectDevoir = (devoir, e) => {
        if (e) e.stopPropagation();
        const devoirScanIds = devoir.scans.map((s) => s._id);
        const allSelected = devoirScanIds.every((id) => selectedScanIds.includes(id));
        if (allSelected) {
            setSelectedScanIds((prev) => prev.filter((id) => !devoirScanIds.includes(id)));
        } else {
            setSelectedScanIds((prev) => Array.from(new Set([...prev, ...devoirScanIds])));
        }
    };

    const handleSelectAll = () => {
        if (selectedScanIds.length === scans.length) {
            setSelectedScanIds([]);
        } else {
            setSelectedScanIds(scans.map((s) => s._id));
        }
    };

    // Suppression d'un devoir entier
    const handleDeleteDevoir = async (devoir, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm(`Supprimer définitivement ce ${devoir.title} (${devoir.scans.length} page(s)) ?`)) return;
        try {
            if (devoir.sessionId && !devoir.sessionId.startsWith('cluster_')) {
                const res = await fetch(`/api/classroom/scans/session/${encodeURIComponent(devoir.sessionId)}`, { method: 'DELETE' });
                if (res.ok) {
                    setScans((prev) => prev.filter((s) => s.sessionId !== devoir.sessionId));
                    showToast(`🗑️ ${devoir.title} supprimé.`);
                }
            } else {
                for (const s of devoir.scans) {
                    await fetch(`/api/classroom/scans/${s._id}`, { method: 'DELETE' });
                }
                const deletedIds = devoir.scans.map((s) => s._id);
                setScans((prev) => prev.filter((s) => !deletedIds.includes(s._id)));
                showToast(`🗑️ ${devoir.title} supprimé.`);
            }
        } catch (_) {}
    };

    // Suppression d'un scan individuel
    const handleDeleteScan = async (scanId, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm("Supprimer cette page ?")) return;
        try {
            const res = await fetch(`/api/classroom/scans/${scanId}`, { method: 'DELETE' });
            if (res.ok) {
                setScans((prev) => prev.filter((s) => s._id !== scanId));
                setSelectedScanIds((prev) => prev.filter((id) => id !== scanId));
                if (fullscreenScan?._id === scanId) setFullscreenScan(null);
                showToast("🗑️ Page supprimée");
            }
        } catch (_) {}
    };

    // Charger une image
    const loadImageElement = (url) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Impossible de charger l'image ${url}`));
            img.src = url;
        });
    };

    // COPIER DANS LE PRESSE-PAPIER POUR L'IA
    const handleCopyScansForAi = async (targetScans = [], customLabel = '') => {
        if (!targetScans || targetScans.length === 0) {
            showToast("⚠️ Aucune page à copier.");
            return;
        }

        showToast(`⏳ Assemblage de ${targetScans.length} page(s) pour l'IA...`);

        try {
            if (targetScans.length === 1) {
                const img = await loadImageElement(targetScans[0].imageUrl);
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
                if (!blob) throw new Error("Échec conversion PNG");

                if (navigator.clipboard?.write && window.ClipboardItem) {
                    await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
                    showToast("✅ Image copiée ! Collez (Ctrl+V / Cmd+V) directement dans votre IA.");
                } else {
                    showToast("⚠️ Presse-papier direct indisponible sur ce navigateur.");
                }
            } else {
                if (navigator.clipboard?.write && window.ClipboardItem) {
                    // L'appel à clipboard.write doit avoir lieu pendant le clic.
                    // Sinon Safari/Chrome peuvent refuser silencieusement la copie
                    // après les attentes réseau et laisser l'ancienne image collée.
                    const combinedBlobPromise = (async () => {
                        const loadedImages = await Promise.all(targetScans.map((s) => loadImageElement(s.imageUrl)));
                        const maxWidth = Math.min(
                            1800,
                            Math.max(...loadedImages.map((img) => img.naturalHeight || img.height || 1200)),
                        );
                        const spacing = 32;
                        const headerHeight = 64;
                        const scaledHeights = loadedImages.map((img) => {
                            const sourceWidth = img.naturalWidth || img.width || 1200;
                            const sourceHeight = img.naturalHeight || img.height || 800;
                            // Après rotation à droite, la hauteur d'origine
                            // devient la largeur de la page assemblée.
                            return Math.round(sourceWidth * (maxWidth / sourceHeight));
                        });
                        const totalHeight = scaledHeights.reduce((acc, height) => acc + height + spacing + headerHeight, 0);
                        const canvas = document.createElement('canvas');
                        canvas.width = maxWidth;
                        canvas.height = totalHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.fillStyle = '#f8fafc';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        let currentY = 0;
                        loadedImages.forEach((img, idx) => {
                            const scanItem = targetScans[idx];
                            const height = scaledHeights[idx];
                            ctx.fillStyle = '#1e293b';
                            ctx.fillRect(0, currentY, maxWidth, headerHeight);
                            ctx.fillStyle = '#ffffff';
                            ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
                            ctx.textBaseline = 'middle';
                            const pageLabel = `${customLabel ? `${customLabel} — ` : ''}PAGE ${idx + 1} / ${loadedImages.length} • ${scanItem.studentName || student?.firstName || 'Élève'} (${new Date(scanItem.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
                            ctx.fillText(pageLabel, 24, currentY + headerHeight / 2);
                            currentY += headerHeight;
                            ctx.save();
                            ctx.translate(0, currentY + height);
                            ctx.rotate(-Math.PI / 2);
                            ctx.drawImage(img, 0, 0, height, maxWidth);
                            ctx.restore();
                            currentY += height + spacing;
                        });

                        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
                        if (!blob) throw new Error("Échec assemblage des pages");
                        return blob;
                    })();
                    await navigator.clipboard.write([
                        new window.ClipboardItem({ 'image/png': combinedBlobPromise }),
                    ]);
                    showToast(`✅ ${targetScans.length} pages assemblées et copiées ! Collez (Ctrl+V) dans votre IA.`);
                } else {
                    showToast("⚠️ Presse-papier direct indisponible sur ce navigateur.");
                }
            }
        } catch (err) {
            console.error("Erreur copie presse-papier:", err);
            showToast("❌ Erreur lors de la copie dans le presse-papier.");
        }
    };

    const handleCopyClassShareLink = async () => {
        if (!scans.length) return;
        showToast(`⏳ Création de la page avec ${scans.length} page(s)...`);
        try {
            const res = await fetch('/api/classroom/scans/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scanIds: scans.map((scan) => scan._id),
                    className: className || student?.currentClass || ''
                })
            });
            const data = await res.json();
            if (!res.ok || !data?.url) throw new Error(data?.error || 'Lien indisponible');
            const promptLines = devoirsList
                .filter((devoir) => devoir.correctionPrompt || devoir.correctionPromptImageUrl)
                .map((devoir) => `${devoir.title} : ${devoir.correctionPrompt || 'utilise l’image d’instructions visible sur la page'}`);
            const instruction = promptLines.length > 0
                ? `Pour chaque copie, transcris puis propose une correction et une note en suivant ces instructions de correction :\n${promptLines.join('\n')}\n\nCopies : ${data.url}`
                : `Pour chaque copie, transcris puis corrige la copie et propose une note.\n\nCopies : ${data.url}`;
            await navigator.clipboard.writeText(instruction);
            showToast('✅ Lien vers toutes les copies copié ! Collez-le dans le chat IA.');
        } catch (error) {
            console.error('Erreur création page IA:', error);
            showToast('❌ Impossible de créer ou copier le lien IA.');
        }
    };

    const openDevoirEditor = (devoir, mode) => {
        setDevoirEditor({
            id: devoir.id,
            mode,
            assignmentName: devoir.title,
            assignmentInstanceId: devoir.assignmentInstanceId,
            createAssignmentInstance: false,
            studentId: String(devoir.scans[0]?.studentId || ''),
            studentName: devoir.studentName || '',
            studentSearch: '',
            correctionPrompt: devoir.correctionPrompt || '',
            promptImage: null
        });
    };

    const saveDevoirMetadata = async (devoir, overrides = {}) => {
        if (!devoirEditor || devoirEditor.id !== devoir.id || devoir.id.startsWith('cluster_')) return;
        const editor = { ...devoirEditor, ...overrides };
        const form = new FormData();
        form.append('assignmentName', editor.assignmentName || devoir.title);
        if (editor.assignmentInstanceId && !String(editor.assignmentInstanceId).startsWith('legacy_')) form.append('assignmentInstanceId', editor.assignmentInstanceId);
        if (editor.createAssignmentInstance) form.append('createAssignmentInstance', 'true');
        if (editor.renameWholeAssignment) form.append('applyNameToAssignmentInstance', 'true');
        form.append('correctionPrompt', editor.correctionPrompt || '');
        if (editor.studentId) {
            form.append('studentId', editor.studentId);
            form.append('studentName', editor.studentName || '');
        }
        if (editor.promptImage) form.append('promptImage', editor.promptImage);
        try {
            const res = await fetch(`/api/classroom/scans/session/${encodeURIComponent(devoir.id)}/meta`, { method: 'POST', body: form });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Enregistrement impossible');
            const replacements = new Map((data.scans || []).map((scan) => [String(scan._id), scan]));
            setScans((prev) => prev.map((scan) => replacements.get(String(scan._id)) || scan));
            setDevoirEditor(null);
            showToast('✅ Informations du devoir enregistrées.');
        } catch (error) {
            console.error('Erreur métadonnées devoir:', error);
            showToast('❌ Impossible d’enregistrer les modifications.');
        }
    };

    const toggleCategoryDropdown = (devoir, e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (categoryDropdownDevoirId === devoir.id) {
            setCategoryDropdownDevoirId(null);
        } else {
            setCategoryDropdownDevoirId(devoir.id);
            setTempCategoryName(devoir.assignmentName || devoir.title);
        }
    };

    const handleRenameCategory = async (devoir, newName) => {
        const trimmed = (newName || '').trim();
        if (!trimmed) return;
        try {
            const form = new FormData();
            form.append('assignmentName', trimmed);
            form.append('applyNameToAssignmentInstance', 'true');
            if (devoir.assignmentInstanceId && !String(devoir.assignmentInstanceId).startsWith('legacy_')) {
                form.append('assignmentInstanceId', devoir.assignmentInstanceId);
            } else {
                form.append('homeworkNumber', String(devoir.homeworkNumber));
            }

            const res = await fetch(`/api/classroom/scans/session/${encodeURIComponent(devoir.id)}/meta`, {
                method: 'POST',
                body: form
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Erreur lors du renommage');
            if (Array.isArray(data.scans)) {
                const replacements = new Map(data.scans.map((scan) => [String(scan._id), scan]));
                setScans((prev) => prev.map((scan) => replacements.get(String(scan._id)) || scan));
            }
            if (Array.isArray(data.knownCategories)) setKnownCategories(data.knownCategories);
            showToast(`✅ Devoir renommé en « ${trimmed} » pour toute la classe.`);
            setCategoryDropdownDevoirId(null);
        } catch (err) {
            console.error('Erreur renommage catégorie:', err);
            showToast('❌ Impossible de renommer le devoir.');
        }
    };

    const handleAssignToCategory = async (devoir, targetCat) => {
        if ((devoir.title || '').trim().toLowerCase() === (targetCat.title || '').trim().toLowerCase()) {
            setCategoryDropdownDevoirId(null);
            return;
        }
        try {
            const form = new FormData();
            if (targetCat.id && !targetCat.id.startsWith('legacy_') && !targetCat.id.startsWith('known_')) {
                form.append('assignmentInstanceId', targetCat.id);
            }
            form.append('homeworkNumber', String(targetCat.homeworkNumber || 1));
            form.append('assignmentName', targetCat.title);

            const res = await fetch(`/api/classroom/scans/session/${encodeURIComponent(devoir.id)}/meta`, {
                method: 'POST',
                body: form
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Erreur lors du rattachement');
            if (Array.isArray(data.scans)) {
                const replacements = new Map(data.scans.map((scan) => [String(scan._id), scan]));
                setScans((prev) => prev.map((scan) => replacements.get(String(scan._id)) || scan));
            }
            if (Array.isArray(data.knownCategories)) setKnownCategories(data.knownCategories);
            showToast(`✅ Copie rattachée à « ${targetCat.title} ».`);
            setCategoryDropdownDevoirId(null);
        } catch (err) {
            console.error('Erreur rattachement catégorie:', err);
            showToast('❌ Impossible d’associer le devoir.');
        }
    };

    const handleCreateNewAssignment = async (devoir) => {
        try {
            const form = new FormData();
            form.append('createAssignmentInstance', 'true');

            const res = await fetch(`/api/classroom/scans/session/${encodeURIComponent(devoir.id)}/meta`, {
                method: 'POST',
                body: form
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Erreur création devoir');
            if (Array.isArray(data.scans)) {
                const replacements = new Map(data.scans.map((scan) => [String(scan._id), scan]));
                setScans((prev) => prev.map((scan) => replacements.get(String(scan._id)) || scan));
            }
            if (Array.isArray(data.knownCategories)) setKnownCategories(data.knownCategories);
            showToast('✅ Nouveau devoir créé avec succès.');
            setCategoryDropdownDevoirId(null);
        } catch (err) {
            console.error('Erreur création devoir:', err);
            showToast('❌ Impossible de créer le nouveau devoir.');
        }
    };

    const handleDeleteCategory = async (cat) => {
        if (!cat) return;
        const confirmMsg = cat.count > 0
            ? `Supprimer le devoir « ${cat.title} » ?\n\nToutes les copies (${cat.count}) de cette catégorie passeront à la catégorie « none ».`
            : `Supprimer la catégorie « ${cat.title} » (0 copie) ?`;
        if (!window.confirm(confirmMsg)) return;

        try {
            const res = await fetch('/api/classroom/scans/assignment/reset-to-none', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    classId: classId || (scans[0]?.classId ? String(scans[0].classId) : ''),
                    assignmentInstanceId: cat.id,
                    homeworkNumber: cat.homeworkNumber,
                    title: cat.title
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Erreur lors de la suppression');
            if (Array.isArray(data.scans)) {
                const replacements = new Map(data.scans.map((scan) => [String(scan._id), scan]));
                setScans((prev) => prev.map((scan) => replacements.get(String(scan._id)) || scan));
            }
            if (Array.isArray(data.knownCategories)) {
                setKnownCategories(data.knownCategories);
            } else {
                setKnownCategories((prev) => prev.filter((c) => c.title?.toLowerCase() !== cat.title?.toLowerCase()));
            }
            showToast(`🗑️ Devoir « ${cat.title} » supprimé.`);
            setCategoryDropdownDevoirId(null);
        } catch (err) {
            console.error('Erreur suppression catégorie:', err);
            showToast('❌ Impossible de supprimer la catégorie.');
        }
    };

    useEffect(() => {
        if (!categoryDropdownDevoirId) return;
        const handleClickOutside = (e) => {
            if (!e.target.closest('.devoir-category-dropdown') && !e.target.closest('.devoir-folder-title-btn')) {
                setCategoryDropdownDevoirId(null);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setCategoryDropdownDevoirId(null);
        };
        document.addEventListener('pointerdown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [categoryDropdownDevoirId]);

    // Navigation plein écran
    const allScansInOrder = useMemo(() => {
        return devoirsList.flatMap((d) => d.scans);
    }, [devoirsList]);

    const currentFullscreenIndex = fullscreenScan ? allScansInOrder.findIndex((s) => s._id === fullscreenScan._id) : -1;
    const handleNextFullscreen = () => {
        if (currentFullscreenIndex >= 0 && currentFullscreenIndex < allScansInOrder.length - 1) {
            setFullscreenScan(allScansInOrder[currentFullscreenIndex + 1]);
        }
    };
    const handlePrevFullscreen = () => {
        if (currentFullscreenIndex > 0) {
            setFullscreenScan(allScansInOrder[currentFullscreenIndex - 1]);
        }
    };

    useEffect(() => {
        if (!fullscreenScan) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setFullscreenScan(null);
            else if (e.key === 'ArrowRight') handleNextFullscreen();
            else if (e.key === 'ArrowLeft') handlePrevFullscreen();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [fullscreenScan, currentFullscreenIndex, allScansInOrder]);

    if (!isOpen) return null;

    return (
        <div className="conda-scan-modal-overlay">
            <div className="conda-scan-gallery-card" onClick={(e) => e.stopPropagation()}>
                {/* Bouton fermeture permanent et proéminent (toujours visible sur mobile) */}
                <button
                    className="conda-scan-sticky-close-btn"
                    onClick={onClose}
                    title="Fermer la fenêtre (Échap)"
                    aria-label="Fermer"
                >
                    ✕
                </button>

                {/* Entête de la galerie */}
                <div className="conda-scan-modal-header">
                    <div className="conda-scan-title-group">
                        <span className="conda-scan-header-icon">📁</span>
                        <div className="conda-scan-title-text">
                            <h3 className="conda-scan-modal-title">
                                {filterMode === 'student' && student
                                    ? `Devoirs : ${student.firstName} ${student.lastName}`
                                    : `Devoirs de la classe ${className || ''}`}
                            </h3>
                            <span className="conda-scan-modal-subtitle">
                                {devoirsList.length} devoir{devoirsList.length > 1 ? 's' : ''} ({scans.length} page{scans.length > 1 ? 's' : ''}) • Regroupés par session
                            </span>
                        </div>
                    </div>

                    <div className="conda-scan-header-actions">
                        {student && (
                            <div className="conda-scan-filter-pills">
                                <button
                                    className={`pill-btn ${filterMode === 'student' ? 'active' : ''}`}
                                    onClick={() => setFilterMode('student')}
                                >
                                    Élève
                                </button>
                                <button
                                    className={`pill-btn ${filterMode === 'class' ? 'active' : ''}`}
                                    onClick={() => setFilterMode('class')}
                                >
                                    Classe
                                </button>
                            </div>
                        )}

                        {onOpenCapture && (
                            <button
                                className="conda-scan-tool-btn highlight"
                                onClick={() => { onClose(); onOpenCapture(); }}
                                title="Scanner un nouveau devoir (vidéo)"
                            >
                                📷 Scanner
                            </button>
                        )}
                    </div>
                </div>

                {/* Barre globale d'actions */}
                <div className="conda-scan-gallery-toolbar">
                    <div className="toolbar-left">
                        {scans.length > 0 && (
                            <>
                                <button className="conda-scan-btn-small" onClick={handleSelectAll}>
                                    {selectedScanIds.length === scans.length ? 'Désélectionner tout' : 'Tout sélectionner'}
                                </button>
                                {selectedScanIds.length > 0 && (
                                    <span className="selection-badge">
                                        {selectedScanIds.length} page(s) cochée(s)
                                    </span>
                                )}
                            </>
                        )}
                    </div>

                    <div className="toolbar-right">
                        {filterMode === 'class' && scans.length > 0 && (
                            <button
                                className="conda-scan-btn-copy-ai"
                                onClick={handleCopyClassShareLink}
                                title="Créer une page partageable contenant toutes les copies de la classe"
                            >
                                🔗 LIEN IA — TOUTES LES COPIES
                            </button>
                        )}
                        {selectedScanIds.length > 0 && (
                            <button
                                className="conda-scan-btn-copy-ai"
                                onClick={() => handleCopyScansForAi(scans.filter((s) => selectedScanIds.includes(s._id)), 'SÉLECTION')}
                                title="Copier les pages sélectionnées assemblées pour l'IA"
                            >
                                📋 COPIER LA SÉLECTION ({selectedScanIds.length} PAGES)
                            </button>
                        )}
                    </div>
                </div>

                {/* Toast de confirmation de copie */}
                {copyingStatus && (
                    <div className="conda-scan-toast">
                        {copyingStatus}
                    </div>
                )}

                {/* Liste des dossiers de Devoirs */}
                <div className="conda-scan-grid-wrapper custom-scrollbar">
                    {loading ? (
                        <div className="conda-scan-empty-state">
                            <div className="conda-scan-spinner" />
                            <p>Chargement des devoirs...</p>
                        </div>
                    ) : devoirsList.length === 0 ? (
                        <div className="conda-scan-empty-state">
                            <span className="empty-icon">📁</span>
                            <h4>Aucun devoir scanné pour le moment</h4>
                            <p>Prenez en photo une ou plusieurs pages d'une copie avec le bouton <strong>Scanner</strong>.</p>
                            {onOpenCapture && (
                                <button
                                    className="conda-scan-action-btn primary"
                                    onClick={() => { onClose(); onOpenCapture(); }}
                                >
                                    📷 Scanner une copie maintenant
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="conda-devoirs-container">
                            {devoirsList.map((devoir) => {
                                const isCollapsed = collapsedDevoirs[devoir.id] === true;
                                const formattedDate = new Date(devoir.date).toLocaleDateString('fr-FR', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                });
                                const devoirScanIds = devoir.scans.map((s) => s._id);
                                const allInDevoirSelected = devoirScanIds.every((id) => selectedScanIds.includes(id));

                                const isDropdownOpen = categoryDropdownDevoirId === devoir.id;

                                return (
                                    <div key={devoir.id} className={`conda-devoir-folder-card ${isDropdownOpen ? 'has-dropdown-open' : ''}`}>
                                        {/* En-tête du dossier Devoir */}
                                        <div
                                            className="devoir-folder-header"
                                            onClick={() => toggleDevoirCollapse(devoir.id)}
                                        >
                                            <div className="devoir-folder-left">
                                                <span className="devoir-folder-icon">📂</span>
                                                <div className="devoir-folder-meta">
                                                    <div className="devoir-folder-title-row">
                                                        <div className="devoir-title-dropdown-container" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                type="button"
                                                                className={`devoir-folder-title-btn ${isDropdownOpen ? 'active' : ''}`}
                                                                onClick={(e) => toggleCategoryDropdown(devoir, e)}
                                                                title="Cliquer pour changer de devoir, créer un nouveau devoir ou renommer"
                                                            >
                                                                <span className="devoir-folder-title-text">{devoir.title}</span>
                                                                <span className="devoir-title-chevron">{isDropdownOpen ? '▲' : '▼'}</span>
                                                            </button>

                                                            {isDropdownOpen && (
                                                                <div className="devoir-category-dropdown" onClick={(e) => e.stopPropagation()}>
                                                                    {/* 1. Renommer cette catégorie */}
                                                                    <div className="dropdown-section">
                                                                        <div className="dropdown-section-title">
                                                                            <span>🏷️ Nom du devoir (toute la classe)</span>
                                                                        </div>
                                                                        <form
                                                                            onSubmit={(e) => {
                                                                                e.preventDefault();
                                                                                void handleRenameCategory(devoir, tempCategoryName);
                                                                            }}
                                                                            className="dropdown-rename-form"
                                                                        >
                                                                            <input
                                                                                type="text"
                                                                                className="dropdown-input"
                                                                                value={tempCategoryName}
                                                                                onChange={(e) => setTempCategoryName(e.target.value)}
                                                                                placeholder="Nom du devoir..."
                                                                                autoFocus
                                                                            />
                                                                            <button
                                                                                type="submit"
                                                                                className="dropdown-save-btn"
                                                                                title="Appliquer à toutes les copies de cette catégorie"
                                                                            >
                                                                                Enregistrer
                                                                            </button>
                                                                        </form>
                                                                        <div className="dropdown-caption">
                                                                            Modifie le nom de toutes les copies de cette catégorie.
                                                                        </div>
                                                                    </div>

                                                                    {/* 2. Devoirs existants */}
                                                                    {assignmentCategories.length > 0 && (
                                                                        <div className="dropdown-section">
                                                                            <div className="dropdown-section-title">
                                                                                <span>📁 Devoirs existants dans la classe</span>
                                                                            </div>
                                                                            <div className="dropdown-categories-list custom-scrollbar">
                                                                                {assignmentCategories.map((cat) => {
                                                                                    const isCurrent = String(devoir.title || '').trim().toLowerCase() === String(cat.title || '').trim().toLowerCase();
                                                                                    return (
                                                                                        <div key={cat.id} className="dropdown-cat-row">
                                                                                            <button
                                                                                                type="button"
                                                                                                className={`dropdown-cat-btn ${isCurrent ? 'current' : ''}`}
                                                                                                onClick={() => handleAssignToCategory(devoir, cat)}
                                                                                                title={isCurrent ? 'Devoir actuel' : `Associer cette copie à ${cat.title}`}
                                                                                            >
                                                                                                <div className="dropdown-cat-info">
                                                                                                    <span className="dropdown-cat-icon">{isCurrent ? '✓' : '•'}</span>
                                                                                                    <span className="dropdown-cat-name">{cat.title}</span>
                                                                                                </div>
                                                                                                <span className="dropdown-cat-count">
                                                                                                    {cat.count} copie{cat.count > 1 ? 's' : ''}
                                                                                                </span>
                                                                                            </button>
                                                                                            {cat.title.toLowerCase() !== 'none' && (
                                                                                                <button
                                                                                                    type="button"
                                                                                                    className="dropdown-cat-delete-btn"
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        void handleDeleteCategory(cat);
                                                                                                    }}
                                                                                                    title={`Supprimer le devoir « ${cat.title} » (passe en « none »)`}
                                                                                                    aria-label={`Supprimer ${cat.title}`}
                                                                                                >
                                                                                                    ✕
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* 3. Nouveau devoir */}
                                                                    <div className="dropdown-footer">
                                                                        <button
                                                                            type="button"
                                                                            className="dropdown-new-assignment-btn"
                                                                            onClick={() => handleCreateNewAssignment(devoir)}
                                                                        >
                                                                            <span>➕</span>
                                                                            <span>Nouveau devoir</span>
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <span className="devoir-pages-count">
                                                            {devoir.scans.length} page{devoir.scans.length > 1 ? 's' : ''}
                                                        </span>
                                                        {filterMode === 'class' && devoir.studentName && (
                                                            <button type="button" className="devoir-student-chip transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800" onClick={(e) => { e.stopPropagation(); openDevoirEditor(devoir, 'student'); }} title="Changer l’élève">{devoir.studentName}</button>
                                                        )}
                                                    </div>
                                                    <span className="devoir-folder-date">Scanné le {formattedDate}</span>
                                                </div>
                                            </div>

                                            {/* Boutons d'action du devoir */}
                                            <div className="devoir-folder-actions" onClick={(e) => e.stopPropagation()}>
                                                <button className={`rounded-xl border-2 px-3 py-2 text-sm font-black transition ${devoir.correctionPrompt || devoir.correctionPromptImageUrl ? 'border-amber-400 bg-amber-100 text-amber-900' : 'border-slate-200 bg-white text-slate-700 hover:border-amber-400 hover:bg-amber-50'}`} onClick={() => openDevoirEditor(devoir, 'prompt')} title="Ajouter les instructions de correction">{devoir.correctionPrompt || devoir.correctionPromptImageUrl ? '✓ Prompt' : '+ Prompt'}</button>
                                                {/* Bouton dédié pour copier ce devoir pour l'IA */}
                                                <button
                                                    className="btn-devoir-copy-ai"
                                                    onClick={() => handleCopyScansForAi(devoir.scans, devoir.title)}
                                                    title={`Copier toutes les pages du ${devoir.title} pour les coller dans une IA`}
                                                >
                                                    📋 COPIER POUR L'IA ({devoir.scans.length}P)
                                                </button>

                                                <button
                                                    className="devoir-btn-icon"
                                                    onClick={(e) => toggleSelectDevoir(devoir, e)}
                                                    title={allInDevoirSelected ? 'Tout décocher' : 'Tout cocher dans ce devoir'}
                                                >
                                                    {allInDevoirSelected ? '☑️' : '☐'}
                                                </button>

                                                <button
                                                    className="devoir-btn-icon delete"
                                                    onClick={(e) => handleDeleteDevoir(devoir, e)}
                                                    title="Supprimer tout ce devoir"
                                                >
                                                    🗑️
                                                </button>

                                                <button
                                                    className="devoir-btn-toggle"
                                                    onClick={() => toggleDevoirCollapse(devoir.id)}
                                                    title={isCollapsed ? 'Déplier' : 'Replier'}
                                                >
                                                    {isCollapsed ? '▼' : '▲'}
                                                </button>
                                            </div>
                                        </div>

                                        {devoirEditor?.id === devoir.id && devoirEditor.mode !== 'name' && (
                                            <div className="m-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4" onClick={(e) => e.stopPropagation()}>
                                                {devoirEditor.mode === 'student' && (
                                                    <div>
                                                        <label className="block font-black text-slate-700">Rechercher un élève
                                                            <input className="mt-2 w-full rounded-xl border-2 border-slate-200 bg-white p-3" value={devoirEditor.studentSearch} onChange={(e) => setDevoirEditor((prev) => ({ ...prev, studentSearch: e.target.value }))} placeholder="Tape le prénom ou le nom…" autoFocus />
                                                        </label>
                                                        <div className="mt-3 max-h-52 overflow-auto rounded-xl border bg-white p-2">
                                                            {students
                                                                .filter((item) => `${item.firstName || ''} ${item.lastName || ''}`.toLowerCase().includes(devoirEditor.studentSearch.toLowerCase()))
                                                                .map((item) => {
                                                                    const itemId = String(item._id || item.id || '');
                                                                    const fullName = `${item.firstName || ''} ${item.lastName || ''}`.trim();
                                                                    return <button key={itemId} type="button" onClick={() => { setDevoirEditor((prev) => ({ ...prev, studentId: itemId, studentName: fullName })); void saveDevoirMetadata(devoir, { studentId: itemId, studentName: fullName }); }} className={`mb-1 block w-full rounded-lg px-3 py-2 text-left font-bold ${devoirEditor.studentId === itemId ? 'bg-emerald-500 text-white' : 'hover:bg-slate-100'}`}>{fullName}</button>;
                                                                })}
                                                        </div>
                                                    </div>
                                                )}
                                                {devoirEditor.mode === 'prompt' && (
                                                    <div>
                                                        <label className="block font-black text-slate-700">Instructions de correction
                                                            <textarea className="mt-2 min-h-32 w-full rounded-xl border-2 border-slate-200 bg-white p-3" value={devoirEditor.correctionPrompt} onChange={(e) => setDevoirEditor((prev) => ({ ...prev, correctionPrompt: e.target.value }))} placeholder="Colle ici le barème ou les consignes pour l’IA…" autoFocus />
                                                        </label>
                                                        <label className="mt-3 block font-bold text-slate-600">Ou ajouter une image du sujet/barème
                                                            <input type="file" accept="image/*" className="mt-2 block w-full rounded-xl bg-white p-3" onChange={(e) => setDevoirEditor((prev) => ({ ...prev, promptImage: e.target.files?.[0] || null }))} />
                                                        </label>
                                                        {devoir.correctionPromptImageUrl && <div className="mt-2 text-sm font-bold text-emerald-700">✓ Une image d’instructions est déjà enregistrée.</div>}
                                                    </div>
                                                )}
                                                <div className="mt-4 flex justify-end gap-2">
                                                    <button type="button" className="rounded-xl bg-slate-200 px-4 py-2 font-black" onClick={() => setDevoirEditor(null)}>Annuler</button>
                                                    <button type="button" className="rounded-xl bg-emerald-600 px-4 py-2 font-black text-white" onClick={() => saveDevoirMetadata(devoir)}>Enregistrer</button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Contenu : Pages du Devoir */}
                                        {!isCollapsed && (
                                            <div className="devoir-folder-body">
                                                <div className="devoir-pages-grid">
                                                    {devoir.scans.map((scan, pIdx) => {
                                                        const isSelected = selectedScanIds.includes(scan._id);
                                                        const pageNum = scan.pageIndex || pIdx + 1;
                                                        return (
                                                            <div
                                                                key={scan._id}
                                                                className={`conda-scan-card page-card ${isSelected ? 'selected' : ''}`}
                                                                onClick={() => setFullscreenScan(scan)}
                                                            >
                                                                {/* Badge numéro de page */}
                                                                <div className="page-badge-chip">
                                                                    Page {pageNum}
                                                                </div>

                                                                {/* Case à cocher */}
                                                                <div
                                                                    className={`card-select-checkbox ${isSelected ? 'checked' : ''}`}
                                                                    onClick={(e) => toggleSelectScan(scan._id, e)}
                                                                    title="Sélectionner cette page"
                                                                >
                                                                    {isSelected ? '✓' : ''}
                                                                </div>

                                                                {/* Image de la page */}
                                                                <div className="card-image-wrap">
                                                                    <img src={scan.imageUrl} alt={`Page ${pageNum}`} loading="lazy" />
                                                                    <div className="card-zoom-hint">🔍 Plein écran</div>
                                                                </div>

                                                                {/* Pied de page miniature */}
                                                                <div className="card-meta-bar">
                                                                    <span className="card-date-tag">Page {pageNum}</span>
                                                                    <div className="card-quick-actions" onClick={(e) => e.stopPropagation()}>
                                                                        <button
                                                                            className="card-quick-btn copy"
                                                                            onClick={() => handleCopyScansForAi([scan], `${devoir.title} — Page ${pageNum}`)}
                                                                            title="Copier cette seule page pour l'IA"
                                                                        >
                                                                            📋
                                                                        </button>
                                                                        <button
                                                                            className="card-quick-btn delete"
                                                                            onClick={(e) => handleDeleteScan(scan._id, e)}
                                                                            title="Supprimer cette page"
                                                                        >
                                                                            🗑️
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ========================================================== */}
            {/* 🔎 MODAL PLEIN ÉCRAN (LIGHTBOX)                           */}
            {/* ========================================================== */}
            {fullscreenScan && (
                <div
                    className="conda-scan-fullscreen-overlay"
                    onClick={(e) => { if (e.target === e.currentTarget) setFullscreenScan(null); }}
                >
                    {/* Bouton fermeture toujours visible en haut à droite du plein écran */}
                    <button
                        className="fs-sticky-close-btn"
                        onClick={() => setFullscreenScan(null)}
                        title="Fermer le plein écran (Échap)"
                        aria-label="Fermer"
                    >
                        ✕
                    </button>

                    <div className="conda-scan-fullscreen-topbar">
                        <div className="fs-title-wrap">
                            <span className="fs-title">
                                {fullscreenScan.studentName || student?.firstName || 'Scan'} • Page {fullscreenScan.pageIndex || 1}
                            </span>
                            <span className="fs-index">
                                ({currentFullscreenIndex + 1} / {allScansInOrder.length})
                            </span>
                        </div>

                        <div className="fs-actions">
                            <button
                                className="conda-scan-btn-copy-ai fs-copy-btn"
                                onClick={() => handleCopyScansForAi([fullscreenScan], `Page ${fullscreenScan.pageIndex || 1}`)}
                                title="Copier cette page dans le presse-papier"
                            >
                                📋 COPIER POUR L'IA
                            </button>
                            <a
                                href={fullscreenScan.imageUrl}
                                download={`devoir_page_${Date.now()}.jpg`}
                                className="fs-icon-btn"
                                title="Télécharger l'image"
                            >
                                ⬇️
                            </a>
                            <button
                                className="fs-icon-btn delete"
                                onClick={(e) => handleDeleteScan(fullscreenScan._id, e)}
                                title="Supprimer cette page"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>

                    {/* Image plein écran */}
                    <div className="conda-scan-fullscreen-view">
                        {currentFullscreenIndex > 0 && (
                            <button className="fs-nav-btn prev" onClick={handlePrevFullscreen} title="Précédente (Flèche gauche)">
                                ‹
                            </button>
                        )}
                        <img
                            src={fullscreenScan.imageUrl}
                            alt="Plein écran"
                            className="conda-scan-fullscreen-img"
                        />
                        {currentFullscreenIndex < allScansInOrder.length - 1 && (
                            <button className="fs-nav-btn next" onClick={handleNextFullscreen} title="Suivante (Flèche droite)">
                                ›
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
