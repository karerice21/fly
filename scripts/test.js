const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const files = fs.readdirSync(path.join(root, 'tests'))
  .filter((file) => file.endsWith('.test.js')).sort()

for (const file of files) {
  const result = spawnSync(process.execPath, [path.join(root, 'tests', file)], {
    cwd: root,
    stdio: 'inherit'
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
console.log(`\n${files.length} test files passed.`)
