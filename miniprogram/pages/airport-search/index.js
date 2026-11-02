const airportService = require('../../services/airport.service')

Page({
  data: {
    query: '',
    role: 'departure',
    exclude: '',
    loading: false,
    searched: false,
    airports: [],
    hint: '可搜索 IATA / ICAO / 城市 / 机场名'
  },

  onLoad(options) {
    const role = options.role === 'arrival' ? 'arrival' : 'departure'
    this.setData({ role, exclude: options.exclude || '' })
    wx.setNavigationBarTitle({ title: role === 'arrival' ? '选择到达机场' : '选择出发机场' })
    this.search('')
  },

  onUnload() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
  },

  onInput(event) {
    const query = event.detail.value
    this.setData({ query })
    if (this.searchTimer) clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(() => this.search(query), 300)
  },

  clearQuery() {
    this.setData({ query: '' })
    this.search('')
  },

  async search(query) {
    const requestId = Date.now()
    this.currentRequest = requestId
    this.setData({ loading: true })
    try {
      const items = await airportService.search(query, 20)
      if (this.currentRequest !== requestId) return
      this.setData({
        airports: items.filter((item) => item._id !== this.data.exclude),
        loading: false,
        searched: Boolean(String(query || '').trim()),
        hint: String(query || '').trim() ? '搜索结果' : '常用机场'
      })
    } catch (error) {
      if (this.currentRequest !== requestId) return
      this.setData({ loading: false, airports: [], searched: true })
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
  },

  selectAirport(event) {
    const airport = this.data.airports.find((item) => item._id === event.currentTarget.dataset.id)
    if (!airport) return
    const eventChannel = this.getOpenerEventChannel()
    eventChannel.emit('airportSelected', airport)
    wx.navigateBack()
  }
})
