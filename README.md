# NEO-Guardian

**Real-time Asteroid Proximity & Risk Analysis Dashboard**

Live at: [https://nasa-project-beige.vercel.app](https://nasa-project-beige.vercel.app)

---

## What is this?

NEO-Guardian tracks Near-Earth Objects (NEOs) — asteroids and comets that pass close to Earth — using real data from NASA's Small-Body Database APIs. It goes beyond raw data by computing a custom **Impact Hazard Score** for every object and presenting everything in a dark, mission-control-style dashboard.

---

## Features

- **Live NASA data** — fetches close approach data (next 6 months, within 0.05 AU) and impact risk data from NASA's CAD and Sentry APIs, refreshed every 12 hours via Incremental Static Regeneration (ISR)
- **Custom risk scoring** — each asteroid is scored and categorized as Safe, Watchlist, or Critical based on its mass, velocity, and miss distance
- **Interactive filters** — filter by minimum diameter and risk category in real time
- **Three data visualizations:**
  - Close approaches over time (line chart)
  - Object size distribution (bar chart)
  - Risk radar — velocity vs. miss distance scatter plot
- **Sortable data table** — click any column header to sort by date, distance, velocity, size, or risk score
- **Methodology section** — explains the science and math behind the risk scoring, in plain language

---

## The Science

Each asteroid gets an **Impact Hazard Score** based on:

```
Score = log₁₀( (Mass × Velocity) / Distance² + 1 )
```

- **Mass** is estimated from the object's absolute magnitude (brightness) using the standard formula used by planetary scientists
- **Velocity** is relative velocity at closest approach, in m/s
- **Distance** is the miss distance from Earth, in meters

| Score | Category |
|-------|----------|
| ≥ 3.0 | Critical |
| ≥ 1.5 | Watchlist |
| < 1.5 | Safe |

> Most objects are Safe — Critical only means "worth watching closely", not "imminent impact".

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS v3 |
| Charts | Recharts |
| Icons | Lucide React |
| Font | Geist (by Vercel) |
| Data | NASA CAD API + NASA Sentry API |
| Hosting | Vercel |

---

## How it works

1. On every page load (or every 12 hours), a **Next.js Server Component** calls NASA's APIs via backend proxy routes — no NASA API calls ever come from the browser
2. Raw data is cleaned and normalized: NASA's custom date format is converted to ISO 8601, diameters are estimated from magnitude when not directly measured, and the risk score is computed for every object
3. The processed data is passed to a **React Client Component** that handles filtering and renders the charts and table

---

## Running locally

```bash
git clone https://github.com/Tamir-Jhirad/nasa-project.git
cd nasa-project
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

No API key required — NASA's SSD APIs are free and public.

---

## Data sources

- [NASA Small-Body Close Approach Data (CAD)](https://ssd-api.jpl.nasa.gov/doc/cad.html)
- [NASA Sentry Impact Risk System](https://ssd-api.jpl.nasa.gov/doc/sentry.html)

---

*Built as a portfolio project to demonstrate full-stack development, data engineering, and scientific computing skills.*
