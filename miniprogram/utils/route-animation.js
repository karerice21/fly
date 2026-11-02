const {
  getRouteDirection,
  haversineDistanceKm,
  calculateBearing,
  splitAtDateline
} = require('./route')

const DEFAULT_DURATION_MS = 9000
const TARGET_SPEED_KM_PER_SECOND = 420
const MIN_DURATION_MS = 2800
const MAX_DURATION_MS = 42000
const MIN_FRACTION = 0.08
const MAX_FRACTION = 0.92
const DEFAULT_FRAME_MS = 32
const LOOP_PAUSE_MS = 120

function getAnimationFraction(elapsedMs, durationMs = DEFAULT_DURATION_MS, phase = 0) {
  const duration = Math.max(1000, Number(durationMs) || DEFAULT_DURATION_MS)
  const normalizedPhase = ((Number(phase) || 0) % 1 + 1) % 1
  const progress = ((Math.max(0, Number(elapsedMs) || 0) / duration) + normalizedPhase) % 1
  return MIN_FRACTION + (MAX_FRACTION - MIN_FRACTION) * progress
}

function estimateTrackDistanceKm(track) {
  if (Number.isFinite(track.distanceKm) && track.distanceKm > 0) return track.distanceKm
  if (!Array.isArray(track.points) || track.points.length < 2) return 0
  let distanceKm = 0
  for (let index = 1; index < track.points.length; index += 1) {
    distanceKm += haversineDistanceKm(track.points[index - 1], track.points[index])
  }
  return distanceKm
}

function getTrackDurationMs(track, fallbackDurationMs = DEFAULT_DURATION_MS) {
  if (Number.isFinite(track.durationMs) && track.durationMs > 0) return track.durationMs
  const distanceKm = estimateTrackDistanceKm(track)
  if (!distanceKm) return fallbackDurationMs
  const animatedDistanceKm = distanceKm * (MAX_FRACTION - MIN_FRACTION)
  const durationMs = animatedDistanceKm / TARGET_SPEED_KM_PER_SECOND * 1000
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, durationMs))
}

function updateAnimatedMarkers(markers, tracks, elapsedMs, durationMs = DEFAULT_DURATION_MS) {
  if (!Array.isArray(markers) || !Array.isArray(tracks) || !tracks.length) return markers || []
  const trackMap = new Map(tracks.map((track) => [track.markerId, track]))
  return markers.map((marker) => {
    const track = trackMap.get(marker.id)
    if (!track || !Array.isArray(track.points) || track.points.length < 2) return marker
    const trackDurationMs = getTrackDurationMs(track, durationMs)
    const fraction = getAnimationFraction(elapsedMs, trackDurationMs, track.phase)
    const direction = getRouteDirection(track.points, fraction)
    return {
      ...marker,
      latitude: direction.latitude,
      longitude: direction.longitude,
      rotate: direction.bearing
    }
  })
}

function getAdaptiveFrameMs(trackCount) {
  if (trackCount > 60) return 64
  if (trackCount > 20) return 48
  return DEFAULT_FRAME_MS
}

function samePoint(a, b) {
  return Math.abs(a.latitude - b.latitude) < 1e-10 && Math.abs(a.longitude - b.longitude) < 1e-10
}

function getAnimationPath(points, startFraction = MIN_FRACTION, endFraction = MAX_FRACTION) {
  if (!Array.isArray(points) || points.length < 2) return []
  const start = Math.min(MAX_FRACTION, Math.max(MIN_FRACTION, Number(startFraction) || MIN_FRACTION))
  const end = Math.min(MAX_FRACTION, Math.max(start, Number(endFraction) || MAX_FRACTION))
  const lastIndex = points.length - 1
  const startDirection = getRouteDirection(points, start)
  const endDirection = getRouteDirection(points, end)
  const path = [{ latitude: startDirection.latitude, longitude: startDirection.longitude }]
  const firstWholeIndex = Math.ceil(lastIndex * start)
  const lastWholeIndex = Math.floor(lastIndex * end)

  for (let index = firstWholeIndex; index <= lastWholeIndex; index += 1) {
    const point = points[index]
    if (point && !samePoint(path[path.length - 1], point)) path.push(point)
  }

  const endPoint = { latitude: endDirection.latitude, longitude: endDirection.longitude }
  if (!samePoint(path[path.length - 1], endPoint)) path.push(endPoint)
  return path
}

function pathDistanceKm(points) {
  let distanceKm = 0
  for (let index = 1; index < points.length; index += 1) {
    distanceKm += haversineDistanceKm(points[index - 1], points[index])
  }
  return distanceKm
}

function getNativeAnimationLegs(track, startFraction = MIN_FRACTION) {
  const path = getAnimationPath(track.points, startFraction, MAX_FRACTION)
  const segments = splitAtDateline(path)
  const totalDistanceKm = segments.reduce((sum, segment) => sum + pathDistanceKm(segment), 0)
  const fullDurationMs = getTrackDurationMs(track)
  const fractionRatio = (MAX_FRACTION - startFraction) / (MAX_FRACTION - MIN_FRACTION)
  const legDurationMs = fullDurationMs * Math.max(0, fractionRatio)
  return segments.map((segment) => ({
    path: segment,
    durationMs: Math.max(80, Math.round(legDurationMs * pathDistanceKm(segment) / (totalDistanceKm || 1)))
  }))
}

function rememberTimeout(page, callback, delayMs) {
  if (!page.__routeAnimationTimeouts) page.__routeAnimationTimeouts = new Set()
  const timer = setTimeout(() => {
    page.__routeAnimationTimeouts.delete(timer)
    callback()
  }, delayMs)
  page.__routeAnimationTimeouts.add(timer)
  return timer
}

