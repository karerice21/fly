const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function rank(airport, query) {
  const normalized = normalize(query)
  const upper = query.toUpperCase()
  if (airport.iata === upper) return 1000
  if (airport.icao === upper) return 950
  const names = [airport.nameNormalized, airport.nameZh].filter(Boolean).map(normalize)
  const cities = [airport.cityNormalized, airport.cityZh].filter(Boolean).map(normalize)
  if (names.some((value) => value === normalized)) return 900
  if (names.some((value) => value.startsWith(normalized))) return 870
  if (names.some((value) => value.includes(normalized))) return 840
  if (cities.some((value) => value === normalized)) return 800
  if (cities.some((value) => value.startsWith(normalized))) return 770
  if (cities.some((value) => value.includes(normalized))) return 740
  if ((airport.iata || '').startsWith(upper)) return 680
  if ((airport.icao || '').startsWith(upper)) return 660
  const others = [airport.countryNormalized, airport.keywordsNormalized].filter(Boolean).map(normalize)
  return others.some((value) => value.includes(normalized)) ? 500 : 0
}

exports.main = async (event) => {
  if (event.id) {
    try {
      const response = await db.collection('airports').doc(String(event.id)).get()
      return { item: response.data && response.data.active !== false ? response.data : null }
    } catch (error) {
      return { item: null, errorCode: 'AIRPORT_NOT_FOUND' }
    }
  }

  const query = String(event.query || '').trim().slice(0, 64)
  const limit = Math.max(1, Math.min(Number(event.limit) || 20, 20))

  try {
    if (!query) {
      const response = await db.collection('airports')
        .orderBy('popular', 'desc')
        .limit(20)
        .get()
      return { items: response.data.filter((item) => item.active !== false).slice(0, Math.min(limit, 8)) }
    }

    const upper = query.toUpperCase()
    const codeLike = /^[A-Z0-9]+$/.test(upper)
    const tasks = []
    if (codeLike) {
      // Exact code queries can use the iata / icao single-field indexes.
      tasks.push(db.collection('airports').where({ iata: upper }).limit(5).get())
      tasks.push(db.collection('airports').where({ icao: upper }).limit(5).get())
      // Prefix fallback preserves the original one-character code-search behavior.
      tasks.push(db.collection('airports').where({ active: true, iata: db.RegExp({ regexp: `^${escapeRegExp(upper)}`, options: 'i' }) }).limit(20).get())
      tasks.push(db.collection('airports').where({ active: true, icao: db.RegExp({ regexp: `^${escapeRegExp(upper)}`, options: 'i' }) }).limit(20).get())
    }
    if (query.length >= 2) {
      const regexp = db.RegExp({ regexp: escapeRegExp(normalize(query)), options: 'i' })
      tasks.push(db.collection('airports').where({ active: true, nameNormalized: regexp }).limit(20).get())
      tasks.push(db.collection('airports').where({ active: true, cityNormalized: regexp }).limit(20).get())
      tasks.push(db.collection('airports').where({ active: true, nameZh: db.RegExp({ regexp: escapeRegExp(query), options: 'i' }) }).limit(20).get())
      tasks.push(db.collection('airports').where({ active: true, cityZh: db.RegExp({ regexp: escapeRegExp(query), options: 'i' }) }).limit(20).get())
      tasks.push(db.collection('airports').where({ active: true, countryNormalized: regexp }).limit(20).get())
      tasks.push(db.collection('airports').where({ active: true, keywordsNormalized: regexp }).limit(20).get())
    }

    const responses = await Promise.all(tasks)
    const unique = new Map()
    responses.forEach((response) => response.data.forEach((item) => unique.set(item._id, item)))
    const items = Array.from(unique.values())
      .map((airport) => ({ airport, score: rank(airport, query) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || (b.airport.popular || 0) - (a.airport.popular || 0))
      .slice(0, limit)
      .map((item) => item.airport)
    return { items }
  } catch (error) {
    console.error('airportSearch failed', error)
    return { items: [], errorCode: 'DB_ERROR' }
  }
}
