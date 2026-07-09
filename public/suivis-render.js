// ═════════════════════════════════════════════════════════════════
// RENDU DES SUIVIS (V1) — GMAO Tactical
// ═════════════════════════════════════════════════════════════════
// Additif : utilise uniquement des fonctions déjà globales existantes
// (safeHTML, safeText, safeStyle, compressImageToDataURL, showAlarmToast)
// + SuivisEngine (suivis-engine.js). Ne modifie rien à l'existant.
//
// 3 écrans, tous injectés dans le conteneur additif #view-suivis
// (ajouté dans index.html — voir INTEGRATION.md) :
//   1. Accueil des suivis  → liste des modèles + leurs campagnes
//   2. Vue Campagne        → sections + items, groupés, avec progression
//   3. Fiche Item          → formulaire par contrôle (date/état/commentaire/photo/signature)
//
// Rien ici n'est spécifique à BAES : tout est généré depuis modele.champsItem
// et modele.controles.
// ═════════════════════════════════════════════════════════════════

const SuivisView = (function(){

    let currentCampagneId = null;
    let currentItemId = null;

    function toast(msg, type){
        if(typeof window.showAlarmToast === 'function') window.showAlarmToast(msg, type);
        else console.log('[Suivis]', msg);
    }

    // ── Accueil : liste des modèles et de leurs campagnes ──────────
    function renderAccueil(){
        const modeles = SuivisEngine.listModeles();
        let html = '<div class="suivis-header"><h2>📋 Suivis</h2>' +
            '<button class="btn-icon" onclick="SuivisView.ouvrirAssistantNouveauSuivi()" title="Nouveau suivi">➕</button></div>';

        if(modeles.length === 0){
            html += '<div class="suivis-empty">Aucun suivi créé pour l\'instant.' +
                '<br><button class="btn-primary" onclick="SuivisView.importerModeleBAES()">Importer le modèle BAES fourni</button></div>';
        } else {
            html += '<div class="suivis-modele-list">';
            modeles.forEach(m => {
                const campagnes = SuivisEngine.listCampagnesForModele(m.id);
                html += `<div class="suivis-modele-card" style="border-left:4px solid ${m.couleur}">
                    <div class="suivis-modele-titre">${m.icone} ${escapeHtml(m.nom)}</div>
                    <div class="suivis-modele-meta">${escapeHtml(m.domaine)} ${m.sousDomaine ? '› '+escapeHtml(m.sousDomaine) : ''}</div>
                    <div class="suivis-campagne-list">`;
                if(campagnes.length === 0){
                    html += `<button class="btn-secondary" onclick="SuivisView.nouvelleCampagne('${m.id}')">+ Nouvelle campagne</button>`;
                } else {
                    campagnes.forEach(c => {
                        const prog = SuivisEngine.progression(c.id);
                        const pct = prog.total ? Math.round(100*prog.fait/prog.total) : 0;
                        const anom = SuivisEngine.anomalies(c.id);
                        html += `<div class="suivis-campagne-row" onclick="SuivisView.ouvrirCampagne('${c.id}')">
                            <div class="suivis-campagne-nom">${escapeHtml(SuivisEngine.titreCampagne(c.id))}</div>
                            <div class="suivis-progress-bar"><div class="suivis-progress-fill" style="width:${pct}%"></div></div>
                            <div class="suivis-campagne-stats">${prog.fait}/${prog.total} · ${pct}% ${anom ? '· <span style="color:var(--danger)">'+anom+' anomalie(s)</span>' : ''}</div>
                        </div>`;
                    });
                    html += `<button class="btn-secondary" onclick="SuivisView.nouvelleCampagne('${m.id}')">+ Nouvelle campagne</button>`;
                }
                html += `</div></div>`;
            });
            html += '</div>';
        }
        safeHTML('view-suivis', html);
    }

    function importerModeleBAES(){
        if(typeof window.creerSuiviBAESDepuisSeed !== 'function'){
            toast('Modèle BAES non chargé (models/baes.model.js manquant)', 'error');
            return;
        }
        const {campagneId} = window.creerSuiviBAESDepuisSeed('Campagne initiale');
        toast('Suivi BAES créé avec les 152 points du document fourni', 'success');
        ouvrirCampagne(campagneId);
    }

    function nouvelleCampagne(modeleId){
        const nom = prompt('Nom de la campagne (ex. Campagne 2026) :', 'Campagne ' + new Date().getFullYear());
        if(!nom) return;
        const campagneId = SuivisEngine.createCampagne(modeleId, nom);
        ouvrirCampagne(campagneId);
    }

    // ── Vue Campagne : sections + items ────────────────────────────
    function ouvrirCampagne(campagneId){
        currentCampagneId = campagneId;
        const campagne = SuivisEngine.getCampagne(campagneId);
        const modele = SuivisEngine.getModele(campagne.modeleId);
        const sections = SuivisEngine.listSectionsForCampagne(campagneId);
        const prog = SuivisEngine.progression(campagneId);
        const pct = prog.total ? Math.round(100*prog.fait/prog.total) : 0;

        let html = `<div class="suivis-header">
            <button class="btn-icon" onclick="SuivisView.renderAccueil()">←</button>
            <h2>${modele.icone} ${escapeHtml(SuivisEngine.titreCampagne(campagneId))}</h2>
            <button class="btn-icon" onclick="SuivisView.imprimerCampagne('${campagneId}')" title="Imprimer">🖨️</button>
        </div>
        <div class="suivis-progress-bar"><div class="suivis-progress-fill" style="width:${pct}%"></div></div>
        <div class="suivis-campagne-stats">${prog.fait}/${prog.total} contrôles · ${prog.items} points · ${pct}%</div>`;

        sections.forEach(section => {
            const items = SuivisEngine.listItemsForSection(section.id);
            html += `<div class="suivis-section"><div class="suivis-section-titre">${escapeHtml(section.nom)}</div>`;
            items.forEach(item => {
                const etatGlobal = deduireEtatGlobalItem(item, modele);
                html += `<div class="suivis-item-row ${etatGlobal.classe}" onclick="SuivisView.ouvrirItem('${item.id}')">
                    <div class="suivis-item-repere">${escapeHtml(item.champs.repere || '')}</div>
                    <div class="suivis-item-emplacement">${escapeHtml(item.champs.emplacement || '')}</div>
                    <div class="suivis-item-etat" style="color:${etatGlobal.color}">${etatGlobal.label}</div>
                </div>`;
            });
            html += `</div>`;
        });

        safeHTML('view-suivis', html);
        campagne.dernierItemConsulteId = campagne.dernierItemConsulteId || null;
    }

    function deduireEtatGlobalItem(item, modele){
        // état "pire cas" parmi tous les contrôles déjà saisis de l'item
        const etatsDef = modele.etats || [];
        let pire = null;
        Object.values(item.controles || {}).forEach(c => {
            if(!c || !c.etat) return;
            const def = etatsDef.find(e => e.value === c.etat);
            if(def && (def.commentRequired || !pire)) pire = def;
        });
        if(!pire){
            const tousSaisis = (modele.controles||[]).every(c => item.controles[c.id] && item.controles[c.id].date);
            return tousSaisis
                ? {label:'OK', color:'var(--success)', classe:'ok'}
                : {label:'À contrôler', color:'var(--text-muted)', classe:'pending'};
        }
        return {label: pire.label, color: pire.color, classe: pire.commentRequired ? 'hs' : 'ok'};
    }

    // ── Fiche Item : formulaire par contrôle ───────────────────────
    function ouvrirItem(itemId){
        currentItemId = itemId;
        const item = SuivisEngine.getItem(itemId);
        const modele = SuivisEngine.getModele(item.modeleId);
        const campagne = SuivisEngine.getCampagne(item.campagneId);
        campagne.dernierItemConsulteId = itemId;
        if(typeof window.saveData === 'function') window.saveData();

        let champsHtml = (modele.champsItem||[]).map(cf =>
            `<div class="suivis-champ-ro"><span>${escapeHtml(cf.label)}</span><b>${escapeHtml(item.champs[cf.id]||'—')}</b></div>`
        ).join('');

        let controlesHtml = (modele.controles||[]).map(ctrl => {
            const val = item.controles[ctrl.id] || {};
            const etatOptions = (modele.etats||[]).map(e =>
                `<option value="${e.value}" ${val.etat===e.value?'selected':''}>${escapeHtml(e.label)}</option>`
            ).join('');
            return `<div class="suivis-controle-bloc">
                <div class="suivis-controle-titre">${escapeHtml(ctrl.label)}</div>
                <label>Date <input type="date" id="suivi-ctrl-date-${ctrl.id}" value="${val.date||''}"></label>
                <label>État <select id="suivi-ctrl-etat-${ctrl.id}">${etatOptions}</select></label>
                <label>Commentaire <textarea id="suivi-ctrl-comment-${ctrl.id}" rows="2">${escapeHtml(val.commentaire||'')}</textarea></label>
                ${ctrl.champs.includes('photo') ? `
                <label>Photo
                    <input type="file" accept="image/*" capture="environment" onchange="SuivisView.capturerPhoto('${ctrl.id}', this.files[0])">
                    ${val.photo ? `<img src="${val.photo}" class="suivis-photo-preview">` : ''}
                </label>` : ''}
                <button class="btn-primary" onclick="SuivisView.enregistrerControle('${ctrl.id}')">Enregistrer</button>
            </div>`;
        }).join('');

        const html = `<div class="suivis-header">
            <button class="btn-icon" onclick="SuivisView.ouvrirCampagne('${item.campagneId}')">←</button>
            <h2>${escapeHtml(item.champs.repere||'')} — ${escapeHtml(item.champs.emplacement||'')}</h2>
        </div>
        <div class="suivis-champs-ro">${champsHtml}</div>
        ${controlesHtml}`;

        safeHTML('view-suivis', html);
    }

    let __photoEnAttente = {};
    function capturerPhoto(controleId, file){
        if(!file) return;
        compressImageToDataURL(file, 1200, 0.7).then(dataUrl => {
            __photoEnAttente[controleId] = dataUrl;
            toast('Photo prête (enregistrer le contrôle pour la sauvegarder)', 'info');
        });
    }

    function enregistrerControle(controleId){
        const dateEl = document.getElementById('suivi-ctrl-date-'+controleId);
        const etatEl = document.getElementById('suivi-ctrl-etat-'+controleId);
        const commentEl = document.getElementById('suivi-ctrl-comment-'+controleId);
        const valeurs = {
            date: dateEl ? dateEl.value : '',
            etat: etatEl ? etatEl.value : '',
            commentaire: commentEl ? commentEl.value : ''
        };
        if(__photoEnAttente[controleId]) valeurs.photo = __photoEnAttente[controleId];
        const res = SuivisEngine.setControle(currentItemId, controleId, valeurs);
        if(!res.ok){ toast(res.error, 'error'); return; }
        delete __photoEnAttente[controleId];
        toast('Contrôle enregistré', 'success');
        ouvrirItem(currentItemId);
    }

    // ── Impression (mode fidèle minimal — la V2 ajoutera le mode moderne) ──
    function imprimerCampagne(campagneId){
        const campagne = SuivisEngine.getCampagne(campagneId);
        const modele = SuivisEngine.getModele(campagne.modeleId);
        const sections = SuivisEngine.listSectionsForCampagne(campagneId);
        let rows = '';
        sections.forEach(section => {
            rows += `<tr><td colspan="6" class="suivis-print-section">${escapeHtml(section.nom)}</td></tr>`;
            SuivisEngine.listItemsForSection(section.id).forEach(item => {
                const v = item.champs;
                const visuel = item.controles.visuel || {};
                const decharge = item.controles.decharge || {};
                rows += `<tr>
                    <td>${escapeHtml(v.repere||'')}</td><td>${escapeHtml(v.emplacement||'')}</td>
                    <td>${escapeHtml(v.marqueModeleRef||'')}</td><td>${escapeHtml(v.anneeFab||'')}</td>
                    <td>${visuel.date||''} ${visuel.etat||''}</td>
                    <td>${decharge.date||''} ${decharge.etat||''}</td>
                </tr>`;
            });
        });
        const printHtml = `<h2>${escapeHtml(modele.nom)} — ${escapeHtml(SuivisEngine.titreCampagne(campagneId))}</h2>
            <table class="suivis-print-table"><thead><tr>
            <th>Repère</th><th>Emplacement</th><th>Marque/Modèle/Réf</th><th>Année</th><th>Contrôle visuel</th><th>Contrôle décharge</th>
            </tr></thead><tbody>${rows}</tbody></table>`;
        safeHTML('suivis-print-area', printHtml);
        window.print();
    }

    // ── Assistant "Nouveau suivi" — V1 minimale (formulaire manuel) ──
    // L'analyse automatique de documents (Excel/PDF/Word) arrive dans
    // suivis-import-parser.js (prochaine livraison) ; ce bouton crée déjà
    // un modèle vide éditable pour ne pas bloquer la création manuelle.
    function ouvrirAssistantNouveauSuivi(){
        const nom = prompt('Nom du nouveau suivi :');
        if(!nom) return;
        const domaine = prompt('Domaine (ex. Sécurité & Contrôles réglementaires) :', '') || '';
        const modeleId = SuivisEngine.createModele({
            nom, domaine,
            champsItem: [{id:'nom', label:'Nom', type:'texte', required:true}],
            controles: [{id:'controle', label:'Contrôle', champs:['date','etat','commentaire']}]
        });
        toast('Modèle "' + nom + '" créé — l\'import de document arrive dans la prochaine livraison', 'success');
        renderAccueil();
    }

    function escapeHtml(str){
        return String(str==null?'':str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    return {
        renderAccueil, importerModeleBAES, nouvelleCampagne,
        ouvrirCampagne, ouvrirItem, capturerPhoto, enregistrerControle,
        imprimerCampagne, ouvrirAssistantNouveauSuivi
    };
})();

window.SuivisView = SuivisView;
window.openSuiviItem = function(itemId){
    const item = SuivisEngine.getItem(itemId);
    if(!item) return;
    if(typeof window.switchView === 'function') window.switchView('suivis');
    SuivisView.ouvrirCampagne(item.campagneId);
    setTimeout(()=> SuivisView.ouvrirItem(itemId), 50);
};
