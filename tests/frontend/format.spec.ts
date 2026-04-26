import { describe, expect, test } from 'vitest'
import { formatDate, formatFileSize } from '../../common/format'

describe('frontend format helpers', () => {
  test('formats file sizes with B, KB, and MB units', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB')
  })

  test('formats invalid file sizes without NaN', () => {
    expect(formatFileSize(Number.NaN)).toBe('0 B')
    expect(formatFileSize(Number.POSITIVE_INFINITY)).toBe('0 B')
    expect(formatFileSize(-1)).toBe('0 B')
    expect(formatFileSize('not-a-size')).toBe('0 B')
  })

  test('formats dates as YYYY-MM-DD', () => {
    expect(formatDate('2026-04-26T13:45:00+08:00')).toBe('2026-04-26')
  })

  test('returns original invalid dates and blank empty values', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
    expect(formatDate('')).toBe('')
    expect(formatDate(null)).toBe('')
  })
})
