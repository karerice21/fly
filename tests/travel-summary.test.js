const assert = require('assert')
const { normalizeRegionName, buildTravelLists } = require('../miniprogram/utils/travel-summary')

assert.strictEqual(normalizeRegionName('CN', 'China'), '中国')
assert.strictEqual(normalizeRegionName('HK', 'Hong Kong'), '中国香港')
assert.strictEqual(normalizeRegionName('MO', 'Macau'), '中国澳门')
assert.strictEqual(normalizeRegionName('TW', 'Taiwan'), '中国台湾')
assert.strictEqual(normalizeRegionName('', '香港'), '中国香港')
assert.strictEqual(normalizeRegionName('JP', 'Japan'), 'Japan')

const lists = buildTravelLists({
  airportItems: [
    { _id: 'HKG', iata: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', countryCode: 'HK', countryName: 'Hong Kong' },
    { _id: 'PEK', iata: 'PEK', name: 'Beijing Capital International Airport', nameZh: '北京首都国际机场', cityZh: '北京', countryCode: 'CN', countryName: 'China' }
  ],
  regionItems: [
    { countryCode: 'TW', countryName: 'Taiwan' },
    { countryCode: 'MO', countryName: 'Macau' },
    { countryCode: 'HK', countryName: 'Hong Kong' }
  ]
})

assert.deepStrictEqual(lists.airports.map((item) => item.code), ['HKG', 'PEK'])
assert(lists.airports[0].subtitle.includes('中国香港'))
assert.deepStrictEqual(lists.regions.map((item) => item.title).sort(), ['中国台湾', '中国澳门', '中国香港'].sort())

console.log('✓ travel-summary.test.js — 到访机场清单与中国香港、中国澳门、中国台湾命名通过')
