const assert = require('assert')
const fs = require('fs')

const appConfig = JSON.parse(fs.readFileSync('miniprogram/app.json', 'utf8'))
const mapTemplate = fs.readFileSync('miniprogram/pages/map/index.wxml', 'utf8')
const flightsTemplate = fs.readFileSync('miniprogram/pages/flights/index.wxml', 'utf8')
const flightsStyles = fs.readFileSync('miniprogram/pages/flights/index.wxss', 'utf8')
const profileTemplate = fs.readFileSync('miniprogram/pages/profile/index.wxml', 'utf8')
const sourceFiles = [
  'miniprogram/pages/map/index.js',
  'miniprogram/pages/map/index.wxml',
  'miniprogram/pages/flight-edit/index.js',
  'miniprogram/pages/flight-edit/index.wxml',
  'miniprogram/pages/flight-detail/index.js',
  'miniprogram/pages/flight-detail/index.wxml'
].map((file) => fs.readFileSync(file, 'utf8')).join('\n')

assert(!appConfig.permission || !appConfig.permission['scope.userLocation'], 'MVP must not request user location permission')
assert(!mapTemplate.includes('show-location='), 'aggregate map must not enable the user-location layer')
assert(!/wx\.(getLocation|chooseLocation|openLocation)\s*\(/.test(sourceFiles), 'MVP must not call user-location APIs')
assert(flightsTemplate.includes('class="fab"') && !flightsTemplate.includes('<button wx:if="{{flights.length > 0}}" class="fab"'), 'record FAB should use a non-native circular view')
assert(/\.fab\s*\{[\s\S]*width:\s*104rpx;[\s\S]*height:\s*104rpx;[\s\S]*border-radius:\s*9999rpx;/.test(flightsStyles), 'record FAB must keep equal width, height and a circular radius')
assert(profileTemplate.includes('data-type="airports"') && profileTemplate.includes('data-type="regions"'), 'profile airport and region cards must be tappable')
assert(sourceFiles.includes("mapId: 'flight-map'") && mapTemplate.includes('id="flight-map"'), 'aggregate map should enable native marker path animation')

console.log('✓ config.test.js — 定位隐私、圆形记录按钮、可点击统计卡片与地图动画配置通过')
