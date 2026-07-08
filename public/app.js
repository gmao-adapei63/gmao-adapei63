// ─────────────────────────────────────────────────────────────────
// DOM SAFETY HELPERS — évitent tout TypeError sur élément null/absent.
// Utilisés dans tout le projet (app.js, actions.js, procedures.js,
// ui-customize.js, qrcode-gen.js) : si l'élément n'existe pas encore
// (tuile masquée, modale non montée, etc.), l'opération est simplement
// ignorée au lieu de lancer une exception.
// ─────────────────────────────────────────────────────────────────
function _resolveEl(ref){
    if(ref == null) return null;
    if(typeof ref !== 'string') return ref; // déjà un élément DOM (ou null)
    if(ref.charAt(0) === '.' || ref.charAt(0) === '#' || ref.indexOf(' ') !== -1 || ref.indexOf('[') !== -1){
        try { return document.querySelector(ref); } catch(e){ return null; }
    }
    return document.getElementById(ref);
}
function safeText(ref, value){
    const el = _resolveEl(ref);
    if(el) el.innerText = value;
    return el;
}
function safeContent(ref, value){
    const el = _resolveEl(ref);
    if(el) el.textContent = value;
    return el;
}
function safeHTML(ref, value){
    const el = _resolveEl(ref);
    if(el) el.innerHTML = value;
    return el;
}
function safeStyle(ref, prop, value){
    const el = _resolveEl(ref);
    if(el) el.style[prop] = value;
    return el;
}
function safeDisplay(ref, value){ return safeStyle(ref, 'display', value); }
function safeAddClass(ref, cls){
    const el = _resolveEl(ref);
    if(el) el.classList.add(cls);
    return el;
}
function safeRemoveClass(ref, cls){
    const el = _resolveEl(ref);
    if(el) el.classList.remove(cls);
    return el;
}
function safeToggleClass(ref, cls, force){
    const el = _resolveEl(ref);
    if(el){
        // Important : ne jamais passer "force" explicitement s'il est undefined
        // (classList.toggle(cls, undefined) équivaut à force=false, pas à un
        // toggle "classique" — on distingue donc l'appel à 2 ou 3 arguments).
        if(arguments.length < 3 || force === undefined) el.classList.toggle(cls);
        else el.classList.toggle(cls, force);
    }
    return el;
}
function hasClass(ref, cls){
    const el = _resolveEl(ref);
    return !!(el && el.classList.contains(cls));
}
function safeAppend(ref, child){
    const el = _resolveEl(ref);
    if(el && child) el.appendChild(child);
    return el;
}

// ─────────────────────────────────────────────────────────────────
// ÉTAT & CONFIGURATION
// ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'gmao_tactical_v9';

const DEFAULT_NAV = [
    {id:'home',      icon:'🏠', label:'Accueil',     type:'view', target:'home'},
    {id:'agents',    icon:'👥', label:'Agents',      type:'view', target:'agents'},
    {id:'equipment', icon:'🔑', label:'Équipements', type:'view', target:'equipment'},
    {id:'vehicles',  icon:'🚗', label:'Véhicules',   type:'view', target:'vehicles'},
    {id:'report',    icon:'📊', label:'Rapport',     type:'view', target:'report'},
];
// "Protocoles/Astreinte" et "Plans" ne sont plus des entrées de la barre de
// navigation principale : ils restent accessibles uniquement depuis leurs
// tuiles sur l'écran d'accueil (home-protocols / home-plans, cf. HOME_ELEMENTS).

// ── ÉLÉMENTS DE L'ACCUEIL ────────────────────────────────────────
// Registre EXTENSIBLE des blocs affichés sur la page d'accueil.
// Pour ajouter un futur élément contrôlable : lui donner un id ici + un
// bloc HTML avec cet id dans index.html (voir applyHomeVisibility()).
// Il apparaîtra automatiquement dans la liste "toujours visibles" des Paramètres.
const HOME_ELEMENTS = [
    {id:'home-tiles',     icon:'📊', label:'Tuiles (compteurs)'},
    {id:'home-controls',  icon:'📅', label:'Sélecteur de date + Nouvelle mission'},
    {id:'home-tasklist',  icon:'📋', label:'Liste des missions du jour'},
    {id:'home-protocols', icon:'🚨', label:'Bouton Protocoles / Astreinte'},
    {id:'home-plans',     icon:'🗺️', label:'Bouton Plans'},
];

// Règle horaire appliquée aux éléments de l'ACCUEIL (pas à la barre de nav du bas,
// qui reste toujours complète pour permettre de naviguer partout dans l'appli).
const DEFAULT_HOME_TIME_RULE = {
    enabled: false,
    start: '08:00',
    end: '18:00',
    days: [1,2,3,4,5], // 0=Dim ... 6=Sam (cohérent avec Date.getDay())
    alwaysVisible: ['home-protocols','home-plans']
};

let appState = {
    settings:         {siteName:'IME LA ROUSSILLE'},
    agents:           [],
    equipment:        [],
    vehicles:         [],
    calendar:         {},
    recurringRules:   [],
    deletedInstances: {},
    navConfig:        JSON.parse(JSON.stringify(DEFAULT_NAV)),
    homeTimeRule:     JSON.parse(JSON.stringify(DEFAULT_HOME_TIME_RULE)),
    protocols:        [],   // procédures / modes opératoires / marches dégradées
    plans:            [],   // plans de bâtiments (upload image + futurs calques)
};

// Garantit que les champs ajoutés dans les versions récentes existent toujours,
// quelle que soit la provenance des données (localStorage, import JSON, GitHub, Firebase).
function ensureStateDefaults(){
    if(!appState.recurringRules)   appState.recurringRules   = [];
    if(!appState.deletedInstances) appState.deletedInstances = {};
    if(!appState.navConfig || !appState.navConfig.length) appState.navConfig = JSON.parse(JSON.stringify(DEFAULT_NAV));
    if(!appState.homeTimeRule) appState.homeTimeRule = JSON.parse(JSON.stringify(DEFAULT_HOME_TIME_RULE));
    if(!appState.protocols)   appState.protocols = [];
    // Migration non destructive vers le modèle JSON enrichi des procédures
    // (ancien champ "content" conservé, transformé en première étape).
    if(window.normalizeProcedure) appState.protocols = appState.protocols.map(window.normalizeProcedure);
    if(!appState.plans)       appState.plans = [];
    if(!appState.settings) appState.settings = {siteName:'IME LA ROUSSILLE'};
    // Module transversal "Actions" (Notes / Check-lists / Missions) — V1.
    // Toute la logique de valeurs par défaut vit dans actions.js afin de ne pas
    // disperser le modèle de données du module dans app.js.
    if(window.ActionsEngine) ActionsEngine.ensureDefaults();
    // Migration unique : "Protocoles/Astreinte" et "Plans" sortent de la barre de
    // navigation principale (accessibles uniquement via les tuiles d'accueil).
    // Ne s'exécute qu'une fois, pour ne pas écraser un ré-ajout manuel ultérieur
    // via l'éditeur de navigation des Paramètres.
    if(!appState.settings._navPlansProtocolsRemoved){
        appState.navConfig = appState.navConfig.filter(b => b.id !== 'protocols' && b.id !== 'plans');
        appState.settings._navPlansProtocolsRemoved = true;
    }
    // Reconstruit l'index de recherche à chaque (ré)application de l'état
    // (chargement initial, import, sync GitHub/Firebase/temps réel).
    if(window.SearchEngine) SearchEngine.rebuild();
}

let activeDate      = '';
let activeTaskId    = null;
let activeRecRule   = null;  // règle de récurrence de la mission actuellement ouverte (si récurrente)
let taskEditUnlocked = false; // false = mission existante affichée en lecture seule (⚙️ pour déverrouiller)
let activeAgentId   = null;
let activeEquipId   = null;
let activeVehicleId = null;
let editingNavId    = null;

// QR Scanner — variables déclarées dans la section SCANNER QR ci-dessous

// Drag & Drop
let dragEl=null, dragPlaceholder=null, dragTimer=null, isDragging=false, startY=0, offsetY=0;

// ── AudioContext singleton (doit être débloqué par un geste utilisateur) ──
let _audioCtx = null;
function getAudioCtx(){
    if(!_audioCtx){
        try{ _audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; }
    }
    // Chrome suspend l'AudioContext tant qu'il n'y a pas eu de geste – on le relance
    if(_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
}
// Déverrouiller dès le premier toucher / clic (avant que l'alarme ne se déclenche)
['touchstart','click'].forEach(evt =>
    document.addEventListener(evt, () => getAudioCtx(), {once:true, passive:true})
);

// Alarm tracking (session only – avoid repeats)
const firedAlarms = new Set();

// ─────────────────────────────────────────────────────────────────
// INITIALISATION
// ─────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
    applyStoredTheme();
    loadData();
    safeText('site-name', appState.settings.siteName);

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('system-date').value = today;

    renderBottomNav();
    renderProtocolTabs();
    loadDayData(today);
    renderAgents(); renderEquipment(); renderVehicles();

    requestNotifPermission();
    scheduleDailyNotification();
    setInterval(checkAlarms, 60000); // vérifie chaque minute
    checkAlarms();                   // et tout de suite
    setInterval(applyHomeVisibility, 60000); // réévalue la règle horaire de l'accueil chaque minute
    // Bouton retour Android : intercepter via History API
    // (le traitement du popstate est centralisé dans le "V1.5 Navigation Manager" en bas de fichier)
    history.replaceState({gmao:1},'');
    history.pushState({gmao:2},'');

    // Gestes tactiles : architecture par zones indépendantes (header / tuiles /
    // liste des missions / navbar) — remplace l'ancien gestionnaire global qui
    // provoquait un changement de date lors d'un swipe sur la navbar du bas.
    initializeGestureZones();
    // Gestes globaux restants, indépendants des zones : ouverture du sidebar
    // par un swipe depuis le bord gauche, et fermeture modal/sidebar par swipe.
    initGlobalEdgeGestures();
    // Défilement horizontal desktop (molette + Shift, ou trackpad) pour les
    // zones à plusieurs colonnes (onglets, barre de navigation, futures listes).
    initHorizontalWheelScroll();

    // Sync SharePoint uniquement sur demande manuelle (CORS bloqué depuis file://)
    // startAutoSync() — désactivé; utiliser le bouton "☁️ Sync SharePoint"
});

// ─────────────────────────────────────────────────────────────────
// DÉFILEMENT HORIZONTAL DESKTOP — molette + Shift, ou trackpad (deltaX)
// Délégué sur document : fonctionne aussi pour les zones re-générées
// dynamiquement (onglets protocoles, barre de nav personnalisable, et toute
// future zone marquée .h-scroll) sans avoir à ré-attacher d'écouteur.
// N'intervient jamais sur le défilement vertical normal de la page.
// ─────────────────────────────────────────────────────────────────
function initHorizontalWheelScroll(){
    document.addEventListener('wheel', e=>{
        const zone = e.target.closest('.tabs, .bottom-nav, .h-scroll');
        if(!zone) return;
        if(zone.scrollWidth <= zone.clientWidth) return; // rien à défiler horizontalement

        // Shift + molette (souris) → toujours horizontal
        // Trackpad avec mouvement dominant horizontal (deltaX) → on le laisse faire,
        // sinon on convertit le deltaY en défilement horizontal uniquement si Shift est pressé.
        if(e.shiftKey){
            zone.scrollLeft += (e.deltaY || e.deltaX);
            e.preventDefault();
        } else if(Math.abs(e.deltaX) > Math.abs(e.deltaY)){
            zone.scrollLeft += e.deltaX;
            e.preventDefault();
        }
        // Sinon : molette verticale classique → on laisse le scroll de la page se faire normalement.
    }, {passive:false});
}

// ─────────────────────────────────────────────────────────────────
// GESTES GLOBAUX RESTANTS — bord gauche (sidebar) + fermeture modal/sidebar
// (Le changement de date par swipe est désormais géré exclusivement par la
//  zone "task-list" dans gesture-init.js, pour ne plus interférer avec les
//  autres zones — header, tuiles, navbar.)
// ─────────────────────────────────────────────────────────────────
function initGlobalEdgeGestures(){
    let sx=0, sy=0, st=0;
    const EDGE = 30;       // px depuis le bord gauche pour le swipe-sidebar
    const MIN_DIST = 70;   // px min horizontaux pour valider le swipe
    const MAX_VERT = 60;   // px max verticaux (sinon c'est un scroll)
    const MAX_TIME = 400;  // ms max pour le geste

    document.addEventListener('touchstart', e=>{
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
        st = Date.now();
    }, {passive:true});

    document.addEventListener('touchend', e=>{
        if(isDragging) return;                         // ne pas interférer avec le drag
        const dx = e.changedTouches[0].clientX - sx;
        const dy = e.changedTouches[0].clientY - sy;
        const dt = Date.now() - st;
        if(dt > MAX_TIME) return;                      // trop lent = scroll intentionnel
        if(Math.abs(dy) > MAX_VERT) return;            // trop vertical
        if(Math.abs(dx) < MIN_DIST) return;            // trop court

        // Un modal est ouvert → swipe droite = le fermer (équivalent retour)
        const openModal = document.querySelector('.modal.active');
        if(openModal && dx > 0){
            if(openModal.id==='qrModal') closeScanner();
            else closeModal(openModal.id);
            return;
        }
        if(openModal) return; // pas d'autres actions si modal ouvert

        // Bord gauche + glisse à droite → ouvrir le sidebar
        if(sx <= EDGE && dx > 0){ openSidebar(); return; }

        // Sidebar ouvert + glisse à gauche → le fermer
        if(hasClass('sidebar','active') && dx < 0){
            closeSidebar(); return;
        }
    }, {passive:true});
}

// Fonctions pratiques d'accès direct aux jours depuis la nav
function goToDate(offset){
    const d = new Date(activeDate+'T12:00:00');
    d.setDate(d.getDate()+offset);
    const s = d.toISOString().split('T')[0];
    document.getElementById('system-date').value = s;
    loadDayData(s);
}

// ─────────────────────────────────────────────────────────────────
// THÈME
// ─────────────────────────────────────────────────────────────────
function applyStoredTheme(){
    const t = localStorage.getItem('gmao_theme');
    document.body.classList.toggle('light-mode', t === 'light');
}
function toggleTheme(){
    const light = document.body.classList.toggle('light-mode');
    localStorage.setItem('gmao_theme', light ? 'light' : 'dark');
}

