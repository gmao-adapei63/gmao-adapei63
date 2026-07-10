// ═════════════════════════════════════════════════════════════════
// MOTEUR DE SUIVIS GÉNÉRIQUES (V1) — GMAO Tactical
// ═════════════════════════════════════════════════════════════════
// Fichier 100% additif : ne modifie aucune fonction/variable existante.
// Suit exactement le pattern déjà utilisé par ActionsEngine (actions.js) :
//   - toute la logique vit ici, appState.suivis est une clé nouvelle
//   - s'enregistre lui-même via SuivisEngine.ensureDefaults(), appelé
//     depuis ensureStateDefaults() (app.js) — un seul ajout d'une ligne
//     dans app.js suffit pour le brancher : voir INTEGRATION.md
//   - utilise les fonctions déjà globales : appState, saveData(),
//     refreshAllViewsAfterDataUpdate(), generateUUID(), registerSearchProvider()
//
// Un "Modèle" décrit un type de suivi (BAES, Légionelles, CTA...).
// Une "Campagne" est une session de contrôle pour un modèle donné
// (ex. "Campagne 2026"). Une campagne contient des "Sections" (regroupements,
// ex. un local) qui contiennent des "Items" (une ligne = un équipement/point
// de contrôle). Chaque Item porte un objet "controles" (une entrée par type
// de contrôle défini dans le modèle : date, état, commentaire, photo...).
//
// Rien dans ce fichier n'est spécifique à BAES : la forme exacte des champs
// vient entièrement de la définition du modèle (voir models/baes.model.js).
// ═════════════════════════════════════════════════════════════════

