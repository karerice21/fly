const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const entries = [
  '.editorconfig', '.gitattributes', '.gitignore', '.nvmrc', '.github',
  'LICENSE', 'README.md', 'THIRD_PARTY_DATA.md', 'package.json', 'package-lock.json',
  'project.config.json', 'miniprogram', 'cloudfunctions', 'cloud-data', 'scripts', 'tests', 'docs'
]

function isPrivate(file) {
  return file.split('/').some((part) =>
    part === '.DS_Store' || part === 'node_modules' || part === 'project.private.config.json' ||
    part === '.git' || /^\.env(?:\.|$)/.test(part) || /\.(?:docx|pem|key|p12|pfx|log)$/.test(part))
}

function publicFiles() {
  const files = []
  function visit(file) {
    if (isPrivate(file)) return
    const absolute = path.join(root, file)
    const stat = fs.lstatSync(absolute)
    if (stat.isSymbolicLink()) throw new Error(`Public files must not be symlinks: ${file}`)
    if (stat.isDirectory()) {
      fs.readdirSync(absolute).sort().forEach((name) => visit(`${file}/${name}`))
    } else if (stat.isFile()) files.push(file)
  }
  entries.forEach(visit)
  return files.sort()
}

module.exports = { root, publicFiles, isPrivate }
