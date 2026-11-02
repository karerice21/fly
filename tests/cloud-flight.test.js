const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const fixtures = require('../miniprogram/data/demo-flights')

// Exercise the deployed entry point with a deterministic SDK mock; no cloud credentials required.
let openid = 'test-alice'
let failReads = false
let nextId = 0
let records = []
const canonicalAirports = new Map()
fixtures.forEach((flight) => [flight.departure, flight.arrival].forEach((airport) => {
  canonicalAirports.set(airport._id, { ...airport, latitude: airport.lat, longitude: airport.lng })
}))
const copy = (value) => JSON.parse(JSON.stringify(value))

function collection(name) {
  return {
    where(filter) {
      let offset = 0
      let limit = Infinity
      const query = {
        orderBy() { return query },
        skip(value) { offset = value; return query },
        limit(value) { limit = value; return query },
        async get() {
          if (failReads) throw new Error('simulated database outage')
          const rows = records.filter((record) => Object.entries(filter).every(([key, value]) => record[key] === value))
          return { data: copy(rows.slice(offset, offset + limit)) }
        }
      }
      return query
    },
    doc(id) {
      return {
        async get() { return { data: copy(canonicalAirports.get(id) || null) } },
        async update({ data }) {
          const record = records.find((item) => item._id === id)
          Object.assign(record, copy(data))
        },
        async remove() { records = records.filter((item) => item._id !== id) }
      }
    },
    async add({ data }) {
      assert.strictEqual(name, 'flights')
      const id = `test-flight-${++nextId}`
      records.push({ ...copy(data), _id: id })
      return { _id: id }
    }
  }
}

const cloud = {
  DYNAMIC_CURRENT_ENV: 'mock',
  init() {},
  getWXContext: () => ({ OPENID: openid }),
  database: () => ({ command: {}, collection, serverDate: () => 1234567890 })
}
const sandbox = { exports: {}, console: { error() {} }, require(name) {
  assert.strictEqual(name, 'wx-server-sdk')
  return cloud
} }
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../cloudfunctions/flightService/index.js'), 'utf8'), sandbox)
const call = sandbox.exports.main

async function run() {
  openid = ''
  for (const action of ['list', 'stats', 'get', 'create', 'update', 'delete', 'deleteAll']) {
    assert.strictEqual((await call({ action })).errorCode, 'UNAUTHORIZED')
  }
  openid = 'test-alice'
  assert.strictEqual((await call()).errorCode, 'INVALID_ACTION')
  assert.strictEqual((await call({ action: 'create', input: {} })).errorCode, 'INVALID_ROUTE')

  const spoofed = copy(fixtures[0])
  spoofed.departure.lat = 0
  spoofed.departure.name = 'forged airport'
  spoofed._openid = 'test-bob'
  spoofed.distanceKm = 1
  const created = await call({ action: 'create', input: spoofed, _openid: 'test-bob' })
  assert(created.ok)
  const id = created.data._id
  assert.strictEqual(records[0]._openid, 'test-alice', 'owner must come from server context')
  assert.strictEqual(created.data.departure.lat, fixtures[0].departure.lat, 'coordinates must come from airport collection')
  assert(created.data.distanceKm > 1000, 'distance must be recalculated on the server')

  openid = 'test-bob'
  for (const action of ['get', 'update', 'delete']) {
    assert.strictEqual((await call({ action, id, input: fixtures[1] })).errorCode, 'FLIGHT_NOT_FOUND')
  }
  assert.strictEqual((await call({ action: 'list' })).data.items.length, 0)
  assert.strictEqual((await call({ action: 'stats' })).data.flights, 0)
  await call({ action: 'create', input: fixtures[2] })

  openid = 'test-alice'
  assert((await call({ action: 'update', id, input: fixtures[1] })).ok)
  assert.strictEqual((await call({ action: 'get', id })).data.arrival._id, fixtures[1].arrival._id)
  assert.strictEqual((await call({ action: 'stats' })).data.flights, 1)
  assert.strictEqual((await call({ action: 'list', limit: 1 })).data.items.length, 1)
  assert.strictEqual((await call({ action: 'deleteAll' })).data.deleted, 1)
  assert.strictEqual(records.length, 1)
  assert.strictEqual(records[0]._openid, 'test-bob', 'bulk deletion must preserve another user’s records')

  failReads = true
  for (const action of ['list', 'stats', 'deleteAll']) {
    const response = await call({ action })
    assert.strictEqual(response.errorCode, 'DB_ERROR', `${action} must catch rejected database promises`)
  }
  console.log('✓ cloud-flight.test.js — 服务端身份、跨用户读写隔离、权威机场快照与异步异常处理通过（SDK mock）')
}

run().catch((error) => { console.error(error); process.exit(1) })
