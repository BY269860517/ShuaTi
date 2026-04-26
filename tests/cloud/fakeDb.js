function createFakeDb() {
  const store = new Map()
  const counters = new Map()

  function collection(name) {
    if (!store.has(name)) store.set(name, [])
    const rows = store.get(name)

    function createQuery(matched) {
      const query = {
        async get() {
          return { data: matched().map((row) => structuredClone(row)) }
        },
        orderBy(field, direction = 'asc') {
          const ordered = () => {
            const multiplier = direction === 'desc' ? -1 : 1
            return [...matched()].sort((left, right) => {
              if (left[field] === right[field]) return 0
              return left[field] > right[field] ? multiplier : -multiplier
            })
          }
          return createQuery(ordered)
        },
        async update({ data }) {
          const items = matched()
          items.forEach((row) => Object.assign(row, structuredClone(data)))
          return { stats: { updated: items.length } }
        },
      }
      return query
    }

    return {
      async add({ data }) {
        if (data._id && rows.some((row) => row._id === data._id)) {
          const error = new Error('duplicate key')
          error.code = 'duplicate_key'
          throw error
        }

        const next = (counters.get(name) || 0) + 1
        counters.set(name, next)
        const row = { _id: `${name}_${next}`, ...structuredClone(data) }
        rows.push(row)
        return { _id: row._id }
      },
      doc(id) {
        return {
          async get() {
            return { data: rows.filter((row) => row._id === id).map((row) => structuredClone(row)) }
          },
          async update({ data }) {
            const row = rows.find((item) => item._id === id)
            if (!row) return { stats: { updated: 0 } }
            Object.assign(row, structuredClone(data))
            return { stats: { updated: 1 } }
          },
        }
      },
      where(query) {
        const matched = () =>
          rows.filter((row) =>
            Object.entries(query || {}).every(([key, value]) => row[key] === value),
          )
        return createQuery(matched)
      },
      _rows: rows,
    }
  }

  return { collection }
}

module.exports = {
  createFakeDb,
}
