const flightService = require('../../services/flight.service')
const { buildTravelLists } = require('../../utils/travel-summary')
const env = require('../../config/env')

Page({
  data: {
    loading: true,
    canLoadDemo: !env.USE_CLOUD,
    loadingDemo: false,
    stats: { flights: 0, distanceKm: 0, airports: 0, countries: 0 },
    displayDistance: '0',
    airportItems: [],
    regionItems: [],
    summaryPanel: { visible: false, title: '', items: [], type: '' }
  },

  onShow() {
    this.refresh()
  },

  async refresh() {
    try {
      let stats = await flightService.stats()
      if (!Array.isArray(stats.airportItems) || !Array.isArray(stats.regionItems)) {
        const flights = await flightService.list({ limit: 500 })
        const derived = flightService.calculateStats(flights)
        stats = { ...stats, airportItems: derived.airportItems, regionItems: derived.regionItems }
      }
      const lists = buildTravelLists(stats)
      this.setData({
        loading: false,
        stats,
        displayDistance: Number(stats.distanceKm || 0).toLocaleString(),
        airportItems: lists.airports,
        regionItems: lists.regions
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: '统计加载失败', icon: 'none' })
    }
  },

  openTravelSummary(event) {
    const type = event.currentTarget.dataset.type
    const isAirports = type === 'airports'
    const items = isAirports ? this.data.airportItems : this.data.regionItems
    if (!items.length) {
      wx.showToast({ title: '还没有飞行记录', icon: 'none' })
      return
    }
    this.setData({
      summaryPanel: {
        visible: true,
        title: isAirports ? '到访机场' : '国家 / 地区',
        items,
        type
      }
    })
  },

  closeTravelSummary() {
    this.setData({ 'summaryPanel.visible': false })
  },

  keepTravelSummaryOpen() {},

  loadDemo() {
    if (this.data.loadingDemo) return
    wx.showModal({
      title: '体验示例旅程',
      content: '添加 8 条虚构记录，体验跨年筛选、往返航线和跨太平洋路线。示例不代表真实出行，可随时删除。',
      confirmText: '添加示例',
      success: async (result) => {
        if (!result.confirm || this.data.loadingDemo) return
        this.setData({ loadingDemo: true })
        try {
          await flightService.loadDemo()
          await this.refresh()
          wx.showToast({ title: '示例旅程已添加', icon: 'success' })
        } catch (error) {
          wx.showToast({ title: error.message === 'DEMO_REQUIRES_EMPTY' ? '已有记录，未添加示例' : '示例添加失败', icon: 'none' })
        } finally {
          this.setData({ loadingDemo: false })
        }
      }
    })
  },

  showAboutRoute() {
    wx.showModal({
      title: '关于理论航线',
      content: '地图上的路线由出发与到达机场的经纬度按球面大圆路径计算，是稳定可重建的理论路线，不代表飞机当天的实际 ADS-B 轨迹。',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  showPrivacy() {
    wx.showModal({
      title: '数据与隐私',
      content: env.USE_CLOUD
        ? '飞行记录保存在此小程序配置的云环境中，通过当前微信用户标识隔离。本项目不申请定位、手机号、通讯录、头像或昵称权限。'
        : '飞行记录保存在当前设备的小程序缓存中，清除缓存后无法恢复。本项目不申请定位、手机号、通讯录、头像或昵称权限。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  removeAll() {
    if (!this.data.stats.flights) {
      wx.showToast({ title: '暂无可删除的数据', icon: 'none' })
      return
    }
    wx.showModal({
      title: '删除全部飞行数据？',
      content: `将永久删除 ${this.data.stats.flights} 条个人飞行记录，此操作无法恢复。`,
      confirmText: '继续删除',
      confirmColor: '#D94B60',
      success: (first) => {
        if (!first.confirm) return
        wx.showModal({
          title: '最后确认',
          content: '请再次确认：删除后地图、记录和统计都会被清空。',
          confirmText: '全部删除',
          confirmColor: '#D94B60',
          success: async (second) => {
            if (!second.confirm) return
            try {
              await flightService.removeAll()
              await this.refresh()
              wx.showToast({ title: '个人数据已清空', icon: 'success' })
            } catch (error) {
              wx.showToast({ title: '删除失败，请重试', icon: 'none' })
            }
          }
        })
      }
    })
  }
})
