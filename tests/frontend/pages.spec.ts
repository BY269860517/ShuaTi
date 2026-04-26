import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('pdf import frontend pages', () => {
  test('declares required routes in pages.json', () => {
    const pagesJson = JSON.parse(read('pages.json')) as { pages: Array<{ path: string }> }
    const paths = pagesJson.pages.map((page) => page.path)

    expect(paths).toContain('pages/index/index')
    expect(paths).toContain('pages/upload/index')
    expect(paths).toContain('pages/material/detail')
    expect(paths).toContain('pages/import/review')
    expect(paths).toContain('pages/import/edit')
    expect(paths).toContain('pages/practice/setup')
  })

  test('home page logs in, loads materials, and navigates to upload/detail', () => {
    const source = read('pages/index/index.vue')

    expect(source).toContain('api.userLogin()')
    expect(source).toContain('api.materialList()')
    expect(source).toContain('MaterialCard')
    expect(source).toContain('EmptyState')
    expect(source).toContain('/pages/upload/index')
    expect(source).toContain('/pages/material/detail?materialId=')
  })

  test('upload page chooses a pdf, uploads to cloud storage, and starts parsing', () => {
    const source = read('pages/upload/index.vue')

    expect(source).toContain('chooseMessageFile')
    expect(source).toContain("extension: ['pdf']")
    expect(source).toContain('wx.cloud.uploadFile')
    expect(source).toContain('materials/${Date.now()}-${file.name}')
    expect(source).toContain('api.materialCreate')
    expect(source).toContain('api.parseStart(material._id)')
    expect(source).toContain("parseMode = ref<ParseMode>('inline_answer')")
    expect(source).toContain('answer_at_end')
  })

  test('material detail page loads detail, polls parse status, and links review/practice', () => {
    const source = read('pages/material/detail.vue')

    expect(source).toContain('api.materialDetail(materialId.value)')
    expect(source).toContain('api.parseStatus(materialId.value)')
    expect(source).toContain('setInterval')
    expect(source).toContain('3000')
    expect(source).toContain('clearPolling()')
    expect(source).toContain('/pages/import/review?materialId=')
    expect(source).toContain('/pages/practice/setup?materialId=')
  })

  test('candidate review page groups candidates and confirms import', () => {
    const source = read('pages/import/review.vue')

    expect(source).toContain('api.candidateList(materialId.value)')
    expect(source).toContain('StatusBadge')
    expect(source).toContain('CandidateCard')
    expect(source).toContain('/pages/import/edit?candidateId=')
    expect(source).toContain('api.importConfirm(materialId.value)')
    expect(source).toContain('safe-area-inset-bottom')
  })

  test('candidate edit page validates and saves editable fields', () => {
    const source = read('pages/import/edit.vue')

    expect(source).toContain('api.candidateDetail(candidateId.value)')
    expect(source).toContain('api.candidateUpdate(candidateId.value')
    expect(source).toContain('validateForm()')
    expect(source).toContain('addOption')
    expect(source).toContain('removeOption')
    expect(source).toContain('answerKeys')
    expect(source).toContain('navigateBack')
  })
})
