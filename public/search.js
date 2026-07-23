// ═════════════════════════════════════════════════════════════════
// RECHERCHE GLOBALE — GMAO Tactical (V1.6)
// ═════════════════════════════════════════════════════════════════
// Architecture :
//   SearchProvider  → une fonction qui lit une source de données (appState.*)
//                      et retourne des documents bruts {title, summary, text, open()…}
//   SearchIndex     → tableau normalisé (accents/casse/espaces) construit à partir
//                      de tous les providers, reconstruit uniquement quand les
//                      données changent (pas à chaque frappe).
//   SearchEngine    → recherche instantanée par tokens sur l'index déjà construit.
//   UI              → barre de recherche + résultats + reconnaissance vocale.
//
// ── Pour indexer une NOUVELLE source de données plus tard ──────────
// Il suffit d'appeler, n'importe où dans le code :
//
//   registerSearchProvider('mon_type', () => appState.maListe.map(x => ({
//       type:'mon_type', icon:'📌', category:'Ma Catégorie',
//       title: x.nom, summary: x.description, text: x.notes||'',
//       location: 'Nom de la page',
//       open(){ switchView('maVue'); ouvrirMonModal(x.id); }
//   })));
//
// L'élément sera automatiquement indexé au prochain SearchEngine.rebuild()
// (appelé après chaque saveData()) et apparaîtra dans les résultats.
// ═════════════════════════════════════════════════════════════════