const SuivisEngine = (function(){

    let __searchRegistered = false;

    function uid(prefix){
        const base = (typeof window.generateUUID === 'function')
            ? window.generateUUID()
            : (Date.now().toString(36) + Math.random().toString(36).slice(2, 9));
        return prefix ? (prefix + '_' + base) : base;
    }

    // ─────────────────────────────────────────────────────────────
    // INITIALISATION DE L'ÉTAT (appelé depuis ensureStateDefaults())
    // ─────────────────────────────────────────────────────────────
    function ensureDefaults(){
        if(!appState.suivis) appState.suivis = {};
        const s = appState.suivis;
        if(!Array.isArray(s.modeles))   s.modeles   = [];
        if(!Array.isArray(s.campagnes)) s.campagnes = [];
        if(!Array.isArray(s.sections))  s.sections  = [];
        if(!Array.isArray(s.items))     s.items     = [];
        registerSearchProviderOnce();
    }

    function registerSearchProviderOnce(){
        if(__searchRegistered) return;
        if(typeof window.registerSearchProvider !== 'function') return; // réessaiera au prochain ensureDefaults()
        window.registerSearchProvider('suivis', function(){
            const s = appState.suivis;
            if(!s) return [];
            return (s.items||[]).map(it=>{
                const modele = getModele(it.modeleId);
                const section = getSection(it.sectionId);
                return {
                    type: 'suivi_item',
                    icon: (modele && modele.icone) || '🗂️',
                    category: (modele && modele.nom) || 'Suivi',
                    title: [it.champs && it.champs.repere, it.champs && it.champs.emplacement].filter(Boolean).join(' — ') || 'Item',
                    summary: section ? ('Section : ' + section.nom) : '',
                    text: JSON.stringify(it.champs || {}),
                    location: (modele && modele.nom) || 'Suivis',
                    id: it.id,
                    open(){ if(window.openSuiviItem) window.openSuiviItem(it.id); }
                };
            });
        });
        __searchRegistered = true;
    }

    // ─────────────────────────────────────────────────────────────
    // MODÈLES
    // ─────────────────────────────────────────────────────────────
    function createModele(def){
        const modele = Object.assign({
            id: uid('modele'),
            nom: 'Nouveau suivi',
            domaine: '',
            sousDomaine: '',
            icone: '📋',
            couleur: '#3b82f6',
            champsItem: [],
            controles: [],
            etats: [
                {value:'OK', label:'OK', color:'var(--success)', commentRequired:false},
                {value:'HS', label:'HS', color:'var(--danger)',  commentRequired:true}
            ],
            groupePar: 'section',
            source: null,
            createdAt: new Date().toISOString()
        }, def || {});
        appState.suivis.modeles.push(modele);
        persist();
        return modele.id;
    }

    function updateModele(modeleId, patch){
        const m = getModele(modeleId);
        if(!m) return;
        Object.assign(m, patch);
        persist();
    }

    function deleteModele(modeleId){
        const s = appState.suivis;
        s.modeles = s.modeles.filter(m => m.id !== modeleId);
        persist();
    }

    function getModele(modeleId){
        return (appState.suivis.modeles || []).find(m => m.id === modeleId) || null;
    }

    function listModeles(){ return appState.suivis.modeles || []; }

    // ─────────────────────────────────────────────────────────────
    // CAMPAGNES
    // ─────────────────────────────────────────────────────────────
    function createCampagne(modeleId, nom){
        const campagne = {
            id: uid('campagne'),
            modeleId,
            nom: nom || 'Nouvelle campagne',
            statut: 'en_cours',
            createdAt: new Date().toISOString(),
            dernierItemConsulteId: null
        };
        appState.suivis.campagnes.push(campagne);
        persist();
        return campagne.id;
    }

    function getCampagne(campagneId){
        return (appState.suivis.campagnes || []).find(c => c.id === campagneId) || null;
    }

    function listCampagnesForModele(modeleId){
        return (appState.suivis.campagnes || []).filter(c => c.modeleId === modeleId);
    }

    function titreCampagne(campagneId){
        const campagne = getCampagne(campagneId);
        if(!campagne) return '';
        const items = listItemsForCampagne(campagneId);
        const annees = new Set();
        items.forEach(it => Object.values(it.controles || {}).forEach(c => {
            if(c && c.date){ annees.add(new Date(c.date).getFullYear()); }
        }));
        if(annees.size === 0) return campagne.nom;
        const sorted = Array.from(annees).sort();
        return sorted.length === 1
            ? ('ANNÉE ' + sorted[0])
            : ('ANNÉES ' + sorted[0] + '-' + sorted[sorted.length-1]);
    }

    // Résumé utilisé par la double confirmation avant suppression (jamais
    // de suppression "en un clic" — voir SuivisView.demanderSuppressionCampagne).
    function resumeCampagnePourSuppression(campagneId){
        const campagne = getCampagne(campagneId);
        if(!campagne) return null;
        const items = listItemsForCampagne(campagneId);
        const modele = getModele(campagne.modeleId);
        let controlesSaisis = 0, photos = 0, signatures = 0;
        items.forEach(it => Object.values(it.controles||{}).forEach(c => {
            if(c && c.date) controlesSaisis++;
            if(c && (c.photo || c.photoRef || c.photoUrl)) photos++;
            if(c && c.signature) signatures++;
        }));
        return {
            nom: titreCampagne(campagneId),
            modeleNom: modele ? modele.nom : '',
            nbItems: items.length,
            nbSections: listSectionsForCampagne(campagneId).length,
            controlesSaisis, photos, signatures
        };
    }

    // Suppression en cascade (campagne + ses sections + ses items uniquement).
    // Appelée seulement après la double confirmation côté vue.
    function deleteCampagne(campagneId){
        const s = appState.suivis;
        const items = listItemsForCampagne(campagneId);
        if(window.SuivisIndexedDB){
            items.forEach(it => Object.values(it.controles||{}).forEach(c => {
                if(c && c.photoRef) window.SuivisIndexedDB.supprimer(c.photoRef);
            }));
        }
        s.items = s.items.filter(i => i.campagneId !== campagneId);
        s.sections = s.sections.filter(sec => sec.campagneId !== campagneId);
        s.campagnes = s.campagnes.filter(c => c.id !== campagneId);
        persist();
        return {ok:true};
    }

    // ─────────────────────────────────────────────────────────────
    // SECTIONS
    // ─────────────────────────────────────────────────────────────
    function addSection(campagneId, nom, ordre){
        const section = {
            id: uid('section'),
            campagneId,
            nom: nom || 'Section',
            ordre: (typeof ordre === 'number') ? ordre : (listSectionsForCampagne(campagneId).length)
        };
        appState.suivis.sections.push(section);
        persist();
        return section.id;
    }

    function getSection(sectionId){
        return (appState.suivis.sections || []).find(s => s.id === sectionId) || null;
    }

    function listSectionsForCampagne(campagneId){
        return (appState.suivis.sections || [])
            .filter(s => s.campagneId === campagneId)
            .sort((a,b)=> (a.ordre||0) - (b.ordre||0));
    }

    // ─────────────────────────────────────────────────────────────
    // ITEMS
    // ─────────────────────────────────────────────────────────────
    function addItem(sectionId, campagneId, modeleId, champs){
        const item = {
            id: uid('item'),
            sectionId, campagneId, modeleId,
            champs: champs || {},
            controles: {}
        };
        appState.suivis.items.push(item);
        persist();
        return item.id;
    }

    function getItem(itemId){
        return (appState.suivis.items || []).find(i => i.id === itemId) || null;
    }

    function listItemsForSection(sectionId){
        return (appState.suivis.items || []).filter(i => i.sectionId === sectionId);
    }

    function listItemsForCampagne(campagneId){
        return (appState.suivis.items || []).filter(i => i.campagneId === campagneId);
    }

    function setControle(itemId, controleId, valeurs){
        const item = getItem(itemId);
        if(!item) return {ok:false, error:'item introuvable'};
        const modele = getModele(item.modeleId);
        const etatDef = modele && (modele.etats||[]).find(e => e.value === valeurs.etat);
        if(etatDef && etatDef.commentRequired && !(valeurs.commentaire||'').trim()){
            return {ok:false, error:'Commentaire obligatoire pour l\'état "' + etatDef.label + '"'};
        }
        if(!item.controles[controleId]) item.controles[controleId] = {historique:[]};
        const courant = item.controles[controleId];
        if(courant.date || courant.etat){
            courant.historique = courant.historique || [];
            courant.historique.unshift({
                date: courant.date, etat: courant.etat, commentaire: courant.commentaire,
                archivedAt: new Date().toISOString()
            });
            if(courant.historique.length > 5) courant.historique.length = 5;
        }
        courant.date        = valeurs.date || new Date().toISOString().split('T')[0];
        courant.etat        = valeurs.etat || '';
        courant.commentaire = valeurs.commentaire || '';
        if(valeurs.photo !== undefined)     courant.photo = valeurs.photo;
        if(valeurs.signature !== undefined) courant.signature = valeurs.signature;
        // Champs additionnels génériques (ex. "controleur" pour les listes
        // intelligentes) : tout ce qui n'est pas déjà géré ci-dessus est
        // stocké tel quel, sans liste figée de champs autorisés.
        Object.keys(valeurs).forEach(k => {
            if(['date','etat','commentaire','photo','signature'].indexOf(k) === -1){
                courant[k] = valeurs[k];
            }
        });
        persist();
        return {ok:true};
    }

    // ─────────────────────────────────────────────────────────────
    // PROGRESSION / STATISTIQUES DE BASE
    // ─────────────────────────────────────────────────────────────
    function progression(campagneId){
        const campagne = getCampagne(campagneId);
        if(!campagne) return {fait:0, total:0, items:0};
        const modele = getModele(campagne.modeleId);
        const items = listItemsForCampagne(campagneId);
        const nbControles = (modele.controles||[]).length || 1;
        let fait = 0;
        items.forEach(it => (modele.controles||[]).forEach(c => {
            if(it.controles[c.id] && it.controles[c.id].date) fait++;
        }));
        return { fait, total: items.length * nbControles, items: items.length };
    }

    function anomalies(campagneId){
        const campagne = getCampagne(campagneId);
        if(!campagne) return 0;
        const modele = getModele(campagne.modeleId);
        const items = listItemsForCampagne(campagneId);
        const etatsProblemes = (modele.etats||[]).filter(e => e.commentRequired).map(e=>e.value);
        let n = 0;
        items.forEach(it => Object.values(it.controles||{}).forEach(c => {
            if(c && etatsProblemes.indexOf(c.etat) !== -1) n++;
        }));
        return n;
    }

    // ─────────────────────────────────────────────────────────────
    // PERSISTANCE — réutilise exactement le pipeline existant
    // ─────────────────────────────────────────────────────────────
    function persist(){
        if(typeof window.saveData === 'function') window.saveData();
        if(typeof window.refreshAllViewsAfterDataUpdate === 'function') window.refreshAllViewsAfterDataUpdate();
    }

    return {
        ensureDefaults,
        createModele, updateModele, deleteModele, getModele, listModeles,
        createCampagne, getCampagne, listCampagnesForModele, titreCampagne,
        deleteCampagne, resumeCampagnePourSuppression,
        addSection, getSection, listSectionsForCampagne,
        addItem, getItem, listItemsForSection, listItemsForCampagne, setControle,
        progression, anomalies
    };
})();

window.SuivisEngine = SuivisEngine;
