import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const uniCli = path.join(rootDir, 'node_modules', '@dcloudio', 'vite-plugin-uni', 'bin', 'uni.js')

const child = spawn(process.execPath, [uniCli, ...process.argv.slice(2)], {
  cwd: rootDir,
  env: {
    ...process.env,
    UNI_INPUT_DIR: process.env.UNI_INPUT_DIR || '.',
  },
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})
