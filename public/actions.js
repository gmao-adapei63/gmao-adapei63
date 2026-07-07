// ═════════════════════════════════════════════════════════════════
// MODULE ACTIONS (V1) — moteur transversal GMAO Tactical
// ═════════════════════════════════════════════════════════════════
// Une Action est l'objet unique qui représente une note, une check-list
// ou une mission : toutes utilisent exactement ce même moteur (mêmes
// données, même modale, même moteur de tri/recherche/impression).
//
// Ce fichier est volontairement autonome (aucune dépendance obligatoire
// vers procedures.js/search.js au moment du chargement des scripts) :
// toute intégration avec le reste de l'application se fait via des
// fonctions déjà exposées globalement par app.js (appState, saveData,
// showAlarmToast, compressImageToDataURL, generateUUID, switchTab,
// activateFirstTab, closeModal) et est appelée uniquement au moment de
// l'interaction utilisateur, jamais à l'exécution du script lui-même.
// ═════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// CONSTANTES DU MODÈLE
// ─────────────────────────────────────────────────────────────────
const ACTION_PRIORITIES     = ['critique','haute','normale','faible'];
const ACTION_PRIORITY_ORDER = {critique:0, haute:1, normale:2, faible:3};
const ACTION_PRIORITY_LABELS = {
    critique: '🔴 Critique', haute: '🟠 Haute', normale: '🟡 Normale', faible: '🟢 Faible'
};
const ACTION_STATES = ['todo','inprogress','postponed','suspended','waiting','done','cancelled','archived'];
const ACTION_STATE_LABELS = {
    todo: 'À faire', inprogress: 'En cours', postponed: 'Reportée', suspended: 'Suspendue',
    waiting: 'En attente', done: 'Terminée', cancelled: 'Annulée', archived: 'Archivée'
};
const ACTION_CLOSED_STATES = ['done','cancelled','archived'];

function isActionClosedState(state){ return ACTION_CLOSED_STATES.indexOf(state) !== -1; }

// ─────────────────────────────────────────────────────────────────
// ÉTAT LOCAL DU MODULE (non persistant — reconstruit à chaque session)
// ─────────────────────────────────────────────────────────────────
let actionDraft            = null;   // copie de travail éditée dans la modale (annulable)
let editingActionId         = null;   // id de l'Action en cours d'édition (null = création)
let actionsSelectMode       = false;  // sélection multiple active dans la liste
let actionsSelectedIds      = new Set();
let __actionsSearchProviderRegistered = false;

// ─────────────────────────────────────────────────────────────────
// VALEURS PAR DEFAUT DE L'ÉTAT — appelé depuis ensureStateDefaults() (app.js)
// ─────────────────────────────────────────────────────────────────
const ActionsEngine = {
    ensureDefaults(){
        if(!appState.actions)       appState.actions = [];
        if(!appState.actionsTrash)  appState.actionsTrash = [];
        if(typeof appState.actionSeq !== 'number') appState.actionSeq = 0;
        registerActionsSearchProvider();
    }
};
window.ActionsEngine = ActionsEngine;

function registerActionsSearchProvider(){
    if(__actionsSearchProviderRegistered) return;
    if(!window.registerSearchProvider) return; // recherche globale pas encore chargée : réessaiera au prochain ensureDefaults()
    window.registerSearchProvider('actions', function(){
        return (appState.actions||[]).map(a => ({
            type: 'action', icon: a.pinned ? '📌' : '🎯',
            category: 'Actions',
            id: a.id,
            title: a.title || '(Action sans titre)',
            summary: (ACTION_STATE_LABELS[a.state]||a.state) + (a.dueDate ? ' · échéance ' + a.dueDate : ''),
            text: a.description || '',
            location: 'Module Actions',
            open(){ openActionsModule(); openActionEditor(a.id); }
        }));
    });
    __actionsSearchProviderRegistered = true;
}

