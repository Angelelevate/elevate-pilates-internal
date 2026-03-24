/**
 * Grant Firebase Auth custom claim { role: "admin" } to an existing user.
 *
 * Prereqs:
 * 1. Create the user in Firebase Console (Auth → Add user) with email/password, OR sign up somehow.
 * 2. server/.env has FIREBASE_SERVICE_ACCOUNT_PATH pointing at your service account JSON.
 *
 * Usage (from repo root):
 *   npm run set-admin --workspace=server -- you@example.com
 *
 * Or from server/:
 *   npm run set-admin -- you@example.com
 *
 * After running: sign out in the app (if logged in) and sign in again so the ID token picks up the new claim.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(serverRoot, '.env') })

const email = process.argv[2]?.trim().toLowerCase()
if (!email) {
  console.error('Usage: node scripts/set-admin-role.mjs <email>')
  process.exit(1)
}

const rel = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || ''
if (!rel) {
  console.error('Set FIREBASE_SERVICE_ACCOUNT_PATH in server/.env')
  process.exit(1)
}

const resolved = path.isAbsolute(rel) ? rel : path.resolve(serverRoot, rel)
if (!fs.existsSync(resolved)) {
  console.error('Service account file not found:', resolved)
  process.exit(1)
}

const serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })

const user = await admin.auth().getUserByEmail(email)
await admin.auth().setCustomUserClaims(user.uid, { role: 'admin' })

const db = admin.firestore()
await db
  .collection('users')
  .doc(user.uid)
  .set(
    {
      uid: user.uid,
      email: user.email || email,
      firstName: 'Admin',
      lastName: 'User',
      phone: null,
      role: 'admin',
      status: 'active',
      inviteId: null,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

console.log(`Admin role set for ${email} (uid: ${user.uid}). Sign out and sign in again in the app.`)
