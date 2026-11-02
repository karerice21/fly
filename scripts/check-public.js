const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { root, publicFiles, isPrivate } = require('./public-files')

const files = publicFiles()
const errors = []
const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'))
const env = require('../miniprogram/config/env')
if (project.appid !== 'touristappid') errors.push('project.config.json must use touristappid before publishing')
if (env.USE_CLOUD !== false || env.CLOUD_ENV !== '') errors.push('Publish with the default local environment configuration')

const sensitivePatterns = [
  /wx[a-f0-9]{16}\b/i,
  /\bAKIA[A-Z0-9]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bghs_[A-Za-z0-9]{30,}\b/
]

for (const file of files) {
  const absolute = path.join(root, file)
  if (/\.(?:png|jpg|jpeg|gif|webp|ico)$/.test(file)) continue
  const source = fs.readFileSync(absolute, 'utf8')
  // Report paths only: matching content could itself be a credential.
  if (sensitivePatterns.some((pattern) => pattern.test(source))) errors.push(`Potential identifier or credential: ${file}`)
  if (file.endsWith('.js')) {
    const result = spawnSync(process.execPath, ['--check', absolute], { encoding: 'utf8' })
    if (result.error || result.status !== 0) errors.push(`JavaScript syntax error: ${file}\n${result.stderr || result.error}`)
  }
  if (file.endsWith('.json') && file !== 'cloud-data/airports.json') {
    try { JSON.parse(source) } catch (error) { errors.push(`Invalid JSON: ${file}`) }
  }
}

// .gitignore does not protect files already tracked by Git.
const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
if (tracked.status === 0) {
  for (const file of tracked.stdout.split('\0').filter(Boolean)) {
    if (isPrivate(file) || file.startsWith('dist/')) errors.push(`Private or generated file is tracked by Git: ${file}`)
    else if (!files.includes(file)) errors.push(`Tracked file outside the public file list: ${file}`)
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`✓ ${files.length} public files: JavaScript/JSON valid, local defaults clean, no configured credential patterns found.`)
console.log('This is a targeted check; review screenshots, notes and newly added files before publishing.')
