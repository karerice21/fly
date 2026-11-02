const EARTH_RADIUS_KM = 6371.0088

function toRadians(degrees) {
  return degrees * Math.PI / 180
}

function toDegrees(radians) {
  return radians * 180 / Math.PI
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function normalizeLongitude(longitude) {
  let value = ((longitude + 180) % 360 + 360) % 360 - 180
  if (value === -180 && longitude > 0) value = 180
  return value
}

function haversineDistanceKm(a, b) {
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)
  const deltaLat = lat2 - lat1
  const deltaLng = toRadians(b.longitude - a.longitude)
  const h = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(clamp(h, 0, 1)))
}

function latLngToVector(point) {
  const lat = toRadians(point.latitude)
  const lng = toRadians(point.longitude)
  const cosLat = Math.cos(lat)
  return [cosLat * Math.cos(lng), cosLat * Math.sin(lng), Math.sin(lat)]
}

function vectorToLatLng(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1
  const x = vector[0] / length
  const y = vector[1] / length
  const z = vector[2] / length
  return {
    latitude: toDegrees(Math.atan2(z, Math.hypot(x, y))),
    longitude: normalizeLongitude(toDegrees(Math.atan2(y, x)))
  }
}

function interpolateGreatCircle(a, b, fraction) {
  const t = clamp(Number(fraction) || 0, 0, 1)
  const start = latLngToVector(a)
  const end = latLngToVector(b)
  const dot = clamp(start[0] * end[0] + start[1] * end[1] + start[2] * end[2], -1, 1)
  const omega = Math.acos(dot)
  const sinOmega = Math.sin(omega)
  if (omega < 1e-10 || Math.abs(sinOmega) < 1e-10) {
    const deltaLng = normalizeLongitude(b.longitude - a.longitude)
    return {
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: normalizeLongitude(a.longitude + deltaLng * t)
    }
  }

  const startWeight = Math.sin((1 - t) * omega) / sinOmega
  const endWeight = Math.sin(t * omega) / sinOmega
  return vectorToLatLng([
    start[0] * startWeight + end[0] * endWeight,
    start[1] * startWeight + end[1] * endWeight,
    start[2] * startWeight + end[2] * endWeight
  ])
}

function generateGreatCircle(a, b, segments) {
  const count = Math.max(2, Number(segments) || 64)
  const points = []
  for (let index = 0; index <= count; index += 1) {
    points.push(interpolateGreatCircle(a, b, index / count))
  }

  points[0] = { latitude: a.latitude, longitude: normalizeLongitude(a.longitude) }
  points[points.length - 1] = { latitude: b.latitude, longitude: normalizeLongitude(b.longitude) }
  return points
}

function splitAtDateline(points) {
  if (!points || points.length < 2) return points && points.length ? [points] : []
  const segments = []
  let current = [points[0]]

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const next = points[index]
    const delta = next.longitude - previous.longitude

    if (Math.abs(delta) <= 180) {
      current.push(next)
      continue
    }

    const movingEast = delta < -180
    const boundary = movingEast ? 180 : -180
    const nextUnwrapped = movingEast ? next.longitude + 360 : next.longitude - 360
    const denominator = nextUnwrapped - previous.longitude
    const ratio = denominator === 0 ? 0.5 : (boundary - previous.longitude) / denominator
    const latitude = previous.latitude + (next.latitude - previous.latitude) * ratio
    current.push({ latitude, longitude: boundary })
    if (current.length >= 2) segments.push(current)
    current = [
      { latitude, longitude: movingEast ? -180 : 180 },
      next
    ]
  }

  if (current.length >= 2) segments.push(current)
  return segments
}

function chooseSegments(distanceKm) {
  if (distanceKm < 1500) return 32
  if (distanceKm < 7000) return 64
  if (distanceKm < 12000) return 96
  return 128
}

function calculateBearing(a, b) {
  if (!a || !b) throw new Error('INVALID_ROUTE')
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)
  const deltaLng = toRadians(normalizeLongitude(b.longitude - a.longitude))
  const y = Math.sin(deltaLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng)
  return (toDegrees(Math.atan2(y, x)) + 360) % 360
}

function getRouteDirection(points, fraction = 0.5) {
  if (!Array.isArray(points) || points.length < 2) throw new Error('INVALID_ROUTE')
  const numericFraction = Number(fraction)
  const safeFraction = clamp(Number.isFinite(numericFraction) ? numericFraction : 0.5, 0.05, 0.95)
  const scaledIndex = (points.length - 1) * safeFraction
  const lowerIndex = Math.floor(scaledIndex)
  const upperIndex = Math.min(points.length - 1, lowerIndex + 1)
  const localFraction = scaledIndex - lowerIndex
  const point = interpolateGreatCircle(points[lowerIndex], points[upperIndex], localFraction)
  let before = points[lowerIndex]
  let after = points[upperIndex]
  if (lowerIndex === upperIndex) {
    before = points[Math.max(0, lowerIndex - 1)]
    after = points[Math.min(points.length - 1, upperIndex + 1)]
  }
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    bearing: calculateBearing(before, after),
    fraction: safeFraction
  }
}

function getDirectionMarker(direction, options = {}) {
  if (!direction || !Number.isFinite(direction.latitude) || !Number.isFinite(direction.longitude) || !Number.isFinite(direction.bearing)) {
    throw new Error('INVALID_ROUTE')
  }
  return {
    id: options.id || 9000,
    latitude: direction.latitude,
    longitude: direction.longitude,
    iconPath: '/assets/route-direction.png',
    width: options.width || 14,
    height: options.height || 14,
    rotate: direction.bearing,
    alpha: 0.96,
    anchor: { x: 0.5, y: 0.5 },
    zIndex: options.zIndex || 9,
    title: options.title || '航线方向（非实时位置）'
  }
}

function buildRouteGeometry(a, b, requestedSegments) {
  if (!a || !b || !Number.isFinite(a.latitude) || !Number.isFinite(a.longitude) ||
    !Number.isFinite(b.latitude) || !Number.isFinite(b.longitude)) {
    throw new Error('INVALID_ROUTE')
  }
  const distanceKm = haversineDistanceKm(a, b)
  const points = generateGreatCircle(a, b, requestedSegments || chooseSegments(distanceKm))
  const polylines = splitAtDateline(points)
  return {
    distanceKm,
    polylines,
    crossesDateline: polylines.length > 1,
    direction: getRouteDirection(points),
    points
  }
}

module.exports = {
  EARTH_RADIUS_KM,
  haversineDistanceKm,
  interpolateGreatCircle,
  generateGreatCircle,
  splitAtDateline,
  calculateBearing,
  getRouteDirection,
  getDirectionMarker,
  buildRouteGeometry
}
