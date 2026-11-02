const assert = require('assert')
const fs = require('fs')
const {
  haversineDistanceKm,
  generateGreatCircle,
  splitAtDateline,
  calculateBearing,
  getRouteDirection,
  getDirectionMarker,
  buildRouteGeometry
} = require('../miniprogram/utils/route')

const PEK = { latitude: 40.0799, longitude: 116.6031 }
const HND = { latitude: 35.5494, longitude: 139.7798 }
const LAX = { latitude: 33.9416, longitude: -118.4085 }
const NRT = { latitude: 35.772, longitude: 140.3929 }
const SFO = { latitude: 37.6213, longitude: -122.379 }
const SHA = { latitude: 31.1979, longitude: 121.3363 }
const PVG = { latitude: 31.1443, longitude: 121.8083 }
const SIN = { latitude: 1.3644, longitude: 103.9915 }
const SYD = { latitude: -33.9399, longitude: 151.1753 }

function assertNear(actual, expected, tolerance, label) {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}±${tolerance}, got ${actual}`)
}

function angularDifference(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180)
}

assertNear(haversineDistanceKm(PEK, HND), 2090, 80, 'PEK-HND distance')
assertNear(haversineDistanceKm(SHA, PVG), 46, 12, 'SHA-PVG short distance')
assertNear(haversineDistanceKm(SIN, SYD), 6300, 150, 'SIN-SYD hemisphere distance')

const pekHnd = buildRouteGeometry(PEK, HND)
assert.strictEqual(pekHnd.crossesDateline, false)
assert.strictEqual(pekHnd.polylines.length, 1)
assert(pekHnd.polylines[0].length >= 33)

const hndPek = buildRouteGeometry(HND, PEK)
assertNear(angularDifference(pekHnd.direction.bearing, hndPek.direction.bearing), 180, 2, 'PEK-HND reverse midpoint bearing')
assert(pekHnd.direction.longitude >= -180 && pekHnd.direction.longitude <= 180)
assert(Number.isFinite(calculateBearing(PEK, HND)))
const pekHndMarker = getDirectionMarker(pekHnd.direction, { id: 77 })
assert.strictEqual(pekHndMarker.id, 77)
assert.strictEqual(pekHndMarker.iconPath, '/assets/route-direction.png')
assertNear(pekHndMarker.rotate, pekHnd.direction.bearing, 1e-9, 'direction marker rotation')
assert(fs.existsSync('miniprogram/assets/route-direction.png'), 'direction marker asset should exist')

const hndLax = buildRouteGeometry(HND, LAX)
assert.strictEqual(hndLax.crossesDateline, true, 'HND-LAX should cross the dateline')
assert.strictEqual(hndLax.polylines.length, 2)
hndLax.polylines.forEach((segment) => {
  for (let index = 1; index < segment.length; index += 1) {
    const jump = Math.abs(segment[index].longitude - segment[index - 1].longitude)
    assert(jump <= 180, `dateline jump remains inside segment: ${jump}`)
  }
})

const laxHnd = buildRouteGeometry(LAX, HND)
assert.strictEqual(laxHnd.crossesDateline, true, 'LAX-HND reverse route should cross the dateline')
assertNear(angularDifference(hndLax.direction.bearing, laxHnd.direction.bearing), 180, 2, 'HND-LAX reverse midpoint bearing')
assert(hndLax.direction.longitude >= -180 && hndLax.direction.longitude <= 180)
assert(laxHnd.direction.longitude >= -180 && laxHnd.direction.longitude <= 180)
laxHnd.polylines.forEach((segment) => {
  for (let index = 1; index < segment.length; index += 1) {
    assert(Math.abs(segment[index].longitude - segment[index - 1].longitude) <= 180)
  }
})

const nrtSfo = buildRouteGeometry(NRT, SFO)
assert.strictEqual(nrtSfo.crossesDateline, true, 'NRT-SFO should cross the dateline')

const exact = generateGreatCircle(PEK, HND, 32)
assertNear(exact[0].latitude, PEK.latitude, 1e-9, 'great-circle start latitude')
assertNear(exact[0].longitude, PEK.longitude, 1e-9, 'great-circle start longitude')
assertNear(exact[exact.length - 1].latitude, HND.latitude, 1e-9, 'great-circle end latitude')
assertNear(exact[exact.length - 1].longitude, HND.longitude, 1e-9, 'great-circle end longitude')
assert.strictEqual(exact.length, 33)

const synthetic = splitAtDateline([
  { latitude: 20, longitude: 170 },
  { latitude: 22, longitude: -170 }
])
assert.strictEqual(synthetic.length, 2)
assert.strictEqual(synthetic[0][synthetic[0].length - 1].longitude, 180)
assert.strictEqual(synthetic[1][0].longitude, -180)

const twoPointDirection = getRouteDirection([PEK, HND])
assert(Number.isFinite(twoPointDirection.bearing))

const continuousA = getRouteDirection(pekHnd.points, 0.201)
const continuousB = getRouteDirection(pekHnd.points, 0.205)
assert(
  Math.abs(continuousA.latitude - continuousB.latitude) > 1e-8 || Math.abs(continuousA.longitude - continuousB.longitude) > 1e-8,
  'direction position should interpolate continuously between adjacent samples'
)

console.log('✓ route.test.js — 大圆距离、采样、正反方向角和日期变更线拆分通过')
