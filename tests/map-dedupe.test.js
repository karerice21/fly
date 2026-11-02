const assert = require('assert')
const { stopRouteAnimation } = require('../miniprogram/utils/route-animation')

let mapPage
global.Page = (definition) => { mapPage = definition }
require('../miniprogram/pages/map/index')

const PEK = { _id: 'PEK', iata: 'PEK', icao: 'ZBAA', city: 'Beijing', countryCode: 'CN', lat: 40.077349, lng: 116.596702 }
const HND = { _id: 'HND', iata: 'HND', icao: 'RJTT', city: 'Tokyo', countryCode: 'JP', lat: 35.549678, lng: 139.786958 }

function flight(id, departure, arrival) {
  return { _id: id, departure, arrival, flightDate: '2026-08-24', distanceKm: 2092 }
}

function render(flights) {
  const context = {
    data: { markers: [] },
    setData(update, callback) {
      this.data = { ...this.data, ...update }
      if (callback) callback()
    }
  }
  mapPage.renderFlights.call(context, flights, ['全部'], '全部')
  stopRouteAnimation(context)
  return context.data
}

const repeated = render([
  flight('1', PEK, HND),
  flight('2', PEK, HND),
  flight('3', PEK, HND)
])
assert.strictEqual(repeated.polylines.length, 1, 'repeated PEK-HND records should share one geometry')
assert.strictEqual(repeated.markers.filter((marker) => marker.id >= 10000).length, 1, 'same direction should share one arrow')
assert.strictEqual(repeated.polylines[0].width, 2)
assert.strictEqual(repeated.stats.flights, 3, 'dedupe must not change flight statistics')

const roundTrips = render([
  flight('1', PEK, HND),
  flight('2', HND, PEK),
  flight('3', PEK, HND)
])
assert.strictEqual(roundTrips.polylines.length, 1, 'round trips should still share one geometry')
assert.strictEqual(roundTrips.markers.filter((marker) => marker.id >= 10000).length, 2, 'round trips should show one arrow per direction')
assert.strictEqual(roundTrips.stats.flights, 3)

delete global.Page
console.log('✓ map-dedupe.test.js — 重复航线保持单条 2px 曲线，同向箭头去重、往返箭头分离')
