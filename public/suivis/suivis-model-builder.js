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
                <div class="suivis-import-card" onclick="SuivisModelBuilder.ouvrirLienURL()">
                    <div class="suivis-import-icon">🔗</div>
                    <div>Lier une page (URL)</div>
                    <span>Ex. fiche terrain HTML sur OneDrive</span>
                </div>
            </div>
            <input type="file" id="suivi-import-file" style="display:none"
                accept="*/*"
                onchange="SuivisModelBuilder.fichierChoisi(this.files[0])">`;
        safeHTML('view-suivis', html);
    }

    // ── Choix 3 : lier une URL (page HTML de pratique terrain) ─────
    function ouvrirLienURL(){
        const html = `<div class="suivis-header">
                <button class="btn-icon" onclick="SuivisModelBuilder.ouvrirAssistant()">←</button>
                <h2>🔗 Lier une page (URL)</h2>
            </div>
            <div class="suivis-builder-section">
                <label>Adresse de la page à lier (ex. page HTML publiée sur OneDrive)
                    <input type="url" id="suivi-lien-url" placeholder="https://onedrive.live.com/...">
                </label>
                <p style="font-size:.8rem;color:var(--text-muted)">
                    Une brève analyse est tentée pour pré-remplir le nom du suivi si la page est accessible.
                    Si ce n'est pas possible (restriction de sécurité du site distant), l'adresse reste tout de
                    même enregistrée — vous complétez ensuite le nom, le domaine, les champs et la récurrence
                    exactement comme pour un suivi créé manuellement.
                </p>
                <div id="suivi-lien-status" style="font-size:.82rem;color:var(--text-muted)"></div>
            </div>
            <button class="btn-primary" onclick="SuivisModelBuilder.analyserLienURL()">🔎 Analyser et continuer</button>`;
        safeHTML('view-suivis', html);
    }
    function analyserLienURL(){
        const url = document.getElementById('suivi-lien-url').value.trim();
        if(!url){ toast('Indiquez une adresse URL', 'error'); return; }
        const statusEl = document.getElementById('suivi-lien-status');
        if(statusEl) statusEl.textContent = '⏳ Analyse en cours…';

        let hostname = '';
        try{ hostname = new URL(url).hostname.replace(/^www\./,''); }catch(e){}
        const fallbackNom = hostname ? ('Suivi lié — ' + hostname) : 'Nouveau suivi lié';

        const demarrer = (nom) => {
            travail = {
                nom, domaine:'', sousDomaine:'', icone:'📋', couleur:'#3b82f6',
                champsItem:[{id:'nom', label:'Nom', type:'texte'}],
                controles:[{id:'controle_0', label:'Contrôle', champs:['date','etat','commentaire']}],
                sections:[], avertissements:[], typeSource:'lien_url',
                execUrl: url,
                recurrence:{recType:'none', selectedDays:[], interval:1, endType:'forever', endDate:null}
            };
            renderApercu();
        };

        fetch(url, {mode:'cors'}).then(r=>{
            if(!r.ok) throw new Error('HTTP '+r.status);
            return r.text();
        }).then(text=>{
            const doc = new DOMParser().parseFromString(text, 'text/html');
            const titre = (doc.querySelector('h1')?.textContent || doc.querySelector('title')?.textContent || '').trim();
            toast('Page analysée', 'success');
            demarrer(titre || fallbackNom);
        }).catch(()=>{
            toast('Analyse automatique impossible (restriction de sécurité du site distant) — le lien reste bien enregistré', 'warning');
            demarrer(fallbackNom);
        });
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
                typeSource: prop.typeSource,
                execUrl: '',
                recurrence: {recType:'none', selectedDays:[], interval:1, endType:'forever', endDate:null}
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
            sections: [], avertissements: [], typeSource: 'manuel',
            execUrl: '',
            recurrence: {recType:'none', selectedDays:[], interval:1, endType:'forever', endDate:null}
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
                <label>🛂 Page de pratique terrain (URL, optionnel)
                    <input type="url" value="${esc(t.execUrl||'')}" placeholder="https://onedrive.live.com/..." oninput="SuivisModelBuilder.majMeta('execUrl',this.value)">
                </label>
                <p style="font-size:.72rem;color:var(--text-muted);margin:2px 0 0">
                    Si renseignée, cliquer sur une campagne de ce suivi ouvrira directement cette page au lieu de la fiche interne (qui reste accessible via l'icône 🗄️).
                </p>
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
                <div class="suivis-builder-titre">Échéance / récurrence de ce suivi</div>
                <label>Fréquence
                    <select id="suivis-rec-type" onchange="SuivisModelBuilder.majRecurrenceType(this.value)">
                        <option value="none" ${t.recurrence.recType==='none'?'selected':''}>Aucune (ponctuelle)</option>
                        <option value="daily" ${t.recurrence.recType==='daily'?'selected':''}>Quotidienne</option>
                        <option value="weekly" ${t.recurrence.recType==='weekly'?'selected':''}>Hebdomadaire (même jour)</option>
                        <option value="biweekly" ${t.recurrence.recType==='biweekly'?'selected':''}>Tous les 15 jours</option>
                        <option value="monthlyX" ${t.recurrence.recType==='monthlyX'?'selected':''}>Tous les X mois</option>
                        <option value="yearlyX" ${t.recurrence.recType==='yearlyX'?'selected':''}>Tous les X ans</option>
                        <option value="custom" ${t.recurrence.recType==='custom'?'selected':''}>Jours spécifiques</option>
                    </select>
                </label>
                <div id="suivis-rec-interval" style="display:${(t.recurrence.recType==='monthlyX'||t.recurrence.recType==='yearlyX')?'block':'none'}">
                    <label>Tous les combien de ${t.recurrence.recType==='yearlyX'?'ans':'mois'} ?
                        <input type="number" min="1" step="1" value="${t.recurrence.interval||1}" oninput="SuivisModelBuilder.majRecurrence('interval', parseInt(this.value,10)||1)">
                    </label>
                </div>
                <div id="suivis-rec-days" style="display:${t.recurrence.recType==='custom'?'block':'none'}">
                    <div class="suivis-builder-titre">Jours</div>
                    <div class="days-checkboxes">
                        ${[['1','Lun'],['2','Mar'],['3','Mer'],['4','Jeu'],['5','Ven'],['6','Sam'],['0','Dim']].map(([v,l])=>
                            `<label><input type="checkbox" value="${v}" ${t.recurrence.selectedDays.includes(parseInt(v,10))?'checked':''} onchange="SuivisModelBuilder.toggleRecurrenceJour(${v},this.checked)"><span>${l}</span></label>`
                        ).join('')}
                    </div>
                </div>
                ${t.recurrence.recType!=='none' ? `
                <label>Se termine
                    <select id="suivis-rec-end" onchange="SuivisModelBuilder.majRecurrence('endType', this.value)">
                        <option value="forever" ${t.recurrence.endType==='forever'?'selected':''}>Toujours</option>
                        <option value="untilDate" ${t.recurrence.endType==='untilDate'?'selected':''}>Jusqu'à une date précise</option>
                    </select>
                </label>
                ${t.recurrence.endType==='untilDate' ? `<label>Date de fin <input type="date" value="${t.recurrence.endDate||''}" oninput="SuivisModelBuilder.majRecurrence('endDate', this.value)"></label>` : ''}
                ` : ''}
            </div>
            <div class="suivis-builder-section">
                <div class="suivis-builder-titre">Données détectées</div>
                <div>${t.sections.length} section(s), ${nbItems} point(s) de contrôle</div>
            </div>
            <button class="btn-primary" onclick="SuivisModelBuilder.confirmerCreation()">✅ Créer ce suivi</button>`;
        safeHTML('view-suivis', html);
    }

    function majMeta(cle, val){ travail[cle] = val; }
    function majRecurrence(cle, val){ travail.recurrence[cle] = val; }
    function majRecurrenceType(val){ travail.recurrence.recType = val; renderApercu(); }
    function toggleRecurrenceJour(jour, coche){
        const s = travail.recurrence.selectedDays;
        if(coche){ if(!s.includes(jour)) s.push(jour); }
        else { travail.recurrence.selectedDays = s.filter(j => j !== jour); }
    }
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
            execUrl: t.execUrl || '',
            source: {type: t.typeSource, importedAt: new Date().toISOString()}
        });
        const campagneId = SuivisEngine.createCampagne(modeleId, 'Campagne initiale');
        (t.sections||[]).forEach((section, idx) => {
            const sectionId = SuivisEngine.addSection(campagneId, section.nom || ('Section '+(idx+1)), idx);
            (section.items||[]).forEach(it => {
                SuivisEngine.addItem(sectionId, campagneId, modeleId, it.champs || {});
            });
        });

        // Échéance : ne crée PAS un système différent — pousse une règle
        // dans le moteur de récurrence EXISTANT (appState.recurringRules,
        // celui des missions). generateRecurringTasksForDate() (déjà
        // appelé chaque jour par loadDayData) s'occupera de faire
        // apparaître la mission le moment venu, exactement comme pour
        // n'importe quelle autre mission récurrente.
        if(t.recurrence && t.recurrence.recType !== 'none'){
            if(!appState.recurringRules) appState.recurringRules = [];
            appState.recurringRules.push({
                id: (typeof generateUUID==='function' ? generateUUID() : 'rec_'+Date.now()),
                startDate: new Date().toISOString().split('T')[0],
                recType: t.recurrence.recType,
                selectedDays: t.recurrence.selectedDays || [],
                interval: t.recurrence.interval || null,
                endType: t.recurrence.endType || 'forever',
                endDate: t.recurrence.endType==='untilDate' ? t.recurrence.endDate : null,
                title: t.icone + ' Contrôle — ' + t.nom,
                desc: 'Campagne de suivi périodique : ' + t.nom,
                type: 'routine', priority: '2', timeStart:'', timeEnd:'',
                assignedTo: [], equipment: [],
                suiviModeleId: modeleId // lien vers le suivi, pour référence future
            });
            if(typeof saveData === 'function') saveData();
        }

        toast('Suivi "' + t.nom + '" créé', 'success');
        travail = null;
        SuivisView.ouvrirCampagne(campagneId);
    }

    return {
        ouvrirAssistant, fichierChoisi, creationManuelle, renderApercu,
        ouvrirLienURL, analyserLienURL,
        majMeta, majChamp, retirerChamp, ajouterChamp,
        majControle, retirerControle, ajouterControle, confirmerCreation,
        majRecurrence, majRecurrenceType, toggleRecurrenceJour
    };
})();

window.SuivisModelBuilder = SuivisModelBuilder;
