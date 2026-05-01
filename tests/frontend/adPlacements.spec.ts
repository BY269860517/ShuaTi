import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('wechat ad placements', () => {
  test('ad config keeps monetization disabled until real ad unit ids are configured', () => {
    expect(existsSync('common/ad/config.ts')).toBe(true)
    const source = read('common/ad/config.ts')

    expect(source).toContain('export const AD_CONFIG')
    expect(source).toContain('enabled: false')
    expect(source).toContain("resultFeedUnitId: ''")
    expect(source).toContain("homeFeedUnitId: ''")
  })

  test('AppAd wraps the WeChat mini-program ad component safely', () => {
    expect(existsSync('components/AppAd.vue')).toBe(true)
    const source = read('components/AppAd.vue')

    expect(source).toContain('unitId: string')
    expect(source).toContain('#ifdef MP-WEIXIN')
    expect(source).toContain('v-if="unitId"')
    expect(source).toContain('<ad')
    expect(source).toContain(':unit-id="unitId"')
    expect(source).toContain(':ad-intervals="60"')
    expect(source).toContain('@error="handleError"')
  })

  test('practice result page places the result ad after score and before actions', () => {
    const source = read('pages/practice/result.vue')
    const resultCardIndex = source.indexOf('class="result-card"')
    const adIndex = source.indexOf('<AppAd')
    const actionsIndex = source.indexOf('class="actions"')

    expect(source).toContain("import AppAd from '@/components/AppAd.vue'")
    expect(source).toContain("import { AD_CONFIG } from '@/common/ad/config'")
    expect(source).toContain('const resultAdUnitId = computed')
    expect(source).toContain('AD_CONFIG.resultFeedUnitId')
    expect(source).toContain(':unit-id="resultAdUnitId"')
    expect(resultCardIndex).toBeGreaterThan(-1)
    expect(adIndex).toBeGreaterThan(resultCardIndex)
    expect(actionsIndex).toBeGreaterThan(adIndex)
  })

  test('home page inserts the feed ad after the second material card', () => {
    const source = read('pages/index/index.vue')
    const materialCardIndex = source.indexOf('<MaterialCard')
    const adIndex = source.indexOf('<AppAd')

    expect(source).toContain("import AppAd from '@/components/AppAd.vue'")
    expect(source).toContain("import { AD_CONFIG } from '@/common/ad/config'")
    expect(source).toContain('const homeAdUnitId = computed')
    expect(source).toContain('AD_CONFIG.homeFeedUnitId')
    expect(source).toContain('v-for="(material, index) in materials"')
    expect(source).toContain('v-if="homeAdUnitId && index === 1"')
    expect(source).toContain(':unit-id="homeAdUnitId"')
    expect(materialCardIndex).toBeGreaterThan(-1)
    expect(adIndex).toBeGreaterThan(materialCardIndex)
  })
})
