import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const args = process.argv.slice(2)
const candidates = [
  process.env.BUN_EXE,
  process.env.BUN,
  'F:\\.bun\\bin\\bun.exe',
  process.platform === 'win32' ? 'bun.cmd' : 'bun',
].filter(Boolean)

let lastError

for (const candidate of candidates) {
  if (candidate.includes('\\') && !existsSync(candidate)) {
    continue
  }

  const result = await run(candidate, args)
  if (result.error?.code === 'ENOENT') {
    lastError = result.error
    continue
  }
  if (result.error) {
    throw result.error
  }
  if (result.signal) {
    process.kill(process.pid, result.signal)
  }
  process.exit(result.code ?? 1)
}

console.error('Unable to find Bun. Set BUN_EXE to the bun executable path.')
if (lastError) {
  console.error(lastError.message)
}
process.exit(1)

function run(command, cliArgs) {
  return new Promise((resolve) => {
    const child = spawn(command, cliArgs, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: false,
    })

    child.on('exit', (code, signal) => {
      resolve({ code, signal })
    })

    child.on('error', (error) => {
      resolve({ error })
    })
  })
}
