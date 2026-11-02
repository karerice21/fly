const assert = require('assert')
const fs = require('fs')
const airportService = require('../miniprogram/services/airport.service')

async function run() {
  const requiredCodes = ['PEK', 'HND', 'LAX', 'JFK', 'CDG', 'LHR', 'SIN', 'SYD', 'DXB']
  for (const code of requiredCodes) {
    const results = await airportService.search(code)
    assert(results.length > 0, `${code} should return a result`)
    assert.strictEqual(results[0].iata, code, `${code} exact IATA match should rank first`)
    const airport = results[0]
    for (const field of ['iata', 'icao', 'name', 'city', 'country', 'countryCode', 'latitude', 'longitude']) {
      assert(airport[field] !== undefined && airport[field] !== '', `${code} missing ${field}`)
    }
  }

  const hnd = await airportService.search('rjtt')
  assert.strictEqual(hnd[0].iata, 'HND')

  const beijing = await airportService.search('北京')
  assert(beijing.some((airport) => airport.iata === 'PEK'))
  assert(beijing.some((airport) => airport.iata === 'PKX'))

  const haneda = await airportService.search('Haneda')
  assert.strictEqual(haneda[0].iata, 'HND')

  const popular = await airportService.search('')
  assert(popular.length <= 8)

  const metadata = JSON.parse(fs.readFileSync('cloud-data/airports.meta.json', 'utf8'))
  assert(metadata.importedAirports >= 8000, 'global airport dataset should contain thousands of airports')
  assert.strictEqual(metadata.license, 'Public Domain')

  console.log(`✓ airport.test.js — ${metadata.importedAirports} 个全球机场，IATA、ICAO、城市和机场名搜索通过`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
