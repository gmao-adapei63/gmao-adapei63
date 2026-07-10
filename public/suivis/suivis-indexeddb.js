// ═════════════════════════════════════════════════════════════════
// INDEXEDDB — pièces jointes volumineuses des suivis — additif
// ═════════════════════════════════════════════════════════════════
// Pourquoi : les photos en base64 gonflent le document Firestore
// unique de appState. Au-delà d'un certain volume (beaucoup de suivis,
// beaucoup de photos), cela peut approcher la limite de taille d'un
// document Firestore (~1 Mo) et ralentir chaque synchronisation.
//
// Principe : les gros contenus (photos, documents importés) sont
// stockés dans IndexedDB (illimité en pratique, 100% local et hors
// ligne) ; seule une RÉFÉRENCE légère ("idb:xxxxx") est stockée dans
// appState/Firestore à la place du contenu. La donnée reste disponible
// hors connexion (IndexedDB persiste sur l'appareil), et la synchro
// Firestore reste rapide car elle ne transporte plus le binaire.
//
// Ce fichier ne modifie ni ne remplace le cache localStorage existant
// (qui continue de gérer tout appState comme avant) : IndexedDB est un
// complément, utilisé uniquement par le module Suivis pour ses pièces
// jointes. Aucun risque de régression sur le pipeline de sync existant.
// ═════════════════════════════════════════════════════════════════

const SuivisIndexedDB = (function(){

    const DB_NAME = 'gmao_suivis_pieces_jointes';
    const STORE = 'pieces';
    const QUEUE_STORE = 'upload_queue';
    const DB_VERSION = 2;
    let __dbPromise = null;

    function ouvrirDB(){
        if(__dbPromise) return __dbPromise;
        __dbPromise = new Promise((resolve, reject) => {
            if(!window.indexedDB){ reject(new Error('IndexedDB non disponible sur cet appareil/navigateur')); return; }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, {keyPath:'id'});
                if(!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, {keyPath:'id'});
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return __dbPromise;
    }

    function uid(){
        return 'idb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,9);
    }

    // Stocke un contenu volumineux (dataURL, texte...) et renvoie une
    // référence légère "idb:xxxx" à stocker à la place dans appState.
    function stocker(contenu, meta){
        return ouvrirDB().then(db => new Promise((resolve, reject) => {
            const id = uid();
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put({id, contenu, meta: meta||{}, creeLe: new Date().toISOString()});
            tx.oncomplete = () => resolve('idb:' + id);
            tx.onerror = () => reject(tx.error);
        }));
    }

    // Récupère le contenu réel à partir d'une référence "idb:xxxx".
    // Si la valeur passée n'est pas une référence IndexedDB (ex. encore
    // une dataURL brute d'avant l'activation de ce module), elle est
    // renvoyée telle quelle — compatibilité ascendante totale.
    function recuperer(reference){
        if(!reference || typeof reference !== 'string' || reference.indexOf('idb:') !== 0){
            return Promise.resolve(reference);
        }
        const id = reference.slice(4);
        return ouvrirDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(id);
            req.onsuccess = () => resolve(req.result ? req.result.contenu : null);
            req.onerror = () => reject(req.error);
        }));
    }

    function supprimer(reference){
        if(!reference || reference.indexOf('idb:') !== 0) return Promise.resolve();
        const id = reference.slice(4);
        return ouvrirDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        }));
    }

    // Seuil au-delà duquel une pièce jointe passe automatiquement par
    // IndexedDB plutôt que d'être stockée en clair dans appState (~150 Ko
    // de dataURL, marge confortable sous la limite Firestore par document).
    const SEUIL_OCTETS = 150 * 1024;

    // À utiliser à la place d'une affectation directe "champ = dataUrl" :
    // stocke dans IndexedDB si le contenu est volumineux, sinon garde le
    // comportement actuel (valeur en clair) pour ne rien changer en dessous
    // du seuil.
    function stockerSiVolumineux(dataUrl){
        if(!dataUrl || dataUrl.length < SEUIL_OCTETS) return Promise.resolve(dataUrl);
        return stocker(dataUrl, {type:'photo_ou_signature'});
    }

    // ── File d'attente d'upload vers Firebase Storage ──────────────
    // Utilisée par suivis-storage-sync.js : quand une photo est trop
    // volumineuse pour tenir raisonnablement dans appState/Firestore,
    // ou quand l'appareil est hors ligne, elle est mise en attente ici
    // et uploadée dès que possible (retour réseau), sans jamais bloquer
    // la saisie ni perdre la photo.
    function enfilerUpload(entree){
        return ouvrirDB().then(db => new Promise((resolve, reject) => {
            const id = entree.id || uid();
            const tx = db.transaction(QUEUE_STORE, 'readwrite');
            tx.objectStore(QUEUE_STORE).put(Object.assign({id, creeLe: new Date().toISOString()}, entree, {id}));
            tx.oncomplete = () => resolve(id);
            tx.onerror = () => reject(tx.error);
        }));
    }

    function listerQueue(){
        return ouvrirDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(QUEUE_STORE, 'readonly');
            const req = tx.objectStore(QUEUE_STORE).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        }));
    }

    function retirerDeQueue(id){
        return ouvrirDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(QUEUE_STORE, 'readwrite');
            tx.objectStore(QUEUE_STORE).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        }));
    }

    return { stocker, recuperer, supprimer, stockerSiVolumineux, SEUIL_OCTETS,
        enfilerUpload, listerQueue, retirerDeQueue };
})();

window.SuivisIndexedDB = SuivisIndexedDB;
