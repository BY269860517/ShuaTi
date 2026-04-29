function unwrapDataArg(arg) {
  if (arg && typeof arg === 'object' && Object.prototype.hasOwnProperty.call(arg, 'data')) {
    return arg.data
  }
  return arg
}

function normalizeAddResult(result = {}) {
  const id = result._id || result.id
  return id ? { ...result, _id: id, id } : result
}

function normalizeUpdateResult(result = {}) {
  const updated = Number(result.updated ?? result.updatedCount ?? result.modifiedCount ?? result.stats?.updated ?? 0)
  return { ...result, stats: { ...result.stats, updated } }
}

function wrapQuery(query) {
  return {
    get() {
      return query.get()
    },
    update(arg) {
      return Promise.resolve(query.update(unwrapDataArg(arg))).then(normalizeUpdateResult)
    },
    orderBy(field, direction) {
      return wrapQuery(query.orderBy(field, direction))
    },
    limit(size) {
      return wrapQuery(query.limit(size))
    },
    field(fields) {
      return wrapQuery(query.field(fields))
    },
  }
}

function wrapCollection(collection) {
  return {
    add(arg) {
      return Promise.resolve(collection.add(unwrapDataArg(arg))).then(normalizeAddResult)
    },
    doc(id) {
      const doc = collection.doc(id)
      return {
        get() {
          return doc.get()
        },
        update(arg) {
          return Promise.resolve(doc.update(unwrapDataArg(arg))).then(normalizeUpdateResult)
        },
        remove(arg) {
          return doc.remove ? doc.remove(arg) : Promise.resolve({ stats: { deleted: 0 } })
        },
      }
    },
    where(query) {
      return wrapQuery(collection.where(query))
    },
    orderBy(field, direction) {
      return wrapQuery(collection.orderBy(field, direction))
    },
    limit(size) {
      return wrapQuery(collection.limit(size))
    },
    field(fields) {
      return wrapQuery(collection.field(fields))
    },
  }
}

function createDbCompat(nativeDb) {
  return {
    command: nativeDb.command,
    collection(name) {
      return wrapCollection(nativeDb.collection(name))
    },
  }
}

module.exports = {
  createDbCompat,
}
