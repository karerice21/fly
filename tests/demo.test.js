const assert = require('assert')
const env = require('../miniprogram/config/env')
const fixtures = require('../miniprogram/data/demo-flights')
const service = require('../miniprogram/services/flight.service')

let storage = []
let writes = 0
let failWrite = false
let failRead = false
global.wx = {
  getStorageSync() {
    if (failRead) throw new Error('STORAGE_UNAVAILABLE')
    return JSON.parse(JSON.stringify(storage))
  },
  setStorageSync(key, value) {
    if (failWrite) throw new Error('STORAGE_FULL')
    writes += 1
    storage = JSON.parse(JSON.stringify(value))
  }
}

async function run() {
  assert.strictEqual(await service.loadDemo(), 8)
  assert.strictEqual(writes, 1, 'demo import should commit all records in a single write')
  assert.strictEqual(new Set(storage.map((item) => item._id)).size, 8)
  assert(storage.every((item) => item.distanceKm > 0 && item.flightNo.startsWith('DEMO')))
  assert.strictEqual((await service.list({ year: '2025' })).length, 3)
  const stats = await service.stats()
  assert.strictEqual(stats.airports, 8)
  assert.strictEqual(stats.countries, 7)
  const before = JSON.stringify(storage)
  await assert.rejects(service.loadDemo(), /DEMO_REQUIRES_EMPTY/)
  assert.strictEqual(JSON.stringify(storage), before, 'existing records must remain untouched')

  env.USE_CLOUD = true
  await assert.rejects(service.loadDemo(), /DEMO_LOCAL_ONLY/)
  env.USE_CLOUD = false
  assert.strictEqual(JSON.stringify(storage), before)

  failRead = true
  await assert.rejects(service.loadDemo(), /STORAGE_UNAVAILABLE/)
  failRead = false
  assert.strictEqual(JSON.stringify(storage), before, 'read errors must not permit an overwrite')
  storage = { unknownFormat: true }
  await assert.rejects(service.loadDemo(), /DEMO_REQUIRES_EMPTY/)
  assert.deepStrictEqual(storage, { unknownFormat: true })

  await service.removeAll()
  failWrite = true
  await assert.rejects(service.loadDemo(), /STORAGE_FULL/)
  assert.strictEqual(storage.length, 0, 'failed import should not leave partial records')
  failWrite = false
  await service.loadDemo()
  assert.strictEqual((await service.list()).length, fixtures.length)
  console.log('✓ demo.test.js — 虚构旅程、跨年筛选、单次写入、重复保护与云模式隔离通过')
}

run().catch((error) => { console.error(error); process.exit(1) })
