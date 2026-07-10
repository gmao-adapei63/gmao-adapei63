// ═════════════════════════════════════════════════════════════════
// SYNCHRONISATION FIREBASE STORAGE — photos volumineuses (additif)
// ═════════════════════════════════════════════════════════════════
// Pourquoi : une photo compressée pour appState (~150-300 Ko en base64)
// suffit pour un aperçu, mais on veut pouvoir conserver une version
// pleine résolution pour l'original/le zoom/l'impression, sans gonfler
// le document Firestore unique. Cette version pleine résolution est
// envoyée vers Firebase Storage (bucket déjà configuré dans
// firebase-init.js) ; seule son URL est stockée dans appState.
//
// Fonctionnement :
//  - Le fichier original (non recompressé à outrance) est mis en file
//    d'attente locale (IndexedDB, voir suivis-indexeddb.js) dès la prise
//    de photo — jamais bloquant, jamais perdu si hors connexion.
//  - Dès que la connexion est disponible (window.navigator.onLine ET
//    Firebase Storage initialisé), la file est vidée en arrière-plan :
//    upload → récupération de l'URL → mise à jour de l'item via
//    SuivisEngine.setControle(...,{photoUrl}) → synchro Firestore normale.
//  - Réessaie automatiquement à chaque retour de connexion
//    (écoute l'évènement 'online', déjà standard, sans dépendre du
//    mécanisme de reconnexion interne de l'app existante).
//
// Ce fichier n'écrit jamais directement dans appState.suivis : il passe
// systématiquement par SuivisEngine.setControle(), donc bénéficie déjà
// de l'historique, du cache local et de la synchro Firestore existants.
// ═════════════════════════════════════════════════════════════════

const SuivisStorageSync = (function(){

    let __enCours = false;

    function storageDisponible(){
        return !!(window._firebaseStorage && window._storageRef && window._storageUploadBytes && window._storageGetURL);
    }

    // Appelé depuis SuivisView.capturerPhoto() en plus (pas à la place) du
    // stockage habituel compressé dans appState. `file` est le fichier
    // original choisi/pris par l'utilisateur (avant compression agressive).
    function programmerUploadPhoto(itemId, controleId, file){
        if(!window.SuivisIndexedDB){
            console.warn('[SuivisStorageSync] IndexedDB indisponible, upload Storage ignoré (la photo compressée reste sauvegardée normalement).');
            return Promise.resolve();
        }
        return file.arrayBuffer().then(buffer => {
            return window.SuivisIndexedDB.enfilerUpload({
                itemId, controleId,
                nomFichier: file.name,
                typeMime: file.type || 'image/jpeg',
                blobData: buffer
            });
        }).then(() => {
            traiterFileDattente(); // tentative immédiate si déjà en ligne
        }).catch(err => console.warn('[SuivisStorageSync] mise en file échouée :', err));
    }

    function traiterFileDattente(){
        if(__enCours) return;
        if(!navigator.onLine) return;
        if(!storageDisponible()) return;
        __enCours = true;
        window.SuivisIndexedDB.listerQueue().then(entrees => {
            if(!entrees.length){ __enCours = false; return; }
            return entrees.reduce((chaine, entree) => chaine.then(() => uploaderEntree(entree)), Promise.resolve());
        }).catch(err => {
            console.warn('[SuivisStorageSync] erreur de traitement de la file :', err);
        }).finally(() => { __enCours = false; });
    }

    function uploaderEntree(entree){
        const chemin = 'suivis/' + entree.itemId + '/' + entree.controleId + '_' + Date.now() + '_' + (entree.nomFichier||'photo.jpg');
        const blob = new Blob([entree.blobData], {type: entree.typeMime || 'image/jpeg'});
        const fileRef = window._storageRef(window._firebaseStorage, chemin);
        return window._storageUploadBytes(fileRef, blob)
            .then(() => window._storageGetURL(fileRef))
            .then(url => {
                const res = window.SuivisEngine.setControle(entree.itemId, entree.controleId, {
                    // on ne touche pas date/etat/commentaire déjà saisis : on les relit
                    // pour ne pas les écraser avec des valeurs vides
                    ...(function(){
                        const item = window.SuivisEngine.getItem(entree.itemId);
                        const c = item && item.controles[entree.controleId];
                        return c ? {date:c.date, etat:c.etat, commentaire:c.commentaire} : {};
                    })(),
                    photoUrl: url
                });
                if(res && res.ok !== false){
                    return window.SuivisIndexedDB.retirerDeQueue(entree.id);
                }
            })
            .catch(err => {
                console.warn('[SuivisStorageSync] échec upload, nouvelle tentative au prochain retour réseau :', err);
                // on laisse l'entrée en file : retentée automatiquement plus tard
            });
    }

    // Réessaie à chaque retour de connexion, et une fois au chargement
    // (au cas où des photos seraient restées en attente d'une session
    // précédente hors ligne).
    window.addEventListener('online', traiterFileDattente);
    if(document.readyState === 'complete') setTimeout(traiterFileDattente, 3000);
    else window.addEventListener('load', () => setTimeout(traiterFileDattente, 3000));

    return { programmerUploadPhoto, traiterFileDattente, storageDisponible };
})();

window.SuivisStorageSync = SuivisStorageSync;
