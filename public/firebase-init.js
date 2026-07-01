import { initializeApp } 
from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";

import { getFirestore, doc, getDoc, setDoc, onSnapshot }
from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

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

startRealtimeSync();

console.log("GMAO Firebase connecté ✅");
