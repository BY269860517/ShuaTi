async function updateExistingUser({ users, openid, now }) {
  const existingByOpenid = await users.where({ openid }).get()
  const user = existingByOpenid.data[0] || (await users.doc(openid).get()).data[0]

  if (!user) {
    return null
  }

  await users.doc(user._id).update({ data: { updatedAt: now } })
  return { ...user, updatedAt: now, created: false }
}

async function upsertUser({ db, openid, now }) {
  const users = db.collection('users')
  const existing = await updateExistingUser({ users, openid, now })

  if (existing) {
    return existing
  }

  const data = { _id: openid, openid, createdAt: now, updatedAt: now }
  try {
    const created = await users.add({ data })
    return { _id: created._id, ...data, created: true }
  } catch (error) {
    if (error.code !== 'duplicate_key') {
      throw error
    }

    const racedExisting = await updateExistingUser({ users, openid, now })
    if (racedExisting) {
      return racedExisting
    }

    throw error
  }
}

module.exports = {
  upsertUser,
}
