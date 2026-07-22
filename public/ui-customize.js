// ═════════════════════════════════════════════════════════════════
// PERSONNALISATION DE L'INTERFACE (V1)
// ═════════════════════════════════════════════════════════════════
// Trois systèmes indépendants, tous persistés localement (par appareil,
// jamais synchronisés — ce sont des préférences d'affichage, pas des
// données métier) :
//   1. Réglages généraux : échelle, tailles, densité → variables CSS,
//      appliqués instantanément sans rechargement.
//   2. Tuiles de l'accueil : entièrement paramétrables (créer, dupliquer,
//      supprimer, réordonner, redimensionner, recolorer, changer l'action).
//   3. Icônes personnalisées : remplacement par image (header, bouton
//      flottant, navbar), avec recadrage/zoom/déplacement.
// ═════════════════════════════════════════════════════════════════

const UIC_PREFS_KEY   = 'gmao_ui_prefs';
const UIC_TILES_KEY   = 'gmao_tiles_config';
const UIC_GRID_KEY    = 'gmao_tiles_grid';
const UIC_ICONS_KEY   = 'gmao_icon_overrides';
const UIC_CORE_TILE_IDS = ['completed','pending','agents','alerts','actions'];

const UIC_DEFAULT_PREFS = { scale:1, btnMult:1, cardMult:1, textMult:1, iconMult:1, gapMult:1, density:'normal' };
const UIC_DEFAULT_GRID  = { columns:'adaptive', widthMode:'adaptive' };
const UIC_DEFAULT_TILES = [
    {id:'completed', title:'Complétées', icon:'✅', iconImg:null, color:'#10b981', action:{type:'bound',target:'completed'}, width:'auto', height:100, radius:8, locked:false, visible:true, order:0},
    {id:'pending',   title:'En Cours',   icon:'⏳', iconImg:null, color:'#f59e0b', action:{type:'bound',target:'pending'},   width:'auto', height:100, radius:8, locked:false, visible:true, order:1},
    {id:'agents',    title:'Agents',     icon:'👥', iconImg:null, color:'#3b82f6', action:{type:'bound',target:'agents'},    width:'auto', height:100, radius:8, locked:false, visible:true, order:2},
    {id:'alerts',    title:'Alertes',    icon:'🚨', iconImg:null, color:'#ef4444', action:{type:'bound',target:'alerts'},    width:'auto', height:100, radius:8, locked:false, visible:true, order:3},
    {id:'actions',   title:'Actions',    icon:'🎯', iconImg:null, color:'#3b82f6', action:{type:'bound',target:'actions'},   width:'auto', height:100, radius:8, locked:false, visible:true, order:4},
];

let editingTileId          = null;
let tileEditorPendingIconImg = undefined; // undefined = inchangé, null = retiré, dataURL = nouvelle image
let homeEditMode           = false;
let uicTileDrag            = { el:null, id:null, active:false, longPressTimer:null };

