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

    function hexVersRgb(hex){
        const h = String(hex||'#3b82f6').replace('#','');
        const full = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
        const n = parseInt(full, 16) || 0x3b82f6;
        return [(n>>16)&255, (n>>8)&255, n&255];
    }
    function teinteClaire(rgb, pct){
        return rgb.map(c => Math.round(c + (255-c)*pct));
    }

    // ── PDF — jsPDF + autotable (CDN, cf. INTEGRATION.md) ───────────
    // Reprend la mise en page "fidèle" (repère/emplacement/marque/année +
    // colonnes état/date par type de contrôle, bandeaux de section) avec
    // la couleur du modèle appliquée au titre, aux bordures, aux en-têtes
    // et aux bandeaux de section. Pagination "Page X/Y" réelle posée sur
    // chaque page une fois le nombre total de pages connu. Si la campagne
    // est clôturée, ajoute la cartouche contrôleur/qualification/date/
    // commentaires + signature en bas du document.
    function exporterPDF(campagneId){
        if(!window.jspdf || !window.jspdf.jsPDF){ alerter('jsPDF non chargé — export PDF indisponible'); return; }
        const campagne = SuivisEngine.getCampagne(campagneId);
        const modele = SuivisEngine.getModele(campagne.modeleId);
        const sections = SuivisEngine.listSectionsForCampagne(campagneId);
        const controlesDef = modele.controles || [];
        const rgb = hexVersRgb(modele.couleur);
        const rgbClair = teinteClaire(rgb, 0.82);
        const nbColsControles = controlesDef.length * 2;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({orientation: (4+nbColsControles) > 7 ? 'landscape' : 'portrait', unit:'pt'});
        const largeurPage = doc.internal.pageSize.getWidth();

        doc.setFontSize(15);
        doc.setTextColor(rgb[0], rgb[1], rgb[2]);
        doc.text((modele.icone ? modele.icone+' ' : '') + modele.nom + ' — ' + SuivisEngine.titreCampagne(campagneId), 40, 40);
        doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
        doc.setLineWidth(1.3);
        doc.line(40, 47, largeurPage-40, 47);
        doc.setTextColor(0,0,0);

        const head = [
            [
                {content:'Repère', rowSpan:2}, {content:'Emplacement', rowSpan:2},
                {content:'Marque/Modèle/Réf', rowSpan:2}, {content:'Année', rowSpan:2},
                ...controlesDef.map(c => ({content:c.label, colSpan:2, styles:{halign:'center'}}))
            ],
            [].concat(...controlesDef.map(() => [{content:'État'},{content:'Date'}]))
        ];

        const body = [];
        sections.forEach(section => {
            body.push([{content:section.nom, colSpan:4+nbColsControles,
                styles:{fillColor:rgbClair, textColor:[20,20,20], fontStyle:'bold'}}]);
            SuivisEngine.listItemsForSection(section.id).forEach(item => {
                const v = item.champs;
                const cellulesControles = controlesDef.flatMap(c => {
                    const val = item.controles[c.id] || {};
                    return [val.etat||'', val.date||''];
                });
                body.push([v.repere||'', v.emplacement||'', v.marqueModeleRef||'', v.anneeFab||'', ...cellulesControles]);
            });
        });

        doc.autoTable({
            head, body, startY: 58,
            styles:{fontSize:7, cellPadding:3, lineColor:rgb, lineWidth:0.6},
            headStyles:{fillColor:rgb, textColor:255},
            margin:{left:30, right:30, bottom:55}
        });

        // Cartouche contrôleur/qualification/date/commentaires/signature —
        // seulement si la campagne a été clôturée (cf. SuivisView.demanderCloture).
        if(campagne.statut === 'terminee'){
            const hautPage = doc.internal.pageSize.getHeight();
            let y = doc.lastAutoTable.finalY + 20;
            if(y > hautPage - 130){ doc.addPage(); y = 40; }
            doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
            doc.setLineWidth(1.2);
            doc.rect(30, y, largeurPage-60, 100);
            doc.setFontSize(9); doc.setTextColor(0,0,0);
            doc.text('Contrôleur : ' + (campagne.controleur||'—'), 40, y+18);
            doc.text('Qualification : ' + (campagne.qualification||'—'), 40, y+34);
            doc.text('Date : ' + (campagne.dateControle||'—'), 40, y+50);
            if(campagne.commentaireGeneral){
                doc.text(doc.splitTextToSize('Commentaires : ' + campagne.commentaireGeneral, largeurPage-220), 40, y+66);
            }
            if(campagne.signature){
                try{ doc.addImage(campagne.signature, 'PNG', largeurPage-150, y+10, 110, 60); }catch(e){}
            }
        }

        // Pagination réelle "Page X/Y" : posée en dernier, une fois le
        // nombre total de pages connu, sur chaque page du document.
        const totalPages = doc.internal.getNumberOfPages();
        for(let p = 1; p <= totalPages; p++){
            doc.setPage(p);
            const h = doc.internal.pageSize.getHeight();
            doc.setFontSize(8); doc.setTextColor(90);
            doc.text('Service Technique — ' + ((appState.settings&&appState.settings.siteName)||''), 30, h-25);
            doc.text('Page ' + p + '/' + totalPages, largeurPage-90, h-25);
        }

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
