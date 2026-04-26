import { spawn } from 'node:child_process'
import { cp, readFile, rm, writeFile } from 'node:fs/promises'
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

  if (code === 0 && isMpWeixinBuild(args)) {
    await syncCloudfunctionsOutput()
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

function isMpWeixinBuild(cliArgs) {
  return cliArgs[0] === 'build' && cliArgs.includes('-p') && cliArgs.includes('mp-weixin')
}

async function syncCloudfunctionsOutput() {
  await copyCloudfunctions()
  await patchProjectConfig()
}

async function copyCloudfunctions() {
  const sourceDir = path.join(rootDir, 'cloudfunctions')
  const targetDir = path.join(rootDir, 'dist', 'build', 'mp-weixin', 'cloudfunctions')

  await rm(targetDir, { recursive: true, force: true })
  await cp(sourceDir, targetDir, {
    recursive: true,
    filter: (source) => shouldCopyCloudfunctionPath(sourceDir, source),
  })
}

function shouldCopyCloudfunctionPath(sourceDir, sourcePath) {
  const relativePath = path.relative(sourceDir, sourcePath)
  if (!relativePath) return true

  const parts = relativePath.split(path.sep)
  const baseName = path.basename(sourcePath)
  if (parts.includes('node_modules')) return false
  if (baseName === '.DS_Store') return false
  if (baseName.endsWith('.log')) return false
  return true
}

async function patchProjectConfig() {
  const configPath = path.join(rootDir, 'dist', 'build', 'mp-weixin', 'project.config.json')
  const source = await readFile(configPath, 'utf8')
  const config = JSON.parse(source)
  config.cloudfunctionRoot = 'cloudfunctions/'
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}
