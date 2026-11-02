const assert = require('assert')
const fs = require('fs')

const metadata = JSON.parse(fs.readFileSync('cloud-data/airports.meta.json', 'utf8'))
const records = fs.readFileSync('cloud-data/airports.json', 'utf8').trim().split('\n').map(JSON.parse)
const localData = require('../miniprogram/data/airports')
const requiredFields = ['iata', 'icao', 'name', 'city', 'country', 'countryCode', 'latitude', 'longitude']
const ids = new Set()

assert.strictEqual(records.length, metadata.importedAirports)
assert.strictEqual(localData.airports.length, metadata.importedAirports)
assert(metadata.importedAirports >= 8000)

records.forEach((record) => {
  requiredFields.forEach((field) => assert(Object.prototype.hasOwnProperty.call(record, field), `${record._id} missing ${field}`))
  assert(!ids.has(record._id), `duplicate _id ${record._id}`)
  ids.add(record._id)
  assert(record.iata || record.icao, `${record._id} must have IATA or ICAO`)
  assert(Number.isFinite(record.latitude) && record.latitude >= -90 && record.latitude <= 90)
  assert(Number.isFinite(record.longitude) && record.longitude >= -180 && record.longitude <= 180)
  assert.strictEqual(record.source, 'OurAirports')
})

for (const code of ['PEK', 'PKX', 'HND', 'NRT', 'LAX', 'JFK', 'CDG', 'LHR', 'SIN', 'BKK', 'SYD', 'DXB']) {
  const record = records.find((item) => item.iata === code)
  assert(record, `missing global airport ${code}`)
  assert.strictEqual(record._id, code, `${code} should preserve the legacy IATA document ID`)
}

assert(fs.statSync('miniprogram/data/airports.js').size < 1.5 * 1024 * 1024, 'local airport data should remain below 1.5 MB')

console.log(`✓ airport-data.test.js — ${records.length} 条机场记录、字段、坐标、唯一 ID 与本地包体通过`)
