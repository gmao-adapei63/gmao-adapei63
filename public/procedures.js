// ═════════════════════════════════════════════════════════════════
// PROCÉDURES INTELLIGENTES — GMAO Tactical (V1.7)
// ═════════════════════════════════════════════════════════════════
// Une procédure n'est plus un simple champ de texte : c'est un objet
// JSON structuré (voir newProcedure ci-dessous), qui est la SEULE
// source de vérité. L'affichage, l'impression et la recherche sont
// tous générés à partir de ce même modèle.
//
// Rétrocompatibilité : normalizeProcedure() migre automatiquement,
// sans perte, les anciennes procédures ({id,title,category,content})
// vers ce nouveau modèle (le texte libre devient la première étape).
//
// Pour ajouter un champ à l'avenir sans casser la compatibilité :
// l'ajouter dans newProcedure() avec une valeur par défaut, et dans
// normalizeProcedure() si une migration particulière est nécessaire.
// Le champ libre `customFields` existe déjà pour toute extension qui
// ne mérite pas encore sa propre colonne dans le modèle.
// ═════════════════════════════════════════════════════════════════

// ── Catégories : icône, libellé, PRÉFIXE DE RÉFÉRENCE, couleur ─────
// (La couleur n'est utilisée qu'à l'intérieur du module Procédures
// pour l'instant — l'application de cette charte à toute l'app est
// prévue pour une prochaine évolution, comme convenu.)
const PROTOCOL_CATEGORIES = [
    {id:'incendie',    icon:'🔥', label:'Incendie',              prefix:'PROC-INC', color:'#dc2626'},
    {id:'elec',        icon:'⚡', label:'Panne électrique',      prefix:'PROC-ELE', color:'#f59e0b'},
    {id:'eau',         icon:'💧', label:'Panne eau / plomberie', prefix:'PROC-EAU', color:'#0284c7'},
    {id:'gaz',         icon:'🧯', label:'Fuite / panne gaz',     prefix:'PROC-GAZ', color:'#ea580c'},
    {id:'degradee',    icon:'⚠️', label:'Marche dégradée',       prefix:'PROC-DEG', color:'#d97706'},
    {id:'maintenance', icon:'🔧', label:'Maintenance',           prefix:'PROC-MT',  color:'#16a34a'},
    {id:'standard',    icon:'📐', label:'Standard',              prefix:'PROC-STD', color:'#0369a1'},
    {id:'autre',       icon:'📋', label:'Autre procédure',       prefix:'PROC-AUT', color:'#64748b'},
];
function procCategory(id){ return PROTOCOL_CATEGORIES.find(c=>c.id===id) || PROTOCOL_CATEGORIES[PROTOCOL_CATEGORIES.length-1]; }

// ── Modèle JSON par défaut ──────────────────────────────────────────
function newProcedure(){
    const now = new Date().toISOString();
    return {
        id: generateUUID(),
        reference: '',
        title: '',
        category: 'maintenance',
        subCategory: '',
        version: '1.0',
        author: '',
        createdAt: now,
        updatedAt: now,
        status: 'draft',            // draft | published | archived
        keywords: [],
        site: '',
        equipmentConcerned: '',
        linkedEquipmentId: null,     // réservé pour un futur lien structuré vers un équipement
        estimatedDuration: '',
        difficulty: 'normal',        // facile | normal | difficile
        description: '',
        ppe: [],
        prerequisites: [],
        warnings: [],
        tools: [],
        consumables: [],
        steps: [],                   // [{id,title,detail,substeps:[string],image:dataURL|null}]
        attachments: [],             // [{id,name,type,size,dataUrl,addedAt}]
        externalLinks: [],           // [{id,label,url}]
        comments: [],                // [{id,text,date}]
        history: [],                 // [{version,date,note}]
        customFields: {}             // libre — évolutions futures sans casser la compatibilité
    };
}

// ── Migration non destructive depuis n'importe quel ancien format ──
function normalizeProcedure(raw){
    if(!raw) return newProcedure();
    const base = newProcedure();
    const p = Object.assign({}, base, raw);
    ['keywords','ppe','prerequisites','warnings','tools','consumables','steps','attachments','externalLinks','comments','history']
        .forEach(k=>{ if(!Array.isArray(p[k])) p[k] = Array.isArray(raw[k]) ? raw[k] : base[k]; });
    if(!p.customFields || typeof p.customFields !== 'object') p.customFields = {};
    // Ancien champ libre "content" → devient la première étape si aucune étape n'existe
    if(p.steps.length===0 && raw.content){
        p.steps = [{id:generateUUID(), title:'Mode opératoire', detail:raw.content, substeps:[], image:null}];
    }
    if(!p.id) p.id = generateUUID();
    if(!PROTOCOL_CATEGORIES.find(c=>c.id===p.category)) p.category = 'autre';
    if(!p.reference) p.reference = generateProcedureReference(p.category);
    if(!p.createdAt) p.createdAt = p.updatedAt || new Date().toISOString();
    return p;
}