// ─────────────────────────────────────────────────────────────────
// PERSISTANCE — 100% serveur (Firestore), instantané, comme auparavant.
// IMPORTANT : les données de l'application (missions, agents, équipements,
// véhicules, calendrier, protocoles, actions…) ne sont PLUS jamais mises en
// cache dans localStorage. Ce cache local avait cassé la synchronisation :
// chaque appareil affichait sa propre copie figée et les modifications ne se
// propageaient plus (ni après "Enregistrer", ni d'un appareil à l'autre).
// Seules les PRÉFÉRENCES D'AFFICHAGE (thème clair/sombre, densité, disposition
// des tuiles, position du bouton flottant, choix de caméra QR, config GitHub
// locale…) restent en localStorage — elles sont propres à cet appareil et ne
// doivent justement pas être synchronisées. Voir ui-customize.js.
//
// SÉCURITÉ ANTI-ÉCRASEMENT : tant que l'appli n'a pas reçu une PREMIÈRE
// confirmation de l'état réel du serveur (via pullFromFirebase ou le premier
// événement de l'écouteur temps réel), _serverSyncReady reste à false et
// TOUTE écriture vers Firestore est bloquée. Sans cette garde, un appareil
// avec une connexion lente pouvait pousser son état par défaut (vide) avant
// même d'avoir reçu les vraies données — et donc écraser instantanément les
// données de tout le monde (c'est ce qui a provoqué la perte de données
// constatée après le déploiement précédent).
// ─────────────────────────────────────────────────────────────────
const SERVER_BACKUP_URL = '/api/gmao/backup'; // ancien secours Replit — inutilisé sur GitHub Pages, conservé sans effet de bord sur localStorage
let _serverSyncReady = false;          // true seulement après une confirmation réelle du serveur
let _pendingSaveWhileSyncing = false;  // une sauvegarde a été demandée pendant qu'on attendait cette confirmation

function markServerSyncReady(){
    if(_serverSyncReady) return;
    _serverSyncReady = true;
    console.log('🔥 Firestore : état serveur confirmé, écritures autorisées');
    if(_pendingSaveWhileSyncing){
        _pendingSaveWhileSyncing = false;
        pushToFirebase(true); // rattrape la sauvegarde qui avait été mise en attente
    }
}

function loadData(){
    // Récupération immédiate depuis Firestore. L'écouteur temps réel
    // (startRealtimeSync(), démarré par firebase-init.js) prend ensuite le
    // relais pour toute mise à jour ultérieure, instantanément, sur cet
    // appareil comme sur tous les autres connectés au même document.
    pullFromFirebase(true);
    // Filet de sécurité : sur une connexion lente ou instable, on retente
    // régulièrement jusqu'à obtenir une confirmation serveur, pour ne jamais
    // rester bloqué en attente indéfiniment.
    const retry = setInterval(() => {
        if(_serverSyncReady){ clearInterval(retry); return; }
        pullFromFirebase(true);
    }, 4000);
}

function saveData(){
    appState._savedAt = new Date().toISOString();
    updateDashboard();
    if(window.SearchEngine) SearchEngine.rebuild();
    scheduleGitHubPush();
    pushToFirebase(true); // écriture immédiate — la synchronisation entre appareils doit être instantanée, pas différée
}

function pushToServer(){
    if(!navigator.onLine) return; // pas de réseau → on réessaiera au prochain saveData
    fetch(SERVER_BACKUP_URL, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(appState)
    }).catch(()=>{}); // silencieux : Firestore est la seule source de vérité
}

// Sauvegarde immédiate côté serveur (appelée avant fermeture ou export)
function forcePushToServer(){
    pushToServer();
    pushToFirebase(true);
}

// Forcer la push avant de quitter l'app
window.addEventListener('visibilitychange', ()=>{ if(document.hidden) forcePushToServer(); });
window.addEventListener('pagehide', forcePushToServer);


