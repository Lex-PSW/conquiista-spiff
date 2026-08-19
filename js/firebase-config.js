// Firebase configuration for CONQUIISTA SPIFF.
// 1) Firebase Console > Project settings > Your apps > Web app.
// 2) Replace ONLY the values below with the firebaseConfig shown by Firebase.
const firebaseConfig = {
  apiKey: "AIzaSyBPADNuvW9-_5HBdy1UzYlb5xIliy3D6bs",
  authDomain: "conquiista-spiff.firebaseapp.com",
  projectId: "conquiista-spiff",
  storageBucket: "conquiista-spiff.firebasestorage.app",
  messagingSenderId: "506934822353",
  appId: "1:506934822353:web:804e49221f471118a1ccf0",
  measurementId: "G-D9XYETMZV5"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();