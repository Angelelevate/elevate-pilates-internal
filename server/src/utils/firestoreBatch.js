function chunkArray(items, chunkSize) {
  const out = []
  for (let i = 0; i < items.length; i += chunkSize) {
    out.push(items.slice(i, i + chunkSize))
  }
  return out
}

/**
 * Batch-load document snapshots by id with chunked getAll() calls.
 * Returns a Map<id, DocumentSnapshot>.
 */
export async function getDocSnapshotsById(
  db,
  collectionName,
  ids,
  { chunkSize = 100 } = {},
) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))]
  const out = new Map()
  if (uniqueIds.length === 0) return out

  const chunks = chunkArray(uniqueIds, chunkSize)
  const chunkPromises = chunks.map((chunk) => {
    const refs = chunk.map((id) => db.collection(collectionName).doc(id))
    return db.getAll(...refs)
  })

  const chunkSnapshots = await Promise.all(chunkPromises)
  for (const snaps of chunkSnapshots) {
    for (const snap of snaps) {
      out.set(snap.id, snap)
    }
  }

  return out
}

