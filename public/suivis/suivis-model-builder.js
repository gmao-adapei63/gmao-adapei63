// ═════════════════════════════════════════════════════════════════
// ASSISTANT "NOUVEAU SUIVI" — V2
// ═════════════════════════════════════════════════════════════════
// Additif. Relie SuivisImportParser (analyse) à SuivisEngine (création).
// Étape de validation obligatoire entre les deux : rien n'est créé
// silencieusement depuis un document importé.
// ═════════════════════════════════════════════════════════════════

const SuivisModelBuilder = (function(){

    let travail = null; // {nom, domaine, sousDomaine, icone, couleur, champsItem, controles, sections, avertissements, typeSource}

    function esc(str){
        return String(str==null?'':str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    function toast(msg, type){
        const icon = type==='error' ? '⚠️' : (type==='success' ? '✅' : 'ℹ️');
        if(typeof window.showAlarmToast === 'function') window.showAlarmToast(icon, msg, '', type==='error' ? 'danger':'warning');
    }

    // ── Étape 1 : choix import vs manuel ────────────────────────────
    function ouvrirAssistant(){
        travail = null;
        const html = `<div class="suivis-header">
                <button class="btn-icon" onclick="SuivisView.renderAccueil()">←</button>
                <h2>➕ Nouveau suivi</h2>
            </div>
            <div class="suivis-import-choix">
                <div class="suivis-import-card" onclick="document.getElementById('suivi-import-file').click()">
                    <div class="suivis-import-icon">📥</div>
                    <div>Importer un document</div>
                    <span>Excel, PDF, Word, HTML, JSON, CSV, Image</span>
                </div>
                <div class="suivis-import-card" onclick="SuivisModelBuilder.creationManuelle()">
                    <div class="suivis-import-icon">✏️</div>
                    <div>Créer manuellement</div>
                    <span>Je définis moi-même les champs</span>
                </div>
            </div>
            <input type="file" id="suivi-import-file" style="display:none"
                accept="*/*"
                onchange="SuivisModelBuilder.fichierChoisi(this.files[0])">`;
        safeHTML('view-suivis', html);
    }

    function fichierChoisi(file){
        if(!file) return;
        safeHTML('view-suivis', '<div class="suivis-header"><h2>⏳ Analyse de "' + esc(file.name) + '"…</h2></div>');
        window.SuivisImportParser.analyserFichier(file).then(prop => {
            travail = {
                nom: prop.titreDetecte || file.name.replace(/\.[^.]+$/,''),
                domaine: '', sousDomaine: '', icone: '📋', couleur: '#3b82f6',
                champsItem: (prop.champsDetectes||[]).map(c => ({id:c.id, label:c.label, type:c.type||'texte'})),
                controles: (prop.controlesDetectes||[]).map(c => ({id:c.id, label:c.label, champs:c.champs||['date','etat','commentaire']})),
                sections: prop.sections || [],
                avertissements: prop.avertissements || [],
                typeSource: prop.typeSource
            };
            if(travail.champsItem.length === 0){
                travail.champsItem.push({id:'nom', label:'Nom', type:'texte'});
            }
            if(travail.controles.length === 0){
                travail.controles.push({id:'controle_0', label:'Contrôle', champs:['date','etat','commentaire']});
            }
            renderApercu();
        }).catch(err => {
            toast('Erreur d\'analyse : ' + (err.message||err), 'error');
            ouvrirAssistant();
        });
    }

    function creationManuelle(){
        travail = {
            nom: '', domaine: '', sousDomaine: '', icone:'📋', couleur:'#3b82f6',
            champsItem: [{id:'nom', label:'Nom', type:'texte'}],
            controles: [{id:'controle_0', label:'Contrôle', champs:['date','etat','commentaire']}],
            sections: [], avertissements: [], typeSource: 'manuel'
        };
        renderApercu();
    }

    // ── Étape 2 : aperçu / correction avant création ────────────────
    function renderApercu(){
        const t = travail;
        const nbItems = t.sections.reduce((n,s)=>n+(s.items?s.items.length:0),0);

        let avertissementsHtml = t.avertissements.length
            ? `<div class="suivis-warning-box">${t.avertissements.map(a=>'⚠️ '+esc(a)).join('<br>')}</div>` : '';

        let champsHtml = t.champsItem.map((c, i) => `
            <div class="suivis-builder-row">
                <input type="text" value="${esc(c.label)}" oninput="SuivisModelBuilder.majChamp(${i},'label',this.value)">
                <select onchange="SuivisModelBuilder.majChamp(${i},'type',this.value)">
                    ${['texte','nombre','date','liste','photo'].map(opt=>`<option value="${opt}" ${c.type===opt?'selected':''}>${opt}</option>`).join('')}
                </select>
                <button class="btn-icon" onclick="SuivisModelBuilder.retirerChamp(${i})">✕</button>
            </div>`).join('');

        let controlesHtml = t.controles.map((c, i) => `
            <div class="suivis-builder-row">
                <input type="text" value="${esc(c.label)}" oninput="SuivisModelBuilder.majControle(${i},this.value)">
                <button class="btn-icon" onclick="SuivisModelBuilder.retirerControle(${i})">✕</button>
            </div>`).join('');

        const html = `<div class="suivis-header">
                <button class="btn-icon" onclick="SuivisModelBuilder.ouvrirAssistant()">←</button>
                <h2>Aperçu du suivi</h2>
            </div>
            ${avertissementsHtml}
            <div class="suivis-builder-section">
                <label>Nom du suivi <input type="text" value="${esc(t.nom)}" oninput="SuivisModelBuilder.majMeta('nom',this.value)"></label>
                <label>Domaine <input type="text" value="${esc(t.domaine)}" oninput="SuivisModelBuilder.majMeta('domaine',this.value)" placeholder="ex. Sécurité & Contrôles réglementaires"></label>
                <label>Sous-domaine <input type="text" value="${esc(t.sousDomaine)}" oninput="SuivisModelBuilder.majMeta('sousDomaine',this.value)"></label>
                <label>Icône <input type="text" maxlength="2" style="width:3.5em;text-align:center" value="${esc(t.icone)}" oninput="SuivisModelBuilder.majMeta('icone',this.value)"></label>
                <label class="suivis-builder-couleur">Couleur de campagne
                    <input type="color" value="${esc(t.couleur)}" oninput="SuivisModelBuilder.majMeta('couleur',this.value)">
                    <span class="suivis-builder-couleur-preview" style="background:${esc(t.couleur)}"></span>
                </label>
                <div class="suivis-builder-couleur-presets">
                    ${['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#64748b']
                        .map(c=>`<button type="button" class="suivis-couleur-swatch" style="background:${c}" onclick="SuivisModelBuilder.majMeta('couleur','${c}');SuivisModelBuilder.renderApercu()"></button>`).join('')}
                </div>
            </div>
            <div class="suivis-builder-section">
                <div class="suivis-builder-titre">Champs de chaque point de contrôle</div>
                ${champsHtml}
                <button class="btn-secondary" onclick="SuivisModelBuilder.ajouterChamp()">+ Ajouter un champ</button>
            </div>
            <div class="suivis-builder-section">
                <div class="suivis-builder-titre">Types de contrôle (date + état à chaque fois)</div>
                ${controlesHtml}
                <button class="btn-secondary" onclick="SuivisModelBuilder.ajouterControle()">+ Ajouter un contrôle</button>
            </div>
            <div class="suivis-builder-section">
                <div class="suivis-builder-titre">Données détectées</div>
                <div>${t.sections.length} section(s), ${nbItems} point(s) de contrôle</div>
            </div>
            <button class="btn-primary" onclick="SuivisModelBuilder.confirmerCreation()">✅ Créer ce suivi</button>`;
        safeHTML('view-suivis', html);
    }

    function majMeta(cle, val){ travail[cle] = val; }
    function majChamp(i, cle, val){ travail.champsItem[i][cle] = val; }
    function retirerChamp(i){ travail.champsItem.splice(i,1); renderApercu(); }
    function ajouterChamp(){ travail.champsItem.push({id:'champ_'+Date.now(), label:'Nouveau champ', type:'texte'}); renderApercu(); }
    function majControle(i, val){ travail.controles[i].label = val; }
    function retirerControle(i){ travail.controles.splice(i,1); renderApercu(); }
    function ajouterControle(){ travail.controles.push({id:'controle_'+Date.now(), label:'Nouveau contrôle', champs:['date','etat','commentaire']}); renderApercu(); }

    // ── Étape 3 : création réelle via le moteur ─────────────────────
    function confirmerCreation(){
        const t = travail;
        if(!t.nom.trim()){ toast('Donnez un nom au suivi avant de continuer', 'error'); return; }
        const modeleId = SuivisEngine.createModele({
            nom: t.nom, domaine: t.domaine, sousDomaine: t.sousDomaine,
            icone: t.icone, couleur: t.couleur,
            champsItem: t.champsItem, controles: t.controles,
            source: {type: t.typeSource, importedAt: new Date().toISOString()}
        });
        const campagneId = SuivisEngine.createCampagne(modeleId, 'Campagne initiale');
        (t.sections||[]).forEach((section, idx) => {
            const sectionId = SuivisEngine.addSection(campagneId, section.nom || ('Section '+(idx+1)), idx);
            (section.items||[]).forEach(it => {
                SuivisEngine.addItem(sectionId, campagneId, modeleId, it.champs || {});
            });
        });
        toast('Suivi "' + t.nom + '" créé', 'success');
        travail = null;
        SuivisView.ouvrirCampagne(campagneId);
    }

    return {
        ouvrirAssistant, fichierChoisi, creationManuelle, renderApercu,
        majMeta, majChamp, retirerChamp, ajouterChamp,
        majControle, retirerControle, ajouterControle, confirmerCreation
    };
})();

window.SuivisModelBuilder = SuivisModelBuilder;
