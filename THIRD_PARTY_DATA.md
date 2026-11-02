# Third-party airport data

## OurAirports

- Project: https://ourairports.com/
- Downloads: https://ourairports.com/data/
- Data dictionary: https://ourairports.com/help/data-dictionary.html
- Source files: `airports.csv`, `countries.csv`
- License: Public Domain
- Attribution requirement: none; attribution is included here for transparency.
- Disclaimer: the upstream project provides the data without a guarantee of accuracy or fitness for use.

The generated dataset contains 9,027 airport documents derived from 85,944 source airport rows on 2026-08-24. The build keeps passenger-relevant airports with valid coordinates and an IATA or ICAO code, and excludes closed airports, heliports, and balloonports. See `cloud-data/airports.meta.json` for the exact filter.

No bulk machine translation is applied. The small Chinese alias overlay in `miniprogram/data/airport-aliases.zh.js` preserves names that were already curated in the MVP; additional multilingual keywords, when present, come directly from OurAirports.