(function(){

    // ── Normalisation : ignore majuscules/minuscules, accents, espaces multiples ──
    function normalize(str){
        return (str||'')
            .toString()
            .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // retire les accents
            .toLowerCase()
            .replace(/\s+/g,' ')
            .trim();
    }

    // ── Registre des fournisseurs de données (extensible) ──────────────
    const __providers = [];
    function registerSearchProvider(name, fn){
        __providers.push({name, fn});
    }

    // ── Index construit une seule fois, réutilisé à chaque frappe ───────
    let __index = [];

    function rebuild(){
        const docs = [];
        __providers.forEach(p=>{
            let items = [];
            try { items = p.fn() || []; }
            catch(e){ console.warn('[SearchEngine] provider "'+p.name+'" en erreur :', e); }
            items.forEach(it=>{
                if(!it || !it.title) return;
                const haystack = normalize([it.title, it.summary, it.text, it.category, it.location].filter(Boolean).join(' '));
                docs.push({
                    type: it.type, icon: it.icon || '📄', category: it.category || '',
                    title: it.title, summary: it.summary || '', location: it.location || '',
                    id: it.id != null ? String(it.id) : '',
                    open: it.open || function(){},
                    _norm: haystack,
                    _normTitle: normalize(it.title)
                });
            });
        });
        __index = docs;
    }

    // ── Résolution exacte par identifiant ou nom — utilisée par le scanner ─────
    // (QR/code-barres) pour ouvrir directement la ressource correspondante, quel
    // que soit son type (équipement, procédure, véhicule, action, mission, ou tout
    // futur module) : il suffit qu'un provider indexe un champ `id`. Aucune logique
    // métier propre au scanner n'est nécessaire ici ni côté appelant.
    function resolveExact(code){
        const raw = (code||'').toString().trim();
        if(!raw) return null;
        // 1) Correspondance exacte par identifiant (insensible à la casse)
        const byId = __index.find(d => d.id && d.id.toLowerCase() === raw.toLowerCase());
        if(byId) return byId;
        // 2) Correspondance exacte par titre normalisé (accents/casse/espaces ignorés)
        const norm = normalize(raw);
        const byTitle = __index.find(d => d._normTitle === norm);
        if(byTitle) return byTitle;
        return null;
    }

    // ── Recherche instantanée sur l'index déjà construit ────────────────
    function search(query){
        const q = normalize(query);
        if(!q) return [];
        const tokens = q.split(' ').filter(Boolean);
        const results = [];
        for(let i=0;i<__index.length;i++){
            const doc = __index[i];
            let score = 0, allMatch = true;
            for(let t=0;t<tokens.length;t++){
                const tok = tokens[t];
                if(doc._normTitle.includes(tok)) score += 3;
                else if(doc._norm.includes(tok)) score += 1;
                else { allMatch = false; break; }
            }
            if(allMatch) results.push({doc, score});
        }
        results.sort((a,b)=> b.score - a.score);
        return results.slice(0, 40).map(r=>r.doc);
    }

    window.registerSearchProvider = registerSearchProvider;
    window.SearchEngine = { rebuild, search, resolveExact };

    // ═════════════════════════════════════════════════════════════════
    // PROVIDERS — sources de données réelles déjà présentes dans l'app
    // ═════════════════════════════════════════════════════════════════

    // Missions (toutes les dates du calendrier, pas seulement le jour affiché)
    registerSearchProvider('missions', function(){
        const out = [];
        const today = new Date().toISOString().split('T')[0];
        Object.keys(appState.calendar || {}).forEach(date=>{
            (appState.calendar[date] || []).forEach(task=>{
                out.push({
                    type:'mission', icon:'🔧', category:'Mission',
                    id: task.id,
                    title: task.title,
                    summary: [task.desc, task.comment].filter(Boolean).join(' — '),
                    text: [task.desc, task.comment, task.interCompany, task.interName, task.service].filter(Boolean).join(' '),
                    location: date === today ? "Aujourd'hui" : new Date(date+'T12:00:00').toLocaleDateString('fr-FR'),
                    open(){
                        switchView('home');
                        document.getElementById('system-date').value = date;
                        loadDayData(date);
                        openTaskModal(task.id);
                    }
                });
            });
        });
        return out;
    });

    // Agents
    registerSearchProvider('agents', function(){
        return (appState.agents || []).map(a=>({
            type:'agent', icon:'👤', category:'Agent',
            id: a.id,
            title: a.name,
            summary: [a.role, a.service].filter(Boolean).join(' · '),
            text: [a.role, a.service].filter(Boolean).join(' '),
            location: 'Agents',
            open(){ switchView('agents'); openAgentModal(a.id); }
        }));
    });

    // Équipements
    registerSearchProvider('equipment', function(){
        const statusLabels = {available:'Disponible', in_use:'En Utilisation', maintenance:'Maintenance'};
        return (appState.equipment || []).map(e=>({
            type:'equipment', icon:'🔑', category:'Équipement',
            id: e.id,
            title: e.name,
            summary: [e.location, statusLabels[e.status]||e.status].filter(Boolean).join(' · '),
            text: [e.location, e.type, e.status].filter(Boolean).join(' '),
            location: 'Équipements',
            open(){ switchView('equipment'); openEquipmentModal(e.id); }
        }));
    });

    // Véhicules
    registerSearchProvider('vehicles', function(){
        return (appState.vehicles || []).map(v=>({
            type:'vehicle', icon:'🚗', category:'Véhicule',
            id: v.id,
            title: v.name,
            summary: v.notes || '',
            text: v.notes || '',
            location: 'Véhicules',
            open(){ switchView('vehicles'); openVehicleModal(v.id); }
        }));
    });

    // Procédures / Protocoles / Astreinte
    registerSearchProvider('protocols', function(){
        return (appState.protocols || []).map(p=>{
            const cat = (typeof PROTOCOL_CATEGORIES !== 'undefined' ? PROTOCOL_CATEGORIES : []).find(c=>c.id===p.category);
            const stepsText = (p.steps||[]).map(s=>`${s.title||''} ${s.detail||''} ${(s.substeps||[]).join(' ')}`).join(' ');
            return {
                type:'protocol', icon: cat ? cat.icon : '📄', category:'Procédure',
                id: p.id,
                title: p.title,
                summary: p.reference ? `${p.reference} — ${cat ? cat.label : ''}` : (cat ? cat.label : ''),
                text: [p.description, stepsText, (p.keywords||[]).join(' '), (p.tools||[]).join(' '), (p.ppe||[]).join(' ')].filter(Boolean).join(' '),
                location: 'Protocoles / Astreinte',
                open(){ switchView('protocols'); openProtocolModal(p.id); }
            };
        });
    });

    // Plans de bâtiments
    registerSearchProvider('plans', function(){
        return (appState.plans || []).map(p=>({
            type:'plan', icon:'🗺️', category:'Plan',
            id: p.id,
            title: p.name,
            summary: 'Plan de bâtiment',
            text: '',
            location: 'Plans',
            open(){ switchView('plans'); openPlanViewer(p.id); }
        }));
    });

    // Pages de l'application elles-mêmes (retrouver un écran par son nom)
    registerSearchProvider('nav', function(){
        return (appState.navConfig || []).filter(b=>b.type==='view').map(b=>({
            type:'nav', icon: b.icon, category:'Page',
            title: b.label,
            summary: 'Ouvrir la page ' + b.label,
            text: '',
            location: 'Navigation',
            open(){ switchView(b.target); }
        }));
    });

})();

// ═════════════════════════════════════════════════════════════════
// UI — barre de recherche, résultats, reconnaissance vocale
// ═════════════════════════════════════════════════════════════════
let __searchDebounce   = null;
let __lastSearchResults = [];
let __speechRecognition = null;

