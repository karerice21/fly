const flightService = require('../../services/flight.service')
const { formatChinese } = require('../../utils/date')

function decorate(flight) {
  return {
    ...flight,
    displayDate: formatChinese(flight.flightDate),
    displayDistance: Number(flight.distanceKm || 0).toLocaleString()
  }
}

Page({
  data: {
    loading: true,
    flights: [],
    yearOptions: ['全部'],
    yearIndex: 0,
    selectedYear: '全部'
  },

  onShow() {
    this.refresh()
  },

  onPullDownRefresh() {
    this.refresh().finally(() => wx.stopPullDownRefresh())
  },

  async refresh() {
    this.setData({ loading: true })
    try {
      const allFlights = await flightService.list({ limit: 500 })
      const yearOptions = ['全部'].concat(Array.from(new Set(allFlights.map((item) => item.flightDate.slice(0, 4))))
        .sort((a, b) => Number(b) - Number(a)))
      let selectedYear = this.data.selectedYear
      if (!yearOptions.includes(selectedYear)) selectedYear = '全部'
      const flights = (selectedYear === '全部'
        ? allFlights
        : allFlights.filter((item) => item.flightDate.startsWith(selectedYear)))
        .map(decorate)
      this.setData({
        loading: false,
        flights,
        yearOptions,
        selectedYear,
        yearIndex: yearOptions.indexOf(selectedYear)
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: '记录加载失败，请重试', icon: 'none' })
    }
  },

  onYearChange(event) {
    const yearIndex = Number(event.detail.value)
    this.setData({ yearIndex, selectedYear: this.data.yearOptions[yearIndex] })
    this.refresh()
  },

  addFlight() {
    wx.navigateTo({ url: '/pages/flight-edit/index' })
  },

  openFlight(event) {
    wx.navigateTo({ url: `/pages/flight-detail/index?id=${event.currentTarget.dataset.id}` })
  }
})
