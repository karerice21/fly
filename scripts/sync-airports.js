const fs = require('fs')
const https = require('https')
const path = require('path')

const AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv'
const COUNTRIES_URL = 'https://davidmegginson.github.io/ourairports-data/countries.csv'
const VALID_TYPES = new Set(['large_airport', 'medium_airport', 'small_airport', 'seaplane_base'])
const projectRoot = path.join(__dirname, '..')

function getArgument(name) {
  const prefix = `--${name}=`
  const argument = process.argv.find((value) => value.startsWith(prefix))
  return argument ? argument.slice(prefix.length) : ''
}

function download(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error(`Too many redirects for ${url}`))
    const request = https.get(url, { headers: { 'User-Agent': 'flight-log-airport-sync/1.0', 'Accept-Encoding': 'identity' } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume()
        return resolve(download(new URL(response.headers.location, url).toString(), redirectCount + 1))
      }
      if (response.statusCode !== 200) {
        response.resume()
        return reject(new Error(`Download failed (${response.statusCode}): ${url}`))
      }
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
    request.setTimeout(120000, () => request.destroy(new Error(`Download timed out: ${url}`)))
    request.on('error', reject)
  })
}

function parseCsv(source) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
    } else if (character === '"') {
      quoted = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''))
      rows.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''))
    rows.push(row)
  }

  const headers = rows.shift()
  return rows.filter((values) => values.length > 1).map((values) => {
    const record = {}
    headers.forEach((header, index) => { record[header] = values[index] || '' })
    return record
  })
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function calculatePopularity(record) {
  const typeScore = { large_airport: 300, medium_airport: 200, small_airport: 100, seaplane_base: 50 }
  return (typeScore[record.type] || 0) + (record.scheduled_service === 'yes' ? 100 : 0) + (record.iata_code ? 50 : 0)
}

function buildAirport(record, countries, aliases) {
  const latitude = Number(record.latitude_deg)
  const longitude = Number(record.longitude_deg)
  const iata = String(record.iata_code || '').trim().toUpperCase()
  const icao = String(record.icao_code || '').trim().toUpperCase()
  const alias = aliases[iata] || {}
  const countryCode = String(record.iso_country || '').trim().toUpperCase()
  const altitude = record.elevation_ft === '' ? null : Number(record.elevation_ft)
  const airport = {
    _id: `oa_${record.id}`,
    ourAirportsId: Number(record.id),
    iata,
    icao,
    name: record.name,
    city: record.municipality || '',
    country: countries[countryCode] || countryCode,
    countryCode,
    latitude,
    longitude,
    altitude: Number.isFinite(altitude) ? altitude : null,
    region: record.iso_region || '',
    type: record.type,
    scheduledService: record.scheduled_service === 'yes',
    keywords: record.keywords || '',
    popular: calculatePopularity(record)
  }
  if (alias.nameZh) airport.nameZh = alias.nameZh
  if (alias.cityZh) airport.cityZh = alias.cityZh
  return airport
}

function shouldInclude(record) {
  const latitude = Number(record.latitude_deg)
  const longitude = Number(record.longitude_deg)
  const hasCode = Boolean(String(record.iata_code || '').trim() || String(record.icao_code || '').trim())
  const passengerRelevant = record.scheduled_service === 'yes' || Boolean(String(record.iata_code || '').trim())
  return VALID_TYPES.has(record.type) && hasCode && passengerRelevant &&
    Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
}

function buildCloudRecord(airport) {
  return {
    ...airport,
    nameNormalized: normalize([airport.name, airport.nameZh].filter(Boolean).join(' ')),
    cityNormalized: normalize([airport.city, airport.cityZh].filter(Boolean).join(' ')),
    countryNormalized: normalize(airport.country),
    keywordsNormalized: normalize(airport.keywords),
    active: true,
    source: 'OurAirports'
  }
}

async function loadSource(filePath, url) {
  if (filePath) return fs.readFileSync(path.resolve(filePath), 'utf8')
  process.stdout.write(`Downloading ${url}\n`)
  return download(url)
}

async function main() {
  const airportsCsv = await loadSource(getArgument('airports-csv'), AIRPORTS_URL)
  const countriesCsv = await loadSource(getArgument('countries-csv'), COUNTRIES_URL)
  const countryRows = parseCsv(countriesCsv)
  const countries = Object.fromEntries(countryRows.map((record) => [record.code, record.name]))
  const aliases = require('../miniprogram/data/airport-aliases.zh')
  const sourceRows = parseCsv(airportsCsv)
  const airports = sourceRows
    .filter(shouldInclude)
    .map((record) => buildAirport(record, countries, aliases))
    .sort((a, b) => b.popular - a.popular || a.name.localeCompare(b.name, 'en'))

  // Preserve the MVP's IATA-based document IDs so existing flight snapshots remain editable.
  // In the rare case of a duplicate code, fall back to the stable OurAirports numeric ID.
  const usedIds = new Set()
  airports.forEach((airport) => {
    const candidates = [airport.iata, airport.icao, `oa_${airport.ourAirportsId}`].filter(Boolean)
    airport._id = candidates.find((candidate) => !usedIds.has(candidate))
    usedIds.add(airport._id)
  })

  const localOutput = path.join(projectRoot, 'miniprogram', 'data', 'airports.js')
  const cloudOutput = path.join(projectRoot, 'cloud-data', 'airports.json')
  const metadataOutput = path.join(projectRoot, 'cloud-data', 'airports.meta.json')
  fs.mkdirSync(path.dirname(cloudOutput), { recursive: true })

  const localCountries = {}
  airports.forEach((airport) => { localCountries[airport.countryCode] = airport.country })
  const compactLocalData = {
    schemaVersion: 1,
    // Row: id, iata, icao, name, city, countryCode, latitude, longitude,
    // altitude, region, type, scheduledService, keywords, nameZh, cityZh, popular.
    countries: localCountries,
    airports: airports.map((airport) => [
      airport._id, airport.iata, airport.icao, airport.name, airport.city,
      airport.countryCode, airport.latitude, airport.longitude, airport.altitude,
      airport.region, airport.type, airport.scheduledService ? 1 : 0, airport.keywords,
      airport.nameZh || '', airport.cityZh || '', airport.popular
    ])
  }
  fs.writeFileSync(localOutput, `// Generated by scripts/sync-airports.js. Do not edit by hand.\nmodule.exports=${JSON.stringify(compactLocalData)}\n`)
  fs.writeFileSync(cloudOutput, airports.map((airport) => JSON.stringify(buildCloudRecord(airport))).join('\n') + '\n')
  fs.writeFileSync(metadataOutput, JSON.stringify({
    source: 'OurAirports',
    sourceUrls: { airports: AIRPORTS_URL, countries: COUNTRIES_URL },
    license: 'Public Domain',
    generatedAt: new Date().toISOString(),
    sourceAirportRows: sourceRows.length,
    importedAirports: airports.length,
    filter: 'large/medium/small/seaplane; valid coordinates; scheduled_service=yes or IATA present; IATA or ICAO present; excludes closed airports, heliports and balloonports',
    notes: 'English names come from OurAirports. A small curated Chinese alias overlay preserves the project’s existing airport names; no bulk machine translation is used. Unique IATA codes remain document IDs for backward compatibility; duplicates fall back to ICAO or oa_<source id>.'
  }, null, 2) + '\n')

  process.stdout.write(`Generated ${airports.length} airports from ${sourceRows.length} source rows.\n`)
  process.stdout.write(`${localOutput}\n${cloudOutput}\n${metadataOutput}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
