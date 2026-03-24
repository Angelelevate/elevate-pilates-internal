/**
 * Resolve the app user profile when the Firestore document id may not match Firebase Auth uid
 * (e.g. legacy/manual docs). Prefer users/{uid}, then first users row with the same email.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} uid
 * @param {string | null | undefined} email
 * @returns {Promise<{ data: FirebaseFirestore.DocumentData | null; via: 'uid' | 'email' | null }>}
 */
export async function resolveUserProfile(db, uid, email) {
  const byUid = await db.collection('users').doc(uid).get()
  if (byUid.exists) {
    return { data: byUid.data() || null, via: 'uid' }
  }
  if (email) {
    const q = await db
      .collection('users')
      .where('email', '==', String(email).toLowerCase().trim())
      .limit(1)
      .get()
    if (!q.empty) {
      return { data: q.docs[0].data() || null, via: 'email' }
    }
  }
  return { data: null, via: null }
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} uid
 * @param {string | null | undefined} email
 * @returns {Promise<FirebaseFirestore.DocumentData | null>}
 */
export async function getUserProfileData(db, uid, email) {
  const { data } = await resolveUserProfile(db, uid, email)
  return data
}
