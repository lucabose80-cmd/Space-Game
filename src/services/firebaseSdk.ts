// Bündelt die Firebase-SDK-Funktionen an EINER Stelle. Wird von firebaseService.ts per `import()`
// nachgeladen (eigener Chunk „firebase“), damit der Spielstart nicht auf ~570 kB SDK wartet.
// Hier nichts anderes importieren/exportieren — Spiel-Logik gehört in firebaseService.ts.
export { initializeApp } from 'firebase/app';
export {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from 'firebase/auth';
export { addDoc, collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, setDoc } from 'firebase/firestore';
