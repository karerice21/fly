const env = require('../config/env')
const { buildRouteGeometry } = require('../utils/route')

const STORAGE_KEY = 'flight_log_records_v1'

function loadLocal() {
  try {
    const data = wx.getStorageSync(STORAGE_KEY)
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

function saveLocal(items) {
  wx.setStorageSync(STORAGE_KEY, items)
}

function sortFlights(items) {
  return items.slice().sort((a, b) => {
    if (a.flightDate !== b.flightDate) return a.flightDate < b.flightDate ? 1 : -1
    return (b.createdAt || 0) - (a.createdAt || 0)
  })
}

function snapshot(airport) {
  return {
    _id: airport._id,
    iata: airport.iata || '',
    icao: airport.icao || '',
    name: airport.name,
    nameZh: airport.nameZh || '',
    city: airport.city || '',
    cityZh: airport.cityZh || '',
    countryCode: airport.countryCode,
    countryName: airport.countryName || '',
    lat: airport.lat,
    lng: airport.lng
  }
}

function buildRecord(input, existing) {
  if (!input.departure || !input.arrival || !input.flightDate) throw new Error('INVALID_ROUTE')
  if (input.departure._id === input.arrival._id) throw new Error('SAME_AIRPORT')
  const route = buildRouteGeometry(
    { latitude: input.departure.lat, longitude: input.departure.lng },
    { latitude: input.arrival.lat, longitude: input.arrival.lng }
  )
  const now = Date.now()
  return {
    _id: existing ? existing._id : `fl_${now}_${Math.random().toString(36).slice(2, 8)}`,
    flightDate: input.flightDate,
    departure: snapshot(input.departure),
    arrival: snapshot(input.arrival),
    flightNo: String(input.flightNo || '').trim().toUpperCase(),
    aircraft: String(input.aircraft || '').trim(),
    seat: String(input.seat || '').trim().toUpperCase(),
    note: String(input.note || '').trim().slice(0, 500),
    distanceKm: Math.round(route.distanceKm),
    routeType: 'great_circle',
    routeVersion: 1,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now
  }
}

async function callCloud(action, data) {
  const response = await wx.cloud.callFunction({
    name: 'flightService',
    data: Object.assign({ action }, data || {})
  })
  if (!response.result || response.result.ok === false) {
    const error = new Error((response.result && response.result.message) || 'DB_ERROR')
    error.code = response.result && response.result.errorCode
    throw error
  }
  return response.result.data
}

async function list(options = {}) {
  if (env.USE_CLOUD) {
    const requested = Math.max(1, Math.min(Number(options.limit) || 50, 500))
    const items = []
    let offset = 0
    while (items.length < requested) {
      const pageSize = Math.min(50, requested - items.length)
      const page = await callCloud('list', { year: options.year, limit: pageSize, offset })
      items.push(...(page.items || []))
      if (!page.hasMore || !page.items || !page.items.length) break
      offset += page.items.length
    }
    return items
  }
  const year = options.year && options.year !== '全部' ? String(options.year) : ''
  const items = sortFlights(loadLocal()).filter((item) => !year || item.flightDate.startsWith(year))
  return items.slice(0, options.limit || 500)
}

async function get(id) {
  if (env.USE_CLOUD) return callCloud('get', { id })
  return loadLocal().find((item) => item._id === id) || null
}

async function create(input) {
  if (env.USE_CLOUD) return callCloud('create', { input })
  const record = buildRecord(input)
  const items = loadLocal()
  items.push(record)
  saveLocal(items)
  return record
}

async function update(id, input) {
  if (env.USE_CLOUD) return callCloud('update', { id, input })
  const items = loadLocal()
  const index = items.findIndex((item) => item._id === id)
  if (index < 0) throw new Error('FLIGHT_NOT_FOUND')
  items[index] = buildRecord(input, items[index])
  saveLocal(items)
  return items[index]
}

async function remove(id) {
  if (env.USE_CLOUD) return callCloud('delete', { id })
  const items = loadLocal()
  const next = items.filter((item) => item._id !== id)
  if (next.length === items.length) throw new Error('FLIGHT_NOT_FOUND')
  saveLocal(next)
  return true
}

function calculateStats(items) {
  const airports = new Map()
  const countries = new Map()
  let totalDistanceKm = 0
  const collectAirport = (airport) => {
    if (!airport) return
    const airportId = airport._id || airport.iata || airport.icao
    if (airportId && !airports.has(airportId)) {
      airports.set(airportId, {
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
    if (countryKey && !countries.has(countryKey)) {
      countries.set(countryKey, { countryCode, countryName })
    }
  }
  items.forEach((item) => {
    totalDistanceKm += Number(item.distanceKm) || 0
    collectAirport(item.departure)
    collectAirport(item.arrival)
  })
  return {
    flights: items.length,
    distanceKm: Math.round(totalDistanceKm),
    airports: airports.size,
    countries: countries.size,
    airportItems: Array.from(airports.values()),
    regionItems: Array.from(countries.values())
  }
}

async function stats() {
  if (env.USE_CLOUD) return callCloud('stats')
  return calculateStats(loadLocal())
}

async function removeAll() {
  if (env.USE_CLOUD) return callCloud('deleteAll')
  saveLocal([])
  return true
}

async function loadDemo() {
  if (env.USE_CLOUD) throw new Error('DEMO_LOCAL_ONLY')
  // A failed read or an unknown storage format must never be treated as empty.
  const existing = wx.getStorageSync(STORAGE_KEY)
  if (existing && (!Array.isArray(existing) || existing.length)) throw new Error('DEMO_REQUIRES_EMPTY')
  // Build every record first, then write once. Never overwrite a user's journeys.
  const records = require('../data/demo-flights').map((input) => buildRecord(input))
  saveLocal(records)
  return records.length
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  stats,
  removeAll,
  loadDemo,
  calculateStats
}
