export function formatFileSize(bytes: unknown): string {
  const size = Number(bytes)
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  if (size < 1024) return `${Math.round(size)} B`
  if (size < 1024 * 1024) return `${formatSizeUnit(size / 1024)} KB`
  return `${formatSizeUnit(size / 1024 / 1024)} MB`
}

export function formatDate(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''

  const date = new Date(value as string | number | Date)
  if (Number.isNaN(date.getTime())) return String(value)

  const year = date.getFullYear()
  const month = padDatePart(date.getMonth() + 1)
  const day = padDatePart(date.getDate())
  const hour = padDatePart(date.getHours())
  const minute = padDatePart(date.getMinutes())
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function formatSizeUnit(value: number): string {
  return value >= 10 ? value.toFixed(1) : value.toFixed(2)
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0')
}