// ─────────────────────────────────────────────────────────────────
// IMPORT / EXPORT JSON
// ─────────────────────────────────────────────────────────────────
function exportDataJSON(){
    const blob = new Blob([JSON.stringify(appState,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gmao_backup_v9_' + new Date().toISOString().split('T')[0] + '.json';
    a.click(); URL.revokeObjectURL(a.href);
}

function triggerImport(){ document.getElementById('import-file-input').value=''; document.getElementById('import-file-input').click(); }

function importJSON(event){
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const imported = JSON.parse(e.target.result);
            if(typeof imported !== 'object' || Array.isArray(imported)) throw new Error('Format invalide');

            const choice = confirm(
                `Fichier : ${file.name}\n` +
                `Agents : ${(imported.agents||[]).length} | Équipements : ${(imported.equipment||[]).length}\n` +
                `Dates calendrier : ${Object.keys(imported.calendar||{}).length}\n` +
                `Règles récurrentes : ${(imported.recurringRules||[]).length}\n\n` +
                `OK = Remplacer toutes les données\nAnnuler = Fusionner (ajoute sans supprimer)`
            );

            if(choice){
                // Remplacement complet
                appState = Object.assign({
                    navConfig: JSON.parse(JSON.stringify(DEFAULT_NAV)),
                    recurringRules:[],
                    deletedInstances:{}
                }, imported);
            } else {
                // Fusion
                appState.agents    = mergeById(appState.agents,    imported.agents    || []);
                appState.equipment = mergeById(appState.equipment,  imported.equipment || []);
                appState.vehicles  = mergeById(appState.vehicles,   imported.vehicles  || []);
                // Fusionner calendrier
                Object.entries(imported.calendar || {}).forEach(([date, tasks]) => {
                    if(!appState.calendar[date]) appState.calendar[date] = [];
                    tasks.forEach(t => {
                        if(!appState.calendar[date].find(x => x.id === t.id))
                            appState.calendar[date].push(t);
                    });
                });
                // Fusionner règles récurrentes
                (imported.recurringRules || []).forEach(r => {
                    if(!appState.recurringRules.find(x => x.id === r.id))
                        appState.recurringRules.push(r);
                });
            }

            ensureStateDefaults();

            saveData();
            safeText('site-name', appState.settings.siteName || 'GMAO');
            loadDayData(activeDate);
            renderAgents(); renderEquipment(); renderVehicles(); renderBottomNav();
            showAlarmToast('✅', 'Import réussi', `${file.name} chargé avec succès.`, 'success');
        } catch(err){
            alert('Erreur lors de l\'import : ' + err.message);
        }
    };
    reader.readAsText(file, 'utf-8');
}

function mergeById(existing, incoming){
    const map = new Map(existing.map(x => [x.id, x]));
    incoming.forEach(x => { if(!map.has(x.id)) map.set(x.id, x); });
    return [...map.values()];
}

// ─────────────────────────────────────────────────────────────────
// RÉCURRENCE À LA VOLÉE
// ─────────────────────────────────────────────────────────────────
function ruleDescription(rule){
    const D = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    let base = '';
    if(rule.recType==='daily')     base = 'Quotidienne';
    else if(rule.recType==='weekly')    base = `Hebdomadaire (chaque ${D[new Date(rule.startDate+'T00:00:00').getDay()]})`;
    else if(rule.recType==='biweekly')  base = 'Tous les 15 jours';
    else if(rule.recType==='monthlyX')  base = `Tous les ${rule.interval||1} mois`;
    else if(rule.recType==='yearlyX')   base = `Tous les ${rule.interval||1} ans`;
    else if(rule.recType==='custom')    base = 'Jours : '+(rule.selectedDays||[]).map(d=>D[d]).join(', ');
    if(rule.endType==='week')          base += ' (cette semaine uniquement)';
    else if(rule.endType==='untilDate' && rule.endDate) base += ` (jusqu'au ${rule.endDate})`;
    return base;
}
function ruleAppliesTo(rule, dateStr){
    const d = new Date(dateStr+'T00:00:00'), s = new Date(rule.startDate+'T00:00:00');
    if(d < s) return false;

    // Condition de fin (s'applique à tous les types de récurrence)
    if(rule.endType === 'untilDate' && rule.endDate){
        const end = new Date(rule.endDate+'T00:00:00');
        if(d > end) return false;
    }
    if(rule.endType === 'week'){
        const weekEnd = new Date(s); weekEnd.setDate(weekEnd.getDate()+6);
        if(d > weekEnd) return false;
    }

    const dow = d.getDay();
    if(rule.recType==='daily')  return true;
    if(rule.recType==='weekly') return dow === s.getDay();
    if(rule.recType==='biweekly'){
        const days = Math.round((d - s) / 86400000);
        return days % 14 === 0;
    }
    if(rule.recType==='monthlyX'){
        const x = Math.max(1, parseInt(rule.interval,10)||1);
        const diffMonths = (d.getFullYear()-s.getFullYear())*12 + (d.getMonth()-s.getMonth());
        if(diffMonths < 0 || diffMonths % x !== 0) return false;
        const daysInTargetMonth = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
        const targetDay = Math.min(s.getDate(), daysInTargetMonth); // borne au dernier jour du mois si besoin (ex: 31 → 28/29/30)
        return d.getDate() === targetDay;
    }
    if(rule.recType==='yearlyX'){
        const x = Math.max(1, parseInt(rule.interval,10)||1);
        const diffYears = d.getFullYear()-s.getFullYear();
        if(diffYears < 0 || diffYears % x !== 0) return false;
        const daysInTargetMonth = new Date(d.getFullYear(), s.getMonth()+1, 0).getDate();
        const targetDay = Math.min(s.getDate(), daysInTargetMonth); // gère le 29 février
        return d.getMonth()===s.getMonth() && d.getDate()===targetDay;
    }
    if(rule.recType==='custom') return (rule.selectedDays||[]).includes(dow);
    return false;
}
// Tri chronologique partagé : heure croissante (les missions sans horaire
// passent en fin de liste), puis par ordre manuel (drag & drop) en cas d'égalité.
function sortTasksChrono(tasks){
    return (tasks||[]).slice().sort((a,b)=>{
        const ta = a.timeStart || '99:99', tb = b.timeStart || '99:99';
        if(ta !== tb) return ta < tb ? -1 : 1;
        return (a.order??0) - (b.order??0);
    });
}

function generateRecurringTasksForDate(dateStr){
    if(!appState.recurringRules)   appState.recurringRules   = [];
    if(!appState.deletedInstances) appState.deletedInstances = {};
    if(!appState.calendar[dateStr]) appState.calendar[dateStr] = [];
    const deleted = appState.deletedInstances[dateStr] || [];
    appState.recurringRules.forEach(rule => {
        if(deleted.includes(rule.id)) return;
        if(!ruleAppliesTo(rule, dateStr)) return;
        if(appState.calendar[dateStr].some(t => t.recRuleId === rule.id)) return;
        appState.calendar[dateStr].push({
            id: rule.id+'_'+dateStr, recRuleId:rule.id,
            title:rule.title, desc:rule.desc||'', type:rule.type||'routine',
            priority:rule.priority||'2', timeStart:rule.timeStart||'', timeEnd:rule.timeEnd||'',
            assignedTo:rule.assignedTo||[], equipment:rule.equipment||[],
            interCompany:'', interName:'', comment:'', service:'',
            completed:false, order:appState.calendar[dateStr].length
        });
    });
}

// ─────────────────────────────────────────────────────────────────
// ÉLÉMENTS ACCUEIL — visibilité selon règle horaire (voir HOME_ELEMENTS)
// ─────────────────────────────────────────────────────────────────

// Renvoie true si "maintenant" est dans la plage horaire/jours définie
// (= tous les éléments de l'accueil sont visibles)
function isWithinActiveHours(rule){
    if(!rule || !rule.enabled) return true; // règle désactivée → toujours tout afficher
    const now = new Date();
    if(!(rule.days||[]).includes(now.getDay())) return false;
    const hm = now.getHours()*60 + now.getMinutes();
    const [sh,sm] = (rule.start||'00:00').split(':').map(Number);
    const [eh,em] = (rule.end  ||'23:59').split(':').map(Number);
    const startMin = sh*60+sm, endMin = eh*60+em;
    if(startMin <= endMin){
        return hm >= startMin && hm <= endMin;
    } else {
        // plage qui traverse minuit (ex: 20:00 → 06:00)
        return hm >= startMin || hm <= endMin;
    }
}
// Affiche/masque les blocs de l'accueil (id listés dans HOME_ELEMENTS) selon la règle.
// Extensible : ajouter un nouvel élément au registre HOME_ELEMENTS suffit, cette
// fonction s'applique automatiquement à tout élément dont l'id existe dans le DOM.
function applyHomeVisibility(){
    const rule = appState.homeTimeRule || DEFAULT_HOME_TIME_RULE;
    const allVisible = isWithinActiveHours(rule);
    const always = rule.alwaysVisible || [];
    HOME_ELEMENTS.forEach(el=>{
        const node = document.getElementById(el.id);
        if(!node) return;
        const visible = allVisible || always.includes(el.id);
        node.style.display = visible ? '' : 'none';
    });
}

// ─────────────────────────────────────────────────────────────────
// CHARGEMENT JOURNÉE
// ─────────────────────────────────────────────────────────────────
function loadDayData(dateStr){
    if(!dateStr) dateStr = document.getElementById('system-date').value;
    activeDate = dateStr;
    generateRecurringTasksForDate(activeDate);
    renderTaskList();
    updateDashboard();
    applyHomeVisibility();
}

// ─────────────────────────────────────────────────────────────────
// RENDU LISTE TÂCHES
// ─────────────────────────────────────────────────────────────────
function renderTaskList(){
    const container = document.getElementById('task-list-container');
    if(!container) return;
    container.innerHTML = '';
    const tasks = sortTasksChrono(appState.calendar[activeDate]||[]);
    if(!tasks.length){
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><p>Aucune mission ce jour.</p></div>`;
        return;
    }
    tasks.forEach(task => {
        const isRec = !!task.recRuleId;
        const card  = document.createElement('div');
        card.className = ['task-card',
            task.type==='particular'?'particular':'',
            isRec && task.type!=='particular'?'recurring':'',
            task.completed?'completed':''
        ].filter(Boolean).join(' ');
        card.dataset.id = task.id;

        let badges = '';
        if(task.timeStart) badges += `<span class="task-time">⏰ ${task.timeStart}${task.timeEnd?' - '+task.timeEnd:''}</span>`;
        if(task.type==='particular') badges += `<span class="badge warning">Spéciale</span>`;
        if(isRec)                    badges += `<span class="badge rec">🔁 Récurrente</span>`;
        if(task.priority==='1')      badges += `<span class="badge danger">🔴 Haute</span>`;

        card.innerHTML = `
            <div class="task-core">
                <input type="checkbox" class="task-checkbox" ${task.completed?'checked':''} onchange="toggleTaskComplete('${task.id}')">
                <div class="task-info">
                    <div class="task-title">${task.title}</div>
                    <div class="task-badges">${badges}</div>
                </div>
            </div>
            <button class="btn-open" onclick="openTaskModal('${task.id}')">📖</button>`;
        card.addEventListener('touchstart', handleTouchStart, {passive:false});
        container.appendChild(card);
    });
}

// ─────────────────────────────────────────────────────────────────
// DRAG & DROP TACTILE (APPUI LONG 400 ms)
// ─────────────────────────────────────────────────────────────────
function handleTouchStart(e){
    if(e.target.closest('input')||e.target.closest('button')) return;
    const card = this;
    const startTouchY = e.touches[0].clientY;
    let moved = false;

    // Si l'utilisateur scrolle (mouvement > 8 px) on annule le timer drag
    const cancelOnMove = ev => {
        if(Math.abs(ev.touches[0].clientY - startTouchY) > 8) { moved = true; clearTimeout(dragTimer); }
    };
    document.addEventListener('touchmove', cancelOnMove, {passive:true});

    dragTimer = setTimeout(()=>{
        document.removeEventListener('touchmove', cancelOnMove);
        if(moved) return; // l'utilisateur scrollait : ne pas démarrer le drag
        isDragging = true; dragEl = card;
        const rect = dragEl.getBoundingClientRect();
        startY = e.touches[0].clientY; offsetY = startY - rect.top;
        dragPlaceholder = document.createElement('div');
        dragPlaceholder.className = 'task-card';
        dragPlaceholder.style.cssText = `opacity:0;height:${rect.height}px;pointer-events:none`;
        dragEl.parentNode.insertBefore(dragPlaceholder, dragEl);
        // Fixer la carte en position absolue pour la déplacer librement
        dragEl.style.cssText = `position:fixed;width:${rect.width}px;left:${rect.left}px;top:${rect.top}px;z-index:2000;touch-action:none`;
        dragEl.classList.add('dragging');
        // Bloquer le scroll de la zone principale pendant le drag
        safeStyle('.main-content', 'overflowY', 'hidden');
        if(navigator.vibrate) navigator.vibrate(50);
        document.addEventListener('touchmove', handleTouchMove, {passive:false});
        document.addEventListener('touchend',  handleTouchEnd);
    }, 400);
}
document.addEventListener('touchend', ()=>{ if(!isDragging) clearTimeout(dragTimer); });

function handleTouchMove(e){
    if(!isDragging) return;
    e.preventDefault(); // bloque le scroll pendant le drag
    const y = e.touches[0].clientY;
    dragEl.style.top = (y - offsetY)+'px';
    const sibs = [...document.querySelectorAll('#task-list-container .task-card:not(.dragging)')].filter(el=>el!==dragPlaceholder);
    const next = sibs.find(s=>{ const r=s.getBoundingClientRect(); return y < r.top+r.height/2; });
    if(next) dragPlaceholder.parentNode.insertBefore(dragPlaceholder,next);
    else     dragPlaceholder.parentNode.appendChild(dragPlaceholder);
}
function handleTouchEnd(){
    if(!isDragging) return; isDragging = false;
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend',  handleTouchEnd);
    // Rétablir le scroll
    safeStyle('.main-content', 'overflowY', 'auto');
    dragEl.style.cssText = ''; dragEl.classList.remove('dragging');
    dragPlaceholder.parentNode.insertBefore(dragEl, dragPlaceholder);
    dragPlaceholder.parentNode.removeChild(dragPlaceholder);
    const ids = [...document.querySelectorAll('#task-list-container .task-card')].map(c=>c.dataset.id);
    const tasks = appState.calendar[activeDate];
    tasks.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));
    tasks.forEach((t,i)=>t.order=i);
    saveData();
}

// ─────────────────────────────────────────────────────────────────
// MODAL MISSION
// ─────────────────────────────────────────────────────────────────
function openCreateTaskModal(){
    activeTaskId = null;
    activeRecRule = null;
    resetTaskForm();
    safeText('task-modal-title', 'Nouvelle Mission');
    safeStyle('btn-delete-task','display', 'none');
    safeStyle('task-edit-toggle','display', 'none'); // rien à déverrouiller en création
    safeStyle('rec-container','display', 'block');
    safeStyle('rec-info-banner','display', 'none');
    safeStyle('delete-confirm-box','display', 'none');
    document.getElementById('task-recurrence').value = 'none';
    toggleRecurrenceDays();
    setTaskFormReadOnly(false); // création : tout est modifiable dès l'ouverture

    // Pré-remplissage automatique : date du jour actuellement affiché + heure actuelle
    document.getElementById('task-date').value = activeDate;
    const now = new Date();
    document.getElementById('task-time-start').value =
        now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');

    populateLists();
    activateFirstTab('taskModal');
    safeAddClass('taskModal','active');
}
function openTaskModal(taskId){
    activeTaskId = taskId;
    const task = (appState.calendar[activeDate]||[]).find(t=>t.id===taskId);
    if(!task) return;
    resetTaskForm();
    safeText('task-modal-title', task.title);
    safeStyle('delete-confirm-box','display', 'none');

    activeRecRule = task.recRuleId ? (appState.recurringRules.find(r=>r.id===task.recRuleId) || null) : null;
    if(activeRecRule){
        safeStyle('rec-container','display', 'none'); // révélé par ⚙️ si besoin
        safeStyle('rec-info-banner','display', 'flex');
        safeText('rec-info-text', `${ruleDescription(activeRecRule)} — depuis le ${activeRecRule.startDate}`);
    } else {
        safeStyle('rec-container','display', 'none');
        safeStyle('rec-info-banner','display', 'none');
    }
    document.getElementById('task-title').value      = task.title;
    document.getElementById('task-desc').value       = task.desc||'';
    document.getElementById('task-date').value       = activeDate;
    document.getElementById('task-time-start').value = task.timeStart||'';
    document.getElementById('task-time-end').value   = task.timeEnd||'';
    document.getElementById('task-type').value       = task.type||'routine';
    document.getElementById('task-priority').value   = task.priority||'2';
    document.getElementById('inter-company').value   = task.interCompany||'';
    document.getElementById('inter-name').value      = task.interName||'';
    document.getElementById('task-comment').value    = task.comment||'';
    document.getElementById('task-service').value    = task.service||'';
    populateLists(task.assignedTo||[], task.equipment||[]);

    // Mission déjà créée → ouverture en lecture seule ; ⚙️ pour tout déverrouiller
    taskEditUnlocked = false;
    setTaskFormReadOnly(true);
    safeStyle('task-edit-toggle','display', 'inline-flex');

    activateFirstTab('taskModal');
    safeAddClass('taskModal','active');
}
function resetTaskForm(){
    ['task-title','task-desc','task-time-start','task-time-end','inter-company','inter-name','task-comment']
        .forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('task-date').value = '';
    document.getElementById('task-recurrence-x').value = '1';
    safeHTML('task-recurrence-end',
        '<option value="forever">Toujours</option><option value="untilDate">Jusqu\'à une date précise</option>');
    document.getElementById('task-recurrence-end').value = 'forever';
    document.getElementById('task-recurrence-end-date').value = '';
    safeStyle('recurrence-end-date-group','display', 'none');
    document.getElementById('task-type').value='routine';
    document.getElementById('task-priority').value='2';
    document.getElementById('task-service').value='';
    document.querySelectorAll('.rec-day').forEach(cb=>cb.checked=false);
    document.querySelectorAll('#task-recurrence option').forEach(o=>o.disabled=false);
}

// ─────────────────────────────────────────────────────────────────
// LECTURE SEULE / DÉVERROUILLAGE — missions déjà créées
// En consultation, toute mission existante s'ouvre en lecture seule ;
// seul le bouton ⚙️ (à gauche du ❌) permet de tout déverrouiller pour
// modification (date, heure, récurrence, priorité, contenu…).
// En création, tout est déjà modifiable (aucun verrou).
// ─────────────────────────────────────────────────────────────────
const TASK_FORM_FIELD_IDS = [
    'task-title','task-desc','task-date','task-time-start','task-time-end',
    'task-type','task-priority','task-service','inter-company','inter-name','task-comment',
    'task-recurrence','task-recurrence-x','task-recurrence-end','task-recurrence-end-date'
];
function setTaskFormReadOnly(readonly){
    TASK_FORM_FIELD_IDS.forEach(id=>{
        const el = document.getElementById(id);
        if(el) el.disabled = readonly;
    });
    document.querySelectorAll('#task-agents-list input, #task-equipment-list input, .rec-day')
        .forEach(cb=>cb.disabled = readonly);
    safeStyle('btn-save-task','display', readonly ? 'none' : 'inline-flex');
    if(readonly) safeStyle('btn-delete-task','display', 'none');
}
// Appelé par le bouton ⚙️ : déverrouille tous les champs d'une mission déjà
// créée, et révèle le panneau de récurrence (pré-rempli) si elle en a une.
function unlockTaskEdit(){
    taskEditUnlocked = true;
    setTaskFormReadOnly(false);
    safeStyle('task-edit-toggle','display', 'none');
    safeStyle('btn-delete-task','display', 'inline-flex');

    if(activeRecRule){
        safeStyle('rec-container','display', 'block');
        safeStyle('rec-info-banner','display', 'none');
        document.getElementById('task-recurrence').value = activeRecRule.recType;
        document.querySelectorAll('.rec-day').forEach(cb=>{
            cb.checked = (activeRecRule.selectedDays||[]).includes(parseInt(cb.value));
        });
        document.getElementById('task-recurrence-x').value = activeRecRule.interval || 1;
        toggleRecurrenceDays();
        document.getElementById('task-recurrence-end').value = activeRecRule.endType || 'forever';
        toggleRecurrenceEndDate();
        document.getElementById('task-recurrence-end-date').value = activeRecRule.endDate || '';
        // On ne retire pas la récurrence depuis cet écran (il faut utiliser Supprimer → "Toutes les occurrences")
        const noneOpt = document.getElementById('task-recurrence').querySelector('option[value="none"]');
        if(noneOpt) noneOpt.disabled = true;
    }
}
function toggleRecurrenceDays(){
    const val = document.getElementById('task-recurrence').value;
    safeStyle('recurrence-days','display', val==='custom' ? 'block' : 'none');
    const intervalGroup = document.getElementById('recurrence-interval');
    const intervalLabel = document.getElementById('recurrence-interval-label');
    if(val==='monthlyX' || val==='yearlyX'){
        if(intervalGroup) intervalGroup.style.display = 'block';
        if(intervalLabel) intervalLabel.innerText = val==='monthlyX' ? 'Tous les combien de mois ?' : 'Tous les combien d\'années ?';
    } else {
        if(intervalGroup) intervalGroup.style.display = 'none';
    }
    updateRecurrenceEndOptions(val);
}
// Les jours spécifiques peuvent se limiter à "cette semaine" ; toutes les
// autres récurrences se terminent "toujours" ou "à une date précise".
function updateRecurrenceEndOptions(recType){
    const sel = document.getElementById('task-recurrence-end');
    if(!sel) return;
    const current = sel.value;
    const options = recType==='custom'
        ? [['forever','Toujours'],['week','Pour cette semaine'],['untilDate',"Jusqu'à une date précise"]]
        : [['forever','Toujours'],['untilDate',"Jusqu'à une date précise"]];
    sel.innerHTML = options.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
    sel.value = options.some(o=>o[0]===current) ? current : 'forever';
    toggleRecurrenceEndDate();
}
function toggleRecurrenceEndDate(){
    const recEndEl = document.getElementById('task-recurrence-end');
    const isUntilDate = recEndEl ? recEndEl.value === 'untilDate' : false;
    safeStyle('recurrence-end-date-group', 'display', isUntilDate ? 'block' : 'none');
}
function populateLists(selA=[], selE=[]){
    safeHTML('task-agents-list',
        appState.agents.map(a=>`<label style="display:flex;gap:8px;padding:6px;align-items:center">
            <input type="checkbox" value="${a.id}" ${selA.includes(a.id)?'checked':''}> ${a.name}</label>`).join(''));
    safeHTML('task-equipment-list',
        appState.equipment.map(e=>`<label style="display:flex;gap:8px;padding:6px;align-items:center">
            <input type="checkbox" value="${e.id}" ${selE.includes(e.id)?'checked':''}> ${e.name}</label>`).join(''));
}

// ─────────────────────────────────────────────────────────────────
// SAUVEGARDE MISSION
// ─────────────────────────────────────────────────────────────────
function saveTask(){
    const title = document.getElementById('task-title').value.trim();
    if(!title){ alert('Titre requis'); return; }
    const dateVal = document.getElementById('task-date').value || activeDate;
    const data = {
        title, desc:document.getElementById('task-desc').value,
        type:document.getElementById('task-type').value,
        priority:document.getElementById('task-priority').value,
        timeStart:document.getElementById('task-time-start').value,
        timeEnd:document.getElementById('task-time-end').value,
        assignedTo:[...document.querySelectorAll('#task-agents-list input:checked')].map(c=>c.value),
        equipment: [...document.querySelectorAll('#task-equipment-list input:checked')].map(c=>c.value),
        interCompany:document.getElementById('inter-company').value,
        interName:document.getElementById('inter-name').value,
        comment:document.getElementById('task-comment').value,
        service:document.getElementById('task-service').value,
    };
    let movedTo = null; // date de destination si la mission a été déplacée

    if(activeTaskId){
        const oldList = appState.calendar[activeDate] || [];
        const task = oldList.find(t=>t.id===activeTaskId);
        if(task){
            Object.assign(task, data);
            // Déplacement vers une autre date : autorisé pour n'importe quelle
            // mission, y compris une occurrence récurrente (ne déplace que cette
            // occurrence précise ; le planning de la règle n'est pas affecté).
            if(dateVal !== activeDate){
                appState.calendar[activeDate] = oldList.filter(t=>t.id!==activeTaskId);
                if(!appState.calendar[dateVal]) appState.calendar[dateVal] = [];
                task.order = appState.calendar[dateVal].length;
                appState.calendar[dateVal].push(task);
                movedTo = dateVal;
            }
            // Édition déverrouillée (⚙️) d'une mission récurrente : met à jour le
            // planning de la règle elle-même (fréquence, jours, intervalle, fin).
            if(activeRecRule && taskEditUnlocked){
                const recType = document.getElementById('task-recurrence').value;
                activeRecRule.recType = recType;
                activeRecRule.selectedDays = recType==='custom'
                    ? [...document.querySelectorAll('.rec-day:checked')].map(c=>parseInt(c.value)) : [];
                activeRecRule.interval = (recType==='monthlyX' || recType==='yearlyX')
                    ? Math.max(1, parseInt(document.getElementById('task-recurrence-x').value,10)||1) : null;
                activeRecRule.endType = document.getElementById('task-recurrence-end').value;
                activeRecRule.endDate = activeRecRule.endType==='untilDate'
                    ? document.getElementById('task-recurrence-end-date').value : null;
            }
        }
    } else {
        const recType = document.getElementById('task-recurrence').value;
        if(recType !== 'none'){
            const selectedDays = recType==='custom'
                ? [...document.querySelectorAll('.rec-day:checked')].map(c=>parseInt(c.value)) : [];
            const interval = (recType==='monthlyX' || recType==='yearlyX')
                ? Math.max(1, parseInt(document.getElementById('task-recurrence-x').value,10)||1) : null;
            const endType = document.getElementById('task-recurrence-end').value;
            const endDate = endType==='untilDate' ? document.getElementById('task-recurrence-end-date').value : null;
            const rule = {id:generateUUID(), startDate:dateVal, recType, selectedDays, interval, endType, endDate, ...data};
            appState.recurringRules.push(rule);
            generateRecurringTasksForDate(dateVal);
        } else {
            if(!appState.calendar[dateVal]) appState.calendar[dateVal]=[];
            appState.calendar[dateVal].push({...data, id:generateUUID(), recRuleId:null,
                order:appState.calendar[dateVal].length, completed:false});
        }
        if(dateVal !== activeDate) movedTo = dateVal;
    }

    saveData(); closeModal('taskModal');
    if(movedTo){
        // La mission a été créée/déplacée sur une autre date : on suit la mission
        document.getElementById('system-date').value = movedTo;
        loadDayData(movedTo);
    } else {
        renderTaskList();
    }
}

// ─────────────────────────────────────────────────────────────────
// SUPPRESSION MISSION
// ─────────────────────────────────────────────────────────────────
function askDeleteTask(){
    const task=(appState.calendar[activeDate]||[]).find(t=>t.id===activeTaskId);
    if(!task) return;
    if(task.recRuleId){ safeStyle('delete-confirm-box','display', 'block'); }
    else { appState.calendar[activeDate]=appState.calendar[activeDate].filter(t=>t.id!==activeTaskId); saveData(); closeModal('taskModal'); renderTaskList(); }
}
function deleteThisOccurrence(){
    const task=(appState.calendar[activeDate]||[]).find(t=>t.id===activeTaskId);
    if(!task) return;
    appState.calendar[activeDate]=appState.calendar[activeDate].filter(t=>t.id!==activeTaskId);
    if(task.recRuleId){
        if(!appState.deletedInstances[activeDate]) appState.deletedInstances[activeDate]=[];
        if(!appState.deletedInstances[activeDate].includes(task.recRuleId))
            appState.deletedInstances[activeDate].push(task.recRuleId);
    }
    saveData(); closeModal('taskModal'); renderTaskList();
}
function deleteEntireRule(){
    const task=(appState.calendar[activeDate]||[]).find(t=>t.id===activeTaskId);
    if(!task||!task.recRuleId) return;
    const rid=task.recRuleId;
    appState.recurringRules=appState.recurringRules.filter(r=>r.id!==rid);
    Object.keys(appState.calendar).forEach(d=>{ appState.calendar[d]=appState.calendar[d].filter(t=>t.recRuleId!==rid); });
    saveData(); closeModal('taskModal'); renderTaskList();
}
function toggleTaskComplete(id){
    const t=(appState.calendar[activeDate]||[]).find(t=>t.id===id);
    if(t) t.completed=!t.completed;
    saveData(); renderTaskList();
}

// ─────────────────────────────────────────────────────────────────
// TUILES DASHBOARD → MODAL CLIQUABLE
// ─────────────────────────────────────────────────────────────────
function openTileModal(type){
    const tasks = sortTasksChrono(appState.calendar[activeDate] || []);
    const now   = new Date();
    const hhmm  = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
    const isToday = activeDate === new Date().toISOString().split('T')[0];
    let title='', items=[];

    if(type==='completed'){
        title = '✅ Missions Complétées';
        items = tasks.filter(t=>t.completed).map(t=>({
            dot:'success', title:t.title,
            sub: t.timeStart?`⏰ ${t.timeStart}`:'Aucun horaire',
            action:()=>{ closeModal('tileModal'); openTaskModal(t.id); }
        }));
    } else if(type==='pending'){
        title = '⏳ Missions En Cours';
        items = tasks.filter(t=>!t.completed).map(t=>({
            dot:'warning', title:t.title,
            sub: t.timeStart?`⏰ ${t.timeStart}`:'Aucun horaire',
            action:()=>{ closeModal('tileModal'); openTaskModal(t.id); }
        }));
    } else if(type==='agents'){
        title = '👥 Agents Actifs';
        items = appState.agents.map(a=>({
            dot:'info', title:a.name,
            sub:`${a.role||''}${a.service?' — '+a.service:''}`,
            action:()=>{ closeModal('tileModal'); openAgentModal(a.id); }
        }));
    } else if(type==='alerts'){
        title = '🚨 Alertes — Missions en Retard';
        items = tasks.filter(t=>!t.completed && t.timeEnd && isToday && t.timeEnd < hhmm).map(t=>({
            dot:'danger', title:t.title,
            sub:`Devait finir à ${t.timeEnd}`,
            action:()=>{ closeModal('tileModal'); openTaskModal(t.id); }
        }));
    }

    safeText('tile-modal-title', title);
    const body = document.getElementById('tile-modal-body');
    if(!body) return;
    if(!items.length){
        body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏆</div><p>Aucun élément ici.</p></div>`;
    } else {
        body.innerHTML = items.map((_,i)=>`
            <div class="info-list-item" id="tile-item-${i}">
                <div class="info-list-dot ${items[i].dot}"></div>
                <div class="info-list-text">
                    <div class="info-list-title">${items[i].title}</div>
                    <div class="info-list-sub">${items[i].sub}</div>
                </div>
                <span style="color:var(--primary-light);font-size:.9rem">›</span>
            </div>`).join('');
        items.forEach((_,i)=>{
            document.getElementById('tile-item-'+i).addEventListener('click', items[i].action);
        });
    }
    safeAddClass('tileModal','active');
}

// ─────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────
function updateDashboard(){
    try {
        const tasks  = appState.calendar[activeDate] || [];
        const now    = new Date();
        const hhmm   = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
        const isToday = activeDate === new Date().toISOString().split('T')[0];
        const alerts = tasks.filter(t=>!t.completed && t.timeEnd && isToday && t.timeEnd < hhmm).length;

        const tileCompleted = document.getElementById('tile-completed');
        if(tileCompleted) tileCompleted.innerText = tasks.filter(t=>t.completed).length;

        const tilePending = document.getElementById('tile-pending');
        if(tilePending) tilePending.innerText = tasks.filter(t=>!t.completed).length;

        const tileAgents = document.getElementById('tile-agents');
        if(tileAgents) tileAgents.innerText = (appState.agents || []).length;

        const tileAlerts = document.getElementById('tile-alerts');
        if(tileAlerts) tileAlerts.innerText = alerts;
    } catch(e){
        console.warn('updateDashboard: erreur ignorée', e);
    }
}

// ─────────────────────────────────────────────────────────────────
// ALARMES SONORES & NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────
function requestNotifPermission(){
    // L'API Notification exige HTTPS ou localhost.
    // Depuis un fichier local (file://) les notifications système Android ne fonctionnent PAS.
    // Le toast visuel + le son sont les alternatives fiables.
    const banner = document.getElementById('notif-banner-container');
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';

    if(!('Notification' in window) || !isSecure){
        if(banner) banner.innerHTML = `
            <div class="notif-banner">
                <span>⚠️ Les notifications Android nécessitent HTTPS. Le son + le toast visuel fonctionnent.</span>
                <button class="btn btn-sm btn-secondary" onclick="playAlarmSound(true);showAlarmToast('🔔','Test alarme','Son + toast fonctionnels','warning',5000)" style="white-space:nowrap">🔊 Tester</button>
            </div>`;
        return;
    }
    Notification.requestPermission().then(perm=>{
        if(perm==='granted' && banner) banner.innerHTML='';
        else if(banner) banner.innerHTML=`
            <div class="notif-banner">
                <span>🔔 Autorisez les notifications pour recevoir les alertes dans la barre Android.</span>
                <button class="btn btn-sm btn-primary" onclick="requestNotifPermission()">Autoriser</button>
            </div>`;
    });
}

function playAlarmSound(urgent=false){
    // Utilise le singleton déjà déverrouillé par le premier geste utilisateur
    const ctx = getAudioCtx();
    if(!ctx) return;
    // Si toujours suspendu (pas encore de geste), on ne peut pas jouer
    if(ctx.state === 'suspended'){ ctx.resume().then(()=>playAlarmSound(urgent)); return; }
    try {
        const freq = urgent ? [660,880,660,1000] : [660,880];
        freq.forEach((f,i)=>{
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = urgent ? 'square' : 'sine';
            osc.frequency.value = f;
            const t = ctx.currentTime + i * 0.3;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.5, t + 0.04);
            gain.gain.linearRampToValueAtTime(0,   t + 0.25);
            osc.start(t);
            osc.stop(t + 0.28);
        });
    } catch(e){ console.warn('Son alarme:', e); }
}

