export function formatFileSize(bytes: unknown): string {
  const size = Number(bytes)
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  if (size < 1024) return `${Math.round(size)} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function formatDate(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''

  const date = new Date(value as string | number | Date)
  if (Number.isNaN(date.getTime())) return String(value)

  const year = date.getFullYear()
  const month = padDatePart(date.getMonth() + 1)
  const day = padDatePart(date.getDate())
  return `${year}-${month}-${day}`
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0')
}
