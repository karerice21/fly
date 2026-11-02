const fs = require('fs')
const path = require('path')
const journeys = require('../miniprogram/data/demo-flights')
const { buildRouteGeometry } = require('../miniprogram/utils/route')

const project = (point) => [
  48 + (point.longitude + 180) / 360 * 1104,
  160 + (75 - point.latitude) / 150 * 290
]
const airportPoint = (airport) => ({ latitude: airport.lat, longitude: airport.lng })
const parts = []
const add = (svg) => parts.push(svg)
add('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="590" viewBox="0 0 1200 590" role="img" aria-labelledby="title desc">')
add('<title id="title">Flight Log — great-circle algorithm preview</title>')
add('<desc id="desc">Eight fictional journeys across eight airports. Routes use the project’s actual great-circle and dateline splitting functions. This is an algorithm illustration, not an application screenshot.</desc>')
add('<rect width="1200" height="590" rx="24" fill="#f5f8ff"/>')
add('<g font-family="Arial, sans-serif">')
add('<text x="48" y="50" fill="#2457e6" font-size="14" font-weight="700" letter-spacing="4">FLIGHT LOG / 微信飞行日志</text>')
add('<text x="48" y="99" fill="#172033" font-size="38" font-weight="700">Every journey connects.</text>')
add('<text x="48" y="129" fill="#64748b" font-size="17">Great-circle geometry · Shared round-trip routes · Dateline-safe rendering</text>')
add('<rect x="48" y="160" width="1104" height="290" rx="14" fill="#eaf0fc"/>')

for (let lon = -180; lon <= 180; lon += 60) {
  const x = project({ longitude: lon, latitude: 0 })[0]
  add(`<path d="M${x} 160V450" stroke="#d6e1f4" stroke-width="1"/>`)
  add(`<text x="${x}" y="472" text-anchor="${lon === -180 ? 'start' : lon === 180 ? 'end' : 'middle'}" fill="#8190a8" font-size="11">${lon}°</text>`)
}
for (let lat = -60; lat <= 60; lat += 30) {
  const y = project({ longitude: 0, latitude: lat })[1]
  add(`<path d="M48 ${y.toFixed(2)}H1152" stroke="#d6e1f4" stroke-width="1"/>`)
}

const routes = new Set()
const airports = new Map()
let distance = 0
journeys.forEach((flight) => {
  const route = buildRouteGeometry(airportPoint(flight.departure), airportPoint(flight.arrival))
  distance += Math.round(route.distanceKm)
  airports.set(flight.departure._id, flight.departure)
  airports.set(flight.arrival._id, flight.arrival)
  const key = [flight.departure._id, flight.arrival._id].sort().join('-')
  if (routes.has(key)) return
  routes.add(key)
  route.polylines.forEach((line) => {
    const points = line.map((point) => project(point).map((value) => value.toFixed(2)).join(',')).join(' ')
    add(`<polyline points="${points}" fill="none" stroke="#2457e6" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>`)
  })
})
airports.forEach((airport) => {
  const [x, y] = project(airportPoint(airport))
  const offsets = { LHR: [-32, -10], CDG: [10, 17], HND: [10, 17], PEK: [-34, -10] }
  const [dx, dy] = offsets[airport.iata] || [9, -10]
  add(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4.5" fill="#2457e6" stroke="white" stroke-width="2"/>`)
  add(`<text x="${(x + dx).toFixed(2)}" y="${(y + dy).toFixed(2)}" fill="#172033" font-size="12" font-weight="700">${airport.iata}</text>`)
})
const countries = new Set(Array.from(airports.values()).map((airport) => airport.countryCode))
add(`<text x="48" y="521" fill="#172033" font-size="22" font-weight="700">${journeys.length} flights</text>`)
add(`<text x="258" y="521" fill="#172033" font-size="22" font-weight="700">${airports.size} airports</text>`)
add(`<text x="478" y="521" fill="#172033" font-size="22" font-weight="700">${countries.size} countries / regions</text>`)
add(`<text x="820" y="521" fill="#2457e6" font-size="22" font-weight="700">${distance.toLocaleString('en-US')} km</text>`)
add('<text x="48" y="560" fill="#64748b" font-size="13">ALGORITHM PREVIEW · Fictional journeys · Equirectangular projection · Not an app screenshot or a real aircraft track</text>')
add('</g></svg>')
const output = path.resolve(__dirname, '../docs/assets/route-preview.svg')
fs.writeFileSync(output, parts.join('\n') + '\n')
console.log(`Generated ${path.relative(process.cwd(), output)} using the project’s route algorithms.`)