function sendNotification(title, body){
    if('Notification' in window && Notification.permission==='granted')
        new Notification(title, {body, icon:'', tag:title});
}

function showAlarmToast(icon, title, sub, type='warning', duration=7000){
    const toast    = document.getElementById('alarm-toast');
    const card     = document.createElement('div');
    card.className = `alarm-card ${type==='danger'?'danger':''}`;
    card.innerHTML = `
        <div class="alarm-icon">${icon}</div>
        <div class="alarm-body">
            <div class="alarm-title">${title}</div>
            <div class="alarm-sub">${sub}</div>
        </div>
        <button class="alarm-close" onclick="this.closest('.alarm-card').remove()">×</button>`;
    toast.appendChild(card);
    setTimeout(()=>{ if(card.parentNode) card.remove(); }, duration);
}

function checkAlarms(){
    const today  = new Date().toISOString().split('T')[0];
    if(!appState.calendar[today]) return;
    const now    = new Date();
    const curMin = now.getHours()*60 + now.getMinutes();
    const tasks  = appState.calendar[today];

    tasks.forEach(task=>{
        if(task.completed || !task.timeStart) return;
        const [h,m] = task.timeStart.split(':').map(Number);
        const taskMin = h*60+m;
        const diff = taskMin - curMin;

        // 10 min avant
        if(diff >= 9 && diff <= 11){
            const key = `pre_${task.id}_${today}`;
            if(!firedAlarms.has(key)){
                firedAlarms.add(key);
                playAlarmSound(false);
                showAlarmToast('⏰', `Dans 10 min : ${task.title}`, `Début prévu à ${task.timeStart}`, 'warning', 10000);
                sendNotification(`⏰ Dans 10 min : ${task.title}`, `Mission prévue à ${task.timeStart}`);
            }
        }
        // À l'heure pile (0-1 min)
        if(diff >= 0 && diff <= 1){
            const key = `now_${task.id}_${today}`;
            if(!firedAlarms.has(key)){
                firedAlarms.add(key);
                playAlarmSound(true);
                showAlarmToast('🚨', `MAINTENANT : ${task.title}`, `Mission à démarrer maintenant (${task.timeStart})`, 'danger', 15000);
                sendNotification(`🚨 MAINTENANT : ${task.title}`, `Mission à démarrer à ${task.timeStart}`);
            }
        }
    });
}

function scheduleDailyNotification(){
    const now  = new Date();
    const fire = new Date(now);
    fire.setHours(6,55,0,0);
    if(fire <= now) fire.setDate(fire.getDate()+1); // demain si déjà passé
    const delay = fire - now;

    setTimeout(()=>{
        const today = new Date().toISOString().split('T')[0];
        const tasks = appState.calendar[today] || [];
        if(tasks.length){
            const msg = `${tasks.length} mission(s) aujourd'hui. Première : ${tasks.sort((a,b)=>(a.timeStart||'99')>(b.timeStart||'99')?1:-1)[0]?.title||'—'}`;
            sendNotification('📋 Résumé journée GMAO', msg);
            showAlarmToast('📋', 'Résumé de la journée', msg, 'info', 12000);
        }
        scheduleDailyNotification(); // re-programmer pour le lendemain
    }, delay);
}

