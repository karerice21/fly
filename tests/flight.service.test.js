const assert = require('assert')

let storage = []
global.wx = {
  getStorageSync() {
    return storage
  },
  setStorageSync(key, value) {
    storage = JSON.parse(JSON.stringify(value))
  }
}

const airportService = require('../miniprogram/services/airport.service')
const flightService = require('../miniprogram/services/flight.service')

async function airport(iata) {
  const results = await airportService.search(iata)
  return results.find((item) => item.iata === iata)
}

async function run() {
  const first = await flightService.create({
    departure: await airport('PEK'),
    arrival: await airport('HND'),
    flightDate: '2026-08-21',
    flightNo: ' nh962 ',
    seat: ' 32a '
  })
  assert(first._id)
  assert.strictEqual(first.flightNo, 'NH962')
  assert.strictEqual(first.seat, '32A')
  assert(first.distanceKm > 0)
  assert.strictEqual(first.routeType, 'great_circle')

  const second = await flightService.create({
    departure: await airport('HND'),
    arrival: await airport('LAX'),
    flightDate: '2025-12-12'
  })

  let items = await flightService.list()
  assert.strictEqual(items.length, 2)
  assert.strictEqual(items[0]._id, first._id, 'newer flightDate should sort first')

  const filtered = await flightService.list({ year: '2025' })
  assert.deepStrictEqual(filtered.map((item) => item._id), [second._id])

  const updated = await flightService.update(first._id, {
    departure: await airport('PEK'),
    arrival: await airport('NRT'),
    flightDate: '2026-08-21',
    flightNo: 'ca001'
  })
  assert.strictEqual(updated.arrival.iata, 'NRT')
  assert.strictEqual(updated.flightNo, 'CA001')

  const stats = await flightService.stats()
  assert.strictEqual(stats.flights, 2)
  assert.strictEqual(stats.airports, 4)
  assert.strictEqual(stats.countries, 3)
  assert.strictEqual(stats.airportItems.length, 4)
  assert.deepStrictEqual(stats.regionItems.map((item) => item.countryCode).sort(), ['CN', 'JP', 'US'])

  await flightService.remove(second._id)
  items = await flightService.list()
  assert.strictEqual(items.length, 1)

  await flightService.removeAll()
  assert.strictEqual((await flightService.list()).length, 0)

  console.log('✓ flight.service.test.js — 新增、排序、筛选、编辑、统计和删除通过')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
