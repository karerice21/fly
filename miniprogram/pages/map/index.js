const flightService = require('../../services/flight.service')
const { buildRouteGeometry, getRouteDirection, getDirectionMarker } = require('../../utils/route')
const { startRouteAnimation, stopRouteAnimation } = require('../../utils/route-animation')

function airportPoint(airport) {
  return { latitude: airport.lat, longitude: airport.lng }
}

function airportCode(airport) {
  return airport.iata || airport.icao || airport._id
}

Page({
  data: {
    loading: true,
    yearOptions: ['全部'],
    yearIndex: 0,
    selectedYear: '全部',
    flights: [],
    markers: [],
    polylines: [],
    includePoints: [],
    stats: { flights: 0, distanceKm: 0, airports: 0, countries: 0 },
    mapCenter: { latitude: 28, longitude: 110 },
    mapScale: 2
  },

  onShow() {
    this.refresh()
  },

  onHide() {
    stopRouteAnimation(this)
  },

  onUnload() {
    stopRouteAnimation(this)
  },

  onPullDownRefresh() {
    this.refresh().finally(() => wx.stopPullDownRefresh())
  },

  async refresh() {
    this.setData({ loading: true })
    try {
      const allFlights = await flightService.list({ limit: 500 })
      const years = Array.from(new Set(allFlights.map((item) => item.flightDate.slice(0, 4))))
        .sort((a, b) => Number(b) - Number(a))
      const yearOptions = ['全部'].concat(years)
      let selectedYear = this.data.selectedYear
      if (!yearOptions.includes(selectedYear)) selectedYear = '全部'
      const flights = selectedYear === '全部'
        ? allFlights
        : allFlights.filter((item) => item.flightDate.startsWith(selectedYear))
      this.renderFlights(flights, yearOptions, selectedYear)
    } catch (error) {
      wx.showToast({ title: '记录加载失败，请重试', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  renderFlights(flights, yearOptions, selectedYear) {
    const routeKeys = new Set()
    const airportMap = new Map()
    const directedRoutes = new Map()
    const polylines = []
    const includePoints = []
    const animationTracks = []

    flights.forEach((flight) => {
      airportMap.set(flight.departure._id || flight.departure.iata, flight.departure)
      airportMap.set(flight.arrival._id || flight.arrival.iata, flight.arrival)
      const departureCode = airportCode(flight.departure)
      const arrivalCode = airportCode(flight.arrival)
      const routeKey = [departureCode, arrivalCode].sort().join('-')
      const directedKey = `${departureCode}>${arrivalCode}`
      if (!directedRoutes.has(routeKey)) directedRoutes.set(routeKey, new Map())
      directedRoutes.get(routeKey).set(directedKey, flight)
      if (routeKeys.has(routeKey)) return
      routeKeys.add(routeKey)
      try {
        const route = buildRouteGeometry(airportPoint(flight.departure), airportPoint(flight.arrival))
        route.polylines.forEach((points) => {
          polylines.push({
            points,
            color: '#2457E6CC',
            width: 2,
            borderWidth: 0
          })
        })
      } catch (error) {
        // 单条历史异常不阻塞其他路线展示。
      }
    })

    const markers = Array.from(airportMap.values()).map((airport, index) => {
      const point = airportPoint(airport)
      includePoints.push(point)
      return {
        id: index + 1,
        ...point,
        width: 20,
        height: 20,
        anchor: { x: 0.5, y: 0.5 },
        callout: {
          content: airportCode(airport),
          color: '#172033',
          fontSize: 11,
          borderRadius: 7,
          bgColor: '#FFFFFFEE',
          padding: 5,
          display: 'BYCLICK'
        }
      }
    })

    let directionId = 10000
    directedRoutes.forEach((directions) => {
      const hasReverseDirection = directions.size > 1
      let directionIndex = 0
      directions.forEach((flight) => {
        try {
          const route = buildRouteGeometry(airportPoint(flight.departure), airportPoint(flight.arrival))
          // 往返同时存在时用半周期错位，避免两个动态尖头长期重叠。
          const phase = hasReverseDirection ? directionIndex * 0.5 : (animationTracks.length * 0.17) % 1
          const direction = getRouteDirection(route.points, 0.5)
          markers.push(getDirectionMarker(direction, {
            id: directionId,
            title: `${airportCode(flight.departure)} → ${airportCode(flight.arrival)}（方向标识，非实时位置）`
          }))
          animationTracks.push({ markerId: directionId, points: route.points, distanceKm: route.distanceKm, phase })
          directionId += 1
          directionIndex += 1
        } catch (error) {
          // 方向标识失败不影响原有路线与记录展示。
        }
      })
    })

    const stats = flightService.calculateStats(flights)
    this.__routeAnimationTracks = animationTracks
    this.setData({
      loading: false,
      flights,
      markers,
      polylines,
      includePoints,
      stats,
      yearOptions,
      yearIndex: yearOptions.indexOf(selectedYear),
      selectedYear
    }, () => startRouteAnimation(this, animationTracks, { mapId: 'flight-map' }))
  },

  onYearChange(event) {
    const yearIndex = Number(event.detail.value)
    const selectedYear = this.data.yearOptions[yearIndex]
    this.setData({ yearIndex, selectedYear })
    this.refresh()
  },

  addFlight() {
    wx.navigateTo({ url: '/pages/flight-edit/index' })
  },

  goToFlights() {
    wx.switchTab({ url: '/pages/flights/index' })
  }
})