// ─────────────────────────────────────────────────────────────────
// PERSISTANCE (localStorage — préférences locales à l'appareil)
// ─────────────────────────────────────────────────────────────────
function uicLoad(key, fallback){
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(fallback)); }
    catch(e){ return JSON.parse(JSON.stringify(fallback)); }
}
function uicSave(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

function loadUiPrefs(){ return Object.assign({}, UIC_DEFAULT_PREFS, uicLoad(UIC_PREFS_KEY, UIC_DEFAULT_PREFS)); }
function saveUiPrefs(p){ uicSave(UIC_PREFS_KEY, p); }
function loadTilesGrid(){ return Object.assign({}, UIC_DEFAULT_GRID, uicLoad(UIC_GRID_KEY, UIC_DEFAULT_GRID)); }
function saveTilesGrid(g){ uicSave(UIC_GRID_KEY, g); }
function loadTilesConfig(){
    const stored = uicLoad(UIC_TILES_KEY, null);
    if(!stored || !Array.isArray(stored) || !stored.length) return JSON.parse(JSON.stringify(UIC_DEFAULT_TILES));
    return stored;
}
function saveTilesConfig(list){ uicSave(UIC_TILES_KEY, list); }
function loadIconOverrides(){ return uicLoad(UIC_ICONS_KEY, {}); }
function saveIconOverrides(map){ uicSave(UIC_ICONS_KEY, map); }

// ─────────────────────────────────────────────────────────────────
// RÉGLAGES GÉNÉRAUX — application instantanée via variables CSS
// ─────────────────────────────────────────────────────────────────
function applyUiPrefs(prefs){
    const root = document.documentElement.style;
    root.setProperty('--ui-scale',    prefs.scale);
    root.setProperty('--ui-btn-mult',  prefs.btnMult);
    root.setProperty('--ui-card-mult', prefs.cardMult);
    root.setProperty('--ui-text-mult', prefs.textMult);
    root.setProperty('--ui-icon-mult', prefs.iconMult);
    root.setProperty('--ui-gap-mult',  prefs.gapMult);
}
function onUicSliderChange(key, value){
    const prefs = loadUiPrefs();
    prefs[key] = parseFloat(value);
    saveUiPrefs(prefs);
    applyUiPrefs(prefs);
    const labelEl = document.getElementById('uic-' + (key==='scale'?'scale':key.replace('Mult','')) + '-val');
    if(labelEl) labelEl.textContent = Math.round(prefs[key]*100) + '%';
}
const UIC_DENSITY_PRESETS = {
    compact:     { gapMult:0.6, cardMult:0.85, btnMult:0.85 },
    normal:      { gapMult:1,   cardMult:1,    btnMult:1    },
    comfortable: { gapMult:1.4, cardMult:1.15, btnMult:1.15 }
};
function setUicDensity(mode){
    const prefs = loadUiPrefs();
    Object.assign(prefs, UIC_DENSITY_PRESETS[mode] || {});
    prefs.density = mode;
    saveUiPrefs(prefs);
    applyUiPrefs(prefs);
    syncUicGeneralUI();
}
function resetUicGeneral(){
    saveUiPrefs(JSON.parse(JSON.stringify(UIC_DEFAULT_PREFS)));
    applyUiPrefs(UIC_DEFAULT_PREFS);
    syncUicGeneralUI();
}
function syncUicGeneralUI(){
    const prefs = loadUiPrefs();
    const map = { scale:'uic-scale', btnMult:'uic-btn', cardMult:'uic-card', textMult:'uic-text', iconMult:'uic-icon', gapMult:'uic-gap' };
    Object.entries(map).forEach(([key, id])=>{
        const input = document.getElementById(id);
        const label = document.getElementById(id + '-val');
        if(input) input.value = prefs[key];
        if(label) label.textContent = Math.round(prefs[key]*100) + '%';
    });
    ['compact','normal','comfortable'].forEach(d=>{
        const btn = document.getElementById('uic-density-' + d);
        if(btn) btn.classList.toggle('active', prefs.density === d);
    });
}

// ─────────────────────────────────────────────────────────────────
// OUVERTURE DE LA MODALE DE PERSONNALISATION
// ─────────────────────────────────────────────────────────────────
function openUiCustomizeModal(){
    syncUicGeneralUI();
    const grid = loadTilesGrid();
    document.getElementById('uic-tiles-columns').value = grid.columns;
    document.getElementById('uic-tiles-width-mode').value = grid.widthMode;
    renderTilesManagementList();
    renderIconTargetsGrid();
    safeAddClass('uiCustomizeModal','active');
    if(window.activateFirstTab) activateFirstTab('uiCustomizeModal');
}
function switchUicTab(panelId, btnEl){
    const root = btnEl ? btnEl.closest('.modal-content') : null;
    if(!root) return;
    root.querySelectorAll('.uic-tab-panel').forEach(p=>p.classList.remove('active'));
    root.querySelectorAll('.uic-tab-btn').forEach(b=>b.classList.remove('active'));
    safeAddClass(panelId, 'active');
    if(btnEl) btnEl.classList.add('active');
}

// ─────────────────────────────────────────────────────────────────
// UTILITAIRES COULEUR
// ─────────────────────────────────────────────────────────────────
function uicShade(hex, percent){
    try {
        const n = hex.replace('#','');
        const r = Math.max(0, Math.min(255, parseInt(n.substring(0,2),16) + Math.round(255*percent)));
        const g = Math.max(0, Math.min(255, parseInt(n.substring(2,4),16) + Math.round(255*percent)));
        const b = Math.max(0, Math.min(255, parseInt(n.substring(4,6),16) + Math.round(255*percent)));
        return '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
    } catch(e){ return hex; }
}
function escapeUicHtml(s){
    return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────────────────────────
// RENDU DES TUILES DE L'ACCUEIL
// ─────────────────────────────────────────────────────────────────
function tileActionHandlerString(tile){
    const a = tile.action || {type:'none'};
    if(a.type === 'bound'){
        if(a.target === 'actions') return `openActionsModule()`;
        return `openTileModal('${a.target}')`;
    }
    if(a.type === 'view') return `switchView('${a.target}')`;
    if(a.type === 'url')  return `openExternalLink('${(a.target||'').replace(/'/g,"\\'")}','${escapeUicHtml(tile.label||'').replace(/'/g,"\\'")}')`;
    return '';
}
function renderHomeTiles(){
    const container = document.getElementById('home-tiles');
    if(!container) return;
    const grid = loadTilesGrid();
    const tiles = loadTilesConfig().slice().sort((a,b)=>a.order-b.order);

    container.style.gap = 'calc(12px*var(--ui-gap-mult))';
    if(grid.columns === 'adaptive'){
        container.style.gridTemplateColumns = grid.widthMode === 'fixed'
            ? 'repeat(auto-fit, 150px)'
            : 'repeat(auto-fit, minmax(140px, 1fr))';
    } else {
        container.style.gridTemplateColumns = `repeat(${grid.columns}, 1fr)`;
    }

    const html = tiles.map(tile=>{
        const visible = tile.visible !== false;
        if(!visible && !homeEditMode) return '';
        const bg1 = tile.color || '#0369a1';
        const bg2 = uicShade(bg1, -0.22);
        const colSpan = (tile.width && tile.width !== 'auto') ? `grid-column:span ${tile.width};` : '';
        const style = `background:linear-gradient(135deg,${bg1},${bg2});height:${tile.height||100}px;border-radius:${tile.radius??8}px;${colSpan}`;
        const iconHtml = tile.iconImg
            ? `<img src="${tile.iconImg}" style="width:28px;height:28px;object-fit:contain;margin-bottom:4px">`
            : '';
        const isBoundKnown = tile.action && tile.action.type === 'bound' && UIC_CORE_TILE_IDS.indexOf(tile.action.target) !== -1;
        const valueId = isBoundKnown ? ` id="tile-${tile.action.target}"` : '';
        const clickHandler = homeEditMode ? `openTileEditor('${tile.id}')` : tileActionHandlerString(tile);
        const toolbar = homeEditMode ? `
            <div class="tile-edit-toolbar" onclick="event.stopPropagation()">
                <button onclick="openTileEditor('${tile.id}')" title="Modifier">✏️</button>
                <button onclick="toggleTileVisible('${tile.id}')" title="${visible?'Masquer':'Afficher'}">${visible?'👁️':'🚫'}</button>
                <button onclick="toggleTileLocked('${tile.id}')" title="${tile.locked?'Déverrouiller':'Verrouiller'}">${tile.locked?'🔓':'🔒'}</button>
            </div>` : '';
        return `
        <div class="dashboard-tile ${!visible?'tile-hidden-preview':''} ${tile.locked?'tile-locked':''}" style="${style}"
             data-tile-id="${tile.id}" onclick="${clickHandler}">
            ${toolbar}
            ${iconHtml || `<div style="font-size:1.3rem;margin-bottom:2px">${tile.icon||'🎯'}</div>`}
            <div class="tile-value"${valueId}>${isBoundKnown ? '0' : ''}</div>
            <div class="tile-label">${escapeUicHtml(tile.title)}</div>
        </div>`;
    }).join('');

    container.innerHTML = html + (homeEditMode ? `<button class="tile-add-btn" onclick="openTileEditor(null)" title="Créer une tuile">➕</button>` : '');

    // Réinjecte les valeurs (les nœuds viennent d'être recréés)
    if(window.updateDashboard) updateDashboard();
    if(window.updateActionsBadge) updateActionsBadge();

    if(homeEditMode) attachTileDragHandlers();
}

// ─────────────────────────────────────────────────────────────────
// MODE ÉDITION VISUEL DE L'ACCUEIL
// ─────────────────────────────────────────────────────────────────
function toggleHomeEditMode(){
    homeEditMode = !homeEditMode;
    document.body.classList.toggle('home-edit-mode', homeEditMode);
    safeToggleClass('home-edit-toggle','active', homeEditMode);
    renderHomeTiles();
}
function toggleTileVisible(id){
    const list = loadTilesConfig();
    const t = list.find(x=>x.id===id);
    if(!t) return;
    t.visible = t.visible === false ? true : false;
    saveTilesConfig(list);
    renderHomeTiles();
    renderTilesManagementList();
}
function toggleTileLocked(id){
    const list = loadTilesConfig();
    const t = list.find(x=>x.id===id);
    if(!t) return;
    t.locked = !t.locked;
    saveTilesConfig(list);
    renderHomeTiles();
    renderTilesManagementList();
}
function moveTileOrder(id, dir){
    const list = loadTilesConfig().sort((a,b)=>a.order-b.order);
    const idx = list.findIndex(x=>x.id===id);
    const swapIdx = idx + dir;
    if(idx === -1 || swapIdx < 0 || swapIdx >= list.length) return;
    const tmp = list[idx].order; list[idx].order = list[swapIdx].order; list[swapIdx].order = tmp;
    saveTilesConfig(list);
    renderHomeTiles();
    renderTilesManagementList();
}

// Glisser-déposer tactile des tuiles en mode édition (appui long puis déplacement),
// même technique que le bouton flottant Actions et les cartes de mission.
let uicTileDragListenersBound = false;
function attachTileDragHandlers(){
    document.querySelectorAll('#home-tiles .dashboard-tile').forEach(tile=>{
        tile.addEventListener('pointerdown', function(e){
            if(e.target.closest('.tile-edit-toolbar')) return;
            const id = tile.dataset.tileId;
            clearTimeout(uicTileDrag.longPressTimer);
            uicTileDrag.longPressTimer = setTimeout(()=>{
                uicTileDrag.active = true; uicTileDrag.id = id; uicTileDrag.el = tile;
                tile.classList.add('tile-dragging');
                if(navigator.vibrate) navigator.vibrate(25);
            }, 400);
        });
        ['pointerup','pointercancel','pointerleave'].forEach(ev=>tile.addEventListener(ev, function(){
            clearTimeout(uicTileDrag.longPressTimer);
        }));
    });
    if(uicTileDragListenersBound) return; // les écouteurs globaux ci-dessous ne sont posés qu'une seule fois
    uicTileDragListenersBound = true;
    document.addEventListener('pointermove', function(e){
        if(!uicTileDrag.active) return;
        const under = document.elementFromPoint(e.clientX, e.clientY);
        const targetTile = under && under.closest('.dashboard-tile');
        if(targetTile && targetTile !== uicTileDrag.el && targetTile.dataset.tileId){
            const list = loadTilesConfig().sort((a,b)=>a.order-b.order);
            const fromIdx = list.findIndex(x=>x.id===uicTileDrag.id);
            const toIdx   = list.findIndex(x=>x.id===targetTile.dataset.tileId);
            if(fromIdx>-1 && toIdx>-1 && fromIdx!==toIdx){
                const [moved] = list.splice(fromIdx,1);
                list.splice(toIdx,0,moved);
                list.forEach((t,i)=>t.order=i);
                saveTilesConfig(list);
                renderHomeTiles();
            }
        }
    });
    document.addEventListener('pointerup', function(){
        if(uicTileDrag.active){
            uicTileDrag.active = false; uicTileDrag.id = null; uicTileDrag.el = null;
            renderTilesManagementList();
        }
    });
}

// ─────────────────────────────────────────────────────────────────
// GESTION DES TUILES (liste dans la modale de personnalisation)
// ─────────────────────────────────────────────────────────────────
function onTilesGridSettingChange(){
    saveTilesGrid({
        columns: document.getElementById('uic-tiles-columns').value,
        widthMode: document.getElementById('uic-tiles-width-mode').value
    });
    renderHomeTiles();
}
function renderTilesManagementList(){
    const el = document.getElementById('uic-tiles-list');
    if(!el) return;
    const list = loadTilesConfig().slice().sort((a,b)=>a.order-b.order);
    el.innerHTML = list.map((t,i)=>`
        <div class="uic-tile-row">
            <div class="uic-tile-swatch" style="background:${t.color||'#0369a1'}">${t.iconImg?`<img src="${t.iconImg}" style="width:100%;height:100%;object-fit:contain;border-radius:6px">`:(t.icon||'🎯')}</div>
            <div class="uic-tile-info">
                <div class="uic-tile-title">${escapeUicHtml(t.title)}</div>
                <div class="uic-tile-sub">${t.visible===false?'Masquée · ':''}${t.locked?'🔒 Verrouillée · ':''}${UIC_CORE_TILE_IDS.indexOf(t.id)!==-1?'Compteur intégré':'Personnalisée'}</div>
            </div>
            <div class="uic-tile-actions">
                <button class="btn-icon" onclick="moveTileOrder('${t.id}',-1)" ${i===0?'disabled':''} title="Monter">⬆️</button>
                <button class="btn-icon" onclick="moveTileOrder('${t.id}',1)" ${i===list.length-1?'disabled':''} title="Descendre">⬇️</button>
                <button class="btn-icon" onclick="openTileEditor('${t.id}')" title="Modifier">✏️</button>
            </div>
        </div>`).join('');
}

function openTileEditor(id){
    editingTileId = id;
    tileEditorPendingIconImg = undefined;
    const isCore = id && UIC_CORE_TILE_IDS.indexOf(id) !== -1;
    let tile = { title:'', icon:'🎯', iconImg:null, color:'#0369a1', action:{type:'none'}, width:'auto', height:100, radius:8, locked:false };
    if(id){
        const found = loadTilesConfig().find(x=>x.id===id);
        if(found) tile = found;
    }
    safeContent('tile-editor-title', id ? 'Modifier la tuile' : 'Nouvelle tuile');
    document.getElementById('tile-edit-title').value = tile.title || '';
    document.getElementById('tile-edit-icon').value  = tile.icon || '';
    document.getElementById('tile-edit-color').value = tile.color || '#0369a1';
    document.getElementById('tile-edit-width').value  = tile.width || 'auto';
    document.getElementById('tile-edit-height').value = tile.height || 100;
    document.getElementById('tile-edit-radius').value = tile.radius ?? 8;
    document.getElementById('tile-edit-locked').checked = !!tile.locked;

    const a = tile.action || {type:'none'};
    document.getElementById('tile-edit-action-type').value = a.type || 'none';
    document.getElementById('tile-edit-target-bound').value = a.type==='bound' ? (a.target||'completed') : 'completed';
    document.getElementById('tile-edit-target-view').value  = a.type==='view'  ? (a.target||'home') : 'home';
    document.getElementById('tile-edit-target-url').value   = a.type==='url'   ? (a.target||'') : '';
    onTileActionTypeChange();

    safeStyle('tile-edit-delete-btn','display', (id && !isCore) ? '' : 'none');
    safeStyle('tile-edit-duplicate-btn','display', id ? '' : 'none');

    safeAddClass('tileEditorModal','active');
}
function onTileActionTypeChange(){
    const type = document.getElementById('tile-edit-action-type').value;
    safeStyle('tile-edit-target-bound-wrap','display', type==='bound' ? '' : 'none');
    safeStyle('tile-edit-target-view-wrap','display', type==='view'  ? '' : 'none');
    safeStyle('tile-edit-target-url-wrap','display', type==='url'   ? '' : 'none');
}
function readTileEditorForm(){
    const type = document.getElementById('tile-edit-action-type').value;
    let target = null;
    if(type==='bound') target = document.getElementById('tile-edit-target-bound').value;
    if(type==='view')  target = document.getElementById('tile-edit-target-view').value;
    if(type==='url')   target = document.getElementById('tile-edit-target-url').value.trim();
    return {
        title: document.getElementById('tile-edit-title').value.trim() || 'Sans titre',
        icon: document.getElementById('tile-edit-icon').value.trim() || '🎯',
        color: document.getElementById('tile-edit-color').value,
        action: { type, target },
        width: document.getElementById('tile-edit-width').value,
        height: parseInt(document.getElementById('tile-edit-height').value,10) || 100,
        radius: parseInt(document.getElementById('tile-edit-radius').value,10) || 0,
        locked: document.getElementById('tile-edit-locked').checked
    };
}
function saveTileFromEditor(){
    const form = readTileEditorForm();
    const list = loadTilesConfig();
    if(editingTileId){
        const t = list.find(x=>x.id===editingTileId);
        if(t){
            Object.assign(t, form);
            if(tileEditorPendingIconImg !== undefined) t.iconImg = tileEditorPendingIconImg;
        }
    } else {
        const maxOrder = list.reduce((m,t)=>Math.max(m,t.order||0), -1);
        list.push(Object.assign({ id: 'tile_' + Date.now(), visible:true, order: maxOrder+1, iconImg: tileEditorPendingIconImg || null }, form));
    }
    saveTilesConfig(list);
    renderHomeTiles();
    renderTilesManagementList();
    closeModal('tileEditorModal');
}
function duplicateTileFromEditor(){
    if(!editingTileId) return;
    const list = loadTilesConfig();
    const orig = list.find(x=>x.id===editingTileId);
    if(!orig) return;
    const maxOrder = list.reduce((m,t)=>Math.max(m,t.order||0), -1);
    const copy = JSON.parse(JSON.stringify(orig));
    copy.id = 'tile_' + Date.now();
    copy.title = orig.title + ' (copie)';
    copy.order = maxOrder + 1;
    copy.locked = false;
    list.push(copy);
    saveTilesConfig(list);
    renderHomeTiles();
    renderTilesManagementList();
    closeModal('tileEditorModal');
}
function deleteTileFromEditor(){
    if(!editingTileId) return;
    if(UIC_CORE_TILE_IDS.indexOf(editingTileId) !== -1){
        showAlarmToast('⚠️','Tuile intégrée','Cette tuile est liée à un compteur de l\'application : utilisez « Masquer » plutôt que « Supprimer ».','warning',5000);
        return;
    }
    if(!confirm('Supprimer définitivement cette tuile ?')) return;
    const list = loadTilesConfig().filter(x=>x.id!==editingTileId);
    saveTilesConfig(list);
    renderHomeTiles();
    renderTilesManagementList();
    closeModal('tileEditorModal');
}

// ─────────────────────────────────────────────────────────────────
// ICÔNES PERSONNALISÉES — cibles remplaçables + recadreur
// ─────────────────────────────────────────────────────────────────
function getIconTargetsList(){
    const targets = [
        { key:'header-logo', label:'Logo (en-tête)', defaultIcon:'🛠️' },
        { key:'fab-actions',  label:'Bouton flottant Actions', defaultIcon:'🎯' }
    ];
    (appState.navConfig || []).forEach(btn=>{
        targets.push({ key:'nav:' + btn.id, label:'Navbar — ' + (btn.label||btn.id), defaultIcon: btn.icon });
    });
    return targets;
}
function renderIconTargetsGrid(){
    const el = document.getElementById('uic-icon-targets');
    if(!el) return;
    const overrides = loadIconOverrides();
    el.innerHTML = getIconTargetsList().map(t=>{
        const img = overrides[t.key];
        return `
        <div class="uic-icon-target ${img?'has-override':''}" onclick="openIconCropperFor('${t.key}')">
            <div class="uic-icon-target-preview">${img ? `<img src="${img}">` : t.defaultIcon}</div>
            <div class="uic-icon-target-label">${escapeUicHtml(t.label)}</div>
        </div>`;
    }).join('');
}
function applyIconOverrides(){
    const overrides = loadIconOverrides();
    // Logo d'en-tête
    const slot = document.getElementById('header-logo-slot');
    if(slot){
        if(overrides['header-logo']){ slot.innerHTML = `<img src="${overrides['header-logo']}" style="width:100%;height:100%;object-fit:contain">`; slot.style.display='flex'; }
        else { slot.innerHTML = ''; slot.style.display = 'none'; }
    }
    // Bouton flottant Actions
    const fabIcon = document.querySelector('#actions-fab .actions-fab-icon');
    if(fabIcon){
        if(overrides['fab-actions']) fabIcon.innerHTML = `<img src="${overrides['fab-actions']}" style="width:26px;height:26px;object-fit:contain">`;
        else fabIcon.textContent = '🎯';
    }
    // Boutons de la barre de navigation
    document.querySelectorAll('#bottom-nav .nav-item').forEach(btn=>{
        const id = btn.dataset.id;
        const iconEl = btn.querySelector('.nav-icon');
        if(!iconEl || !id) return;
        const key = 'nav:' + id;
        if(overrides[key]) iconEl.innerHTML = `<img src="${overrides[key]}" style="width:1.2em;height:1.2em;object-fit:contain;vertical-align:middle">`;
        else {
            const btnCfg = (appState.navConfig||[]).find(b=>b.id===id);
            if(btnCfg) iconEl.textContent = btnCfg.icon;
        }
    });
}
function observeNavForIconOverrides(){
    const nav = document.getElementById('bottom-nav');
    if(!nav || !window.MutationObserver) return;
    const obs = new MutationObserver(()=>applyIconOverrides());
    obs.observe(nav, { childList:true });
}

// ── Recadreur d'icône (upload + zoom + déplacement, canvas carré) ──
let iconCropperTarget = null;   // clé de cible ('tile' ou une clé générique)
let iconCropperImg    = null;   // Image() chargée
let iconCropperState  = { zoom:1, x:0, y:0 };
let iconCropperDrag   = null;

function openIconCropperFor(targetKey){
    iconCropperTarget = targetKey;
    iconCropperImg = null;
    iconCropperState = { zoom:1, x:0, y:0 };
    safeStyle('uic-cropper-wrap','display', 'none');
    safeStyle('uic-cropper-zoom-row','display', 'none');
    document.getElementById('icon-cropper-file').value = '';

    // Pré-remplissage si une image existe déjà pour cette cible
    let existing = null;
    if(targetKey === 'tile'){
        if(tileEditorPendingIconImg !== undefined) existing = tileEditorPendingIconImg;
        else if(editingTileId){ const t = loadTilesConfig().find(x=>x.id===editingTileId); existing = t ? t.iconImg : null; }
    } else {
        existing = loadIconOverrides()[targetKey] || null;
    }
    if(existing) loadImageIntoCropper(existing);
    safeAddClass('iconCropperModal','active');
}
function onIconCropperFileChosen(fileList){
    const file = (fileList||[])[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>loadImageIntoCropper(reader.result);
    reader.readAsDataURL(file);
}
function loadImageIntoCropper(dataUrl){
    const img = new Image();
    img.onload = function(){
        iconCropperImg = img;
        iconCropperState = { zoom:1, x:0, y:0 };
        const wrap = document.getElementById('uic-cropper-wrap');
        const el = document.getElementById('uic-cropper-img');
        if(el) el.src = dataUrl;
        if(wrap) wrap.style.display = 'block';
        safeStyle('uic-cropper-zoom-row','display', 'flex');
        document.getElementById('uic-cropper-zoom').value = 1;
        safeContent('uic-cropper-zoom-val', '100%');
        fitCropperImage();
        attachCropperDragHandlers();
    };
    img.src = dataUrl;
}
function fitCropperImage(){
    const wrap = document.getElementById('uic-cropper-wrap');
    const el = document.getElementById('uic-cropper-img');
    if(!wrap || !el) return;
    const size = wrap.clientWidth || 260;
    const scale = Math.max(size / iconCropperImg.width, size / iconCropperImg.height);
    const w = iconCropperImg.width * scale, h = iconCropperImg.height * scale;
    el.style.width = w + 'px'; el.style.height = h + 'px';
    iconCropperState.x = (size - w) / 2;
    iconCropperState.y = (size - h) / 2;
    updateCropperTransform();
}
function updateCropperTransform(){
    const el = document.getElementById('uic-cropper-img');
    if(!el) return;
    el.style.transform = `translate(${iconCropperState.x}px, ${iconCropperState.y}px) scale(${iconCropperState.zoom})`;
    el.style.transformOrigin = 'top left';
}
function onIconCropperZoom(val){
    iconCropperState.zoom = parseFloat(val);
    safeContent('uic-cropper-zoom-val', Math.round(iconCropperState.zoom*100) + '%');
    updateCropperTransform();
}
function attachCropperDragHandlers(){
    const wrap = document.getElementById('uic-cropper-wrap');
    if(!wrap || wrap.dataset.dragBound) return; // évite les doublons d'écouteurs entre ouvertures
    wrap.dataset.dragBound = '1';
    wrap.addEventListener('pointerdown', e=>{
        iconCropperDrag = { startX:e.clientX, startY:e.clientY, origX:iconCropperState.x, origY:iconCropperState.y };
        wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', e=>{
        if(!iconCropperDrag) return;
        iconCropperState.x = iconCropperDrag.origX + (e.clientX - iconCropperDrag.startX);
        iconCropperState.y = iconCropperDrag.origY + (e.clientY - iconCropperDrag.startY);
        updateCropperTransform();
    });
    wrap.addEventListener('pointerup', ()=>{ iconCropperDrag = null; });
    wrap.addEventListener('pointercancel', ()=>{ iconCropperDrag = null; });
}
function confirmIconCropper(){
    if(!iconCropperImg){ closeModal('iconCropperModal'); return; }
    const OUT = 160;
    const canvas = document.createElement('canvas');
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    const wrapEl = document.getElementById('uic-cropper-wrap');
    const wrapSize = wrapEl ? (wrapEl.clientWidth || 260) : 260;
    const el = document.getElementById('uic-cropper-img');
    if(!el) { closeModal('iconCropperModal'); return; }
    const ratio = OUT / wrapSize;
    const w = parseFloat(el.style.width) * iconCropperState.zoom;
    const h = parseFloat(el.style.height) * iconCropperState.zoom;
    // Compense le zoom appliqué autour du coin (transform-origin top left)
    const drawX = iconCropperState.x * ratio;
    const drawY = iconCropperState.y * ratio;
    ctx.drawImage(iconCropperImg, drawX, drawY, w*ratio, h*ratio);
    const dataUrl = canvas.toDataURL('image/png');

    if(iconCropperTarget === 'tile'){
        tileEditorPendingIconImg = dataUrl;
    } else {
        const overrides = loadIconOverrides();
        overrides[iconCropperTarget] = dataUrl;
        saveIconOverrides(overrides);
        applyIconOverrides();
        renderIconTargetsGrid();
    }
    closeModal('iconCropperModal');
}
function resetIconCropperTarget(){
    if(iconCropperTarget === 'tile'){
        tileEditorPendingIconImg = null;
    } else {
        const overrides = loadIconOverrides();
        delete overrides[iconCropperTarget];
        saveIconOverrides(overrides);
        applyIconOverrides();
        renderIconTargetsGrid();
    }
    closeModal('iconCropperModal');
}

// ─────────────────────────────────────────────────────────────────
// EXPORT / IMPORT DE THÈME (réglages + tuiles + icônes personnalisées)
// ─────────────────────────────────────────────────────────────────
function exportUiTheme(){
    const bundle = {
        type: 'gmao-tactical-theme', version: 1,
        uiPrefs: loadUiPrefs(), tilesConfig: loadTilesConfig(), tilesGrid: loadTilesGrid(),
        iconOverrides: loadIconOverrides()
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'gmao-theme.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
}
function importUiTheme(fileList){
    const file = (fileList||[])[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(){
        try {
            const bundle = JSON.parse(reader.result);
            if(bundle.uiPrefs)      saveUiPrefs(Object.assign({}, UIC_DEFAULT_PREFS, bundle.uiPrefs));
            if(bundle.tilesConfig)  saveTilesConfig(bundle.tilesConfig);
            if(bundle.tilesGrid)    saveTilesGrid(Object.assign({}, UIC_DEFAULT_GRID, bundle.tilesGrid));
            if(bundle.iconOverrides) saveIconOverrides(bundle.iconOverrides);
            applyUiPrefs(loadUiPrefs());
            renderHomeTiles();
            applyIconOverrides();
            syncUicGeneralUI();
            renderTilesManagementList();
            renderIconTargetsGrid();
            showAlarmToast('🎨','Thème importé','La personnalisation a été appliquée avec succès.','success',4000);
        } catch(e){
            showAlarmToast('⚠️','Fichier invalide','Ce fichier ne correspond pas à un thème GMAO Tactical valide.','warning',5000);
        }
    };
    reader.readAsText(file);
    document.getElementById('uic-theme-import-input').value = '';
}

// ─────────────────────────────────────────────────────────────────
// INITIALISATION
// ─────────────────────────────────────────────────────────────────
window.addEventListener('load', function(){
    applyUiPrefs(loadUiPrefs());
    renderHomeTiles();
    applyIconOverrides();
    observeNavForIconOverrides();
});
