function pad(value) {
  return String(value).padStart(2, '0')
}

function today() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function formatChinese(dateString) {
  if (!dateString) return ''
  const parts = dateString.split('-')
  if (parts.length !== 3) return dateString
  return `${Number(parts[0])}年${Number(parts[1])}月${Number(parts[2])}日`
}

function yearOf(dateString) {
  return String(dateString || '').slice(0, 4)
}

module.exports = {
  today,
  formatChinese,
  yearOf
}
