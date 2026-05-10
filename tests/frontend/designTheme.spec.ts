import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const themeFiles = [
  'App.vue',
  'components/AppAd.vue',
  'components/CandidateCard.vue',
  'components/EmptyState.vue',
  'components/ErrorState.vue',
  'components/LoadingState.vue',
  'components/MaterialCard.vue',
  'components/OptionList.vue',
  'components/QuestionCard.vue',
  'components/StatusBadge.vue',
  'pages/index/index.vue',
  'pages/material/detail.vue',
  'pages/upload/index.vue',
  'pages/import/review.vue',
  'pages/import/edit.vue',
  'pages/practice/setup.vue',
  'pages/practice/do.vue',
  'pages/practice/result.vue',
  'pages/profile/index.vue',
  'pages/wrong/index.vue',
]

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('scheme A design theme', () => {
  test('declares the approved calm study-tool palette', () => {
    const source = read('uni.scss')

    expect(source).toContain('$brand-primary: #246d9d;')
    expect(source).toContain('$brand-success: #1f9d7a;')
    expect(source).toContain('$background: #f5f8fb;')
    expect(source).toContain('$surface-shadow: 0 4rpx 16rpx rgba(31, 95, 139, 0.06);')
  })

  test('core UI files use design tokens instead of the old scheme colors', () => {
    const combined = themeFiles.map((file) => read(file)).join('\n')

    expect(combined).not.toContain('#1f5f8b')
    expect(combined).not.toContain('#f6f7f9')
    expect(combined).not.toContain('#b8c7d8')
  })
})
