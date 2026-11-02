const flightService = require('../../services/flight.service')
const { buildRouteGeometry, getDirectionMarker } = require('../../utils/route')
const { startRouteAnimation, stopRouteAnimation } = require('../../utils/route-animation')
const { formatChinese } = require('../../utils/date')

Page({
  data: {
    id: '',
    loading: true,
    flight: null,
    displayDate: '',
    displayDistance: '',
    polylines: [],
    markers: [],
    includePoints: [],
    mapCenter: { latitude: 30, longitude: 110 },
    mapScale: 2
  },

  onLoad(options) {
    this.setData({ id: options.id || '' })
  },

  onShow() {
    if (this.data.id) this.refresh()
  },

  onHide() {
    stopRouteAnimation(this)
  },

  onUnload() {
    stopRouteAnimation(this)
  },

  async refresh() {
    this.setData({ loading: true })
    try {
      const flight = await flightService.get(this.data.id)
      if (!flight) throw new Error('FLIGHT_NOT_FOUND')
      const departure = { latitude: flight.departure.lat, longitude: flight.departure.lng }
      const arrival = { latitude: flight.arrival.lat, longitude: flight.arrival.lng }
      const route = buildRouteGeometry(departure, arrival)
      this.setData({
        loading: false,
        flight,
        displayDate: formatChinese(flight.flightDate),
        displayDistance: Number(flight.distanceKm).toLocaleString(),
        polylines: route.polylines.map((points) => ({
          points,
          color: '#2457E6',
          width: 2,
          borderWidth: 0
        })),
        markers: [
          { id: 1, ...departure, width: 19, height: 19, callout: { content: flight.departure.iata || flight.departure.icao, display: 'ALWAYS', padding: 5, borderRadius: 7, bgColor: '#FFFFFFEE', color: '#172033', fontSize: 11 } },
          { id: 2, ...arrival, width: 19, height: 19, callout: { content: flight.arrival.iata || flight.arrival.icao, display: 'ALWAYS', padding: 5, borderRadius: 7, bgColor: '#FFFFFFEE', color: '#172033', fontSize: 11 } },
          getDirectionMarker(route.direction, {
            id: 3,
            title: `${flight.departure.iata || flight.departure.icao} → ${flight.arrival.iata || flight.arrival.icao}（方向标识，非实时位置）`
          })
        ],
        includePoints: [departure, arrival]
      }, () => {
        this.__routeAnimationTracks = [{ markerId: 3, points: route.points, distanceKm: route.distanceKm, phase: 0 }]
        startRouteAnimation(this, this.__routeAnimationTracks, { mapId: 'flight-detail-map' })
      })
    } catch (error) {
      stopRouteAnimation(this)
      this.__routeAnimationTracks = []
      this.setData({ loading: false })
      wx.showToast({ title: '记录不存在或已删除', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 900)
    }
  },

  editFlight() {
    wx.navigateTo({ url: `/pages/flight-edit/index?id=${this.data.id}` })
  },

  deleteFlight() {
    wx.showModal({
      title: '删除这条飞行记录？',
      content: '删除后无法恢复，地图与统计也会同步更新。',
      confirmText: '删除',
      confirmColor: '#D94B60',
      success: async (result) => {
        if (!result.confirm) return
        try {
          await flightService.remove(this.data.id)
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 650)
        } catch (error) {
          wx.showToast({ title: '删除失败，请重试', icon: 'none' })
        }
      }
    })
  }
})