// ─────────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────────
function escapeActionHtml(s){
    return (s==null?'':String(s))
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function nextActionId(){
    appState.actionSeq = (appState.actionSeq||0) + 1;
    return 'ACT-' + String(appState.actionSeq).padStart(6,'0');
}
function getAction(id){
    return (appState.actions||[]).find(a=>a.id===id) || null;
}
function createActionObject(overrides){
    const now = new Date().toISOString();
    const base = {
        id: nextActionId(),
        kind: 'action',            // 'action' générique — les futures Notes/Check-lists/Missions réutilisent ce même modèle
        checked: false,
        title: '',
        description: '',
        priority: 'normale',
        dueDate: null,
        dueTime: null,
        attachments: [],
        state: 'todo',
        pinned: false,
        postponements: [],
        history: [{date: now, type: 'creation', detail: 'Action créée'}],
        createdAt: now,
        updatedAt: now,
        completedAt: null,
    };
    return Object.assign(base, overrides||{});
}
function pushActionHistory(action, type, detail){
    if(!action.history) action.history = [];
    action.history.push({date: new Date().toISOString(), type, detail});
}
function setActionState(action, newState, opts){
    opts = opts || {};
    const oldState = action.state;
    if(oldState === newState && !opts.force) return;
    action.state = newState;
    action.checked = (newState === 'done');
    action.completedAt = (newState === 'done') ? new Date().toISOString() : null;
    if(!opts.silent){
        pushActionHistory(action, 'state', (ACTION_STATE_LABELS[oldState]||oldState) + ' → ' + (ACTION_STATE_LABELS[newState]||newState));
    }
}

// Persiste l'état (localStorage + sync GitHub/Firebase déjà gérés par saveData())
// et rafraîchit tout l'affichage dépendant du module Actions.
function persistActionsChange(){
    saveData();
    updateActionsBadge();
    if(hasClass('actions-overlay','active')) renderActionsList();
}

// ─────────────────────────────────────────────────────────────────
// TRI — épinglées > priorité > échéance la plus proche > date de création
//       (les Actions terminées/annulées/archivées passent toujours en fin de liste)
// ─────────────────────────────────────────────────────────────────
function compareActions(a, b){
    const aClosed = isActionClosedState(a.state), bClosed = isActionClosedState(b.state);
    if(aClosed !== bClosed) return aClosed ? 1 : -1;
    if(!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    const pDiff = (ACTION_PRIORITY_ORDER[a.priority] ?? 2) - (ACTION_PRIORITY_ORDER[b.priority] ?? 2);
    if(pDiff !== 0) return pDiff;
    const aDue = a.dueDate ? (a.dueDate + 'T' + (a.dueTime||'23:59')) : null;
    const bDue = b.dueDate ? (b.dueDate + 'T' + (b.dueTime||'23:59')) : null;
    if(aDue && bDue && aDue !== bDue) return aDue < bDue ? -1 : 1;
    if(aDue && !bDue) return -1;
    if(!aDue && bDue) return 1;
    return (a.createdAt||'') < (b.createdAt||'') ? -1 : 1;
}

// ─────────────────────────────────────────────────────────────────
// BADGE (bouton flottant + tuile d'accueil)
// ─────────────────────────────────────────────────────────────────
function updateActionsBadge(){
    const openCount = (appState.actions||[]).filter(a=>!isActionClosedState(a.state)).length;
    const fabBadge = document.getElementById('actions-fab-badge');
    if(fabBadge){
        if(openCount > 0){
            fabBadge.style.display = 'flex';
            fabBadge.textContent = openCount > 99 ? '99+' : String(openCount);
        } else {
            fabBadge.style.display = 'none';
        }
    }
    const tile = document.getElementById('tile-actions');
    if(tile) tile.textContent = String(openCount);
}

// ─────────────────────────────────────────────────────────────────
// BOUTON FLOTTANT — déplaçable verticalement uniquement, aimanté aux
// bords gauche/droit, jamais au-dessus du Header ni de la Navbar.
// Appui court = ouvre le module. Appui long = nouvelle Action immédiate.
// ─────────────────────────────────────────────────────────────────
const FAB_POS_KEY = 'gmao_actions_fab_pos';
const FAB_LONG_PRESS_MS = 550;
const FAB_DRAG_THRESHOLD = 10;

function getFabVerticalBounds(){
    const header = document.querySelector('.header');
    const nav    = document.getElementById('bottom-nav');
    const headerH = header ? header.getBoundingClientRect().height : 60;
    const navH    = nav && nav.getBoundingClientRect().height ? nav.getBoundingClientRect().height : 60;
    return { top: headerH + 10, bottom: window.innerHeight - navH - 10 };
}
function applyFabPosition(fab, side, ratio){
    const bounds = getFabVerticalBounds();
    const h = fab.offsetHeight || 56;
    const range = Math.max(1, (bounds.bottom - bounds.top - h));
    const top = bounds.top + Math.min(1, Math.max(0, ratio)) * range;
    fab.style.top = top + 'px';
    fab.style.bottom = 'auto';
    fab.style.left  = side === 'left'  ? '12px' : 'auto';
    fab.style.right = side === 'right' ? '12px' : 'auto';
}
function readFabPosition(){
    let pos = {side:'right', ratio:0.35};
    try {
        const stored = JSON.parse(localStorage.getItem(FAB_POS_KEY) || '{}');
        pos = Object.assign(pos, stored);
    } catch(e){ /* valeurs par défaut conservées */ }
    return pos;
}
function saveFabPosition(side, ratio){
    localStorage.setItem(FAB_POS_KEY, JSON.stringify({side, ratio}));
}
function restoreFabPosition(fab){
    const pos = readFabPosition();
    applyFabPosition(fab, pos.side, pos.ratio);
}
function clampFabToViewport(fab){
    const pos = readFabPosition();
    applyFabPosition(fab, pos.side, pos.ratio);
}
function initActionsFab(){
    const fab = document.getElementById('actions-fab');
    if(!fab) return;
    restoreFabPosition(fab);

    let dragging = false, moved = false, startX = 0, startY = 0, startTop = 0, longPressTimer = null;

    fab.addEventListener('pointerdown', function(e){
        dragging = false; moved = false;
        startX = e.clientX; startY = e.clientY;
        startTop = fab.getBoundingClientRect().top;
        try { fab.setPointerCapture(e.pointerId); } catch(err){}
        clearTimeout(longPressTimer);
        longPressTimer = setTimeout(function(){
            if(!moved){
                moved = true; // consomme le geste : ni ouverture ni drag ensuite
                if(navigator.vibrate) navigator.vibrate(30);
                openActionEditor(null);
            }
        }, FAB_LONG_PRESS_MS);
    });

    fab.addEventListener('pointermove', function(e){
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if(!dragging && Math.hypot(dx, dy) > FAB_DRAG_THRESHOLD){
            dragging = true; moved = true;
            clearTimeout(longPressTimer);
            fab.classList.add('dragging');
        }
        if(dragging){
            const bounds = getFabVerticalBounds();
            const h = fab.offsetHeight || 56;
            let newTop = startTop + dy;
            newTop = Math.max(bounds.top, Math.min(bounds.bottom - h, newTop));
            fab.style.top = newTop + 'px';
            fab.style.bottom = 'auto';
            const side = e.clientX > window.innerWidth/2 ? 'right' : 'left';
            fab.style.left  = side === 'left'  ? '12px' : 'auto';
            fab.style.right = side === 'right' ? '12px' : 'auto';
        }
    });

    function endDrag(e){
        clearTimeout(longPressTimer);
        fab.classList.remove('dragging');
        if(dragging){
            const bounds = getFabVerticalBounds();
            const h = fab.offsetHeight || 56;
            const top = parseFloat(fab.style.top) || bounds.top;
            const range = Math.max(1, (bounds.bottom - bounds.top - h));
            const ratio = Math.min(1, Math.max(0, (top - bounds.top) / range));
            const side = e.clientX > window.innerWidth/2 ? 'right' : 'left';
            applyFabPosition(fab, side, ratio); // aimantation finale au bord
            saveFabPosition(side, ratio);
        } else if(!moved){
            openActionsModule();
        }
        dragging = false; moved = false;
    }
    fab.addEventListener('pointerup', endDrag);
    fab.addEventListener('pointercancel', function(e){ clearTimeout(longPressTimer); fab.classList.remove('dragging'); dragging=false; moved=false; });

    window.addEventListener('resize', function(){ clampFabToViewport(fab); });
    window.addEventListener('orientationchange', function(){ setTimeout(function(){ clampFabToViewport(fab); }, 300); });
}

// ─────────────────────────────────────────────────────────────────
// OUVERTURE / FERMETURE DU MODULE (liste plein écran)
// ─────────────────────────────────────────────────────────────────
function openActionsModule(){
    safeAddClass('actions-overlay','active');
    const fab = document.getElementById('actions-fab');
    if(fab) fab.style.display = 'none';
    exitActionsSelectMode();
    renderActionsList();
}
function closeActionsModule(){
    safeRemoveClass('actions-overlay','active');
    const fab = document.getElementById('actions-fab');
    if(fab) fab.style.display = 'flex';
}

// ─────────────────────────────────────────────────────────────────
// FILTRES & RECHERCHE
// ─────────────────────────────────────────────────────────────────
function toggleActionsFilterPanel(){
    const panel = document.getElementById('actions-filter-panel');
    const btn = document.getElementById('actions-filter-toggle');
    if(!panel) return;
    const show = panel.style.display === 'none';
    panel.style.display = show ? 'grid' : 'none';
    if(btn) btn.classList.toggle('active', show);
}
function resetActionsFilters(){
    document.getElementById('actions-filter-state').value = '';
    document.getElementById('actions-filter-priority').value = '';
    document.getElementById('actions-filter-due').value = '';
    document.getElementById('actions-filter-attach').value = '';
    document.getElementById('actions-search-input').value = '';
    renderActionsList();
}
function normalizeActionSearch(str){
    return (str||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
function actionMatchesDueFilter(action, filter){
    if(!filter) return true;
    if(filter === 'none') return !action.dueDate;
    if(!action.dueDate) return false;
    const today = new Date().toISOString().split('T')[0];
    if(filter === 'today') return action.dueDate === today;
    if(filter === 'overdue') return action.dueDate < today && !isActionClosedState(action.state);
    if(filter === 'week'){
        const d = new Date(today+'T00:00:00');
        const in7 = new Date(d.getTime() + 7*24*3600*1000).toISOString().split('T')[0];
        return action.dueDate >= today && action.dueDate <= in7;
    }
    return true;
}
function getFilteredSortedActions(){
    const q       = normalizeActionSearch(document.getElementById('actions-search-input').value);
    const stateF  = document.getElementById('actions-filter-state').value;
    const prioF   = document.getElementById('actions-filter-priority').value;
    const dueF    = document.getElementById('actions-filter-due').value;
    const attachF = document.getElementById('actions-filter-attach').value;

    let list = (appState.actions||[]).slice();
    if(stateF)  list = list.filter(a=>a.state === stateF);
    if(prioF)   list = list.filter(a=>a.priority === prioF);
    if(dueF)    list = list.filter(a=>actionMatchesDueFilter(a, dueF));
    if(attachF === 'yes') list = list.filter(a=>(a.attachments||[]).length > 0);
    if(attachF === 'no')  list = list.filter(a=>(a.attachments||[]).length === 0);
    if(q){
        list = list.filter(a=>{
            const hay = normalizeActionSearch([a.title, a.description, a.id].filter(Boolean).join(' '));
            return hay.indexOf(q) !== -1;
        });
    }
    list.sort(compareActions);
    return list;
}

// ─────────────────────────────────────────────────────────────────
// RENDU DE LA LISTE
// ─────────────────────────────────────────────────────────────────
function dueBadgeInfo(action){
    if(!action.dueDate) return null;
    const today = new Date().toISOString().split('T')[0];
    const label = action.dueDate + (action.dueTime ? ' ' + action.dueTime : '');
    if(action.dueDate < today && !isActionClosedState(action.state)) return {cls:'danger', label:'⏰ '+label};
    if(action.dueDate === today) return {cls:'warning', label:'📅 '+label};
    return {cls:'info', label:'📅 '+label};
}
function renderActionCard(action){
    const closed = isActionClosedState(action.state);
    const suspended = action.state === 'suspended';
    const due = dueBadgeInfo(action);
    const attachCount = (action.attachments||[]).length;
    const reportCount = (action.postponements||[]).length;
    const selected = actionsSelectedIds.has(action.id);
    const priorityBadgeCls = action.priority === 'critique' ? 'critical' : (action.priority==='haute'?'warning':(action.priority==='faible'?'success':'info'));

    return `
    <div class="action-card priority-${action.priority} ${closed?'is-closed':''} ${suspended?'is-suspended':''} ${selected?'is-selected':''}" data-action-id="${action.id}">
        <input type="checkbox" class="action-card-check" ${actionsSelectMode? (selected?'checked':'') : (action.checked?'checked':'')}
               onclick="event.stopPropagation(); ${actionsSelectMode ? `toggleActionSelected('${action.id}')` : `quickToggleActionDone('${action.id}')`}">
        <div class="action-card-body" onclick="${actionsSelectMode ? `toggleActionSelected('${action.id}')` : `openActionEditor('${action.id}')`}">
            <div class="action-card-title-row">
                <p class="action-card-title">${escapeActionHtml(action.title || '(Sans titre)')}</p>
                ${action.pinned ? `<span class="action-card-pin" onclick="event.stopPropagation();toggleActionPinQuick('${action.id}')" title="Épinglée">📌</span>` : ''}
            </div>
            ${action.description ? `<p class="action-card-desc">${escapeActionHtml(action.description)}</p>` : ''}
            <div class="action-card-badges">
                <span class="badge ${priorityBadgeCls}">${ACTION_PRIORITY_LABELS[action.priority]||action.priority}</span>
                <span class="badge">${ACTION_STATE_LABELS[action.state]||action.state}</span>
                ${due ? `<span class="badge ${due.cls}">${due.label}</span>` : ''}
                ${attachCount ? `<span class="badge info">📎 ${attachCount}</span>` : ''}
                ${reportCount ? `<span class="badge warning">🔁 ${reportCount}</span>` : ''}
            </div>
            <div class="action-card-id">${action.id}</div>
        </div>
    </div>`;
}
function renderActionsList(){
    const container = document.getElementById('actions-list-container');
    if(!container) return;
    const list = getFilteredSortedActions();
    container.innerHTML = list.length
        ? list.map(renderActionCard).join('')
        : `<div class="actions-empty">Aucune Action pour le moment.<br>Utilisez « ➕ Nouvelle Action » ou l'appui long sur le bouton flottant.</div>`;
}
function quickToggleActionDone(id){
    const action = getAction(id);
    if(!action) return;
    setActionState(action, action.state === 'done' ? 'todo' : 'done');
    action.updatedAt = new Date().toISOString();
    persistActionsChange();
}
function toggleActionPinQuick(id){
    const action = getAction(id);
    if(!action) return;
    action.pinned = !action.pinned;
    pushActionHistory(action, 'pin', action.pinned ? 'Action épinglée' : 'Action désépinglée');
    action.updatedAt = new Date().toISOString();
    persistActionsChange();
}

// ─────────────────────────────────────────────────────────────────
// SÉLECTION MULTIPLE + ACTIONS GROUPÉES
// ─────────────────────────────────────────────────────────────────
function toggleActionsSelectMode(){
    actionsSelectMode = !actionsSelectMode;
    if(!actionsSelectMode) actionsSelectedIds.clear();
    safeToggleClass('actions-select-toggle','active', actionsSelectMode);
    safeStyle('actions-bulk-toolbar','display', actionsSelectMode ? 'flex' : 'none');
    renderActionsList();
}
function exitActionsSelectMode(){
    actionsSelectMode = false;
    actionsSelectedIds.clear();
    const toggle = document.getElementById('actions-select-toggle');
    if(toggle) toggle.classList.remove('active');
    const toolbar = document.getElementById('actions-bulk-toolbar');
    if(toolbar) toolbar.style.display = 'none';
}
function toggleActionSelected(id){
    if(actionsSelectedIds.has(id)) actionsSelectedIds.delete(id);
    else actionsSelectedIds.add(id);
    safeContent('actions-bulk-count', actionsSelectedIds.size + ' sélectionnée(s)');
    renderActionsList();
}
function getSelectedActionObjects(){
    return (appState.actions||[]).filter(a=>actionsSelectedIds.has(a.id));
}
function bulkChangeState(){
    if(!actionsSelectedIds.size) return;
    const options = ACTION_STATES.map(s=>ACTION_STATE_LABELS[s]).join(' / ');
    const input = prompt('Nouvel état pour la sélection :\n'+options, 'À faire');
    if(!input) return;
    const match = ACTION_STATES.find(s=>ACTION_STATE_LABELS[s].toLowerCase() === input.trim().toLowerCase());
    if(!match){ showAlarmToast('⚠️','État inconnu','Veuillez saisir exactement un des libellés proposés.','warning',5000); return; }
    getSelectedActionObjects().forEach(a=>{ setActionState(a, match); a.updatedAt = new Date().toISOString(); });
    persistActionsChange();
}
function bulkChangePriority(){
    if(!actionsSelectedIds.size) return;
    const input = prompt('Nouvelle priorité pour la sélection : critique / haute / normale / faible', 'normale');
    if(!input || ACTION_PRIORITIES.indexOf(input.trim().toLowerCase()) === -1){
        if(input) showAlarmToast('⚠️','Priorité inconnue','Utilisez : critique, haute, normale ou faible.','warning',5000);
        return;
    }
    const p = input.trim().toLowerCase();
    getSelectedActionObjects().forEach(a=>{
        pushActionHistory(a, 'priority', 'Priorité → ' + ACTION_PRIORITY_LABELS[p]);
        a.priority = p; a.updatedAt = new Date().toISOString();
    });
    persistActionsChange();
}
function bulkChangeDue(){
    if(!actionsSelectedIds.size) return;
    const date = prompt('Nouvelle échéance (AAAA-MM-JJ), vide = supprimer l\'échéance :', '');
    if(date === null) return;
    getSelectedActionObjects().forEach(a=>{
        pushActionHistory(a, 'due', 'Échéance groupée → ' + (date || 'aucune'));
        a.dueDate = date || null; a.updatedAt = new Date().toISOString();
    });
    persistActionsChange();
}
function bulkArchive(){
    if(!actionsSelectedIds.size) return;
    getSelectedActionObjects().forEach(a=>{ setActionState(a, 'archived'); a.updatedAt = new Date().toISOString(); });
    persistActionsChange();
    showAlarmToast('🗄️','Archivage','Sélection archivée.','success',4000);
}
function bulkDelete(){
    if(!actionsSelectedIds.size) return;
    if(!confirm(actionsSelectedIds.size + ' Action(s) vont être placées dans la corbeille. Confirmer ?')) return;
    getSelectedActionObjects().forEach(a=>moveActionToTrash(a.id, true));
    exitActionsSelectMode();
    persistActionsChange();
}
function bulkPrint(){
    if(!actionsSelectedIds.size) return;
    printActionsHtml(getSelectedActionObjects());
}

// ─────────────────────────────────────────────────────────────────
// CAPTURE RAPIDE — chaque photo crée automatiquement sa propre Action
// ─────────────────────────────────────────────────────────────────
function quickCaptureFromPhotos(fileList){
    const files = Array.prototype.slice.call(fileList||[]);
    if(!files.length) return;
    let done = 0;
    files.forEach(file=>{
        compressImageToDataURL(file, 1600, 0.72).then(dataUrl=>{
            const action = createActionObject({
                title: 'Photo — ' + new Date().toLocaleString('fr-FR'),
                attachments: [{ id: generateUUID(), type:'photo', name:file.name, mime:file.type||'image/jpeg', dataUrl, addedAt: new Date().toISOString() }]
            });
            appState.actions.push(action);
            done++;
            if(done === files.length){ persistActionsChange(); showAlarmToast('📷','Capture rapide', done+' Action(s) créée(s) à partir des photos.','success',4000); }
        }).catch(err=>{
            showAlarmToast('⚠️','Erreur photo', err.message || 'Impossible de traiter cette image.', 'warning', 5000);
        });
    });
    document.getElementById('actions-photo-input').value = '';
    document.getElementById('actions-import-input').value = '';
}

// ─────────────────────────────────────────────────────────────────
// ÉDITEUR D'ACTION (modale)
// ─────────────────────────────────────────────────────────────────
function populateActionEditorForm(a){
    safeContent('action-modal-title', editingActionId ? ('Action ' + a.id) : 'Nouvelle Action');
    document.getElementById('action-checked-box').checked = !!a.checked;
    document.getElementById('action-title').value = a.title || '';
    document.getElementById('action-description').value = a.description || '';
    document.getElementById('action-priority').value = a.priority || 'normale';
    document.getElementById('action-state').value = a.state || 'todo';
    document.getElementById('action-due-date').value = a.dueDate || '';
    document.getElementById('action-due-time').value = a.dueTime || '';
    safeToggleClass('action-pin-btn','active', !!a.pinned);
    safeStyle('action-delete-btn','display', editingActionId ? '' : 'none');
    safeStyle('action-archive-btn','display', editingActionId ? '' : 'none');
    safeContent('action-archive-btn', a.state === 'archived' ? '📤 Désarchiver' : '🗄️ Archiver');
    updateActionSuspendButtonLabel();
    updateActionReportBox();
    renderActionAttachmentsList();
    renderActionHistoryList();
}
function updateActionReportBox(){
    const box = document.getElementById('action-report-box');
    if(box) box.style.display = editingActionId ? 'flex' : 'none';
    const count = (actionDraft.postponements||[]).length;
    const countEl = document.getElementById('action-report-count');
    if(!countEl) return;
    if(count){
        const last = actionDraft.postponements[count-1];
        countEl.textContent = count + ' report(s) — dernier : ' + (last.oldDue||'—') + ' → ' + (last.newDue||'—') + (last.reason ? (' ('+last.reason+')') : '');
    } else {
        countEl.textContent = 'Aucun report pour le moment.';
    }
}
function updateActionSuspendButtonLabel(){
    const btn = document.getElementById('action-suspend-btn');
    if(!btn) return;
    btn.textContent = actionDraft.state === 'suspended' ? '▶️ Reprendre' : '⏸️ Suspendre';
}
function openActionEditor(id){
    editingActionId = id || null;
    if(id){
        const orig = getAction(id);
        if(!orig){ showAlarmToast('⚠️','Introuvable','Cette Action n\'existe plus.','warning',4000); return; }
        actionDraft = JSON.parse(JSON.stringify(orig));
    } else {
        actionDraft = createActionObject({});
    }
    populateActionEditorForm(actionDraft);
    if(window.activateFirstTab) activateFirstTab('actionEditorModal');
    safeAddClass('actionEditorModal','active');
}
function closeActionEditor(){
    safeRemoveClass('actionEditorModal','active');
    actionDraft = null;
    editingActionId = null;
}
function readActionEditorFormIntoDraft(){
    actionDraft.title       = document.getElementById('action-title').value.trim();
    actionDraft.description = document.getElementById('action-description').value.trim();
    actionDraft.priority    = document.getElementById('action-priority').value;
    actionDraft.dueDate     = document.getElementById('action-due-date').value || null;
    actionDraft.dueTime     = document.getElementById('action-due-time').value || null;
    // L'état est déjà tenu à jour en direct par onActionStateSelectChange()/onActionCheckboxToggle()
}
function saveCurrentAction(){
    if(!actionDraft) return;
    readActionEditorFormIntoDraft();
    if(!actionDraft.title){
        showAlarmToast('⚠️','Titre requis','Merci de donner un titre à cette Action.','warning',4000);
        return;
    }
    actionDraft.updatedAt = new Date().toISOString();
    if(editingActionId){
        const idx = (appState.actions||[]).findIndex(a=>a.id===editingActionId);
        if(idx > -1){
            pushActionHistory(actionDraft, 'update', 'Modification enregistrée');
            appState.actions[idx] = actionDraft;
        }
    } else {
        appState.actions.push(actionDraft);
    }
    persistActionsChange();
    closeActionEditor();
}
function duplicateCurrentAction(){
    if(!actionDraft) return;
    readActionEditorFormIntoDraft();
    const now = new Date().toISOString();
    const copy = JSON.parse(JSON.stringify(actionDraft));
    copy.id = nextActionId();
    copy.createdAt = now; copy.updatedAt = now;
    copy.history = [{date: now, type:'creation', detail:'Dupliquée depuis ' + (editingActionId||actionDraft.id)}];
    copy.postponements = [];
    appState.actions.push(copy);
    persistActionsChange();
    closeActionEditor();
    showAlarmToast('📄','Action dupliquée', copy.id + ' créée.', 'success', 4000);
}
function archiveCurrentAction(){
    if(!actionDraft || !editingActionId) return;
    readActionEditorFormIntoDraft();
    setActionState(actionDraft, actionDraft.state === 'archived' ? 'todo' : 'archived');
    saveCurrentAction();
}
function deleteCurrentAction(){
    if(!editingActionId) { closeActionEditor(); return; }
    if(!confirm('Placer cette Action dans la corbeille ?')) return;
    moveActionToTrash(editingActionId, true);
    persistActionsChange();
    closeActionEditor();
}
function onActionCheckboxToggle(){
    const checked = document.getElementById('action-checked-box').checked;
    setActionState(actionDraft, checked ? 'done' : 'todo');
    document.getElementById('action-state').value = actionDraft.state;
    updateActionSuspendButtonLabel();
    updateActionReportBox();
}
function onActionStateSelectChange(){
    const val = document.getElementById('action-state').value;
    setActionState(actionDraft, val);
    document.getElementById('action-checked-box').checked = !!actionDraft.checked;
    updateActionSuspendButtonLabel();
    updateActionReportBox();
}
function toggleActionPin(){
    actionDraft.pinned = !actionDraft.pinned;
    pushActionHistory(actionDraft, 'pin', actionDraft.pinned ? 'Action épinglée' : 'Action désépinglée');
    safeToggleClass('action-pin-btn','active', actionDraft.pinned);
}
function toggleActionSuspend(){
    if(actionDraft.state === 'suspended'){
        const restore = actionDraft._preSuspendState || 'todo';
        setActionState(actionDraft, restore);
        delete actionDraft._preSuspendState;
        pushActionHistory(actionDraft, 'resume', 'Action reprise');
    } else {
        actionDraft._preSuspendState = actionDraft.state;
        setActionState(actionDraft, 'suspended');
        pushActionHistory(actionDraft, 'suspend', 'Action suspendue');
    }
    document.getElementById('action-state').value = actionDraft.state;
    document.getElementById('action-checked-box').checked = !!actionDraft.checked;
    updateActionSuspendButtonLabel();
}

// ─────────────────────────────────────────────────────────────────
// REPORT D'ÉCHÉANCE
// ─────────────────────────────────────────────────────────────────
function openPostponeDialog(){
    const oldDue = actionDraft.dueDate ? (actionDraft.dueDate + (actionDraft.dueTime?(' '+actionDraft.dueTime):'')) : 'aucune échéance actuelle';
    safeContent('action-postpone-old', 'Échéance actuelle : ' + oldDue);
    document.getElementById('postpone-new-date').value = actionDraft.dueDate || '';
    document.getElementById('postpone-new-time').value = actionDraft.dueTime || '';
    document.getElementById('postpone-reason').value = '';
    safeAddClass('actionPostponeModal','active');
}
function confirmPostpone(){
    const newDate = document.getElementById('postpone-new-date').value;
    const newTime = document.getElementById('postpone-new-time').value;
    const reason  = document.getElementById('postpone-reason').value.trim();
    if(!newDate){ showAlarmToast('⚠️','Date requise','Merci de choisir une nouvelle date.','warning',4000); return; }
    const oldDue = actionDraft.dueDate ? (actionDraft.dueDate + (actionDraft.dueTime?(' '+actionDraft.dueTime):'')) : null;
    const newDue = newDate + (newTime?(' '+newTime):'');
    if(!actionDraft.postponements) actionDraft.postponements = [];
    actionDraft.postponements.push({ oldDue, newDue, date: new Date().toISOString(), reason: reason||null });
    actionDraft.dueDate = newDate;
    actionDraft.dueTime = newTime || null;
    setActionState(actionDraft, 'postponed');
    pushActionHistory(actionDraft, 'postpone', 'Report : ' + (oldDue||'—') + ' → ' + newDue + (reason?(' ('+reason+')'):''));
    document.getElementById('action-due-date').value = actionDraft.dueDate;
    document.getElementById('action-due-time').value = actionDraft.dueTime || '';
    document.getElementById('action-state').value = actionDraft.state;
    document.getElementById('action-checked-box').checked = false;
    updateActionSuspendButtonLabel();
    updateActionReportBox();
    closeModal('actionPostponeModal');
}

// ─────────────────────────────────────────────────────────────────
// PIÈCES JOINTES
// ─────────────────────────────────────────────────────────────────
function readActionFileAsDataURL(file){
    return new Promise((resolve, reject)=>{
        const reader = new FileReader();
        reader.onerror = ()=>reject(new Error('Lecture du fichier impossible'));
        reader.onload  = ()=>resolve(reader.result);
        reader.readAsDataURL(file);
    });
}
function addActionAttachments(fileList){
    const files = Array.prototype.slice.call(fileList||[]);
    files.forEach(file=>{
        const isImage = (file.type||'').startsWith('image/');
        const handler = isImage ? compressImageToDataURL(file, 1600, 0.75) : readActionFileAsDataURL(file);
        handler.then(dataUrl=>{
            if(!isImage && file.size > 3*1024*1024){
                showAlarmToast('⚠️','Fichier volumineux', file.name + ' (' + (file.size/1024/1024).toFixed(1) + ' Mo) — la synchronisation peut être plus lente.', 'warning', 5000);
            }
            actionDraft.attachments.push({
                id: generateUUID(), type: isImage ? 'photo' : 'file', name: file.name,
                mime: file.type || 'application/octet-stream', size: file.size, dataUrl, addedAt: new Date().toISOString()
            });
            pushActionHistory(actionDraft, 'attachment', 'Pièce jointe ajoutée : ' + file.name);
            renderActionAttachmentsList();
        }).catch(err=>{
            showAlarmToast('⚠️','Erreur pièce jointe', err.message || 'Fichier illisible.', 'warning', 5000);
        });
    });
    document.getElementById('action-attach-photo').value = '';
    document.getElementById('action-attach-file').value = '';
}
function addActionLink(){
    const url = prompt('URL du lien à ajouter :', 'https://');
    if(!url || !url.trim()) return;
    const label = prompt('Titre du lien (facultatif) :', url) || url;
    actionDraft.attachments.push({ id: generateUUID(), type:'link', name:label, url:url.trim(), addedAt: new Date().toISOString() });
    pushActionHistory(actionDraft, 'attachment', 'Lien ajouté : ' + label);
    renderActionAttachmentsList();
}
function openScannerForAction(){
    // Saisie manuelle du contenu scanné (QR code / code-barres) : conservée en pièce jointe,
    // sans dépendre du scanner de navigation existant (réservé au routage intelligent des missions).
    const value = prompt('Collez ou saisissez le contenu du QR Code / code-barres :', '');
    if(!value || !value.trim()) return;
    const label = prompt('Nom de cette pièce jointe (facultatif) :', 'QR / Code-barres') || 'QR / Code-barres';
    actionDraft.attachments.push({ id: generateUUID(), type:'qr', name:label, url:value.trim(), addedAt: new Date().toISOString() });
    pushActionHistory(actionDraft, 'attachment', 'QR/Code-barres ajouté : ' + label);
    renderActionAttachmentsList();
}
function removeActionAttachment(id){
    actionDraft.attachments = actionDraft.attachments.filter(a=>a.id!==id);
    pushActionHistory(actionDraft, 'attachment', 'Pièce jointe supprimée');
    renderActionAttachmentsList();
}
function renderActionAttachmentCard(a){
    const isImage = a.type === 'photo';
    const isLinkLike = a.type === 'link' || a.type === 'qr';
    const sizeKb = a.size ? (a.size/1024).toFixed(0)+' Ko' : '';
    let thumb;
    if(isImage) thumb = `<img src="${a.dataUrl}" class="proc-attachment-thumb" onclick="window.open('${a.dataUrl}','_blank')">`;
    else if(isLinkLike) thumb = `<div class="proc-attachment-icon" onclick="window.open('${a.url}','_blank')">${a.type==='qr'?'🔳':'🔗'}</div>`;
    else thumb = `<div class="proc-attachment-icon" onclick="window.open('${a.dataUrl}','_blank')">📄</div>`;
    return `
    <div class="proc-attachment-card">
        ${thumb}
        <div class="proc-attachment-name" title="${escapeActionHtml(a.name)}">${escapeActionHtml(a.name)}</div>
        <div class="proc-attachment-size">${sizeKb}</div>
        <button type="button" class="btn-icon" onclick="removeActionAttachment('${a.id}')" title="Supprimer">🗑️</button>
    </div>`;
}
function renderActionAttachmentsList(){
    const el = document.getElementById('action-attachments-list');
    if(!el) return;
    el.innerHTML = (actionDraft.attachments||[]).length
        ? actionDraft.attachments.map(renderActionAttachmentCard).join('')
        : `<p style="color:var(--text-muted)">Aucune pièce jointe.</p>`;
}

// ─────────────────────────────────────────────────────────────────
// HISTORIQUE (lecture seule)
// ─────────────────────────────────────────────────────────────────
function renderActionHistoryList(){
    const el = document.getElementById('action-history-list');
    if(!el) return;
    const h = actionDraft.history || [];
    el.innerHTML = h.length
        ? h.slice().reverse().map(x=>`
            <div class="action-history-entry">
                <span class="ahe-date">${new Date(x.date).toLocaleString('fr-FR')}</span>
                ${escapeActionHtml(x.detail||x.type)}
            </div>`).join('')
        : `<p style="color:var(--text-muted)">Aucun historique pour le moment.</p>`;
}

// ─────────────────────────────────────────────────────────────────
// CORBEILLE (restaurable)
// ─────────────────────────────────────────────────────────────────
function moveActionToTrash(id, alreadyRemovingFromSelection){
    const idx = (appState.actions||[]).findIndex(a=>a.id===id);
    if(idx === -1) return;
    const action = appState.actions[idx];
    action._deletedAt = new Date().toISOString();
    appState.actions.splice(idx, 1);
    appState.actionsTrash.push(action);
    if(alreadyRemovingFromSelection) actionsSelectedIds.delete(id);
}
function restoreActionFromTrash(id){
    const idx = (appState.actionsTrash||[]).findIndex(a=>a.id===id);
    if(idx === -1) return;
    const action = appState.actionsTrash[idx];
    delete action._deletedAt;
    pushActionHistory(action, 'restore', 'Action restaurée depuis la corbeille');
    appState.actionsTrash.splice(idx, 1);
    appState.actions.push(action);
    persistActionsChange();
    renderActionsTrashList();
}
function permanentlyDeleteAction(id){
    if(!confirm('Supprimer définitivement cette Action ? Cette opération est irréversible.')) return;
    appState.actionsTrash = (appState.actionsTrash||[]).filter(a=>a.id!==id);
    persistActionsChange();
    renderActionsTrashList();
}
function emptyActionsTrash(){
    if(!(appState.actionsTrash||[]).length) return;
    if(!confirm('Vider définitivement la corbeille (' + appState.actionsTrash.length + ' Action(s)) ?')) return;
    appState.actionsTrash = [];
    persistActionsChange();
    renderActionsTrashList();
}
function renderActionsTrashList(){
    const el = document.getElementById('actions-trash-list');
    if(!el) return;
    const list = (appState.actionsTrash||[]).slice().sort((a,b)=> (b._deletedAt||'').localeCompare(a._deletedAt||''));
    el.innerHTML = list.length ? list.map(a=>`
        <div class="action-trash-item">
            <div>
                <div class="action-trash-item-title">${escapeActionHtml(a.title||'(Sans titre)')}</div>
                <div class="action-trash-item-sub">${a.id} · supprimée le ${a._deletedAt ? new Date(a._deletedAt).toLocaleString('fr-FR') : '—'}</div>
            </div>
            <div style="display:flex;gap:6px">
                <button class="btn-icon" onclick="restoreActionFromTrash('${a.id}')" title="Restaurer">♻️</button>
                <button class="btn-icon" onclick="permanentlyDeleteAction('${a.id}')" title="Supprimer définitivement">🗑️</button>
            </div>
        </div>`).join('') : `<p style="color:var(--text-muted)">La corbeille est vide.</p>`;
}
function openActionsTrash(){
    renderActionsTrashList();
    safeAddClass('actionsTrashModal','active');
}

// ─────────────────────────────────────────────────────────────────
// IMPRESSION — réutilise le même gabarit d'impression que les procédures
// (fond blanc forcé, zone dédiée invisible à l'écran).
// ─────────────────────────────────────────────────────────────────
function buildActionPrintBlock(a){
    const due = a.dueDate ? (a.dueDate + (a.dueTime ? (' '+a.dueTime) : '')) : 'aucune';
    const attachImgs = (a.attachments||[]).filter(x=>x.type==='photo').map(x=>`<img class="act-print-img" src="${x.dataUrl}">`).join('');
    return `
    <div class="act-print-item pri-${a.priority}">
        <div class="act-print-title">${escapeActionHtml(a.title||'(Sans titre)')} <small>(${a.id})</small></div>
        <div class="act-print-meta">${ACTION_PRIORITY_LABELS[a.priority]||a.priority} · ${ACTION_STATE_LABELS[a.state]||a.state} · Échéance : ${due}</div>
        ${a.description ? `<div class="act-print-desc">${escapeActionHtml(a.description)}</div>` : ''}
        ${attachImgs}
    </div>`;
}
function printActionsHtml(list){
    if(!list.length){ showAlarmToast('⚠️','Rien à imprimer','Aucune Action sélectionnée.','warning',4000); return; }
    const html = `<h1>🎯 Actions — GMAO Tactical</h1>` + list.slice().sort(compareActions).map(buildActionPrintBlock).join('');
    safeHTML('actions-print-area', html);
    window.print();
}
function printActionsList(){
    printActionsHtml(getFilteredSortedActions());
}
function printSingleAction(id){
    const a = getAction(id);
    if(!a) return;
    printActionsHtml([a]);
}

// ─────────────────────────────────────────────────────────────────
// INITIALISATION
// ─────────────────────────────────────────────────────────────────
window.addEventListener('load', function(){
    // À ce stade appState est déjà chargé (loadData() s'exécute dans le
    // gestionnaire 'load' enregistré plus tôt par app.js).
    initActionsFab();
    updateActionsBadge();
});