function openGlobalSearch(){
    if(typeof closeWebview==='function') closeWebview();
    if(window.SearchEngine) SearchEngine.rebuild();
    const overlay = document.getElementById('global-search-overlay');
    const input   = document.getElementById('global-search-input');
    if(overlay) overlay.classList.add('active');
    if(input) input.value = '';
    renderSearchResults([], '');
    // Laisser l'animation d'ouverture démarrer avant de forcer le focus
    // (sinon certains WebViews Android ignorent le focus programmatique).
    if(input) setTimeout(()=> input.focus(), 200);

    const micBtn = document.getElementById('global-search-mic');
    const hasVoice = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    if(micBtn) micBtn.style.display = hasVoice ? 'flex' : 'none';
}

function closeGlobalSearch(){
    const overlay = document.getElementById('global-search-overlay');
    if(overlay) overlay.classList.remove('active');
    if(__speechRecognition){
        try { __speechRecognition.stop(); } catch(e){}
    }
    stopVoiceListeningUI();
    const input = document.getElementById('global-search-input');
    if(input){ input.blur(); input.value = ''; }
}

function onGlobalSearchInput(value){
    clearTimeout(__searchDebounce);
    __searchDebounce = setTimeout(()=>{
        const q = (value || '').trim();
        if(!q){ renderSearchResults([], ''); return; }
        const results = window.SearchEngine ? SearchEngine.search(q) : [];
        renderSearchResults(results, q);
    }, 60); // léger différé anti-rafale, la recherche elle-même reste instantanée
}

function renderSearchResults(results, query){
    __lastSearchResults = results;
    const el = document.getElementById('global-search-results');
    if(!el) return;
    if(!query){
        el.innerHTML = `<div class="search-empty-hint">Tapez pour rechercher : missions, agents, équipements, véhicules, procédures, plans…</div>`;
        return;
    }
    if(!results.length){
        el.innerHTML = `
            <div class="search-no-results">
                <div class="search-no-results-icon">🔍</div>
                <p>Aucun résultat trouvé pour « ${escapeSearchHtml(query)} ».</p>
                <button class="btn btn-primary" onclick="closeGlobalSearch();openCreateTaskModal()">➕ Nouvelle mission</button>
                <button class="btn btn-secondary" onclick="closeGlobalSearch();switchView('protocols');openCreateProtocolModal()">🚨 Nouvelle procédure</button>
            </div>`;
        return;
    }
    el.innerHTML = results.map((r, i)=>`
        <div class="search-result-card" onclick="openSearchResult(${i})">
            <div class="search-result-icon">${r.icon}</div>
            <div class="search-result-body">
                <div class="search-result-category">${escapeSearchHtml(r.category)}</div>
                <div class="search-result-title">${escapeSearchHtml(r.title)}</div>
                ${r.summary ? `<div class="search-result-summary">${escapeSearchHtml(r.summary)}</div>` : ''}
                <div class="search-result-location">📍 ${escapeSearchHtml(r.location)}</div>
            </div>
        </div>`).join('');
}

function openSearchResult(i){
    const r = __lastSearchResults[i];
    if(!r) return;
    closeGlobalSearch();
    try { r.open(); }
    catch(e){ console.warn('[SearchEngine] impossible d\'ouvrir ce résultat :', e); }
}

function escapeSearchHtml(s){
    return (s || '').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── Recherche vocale (Web Speech API) ───────────────────────────────
function getSpeechRecognition(){
    if(__speechRecognition) return __speechRecognition;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR) return null;
    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    __speechRecognition = rec;
    return rec;
}

function startVoiceSearch(){
    const rec = getSpeechRecognition();
    const micBtn = document.getElementById('global-search-mic');
    if(!rec){
        showAlarmToast('🎤', 'Recherche vocale', 'Non disponible sur ce navigateur ou cet appareil.', 'warning', 4000);
        return;
    }
    const input     = document.getElementById('global-search-input');
    const indicator = document.getElementById('search-listening-indicator');

    if(micBtn) micBtn.classList.add('listening');
    if(indicator) indicator.style.display = 'flex';

    rec.onresult = function(e){
        let transcript = '';
        for(let i=0;i<e.results.length;i++) transcript += e.results[i][0].transcript;
        input.value = transcript;
        onGlobalSearchInput(transcript);
        if(e.results[e.results.length-1].isFinal){
            stopVoiceListeningUI();
        }
    };
    rec.onerror = function(){ stopVoiceListeningUI(); };
    rec.onend   = function(){ stopVoiceListeningUI(); };

    try { rec.start(); }
    catch(e){ stopVoiceListeningUI(); }
}

function stopVoiceListeningUI(){
    const micBtn    = document.getElementById('global-search-mic');
    const indicator = document.getElementById('search-listening-indicator');
    if(micBtn)    micBtn.classList.remove('listening');
    if(indicator) indicator.style.display = 'none';
}
