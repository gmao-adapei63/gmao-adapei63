// ═════════════════════════════════════════════════════════════════
// STATISTIQUES DES SUIVIS — additif
// ═════════════════════════════════════════════════════════════════
// Calcule des indicateurs génériques à partir de n'importe quel modèle
// (aucune logique spécifique BAES). Réutilisé par le dashboard (tuiles)
// et par le mode d'impression "moderne".
// ═════════════════════════════════════════════════════════════════

const SuivisStats = (function(){

    // Indicateurs pour une campagne donnée.
    function statsCampagne(campagneId){
        const campagne = SuivisEngine.getCampagne(campagneId);
        if(!campagne) return null;
        const modele = SuivisEngine.getModele(campagne.modeleId);
        const items  = SuivisEngine.listItemsForCampagne(campagneId);
        const controlesDef = modele.controles || [];
        const etatsDef = modele.etats || [];

        let aRealiser = 0, faits = 0, retards = 0, anomalies = 0;
        const parEtat = {};
        etatsDef.forEach(e => parEtat[e.value] = 0);

        const aujourdHui = new Date();
        items.forEach(item => {
            controlesDef.forEach(ctrl => {
                aRealiser++;
                const val = item.controles[ctrl.id];
                if(val && val.date){
                    faits++;
                    if(val.etat && parEtat[val.etat] !== undefined) parEtat[val.etat]++;
                    const def = etatsDef.find(e => e.value === val.etat);
                    if(def && def.commentRequired) anomalies++;
                } else {
                    // Pas de date saisie du tout → considéré en retard si la campagne
                    // n'est pas "à venir" (heuristique simple, pas de date d'échéance
                    // dans le modèle V1 — affiné quand une périodicité sera ajoutée).
                }
            });
        });

        const pct = aRealiser ? Math.round(100*faits/aRealiser) : 0;

        return {
            campagneId, modeleNom: modele.nom,
            items: items.length,
            controlesARealiser: aRealiser,
            controlesRealises: faits,
            pourcentageConformite: pct,
            anomalies,
            parEtat
        };
    }

    // Indicateurs agrégés pour un modèle (toutes campagnes confondues) —
    // utilisés pour afficher un résumé sur la tuile d'accueil du modèle.
    function statsModele(modeleId){
        const campagnes = SuivisEngine.listCampagnesForModele(modeleId);
        const agrege = {items:0, controlesARealiser:0, controlesRealises:0, anomalies:0};
        campagnes.forEach(c => {
            const s = statsCampagne(c.id);
            if(!s) return;
            agrege.items += s.items;
            agrege.controlesARealiser += s.controlesARealiser;
            agrege.controlesRealises += s.controlesRealises;
            agrege.anomalies += s.anomalies;
        });
        agrege.pourcentageConformite = agrege.controlesARealiser
            ? Math.round(100*agrege.controlesRealises/agrege.controlesARealiser) : 0;
        return agrege;
    }

    // Vue synthétique globale (toutes suivis confondus) — pratique pour
    // une future tuile "Suivis" générique sur le dashboard principal.
    function statsGlobales(){
        const modeles = SuivisEngine.listModeles();
        const agrege = {suivis: modeles.length, items:0, anomalies:0, pourcentageConformite:0};
        let totalRealises = 0, totalARealiser = 0;
        modeles.forEach(m => {
            const s = statsModele(m.id);
            agrege.items += s.items;
            agrege.anomalies += s.anomalies;
            totalRealises += s.controlesRealises;
            totalARealiser += s.controlesARealiser;
        });
        agrege.pourcentageConformite = totalARealiser ? Math.round(100*totalRealises/totalARealiser) : 0;
        return agrege;
    }

    return { statsCampagne, statsModele, statsGlobales };
})();

window.SuivisStats = SuivisStats;
