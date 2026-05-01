/// <reference types="@dcloudio/types" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare const wx: {
  chooseMessageFile(options: {
    count: number
    type: 'all' | 'video' | 'image' | 'file'
    extension?: string[]
    success: (result: { tempFiles: Array<{ name: string; size: number; path: string }> }) => void
    fail: (error: { errMsg?: string }) => void
  }): void
}