function generateProcedureReference(categoryId){
    const cat = procCategory(categoryId);
    let maxN = 0;
    (appState.protocols||[]).forEach(p=>{
        if(p.reference && p.reference.startsWith(cat.prefix+'-')){
            const n = parseInt(p.reference.slice(cat.prefix.length+1), 10);
            if(!isNaN(n)) maxN = Math.max(maxN, n);
        }
    });
    return `${cat.prefix}-${(maxN+1).toString().padStart(4,'0')}`;
}

// ── État du modal (source de vérité pendant l'édition) ──────────────
let activeProtocolId    = null;
let activeProtocolDraft = null;  // objet procédure en cours d'édition/consultation
let protocolFilter      = 'all';

// ═════════════════════════════════════════════════════════════════
// LISTE (vue Protocoles / Astreinte)
// ═════════════════════════════════════════════════════════════════
function renderProtocols(){
    const container = document.getElementById('protocols-list-container');
    if(!container) return;
    const list = (appState.protocols||[])
        .filter(p => protocolFilter==='all' || p.category===protocolFilter)
        .slice()
        .sort((a,b)=> (a.title||'').localeCompare(b.title||''));
    if(!list.length){
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🚨</div><p>Aucune procédure enregistrée${protocolFilter!=='all'?' dans cette catégorie':''}.</p></div>`;
        return;
    }
    container.innerHTML = list.map(p=>{
        const cat = procCategory(p.category);
        return `
        <div class="info-list-item proc-list-item" style="border-left:4px solid ${cat.color}" onclick="openProtocolModal('${p.id}')">
            <div class="info-list-text">
                <div class="info-list-title">${cat.icon} ${escapeProcHtml(p.title||'(sans titre)')}</div>
                <div class="info-list-sub">
                    <span class="proc-ref-badge" style="background:${cat.color}22;color:${cat.color}">${p.reference}</span>
                    ${cat.label}${p.updatedAt ? ' · maj '+new Date(p.updatedAt).toLocaleDateString('fr-FR') : ''}
                    ${p.status==='draft' ? ' · <em>brouillon</em>' : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}
function filterProtocols(cat, btnEl){
    protocolFilter = cat;
    document.querySelectorAll('#protocols-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
    if(btnEl) btnEl.classList.add('active');
    renderProtocols();
}
function renderProtocolTabs(){
    const el = document.getElementById('protocols-tabs');
    if(!el) return;
    el.innerHTML = `<button class="tab-btn active" onclick="filterProtocols('all',this)">Toutes</button>` +
        PROTOCOL_CATEGORIES.map(c=>`<button class="tab-btn" onclick="filterProtocols('${c.id}',this)">${c.icon} ${c.label}</button>`).join('');
}

// ═════════════════════════════════════════════════════════════════
// OUVERTURE DU MODAL — lecture par défaut, édition à la demande
// ═════════════════════════════════════════════════════════════════
function openCreateProtocolModal(){
    activeProtocolId = null;
    activeProtocolDraft = newProcedure();
    document.getElementById('protocol-modal-title').innerText = 'Nouvelle Procédure';
    document.getElementById('protocol-edit-btn').style.display  = 'none';
    document.getElementById('protocol-print-btn').style.display = 'none';
    document.getElementById('protocol-view-panel').style.display   = 'none';
    document.getElementById('protocol-import-panel').style.display = 'none';
    document.getElementById('protocol-edit-panel').style.display   = 'block';
    populateProtocolEditForm(activeProtocolDraft);
    renderProtocolModalFooter('edit');
    activateFirstTab('protocolModal');
    document.getElementById('protocolModal').classList.add('active');
}
function openProtocolModal(id){
    const p = (appState.protocols||[]).find(x=>x.id===id);
    if(!p) return;
    activeProtocolId = id;
    activeProtocolDraft = p;
    document.getElementById('protocol-modal-title').innerText = p.title || '(sans titre)';
    document.getElementById('protocol-edit-btn').style.display  = 'inline-flex';
    document.getElementById('protocol-print-btn').style.display = 'inline-flex';
    document.getElementById('protocol-import-panel').style.display = 'none';
    document.getElementById('protocol-edit-panel').style.display   = 'none';
    document.getElementById('protocol-view-panel').style.display   = 'block';
    renderProtocolViewPanel(p);
    renderProtocolModalFooter('view');
    document.getElementById('protocolModal').classList.add('active');
}
function switchToProtocolEdit(){
    if(!activeProtocolDraft) return;
    document.getElementById('protocol-view-panel').style.display = 'none';
    document.getElementById('protocol-edit-panel').style.display = 'block';
    populateProtocolEditForm(activeProtocolDraft);
    renderProtocolModalFooter('edit');
    activateFirstTab('protocolModal');
}
function renderProtocolModalFooter(mode){
    const footer = document.getElementById('protocol-modal-footer');
    if(mode==='edit'){
        footer.innerHTML = `
            <button class="btn btn-secondary" onclick="closeModal('protocolModal')">Annuler</button>
            ${activeProtocolId ? `<button class="btn btn-danger" onclick="deleteActiveProtocol()">Supprimer</button>` : ''}
            <button class="btn btn-primary" onclick="saveProtocol()">Enregistrer</button>`;
    } else {
        footer.innerHTML = `<button class="btn btn-secondary" onclick="closeModal('protocolModal')">Fermer</button>`;
    }
}

// ═════════════════════════════════════════════════════════════════
// AFFICHAGE UNIFORME — sections repliables, identique pour toutes les
// procédures quel que soit leur format d'origine
// ═════════════════════════════════════════════════════════════════
function escapeProcHtml(s){
    return (s||'').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function procSection(icon, title, bodyHtml, openByDefault){
    if(!bodyHtml) return '';
    return `
    <div class="proc-section${openByDefault?' open':''}">
        <button type="button" class="proc-section-header" onclick="this.parentElement.classList.toggle('open')">
            <span>${icon} ${title}</span><span class="proc-chevron">▾</span>
        </button>
        <div class="proc-section-body">${bodyHtml}</div>
    </div>`;
}
function procListHtml(items){
    if(!items || !items.length) return '';
    return `<ul class="proc-simple-list">${items.map(i=>`<li>${escapeProcHtml(i)}</li>`).join('')}</ul>`;
}
function renderProtocolViewPanel(p){
    const cat = procCategory(p.category);
    const statusLabel = {draft:'Brouillon', published:'Publiée', archived:'Archivée'}[p.status] || p.status;
    const diffLabel    = {facile:'Facile', normal:'Normale', difficile:'Difficile'}[p.difficulty] || p.difficulty;

    const header = `
        <div class="proc-header" style="border-left:5px solid ${cat.color}">
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:6px">
                <span class="proc-ref-badge" style="background:${cat.color}22;color:${cat.color}">${p.reference}</span>
                <span class="proc-meta-chip">${cat.icon} ${cat.label}</span>
                <span class="proc-meta-chip">v${escapeProcHtml(p.version)}</span>
                <span class="proc-meta-chip">${statusLabel}</span>
                ${p.difficulty ? `<span class="proc-meta-chip">Difficulté : ${diffLabel}</span>` : ''}
                ${p.estimatedDuration ? `<span class="proc-meta-chip">⏱ ${escapeProcHtml(p.estimatedDuration)}</span>` : ''}
            </div>
            <div style="font-size:.82rem;color:var(--text-muted)">
                ${p.site ? `📍 ${escapeProcHtml(p.site)} · ` : ''}${p.equipmentConcerned ? `🔧 ${escapeProcHtml(p.equipmentConcerned)} · ` : ''}
                ${p.author ? `Auteur : ${escapeProcHtml(p.author)} · ` : ''}Maj le ${new Date(p.updatedAt).toLocaleDateString('fr-FR')}
            </div>
        </div>`;

    const description = p.description ? `<p>${escapeProcHtml(p.description).replace(/\n/g,'<br>')}</p>` : '';

    const securityBody = (p.warnings.length||p.ppe.length||p.prerequisites.length) ? `
        ${p.warnings.length ? `<div class="alert alert-danger" style="margin-bottom:10px">${p.warnings.map(escapeProcHtml).join('<br>')}</div>` : ''}
        ${p.ppe.length ? `<strong>EPI nécessaires :</strong>${procListHtml(p.ppe)}` : ''}
        ${p.prerequisites.length ? `<strong>Prérequis :</strong>${procListHtml(p.prerequisites)}` : ''}
    ` : '';

    const stepsBody = p.steps.length ? `<ol class="proc-steps-view">${p.steps.map(s=>`
        <li>
            <div class="proc-step-title">${escapeProcHtml(s.title||'Étape')}</div>
            ${s.detail ? `<div class="proc-step-detail">${escapeProcHtml(s.detail).replace(/\n/g,'<br>')}</div>` : ''}
            ${(s.substeps&&s.substeps.length) ? procListHtml(s.substeps) : ''}
            ${s.image ? `<img src="${s.image}" class="proc-step-image" alt="">` : ''}
        </li>`).join('')}</ol>` : `<p style="color:var(--text-muted)">Aucune étape renseignée.</p>`;

    const toolsBody = (p.tools.length||p.consumables.length) ? `
        ${p.tools.length ? `<strong>Outils :</strong>${procListHtml(p.tools)}` : ''}
        ${p.consumables.length ? `<strong>Consommables :</strong>${procListHtml(p.consumables)}` : ''}
    ` : '';

    const attachBody = p.attachments.length ? `<div class="proc-attachments-grid">${p.attachments.map(a=>renderAttachmentCard(a,false)).join('')}</div>` : '';

    const linksBody = p.externalLinks.length ? procListHtml(p.externalLinks.map(l=>`${l.label||l.url}`)).replace(/<li>(.*?)<\/li>/g,(m,txt)=>{
        const link = p.externalLinks.find(l=>(l.label||l.url)===txt);
        return `<li><a href="${link?link.url:'#'}" target="_blank" rel="noopener">${escapeProcHtml(txt)}</a></li>`;
    }) : '';

    const commentsBody = p.comments.length ? p.comments.map(c=>`
        <div class="proc-comment"><div class="proc-comment-date">${new Date(c.date).toLocaleString('fr-FR')}</div><div>${escapeProcHtml(c.text)}</div></div>
    `).join('') : '';

    const historyBody = p.history.length ? `<table class="proc-history-table"><tbody>${p.history.slice().reverse().map(h=>`
        <tr><td>v${escapeProcHtml(h.version)}</td><td>${new Date(h.date).toLocaleDateString('fr-FR')}</td><td>${escapeProcHtml(h.note||'')}</td></tr>
    `).join('')}</tbody></table>` : '';

    const keywordsBody = p.keywords.length ? `<div class="proc-keywords">${p.keywords.map(k=>`<span class="proc-keyword-chip">${escapeProcHtml(k)}</span>`).join('')}</div>` : '';

    document.getElementById('protocol-view-panel').innerHTML = header
        + procSection('📝','Description', description, true)
        + procSection('🏷️','Mots-clés', keywordsBody, false)
        + procSection('⚠️','Sécurité', securityBody, true)
        + procSection('🧭','Étapes', stepsBody, true)
        + procSection('🧰','Outils & consommables', toolsBody, false)
        + procSection('📎','Pièces jointes', attachBody, false)
        + procSection('🔗','Liens externes', linksBody, false)
        + procSection('💬','Commentaires', commentsBody, false)
        + procSection('🕓','Historique des versions', historyBody, false);
}

// ═════════════════════════════════════════════════════════════════
// FORMULAIRE D'ÉDITION
// ═════════════════════════════════════════════════════════════════
function fillCategorySelect(){
    const sel = document.getElementById('proc-category');
    sel.innerHTML = PROTOCOL_CATEGORIES.map(c=>`<option value="${c.id}">${c.icon} ${c.label} (${c.prefix})</option>`).join('');
}
function onProcCategoryChange(){
    // La référence suit la catégorie tant que la procédure n'a pas encore de référence figée
    if(activeProtocolDraft && !activeProtocolId){
        activeProtocolDraft.category = document.getElementById('proc-category').value;
        document.getElementById('proc-reference').value = generateProcedureReference(activeProtocolDraft.category);
    }
}
function populateProtocolEditForm(p){
    fillCategorySelect();
    document.getElementById('proc-reference').value   = p.reference || generateProcedureReference(p.category);
    document.getElementById('proc-version').value     = p.version || '1.0';
    document.getElementById('proc-title').value       = p.title || '';
    document.getElementById('proc-category').value    = p.category || 'autre';
    document.getElementById('proc-subcategory').value = p.subCategory || '';
    document.getElementById('proc-status').value      = p.status || 'draft';
    document.getElementById('proc-difficulty').value  = p.difficulty || 'normal';
    document.getElementById('proc-duration').value    = p.estimatedDuration || '';
    document.getElementById('proc-author').value      = p.author || '';
    document.getElementById('proc-site').value        = p.site || '';
    document.getElementById('proc-equipment').value   = p.equipmentConcerned || '';
    document.getElementById('proc-keywords').value    = (p.keywords||[]).join('\n');
    document.getElementById('proc-description').value = p.description || '';
    document.getElementById('proc-warnings').value      = (p.warnings||[]).join('\n');
    document.getElementById('proc-ppe').value           = (p.ppe||[]).join('\n');
    document.getElementById('proc-prerequisites').value = (p.prerequisites||[]).join('\n');
    document.getElementById('proc-tools').value         = (p.tools||[]).join('\n');
    document.getElementById('proc-consumables').value   = (p.consumables||[]).join('\n');
    document.getElementById('proc-links').value = (p.externalLinks||[]).map(l=>`${l.label||''} | ${l.url||''}`).join('\n');
    document.getElementById('proc-version-note').value = '';
    renderProcStepsEditor();
    renderProcAttachments();
    renderProcHistoryList();
    renderProcCommentsList();
}
function readArrayField(id){
    return document.getElementById(id).value.split('\n').map(s=>s.trim()).filter(Boolean);
}
function saveProtocol(){
    const title = document.getElementById('proc-title').value.trim();
    if(!title){ alert('Le titre est obligatoire.'); return; }
    if(!appState.protocols) appState.protocols = [];

    const p = activeProtocolDraft || newProcedure();
    p.title              = title;
    p.category           = document.getElementById('proc-category').value;
    p.subCategory        = document.getElementById('proc-subcategory').value.trim();
    p.version            = document.getElementById('proc-version').value.trim() || '1.0';
    p.status             = document.getElementById('proc-status').value;
    p.difficulty         = document.getElementById('proc-difficulty').value;
    p.estimatedDuration  = document.getElementById('proc-duration').value.trim();
    p.author             = document.getElementById('proc-author').value.trim();
    p.site               = document.getElementById('proc-site').value.trim();
    p.equipmentConcerned = document.getElementById('proc-equipment').value.trim();
    p.description        = document.getElementById('proc-description').value.trim();
    p.keywords           = readArrayField('proc-keywords');
    p.warnings           = readArrayField('proc-warnings');
    p.ppe                = readArrayField('proc-ppe');
    p.prerequisites      = readArrayField('proc-prerequisites');
    p.tools              = readArrayField('proc-tools');
    p.consumables        = readArrayField('proc-consumables');
    p.externalLinks = readArrayField('proc-links').map(line=>{
        const [label, url] = line.split('|').map(s=>s.trim());
        return {id:generateUUID(), label: label||url, url: url||label};
    });
    if(!p.reference) p.reference = document.getElementById('proc-reference').value || generateProcedureReference(p.category);
    p.updatedAt = new Date().toISOString();

    const note = document.getElementById('proc-version-note').value.trim();
    if(note) p.history.push({version:p.version, date:p.updatedAt, note});

    if(!activeProtocolId){
        appState.protocols.push(p);
        activeProtocolId = p.id;
    }
    saveData();
    renderProtocols();
    activeProtocolDraft = p;
    openProtocolModal(p.id); // repasse en lecture avec le contenu à jour
}
function deleteActiveProtocol(){
    if(!activeProtocolId) return;
    if(!confirm('Supprimer cette procédure ?')) return;
    appState.protocols = (appState.protocols||[]).filter(x=>x.id!==activeProtocolId);
    saveData();
    renderProtocols();
    closeModal('protocolModal');
}

// ── Étapes (édition) ─────────────────────────────────────────────
function addProcStep(){
    activeProtocolDraft.steps.push({id:generateUUID(), title:'', detail:'', substeps:[], image:null});
    renderProcStepsEditor();
}
function removeProcStep(stepId){
    activeProtocolDraft.steps = activeProtocolDraft.steps.filter(s=>s.id!==stepId);
    renderProcStepsEditor();
}
function updateProcStepField(stepId, field, value){
    const s = activeProtocolDraft.steps.find(x=>x.id===stepId);
    if(!s) return;
    if(field==='substeps') s.substeps = value.split('\n').map(v=>v.trim()).filter(Boolean);
    else s[field] = value;
}
function addProcStepImage(stepId, file){
    if(!file) return;
    compressImageToDataURL(file, 1200, 0.7).then(dataUrl=>{
        const s = activeProtocolDraft.steps.find(x=>x.id===stepId);
        if(s){ s.image = dataUrl; renderProcStepsEditor(); }
    }).catch(err=>alert('Image invalide : '+err.message));
}
function removeProcStepImage(stepId){
    const s = activeProtocolDraft.steps.find(x=>x.id===stepId);
    if(s){ s.image = null; renderProcStepsEditor(); }
}
function renderProcStepsEditor(){
    const container = document.getElementById('proc-steps-list');
    const steps = activeProtocolDraft.steps;
    if(!steps.length){
        container.innerHTML = `<p style="color:var(--text-muted);margin-bottom:10px">Aucune étape. Cliquez sur "Ajouter une étape".</p>`;
        return;
    }
    container.innerHTML = steps.map((s,i)=>`
        <div class="proc-step-editor">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <strong>Étape ${i+1}</strong>
                <button type="button" class="btn-icon" onclick="removeProcStep('${s.id}')" title="Supprimer l'étape">🗑️</button>
            </div>
            <input type="text" class="form-input" style="margin-bottom:6px" placeholder="Titre de l'étape"
                value="${escapeProcHtml(s.title)}" onchange="updateProcStepField('${s.id}','title',this.value)">
            <textarea class="form-textarea" style="min-height:60px;margin-bottom:6px" placeholder="Détail de l'étape"
                onchange="updateProcStepField('${s.id}','detail',this.value)">${escapeProcHtml(s.detail)}</textarea>
            <textarea class="form-textarea" style="min-height:44px;margin-bottom:6px" placeholder="Sous-étapes (une par ligne)"
                onchange="updateProcStepField('${s.id}','substeps',this.value)">${(s.substeps||[]).join('\n')}</textarea>
            ${s.image
                ? `<div class="proc-step-image-wrap"><img src="${s.image}" class="proc-step-image"><button type="button" class="btn-icon" onclick="removeProcStepImage('${s.id}')">🗑️</button></div>`
                : `<label class="btn btn-secondary" style="display:inline-block;cursor:pointer">📷 Ajouter une image
                     <input type="file" accept="image/*" style="display:none" onchange="addProcStepImage('${s.id}', this.files[0])"></label>`}
        </div>`).join('');
}

// ── Pièces jointes ────────────────────────────────────────────────
function readFileAsDataURL(file){
    return new Promise((resolve, reject)=>{
        const reader = new FileReader();
        reader.onerror = ()=>reject(new Error('Lecture impossible'));
        reader.onload  = ()=>resolve(reader.result);
        reader.readAsDataURL(file);
    });
}
function addProcAttachments(fileList){
    [...fileList].forEach(file=>{
        const isImage = file.type.startsWith('image/');
        const handler = isImage ? compressImageToDataURL(file, 1600, 0.75) : readFileAsDataURL(file);
        handler.then(dataUrl=>{
            if(!isImage && file.size > 3*1024*1024){
                showAlarmToast('⚠️','Fichier volumineux', `${file.name} (${(file.size/1024/1024).toFixed(1)} Mo) — la synchronisation peut être plus lente.`, 'warning', 5000);
            }
            activeProtocolDraft.attachments.push({
                id:generateUUID(), name:file.name, type:file.type||'application/octet-stream',
                size:file.size, dataUrl, addedAt:new Date().toISOString()
            });
            renderProcAttachments();
        }).catch(err=>alert('Erreur pièce jointe : '+err.message));
    });
}
function removeProcAttachment(id){
    activeProtocolDraft.attachments = activeProtocolDraft.attachments.filter(a=>a.id!==id);
    renderProcAttachments();
}
function renderAttachmentCard(a, editable){
    const isImage = (a.type||'').startsWith('image/');
    const sizeKb = a.size ? (a.size/1024).toFixed(0)+' Ko' : '';
    return `
    <div class="proc-attachment-card">
        ${isImage
            ? `<img src="${a.dataUrl}" class="proc-attachment-thumb" onclick="window.open('${a.dataUrl}','_blank')">`
            : `<div class="proc-attachment-icon" onclick="window.open('${a.dataUrl}','_blank')">📄</div>`}
        <div class="proc-attachment-name" title="${escapeProcHtml(a.name)}">${escapeProcHtml(a.name)}</div>
        <div class="proc-attachment-size">${sizeKb}</div>
        ${editable ? `<button type="button" class="btn-icon" onclick="removeProcAttachment('${a.id}')" title="Supprimer">🗑️</button>` : ''}
    </div>`;
}
function renderProcAttachments(){
    const el = document.getElementById('proc-attachments-list');
    if(!el) return;
    el.innerHTML = activeProtocolDraft.attachments.length
        ? activeProtocolDraft.attachments.map(a=>renderAttachmentCard(a,true)).join('')
        : `<p style="color:var(--text-muted)">Aucune pièce jointe.</p>`;
}

// ── Historique & commentaires ────────────────────────────────────
function renderProcHistoryList(){
    const el = document.getElementById('proc-history-list');
    if(!el) return;
    const h = activeProtocolDraft.history;
    el.innerHTML = h.length
        ? `<table class="proc-history-table"><tbody>${h.slice().reverse().map(x=>`<tr><td>v${escapeProcHtml(x.version)}</td><td>${new Date(x.date).toLocaleDateString('fr-FR')}</td><td>${escapeProcHtml(x.note||'')}</td></tr>`).join('')}</tbody></table>`
        : `<p style="color:var(--text-muted)">Aucun historique pour le moment.</p>`;
}
function addProcComment(){
    const input = document.getElementById('proc-new-comment');
    const text = input.value.trim();
    if(!text) return;
    activeProtocolDraft.comments.push({id:generateUUID(), text, date:new Date().toISOString()});
    input.value = '';
    renderProcCommentsList();
}
function renderProcCommentsList(){
    const el = document.getElementById('proc-comments-list');
    if(!el) return;
    const c = activeProtocolDraft.comments;
    el.innerHTML = c.length
        ? c.map(x=>`<div class="proc-comment"><div class="proc-comment-date">${new Date(x.date).toLocaleString('fr-FR')}</div><div>${escapeProcHtml(x.text)}</div></div>`).join('')
        : '';
}

// ═════════════════════════════════════════════════════════════════
// IMPRESSION (le PDF s'obtient via "Enregistrer en PDF" dans la boîte
// de dialogue d'impression du navigateur — même gabarit, une seule
// source de vérité, sans dépendance à une librairie PDF supplémentaire)
// ═════════════════════════════════════════════════════════════════
function printProcedure(){
    const p = activeProtocolDraft;
    if(!p) return;
    const cat = procCategory(p.category);
    const html = `
        <div class="pp-doc" style="--pp-color:${cat.color}">
        <table class="pp-cartouche">
            <tr>
                <td class="pp-cartouche-logo">${escapeProcHtml((appState.settings&&appState.settings.siteName)||'GMAO')}</td>
                <td class="pp-cartouche-title">${escapeProcHtml(p.title)}<small>${cat.icon} ${cat.label}${p.subCategory?' — '+escapeProcHtml(p.subCategory):''}</small></td>
                <td class="pp-cartouche-meta">
                    <div><b>Réf :</b> ${p.reference}</div>
                    <div><b>Version :</b> ${escapeProcHtml(p.version)}</div>
                    <div><b>Date :</b> ${new Date(p.updatedAt).toLocaleDateString('fr-FR')}</div>
                    ${p.author?`<div><b>Auteur :</b> ${escapeProcHtml(p.author)}</div>`:''}
                </td>
            </tr>
        </table>
        ${p.description ? `<p>${escapeProcHtml(p.description).replace(/\n/g,'<br>')}</p>` : ''}
        ${p.warnings.length ? `<div class="pp-alert">⚠️ ${p.warnings.map(escapeProcHtml).join('<br>')}</div>` : ''}
        ${p.ppe.length ? `<div class="pp-block"><strong>🦺 EPI nécessaires</strong>${procListHtml(p.ppe).replace('proc-simple-list','pp-simple-list')}</div>` : ''}
        ${p.prerequisites.length ? `<div class="pp-block"><strong>✅ Prérequis</strong>${procListHtml(p.prerequisites).replace('proc-simple-list','pp-simple-list')}</div>` : ''}
        ${(p.tools.length||p.consumables.length) ? `<h2>Outils & consommables</h2>
            ${p.tools.length?`<strong>Outils :</strong>${procListHtml(p.tools).replace('proc-simple-list','pp-simple-list')}`:''}
            ${p.consumables.length?`<strong>Consommables :</strong>${procListHtml(p.consumables).replace('proc-simple-list','pp-simple-list')}`:''}` : ''}
        <h2>Étapes</h2>
        <ol class="pp-steps">${p.steps.map(s=>`
            <li><strong>${escapeProcHtml(s.title||'Étape')}</strong>
                ${s.detail?`<p>${escapeProcHtml(s.detail).replace(/\n/g,'<br>')}</p>`:''}
                ${(s.substeps&&s.substeps.length)?procListHtml(s.substeps).replace('proc-simple-list','pp-simple-list'):''}
                ${s.image?`<img src="${s.image}" class="pp-step-image">`:''}
            </li>`).join('')}
        </ol>
        <div class="pp-footer">${escapeProcHtml(p.reference)} — v${escapeProcHtml(p.version)} — Document généré par la GMAO</div>
        </div>
    `;
    document.getElementById('procedure-print-area').innerHTML = html;
    window.print();
}

// ═════════════════════════════════════════════════════════════════
// IMPORT — HTML / Markdown / texte brut analysés automatiquement ;
// PDF / Word / images acceptés en pièce jointe (archive) en attendant
// une extraction binaire complète (pdf.js / mammoth.js à intégrer
// dans une prochaine itération si souhaité).
// ═════════════════════════════════════════════════════════════════
let importedAttachments = [];       // pièces jointes accumulées pendant l'import (plusieurs fichiers possibles)
let importedJsonProcedure = null;   // si un .json déjà au format procédure GMAO est détecté

function openImportProcedureModal(){
    activeProtocolId = null;
    activeProtocolDraft = newProcedure();
    importedAttachments = [];
    importedJsonProcedure = null;
    document.getElementById('protocol-modal-title').innerText = 'Importer une procédure';
    document.getElementById('protocol-edit-btn').style.display  = 'none';
    document.getElementById('protocol-print-btn').style.display = 'none';
    document.getElementById('protocol-view-panel').style.display   = 'none';
    document.getElementById('protocol-edit-panel').style.display   = 'none';
    document.getElementById('protocol-import-panel').style.display = 'block';
    document.getElementById('proc-import-file').value = '';
    document.getElementById('proc-import-paste').value = '';
    document.getElementById('protocol-modal-footer').innerHTML =
        `<button class="btn btn-secondary" onclick="closeModal('protocolModal')">Annuler</button>`;
    document.getElementById('protocolModal').classList.add('active');
}
// Traite un ou plusieurs fichiers sélectionnés pour l'import. Le premier
// fichier "texte" (HTML/MD/TXT) sert de base d'analyse ; un JSON déjà au
// format procédure est ré-importé directement ; tout le reste (PDF, Word,
// images, JSON générique...) est ajouté en pièce jointe.
function handleProcedureImportFiles(fileList){
    const files = [...fileList];
    let textAssigned = false;
    files.forEach(file=>{
        const ext = (file.name.split('.').pop()||'').toLowerCase();
        const isJson = ext==='json' || file.type==='application/json';
        const isTextLike = ['html','htm','md','markdown','txt'].includes(ext)
            || ['text/html','text/markdown','text/plain'].includes(file.type);

        if(isJson){
            const reader = new FileReader();
            reader.onload = () => {
                try{
                    const obj = JSON.parse(reader.result);
                    if(obj && typeof obj==='object' && (obj.steps || obj.title || obj.reference)){
                        importedJsonProcedure = obj;
                        showAlarmToast('📄','Procédure JSON détectée', `${file.name} sera réimportée directement (déjà au format GMAO).`, 'success', 4500);
                    } else {
                        addImportAttachmentFromFile(file);
                    }
                } catch(e){
                    addImportAttachmentFromFile(file); // JSON invalide → conservé tel quel en pièce jointe
                }
            };
            reader.readAsText(file, 'utf-8');
        } else if(isTextLike && !textAssigned){
            textAssigned = true;
            const reader = new FileReader();
            reader.onload = () => { document.getElementById('proc-import-paste').value = reader.result; };
            reader.readAsText(file, 'utf-8');
        } else {
            addImportAttachmentFromFile(file);
        }
    });
}
function addImportAttachmentFromFile(file){
    const isImage = file.type.startsWith('image/');
    (isImage ? compressImageToDataURL(file,1600,0.75) : readFileAsDataURL(file)).then(dataUrl=>{
        importedAttachments.push({id:generateUUID(), name:file.name, type:file.type||'application/octet-stream', size:file.size, dataUrl, addedAt:new Date().toISOString()});
        showAlarmToast('📎','Pièce jointe ajoutée', file.name, 'success', 2500);
    }).catch(err=>console.warn('Pièce jointe ignorée :', file.name, err.message));
}
function analyzeProcedureImport(){
    if(importedJsonProcedure){
        activeProtocolDraft = normalizeProcedure(Object.assign({}, importedJsonProcedure, {id:generateUUID(), reference:''}));
        activeProtocolDraft.reference = generateProcedureReference(activeProtocolDraft.category);
    } else {
        const raw = document.getElementById('proc-import-paste').value;
        let parsed;
        if(/<\/?[a-z][\s\S]*>/i.test(raw)) parsed = parseHTMLToProcedure(raw);
        else if(/^#{1,6}\s|^-\s|^\*\s|^\d+\.\s/m.test(raw)) parsed = parseMarkdownToProcedure(raw);
        else parsed = parsePlainTextToProcedure(raw);
        activeProtocolDraft = normalizeProcedure(Object.assign(newProcedure(), parsed));
    }
    activeProtocolDraft.attachments.push(...importedAttachments);

    document.getElementById('protocol-modal-title').innerText = 'Nouvelle Procédure (importée)';
    document.getElementById('protocol-import-panel').style.display = 'none';
    document.getElementById('protocol-edit-panel').style.display   = 'block';
    populateProtocolEditForm(activeProtocolDraft);
    renderProtocolModalFooter('edit');
    activateFirstTab('protocolModal');
    showAlarmToast('🔎','Import analysé', 'Vérifiez et complétez les champs avant d\'enregistrer.', 'success', 4000);
}

// Analyse d'un document HTML : titre (h1/title), sections (h1-h3 → étapes),
// listes (ul/ol → sous-étapes), texte des paragraphes → détail d'étape.
function parseHTMLToProcedure(html){
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const title = (doc.querySelector('h1')?.textContent || doc.querySelector('title')?.textContent || '').trim();
    const steps = [];
    let current = null;
    doc.body.querySelectorAll('h1, h2, h3, p, ul, ol, .alert, [class*="alert"], [class*="warning"], [class*="danger"]').forEach(el=>{
        const tag = el.tagName.toLowerCase();
        const text = el.textContent.trim();
        if(!text) return;
        if(tag==='h1'||tag==='h2'||tag==='h3'){
            current = {id:generateUUID(), title:text, detail:'', substeps:[], image:null};
            steps.push(current);
        } else if(tag==='ul'||tag==='ol'){
            const items = [...el.querySelectorAll('li')].map(li=>li.textContent.trim()).filter(Boolean);
            if(current) current.substeps.push(...items);
            else steps.push({id:generateUUID(), title:'Liste', detail:'', substeps:items, image:null});
        } else {
            if(current) current.detail += (current.detail?'\n':'') + text;
            else steps.push({id:generateUUID(), title:'Introduction', detail:text, substeps:[], image:null});
        }
    });
    // La première étape sert souvent d'objet/description générale
    let description = '';
    if(steps.length && /objet|introduction|domaine/i.test(steps[0].title)){
        description = steps[0].detail;
        steps.shift();
    }
    return { title: title || 'Procédure importée', description, steps };
}

// Analyse Markdown basique : # titres → étapes, listes -, *, 1. → sous-étapes
function parseMarkdownToProcedure(md){
    const lines = md.split('\n');
    let title = '';
    const steps = [];
    let current = null;
    lines.forEach(line=>{
        const h = line.match(/^(#{1,6})\s+(.*)/);
        const li = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
        if(h){
            if(!title && h[1].length===1) title = h[2].trim();
            current = {id:generateUUID(), title:h[2].trim(), detail:'', substeps:[], image:null};
            steps.push(current);
        } else if(li){
            if(current) current.substeps.push(li[1].trim());
            else { current = {id:generateUUID(), title:'Étape', detail:'', substeps:[li[1].trim()], image:null}; steps.push(current); }
        } else if(line.trim()){
            if(current) current.detail += (current.detail?'\n':'') + line.trim();
        }
    });
    return { title: title || 'Procédure importée', description:'', steps };
}

// Texte brut : découpage par lignes vides = étapes ; première ligne = titre,
// le reste du premier bloc devient la description.
function parsePlainTextToProcedure(text){
    const blocks = text.split(/\n\s*\n/).map(b=>b.trim()).filter(Boolean);
    const firstLines = blocks.length ? blocks[0].split('\n').map(l=>l.trim()).filter(Boolean) : [];
    const title = firstLines.length ? firstLines[0] : 'Procédure importée';
    const description = firstLines.slice(1).join('\n');
    const steps = blocks.slice(1).map((b,i)=>{
        const lines = b.split('\n').map(l=>l.trim()).filter(Boolean);
        return {id:generateUUID(), title: lines[0] || `Étape ${i+1}`, detail: lines.slice(1).join('\n'), substeps:[], image:null};
    });
    return { title, description, steps };
}
