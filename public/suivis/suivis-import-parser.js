// ═════════════════════════════════════════════════════════════════
// ANALYSEUR DE DOCUMENTS — assistant "Nouveau suivi" (V2)
// ═════════════════════════════════════════════════════════════════
// Additif. Ne modifie rien à l'existant. Dépend de 3 bibliothèques
// externes chargées en CDN (voir INTEGRATION.md) :
//   - SheetJS (window.XLSX)     → Excel (.xlsx/.xls) et CSV
//   - pdf.js  (window.pdfjsLib) → PDF
//   - mammoth (window.mammoth)  → Word (.docx)
// HTML et JSON sont analysés avec les API natives du navigateur
// (DOMParser / JSON.parse), aucune bibliothèque requise.
//
// Principe : jamais de détection automatique "silencieuse". Chaque
// analyseur renvoie une PROPOSITION (sections, champs, contrôles,
// avertissements) qui doit être validée/corrigée par l'utilisateur
// dans l'assistant (suivis-model-builder.js) avant création réelle
// du modèle. Rien n'est spécifique à BAES : la détection est fondée
// sur des motifs génériques (en-têtes, regroupements, colonnes "DATE").
// ═════════════════════════════════════════════════════════════════

const SuivisImportParser = (function(){

    const EXT_HANDLERS = {
        xlsx: analyserXLSX, xls: analyserXLSX, csv: analyserCSV,
        pdf: analyserPDF,
        docx: analyserDOCX,
        html: analyserHTML, htm: analyserHTML,
        json: analyserJSON,
        png: analyserImage, jpg: analyserImage, jpeg: analyserImage, webp: analyserImage
    };

    function extensionDe(fileName){
        const m = /\.([a-z0-9]+)$/i.exec(fileName||'');
        return m ? m[1].toLowerCase() : '';
    }

    // Point d'entrée unique de l'assistant.
    function analyserFichier(file){
        const ext = extensionDe(file.name);
        const handler = EXT_HANDLERS[ext];
        if(!handler){
            return Promise.resolve(propositionVide(
                'inconnu', ['Format ".' + ext + '" non pris en charge automatiquement — utilisez la création manuelle.']
            ));
        }
        return handler(file).catch(err => propositionVide(ext, ['Erreur d\'analyse : ' + (err.message||err)]));
    }

    function propositionVide(typeSource, avertissements){
        return {
            typeSource, titreDetecte: '', sections: [],
            champsDetectes: [], controlesDetectes: [],
            avertissements: avertissements || []
        };
    }

    // ─────────────────────────────────────────────────────────────
    // ANALYSEUR GÉNÉRIQUE DE GRILLE (tableau de lignes/colonnes)
    // Partagé par XLSX, DOCX, HTML, PDF (chacun produit une "grille"
    // brute, puis ce cœur commun en déduit sections/champs/contrôles).
    // rows: tableau de tableaux de cellules (string|null)
    // sectionRows (optionnel) : Set des index de lignes connues comme
    // titres de section (ex. cellules fusionnées en Excel) — si absent,
    // détecté par heuristique (une seule cellule non vide sur la ligne).
    // ─────────────────────────────────────────────────────────────
    function analyserGrille(rows, sectionRowIdx){
        const avertissements = [];
        // Ligne d'en-tête = première ligne avec ≥ 2 cellules non vides
        // ET contenant un marqueur "DATE" ou plusieurs libellés texte.
        let headerIdx = rows.findIndex(r => nonVides(r).length >= 2);
        if(headerIdx === -1){
            return propositionAvecAvertissement('grille', 'Impossible de détecter une ligne d\'en-tête.');
        }
        const header = rows[headerIdx].map(c => (c==null?'':String(c).trim()));

        // Détecte les colonnes "DATE" → chacune définit un contrôle,
        // dont le libellé est pris dans la colonne précédente si elle
        // ressemble à un intitulé de contrôle (ex. "CONTROLE VISUEL").
        const controlesDetectes = [];
        header.forEach((label, colIdx) => {
            if(/date/i.test(label)){
                const precedent = header.slice(0, colIdx).reverse().find(l => l && !/date/i.test(l));
                controlesDetectes.push({
                    id: 'controle_' + controlesDetectes.length,
                    label: precedent || ('Contrôle ' + (controlesDetectes.length+1)),
                    colIdx,
                    champs: ['date','etat','commentaire']
                });
            }
        });
        if(controlesDetectes.length === 0){
            avertissements.push('Aucune colonne "date" détectée : les contrôles devront être définis manuellement.');
        }

        // Colonnes restantes (hors dates et hors colonnes fusionnées avec un contrôle)
        // deviennent des champs d'item (repère, emplacement, marque...).
        const colonnesControle = new Set(controlesDetectes.map(c => c.colIdx));
        const champsDetectes = [];
        header.forEach((label, colIdx) => {
            if(colonnesControle.has(colIdx)) return;
            if(!label) return;
            champsDetectes.push({id: 'champ_' + colIdx, label, colIdx, type:'texte'});
        });
        if(champsDetectes.length === 0){
            avertissements.push('Aucun champ d\'item détecté sur la ligne d\'en-tête — vérifiez le fichier source.');
        }

        // Sections : soit fournies (mérites Excel), soit détectées par heuristique
        // (une ligne de données ne comportant qu'une seule cellule non vide).
        const sections = [];
        let sectionCourante = null;
        for(let i = headerIdx+1; i < rows.length; i++){
            const row = rows[i];
            const valeurs = nonVides(row);
            if(valeurs.length === 0) continue;
            const estSection = sectionRowIdx ? sectionRowIdx.has(i) : (valeurs.length === 1);
            if(estSection){
                sectionCourante = {nom: String(valeurs[0]).trim(), items: []};
                sections.push(sectionCourante);
                continue;
            }
            if(!sectionCourante){
                sectionCourante = {nom: 'Général', items: []};
                sections.push(sectionCourante);
            }
            const champs = {};
            champsDetectes.forEach(cd => { champs[cd.id] = row[cd.colIdx] != null ? String(row[cd.colIdx]).trim() : ''; });
            sectionCourante.items.push({champs});
        }

        return {
            typeSource: 'grille', titreDetecte: '',
            sections, champsDetectes: champsDetectes.map(({id,label,type})=>({id,label,type})),
            controlesDetectes: controlesDetectes.map(({id,label,champs})=>({id,label,champs})),
            avertissements
        };
    }

    function nonVides(row){ return (row||[]).filter(c => c != null && String(c).trim() !== ''); }

    function propositionAvecAvertissement(typeSource, msg){
        const p = propositionVide(typeSource, [msg]);
        return p;
    }

    // ─────────────────────────────────────────────────────────────
    // EXCEL / CSV — SheetJS
    // ─────────────────────────────────────────────────────────────
    function analyserXLSX(file){
        if(typeof window.XLSX === 'undefined') return Promise.reject(new Error('Bibliothèque SheetJS non chargée'));
        return file.arrayBuffer().then(buf => {
            const wb = window.XLSX.read(buf, {type:'array'});
            let toutesLesSections = [];
            let champsRef = null, controlesRef = null;
            const avertissements = [];
            wb.SheetNames.forEach(nomFeuille => {
                const ws = wb.Sheets[nomFeuille];
                const rows = window.XLSX.utils.sheet_to_json(ws, {header:1, raw:false, defval:null});
                // Détection des vraies cellules fusionnées mono-ligne = titres de section
                const sectionRowIdx = new Set();
                (ws['!merges']||[]).forEach(m => {
                    if(m.s.r === m.e.r) sectionRowIdx.add(m.s.r); // fusion horizontale sur une seule ligne
                });
                const res = analyserGrille(rows, sectionRowIdx.size ? sectionRowIdx : null);
                toutesLesSections = toutesLesSections.concat(res.sections);
                if(!champsRef) champsRef = res.champsDetectes;
                if(!controlesRef) controlesRef = res.controlesDetectes;
                avertissements.push(...res.avertissements);
            });
            return {
                typeSource: 'xlsx', titreDetecte: file.name.replace(/\.[^.]+$/,''),
                sections: toutesLesSections, champsDetectes: champsRef||[], controlesDetectes: controlesRef||[],
                avertissements: [...new Set(avertissements)]
            };
        });
    }

    function analyserCSV(file){
        return file.text().then(text => {
            const rows = text.split(/\r?\n/).filter(l=>l.length).map(l => l.split(/[;,]/).map(c=>c.trim()));
            const res = analyserGrille(rows, null);
            res.typeSource = 'csv';
            res.titreDetecte = file.name.replace(/\.[^.]+$/,'');
            return res;
        });
    }

    // ─────────────────────────────────────────────────────────────
    // WORD (.docx) — mammoth → HTML → table → grille
    // ─────────────────────────────────────────────────────────────
    function analyserDOCX(file){
        if(typeof window.mammoth === 'undefined') return Promise.reject(new Error('Bibliothèque mammoth non chargée'));
        return file.arrayBuffer().then(buf => window.mammoth.convertToHtml({arrayBuffer: buf}))
            .then(result => grilleDepuisHTML(result.value, file.name, 'docx'));
    }

    // ─────────────────────────────────────────────────────────────
    // HTML — DOMParser natif, cherche le 1er <table>
    // ─────────────────────────────────────────────────────────────
    function analyserHTML(file){
        return file.text().then(html => grilleDepuisHTML(html, file.name, 'html'));
    }

    function grilleDepuisHTML(html, fileName, typeSource){
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const table = doc.querySelector('table');
        if(!table){
            return propositionAvecAvertissement(typeSource, 'Aucun tableau trouvé dans le document — création manuelle recommandée.');
        }
        const rows = Array.from(table.querySelectorAll('tr')).map(tr =>
            Array.from(tr.querySelectorAll('td,th')).map(td => td.textContent.trim())
        );
        // Une ligne dont une seule <td> couvre plusieurs colonnes (colspan) = titre de section probable
        const sectionRowIdx = new Set();
        Array.from(table.querySelectorAll('tr')).forEach((tr, idx) => {
            const cells = Array.from(tr.querySelectorAll('td,th'));
            if(cells.length === 1 && cells[0].colSpan > 1) sectionRowIdx.add(idx);
        });
        const res = analyserGrille(rows, sectionRowIdx.size ? sectionRowIdx : null);
        res.typeSource = typeSource;
        res.titreDetecte = fileName.replace(/\.[^.]+$/,'');
        return res;
    }

    // ─────────────────────────────────────────────────────────────
    // JSON — soit un export natif de ce moteur (reprise directe),
    // soit un tableau générique d'objets (champs = clés du 1er objet)
    // ─────────────────────────────────────────────────────────────
    function analyserJSON(file){
        return file.text().then(text => {
            const data = JSON.parse(text);
            // Cas 1 : export natif du moteur de suivis (ré-import après export)
            if(data && data.champsItem && data.controles){
                return {
                    typeSource: 'json_modele', titreDetecte: data.nom || file.name.replace(/\.[^.]+$/,''),
                    sections: data.sections || [], champsDetectes: data.champsItem, controlesDetectes: data.controles,
                    avertissements: ['Export natif détecté : le modèle peut être recréé à l\'identique.'],
                    modeleComplet: data
                };
            }
            // Cas 2 : tableau générique d'objets plats
            const tableau = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : null);
            if(!tableau || tableau.length === 0){
                return propositionAvecAvertissement('json', 'JSON non reconnu : ni export du moteur, ni tableau d\'objets.');
            }
            const cles = Object.keys(tableau[0]);
            const champsDetectes = cles.map(k => ({id:k, label:k, type:'texte'}));
            const items = tableau.map(obj => ({champs: Object.assign({}, obj)}));
            return {
                typeSource: 'json', titreDetecte: file.name.replace(/\.[^.]+$/,''),
                sections: [{nom:'Général', items}], champsDetectes,
                controlesDetectes: [{id:'controle', label:'Contrôle', champs:['date','etat','commentaire']}],
                avertissements: ['Structure déduite des clés du premier objet — à vérifier.']
            };
        });
    }

    // ─────────────────────────────────────────────────────────────
    // PDF — pdf.js, extraction de texte + regroupement heuristique
    // en lignes/colonnes par coordonnées. Détection nécessairement
    // plus faible qu'Excel/HTML : toujours signalée comme à vérifier.
    // ─────────────────────────────────────────────────────────────
    function analyserPDF(file){
        if(typeof window.pdfjsLib === 'undefined') return Promise.reject(new Error('Bibliothèque pdf.js non chargée'));
        return file.arrayBuffer().then(buf => window.pdfjsLib.getDocument({data: buf}).promise)
            .then(async pdf => {
                const rows = [];
                for(let p = 1; p <= pdf.numPages; p++){
                    const page = await pdf.getPage(p);
                    const content = await page.getTextContent();
                    rows.push(...regrouperEnLignes(content.items));
                }
                const res = analyserGrille(rows, null);
                res.typeSource = 'pdf';
                res.titreDetecte = file.name.replace(/\.[^.]+$/,'');
                res.avertissements.unshift('Extraction PDF heuristique (positions du texte) : vérifiez attentivement chaque champ avant de valider.');
                return res;
            });
    }

    // Regroupe les items texte de pdf.js (chacun avec x,y) en lignes
    // (même y à ±3px) puis en "colonnes" séparées par un grand écart en x.
    function regrouperEnLignes(items){
        const parLigne = new Map();
        items.forEach(it => {
            const y = Math.round(it.transform[5] / 3) * 3; // tolérance verticale
            if(!parLigne.has(y)) parLigne.set(y, []);
            parLigne.get(y).push({x: it.transform[4], texte: it.str});
        });
        const lignesTri = Array.from(parLigne.entries()).sort((a,b) => b[0]-a[0]); // haut → bas
        return lignesTri.map(([, mots]) => {
            mots.sort((a,b) => a.x - b.x);
            const colonnes = [];
            let colonneCourante = '';
            let dernierX = null;
            mots.forEach(m => {
                if(dernierX !== null && (m.x - dernierX) > 25){ // écart = nouvelle colonne
                    colonnes.push(colonneCourante.trim());
                    colonneCourante = '';
                }
                colonneCourante += (colonneCourante ? ' ' : '') + m.texte;
                dernierX = m.x + (m.texte.length * 4);
            });
            if(colonneCourante) colonnes.push(colonneCourante.trim());
            return colonnes;
        }).filter(l => l.length);
    }

    // ─────────────────────────────────────────────────────────────
    // IMAGE — pas d'analyse automatique fiable côté navigateur
    // ─────────────────────────────────────────────────────────────
    function analyserImage(file){
        return Promise.resolve(propositionAvecAvertissement('image',
            'Les images ne peuvent pas être analysées automatiquement — utilisez la création manuelle du modèle, puis joignez l\'image comme document de référence.'));
    }

    return { analyserFichier, analyserGrille };
})();

window.SuivisImportParser = SuivisImportParser;
