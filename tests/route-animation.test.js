const assert = require('assert')
const { buildRouteGeometry, getDirectionMarker } = require('../miniprogram/utils/route')
const {
  DEFAULT_DURATION_MS,
  TARGET_SPEED_KM_PER_SECOND,
  MIN_DURATION_MS,
  DEFAULT_FRAME_MS,
  getAnimationFraction,
  getTrackDurationMs,
  getAdaptiveFrameMs,
  getAnimationPath,
  getNativeAnimationLegs,
  updateAnimatedMarkers
} = require('../miniprogram/utils/route-animation')

const PEK = { latitude: 40.077349, longitude: 116.596702 }
const HND = { latitude: 35.549678, longitude: 139.786958 }
const LAX = { latitude: 33.942501, longitude: -118.407997 }
const SIN = { latitude: 1.3644, longitude: 103.9915 }
const SYD = { latitude: -33.9399, longitude: 151.1753 }
const SHA = { latitude: 31.1979, longitude: 121.3363 }
const PVG = { latitude: 31.1443, longitude: 121.8083 }

function moved(a, b) {
  return Math.abs(a.latitude - b.latitude) > 1e-6 || Math.abs(a.longitude - b.longitude) > 1e-6
}

assert.strictEqual(getAnimationFraction(0), 0.08)
assert.strictEqual(getAnimationFraction(DEFAULT_DURATION_MS / 2), 0.5)
assert.strictEqual(getAnimationFraction(DEFAULT_DURATION_MS), 0.08)
assert.strictEqual(DEFAULT_FRAME_MS, 32)
assert.strictEqual(getAdaptiveFrameMs(5), 32)
assert.strictEqual(getAdaptiveFrameMs(30), 48)
assert.strictEqual(getAdaptiveFrameMs(100), 64)

const pekHnd = buildRouteGeometry(PEK, HND)
const baseMarker = getDirectionMarker(pekHnd.direction, { id: 3 })
assert.strictEqual(baseMarker.width, 14)
assert.strictEqual(baseMarker.height, 14)

const start = updateAnimatedMarkers([baseMarker], [{ markerId: 3, points: pekHnd.points, phase: 0 }], 0)[0]
const middle = updateAnimatedMarkers([baseMarker], [{ markerId: 3, points: pekHnd.points, phase: 0 }], DEFAULT_DURATION_MS / 2)[0]
assert(moved(start, middle), 'PEK-HND arrow should move forward along the route')
assert(Number.isFinite(start.rotate) && Number.isFinite(middle.rotate))

const hndLax = buildRouteGeometry(HND, LAX)
assert.strictEqual(hndLax.crossesDateline, true)
const nativeLegs = getNativeAnimationLegs({ points: hndLax.points, distanceKm: hndLax.distanceKm })
assert.strictEqual(nativeLegs.length, 2, 'native animation should split safely at the dateline')
nativeLegs.forEach((leg) => {
  assert(leg.durationMs > 0)
  for (let index = 1; index < leg.path.length; index += 1) {
    assert(Math.abs(leg.path[index].longitude - leg.path[index - 1].longitude) <= 180)
  }
})
const animationPath = getAnimationPath(pekHnd.points)
assert(animationPath.length > 2)
assert(moved(animationPath[0], animationPath[1]), 'native animation path should retain continuous route points')
const crossStart = updateAnimatedMarkers(
  [getDirectionMarker(hndLax.direction, { id: 8 })],
  [{ markerId: 8, points: hndLax.points, phase: 0 }],
  DEFAULT_DURATION_MS * 0.35
)[0]
const crossEnd = updateAnimatedMarkers(
  [getDirectionMarker(hndLax.direction, { id: 8 })],
  [{ markerId: 8, points: hndLax.points, phase: 0 }],
  DEFAULT_DURATION_MS * 0.65
)[0]
assert(moved(crossStart, crossEnd), 'HND-LAX arrow should move across the dateline route')
for (const marker of [crossStart, crossEnd]) {
  assert(marker.longitude >= -180 && marker.longitude <= 180)
  assert(marker.latitude >= -90 && marker.latitude <= 90)
  assert(Number.isFinite(marker.rotate))
}

for (const route of [pekHnd, buildRouteGeometry(SIN, SYD), hndLax]) {
  const durationMs = getTrackDurationMs({ points: route.points, distanceKm: route.distanceKm })
  const speed = route.distanceKm * 0.84 / (durationMs / 1000)
  assert(Math.abs(speed - TARGET_SPEED_KM_PER_SECOND) < 1e-6, `expected common speed, got ${speed}`)
}

const shortRoute = buildRouteGeometry(SHA, PVG)
assert.strictEqual(
  getTrackDurationMs({ points: shortRoute.points, distanceKm: shortRoute.distanceKm }),
  MIN_DURATION_MS,
  'very short routes should use the anti-flicker minimum duration'
)

console.log('✓ route-animation.test.js — 原生平滑路径、32ms 回退、统一速度与跨日期变更线动画通过')
