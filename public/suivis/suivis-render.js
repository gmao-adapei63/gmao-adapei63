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
    let appearanceExecFilePending = undefined; // undefined = pas touché, null = retiré explicitement, {name,html} = nouveau fichier
    let currentItemId = null;

    function toast(msg, type){
        const icon = type==='error' ? '⚠️' : (type==='success' ? '✅' : 'ℹ️');
        if(typeof window.showAlarmToast === 'function') window.showAlarmToast(icon, msg, '', type==='error' ? 'danger' : 'warning');
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
                    <div class="suivis-modele-card-top">
                        <div class="suivis-modele-titre">${m.icone} ${escapeHtml(m.nom)}</div>
                        <button class="btn-icon" onclick="SuivisView.modifierApparenceModele('${m.id}')" title="Couleur / icône">🎨</button>
                        <button class="btn-icon" onclick="SuivisView.demanderSuppressionModele('${m.id}')" title="Supprimer ce suivi">🗑️</button>
                    </div>
                    <div class="suivis-modele-meta">${escapeHtml(m.domaine)} ${m.sousDomaine ? '› '+escapeHtml(m.sousDomaine) : ''}</div>
                    <div class="suivis-campagne-list">`;
                if(campagnes.length === 0){
                    html += `<button class="btn-secondary" onclick="SuivisView.nouvelleCampagne('${m.id}')">+ Nouvelle campagne</button>`;
                } else {
                    campagnes.forEach(c => {
                        const prog = SuivisEngine.progression(c.id);
                        const pct = prog.total ? Math.round(100*prog.fait/prog.total) : 0;
                        const anom = SuivisEngine.anomalies(c.id);
                        html += `<div class="suivis-campagne-row" onclick="SuivisView.pratiquerCampagne('${c.id}')">
                            <div class="suivis-campagne-nom">${(m.execUrl || (m.execFile && m.execFile.html)) ? '🛂 ' : ''}${escapeHtml(SuivisEngine.titreCampagne(c.id))}</div>
                            <div class="suivis-progress-bar"><div class="suivis-progress-fill" style="width:${pct}%"></div></div>
                            <div class="suivis-campagne-stats">${prog.fait}/${prog.total} · ${pct}% ${anom ? '· <span style="color:var(--danger)">'+anom+' anomalie(s)</span>' : ''}</div>
                            ${(m.execUrl || (m.execFile && m.execFile.html)) ? `<button class="btn-icon" style="margin-top:4px" onclick="event.stopPropagation();SuivisView.ouvrirCampagne('${c.id}')" title="Voir la fiche interne (base de données)">🗄️ Fiche interne</button>` : ''}
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

    // ── Pratiquer une campagne sur le terrain : priorité au fichier HTML
    // importé directement (execFile) — rendu via une URL blob locale, donc
    // TOUJOURS affichable dans la GMAO. Le simple lien (execUrl) reste
    // proposé en repli, mais certains sites (OneDrive/SharePoint...)
    // refusent activement d'être encadrés dans une iframe pour des
    // raisons de sécurité décidées par Microsoft — la GMAO ne peut pas
    // contourner ce blocage depuis une simple URL ; importer le fichier
    // HTML directement résout le problème.
    function pratiquerCampagne(campagneId){
        const campagne = SuivisEngine.getCampagne(campagneId);
        if(!campagne){ return; }
        const modele = SuivisEngine.getModele(campagne.modeleId);
        if(modele && modele.execFile && modele.execFile.html){
            const label = modele.nom + ' — ' + SuivisEngine.titreCampagne(campagneId);
            const blob = new Blob([modele.execFile.html], {type:'text/html'});
            const blobUrl = URL.createObjectURL(blob);
            if(typeof window.openWebview === 'function') window.openWebview(blobUrl, label);
            else window.open(blobUrl, '_blank');
            return;
        }
        if(modele && modele.execUrl){
            const label = modele.nom + ' — ' + SuivisEngine.titreCampagne(campagneId);
            if(typeof window.openExternalLink === 'function') window.openExternalLink(modele.execUrl, label);
            else window.open(modele.execUrl, '_blank');
            return;
        }
        ouvrirCampagne(campagneId);
    }

    // ── Vue Campagne : sections + items ────────────────────────────
    function ouvrirCampagne(campagneId){
        currentCampagneId = campagneId;
        const campagne = SuivisEngine.getCampagne(campagneId);
        const modele = SuivisEngine.getModele(campagne.modeleId);
        const sections = SuivisEngine.listSectionsForCampagne(campagneId);
        const stats = (window.SuivisStats ? SuivisStats.statsCampagne(campagneId) : null);
        const pct = stats ? stats.pourcentageConformite : 0;
        const prog = SuivisEngine.progression(campagneId);
        const complet = prog.total > 0 && prog.fait === prog.total;

        let html = `<div class="suivis-header">
            <button class="btn-icon" onclick="SuivisView.renderAccueil()">←</button>
            <h2>${modele.icone} ${escapeHtml(SuivisEngine.titreCampagne(campagneId))}</h2>
            ${(modele.execUrl || (modele.execFile && modele.execFile.html)) ? `<button class="btn-icon" onclick="SuivisView.pratiquerCampagne('${campagneId}')" title="Ouvrir la page de pratique terrain">🛂</button>` : ''}
            <button class="btn-icon" onclick="SuivisPrint.imprimerFidele('${campagneId}')" title="Imprimer (fidèle)">🖨️</button>
            <button class="btn-icon" onclick="SuivisPrint.imprimerModerne('${campagneId}')" title="Imprimer (moderne + stats)">📊</button>
            <button class="btn-icon" onclick="SuivisView.toggleMenuCampagne('${campagneId}')" title="Exporter / Supprimer">⋮</button>
        </div>
        <div id="suivis-menu-campagne" class="suivis-menu-campagne" style="display:none">
            <div class="suivis-menu-titre">Exporter cette campagne</div>
            <div class="suivis-menu-actions">
                <button class="btn-secondary" onclick="SuivisExport.exporterExcel('${campagneId}')">📗 Excel</button>
                <button class="btn-secondary" onclick="SuivisExport.exporterPDF('${campagneId}')">📕 PDF</button>
                <button class="btn-secondary" onclick="SuivisExport.exporterCSV('${campagneId}')">📄 CSV</button>
                <button class="btn-secondary" onclick="SuivisExport.exporterJSON('${campagneId}')">🗂️ JSON</button>
            </div>
            <div class="suivis-menu-titre suivis-menu-danger">Zone sensible</div>
            <button class="btn-danger" onclick="SuivisView.demanderSuppressionCampagne('${campagneId}')">🗑️ Supprimer cette campagne</button>
        </div>
        <div class="suivis-progress-bar"><div class="suivis-progress-fill" style="width:${pct}%"></div></div>
        <div class="suivis-campagne-stats">${stats ? stats.controlesRealises+'/'+stats.controlesARealiser+' contrôles · '+stats.items+' points · '+pct+'%' + (stats.anomalies?' · <span style="color:var(--danger)">'+stats.anomalies+' anomalie(s)</span>':'') : ''}</div>
        ${campagne.statut === 'terminee'
            ? `<div class="suivis-cloture-badge" style="border-color:${modele.couleur}">
                    🔒 Clôturée le ${escapeHtml((campagne.clotureAt||'').split('T')[0])} par ${escapeHtml(campagne.controleur||'—')}${campagne.qualification ? ' ('+escapeHtml(campagne.qualification)+')' : ''}
                    <button class="btn-secondary" onclick="SuivisView.demanderReouverture('${campagneId}')">Rouvrir</button>
               </div>`
            : (complet
                ? `<button class="btn-primary suivis-btn-cloture" style="background:${modele.couleur}" onclick="SuivisView.demanderCloture('${campagneId}')">✅ Clôturer la campagne</button>`
                : '')}`;

        // Titre/sous-titre de chaque ligne = les 2 premiers champs définis sur
        // le modèle (ex. repère + emplacement pour BAES), jamais des ids fixes —
        // sinon un suivi importé (autres ids de champs) s'affiche vide.
        const champPrincipal = (modele.champsItem||[])[0];
        const champSecondaire = (modele.champsItem||[])[1];

        sections.forEach(section => {
            const items = SuivisEngine.listItemsForSection(section.id);
            html += `<div class="suivis-section"><div class="suivis-section-titre">${escapeHtml(section.nom)}</div>`;
            items.forEach(item => {
                const etatGlobal = deduireEtatGlobalItem(item, modele);
                html += `<div class="suivis-item-row ${etatGlobal.classe}" onclick="SuivisView.ouvrirItem('${item.id}')">
                    <div class="suivis-item-repere">${escapeHtml(champPrincipal ? (item.champs[champPrincipal.id]||'') : '')}</div>
                    <div class="suivis-item-emplacement">${escapeHtml(champSecondaire ? (item.champs[champSecondaire.id]||'') : '')}</div>
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

        const ctrlId = SuivisEngine.premierControleNonFait(itemId);
        if(ctrlId){
            renderPosteRapide(item, modele, ctrlId);
        } else {
            renderItemDetail(item, modele);
        }
    }

    // ── Terrain : poste de contrôle rapide (2 gros boutons OK/HS) ───
    // Le principe opérationnel demandé : au clic sur un équipement, un
    // écran unique avec ses infos + le type de contrôle en cours + la
    // date (modifiable) + 2 gros boutons. OK enregistre et passe direct
    // au point suivant. HS ouvre juste une zone de commentaire obligatoire,
    // puis "Valider" enregistre et passe direct au point suivant. Aucune
    // autre manipulation. Repris à l'identique pour chaque type de
    // contrôle défini sur le modèle (ex. visuel puis décharge pour BAES).
    function renderPosteRapide(item, modele, ctrlId){
        const ctrl = (modele.controles||[]).find(c => c.id === ctrlId);
        const champsHtml = (modele.champsItem||[]).map(cf =>
            `<div class="suivis-champ-ro"><span>${escapeHtml(cf.label)}</span><b>${escapeHtml(item.champs[cf.id]||'—')}</b></div>`
        ).join('');
        const etatsDef = modele.etats || [];
        const etatOK = etatsDef.find(e => !e.commentRequired) || etatsDef[0] || {value:'OK', label:'OK'};
        const etatHS = etatsDef.find(e => e.commentRequired) || etatsDef[1] || {value:'HS', label:'HS'};
        const champTitre = (modele.champsItem||[])[0];
        const dateVal = (item.controles[ctrlId] && item.controles[ctrlId].date) || new Date().toISOString().split('T')[0];

        const html = `<div class="suivis-header">
            <button class="btn-icon" onclick="SuivisView.ouvrirCampagne('${item.campagneId}')">←</button>
            <h2>${escapeHtml(champTitre ? (item.champs[champTitre.id]||'') : '')}</h2>
        </div>
        <div class="suivis-poste-rapide">
            <div class="suivis-champs-ro">${champsHtml}</div>
            <div class="suivis-poste-type" style="color:${modele.couleur}">${escapeHtml(ctrl.label)}</div>
            <label class="suivis-poste-date">Date <input type="date" id="suivi-poste-date" value="${dateVal}"></label>
            <div class="suivis-poste-boutons">
                <button class="suivis-btn-ok" onclick="SuivisView.validerPosteRapide('${item.id}','${ctrl.id}','${etatOK.value}')">${escapeHtml(etatOK.label)}</button>
                <button class="suivis-btn-hs" onclick="SuivisView.demanderCommentairePosteRapide()">${escapeHtml(etatHS.label)}</button>
            </div>
            <div id="suivis-poste-commentaire-zone" style="display:none">
                <label>Commentaire (obligatoire) <textarea id="suivi-poste-commentaire" rows="3"></textarea></label>
                <button class="btn-primary" style="background:${modele.couleur}" onclick="SuivisView.validerPosteRapideAvecCommentaire('${item.id}','${ctrl.id}','${etatHS.value}')">✅ Valider</button>
            </div>
        </div>`;
        safeHTML('view-suivis', html);
    }

    function demanderCommentairePosteRapide(){
        const zone = document.getElementById('suivis-poste-commentaire-zone');
        if(zone) zone.style.display = 'block';
        const ta = document.getElementById('suivi-poste-commentaire');
        if(ta) ta.focus();
    }

    function validerPosteRapide(itemId, ctrlId, etatValue){
        const date = (document.getElementById('suivi-poste-date')||{}).value || new Date().toISOString().split('T')[0];
        const res = SuivisEngine.setControle(itemId, ctrlId, {etat: etatValue, date, commentaire:''});
        if(!res.ok){ toast(res.error, 'error'); return; }
        avancerApresPosteRapide(itemId);
    }

    function validerPosteRapideAvecCommentaire(itemId, ctrlId, etatValue){
        const commentaire = ((document.getElementById('suivi-poste-commentaire')||{}).value||'').trim();
        if(!commentaire){ toast('Commentaire obligatoire pour cet état', 'error'); return; }
        const date = (document.getElementById('suivi-poste-date')||{}).value || new Date().toISOString().split('T')[0];
        const res = SuivisEngine.setControle(itemId, ctrlId, {etat: etatValue, date, commentaire});
        if(!res.ok){ toast(res.error, 'error'); return; }
        avancerApresPosteRapide(itemId);
    }

    // Passage automatique : encore un type de contrôle sur ce même
    // équipement ? sinon l'équipement suivant de la campagne ? sinon
    // retour à la vue campagne (le bouton Clôturer apparaît).
    function avancerApresPosteRapide(itemId){
        const item = SuivisEngine.getItem(itemId);
        const suivantMemeItem = SuivisEngine.premierControleNonFait(itemId);
        if(suivantMemeItem){ ouvrirItem(itemId); return; }
        const prochain = SuivisEngine.prochainPosteAControler(item.campagneId, itemId);
        if(prochain){ ouvrirItem(prochain.itemId); }
        else { toast('Campagne entièrement contrôlée ✅', 'success'); ouvrirCampagne(item.campagneId); }
    }

    // ── Fiche détaillée (relecture / correction d'un point déjà traité) ──
    // Formulaire complet (état, commentaire, contrôleur, photo, signature)
    // pour reprendre un contrôle déjà saisi — le flux rapide ci-dessus ne
    // s'applique qu'au premier passage sur un point non renseigné.
    function renderItemDetail(item, modele){

        let champsHtml = (modele.champsItem||[]).map(cf =>
            `<div class="suivis-champ-ro"><span>${escapeHtml(cf.label)}</span><b>${escapeHtml(item.champs[cf.id]||'—')}</b></div>`
        ).join('');

        let datalistsHtml = '';
        (modele.champsItem||[]).forEach(cf => { if(cf.listeId) datalistsHtml += SuivisListes.datalistHTML(cf.listeId); });
        (modele.controles||[]).forEach(ctrl => {
            Object.keys(ctrl.listesChamps||{}).forEach(listeId => { datalistsHtml += SuivisListes.datalistHTML(listeId); });
        });

        let controlesHtml = (modele.controles||[]).map(ctrl => {
            const val = item.controles[ctrl.id] || {};
            const etatOptions = (modele.etats||[]).map(e =>
                `<option value="${e.value}" ${val.etat===e.value?'selected':''}>${escapeHtml(e.label)}</option>`
            ).join('');
            const listesChamps = ctrl.listesChamps || {};
            const champControleurListeId = Object.keys(listesChamps).find(lid => listesChamps[lid] === 'controleur');
            return `<div class="suivis-controle-bloc">
                <div class="suivis-controle-titre">${escapeHtml(ctrl.label)}</div>
                <label>Date <input type="date" id="suivi-ctrl-date-${ctrl.id}" value="${val.date||''}"></label>
                <label>État <select id="suivi-ctrl-etat-${ctrl.id}">${etatOptions}</select></label>
                <label>Commentaire <textarea id="suivi-ctrl-comment-${ctrl.id}" rows="2">${escapeHtml(val.commentaire||'')}</textarea></label>
                ${ctrl.champs.includes('controleur') ? `
                <label>Contrôleur
                    <input type="text" id="suivi-ctrl-controleur-${ctrl.id}" value="${escapeHtml(val.controleur||'')}"
                        ${champControleurListeId ? `list="suivis-liste-${champControleurListeId}"` : ''} placeholder="Nom du contrôleur">
                </label>` : ''}
                ${ctrl.champs.includes('photo') ? `
                <label>Photo
                    <input type="file" accept="image/*" capture="environment" onchange="SuivisView.capturerPhoto('${ctrl.id}', this.files[0])">
                    ${val.photo ? `<img class="suivis-photo-preview" data-suivis-ref="${escapeHtml(val.photo)}">` : ''}
                </label>` : ''}
                ${ctrl.champs.includes('signature') ? `
                <label>Signature (tactile)
                    <canvas id="suivi-ctrl-signature-${ctrl.id}" class="suivis-signature-canvas" width="320" height="120"></canvas>
                    <div class="suivis-signature-actions">
                        <button type="button" class="btn-secondary" onclick="SuivisView.effacerSignature('${ctrl.id}')">Effacer</button>
                    </div>
                    ${val.signature ? '<span class="suivis-signature-ok">✓ signature enregistrée</span>' : ''}
                </label>` : ''}
                <button class="btn-primary" onclick="SuivisView.enregistrerControle('${ctrl.id}')">Enregistrer</button>
            </div>`;
        }).join('');

        const champPrincipalItem = (modele.champsItem||[])[0];
        const champSecondaireItem = (modele.champsItem||[])[1];
        const html = `<div class="suivis-header">
            <button class="btn-icon" onclick="SuivisView.ouvrirCampagne('${item.campagneId}')">←</button>
            <h2>${escapeHtml(champPrincipalItem ? (item.champs[champPrincipalItem.id]||'') : '')} — ${escapeHtml(champSecondaireItem ? (item.champs[champSecondaireItem.id]||'') : '')}</h2>
        </div>
        <div class="suivis-champs-ro">${champsHtml}</div>
        ${datalistsHtml}
        ${controlesHtml}`;

        safeHTML('view-suivis', html);
        (modele.controles||[]).forEach(ctrl => {
            if(ctrl.champs.includes('signature')) initSignaturePad(ctrl.id, (item.controles[ctrl.id]||{}).signature);
        });
    }

    // ── Signature tactile (canvas natif, souris + doigt) ────────────
    let __signaturePads = {};
    function initSignaturePad(controleId, dataUrlExistante){
        const canvas = document.getElementById('suivi-ctrl-signature-'+controleId);
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        let dessineEnCours = false, dernierPoint = null;

        if(dataUrlExistante){
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            img.src = dataUrlExistante;
        }

        function positionDepuisEvent(e){
            const rect = canvas.getBoundingClientRect();
            const point = e.touches ? e.touches[0] : e;
            return { x: (point.clientX - rect.left) * (canvas.width/rect.width),
                     y: (point.clientY - rect.top) * (canvas.height/rect.height) };
        }
        function debut(e){ e.preventDefault(); dessineEnCours = true; dernierPoint = positionDepuisEvent(e); }
        function trace(e){
            if(!dessineEnCours) return;
            e.preventDefault();
            const p = positionDepuisEvent(e);
            ctx.beginPath(); ctx.moveTo(dernierPoint.x, dernierPoint.y); ctx.lineTo(p.x, p.y); ctx.stroke();
            dernierPoint = p;
        }
        function fin(){ dessineEnCours = false; }

        canvas.addEventListener('mousedown', debut);
        canvas.addEventListener('mousemove', trace);
        window.addEventListener('mouseup', fin);
        canvas.addEventListener('touchstart', debut, {passive:false});
        canvas.addEventListener('touchmove', trace, {passive:false});
        canvas.addEventListener('touchend', fin);

        __signaturePads[controleId] = canvas;
    }

    function effacerSignature(controleId){
        const canvas = __signaturePads[controleId] || document.getElementById('suivi-ctrl-signature-'+controleId);
        if(!canvas) return;
        canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
    }

    let __photoEnAttente = {};
    const SEUIL_STORAGE_OCTETS = 800 * 1024; // au-delà, on tente aussi une version pleine résolution sur Firebase Storage
    function capturerPhoto(controleId, file){
        if(!file) return;
        compressImageToDataURL(file, 1200, 0.7).then(dataUrl => {
            __photoEnAttente[controleId] = dataUrl;
            toast('Photo prête (enregistrer le contrôle pour la sauvegarder)', 'info');
        });
        // Photo volumineuse : on garde aussi une version pleine résolution,
        // envoyée en arrière-plan vers Firebase Storage (n'empêche jamais
        // la sauvegarde normale ci-dessus, même hors ligne).
        if(file.size > SEUIL_STORAGE_OCTETS && window.SuivisStorageSync && currentItemId){
            SuivisStorageSync.programmerUploadPhoto(currentItemId, controleId, file);
        }
    }

    function enregistrerControle(controleId){
        const dateEl = document.getElementById('suivi-ctrl-date-'+controleId);
        const etatEl = document.getElementById('suivi-ctrl-etat-'+controleId);
        const commentEl = document.getElementById('suivi-ctrl-comment-'+controleId);
        const controleurEl = document.getElementById('suivi-ctrl-controleur-'+controleId);
        const signatureCanvas = document.getElementById('suivi-ctrl-signature-'+controleId);
        const valeurs = {
            date: dateEl ? dateEl.value : '',
            etat: etatEl ? etatEl.value : '',
            commentaire: commentEl ? commentEl.value : ''
        };
        if(controleurEl) valeurs.controleur = controleurEl.value;
        if(__photoEnAttente[controleId]) valeurs.photo = __photoEnAttente[controleId];
        if(signatureCanvas && !estCanvasVide(signatureCanvas)) valeurs.signature = signatureCanvas.toDataURL('image/png');
        const res = SuivisEngine.setControle(currentItemId, controleId, valeurs);
        if(!res.ok){ toast(res.error, 'error'); return; }
        delete __photoEnAttente[controleId];
        toast('Contrôle enregistré', 'success');
        if(window.SuivisListes) SuivisListes.rafraichirDOM();
        ouvrirItem(currentItemId);
    }

    function estCanvasVide(canvas){
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for(let i = 3; i < data.length; i += 4){ if(data[i] !== 0) return false; }
        return true;
    }

    // ── Impression déléguée à SuivisPrint (fidèle + moderne) ────────

    // ── Clôture de fin de campagne (contrôleur/qualification/date/signature) ──
    function demanderCloture(campagneId){
        const campagne = SuivisEngine.getCampagne(campagneId);
        const modele = SuivisEngine.getModele(campagne.modeleId);
        const html = `<div class="suivis-header">
                <button class="btn-icon" onclick="SuivisView.ouvrirCampagne('${campagneId}')">←</button>
                <h2>✅ Clôturer la campagne</h2>
            </div>
            <div class="suivis-controle-bloc">
                <label>Contrôleur <input type="text" id="suivi-cloture-controleur" value="${escapeHtml(campagne.controleur||'')}" placeholder="Nom du contrôleur"></label>
                <label>Qualification <input type="text" id="suivi-cloture-qualification" value="${escapeHtml(campagne.qualification||'')}" placeholder="ex. Agent technique qualifié"></label>
                <label>Date <input type="date" id="suivi-cloture-date" value="${campagne.dateControle || new Date().toISOString().split('T')[0]}"></label>
                <label>Commentaires généraux <textarea id="suivi-cloture-commentaire" rows="3">${escapeHtml(campagne.commentaireGeneral||'')}</textarea></label>
                <label>Signature (tactile)
                    <canvas id="suivi-ctrl-signature-cloture" class="suivis-signature-canvas" width="320" height="120"></canvas>
                    <div class="suivis-signature-actions">
                        <button type="button" class="btn-secondary" onclick="SuivisView.effacerSignature('cloture')">Effacer</button>
                    </div>
                </label>
                <button class="btn-primary" style="background:${modele.couleur}" onclick="SuivisView.confirmerCloture('${campagneId}')">✅ Valider et clôturer</button>
                <button class="btn-secondary" onclick="SuivisView.ouvrirCampagne('${campagneId}')">Annuler</button>
            </div>`;
        safeHTML('view-suivis', html);
        initSignaturePad('cloture', campagne.signature);
    }

    function confirmerCloture(campagneId){
        const controleur = (document.getElementById('suivi-cloture-controleur')||{}).value || '';
        const qualification = (document.getElementById('suivi-cloture-qualification')||{}).value || '';
        const dateControle = (document.getElementById('suivi-cloture-date')||{}).value || '';
        const commentaireGeneral = (document.getElementById('suivi-cloture-commentaire')||{}).value || '';
        const canvas = document.getElementById('suivi-ctrl-signature-cloture');
        const valeurs = {controleur: controleur.trim(), qualification: qualification.trim(), dateControle, commentaireGeneral: commentaireGeneral.trim()};
        if(canvas && !estCanvasVide(canvas)) valeurs.signature = canvas.toDataURL('image/png');
        const res = SuivisEngine.cloturerCampagne(campagneId, valeurs);
        if(!res.ok){ toast(res.error, 'error'); return; }
        toast('Campagne clôturée', 'success');
        ouvrirCampagne(campagneId);
    }

    // Réouverture volontairement simple (confirm natif) : le verrou par code
    // administrateur (2580) prévu dans la refonte complète n'est pas encore
    // câblé — à ajouter avec la suppression protégée.
    function demanderReouverture(campagneId){
        if(!confirm('Rouvrir cette campagne clôturée ? Les contrôles redeviendront modifiables.')) return;
        SuivisEngine.reouvrirCampagne(campagneId);
        toast('Campagne rouverte', 'info');
        ouvrirCampagne(campagneId);
    }

    // ── Campagnes en cours (toutes catégories) — depuis la tuile d'accueil ──
    function ouvrirCampagnesEnCours(){
        const campagnes = SuivisEngine.listCampagnesInachevees();
        let html = `<div class="suivis-header">
                <button class="btn-icon" onclick="SuivisView.renderAccueil()">←</button>
                <h2>⏳ Campagnes en cours</h2>
            </div>`;
        if(!campagnes.length){
            html += '<div class="suivis-empty">Aucune campagne en cours pour l\'instant.</div>';
        } else {
            html += '<div class="suivis-campagne-list">';
            campagnes.forEach(c => {
                const modele = SuivisEngine.getModele(c.modeleId);
                const prog = SuivisEngine.progression(c.id);
                const pct = prog.total ? Math.round(100*prog.fait/prog.total) : 0;
                const anom = SuivisEngine.anomalies(c.id);
                html += `<div class="suivis-campagne-row" style="border-left:4px solid ${modele?modele.couleur:'#3b82f6'}" onclick="SuivisView.pratiquerCampagne('${c.id}')">
                    <div class="suivis-campagne-nom">${modele && (modele.execUrl || (modele.execFile && modele.execFile.html)) ? '🛂 ' : (modele?modele.icone:'📋')+' '} ${escapeHtml(modele?modele.nom:'')} — ${escapeHtml(SuivisEngine.titreCampagne(c.id))}</div>
                    <div class="suivis-progress-bar"><div class="suivis-progress-fill" style="width:${pct}%"></div></div>
                    <div class="suivis-campagne-stats">${prog.fait}/${prog.total} · ${pct}% ${anom ? '· <span style="color:var(--danger)">'+anom+' anomalie(s)</span>' : ''}</div>
                    ${modele && (modele.execUrl || (modele.execFile && modele.execFile.html)) ? `<button class="btn-icon" style="margin-top:4px" onclick="event.stopPropagation();SuivisView.ouvrirCampagne('${c.id}')" title="Voir la fiche interne (base de données)">🗄️ Fiche interne</button>` : ''}
                </div>`;
            });
            html += '</div>';
        }
        safeHTML('view-suivis', html);
    }

    // ── Modification rapide couleur/icône d'un modèle existant ──────
    // Nécessaire pour les modèles créés avant cette fonctionnalité (ou
    // via un seed direct comme importerModeleBAES, qui ne passe pas
    // par le Studio) : sans ceci, impossible de changer leur couleur.
    function modifierApparenceModele(modeleId){
        const m = SuivisEngine.getModele(modeleId);
        if(!m) return;
        appearanceExecFilePending = undefined;
        const html = `<div class="suivis-header">
                <button class="btn-icon" onclick="SuivisView.renderAccueil()">←</button>
                <h2>🎨 Apparence — ${escapeHtml(m.nom)}</h2>
            </div>
            <div class="suivis-builder-section">
                <label>Icône <input type="text" id="suivis-app-icone" maxlength="2" style="width:3.5em;text-align:center" value="${escapeHtml(m.icone)}"></label>
                <label class="suivis-builder-couleur">Couleur de campagne
                    <input type="color" id="suivis-app-couleur" value="${m.couleur}">
                    <span id="suivis-app-couleur-preview" class="suivis-builder-couleur-preview" style="background:${m.couleur}"></span>
                </label>
                <div class="suivis-builder-couleur-presets">
                    ${['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#64748b']
                        .map(c=>`<button type="button" class="suivis-couleur-swatch" style="background:${c}" onclick="document.getElementById('suivis-app-couleur').value='${c}';document.getElementById('suivis-app-couleur-preview').style.background='${c}'"></button>`).join('')}
                </div>
                <label>🛂 Page de pratique terrain — Option A : adresse URL (optionnel)
                    <input type="url" id="suivis-app-execurl" value="${escapeHtml(m.execUrl||'')}" placeholder="https://onedrive.live.com/...">
                </label>
                <p style="font-size:.7rem;color:var(--text-muted);margin:2px 0 8px">
                    ⚠️ Certains sites (OneDrive, SharePoint...) refusent par sécurité d'être affichés dans une autre application. Si le bouton 🛂 n'affiche rien, utilisez l'option B — elle fonctionne toujours.
                </p>
                <label style="font-size:.85rem">Option B : importer directement le fichier HTML (recommandé, fonctionne toujours)</label>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
                    <button type="button" class="btn-secondary" onclick="document.getElementById('suivis-app-execfile').click()">📥 Choisir un fichier .html</button>
                    <input type="file" id="suivis-app-execfile" accept=".html,.htm,text/html" style="display:none" onchange="SuivisView.majApparenceExecFile(this.files[0])">
                    <span id="suivis-app-execfile-name" style="font-size:.8rem;color:var(--text-muted)">${m.execFile ? '📄 '+escapeHtml(m.execFile.name)+' (importé)' : ''}</span>
                    ${m.execFile ? `<button type="button" class="btn-icon" id="suivis-app-execfile-remove" onclick="SuivisView.retirerApparenceExecFile()" title="Retirer">🗑️</button>` : `<button type="button" class="btn-icon" id="suivis-app-execfile-remove" style="display:none" onclick="SuivisView.retirerApparenceExecFile()" title="Retirer">🗑️</button>`}
                </div>
                <p style="font-size:.72rem;color:var(--text-muted)">
                    Si l'une des deux options est renseignée, cliquer sur une campagne de ce suivi ouvrira directement cette page (la fiche interne reste accessible via 🗄️).
                </p>
                <button class="btn-primary" onclick="SuivisView.enregistrerApparenceModele('${modeleId}')">✅ Enregistrer</button>
            </div>`;
        safeHTML('view-suivis', html);
        document.getElementById('suivis-app-couleur').addEventListener('input', function(){
            document.getElementById('suivis-app-couleur-preview').style.background = this.value;
        });
    }

    function majApparenceExecFile(file){
        if(!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            appearanceExecFilePending = {name:file.name, html:reader.result};
            const nameEl = document.getElementById('suivis-app-execfile-name');
            const removeBtn = document.getElementById('suivis-app-execfile-remove');
            if(nameEl) nameEl.textContent = '📄 ' + file.name + ' (importé)';
            if(removeBtn) removeBtn.style.display = 'inline-flex';
            toast('Page terrain importée : ' + file.name, 'success');
        };
        reader.onerror = () => toast('Lecture du fichier impossible', 'error');
        reader.readAsText(file, 'utf-8');
    }
    function retirerApparenceExecFile(){
        appearanceExecFilePending = null;
        const nameEl = document.getElementById('suivis-app-execfile-name');
        const removeBtn = document.getElementById('suivis-app-execfile-remove');
        if(nameEl) nameEl.textContent = '';
        if(removeBtn) removeBtn.style.display = 'none';
    }

    function enregistrerApparenceModele(modeleId){
        const icone = document.getElementById('suivis-app-icone').value.trim() || '📋';
        const couleur = document.getElementById('suivis-app-couleur').value;
        const execUrl = (document.getElementById('suivis-app-execurl').value || '').trim();
        const patch = {icone, couleur, execUrl};
        // execFile : uniquement modifié si l'utilisateur a importé ou retiré un fichier
        // pendant cette session d'édition (sinon on ne touche pas à celui déjà enregistré)
        if(appearanceExecFilePending !== undefined) patch.execFile = appearanceExecFilePending;
        SuivisEngine.updateModele(modeleId, patch);
        toast('Apparence mise à jour', 'success');
        renderAccueil();
    }

    // ── Assistant "Nouveau suivi" — délègue à SuivisModelBuilder (V2) ──
    function ouvrirAssistantNouveauSuivi(){
        if(window.SuivisModelBuilder) SuivisModelBuilder.ouvrirAssistant();
        else toast('Assistant non chargé (suivis-model-builder.js manquant)', 'error');
    }

    function escapeHtml(str){
        return String(str==null?'':str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    // ── Menu campagne (export / suppression) ────────────────────────
    function toggleMenuCampagne(){
        const el = document.getElementById('suivis-menu-campagne');
        if(!el) return;
        el.style.display = (el.style.display === 'none' || !el.style.display) ? 'block' : 'none';
    }

    // ── Suppression d'une campagne — DOUBLE VALIDATION ──────────────
    // Étape 1 (ce bouton) : affiche un récapitulatif complet (nombre de
    // points, de contrôles déjà saisis, photos, signatures) et exige de
    // retaper EXACTEMENT le nom de la campagne pour activer le bouton
    // final. Étape 2 : confirmerSuppressionCampagne() vérifie la saisie
    // et supprime réellement. Aucune suppression n'est possible en un
    // seul clic, y compris par erreur de manipulation tactile.
    function demanderSuppressionCampagne(campagneId){
        const resume = SuivisEngine.resumeCampagnePourSuppression(campagneId);
        if(!resume) return;
        const html = `<div class="suivis-header">
                <button class="btn-icon" onclick="SuivisView.ouvrirCampagne('${campagneId}')">←</button>
                <h2>⚠️ Supprimer la campagne</h2>
            </div>
            <div class="suivis-warning-box">
                Cette action est <b>définitive</b> et supprime tout ce qui appartient à cette
                campagne : les sections, les points de contrôle et l'historique de leurs contrôles
                (dates, états, commentaires, photos, signatures). Les autres campagnes et le
                modèle "${escapeHtml(resume.modeleNom)}" ne sont pas affectés.
            </div>
            <div class="suivis-champs-ro">
                <div class="suivis-champ-ro"><span>Campagne</span><b>${escapeHtml(resume.nom)}</b></div>
                <div class="suivis-champ-ro"><span>Sections</span><b>${resume.nbSections}</b></div>
                <div class="suivis-champ-ro"><span>Points de contrôle</span><b>${resume.nbItems}</b></div>
                <div class="suivis-champ-ro"><span>Contrôles déjà saisis</span><b>${resume.controlesSaisis}</b></div>
                <div class="suivis-champ-ro"><span>Photos</span><b>${resume.photos}</b></div>
                <div class="suivis-champ-ro"><span>Signatures</span><b>${resume.signatures}</b></div>
            </div>
            <div class="suivis-controle-bloc">
                <label>Pour confirmer, retapez exactement le nom de la campagne :
                    <b>${escapeHtml(resume.nom)}</b>
                    <input type="text" id="suivis-confirm-suppression-texte" autocomplete="off" placeholder="${escapeHtml(resume.nom)}"
                        oninput="SuivisView.verifierConfirmationSuppression()">
                </label>
                <button id="suivis-btn-confirmer-suppression" class="btn-danger" disabled
                    onclick="SuivisView.confirmerSuppressionCampagne('${campagneId}')">
                    🗑️ Supprimer définitivement cette campagne
                </button>
                <button class="btn-secondary" onclick="SuivisView.ouvrirCampagne('${campagneId}')">Annuler</button>
            </div>`;
        __suppressionAttendue = resume.nom;
        safeHTML('view-suivis', html);
    }

    let __suppressionAttendue = null;

    function verifierConfirmationSuppression(){
        const input = document.getElementById('suivis-confirm-suppression-texte');
        const btn = document.getElementById('suivis-btn-confirmer-suppression');
        if(!input || !btn) return;
        btn.disabled = (input.value.trim() !== (__suppressionAttendue||'').trim());
    }

    function confirmerSuppressionCampagne(campagneId){
        const btn = document.getElementById('suivis-btn-confirmer-suppression');
        if(btn && btn.disabled) return; // sécurité supplémentaire : refuse si le texte ne correspond pas
        SuivisEngine.deleteCampagne(campagneId);
        __suppressionAttendue = null;
        toast('Campagne supprimée', 'success');
        renderAccueil();
    }

    // ── Suppression d'un modèle entier (carte d'accueil) — DOUBLE VALIDATION ──
    // Même principe que la suppression de campagne : récapitulatif complet
    // (toutes campagnes confondues) puis saisie exacte du nom pour activer
    // le bouton final. Supprime le modèle ET toutes ses campagnes.
    function demanderSuppressionModele(modeleId){
        const resume = SuivisEngine.resumeModelePourSuppression(modeleId);
        if(!resume) return;
        const html = `<div class="suivis-header">
                <button class="btn-icon" onclick="SuivisView.renderAccueil()">←</button>
                <h2>⚠️ Supprimer le suivi</h2>
            </div>
            <div class="suivis-warning-box">
                Cette action est <b>définitive</b> et supprime le suivi "${escapeHtml(resume.nom)}"
                ainsi que <b>toutes ses campagnes</b> (sections, points de contrôle, historique,
                photos, signatures). Les autres suivis ne sont pas affectés.
            </div>
            <div class="suivis-champs-ro">
                <div class="suivis-champ-ro"><span>Suivi</span><b>${escapeHtml(resume.nom)}</b></div>
                <div class="suivis-champ-ro"><span>Campagnes</span><b>${resume.nbCampagnes}</b></div>
                <div class="suivis-champ-ro"><span>Points de contrôle</span><b>${resume.nbItems}</b></div>
                <div class="suivis-champ-ro"><span>Contrôles déjà saisis</span><b>${resume.controlesSaisis}</b></div>
                <div class="suivis-champ-ro"><span>Photos</span><b>${resume.photos}</b></div>
                <div class="suivis-champ-ro"><span>Signatures</span><b>${resume.signatures}</b></div>
            </div>
            <div class="suivis-controle-bloc">
                <label>Pour confirmer, retapez exactement le nom du suivi :
                    <b>${escapeHtml(resume.nom)}</b>
                    <input type="text" id="suivis-confirm-suppression-texte" autocomplete="off" placeholder="${escapeHtml(resume.nom)}"
                        oninput="SuivisView.verifierConfirmationSuppression()">
                </label>
                <button id="suivis-btn-confirmer-suppression" class="btn-danger" disabled
                    onclick="SuivisView.confirmerSuppressionModele('${modeleId}')">
                    🗑️ Supprimer définitivement ce suivi
                </button>
                <button class="btn-secondary" onclick="SuivisView.renderAccueil()">Annuler</button>
            </div>`;
        __suppressionAttendue = resume.nom;
        safeHTML('view-suivis', html);
    }

    function confirmerSuppressionModele(modeleId){
        const btn = document.getElementById('suivis-btn-confirmer-suppression');
        if(btn && btn.disabled) return;
        SuivisEngine.deleteModele(modeleId);
        __suppressionAttendue = null;
        toast('Suivi supprimé', 'success');
        renderAccueil();
    }

    return {
        renderAccueil, importerModeleBAES, nouvelleCampagne,
        ouvrirCampagne, pratiquerCampagne, ouvrirItem, capturerPhoto, enregistrerControle,
        demanderCommentairePosteRapide, validerPosteRapide, validerPosteRapideAvecCommentaire,
        effacerSignature, ouvrirAssistantNouveauSuivi,
        demanderCloture, confirmerCloture, demanderReouverture,
        modifierApparenceModele, enregistrerApparenceModele,
        majApparenceExecFile, retirerApparenceExecFile,
        ouvrirCampagnesEnCours,
        toggleMenuCampagne, demanderSuppressionCampagne,
        verifierConfirmationSuppression, confirmerSuppressionCampagne,
        demanderSuppressionModele, confirmerSuppressionModele
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
