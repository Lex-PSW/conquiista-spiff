// Authentication and role resolution.
let currentFirebaseUser = null;
let currentUserProfile = null;

async function firebaseSignIn(email, password) {
  const cred = await auth.signInWithEmailAndPassword(email, password);
  const profileSnap = await db.collection('users').doc(cred.user.uid).get();
  if (!profileSnap.exists) {
    await auth.signOut();
    throw new Error('Tu usuario no tiene un perfil/rol configurado en Firestore.');
  }
  currentFirebaseUser = cred.user;
  currentUserProfile = { uid: cred.user.uid, ...profileSnap.data() };
  return currentUserProfile;
}

async function firebaseSignOut() {
  await auth.signOut();
  currentFirebaseUser = null;
  currentUserProfile = null;
}

function firebaseCurrentProfile() { return currentUserProfile; }
