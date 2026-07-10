// ═════════════════════════════════════════════════════════════════
// EXPORT DES CAMPAGNES — Excel / PDF / CSV / JSON — additif
// ═════════════════════════════════════════════════════════════════
// Générique : construit les colonnes à partir de modele.champsItem et
// modele.controles, jamais de colonnes fixes propres à BAES. Utilise
// les bibliothèques déjà chargées pour l'import (SheetJS) + une
// bibliothèque supplémentaire pour le PDF (jsPDF + autotable, CDN).
// ═════════════════════════════════════════════════════════════════

const SuivisExport = (function(){

    function nomFichier(campagneId, ext){
        const campagne = SuivisEngine.getCampagne(campagneId);
        const modele = SuivisEngine.getModele(campagne.modeleId);
        const base = (modele.nom + '_' + SuivisEngine.titreCampagne(campagneId))
            .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // enlève les accents
            .replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');
        return base + '.' + ext;
    }

    // Construit un tableau plat [ [en-têtes], [ligne1], [ligne2], ... ]
    // générique quel que soit le modèle (champsItem + controles définis
    // dynamiquement dans le JSON du modèle).
    function tableauPlat(campagneId){
        const campagne = SuivisEngine.getCampagne(campagneId);
        const modele = SuivisEngine.getModele(campagne.modeleId);
        const sections = SuivisEngine.listSectionsForCampagne(campagneId);
        const champsDef = modele.champsItem || [];
        const controlesDef = modele.controles || [];

        const entetes = ['Section']
            .concat(champsDef.map(c => c.label))
            .concat(controlesDef.flatMap(c => [c.label + ' — Date', c.label + ' — État', c.label + ' — Commentaire']));

        const lignes = [];
        sections.forEach(section => {
            SuivisEngine.listItemsForSection(section.id).forEach(item => {
                const ligne = [section.nom]
                    .concat(champsDef.map(c => item.champs[c.id] || ''))
                    .concat(controlesDef.flatMap(c => {
                        const v = item.controles[c.id] || {};
                        return [v.date||'', v.etat||'', v.commentaire||''];
                    }));
                lignes.push(ligne);
            });
        });
        return {entetes, lignes, modele, campagne};
    }

    // ── Excel (.xlsx) — SheetJS, déjà chargé pour l'import ──────────
    function exporterExcel(campagneId){
        if(!window.XLSX){ alerter('SheetJS non chargé — export Excel indisponible'); return; }
        const {entetes, lignes, modele, campagne} = tableauPlat(campagneId);
        const ws = XLSX.utils.aoa_to_sheet([entetes, ...lignes]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, (modele.nom||'Suivi').slice(0,30));
        XLSX.writeFile(wb, nomFichier(campagneId, 'xlsx'));
    }

    // ── CSV — natif, aucune bibliothèque ────────────────────────────
    function exporterCSV(campagneId){
        const {entetes, lignes} = tableauPlat(campagneId);
        const echapper = v => {
            const s = String(v==null?'':v);
            return /[";\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
        };
        const csv = [entetes, ...lignes].map(l => l.map(echapper).join(';')).join('\r\n');
        // BOM UTF-8 pour un affichage correct des accents dans Excel
        telechargerBlob(new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'}), nomFichier(campagneId, 'csv'));
    }

    // ── JSON — export complet et fidèle (structure interne du suivi) ──
    function exporterJSON(campagneId){
        const campagne = SuivisEngine.getCampagne(campagneId);
        const modele = SuivisEngine.getModele(campagne.modeleId);
        const sections = SuivisEngine.listSectionsForCampagne(campagneId).map(section => ({
            ...section,
            items: SuivisEngine.listItemsForSection(section.id)
        }));
        const donnees = {exporteLe: new Date().toISOString(), modele, campagne, sections};
        telechargerBlob(new Blob([JSON.stringify(donnees, null, 2)], {type:'application/json'}), nomFichier(campagneId, 'json'));
    }

    // ── PDF — jsPDF + autotable (CDN, cf. INTEGRATION.md) ───────────
    function exporterPDF(campagneId){
        if(!window.jspdf || !window.jspdf.jsPDF){ alerter('jsPDF non chargé — export PDF indisponible'); return; }
        const {entetes, lignes, modele, campagne} = tableauPlat(campagneId);
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({orientation: entetes.length > 8 ? 'landscape' : 'portrait', unit:'pt'});
        doc.setFontSize(14);
        doc.text(modele.nom + ' — ' + SuivisEngine.titreCampagne(campagneId), 40, 40);
        doc.autoTable({
            head: [entetes], body: lignes, startY: 55,
            styles:{fontSize:7, cellPadding:3}, headStyles:{fillColor:[3,105,161]},
            margin:{left:30, right:30}
        });
        doc.save(nomFichier(campagneId, 'pdf'));
    }

    function telechargerBlob(blob, nom){
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = nom;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    }

    function alerter(msg){
        if(typeof window.showAlarmToast === 'function') window.showAlarmToast(msg, 'error');
        else alert(msg);
    }

    return { exporterExcel, exporterCSV, exporterJSON, exporterPDF };
})();

window.SuivisExport = SuivisExport;
