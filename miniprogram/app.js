const env = require('./config/env')

App({
  onLaunch() {
    if (env.USE_CLOUD && wx.cloud) {
      wx.cloud.init({
        env: env.CLOUD_ENV || undefined,
        traceUser: true
      })
    }
  },
  globalData: {
    appName: '飞行日志'
  }
})
