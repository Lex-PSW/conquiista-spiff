// Firestore persistence layer. UI code should not call Firestore directly.
const APP_STATE_REF = () => db.collection('appConfig').doc('main');

function serializeState(state) {
  return {
    members: state.members,
    scores: state.scores,
    historial: state.historial.map(h => ({...h, date: h.date instanceof Date ? h.date.toISOString() : h.date})),
    startDate: state.startDate instanceof Date ? state.startDate.toISOString() : state.startDate,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
}

async function dbLoadState() {
  const snap = await APP_STATE_REF().get();
  return snap.exists ? snap.data() : null;
}

async function dbSaveState(state) {
  await APP_STATE_REF().set(serializeState(state), { merge: true });
}

async function dbSeedState(state) {
  const snap = await APP_STATE_REF().get();
  if (!snap.exists) await APP_STATE_REF().set(serializeState(state));
}

async function dbLoadRequests() {
  let query = db.collection('requests');

  if (!currentUserProfile || currentUserProfile.role !== 'admin') {
    query = query.where('createdBy', '==', auth.currentUser.uid);
  }

  const snap = await query.orderBy('createdAt', 'desc').get();

  return snap.docs.map(d => {
    const x = d.data();

    return {
      id: d.id,
      ...x,
      date: x.createdAt?.toDate
        ? x.createdAt.toDate()
        : new Date(x.date || Date.now()),
      resolvedDate: x.resolvedAt?.toDate
        ? x.resolvedAt.toDate()
        : (x.resolvedDate ? new Date(x.resolvedDate) : null)
    };
  });
}

async function dbCreateRequest(sol) {
  const payload = {...sol};
  delete payload.id; delete payload.date; delete payload.resolvedDate;
  payload.createdBy = auth.currentUser.uid;
  payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  payload.resolvedAt = null;
  const ref = await db.collection('requests').add(payload);
  return ref.id;
}

async function dbUpdateRequest(id, changes) {
  const payload = {...changes};
  if (payload.resolvedDate) {
    delete payload.resolvedDate;
    payload.resolvedAt = firebase.firestore.FieldValue.serverTimestamp();
  }
  await db.collection('requests').doc(String(id)).update(payload);
}
