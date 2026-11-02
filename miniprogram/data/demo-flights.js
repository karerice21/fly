// Fictional journeys for local portfolio demos. Airport coordinates are from OurAirports.
const airports = {
  "PEK": {
    "_id": "PEK",
    "iata": "PEK",
    "icao": "ZBAA",
    "name": "Beijing Capital International Airport",
    "city": "Beijing",
    "countryCode": "CN",
    "countryName": "China",
    "lat": 40.077349,
    "lng": 116.596702,
    "nameZh": "北京首都国际机场",
    "cityZh": "北京"
  },
  "HND": {
    "_id": "HND",
    "iata": "HND",
    "icao": "RJTT",
    "name": "Tokyo Haneda International Airport",
    "city": "Tokyo",
    "countryCode": "JP",
    "countryName": "Japan",
    "lat": 35.549678,
    "lng": 139.786958,
    "nameZh": "东京羽田机场",
    "cityZh": "东京"
  },
  "LAX": {
    "_id": "LAX",
    "iata": "LAX",
    "icao": "KLAX",
    "name": "Los Angeles International Airport",
    "city": "Los Angeles",
    "countryCode": "US",
    "countryName": "United States",
    "lat": 33.942501,
    "lng": -118.407997,
    "nameZh": "洛杉矶国际机场",
    "cityZh": "洛杉矶"
  },
  "JFK": {
    "_id": "JFK",
    "iata": "JFK",
    "icao": "KJFK",
    "name": "John F. Kennedy International Airport",
    "city": "New York",
    "countryCode": "US",
    "countryName": "United States",
    "lat": 40.639447,
    "lng": -73.779317,
    "nameZh": "纽约肯尼迪国际机场",
    "cityZh": "纽约"
  },
  "LHR": {
    "_id": "LHR",
    "iata": "LHR",
    "icao": "EGLL",
    "name": "London Heathrow Airport",
    "city": "London",
    "countryCode": "GB",
    "countryName": "United Kingdom",
    "lat": 51.470748,
    "lng": -0.459909,
    "nameZh": "伦敦希思罗机场",
    "cityZh": "伦敦"
  },
  "CDG": {
    "_id": "CDG",
    "iata": "CDG",
    "icao": "LFPG",
    "name": "Charles de Gaulle International Airport",
    "city": "Paris (Roissy-en-France, Val-d'Oise)",
    "countryCode": "FR",
    "countryName": "France",
    "lat": 49.00896,
    "lng": 2.554117,
    "nameZh": "巴黎戴高乐机场",
    "cityZh": "巴黎"
  },
  "SIN": {
    "_id": "SIN",
    "iata": "SIN",
    "icao": "WSSS",
    "name": "Singapore Changi Airport",
    "city": "Singapore",
    "countryCode": "SG",
    "countryName": "Singapore",
    "lat": 1.35019,
    "lng": 103.994003,
    "nameZh": "新加坡樟宜机场",
    "cityZh": "新加坡"
  },
  "SYD": {
    "_id": "SYD",
    "iata": "SYD",
    "icao": "YSSY",
    "name": "Sydney Kingsford Smith International Airport",
    "city": "Sydney (Mascot)",
    "countryCode": "AU",
    "countryName": "Australia",
    "lat": -33.946098,
    "lng": 151.177002,
    "nameZh": "悉尼金斯福德史密斯机场",
    "cityZh": "悉尼"
  }
}

const journeys = [
  [
    "2025-06-12",
    "PEK",
    "HND"
  ],
  [
    "2025-06-19",
    "HND",
    "PEK"
  ],
  [
    "2025-12-08",
    "SIN",
    "SYD"
  ],
  [
    "2026-02-15",
    "PEK",
    "HND"
  ],
  [
    "2026-02-17",
    "HND",
    "LAX"
  ],
  [
    "2026-02-21",
    "LAX",
    "JFK"
  ],
  [
    "2026-02-25",
    "JFK",
    "LHR"
  ],
  [
    "2026-03-02",
    "LHR",
    "CDG"
  ]
]

module.exports = journeys.map(([flightDate, departure, arrival], index) => ({
  departure: airports[departure],
  arrival: airports[arrival],
  flightDate,
  flightNo: `DEMO${String(index + 1).padStart(3, '0')}`,
  note: '虚构示例旅程，仅用于演示；航班号不对应真实航班。'
}))