function clearRememberedTimeout(page, timer) {
  if (!timer) return
  clearTimeout(timer)
  if (page.__routeAnimationTimeouts) page.__routeAnimationTimeouts.delete(timer)
}

function stopRouteAnimation(page) {
  if (!page) return
  page.__routeAnimationToken = (page.__routeAnimationToken || 0) + 1
  if (page.__routeAnimationTimer) {
    clearInterval(page.__routeAnimationTimer)
    page.__routeAnimationTimer = null
  }
  if (page.__routeAnimationTimeouts) {
    page.__routeAnimationTimeouts.forEach((timer) => clearTimeout(timer))
    page.__routeAnimationTimeouts.clear()
  }
  page.__routeAnimationContext = null
}

function startTimerRouteAnimation(page, tracks, options = {}) {
  page.__routeAnimationTracks = tracks
  const durationMs = options.durationMs || DEFAULT_DURATION_MS
  const frameMs = options.frameMs || getAdaptiveFrameMs(tracks.length)
  const startedAt = Date.now()

  const renderFrame = () => {
    if (!page.data || !Array.isArray(page.data.markers)) return
    const markers = updateAnimatedMarkers(page.data.markers, tracks, Date.now() - startedAt, durationMs)
    page.setData({ markers })
  }

  renderFrame()
  page.__routeAnimationTimer = setInterval(renderFrame, frameMs)
}

function resetNativeMarker(page, mapContext, track, point, bearing, token, callback) {
  if (page.__routeAnimationToken !== token) return
  try {
    mapContext.translateMarker({
      markerId: track.markerId,
      destination: { latitude: point.latitude, longitude: point.longitude },
      autoRotate: false,
      rotate: bearing,
      duration: 1
    })
  } catch (error) {
    // moveAlong 仍可能可用；下一帧由原生路径接管。
  }
  rememberTimeout(page, callback, 18)
}

function startNativeRouteAnimation(page, tracks, mapContext, options, token) {
  let fallingBack = false
  const fallback = () => {
    if (fallingBack || page.__routeAnimationToken !== token) return
    fallingBack = true
    stopRouteAnimation(page)
    startTimerRouteAnimation(page, tracks, options)
  }

  const playTrack = (track, initialFraction) => {
    let firstCycle = true

    const playCycle = () => {
      if (page.__routeAnimationToken !== token) return
      const startFraction = firstCycle ? initialFraction : MIN_FRACTION
      firstCycle = false
      const legs = getNativeAnimationLegs(track, startFraction)
      let legIndex = 0

      const playNextLeg = () => {
        if (page.__routeAnimationToken !== token) return
        if (legIndex >= legs.length) {
          rememberTimeout(page, playCycle, LOOP_PAUSE_MS)
          return
        }

        const leg = legs[legIndex]
        legIndex += 1
        const first = leg.path[0]
        const second = leg.path[1]
        if (!first || !second) {
          playNextLeg()
          return
        }
        const startPoint = { ...first }
        const startBearing = calculateBearing(first, second)

        resetNativeMarker(page, mapContext, track, startPoint, startBearing, token, () => {
          if (page.__routeAnimationToken !== token) return
          let finished = false
          let safetyTimer
          const finish = () => {
            if (finished || page.__routeAnimationToken !== token) return
            finished = true
            clearRememberedTimeout(page, safetyTimer)
            playNextLeg()
          }
          safetyTimer = rememberTimeout(page, finish, leg.durationMs + 220)
          try {
            mapContext.moveAlong({
              markerId: track.markerId,
              path: leg.path,
              autoRotate: true,
              duration: leg.durationMs,
              animationEnd: finish,
              fail: () => {
                if (!finished) fallback()
              }
            })
          } catch (error) {
            clearRememberedTimeout(page, safetyTimer)
            fallback()
          }
        })
      }

      playNextLeg()
    }

    playCycle()
  }

  tracks.forEach((track) => {
    const durationMs = getTrackDurationMs(track, options.durationMs || DEFAULT_DURATION_MS)
    const initialFraction = getAnimationFraction(0, durationMs, track.phase)
    playTrack(track, initialFraction)
  })
}

function startRouteAnimation(page, tracks, options = {}) {
  stopRouteAnimation(page)
  if (!page || !Array.isArray(tracks) || !tracks.length) return

  page.__routeAnimationTracks = tracks
  const token = page.__routeAnimationToken
  const canUseNativeAnimation = options.mapId && typeof wx !== 'undefined' && typeof wx.createMapContext === 'function'
  if (canUseNativeAnimation) {
    try {
      const mapContext = wx.createMapContext(options.mapId, page)
      if (mapContext && typeof mapContext.moveAlong === 'function') {
        page.__routeAnimationContext = mapContext
        startNativeRouteAnimation(page, tracks, mapContext, options, token)
        return
      }
    } catch (error) {
      // 低版本基础库使用下面的高帧率 setData 回退。
    }
  }

  startTimerRouteAnimation(page, tracks, options)
}

module.exports = {
  DEFAULT_DURATION_MS,
  TARGET_SPEED_KM_PER_SECOND,
  MIN_DURATION_MS,
  MAX_DURATION_MS,
  MIN_FRACTION,
  MAX_FRACTION,
  DEFAULT_FRAME_MS,
  getAnimationFraction,
  estimateTrackDistanceKm,
  getTrackDurationMs,
  getAdaptiveFrameMs,
  getAnimationPath,
  getNativeAnimationLegs,
  updateAnimatedMarkers,
  startRouteAnimation,
  stopRouteAnimation
}