// ─────────────────────────────────────────────────────────────────
// ÉDITEUR BOUTONS BOTTOM NAV
// ─────────────────────────────────────────────────────────────────
function openNavEditorModal(){
    renderNavButtonsList();
    safeAddClass('navEditorModal','active');
}
function renderNavButtonsList(){
    const list = document.getElementById('nav-buttons-list');
    if(!list) return;
    if(!appState.navConfig.length){
        list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🧩</div><p>Aucun bouton configuré.</p></div>`;
        return;
    }
    list.innerHTML = appState.navConfig.map((btn,i) => `
        <div class="nav-btn-editor-row">
            <div class="nav-btn-editor-icon">${btn.icon}</div>
            <div class="nav-btn-editor-info">
                <div class="nav-btn-editor-label">${btn.label}</div>
                <div class="nav-btn-editor-type">${typeLabel(btn.type)} ${btn.type==='view'?'→ '+btn.target: '→ '+(btn.target||btn.url||'')}</div>
            </div>
            <div class="nav-btn-editor-actions">
                ${i>0 ? `<button class="btn btn-secondary btn-sm" onclick="moveNav(${i},-1)">↑</button>` : ''}
                ${i<appState.navConfig.length-1 ? `<button class="btn btn-secondary btn-sm" onclick="moveNav(${i},1)">↓</button>` : ''}
                <button class="btn btn-warning btn-sm" onclick="openNavButtonForm('${btn.id}')">✏️</button>
            </div>
        </div>`).join('');
}
function typeLabel(t){ return {view:'Vue',url:'URL',android:'Android',ios:'iOS',windows:'Windows'}[t]||t; }
function moveNav(idx, dir){
    const arr = appState.navConfig;
    const newIdx = idx+dir;
    if(newIdx<0||newIdx>=arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    saveData(); renderNavButtonsList(); renderBottomNav();
}

function openNavButtonForm(id){
    editingNavId = id;
    const btn = id ? appState.navConfig.find(b=>b.id===id) : null;
    safeText('nav-form-title', btn ? 'Modifier Bouton' : 'Nouveau Bouton');
    document.getElementById('nav-icon').value         = btn?.icon   || '🔗';
    document.getElementById('nav-label').value        = btn?.label  || '';
    document.getElementById('nav-type').value         = btn?.type   || 'view';
    document.getElementById('nav-view-target').value  = btn?.target || 'home';
    document.getElementById('nav-target-url').value   = (btn?.type!=='view' ? btn?.target : '') || '';
    safeStyle('nav-btn-delete','display', btn ? 'inline-flex' : 'none');
    toggleNavTarget();
    safeAddClass('navButtonFormModal','active');
}
function toggleNavTarget(){
    const t = document.getElementById('nav-type').value;
    safeStyle('nav-view-group','display', t==='view' ? 'block' : 'none');
    safeStyle('nav-url-group','display', t!=='view' ? 'block' : 'none');
}
function saveNavButton(){
    const icon  = document.getElementById('nav-icon').value.trim()  || '🔗';
    const label = document.getElementById('nav-label').value.trim() || 'Bouton';
    const type  = document.getElementById('nav-type').value;
    const target = type==='view'
        ? document.getElementById('nav-view-target').value
        : document.getElementById('nav-target-url').value.trim();

    if(editingNavId){
        const btn = appState.navConfig.find(b=>b.id===editingNavId);
        if(btn) Object.assign(btn, {icon,label,type,target});
    } else {
        appState.navConfig.push({id:generateUUID(), icon,label,type,target});
    }
    saveData(); renderNavButtonsList(); renderBottomNav();
    closeModal('navButtonFormModal');
}
function deleteNavButton(){
    if(!editingNavId) return;
    if(!confirm('Supprimer ce bouton ?')) return;
    appState.navConfig = appState.navConfig.filter(b=>b.id!==editingNavId);
    saveData(); renderNavButtonsList(); renderBottomNav();
    closeModal('navButtonFormModal');
}

// ─────────────────────────────────────────────────────────────────
// NAVIGATION / BOTTOM NAV
// (toujours complète — la restriction horaire s'applique à l'ACCUEIL,
//  voir plus bas "ÉLÉMENTS ACCUEIL")
// ─────────────────────────────────────────────────────────────────
function renderBottomNav(){
    const nav = document.getElementById('bottom-nav');
    if(!nav) return;
    nav.innerHTML = (appState.navConfig||DEFAULT_NAV).map(btn=>`
        <button class="nav-item" data-id="${btn.id}" data-type="${btn.type}" data-target="${btn.target||''}"
            onclick="navItemClick('${btn.id}')">
            <span class="nav-icon">${btn.icon}</span>${btn.label}
        </button>`).join('');
    // Marquer actif la première vue
    highlightNav(activeDate ? '' : 'home');
}
function navItemClick(id){
    const btn = (appState.navConfig||[]).find(b=>b.id===id);
    if(!btn) return;
    if(btn.type==='view'){
        switchView(btn.target);
        highlightNav(id);
    } else {
        // Ouvrir URL / lien appli
        window.open(btn.target, '_blank');
    }
}
function highlightNav(id){
    document.querySelectorAll('.nav-item').forEach(el=>{
        el.classList.toggle('active', el.dataset.id===id);
    });
}
function toggleSidebar(){ safeToggleClass('.sidebar','active'); safeToggleClass('.sidebar-overlay','active'); }
function closeSidebar()  { safeRemoveClass('.sidebar','active');  safeRemoveClass('.sidebar-overlay','active'); }
function switchViewFromSidebar(v){ switchView(v); closeSidebar(); }

// ── Pile de navigation entre vues (V1.5) ──────────────────────────
// Permet au bouton Retour de remonter vue par vue jusqu'à l'accueil
// avant de proposer le "double retour pour quitter".
let __viewStack   = [];      // vues visitées avant la vue courante
let __currentView = 'home';  // vue actuellement affichée

function switchView(viewName, _isBack){
    // On empile la vue précédente uniquement lors d'une navigation "avant"
    // (pas lors d'un retour arrière, sinon la pile ne se viderait jamais)
    if(!_isBack && viewName !== __currentView){
        __viewStack.push(__currentView);
    }
    __currentView = viewName;

    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    const el = document.getElementById('view-'+viewName);
    if(el) el.classList.add('active');
    // Trouver le bouton nav correspondant (type=view, target=viewName)
    const navBtn = (appState.navConfig||[]).find(b=>b.type==='view'&&b.target===viewName);
    highlightNav(navBtn?.id||'');
    // Sync sidebar
    document.querySelectorAll('.sidebar-item').forEach(s=>s.classList.remove('active'));
    const sideBtn = document.querySelector(`.sidebar-item[onclick*="'${viewName}'"]`);
    if(sideBtn) sideBtn.classList.add('active');
    if(viewName==='home')      loadDayData(activeDate);
    if(viewName==='report')    renderReportPreview();
    if(viewName==='protocols') renderProtocols();
    if(viewName==='plans')     renderPlans();
}
function switchTab(tabId, btnEl){
    const root = btnEl.closest('.modal-content');
    if(!root) return;
    root.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
    root.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    const t = root.querySelector('#'+tabId);
    if(t) t.classList.add('active');
    if(btnEl) btnEl.classList.add('active');
}
function activateFirstTab(modalId){
    const modal = document.getElementById(modalId);
    if(!modal) return;
    modal.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
    modal.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    const first = modal.querySelector('.tab-content');
    const firstBtn = modal.querySelector('.tab-btn');
    if(first) first.classList.add('active');
    if(firstBtn) firstBtn.classList.add('active');
}

// ─────────────────────────────────────────────────────────────────
// SCANNER — getUserMedia + ZXing (moteur principal) + BarcodeDetector (accélération native optionnelle)
// ─────────────────────────────────────────────────────────────────
let _qrStream        = null;   // MediaStream actif
let _qrLoop          = null;   // setInterval handle (~15 images/s)
let _qrDetector      = null;   // BarcodeDetector instance (si dispo — bonus de rapidité uniquement)
let _qrZXingReader   = null;   // ZXing.MultiFormatReader (moteur principal, toujours fiable)
let _qrDone          = false;  // évite les détections multiples
let _qrTrack         = null;   // VideoTrack actif (pour zoom/flash/focus)
let _qrTorchOn        = false;
let _qrCameraList     = [];    // liste des caméras vidéo disponibles (après 1ère autorisation)
let _qrActiveCameraId = '';    // deviceId de la caméra actuellement utilisée
const QR_CAMERA_STORAGE_KEY = 'gmao_scanner_camera_id';

function setQrStatus(msg){
    const el = document.getElementById('qr-status');
    if(el) el.innerText = msg;
}

async function openScanner(){
    _qrDone = false;
    _qrTorchOn = false;
    safeRemoveClass('qrModal','qr-detected');
    safeAddClass('qrModal','active');
    safeStyle('qr-manual','display', 'none');
    safeStyle('qr-zoom-controls','display', 'none');
    safeStyle('qr-camera-picker','display', 'none');
    setQrStatus('🟡 Démarrage caméra…');

    const started = await startQrCameraStream();
    if(!started) return; // message d'erreur déjà affiché par startQrCameraStream()

    startQrDetectionLoop();
}

// ── Sélection de caméra : évite les capteurs IR/thermiques/monochromes, ──────
// mémorise le dernier choix manuel, et bascule automatiquement sur la
// meilleure caméra arrière couleur disponible.
function _isMonoOrIRCameraLabel(label){
    return /(infrarouge|infrared|\bir\b|mono(chrome)?|profondeur|depth|\btof\b|thermal|thermique|iris)/i.test(label || '');
}
function _scoreCameraLabel(label){
    const l = (label || '').toLowerCase();
    if(_isMonoOrIRCameraLabel(l)) return -100; // écarte les capteurs IR/thermiques/mono
    let score = 0;
    if(/back|rear|arri[eè]re|environment/.test(l)) score += 10;
    if(/front|user|selfie|avant/.test(l)) score -= 20;
    if(/wide/.test(l) && !/ultra|macro/.test(l)) score += 3; // objectif grand-angle principal
    return score;
}
async function refreshQrCameraList(){
    let devices = [];
    try { devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); }
    catch(_){ devices = []; }
    _qrCameraList = devices;
    return devices;
}
function pickBestQrCameraId(devices){
    const saved = localStorage.getItem(QR_CAMERA_STORAGE_KEY);
    if(saved && devices.some(d => d.deviceId === saved)) return saved;
    if(!devices.length) return null;
    let best = devices[0], bestScore = -Infinity;
    devices.forEach(d => { const s = _scoreCameraLabel(d.label); if(s > bestScore){ bestScore = s; best = d; } });
    return best.deviceId || null;
}
function populateQrCameraSelect(devices){
    const picker = document.getElementById('qr-camera-picker');
    const select = document.getElementById('qr-camera-select');
    if(!devices || devices.length <= 1){ if(picker) picker.style.display = 'none'; if(select) select.innerHTML = ''; return; }
    if(select){
        select.innerHTML = devices.map((d, i) => `<option value="${d.deviceId}">${d.label || ('Caméra ' + (i + 1))}</option>`).join('');
        if(_qrActiveCameraId) select.value = _qrActiveCameraId;
    }
    if(picker) picker.style.display = 'block';
}
// Démarre (ou relance) le flux caméra. Sans deviceId : choisit automatiquement
// la meilleure caméra arrière couleur (ou le dernier choix mémorisé). Avec
// deviceId : force cette caméra précise (sélection manuelle).
async function startQrCameraStream(preferredDeviceId){
    stopQrStream(); // libère une éventuelle caméra déjà active, sans fermer le modal
    const video = document.getElementById('qr-video');
    const baseVideoConstraints = {
        width:  { ideal: 1920 },
        height: { ideal: 1080 },
        // Mise au point / exposition / balance des blancs continues quand le
        // matériel le permet — corrige le flou et les images trop sombres.
        advanced: [{ focusMode: 'continuous' }, { exposureMode: 'continuous' }, { whiteBalanceMode: 'continuous' }]
    };
    try {
        const constraints = preferredDeviceId
            ? { video: { ...baseVideoConstraints, deviceId: { exact: preferredDeviceId } }, audio: false }
            : { video: { ...baseVideoConstraints, facingMode: { ideal: 'environment' } }, audio: false };
        _qrStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch(err){
        setQrStatus('🔴 Caméra indisponible : ' + err.message);
        safeStyle('qr-manual','display', 'block');
        return false;
    }

    video.srcObject = _qrStream;
    await new Promise(res => { video.onloadedmetadata = () => { video.play().then(res).catch(res); }; });

    const canvas = document.getElementById('qr-canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;

    _qrTrack = _qrStream.getVideoTracks()[0] || null;
    const settings = (_qrTrack && _qrTrack.getSettings) ? (_qrTrack.getSettings() || {}) : {};
    _qrActiveCameraId = settings.deviceId || preferredDeviceId || '';
    setupQrCameraControls(_qrTrack);

    // Énumère les caméras (labels disponibles seulement après une 1ère autorisation)
    // et bascule automatiquement sur la meilleure caméra arrière couleur si aucun
    // choix précis n'a été demandé et que la caméra active n'est pas déjà la meilleure.
    const devices = await refreshQrCameraList();
    if(!preferredDeviceId){
        const bestId = pickBestQrCameraId(devices);
        if(bestId && bestId !== _qrActiveCameraId){
            return startQrCameraStream(bestId); // relance avec le device précis choisi
        }
    }
    if(_qrActiveCameraId) localStorage.setItem(QR_CAMERA_STORAGE_KEY, _qrActiveCameraId);
    populateQrCameraSelect(devices);

    setQrStatus('🟢 Caméra prête');
    return true;
}
// Changement manuel de caméra depuis le sélecteur.
async function switchScannerCamera(deviceId){
    if(!deviceId) return;
    _qrDone = false;
    safeRemoveClass('qrModal','qr-detected');
    setQrStatus('🟡 Changement de caméra…');
    const ok = await startQrCameraStream(deviceId);
    if(ok) startQrDetectionLoop();
}
// Libère la caméra active (utilisé avant un changement de caméra et à la fermeture).
function stopQrStream(){
    if(_qrLoop){ clearInterval(_qrLoop); _qrLoop = null; }
    if(_qrTorchOn && _qrTrack){ _qrTrack.applyConstraints({advanced:[{torch:false}]}).catch(()=>{}); }
    _qrTorchOn = false;
    if(_qrStream){ _qrStream.getTracks().forEach(t => t.stop()); _qrStream = null; }
    _qrTrack = null;
}

// ── Zoom natif x1/x2/x3 + flash (torche), avec repli zoom numérique (CSS) ──
// si le matériel ne propose pas de zoom optique/natif piloté par contrainte.
function setupQrCameraControls(track){
    const zoomBar  = document.getElementById('qr-zoom-controls');
    const torchBtn = document.getElementById('qr-torch-btn');
    if(!track || !track.getCapabilities){ if(zoomBar) zoomBar.style.display = 'none'; return; }
    let caps = {};
    try { caps = track.getCapabilities() || {}; } catch(_){ caps = {}; }

    if(zoomBar) zoomBar.style.display = 'flex'; // le repli CSS fonctionne toujours, même sans capacité native
    if(torchBtn) torchBtn.style.display = caps.torch ? 'inline-flex' : 'none';
}
function setQrZoom(level){
    document.querySelectorAll('.qr-zoom-btn').forEach(b=>b.classList.toggle('active', +b.dataset.zoom === level));
    const canvas = document.getElementById('qr-canvas');
    let appliedNative = false;
    if(_qrTrack && _qrTrack.getCapabilities){
        try {
            const caps = _qrTrack.getCapabilities();
            if(caps.zoom){
                const z = Math.min(caps.zoom.max, Math.max(caps.zoom.min, level));
                _qrTrack.applyConstraints({advanced:[{zoom:z}]}).catch(()=>{});
                appliedNative = true;
            }
        } catch(_){}
    }
    // Repli : zoom numérique par agrandissement CSS du canvas (toujours disponible)
    canvas.style.transform = appliedNative ? 'none' : `scale(${level})`;
    canvas.style.transformOrigin = 'center center';
}
function toggleQrTorch(){
    if(!_qrTrack) return;
    _qrTorchOn = !_qrTorchOn;
    _qrTrack.applyConstraints({advanced:[{torch:_qrTorchOn}]}).catch(()=>{
        showAlarmToast('⚠️','Flash indisponible','Cet appareil ne permet pas de piloter le flash depuis le navigateur.','warning',4000);
        _qrTorchOn = false;
    });
    safeToggleClass('qr-torch-btn','active', _qrTorchOn);
}

// ── Moteur ZXing (principal) : couvre QR Code, Code128, Code39, EAN8/13, ──
// UPC-A/E, DataMatrix, PDF417 — fonctionne sur tous les navigateurs, sans
// dépendre de BarcodeDetector.
function getZXingReader(){
    if(_qrZXingReader) return _qrZXingReader;
    if(typeof ZXing === 'undefined') return null;
    try {
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
            ZXing.BarcodeFormat.QR_CODE,
            ZXing.BarcodeFormat.CODE_128,
            ZXing.BarcodeFormat.CODE_39,
            ZXing.BarcodeFormat.EAN_13,
            ZXing.BarcodeFormat.EAN_8,
            ZXing.BarcodeFormat.UPC_A,
            ZXing.BarcodeFormat.UPC_E,
            ZXing.BarcodeFormat.DATA_MATRIX,
            ZXing.BarcodeFormat.PDF_417
        ]);
        // TRY_HARDER coûteux en CPU : désactivé pour tenir le cadencement ~15 img/s
        hints.set(ZXing.DecodeHintType.TRY_HARDER, false);
        _qrZXingReader = new ZXing.MultiFormatReader();
        _qrZXingReader.setHints(hints);
    } catch(_){ _qrZXingReader = null; }
    return _qrZXingReader;
}
function _qrLuminanceSource(canvas, ctx, W, H){
    if(ZXing.HTMLCanvasElementLuminanceSource) return new ZXing.HTMLCanvasElementLuminanceSource(canvas);
    // Repli robuste : construit un tampon de luminance en niveaux de gris à
    // partir des pixels RGBA (utilisé uniquement si l'API ci-dessus disparaît).
    const data = ctx.getImageData(0, 0, W, H).data;
    const gray = new Uint8ClampedArray(W * H);
    for(let i = 0, p = 0; i < data.length; i += 4, p++){
        gray[p] = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114) | 0;
    }
    return new ZXing.RGBLuminanceSource(gray, W, H);
}
function tryZXingDecode(canvas, ctx, W, H){
    const reader = getZXingReader();
    if(!reader) return null;
    try {
        const luminanceSource = _qrLuminanceSource(canvas, ctx, W, H);
        const binaryBitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource));
        const result = reader.decode(binaryBitmap);
        return result ? result.getText() : null;
    } catch(_){
        return null; // NotFoundException normal quand rien n'est détecté sur la frame
    }
}

function startQrDetectionLoop(){
    if(_qrLoop) clearInterval(_qrLoop);
    const video  = document.getElementById('qr-video');
    const canvas = document.getElementById('qr-canvas');
    const ctx    = canvas.getContext('2d', {willReadFrequently:true});
    const W = canvas.width, H = canvas.height;

    const hasBD = ('BarcodeDetector' in window);
    if(hasBD && !_qrDetector){
        try {
            _qrDetector = new BarcodeDetector({formats:['qr_code','code_128','code_39','ean_13','ean_8','upc_a','upc_e','data_matrix','pdf_417']});
        } catch(_){ _qrDetector = null; }
    }
    const hasZX = !!getZXingReader();

    if(!hasBD && !hasZX){
        setQrStatus('🔴 Aucun moteur de lecture disponible');
        safeStyle('qr-manual','display', 'block');
        return;
    }

    setQrStatus('🟢 Détection active');
    safeStyle('qr-manual','display', 'none');

    // Cadencement ~15 images/s : détection fluide sans saturer le CPU (mobile).
    _qrLoop = setInterval(async () => {
        if(_qrDone || !_qrStream) return;
        if(video.readyState < 2) return;

        // Rendu couleur plein (aucun filtre N&B) — évite aussi le bug YUV vert
        // de certaines WebViews Android.
        ctx.drawImage(video, 0, 0, W, H);

        let detected = null;

        // 1) BarcodeDetector natif : utilisé uniquement quand il apporte un
        //    avantage réel (rapidité matérielle) — jamais la seule dépendance.
        if(_qrDetector){
            try {
                const codes = await _qrDetector.detect(canvas);
                if(codes.length) detected = codes[0].rawValue;
            } catch(_){}
        }
        // 2) ZXing : moteur principal — garantit la lecture de tous les formats
        //    pris en charge, même si BarcodeDetector est absent ou n'a rien trouvé.
        if(!detected && hasZX){
            detected = tryZXingDecode(canvas, ctx, W, H);
        }

        if(detected && !_qrDone) handleQrResult(detected);
    }, 66); // ≈ 15 images/s
}

function playScanBeep(){
    const ctx = getAudioCtx();
    if(!ctx) return;
    try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 1500;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    } catch(_){}
}

function handleQrResult(text){
    if(!text || _qrDone) return;
    text = text.toString().trim();
    if(!text) return;
    _qrDone = true;
    if(_qrLoop){ clearInterval(_qrLoop); _qrLoop = null; }

    const target = resolveQrTarget(text);

    if(!target){
        // Code invalide ou ne correspondant à aucun élément de la GMAO
        setQrStatus('🔴 Code non reconnu dans la GMAO.');
        safeStyle('qr-manual','display', 'block');
        if(navigator.vibrate) navigator.vibrate([30,30,30]);
        // Relance automatiquement la détection après un court délai
        setTimeout(()=>{
            if(hasClass('qrModal','active')){
                _qrDone = false;
                startQrDetectionLoop();
            }
        }, 1800);
        return;
    }

    // Code reconnu : retour visuel + sonore + navigation immédiate, sans étape intermédiaire
    safeAddClass('qrModal','qr-detected');
    playScanBeep();
    if(navigator.vibrate) navigator.vibrate([50,40,100]);
    setTimeout(()=>{
        closeScanner();
        try { target.open(); }
        catch(e){ console.warn('[Scanner] navigation impossible :', e); }
    }, 220); // laisse voir le pulse vert de confirmation avant de changer d'écran
}

// Délègue la résolution d'une ressource (équipement, procédure, véhicule,
// action, mission, plan, ou tout futur module) au moteur de recherche existant.
// Le scanner ne connaît aucun type de ressource : il transmet simplement le
// code lu, et le moteur de recherche détermine la correspondance — l'ajout
// d'un nouveau module n'exige donc aucune modification ici.
function resolveByScanCode(raw){
    if(!raw || !window.SearchEngine) return null;
    SearchEngine.rebuild();
    const doc = SearchEngine.resolveExact(raw);
    return doc ? { open(){ doc.open(); } } : null;
}

// Résout le contenu d'un QR Code / code-barres vers une action de navigation
// directe. Retourne { open() } si reconnu, ou null si invalide / sans correspondance.
function resolveQrTarget(raw){
    if(!raw) return null;

    // 0) Formats "intent" standards : tel / sms / mailto / geo → gérés nativement
    //    par le système d'exploitation, ouverture immédiate sans copier-coller.
    if(/^(tel|sms|mailto|geo):/i.test(raw)){
        return { open(){ window.location.href = raw; } };
    }

    // 0bis) Réseau Wi-Fi (format QR standard WIFI:S:<ssid>;T:<type>;P:<pass>;;)
    if(/^wifi:/i.test(raw)){
        const m = {};
        raw.replace(/^wifi:/i,'').split(';').forEach(part=>{
            const i = part.indexOf(':');
            if(i>-1) m[part.slice(0,i).toUpperCase()] = part.slice(i+1);
        });
        return { open(){
            const info = `Réseau : ${m.S||'?'}\nMot de passe : ${m.P||'(aucun)'}`;
            if(navigator.clipboard) navigator.clipboard.writeText(m.P||'').catch(()=>{});
            showAlarmToast('📶','Réseau Wi-Fi détecté', info + '\n(mot de passe copié — la connexion auto n\'est pas possible depuis un navigateur)', 'info', 8000);
        } };
    }

    // 0ter) Carte de contact (vCard) → téléchargement direct du .vcf
    if(/^begin:vcard/i.test(raw)){
        return { open(){
            const blob = new Blob([raw], {type:'text/vcard'});
            const url  = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'contact.vcf';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(()=>URL.revokeObjectURL(url), 4000);
        } };
    }

    // 1) URL — qu'elle pointe vers l'application elle-même (routage interne via
    //    le fragment #...) ou vers l'extérieur (site web, PDF, image, etc.)
    try {
        const url = new URL(raw, location.href);
        if(url.origin === location.origin){
            const target = resolveAppRoute(url.hash.replace(/^#/, ''));
            if(target) return target;
            return null; // URL de l'appli mais fragment inconnu → invalide
        }
        // URL externe valide (http/https ou autre schéma navigable) → ouverture immédiate,
        // le navigateur se charge nativement d'afficher PDF/image/page web.
        if(/^https?:$/i.test(url.protocol)){
            return { open(){ window.open(raw, '_blank'); } };
        }
    } catch(_){ /* pas une URL → texte/ID brut, on continue ci-dessous */ }

    // 2) Résolution générique de la ressource correspondante, déléguée au
    //    moteur de recherche existant (aucune logique métier ici).
    return resolveByScanCode(raw);
}

// Interprète le fragment d'une URL interne à l'application (#type/id) et
// retourne l'action de navigation correspondante, ou null si non reconnu.
// Formats supportés : #equipment/ID, #vehicle/ID, #agent/ID, #protocol/ID,
// #plan/ID, #mission/DATE/ID, #action/ID, ou directement #<nomDeVue> (home,
// agents, equipment, vehicles, report, protocols, plans). La résolution par
// identifiant est déléguée au moteur de recherche générique : aucun type de
// ressource n'est connu du scanner ni de cette fonction.
function resolveAppRoute(fragment){
    if(!fragment) return null;
    const parts = fragment.split('/').filter(Boolean).map(decodeURIComponent);
    if(!parts.length) return null;

    const validViews = ['home','agents','equipment','vehicles','report','protocols','plans'];
    if(parts.length === 1 && validViews.includes(parts[0])){
        return { open(){ switchView(parts[0]); } };
    }

    // #type/id ou #mission/date/id : le dernier segment est l'identifiant de
    // la ressource — on délègue sa résolution au moteur de recherche générique.
    const code = parts[parts.length - 1];
    return resolveByScanCode(code);
}

// Ouvre le module Recherche global existant depuis le scanner, pour les cas où
// le code est absent ou illisible. Ne recrée aucun moteur de recherche.
function openSearchFromScanner(){
    closeScanner();
    if(window.openGlobalSearch) openGlobalSearch();
}

async function closeScanner(){
    _qrDone = true;
    stopQrStream();
    const video = document.getElementById('qr-video');
    if(video) video.srcObject = null;
    // Effacer le canvas et réinitialiser le zoom numérique
    const canvas = document.getElementById('qr-canvas');
    if(canvas){ const c=canvas.getContext('2d'); c.clearRect(0,0,canvas.width,canvas.height); canvas.style.transform='none'; }
    document.querySelectorAll('.qr-zoom-btn').forEach(b=>b.classList.toggle('active', b.dataset.zoom==='1'));
    safeRemoveClass('qr-torch-btn','active');
    safeStyle('qr-camera-picker','display', 'none');
    safeRemoveClass('qrModal','qr-detected');
    closeModal('qrModal');
}


// ─── Sync SharePoint ──────────────────────────────────────────────
const SHAREPOINT_URL = 'https://adapei63-my.sharepoint.com/:u:/g/personal/sebastien_sioly_adapei63_org/IQDxw2h5qfgATbyPziMy0YY_AbtE4T6r96tKlEQXVLisklk?e=V7eAbX&download=1';
let _syncInterval = null;

async function syncFromSharePoint(silent=false){
    if(!silent) showAlarmToast('☁️','Sync SharePoint','Tentative de synchronisation…','info',4000);
    try {
        const resp = await fetch(SHAREPOINT_URL, { mode:'cors', cache:'no-store' });
        if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const imported = await resp.json();
        if(typeof imported !== 'object' || Array.isArray(imported)) throw new Error('Format JSON invalide');

        // Fusion douce : ajoute sans écraser
        appState.agents    = mergeById(appState.agents,    imported.agents    ||[]);
        appState.equipment = mergeById(appState.equipment, imported.equipment ||[]);
        appState.vehicles  = mergeById(appState.vehicles,  imported.vehicles  ||[]);
        Object.entries(imported.calendar||{}).forEach(([date,tasks])=>{
            if(!appState.calendar[date]) appState.calendar[date]=[];
            tasks.forEach(t=>{ if(!appState.calendar[date].find(x=>x.id===t.id)) appState.calendar[date].push(t); });
        });
        (imported.recurringRules||[]).forEach(r=>{
            if(!appState.recurringRules.find(x=>x.id===r.id)) appState.recurringRules.push(r);
        });

        saveData();
        loadDayData(activeDate);
        renderAgents(); renderEquipment(); renderVehicles();
        const now = new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
        if(!silent) showAlarmToast('✅','Sync réussie',`SharePoint synchronisé à ${now}`,'success',6000);
        localStorage.setItem('gmao_last_sync', Date.now());
    } catch(err){
        const msg = err.message.includes('Failed to fetch') || err.message.includes('CORS')
            ? 'CORS bloqué. SharePoint requiert HTTPS. Utilisez l\'export/import manuel depuis un PC.'
            : err.message;
        if(!silent) showAlarmToast('⚠️','Sync échouée', msg,'warning',10000);
    }
}

function startAutoSync(){
    // Sync dès le démarrage (silencieuse) puis toutes les 5 minutes
    syncFromSharePoint(true);
    if(_syncInterval) clearInterval(_syncInterval);
    _syncInterval = setInterval(()=>syncFromSharePoint(true), 5*60*1000);
}

// ─────────────────────────────────────────────────────────────────
// AGENTS
// ─────────────────────────────────────────────────────────────────
function renderAgents(){
    const c = document.getElementById('agents-list-container');
    if(!c) return;
    if(!appState.agents.length){ c.innerHTML=`<div class="empty-state"><div class="empty-state-icon">👥</div><p>Aucun agent.</p></div>`; return; }
    c.innerHTML = appState.agents.map(a=>`
        <div class="agent-card" onclick="openAgentModal('${a.id}')">
            <div class="agent-avatar">${(a.name||'?').charAt(0).toUpperCase()}</div>
            <div class="agent-info">
                <p class="agent-name">${a.name}</p>
                <p class="agent-role">${a.role||''} ${a.service?'— '+a.service:''} ${a.active===false?'<span style="color:var(--danger)">(Inactif)</span>':''}</p>
            </div>
        </div>`).join('');
}
function openCreateAgentModal(){ activeAgentId=null; safeText('agent-modal-title', 'Nouvel Agent'); document.getElementById('agent-name').value=''; document.getElementById('agent-role').value='technician'; document.getElementById('agent-service').value='maintenance'; document.getElementById('agent-active').checked=true; safeStyle('btn-delete-agent','display', 'none'); safeAddClass('agentModal','active'); }
function openAgentModal(id){ activeAgentId=id; const a=appState.agents.find(x=>x.id===id); if(!a) return; safeText('agent-modal-title', 'Modifier Agent'); document.getElementById('agent-name').value=a.name||''; document.getElementById('agent-role').value=a.role||'technician'; document.getElementById('agent-service').value=a.service||'maintenance'; document.getElementById('agent-active').checked=a.active!==false; safeStyle('btn-delete-agent','display', 'inline-flex'); safeAddClass('agentModal','active'); }
function saveAgent(){ const name=document.getElementById('agent-name').value.trim(); if(!name){alert('Nom requis');return;} const data={name,role:document.getElementById('agent-role').value,service:document.getElementById('agent-service').value,active:document.getElementById('agent-active').checked}; if(activeAgentId){const a=appState.agents.find(x=>x.id===activeAgentId);if(a)Object.assign(a,data);}else{appState.agents.push({id:generateUUID(),...data});} saveData();closeModal('agentModal');renderAgents(); }
function deleteActiveAgent(){ if(!confirm('Supprimer ?'))return; appState.agents=appState.agents.filter(a=>a.id!==activeAgentId); saveData();closeModal('agentModal');renderAgents(); }

// ─────────────────────────────────────────────────────────────────
// ÉQUIPEMENTS
// ─────────────────────────────────────────────────────────────────
let currentEquipFilter='all';
function renderEquipment(filter=currentEquipFilter){ currentEquipFilter=filter; const c=document.getElementById('equipment-list-container'); if(!c) return; const list=filter==='all'?appState.equipment:appState.equipment.filter(e=>e.type===filter); if(!list.length){c.innerHTML=`<div class="empty-state"><div class="empty-state-icon">🔑</div><p>Aucun équipement.</p></div>`;return;} const sl={available:'Disponible',in_use:'En Utilisation',maintenance:'Maintenance'}; c.innerHTML=list.map(e=>`<div class="equipment-card" onclick="openEquipmentModal('${e.id}')"><div class="agent-info" style="width:100%"><div style="display:flex;justify-content:space-between;align-items:center"><p class="equipment-name">${e.name}</p><span class="equipment-status">${sl[e.status]||e.status||''}</span></div><p class="agent-role">${e.location||''}</p></div></div>`).join(''); }
function filterEquipment(f,btn){ document.querySelectorAll('#view-equipment .tab-btn').forEach(b=>b.classList.remove('active')); if(btn) btn.classList.add('active'); renderEquipment(f); }
function openCreateEquipmentModal(){ activeEquipId=null; document.getElementById('equipment-name').value=''; document.getElementById('equipment-location').value=''; document.getElementById('equipment-type').value='keys'; document.getElementById('equipment-status').value='available'; safeStyle('btn-delete-equipment','display', 'none'); safeAddClass('equipmentModal','active'); }
function openEquipmentModal(id){ activeEquipId=id; const e=appState.equipment.find(x=>x.id===id); if(!e)return; document.getElementById('equipment-name').value=e.name||''; document.getElementById('equipment-location').value=e.location||''; document.getElementById('equipment-type').value=e.type||'keys'; document.getElementById('equipment-status').value=e.status||'available'; safeStyle('btn-delete-equipment','display', 'inline-flex'); safeAddClass('equipmentModal','active'); }
function saveEquipment(){ const name=document.getElementById('equipment-name').value.trim(); if(!name){alert('Nom requis');return;} const data={name,type:document.getElementById('equipment-type').value,location:document.getElementById('equipment-location').value,status:document.getElementById('equipment-status').value}; if(activeEquipId){const e=appState.equipment.find(x=>x.id===activeEquipId);if(e)Object.assign(e,data);}else{appState.equipment.push({id:generateUUID(),...data});} saveData();closeModal('equipmentModal');renderEquipment(); }
function deleteActiveEquipment(){ if(!confirm('Supprimer ?'))return; appState.equipment=appState.equipment.filter(e=>e.id!==activeEquipId); saveData();closeModal('equipmentModal');renderEquipment(); }

// ─────────────────────────────────────────────────────────────────
// VÉHICULES
// ─────────────────────────────────────────────────────────────────
function renderVehicles(){ const c=document.getElementById('vehicle-list-container'); if(!c) return; if(!appState.vehicles.length){c.innerHTML=`<div class="empty-state"><div class="empty-state-icon">🚗</div><p>Aucun véhicule.</p></div>`;return;} const si={ok:'✅',maintenance:'🔧',unavailable:'❌'}; c.innerHTML=appState.vehicles.map(v=>`<div class="task-card" onclick="openVehicleModal('${v.id}')"><div class="task-info"><div class="task-title">${si[v.status]||''} ${v.name}</div><div class="task-meta" style="font-size:.8rem;color:var(--text-muted)">${v.notes||''}</div></div></div>`).join(''); }
function openCreateVehicleModal(){ activeVehicleId=null; document.getElementById('vehicle-name').value=''; document.getElementById('vehicle-status').value='ok'; document.getElementById('vehicle-notes').value=''; safeStyle('btn-delete-vehicle','display', 'none'); safeAddClass('vehicleModal','active'); }
function openVehicleModal(id){ activeVehicleId=id; const v=appState.vehicles.find(x=>x.id===id); if(!v)return; document.getElementById('vehicle-name').value=v.name||''; document.getElementById('vehicle-status').value=v.status||'ok'; document.getElementById('vehicle-notes').value=v.notes||''; safeStyle('btn-delete-vehicle','display', 'inline-flex'); safeAddClass('vehicleModal','active'); }
function saveVehicle(){ const name=document.getElementById('vehicle-name').value.trim(); if(!name){alert('Nom requis');return;} const data={name,status:document.getElementById('vehicle-status').value,notes:document.getElementById('vehicle-notes').value}; if(activeVehicleId){const v=appState.vehicles.find(x=>x.id===activeVehicleId);if(v)Object.assign(v,data);}else{appState.vehicles.push({id:generateUUID(),...data});} saveData();closeModal('vehicleModal');renderVehicles(); }
function deleteActiveVehicle(){ if(!confirm('Supprimer ?'))return; appState.vehicles=appState.vehicles.filter(v=>v.id!==activeVehicleId); saveData();closeModal('vehicleModal');renderVehicles(); }

// ─────────────────────────────────────────────────────────────────
// RAPPORT
// ─────────────────────────────────────────────────────────────────
function renderReportPreview(){
    const dates = Object.keys(appState.calendar).sort().reverse().slice(0,14);
    if(!dates.length){ safeHTML('report-preview', '<p>Aucune donnée.</p>'); return; }
    safeHTML('report-preview', dates.map(date=>{
        const tasks=sortTasksChrono(appState.calendar[date]||[]), done=tasks.filter(t=>t.completed).length, pct=tasks.length?Math.round(done/tasks.length*100):0;
        const col=pct>=80?'var(--success)':pct>=50?'var(--warning)':'var(--danger)';
        return `<div style="background:var(--bg-surface);padding:12px 16px;margin-bottom:10px;border-radius:8px;border-left:4px solid ${col}">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <strong>${date}</strong>
                <span style="color:${col};font-weight:700">${done}/${tasks.length} (${pct}%)</span>
            </div>
            <div style="margin-top:6px;font-size:.82rem;color:var(--text-muted)">${tasks.map(t=>`<div>${t.completed?'☑':'☐'} ${t.title}</div>`).join('')}</div>
        </div>`;
    }).join(''));
}

// ─────────────────────────────────────────────────────────────────
// PARAMÈTRES
// ─────────────────────────────────────────────────────────────────
function openSettingsModal(){
    document.getElementById('settings-site-name').value = appState.settings.siteName||'';
    // Charger config GitHub depuis localStorage (jamais dans appState pour éviter la sync)
    const ghCfg = ghConfig();
    document.getElementById('gh-owner').value = ghCfg.owner||'';
    document.getElementById('gh-repo').value  = ghCfg.repo||'';
    document.getElementById('gh-token').value = ghCfg.token||'';
    safeStyle('gh-status','display', 'none');

    // Règle horaire des éléments de l'accueil
    const rule = appState.homeTimeRule || DEFAULT_HOME_TIME_RULE;
    document.getElementById('homerule-enabled').checked = !!rule.enabled;
    document.getElementById('homerule-start').value = rule.start || '08:00';
    document.getElementById('homerule-end').value   = rule.end   || '18:00';
    document.querySelectorAll('.homerule-day').forEach(cb=>{
        cb.checked = (rule.days||[]).includes(Number(cb.value));
    });
    renderHomeRuleAlwaysVisible();

    safeAddClass('settingsModal','active');
}
// Génère dynamiquement la liste à cocher à partir du registre HOME_ELEMENTS —
// tout nouvel élément ajouté à ce registre apparaît automatiquement ici.
function renderHomeRuleAlwaysVisible(){
    const rule = appState.homeTimeRule || DEFAULT_HOME_TIME_RULE;
    const container = document.getElementById('homerule-always-visible');
    if(!container) return;
    container.innerHTML = HOME_ELEMENTS.map(el => `
        <label style="display:flex;align-items:center;gap:6px;background:var(--bg-light);padding:6px 10px;border-radius:4px;border:1px solid var(--border);font-size:.85rem">
            <input type="checkbox" class="homerule-always" value="${el.id}" ${(rule.alwaysVisible||[]).includes(el.id)?'checked':''}>
            <span>${el.icon} ${el.label}</span>
        </label>`).join('');
}
function saveSettings(){
    appState.settings.siteName = document.getElementById('settings-site-name').value.trim()||'GMAO';
    safeText('site-name', appState.settings.siteName);
    // Sauvegarder config GitHub séparément (credentials jamais dans appState)
    localStorage.setItem('gmao_gh_config', JSON.stringify({
        owner: document.getElementById('gh-owner').value.trim(),
        repo:  document.getElementById('gh-repo').value.trim(),
        token: document.getElementById('gh-token').value.trim()
    }));
    updateGhBadge();

    // Règle horaire des éléments de l'accueil
    const days = Array.from(document.querySelectorAll('.homerule-day:checked')).map(cb=>Number(cb.value));
    const always = Array.from(document.querySelectorAll('.homerule-always:checked')).map(cb=>cb.value);
    appState.homeTimeRule = {
        enabled: document.getElementById('homerule-enabled').checked,
        start:   document.getElementById('homerule-start').value || '08:00',
        end:     document.getElementById('homerule-end').value   || '18:00',
        days:    days.length ? days : [1,2,3,4,5],
        alwaysVisible: always
    };
    applyHomeVisibility();

    saveData();
    closeModal('settingsModal');
}

// ─────────────────────────────────────────────────────────────────
// SYNC GITHUB PRIVÉ — multi-appareils offline-first
// ─────────────────────────────────────────────────────────────────
const GH_FILE = 'gmao_data.json';
let _ghSha     = null;   // SHA du fichier GitHub (requis pour les PUT)
let _ghPushTimer = null;

function ghConfig(){
    try { return JSON.parse(localStorage.getItem('gmao_gh_config')||'{}'); }
    catch{ return {}; }
}
function ghApiUrl(){
    const c = ghConfig();
    if(!c.owner||!c.repo) return null;
    return `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${GH_FILE}`;
}
function ghHeaders(){
    const c = ghConfig();
    return { 'Authorization': `token ${c.token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' };
}

// Badge dans le header : montre si GitHub est configuré
function updateGhBadge(){
    const c = ghConfig();
    const badge = document.getElementById('gh-sync-badge');
    if(!badge) return;
    const ok = c.owner && c.repo && c.token;
    badge.style.display = ok ? 'flex' : 'none';
    badge.title = ok ? `GitHub sync : ${c.owner}/${c.repo}` : '';
}

function setGhStatus(msg, type){
    const el = document.getElementById('gh-status');
    if(!el) return;
    el.style.display = 'block';
    el.style.background = type==='ok'?'rgba(16,185,129,.1)':type==='err'?'rgba(239,68,68,.1)':'rgba(59,130,246,.1)';
    el.style.color = type==='ok'?'var(--success)':type==='err'?'var(--danger)':'var(--info)';
    el.innerText = msg;
}

// Lecture depuis GitHub → fusionne avec localStorage
async function pullFromGitHub(silent=false){
    const url = ghApiUrl(); if(!url) return false;
    if(!navigator.onLine) return false;
    try {
        const r = await fetch(url, {headers: ghHeaders(), cache:'no-store'});
        if(r.status===404){
            if(!silent) setGhStatus('Dépôt OK — pas encore de données. Première sauvegarde à venir.','info');
            return false;
        }
        if(!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        _ghSha = json.sha;
        const data = JSON.parse(atob(json.content.replace(/\n/g,'')));
        // Stratégie : le serveur a les données les plus récentes si localStorage est vide
        const localTs  = appState._savedAt ? new Date(appState._savedAt).getTime() : 0;
        const remoteTs = data._savedAt     ? new Date(data._savedAt).getTime()     : 0;
        if(remoteTs > localTs){
            appState = Object.assign({recurringRules:[],deletedInstances:{},navConfig:JSON.parse(JSON.stringify(DEFAULT_NAV))}, data);
            ensureStateDefaults();
            loadDayData(document.getElementById('system-date').value);
            renderAgents(); renderEquipment(); renderVehicles();
            if(!silent) setGhStatus('✅ Données récupérées depuis GitHub.','ok');
            showAlarmToast('☁️','GitHub sync','Données mises à jour depuis GitHub.','success',4000);
        } else {
            if(!silent) setGhStatus('✅ Données locales déjà à jour.','ok');
        }
        return true;
    } catch(e){
        if(!silent) setGhStatus('⚠️ Erreur lecture : '+e.message,'err');
        return false;
    }
}

// Écriture vers GitHub
async function pushToGitHub(silent=false){
    const url = ghApiUrl(); if(!url) return false;
    if(!navigator.onLine) return false;
    if(!_serverSyncReady){
        // Même sécurité que pushToFirebase : ne jamais écrire une sauvegarde
        // GitHub tant que l'état serveur (Firestore) n'a pas été confirmé.
        console.warn('pushToGitHub ignoré : synchronisation initiale pas encore confirmée');
        return false;
    }
    try {
        // Récupérer le SHA si on ne l'a pas encore
        if(!_ghSha){
            const r = await fetch(url, {headers: ghHeaders(), cache:'no-store'});
            if(r.ok){ const j=await r.json(); _ghSha=j.sha; }
        }
        // Ajouter timestamp pour résolution de conflits
        const payload = {...appState, _savedAt: new Date().toISOString()};
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));
        const body = { message:`GMAO auto-save ${new Date().toLocaleString('fr-FR')}`, content, sha: _ghSha||undefined };
        if(!_ghSha) delete body.sha;
        const r = await fetch(url, {method:'PUT', headers: ghHeaders(), body: JSON.stringify(body)});
        if(!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        _ghSha = j.content?.sha || _ghSha;
        if(!silent) setGhStatus('✅ Données sauvegardées sur GitHub.','ok');
        // Mettre à jour le badge
        const badge = document.getElementById('gh-sync-badge');
        if(badge){ badge.innerText='✅'; setTimeout(()=>{ badge.innerText='☁️'; },3000); }
        return true;
    } catch(e){
        if(!silent) setGhStatus('⚠️ Erreur écriture : '+e.message,'err');
        return false;
    }
}

// Sync complète (pull puis push si nécessaire)
async function forceSyncGitHub(){
    if(!ghApiUrl()){ setGhStatus('❌ Configurez d\'abord le dépôt GitHub dans les paramètres.','err'); openSettingsModal(); return; }
    setGhStatus('🔄 Synchronisation en cours…','info');
    const pulled = await pullFromGitHub(true);
    await pushToGitHub(false);
}

async function testGitHubConnection(){
    const url = ghApiUrl();
    if(!url){ setGhStatus('❌ Remplissez tous les champs GitHub.','err'); return; }
    setGhStatus('🔄 Test en cours…','info');
    try {
        const r = await fetch(`https://api.github.com/repos/${ghConfig().owner}/${ghConfig().repo}`, {headers: ghHeaders()});
        if(r.ok){ setGhStatus('✅ Connexion réussie — dépôt accessible !','ok'); }
        else if(r.status===401){ setGhStatus('❌ Token invalide ou expiré.','err'); }
        else if(r.status===404){ setGhStatus('❌ Dépôt introuvable. Vérifiez le nom.','err'); }
        else { setGhStatus(`⚠️ Réponse inattendue : HTTP ${r.status}`,'err'); }
    } catch(e){ setGhStatus('❌ Erreur réseau : '+e.message,'err'); }
}

// Intégrer GitHub dans le cycle de sauvegarde principal
// (pushToGitHub remplace pushToServer quand GitHub est configuré)
function scheduleGitHubPush(){
    clearTimeout(_ghPushTimer);
    _ghPushTimer = setTimeout(()=>{ if(ghApiUrl()) pushToGitHub(true); }, 45000);
}

// Sync auto toutes les 5 minutes quand en ligne
setInterval(()=>{ if(ghApiUrl() && navigator.onLine) pullFromGitHub(true); }, 5*60*1000);

// Pull initial au démarrage (en arrière-plan, silencieux)
window.addEventListener('load', ()=>{ setTimeout(()=>{ updateGhBadge(); pullFromGitHub(true); }, 2000); });

// ─────────────────────────────────────────────────────────────────
// SYNC FIREBASE FIRESTORE — multi-appareils, instantané.
// Aucune donnée n'est mise en cache dans localStorage ici : Firestore est
// l'unique source de vérité, lue/écrite en direct (pushToFirebase n'est
// plus différé — voir saveData()).
// ─────────────────────────────────────────────────────────────────
const FS_DOC_ID  = 'gmao_roussille';

function getFsRef(){
    if(!window._firebaseDb || !window._fsDoc) return null;
    return window._fsDoc(window._firebaseDb, 'gmao', FS_DOC_ID);
}

async function pushToFirebase(silent=false){
    if(!_serverSyncReady){
        // Sécurité anti-écrasement (voir commentaire plus haut) : on ne pousse
        // rien tant qu'on n'a pas reçu une confirmation réelle du serveur.
        _pendingSaveWhileSyncing = true;
        console.warn('pushToFirebase ignoré : synchronisation initiale pas encore confirmée — sauvegarde mise en attente');
        if(!silent) showAlarmToast('⏳','Synchronisation','Connexion au serveur en cours… la sauvegarde partira automatiquement dans un instant.','warning',4000);
        return;
    }
    const ref = getFsRef();
    if(!ref || !window._fsSetDoc || !navigator.onLine) return;
    try {
        // JSON.parse/stringify élimine les 'undefined' refusés par Firestore
        const payload = JSON.parse(JSON.stringify({...appState, _savedAt: new Date().toISOString()}));
        await window._fsSetDoc(ref, payload);
        if(!silent) showAlarmToast('🔥','Firebase','Données sauvegardées ✅','success',3000);
    } catch(e){
        if(!silent) showAlarmToast('⚠️','Firebase','Erreur écriture : '+e.message,'warning',5000);
        console.warn('Firebase push:', e);
    }
}

async function pullFromFirebase(silent=false){
    const ref = getFsRef();
    if(!ref || !window._fsGetDoc || !navigator.onLine) return false;
    try {
        const snap = await window._fsGetDoc(ref);
        markServerSyncReady(); // on a une réponse du serveur : les écritures deviennent sûres
        if(!snap.exists()) return false;
        const data      = snap.data();
        const localTs   = appState._savedAt ? new Date(appState._savedAt).getTime() : 0;
        const remoteTs  = data._savedAt     ? new Date(data._savedAt).getTime()     : 0;
        if(remoteTs > localTs){
            appState = Object.assign({
                recurringRules:[], deletedInstances:{},
                navConfig: JSON.parse(JSON.stringify(DEFAULT_NAV))
            }, data);
            ensureStateDefaults();
            loadDayData(document.getElementById('system-date').value);
            renderAgents(); renderEquipment(); renderVehicles(); renderBottomNav();
            if(!silent) showAlarmToast('🔥','Firebase','Données synchronisées depuis Firestore','success',4000);
        } else {
            if(!silent) showAlarmToast('🔥','Firebase','Données locales déjà à jour','success',3000);
        }
        return true;
    } catch(e){
        if(!silent) showAlarmToast('⚠️','Firebase','Erreur lecture : '+e.message,'warning',5000);
        console.warn('Firebase pull:', e);
        return false;
    }
}

async function forceSyncFirebase(){
    await pullFromFirebase(false);
    await pushToFirebase(false);
}

// ─────────────────────────────────────────────────────────────────
// SYNCHRONISATION TEMPS RÉEL FIRESTORE
// ─────────────────────────────────────────────────────────────────
let firebaseRealtimeListener = null;

function startRealtimeSync(){
    const ref = getFsRef();
    if(!ref || !window._fsOnSnapshot) return;
    // Désabonner l'écouteur précédent si existant
    if(firebaseRealtimeListener) firebaseRealtimeListener();

    firebaseRealtimeListener = window._fsOnSnapshot(ref, (snap) => {
        markServerSyncReady(); // le premier événement reçu confirme l'état serveur
        if(!snap.exists()) return;
        const remote   = snap.data();
        const localTs  = appState._savedAt ? new Date(appState._savedAt).getTime() : 0;
        const remoteTs = remote._savedAt   ? new Date(remote._savedAt).getTime()   : 0;
        if(remoteTs <= localTs) return; // données locales déjà à jour

        console.log('🔥 Mise à jour Firestore détectée');
        appState = Object.assign({
            recurringRules:[], deletedInstances:{},
            navConfig: JSON.parse(JSON.stringify(DEFAULT_NAV))
        }, remote);
        ensureStateDefaults();
        loadDayData(document.getElementById('system-date').value);
        renderAgents(); renderEquipment(); renderVehicles(); renderBottomNav();
        showAlarmToast('🔥', 'Synchronisation', 'Mise à jour reçue', 'success', 2500);
    });
}

// Sync auto polling désactivée — remplacée par onSnapshot temps réel ci-dessus
// setInterval(() => { if(getFsRef() && navigator.onLine) pullFromFirebase(true); }, 5*60*1000);

// ─────────────────────────────────────────────────────────────────
// PROTOCOLES / ASTREINTE — procédures, modes opératoires, marches dégradées
// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
// PROCÉDURES / ASTREINTE — voir procedures.js pour l'implémentation
// complète (modèle JSON, catégories/références, affichage, édition,
// pièces jointes, import, impression).
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// PLANS DE BÂTIMENTS — upload + visualisation zoomable
// (calques interactifs cliquables : prévus dans une itération suivante)
// ─────────────────────────────────────────────────────────────────
let activePlanId = null;

function renderPlans(){
    const container = document.getElementById('plans-grid-container');
    if(!container) return;
    const plans = appState.plans || [];
    if(!plans.length){
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🗺️</div><p>Aucun plan importé pour le moment.</p></div>`;
        return;
    }
    container.innerHTML = plans.map(p => `
        <div class="plan-card" onclick="openPlanViewer('${p.id}')">
            <img src="${p.image}" alt="${p.name}" loading="lazy">
            <div class="plan-card-label">${p.name}</div>
        </div>`).join('');
}
function triggerPlanUpload(){ document.getElementById('plan-file-input').value=''; document.getElementById('plan-file-input').click(); }

function uploadPlanFile(event){
    const file = event.target.files[0];
    if(!file) return;
    const name = prompt('Nom du plan (ex: Bâtiment A - RDC)', file.name.replace(/\.[^.]+$/,''));
    if(name===null) return;
    compressImageToDataURL(file, 1600, 0.72).then(dataUrl=>{
        if(!appState.plans) appState.plans = [];
        appState.plans.push({id:generateUUID(), name: name||file.name, image:dataUrl, createdAt:new Date().toISOString()});
        saveData();
        renderPlans();
        showAlarmToast('🗺️','Plan ajouté', name||file.name,'success',3000);
    }).catch(err=>{
        alert('Erreur lors du traitement de l\'image : '+err.message);
    });
}

// Compresse une image côté client (redimensionnement + JPEG qualité réduite)
// afin de limiter la taille des documents Firestore/localStorage sans dépendre
// de Firebase Storage (donc sans obligation de passer sur le plan payant Blaze).
function compressImageToDataURL(file, maxDim=1600, quality=0.72){
    return new Promise((resolve, reject)=>{
        const reader = new FileReader();
        reader.onerror = ()=> reject(new Error('Lecture du fichier impossible'));
        reader.onload = ()=>{
            const img = new Image();
            img.onerror = ()=> reject(new Error('Image invalide'));
            img.onload = ()=>{
                let {width, height} = img;
                if(width > maxDim || height > maxDim){
                    const ratio = Math.min(maxDim/width, maxDim/height);
                    width = Math.round(width*ratio);
                    height = Math.round(height*ratio);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function renamePlan(id){
    const p = (appState.plans||[]).find(x=>x.id===id);
    if(!p) return;
    const name = prompt('Nouveau nom du plan', p.name);
    if(name===null || !name.trim()) return;
    p.name = name.trim();
    saveData();
    renderPlans();
}
function deletePlan(id){
    if(!confirm('Supprimer ce plan ?')) return;
    appState.plans = (appState.plans||[]).filter(x=>x.id!==id);
    saveData();
    renderPlans();
    closePlanViewer();
}

// ── Visualiseur plein écran avec zoom (pincement / molette) + déplacement ──
let _planZoom = {scale:1, x:0, y:0, startDist:0, startScale:1, panning:false, lastX:0, lastY:0};

function openPlanViewer(id){
    const p = (appState.plans||[]).find(x=>x.id===id);
    if(!p) return;
    activePlanId = id;
    safeText('plan-viewer-title', p.name);
    const img = document.getElementById('plan-viewer-img');
    img.src = p.image;
    resetPlanZoom();
    safeAddClass('planViewerModal','active');
    initPlanZoomHandlers();
}
function closePlanViewer(){
    closeModal('planViewerModal');
    activePlanId = null;
}
function resetPlanZoom(){
    _planZoom = {scale:1, x:0, y:0, startDist:0, startScale:1, panning:false, lastX:0, lastY:0};
    applyPlanTransform();
}
function applyPlanTransform(){
    const img = document.getElementById('plan-viewer-img');
    if(!img) return;
    img.style.transform = `translate(${_planZoom.x}px, ${_planZoom.y}px) scale(${_planZoom.scale})`;
}
function initPlanZoomHandlers(){
    const wrap = document.getElementById('plan-viewer-wrap');
    if(!wrap || wrap._zoomInit) return;
    wrap._zoomInit = true;

    // Molette (desktop / tablette avec souris)
    wrap.addEventListener('wheel', e=>{
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.12 : -0.12;
        _planZoom.scale = Math.min(5, Math.max(1, _planZoom.scale + delta));
        applyPlanTransform();
    }, {passive:false});

    // Pincement (pinch-to-zoom) + pan tactile
    wrap.addEventListener('touchstart', e=>{
        if(e.touches.length===2){
            _planZoom.startDist = Math.hypot(
                e.touches[0].clientX-e.touches[1].clientX,
                e.touches[0].clientY-e.touches[1].clientY);
            _planZoom.startScale = _planZoom.scale;
        } else if(e.touches.length===1){
            _planZoom.panning = true;
            _planZoom.lastX = e.touches[0].clientX;
            _planZoom.lastY = e.touches[0].clientY;
        }
    }, {passive:true});

    wrap.addEventListener('touchmove', e=>{
        if(e.touches.length===2){
            e.preventDefault();
            const dist = Math.hypot(
                e.touches[0].clientX-e.touches[1].clientX,
                e.touches[0].clientY-e.touches[1].clientY);
            const ratio = dist / (_planZoom.startDist||dist);
            _planZoom.scale = Math.min(5, Math.max(1, _planZoom.startScale * ratio));
            applyPlanTransform();
        } else if(e.touches.length===1 && _planZoom.panning && _planZoom.scale>1){
            const dx = e.touches[0].clientX - _planZoom.lastX;
            const dy = e.touches[0].clientY - _planZoom.lastY;
            _planZoom.x += dx; _planZoom.y += dy;
            _planZoom.lastX = e.touches[0].clientX;
            _planZoom.lastY = e.touches[0].clientY;
            applyPlanTransform();
        }
    }, {passive:false});

    wrap.addEventListener('touchend', ()=>{ _planZoom.panning = false; }, {passive:true});

    // Double-tap pour zoomer/dézoomer rapidement
    let lastTap = 0;
    wrap.addEventListener('touchend', ()=>{
        const now = Date.now();
        if(now - lastTap < 300){
            _planZoom.scale = _planZoom.scale > 1 ? 1 : 2.2;
            _planZoom.x = 0; _planZoom.y = 0;
            applyPlanTransform();
        }
        lastTap = now;
    }, {passive:true});
}

// ─────────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────────
function generateUUID(){ return Math.random().toString(36).substring(2,10)+Date.now().toString(36); }
function closeModal(id){ safeRemoveClass(id, 'active'); }

// ===== V1.5 Navigation Manager =====
// Ordre de priorité du bouton Retour Android :
//   0) Recherche globale ouverte    → la fermer
//   1) Modale ouverte              → la fermer
//   2) Sidebar ouvert               → le fermer
//   3) Vue courante ≠ accueil       → remonter d'une vue dans la pile (autant de fois que nécessaire)
//   4) Sur l'accueil                → double retour pour quitter l'appli
let __lastBack = 0;
window.addEventListener('popstate', ()=>{
    // 0) Recherche globale ouverte → priorité absolue à sa fermeture
    const searchOverlay = document.getElementById('global-search-overlay');
    if(searchOverlay && searchOverlay.classList.contains('active')){
        if(window.closeGlobalSearch) closeGlobalSearch();
        history.pushState({gmao: Date.now()}, '');
        return;
    }

    // 1) Modale ouverte → priorité à sa fermeture
    const modal = document.querySelector('.modal.active');
    if(modal){
        if(modal.id==='qrModal' && window.closeScanner) closeScanner();
        else if(window.closeModal) closeModal(modal.id);
        history.pushState({gmao: Date.now()}, '');
        return;
    }

    // 1.5) Module Actions ouvert (overlay plein écran, pas une .modal classique) → le fermer
    const actionsOverlay = document.getElementById('actions-overlay');
    if(actionsOverlay && actionsOverlay.classList.contains('active')){
        if(window.closeActionsModule) closeActionsModule();
        history.pushState({gmao: Date.now()}, '');
        return;
    }

    // 2) Sidebar ouvert → le fermer
    const sidebar = document.querySelector('.sidebar.active');
    if(sidebar){
        closeSidebar();
        history.pushState({gmao: Date.now()}, '');
        return;
    }

    // 3) Pas encore sur l'accueil → revenir à la vue précédente de la pile
    if(__currentView !== 'home'){
        const prev = __viewStack.pop() || 'home';
        switchView(prev, true); // true = navigation arrière, ne pas ré-empiler
        history.pushState({gmao: Date.now()}, '');
        return;
    }

    // 4) Déjà sur l'accueil → comportement "double retour pour quitter"
    const now = Date.now();
    if(now - __lastBack < 2000){
        if(window.Android && Android.finish) Android.finish();
    } else {
        __lastBack = now;
        alert("Appuyez une seconde fois sur Retour pour quitter.");
        history.pushState({gmao: Date.now()}, '');
    }
});
