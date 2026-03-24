import { Timestamp } from 'firebase-admin/firestore'

export function serializeValue(value) {
  if (value === null || value === undefined) return value
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }
  if (Array.isArray(value)) return value.map(serializeValue)
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, serializeValue(v)]),
    )
  }
  return value
}

export function serializeDoc(doc) {
  if (!doc.exists) return null
  return { id: doc.id, ...serializeValue(doc.data()) }
}
