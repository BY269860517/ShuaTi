import { defineConfig } from 'vite'
import type { PluginOption } from 'vite'
import uniPluginModule from '@dcloudio/vite-plugin-uni'

type UniPluginFactory = () => PluginOption | PluginOption[]

const uniPluginSource = uniPluginModule as unknown as UniPluginFactory | { default: UniPluginFactory }
const uniPlugin = typeof uniPluginSource === 'function' ? uniPluginSource : uniPluginSource.default

export default defineConfig({
  plugins: [uniPlugin()],
})
