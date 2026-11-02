const env = require('../config/env')
const localData = require('../data/airports')

function decodeLocalAirport(row) {
  if (!Array.isArray(row)) return row
  return {
    _id: row[0],
    iata: row[1],
    icao: row[2],
    name: row[3],
    city: row[4],
    countryCode: row[5],
    country: localData.countries[row[5]] || row[5],
    latitude: row[6],
    longitude: row[7],
    altitude: row[8],
    region: row[9],
    type: row[10],
    scheduledService: row[11] === 1,
    keywords: row[12],
    nameZh: row[13],
    cityZh: row[14],
    popular: row[15]
  }
}

// This service is required only by the airport-search page. Other pages never parse the global dataset.
const airports = Array.isArray(localData) ? localData : localData.airports.map(decodeLocalAirport)

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s.,/#!$%^&*;:{}=\-_`~()'"\[\]\\]+/g, ' ')
    .trim()
}

function normalizedText(airport) {
  return [airport.iata, airport.icao, airport.name, airport.nameZh, airport.city, airport.cityZh, airport.country, airport.countryName, airport.keywords]
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function toAppAirport(airport) {
  if (!airport) return null
  const latitude = Number.isFinite(airport.latitude) ? airport.latitude : airport.lat
  const longitude = Number.isFinite(airport.longitude) ? airport.longitude : airport.lng
  return {
    ...airport,
    country: airport.country || airport.countryName || '',
    countryName: airport.countryName || airport.country || '',
    latitude,
    longitude,
    lat: latitude,
    lng: longitude
  }
}

function rankAirport(airport, rawQuery) {
  const query = normalize(rawQuery)
  const upper = query.toUpperCase()
  if (airport.iata === upper) return 1000
  if (airport.icao === upper) return 950

  const names = [airport.nameZh, airport.name].filter(Boolean).map(normalize)
  const cities = [airport.cityZh, airport.city].filter(Boolean).map(normalize)
  if (names.some((item) => item === query)) return 900
  if (names.some((item) => item.startsWith(query))) return 870
  if (names.some((item) => item.includes(query))) return 840
  if (cities.some((item) => item === query)) return 800
  if (cities.some((item) => item.startsWith(query))) return 770
  if (cities.some((item) => item.includes(query))) return 740
  if ((airport.iata || '').startsWith(upper)) return 680
  if ((airport.icao || '').startsWith(upper)) return 660
  if (normalizedText(airport).includes(query)) return 500
  return 0
}

async function searchLocal(query, limit) {
  const trimmed = String(query || '').trim()
  if (!trimmed) {
    return airports.slice(0, Math.min(limit, 8)).map(toAppAirport)
  }
  const isCodeLike = /^[a-zA-Z0-9]+$/.test(trimmed)
  if (!isCodeLike && trimmed.length < 2) return []

  return airports
    .map((airport) => ({ airport, score: rankAirport(airport, trimmed) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.airport.popular - a.airport.popular)
    .slice(0, limit)
    .map((item) => toAppAirport(item.airport))
}

async function search(query, limit = 20) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 20))
  if (env.USE_CLOUD) {
    const result = await wx.cloud.callFunction({
      name: 'airportSearch',
      data: { query: String(query || ''), limit: safeLimit }
    })
    return (result.result.items || []).map(toAppAirport)
  }
  return searchLocal(query, safeLimit)
}

async function getById(id) {
  if (!id) return null
  if (env.USE_CLOUD) {
    const result = await wx.cloud.callFunction({ name: 'airportSearch', data: { id } })
    return toAppAirport(result.result && result.result.item)
  }
  return toAppAirport(airports.find((item) => item._id === id) || null)
}

module.exports = {
  search,
  getById
}
