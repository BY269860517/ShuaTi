import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const uniCli = path.join(rootDir, 'node_modules', '@dcloudio', 'vite-plugin-uni', 'bin', 'uni.js')
const args = process.argv.slice(2)

try {
  const { code, signal } = await runUniCli(args)
  if (signal) {
    process.kill(process.pid, signal)
  }

  process.exit(code ?? 1)
} catch (error) {
  console.error(error)
  process.exit(1)
}

function runUniCli(cliArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [uniCli, ...cliArgs], {
      cwd: rootDir,
      env: {
        ...process.env,
        UNI_INPUT_DIR: process.env.UNI_INPUT_DIR || '.',
      },
      stdio: 'inherit',
    })

    child.on('exit', (code, signal) => {
      resolve({ code, signal })
    })

    child.on('error', reject)
  })
}
