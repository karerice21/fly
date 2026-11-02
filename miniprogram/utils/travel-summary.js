const REGION_NAME_OVERRIDES = {
  CN: '中国',
  HK: '中国香港',
  MO: '中国澳门',
  TW: '中国台湾'
}

function normalizeRegionName(countryCode, countryName) {
  const code = String(countryCode || '').trim().toUpperCase()
  if (REGION_NAME_OVERRIDES[code]) return REGION_NAME_OVERRIDES[code]

  const name = String(countryName || '').trim()
  const normalized = name.toLowerCase()
  if (normalized === 'hong kong' || name === '香港' || name === '中国香港') return '中国香港'
  if (normalized === 'macau' || normalized === 'macao' || name === '澳门' || name === '中国澳门') return '中国澳门'
  if (normalized === 'taiwan' || name === '台湾' || name === '中国台湾') return '中国台湾'
  if (normalized === 'china' || name === '中国') return '中国'
  return name || code || '未知国家 / 地区'
}

function airportCode(airport) {
  return airport.iata || airport.icao || airport._id || '—'
}

function buildTravelLists(stats) {
  const airports = (stats.airportItems || []).map((airport) => {
    const code = airportCode(airport)
    const city = airport.cityZh || airport.city || ''
    const region = normalizeRegionName(airport.countryCode, airport.countryName || airport.country)
    return {
      key: airport._id || code,
      code,
      title: airport.nameZh || airport.name || code,
      subtitle: [city, region].filter(Boolean).join(' · ')
    }
  }).sort((a, b) => a.code.localeCompare(b.code))

  const regions = (stats.regionItems || []).map((region) => ({
    key: region.countryCode || region.countryName,
    code: region.countryCode || '',
    title: normalizeRegionName(region.countryCode, region.countryName)
  })).sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))

  return { airports, regions }
}

module.exports = {
  REGION_NAME_OVERRIDES,
  normalizeRegionName,
  buildTravelLists
}
