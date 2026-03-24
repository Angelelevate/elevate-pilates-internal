import admin from 'firebase-admin'
import { getFirebaseAdmin } from '../config/firebase.js'

export function getDb() {
  if (!getFirebaseAdmin()) return null
  return admin.firestore()
}
