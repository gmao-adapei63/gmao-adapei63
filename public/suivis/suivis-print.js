// ═════════════════════════════════════════════════════════════════
// IMPRESSION DES SUIVIS — modes fidèle et moderne — additif
// ═════════════════════════════════════════════════════════════════
// Utilise l'élément #suivis-print-area (ajouté dans index.html, cf.
// INTEGRATION.md) + la classe CSS d'impression déjà présente dans
// style.css (media print du reste de l'app, réutilisée telle quelle).
// ═════════════════════════════════════════════════════════════════

const SuivisPrint = (function(){

    function esc(str){
        return String(str==null?'':str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    // ── Mode fidèle : reproduit la mise en page du document d'origine ──
    function imprimerFidele(campagneId){
        const campagne = SuivisEngine.getCampagne(campagneId);
        const modele = SuivisEngine.getModele(campagne.modeleId);
        const sections = SuivisEngine.listSectionsForCampagne(campagneId);
        const controlesDef = modele.controles || [];

        let enTeteControles = controlesDef.map(c => `<th colspan="2">${esc(c.label)}</th>`).join('');
        let sousEnTete = controlesDef.map(() => '<th>État</th><th>Date</th>').join('');

        let rows = '';
        sections.forEach(section => {
            rows += `<tr><td colspan="${4+controlesDef.length*2}" class="suivis-print-section">${esc(section.nom)}</td></tr>`;
            SuivisEngine.listItemsForSection(section.id).forEach(item => {
                const v = item.champs;
                let cellulesControles = controlesDef.map(c => {
                    const val = item.controles[c.id] || {};
                    return `<td>${esc(val.etat||'')}</td><td>${esc(val.date||'')}</td>`;
                }).join('');
                rows += `<tr>
                    <td>${esc(v.repere||'')}</td><td>${esc(v.emplacement||'')}</td>
                    <td>${esc(v.marqueModeleRef||'')}</td><td>${esc(v.anneeFab||'')}</td>
                    ${cellulesControles}
                </tr>`;
            });
        });

        const html = `<h2>${esc(modele.nom)} — ${esc(SuivisEngine.titreCampagne(campagneId))}</h2>
            <table class="suivis-print-table"><thead>
                <tr><th rowspan="2">Repère</th><th rowspan="2">Emplacement</th><th rowspan="2">Marque/Modèle/Réf</th><th rowspan="2">Année</th>${enTeteControles}</tr>
                <tr>${sousEnTete}</tr>
            </thead><tbody>${rows}</tbody></table>
            <p class="suivis-print-footer">Service Technique — ${esc((appState.settings&&appState.settings.siteName)||'')} — Édité le ${new Date().toLocaleDateString('fr-FR')}</p>`;
        safeHTML('suivis-print-area', html);
        window.print();
    }

    // ── Mode moderne : synthèse + statistiques + anomalies en avant ──
    function imprimerModerne(campagneId){
        const campagne = SuivisEngine.getCampagne(campagneId);
        const modele = SuivisEngine.getModele(campagne.modeleId);
        const stats = SuivisStats.statsCampagne(campagneId);
        const sections = SuivisEngine.listSectionsForCampagne(campagneId);
        const controlesDef = modele.controles || [];
        const etatsDef = modele.etats || [];

        const cartesEtat = etatsDef.map(e =>
            `<div class="suivis-print-carte" style="border-left:4px solid ${e.color}">
                <div class="suivis-print-carte-val">${stats.parEtat[e.value]||0}</div>
                <div class="suivis-print-carte-label">${esc(e.label)}</div>
            </div>`).join('');

        // Liste des anomalies (états dont commentRequired=true), mises en avant
        let anomaliesHtml = '';
        sections.forEach(section => {
            SuivisEngine.listItemsForSection(section.id).forEach(item => {
                Object.entries(item.controles||{}).forEach(([ctrlId, val]) => {
                    const def = etatsDef.find(e => e.value === val.etat);
                    if(def && def.commentRequired){
                        const ctrl = controlesDef.find(c => c.id === ctrlId);
                        anomaliesHtml += `<tr>
                            <td>${esc(section.nom)}</td>
                            <td>${esc(item.champs.repere||'')} — ${esc(item.champs.emplacement||'')}</td>
                            <td>${esc(ctrl?ctrl.label:ctrlId)}</td>
                            <td>${esc(val.date||'')}</td>
                            <td>${esc(val.commentaire||'')}</td>
                        </tr>`;
                    }
                });
            });
        });
        if(!anomaliesHtml) anomaliesHtml = '<tr><td colspan="5">Aucune anomalie recensée.</td></tr>';

        const html = `<h2>${esc(modele.nom)} — ${esc(SuivisEngine.titreCampagne(campagneId))}</h2>
            <div class="suivis-print-stats-grid">
                <div class="suivis-print-carte"><div class="suivis-print-carte-val">${stats.pourcentageConformite}%</div><div class="suivis-print-carte-label">Conformité</div></div>
                <div class="suivis-print-carte"><div class="suivis-print-carte-val">${stats.items}</div><div class="suivis-print-carte-label">Points de contrôle</div></div>
                <div class="suivis-print-carte"><div class="suivis-print-carte-val">${stats.controlesRealises}/${stats.controlesARealiser}</div><div class="suivis-print-carte-label">Contrôles réalisés</div></div>
                ${cartesEtat}
            </div>
            <h3>Anomalies</h3>
            <table class="suivis-print-table">
                <thead><tr><th>Section</th><th>Point</th><th>Contrôle</th><th>Date</th><th>Commentaire</th></tr></thead>
                <tbody>${anomaliesHtml}</tbody>
            </table>
            <p class="suivis-print-footer">Édité le ${new Date().toLocaleDateString('fr-FR')}</p>`;
        safeHTML('suivis-print-area', html);
        window.print();
    }

    return { imprimerFidele, imprimerModerne };
})();

window.SuivisPrint = SuivisPrint;
