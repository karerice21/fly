const flightService = require('../../services/flight.service')
const { buildRouteGeometry, getDirectionMarker } = require('../../utils/route')
const { startRouteAnimation, stopRouteAnimation } = require('../../utils/route-animation')
const { today } = require('../../utils/date')

Page({
  data: {
    id: '',
    isEditing: false,
    loading: false,
    form: {
      departure: null,
      arrival: null,
      flightDate: today(),
      flightNo: '',
      aircraft: '',
      seat: '',
      note: ''
    },
    valid: false,
    distanceKm: 0,
    polylines: [],
    markers: [],
    includePoints: [],
    mapCenter: { latitude: 30, longitude: 110 },
    mapScale: 2
  },

  async onLoad(options) {
    if (!options.id) return
    wx.setNavigationBarTitle({ title: '编辑飞行' })
    this.setData({ id: options.id, isEditing: true, loading: true })
    try {
      const flight = await flightService.get(options.id)
      if (!flight) throw new Error('FLIGHT_NOT_FOUND')
      this.setData({
        form: {
          departure: flight.departure,
          arrival: flight.arrival,
          flightDate: flight.flightDate,
          flightNo: flight.flightNo || '',
          aircraft: flight.aircraft || '',
          seat: flight.seat || '',
          note: flight.note || ''
        },
        loading: false
      })
      this.refreshRoute()
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: '记录不存在或无法读取', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1000)
    }
  },

  onShow() {
    if (this.__routeAnimationTracks && this.__routeAnimationTracks.length) {
      startRouteAnimation(this, this.__routeAnimationTracks, { mapId: 'route-preview-map' })
    }
  },

  onHide() {
    stopRouteAnimation(this)
  },

  onUnload() {
    stopRouteAnimation(this)
  },

  chooseAirport(event) {
    const role = event.currentTarget.dataset.role
    const opposite = role === 'departure' ? this.data.form.arrival : this.data.form.departure
    wx.navigateTo({
      url: `/pages/airport-search/index?role=${role}&exclude=${opposite ? opposite._id : ''}`,
      events: {
        airportSelected: (airport) => {
          this.setData({ [`form.${role}`]: airport })
          this.refreshRoute()
        }
      }
    })
  },

  swapAirports() {
    const departure = this.data.form.departure
    const arrival = this.data.form.arrival
    if (!departure && !arrival) return
    this.setData({
      'form.departure': arrival,
      'form.arrival': departure
    })
    this.refreshRoute()
  },

  onDateChange(event) {
    this.setData({ 'form.flightDate': event.detail.value })
    this.refreshValidity()
  },

  onFieldInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: event.detail.value })
  },

  refreshValidity() {
    const { departure, arrival, flightDate } = this.data.form
    this.setData({
      valid: Boolean(departure && arrival && flightDate && departure._id !== arrival._id)
    })
  },

  refreshRoute() {
    const { departure, arrival } = this.data.form
    this.refreshValidity()
    if (!departure || !arrival || departure._id === arrival._id) {
      stopRouteAnimation(this)
      this.__routeAnimationTracks = []
      this.setData({ distanceKm: 0, polylines: [], markers: [], includePoints: [] })
      return
    }
    try {
      const a = { latitude: departure.lat, longitude: departure.lng }
      const b = { latitude: arrival.lat, longitude: arrival.lng }
      const route = buildRouteGeometry(a, b)
      this.setData({
        distanceKm: Math.round(route.distanceKm),
        polylines: route.polylines.map((points) => ({
          points,
          color: '#2457E6',
          width: 2,
          borderWidth: 0
        })),
        markers: [
          { id: 1, ...a, width: 18, height: 18, callout: { content: departure.iata || departure.icao, display: 'ALWAYS', padding: 4, borderRadius: 6, bgColor: '#FFFFFFE8', color: '#172033', fontSize: 10 } },
          { id: 2, ...b, width: 18, height: 18, callout: { content: arrival.iata || arrival.icao, display: 'ALWAYS', padding: 4, borderRadius: 6, bgColor: '#FFFFFFE8', color: '#172033', fontSize: 10 } },
          getDirectionMarker(route.direction, {
            id: 3,
            title: `${departure.iata || departure.icao} → ${arrival.iata || arrival.icao}（方向标识，非实时位置）`
          })
        ],
        includePoints: [a, b]
      }, () => {
        this.__routeAnimationTracks = [{ markerId: 3, points: route.points, distanceKm: route.distanceKm, phase: 0 }]
        startRouteAnimation(this, this.__routeAnimationTracks, { mapId: 'route-preview-map' })
      })
    } catch (error) {
      stopRouteAnimation(this)
      this.__routeAnimationTracks = []
      this.setData({ valid: false, distanceKm: 0, polylines: [] })
      wx.showToast({ title: '航线生成失败，请重新选择机场', icon: 'none' })
    }
  },

  async save() {
    if (!this.data.valid || this.data.loading) return
    this.setData({ loading: true })
    try {
      if (this.data.isEditing) {
        await flightService.update(this.data.id, this.data.form)
      } else {
        await flightService.create(this.data.form)
      }
      wx.showToast({ title: this.data.isEditing ? '修改已保存' : '飞行已记录', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 700)
    } catch (error) {
      this.setData({ loading: false })
      const title = error.message === 'SAME_AIRPORT' ? '出发和到达机场不能相同' : '保存失败，请重试'
      wx.showToast({ title, icon: 'none' })
    }
  }
})
