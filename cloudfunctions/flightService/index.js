const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const flights = db.collection('flights')
const airports = db.collection('airports')
const EARTH_RADIUS_KM = 6371.0088

function ok(data) {
  return { ok: true, data }
}

function fail(errorCode, message) {
  return { ok: false, errorCode, message: message || errorCode }
}

function distanceKm(a, b) {
  const radians = (value) => value * Math.PI / 180
  const lat1 = radians(a.lat)
  const lat2 = radians(b.lat)
  const deltaLat = lat2 - lat1
  const deltaLng = radians(b.lng - a.lng)
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h)))))
}

function validateDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

function snapshot(airport) {
  const latitude = Number.isFinite(airport.latitude) ? airport.latitude : airport.lat
  const longitude = Number.isFinite(airport.longitude) ? airport.longitude : airport.lng
  return {
    _id: airport._id,
    iata: airport.iata || '',
    icao: airport.icao || '',
    name: airport.name,
    nameZh: airport.nameZh || '',
    city: airport.city || '',
    cityZh: airport.cityZh || '',
    countryCode: airport.countryCode,
    countryName: airport.countryName || airport.country || '',
    lat: latitude,
    lng: longitude
  }
}

async function getAirport(id) {
  if (!id) throw new Error('AIRPORT_NOT_FOUND')
  const result = await airports.doc(id).get()
  const airport = result.data
  const latitude = airport && (Number.isFinite(airport.latitude) ? airport.latitude : airport.lat)
  const longitude = airport && (Number.isFinite(airport.longitude) ? airport.longitude : airport.lng)
  if (!airport || airport.active === false || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('AIRPORT_NOT_FOUND')
  }
  return airport
}

async function buildPayload(input) {
  if (!input || !validateDate(input.flightDate)) throw new Error('INVALID_ROUTE')
  const departureId = input.departure && input.departure._id
  const arrivalId = input.arrival && input.arrival._id
  if (!departureId || !arrivalId || departureId === arrivalId) throw new Error('INVALID_ROUTE')
  const [departure, arrival] = await Promise.all([getAirport(departureId), getAirport(arrivalId)])
  return {
    flightDate: input.flightDate,
    departure: snapshot(departure),
    arrival: snapshot(arrival),
    flightNo: String(input.flightNo || '').trim().toUpperCase().slice(0, 12),
    aircraft: String(input.aircraft || '').trim().slice(0, 32),
    seat: String(input.seat || '').trim().toUpperCase().slice(0, 12),
    note: String(input.note || '').trim().slice(0, 500),
    distanceKm: distanceKm(
      { lat: Number.isFinite(departure.latitude) ? departure.latitude : departure.lat, lng: Number.isFinite(departure.longitude) ? departure.longitude : departure.lng },
      { lat: Number.isFinite(arrival.latitude) ? arrival.latitude : arrival.lat, lng: Number.isFinite(arrival.longitude) ? arrival.longitude : arrival.lng }
    ),
    routeType: 'great_circle',
    routeVersion: 1,
    updatedAt: db.serverDate()
  }
}

async function ensureOwned(id, openid) {
  const result = await flights.where({ _id: id, _openid: openid }).limit(1).get()
  if (!result.data.length) throw new Error('FLIGHT_NOT_FOUND')
  return result.data[0]
}

async function list(event, openid) {
  const limit = Math.max(1, Math.min(Number(event.limit) || 50, 50))
  const offset = Math.max(0, Math.min(Number(event.offset) || 0, 5000))
  const where = { _openid: openid }
  if (event.year && event.year !== '全部') {
    const year = String(event.year).slice(0, 4)
    where.flightDate = _.and(_.gte(`${year}-01-01`), _.lte(`${year}-12-31`))
  }
  const response = await flights.where(where)
    .orderBy('flightDate', 'desc')
    .orderBy('createdAt', 'desc')
    .skip(offset)
    .limit(limit + 1)
    .get()
  return ok({ items: response.data.slice(0, limit), hasMore: response.data.length > limit })
}

async function stats(openid) {
  const all = []
  let offset = 0
  while (offset < 5000) {
    const response = await flights.where({ _openid: openid }).skip(offset).limit(100).get()
    all.push(...response.data)
    if (response.data.length < 100) break
    offset += response.data.length
  }
  const airportItems = new Map()
  const regionItems = new Map()
  let totalDistance = 0
  const collectAirport = (airport) => {
    if (!airport) return
    const airportId = airport._id || airport.iata || airport.icao
    if (airportId && !airportItems.has(airportId)) {
      airportItems.set(airportId, {
        _id: airportId,
        iata: airport.iata || '',
        icao: airport.icao || '',
        name: airport.name || '',
        nameZh: airport.nameZh || '',
        city: airport.city || '',
        cityZh: airport.cityZh || '',
        countryCode: airport.countryCode || '',
        countryName: airport.countryName || airport.country || ''
      })
    }
    const countryCode = airport.countryCode || ''
    const countryName = airport.countryName || airport.country || ''
    const countryKey = countryCode || countryName
    if (countryKey && !regionItems.has(countryKey)) {
      regionItems.set(countryKey, { countryCode, countryName })
    }
  }
  all.forEach((flight) => {
    totalDistance += Number(flight.distanceKm) || 0
    collectAirport(flight.departure)
    collectAirport(flight.arrival)
  })
  return ok({
    flights: all.length,
    distanceKm: Math.round(totalDistance),
    airports: airportItems.size,
    countries: regionItems.size,
    airportItems: Array.from(airportItems.values()),
    regionItems: Array.from(regionItems.values())
  })
}

async function deleteAll(openid) {
  let deleted = 0
  while (true) {
    const response = await flights.where({ _openid: openid }).limit(100).get()
    if (!response.data.length) break
    await Promise.all(response.data.map((flight) => flights.doc(flight._id).remove()))
    deleted += response.data.length
  }
  return ok({ deleted })
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return fail('UNAUTHORIZED')
  const action = event.action

  try {
    if (action === 'list') return await list(event, OPENID)
    if (action === 'stats') return await stats(OPENID)
    if (action === 'deleteAll') return await deleteAll(OPENID)
    if (action === 'get') return ok(await ensureOwned(event.id, OPENID))

    if (action === 'create') {
      const payload = await buildPayload(event.input)
      const result = await flights.add({ data: { ...payload, _openid: OPENID, createdAt: db.serverDate() } })
      return ok({ _id: result._id, ...payload })
    }

    if (action === 'update') {
      await ensureOwned(event.id, OPENID)
      const payload = await buildPayload(event.input)
      await flights.doc(event.id).update({ data: payload })
      return ok({ _id: event.id, ...payload })
    }

    if (action === 'delete') {
      await ensureOwned(event.id, OPENID)
      await flights.doc(event.id).remove()
      return ok(true)
    }

    return fail('INVALID_ACTION')
  } catch (error) {
    console.error('flightService failed', action, error)
    const allowed = ['AIRPORT_NOT_FOUND', 'INVALID_ROUTE', 'FLIGHT_NOT_FOUND']
    return fail(allowed.includes(error.message) ? error.message : 'DB_ERROR')
  }
}
