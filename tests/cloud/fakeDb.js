function createFakeDb() {
  const store = new Map()
  const counters = new Map()

  function collection(name) {
    if (!store.has(name)) store.set(name, [])
    const rows = store.get(name)

    return {
      async add({ data }) {
        const next = (counters.get(name) || 0) + 1
        counters.set(name, next)
        const row = { _id: `${name}_${next}`, ...structuredClone(data) }
        rows.push(row)
        return { _id: row._id }
      },
      doc(id) {
        return {
          async get() {
            return { data: rows.filter((row) => row._id === id).map(structuredClone) }
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
        return {
          async get() {
            return { data: matched().map(structuredClone) }
          },
          async update({ data }) {
            const items = matched()
            items.forEach((row) => Object.assign(row, structuredClone(data)))
            return { stats: { updated: items.length } }
          },
        }
      },
      _rows: rows,
    }
  }

  return { collection }
}

module.exports = {
  createFakeDb,
}
