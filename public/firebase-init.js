import { initializeApp } 
from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";

import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, addDoc, query, orderBy, limit, getDocs, deleteDoc }
from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// Ajout additif — Firebase Storage, utilisé uniquement par le module Suivis
// (public/suivis/suivis-storage-sync.js) pour les photos très volumineuses.
// N'impacte en rien le pipeline Firestore existant ci-dessus.
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject }
from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCxBDSksRXzynYzCH0YEDslQ6IADRPt_24",
  authDomain: "gmao-adapei63.firebaseapp.com",
  projectId: "gmao-adapei63",
  storageBucket: "gmao-adapei63.firebasestorage.app",
  messagingSenderId: "371175941743",
  appId: "1:371175941743:web:54cbf297ce0783a8b98f9a"
};


const app = initializeApp(firebaseConfig);


// Connexion à la base de données
const db = getFirestore(app);
window._firebaseDb    = db;
window._fsDoc         = doc;
window._fsGetDoc      = getDoc;
window._fsSetDoc      = setDoc;
window._fsOnSnapshot  = onSnapshot;
window._fsCollection  = collection;
window._fsAddDoc      = addDoc;
window._fsQuery       = query;
window._fsOrderBy     = orderBy;
window._fsLimit       = limit;
window._fsGetDocs     = getDocs;
window._fsDeleteDoc   = deleteDoc;

// Storage — additif, réservé aux photos volumineuses du module Suivis
const storage = getStorage(app);
window._firebaseStorage   = storage;
window._storageRef        = storageRef;
window._storageUploadBytes= uploadBytes;
window._storageGetURL     = getDownloadURL;
window._storageDeleteObj  = deleteObject;

startRealtimeSync();

console.log("GMAO Firebase connecté ✅");
