async function upsertUser({ db, openid, now }) {
  const users = db.collection('users')
  const existing = await users.where({ openid }).get()

  if (existing.data[0]) {
    await users.doc(existing.data[0]._id).update({ data: { updatedAt: now } })
    return { ...existing.data[0], updatedAt: now, created: false }
  }

  const data = { openid, createdAt: now, updatedAt: now }
  const created = await users.add({ data })
  return { _id: created._id, ...data, created: true }
}

module.exports = {
  upsertUser,
}
