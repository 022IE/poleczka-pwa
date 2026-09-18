import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

function git(command, fallback) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim() || fallback
  } catch {
    return fallback
  }
}

const sha = process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA || git('git rev-parse HEAD', 'unknown')
const branch = process.env.WORKERS_CI_BRANCH || process.env.GITHUB_REF_NAME || git('git branch --show-current', 'unknown')
const builtAt = new Date().toISOString()

const body = `export const BUILD_COMMIT_SHA = ${JSON.stringify(sha)}\nexport const BUILD_BRANCH = ${JSON.stringify(branch)}\nexport const BUILD_TIME = ${JSON.stringify(builtAt)}\n`

mkdirSync('src', { recursive: true })
mkdirSync('worker', { recursive: true })
writeFileSync('src/buildInfo.ts', body, 'utf8')
writeFileSync('worker/buildInfo.ts', body, 'utf8')

console.log(`Build info: ${branch} ${sha.slice(0, 8)} ${builtAt}`)
