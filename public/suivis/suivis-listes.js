// ═════════════════════════════════════════════════════════════════
// LISTES INTELLIGENTES — additif
// ═════════════════════════════════════════════════════════════════
// Génère des <datalist> HTML natives alimentées par les valeurs déjà
// saisies dans l'app (aucune liste figée à maintenir à la main).
// Une "listeId" peut être partagée entre plusieurs modèles/champs :
// ex. tous les champs "Contrôleur" de tous les suivis alimentent la
// même liste "controleurs", même si les modèles n'ont rien en commun.
// ═════════════════════════════════════════════════════════════════

const SuivisListes = (function(){

    // Renvoie les valeurs distinctes déjà saisies pour une listeId donnée,
    // en parcourant à la fois les champs d'item (modele.champsItem) et les
    // champs de contrôle (ex. "controleur") de TOUS les modèles.
    function valeursPour(listeId){
        const s = appState.suivis;
        if(!s) return [];
        const valeurs = new Set();

        (s.modeles||[]).forEach(modele => {
            const champsItemAvecListe = (modele.champsItem||[]).filter(c => c.listeId === listeId).map(c=>c.id);
            const champsControleAvecListe = [];
            (modele.controles||[]).forEach(ctrl => {
                if((ctrl.listesChamps||{})[listeId]) champsControleAvecListe.push({ctrlId: ctrl.id, champ: ctrl.listesChamps[listeId]});
            });
            if(champsItemAvecListe.length === 0 && champsControleAvecListe.length === 0) return;

            (s.items||[]).filter(it => it.modeleId === modele.id).forEach(item => {
                champsItemAvecListe.forEach(champId => {
                    const v = item.champs && item.champs[champId];
                    if(v && String(v).trim()) valeurs.add(String(v).trim());
                });
                champsControleAvecListe.forEach(({ctrlId, champ}) => {
                    const c = item.controles && item.controles[ctrlId];
                    const v = c && c[champ];
                    if(v && String(v).trim()) valeurs.add(String(v).trim());
                });
            });
        });
        return Array.from(valeurs).sort((a,b)=>a.localeCompare(b,'fr'));
    }

    // Génère la balise <datalist> correspondante (id = "suivis-liste-{listeId}")
    function datalistHTML(listeId){
        const options = valeursPour(listeId).map(v => `<option value="${escAttr(v)}">`).join('');
        return `<datalist id="suivis-liste-${escAttr(listeId)}">${options}</datalist>`;
    }

    function escAttr(str){
        return String(str==null?'':str).replace(/"/g,'&quot;');
    }

    // Rafraîchit toutes les datalists déjà présentes dans le DOM (après
    // un enregistrement de contrôle par exemple) sans tout re-render.
    function rafraichirDOM(){
        document.querySelectorAll('datalist[id^="suivis-liste-"]').forEach(dl => {
            const listeId = dl.id.replace('suivis-liste-', '');
            dl.innerHTML = valeursPour(listeId).map(v => `<option value="${escAttr(v)}">`).join('');
        });
    }

    return { valeursPour, datalistHTML, rafraichirDOM };
})();

window.SuivisListes = SuivisListes;
