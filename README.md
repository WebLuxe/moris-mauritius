# Moris — Mauritius, shown off properly

An independent, unofficial showcase website for Mauritius.

**Live site:** https://webluxe.github.io/moris-mauritius/

## What's inside

- **Orbit-dive intro**: a WebGL Earth spins to Mauritius, the camera plunges in and the page opens through a portal onto the lagoon.
- **3D flyover built from the real coastline**: terrain, lagoon and reef generated from OpenStreetMap outline data, with Le Morne, Black River Peak and the central plateau in their true positions. The sky moves from day to golden hour as you scroll.
- **The Reel**: full-screen footage that bursts open clip by clip.
- **Particle morph**: thousands of particles form the word, the island, a dodo and the four-band flag.
- **Globe** with flight arcs from six cities, a **postcard deck**, a facts **ledger** and more.
- **Five pages**: Home, Explore (real-coordinate map), Heritage, Experiences, Plan your trip.
- **Liquid-wave page transitions**, a live Port Louis clock and temperature, and optional procedural ocean sound.
- **Device tiers**: budget phones automatically get lighter 3D and 640px videos.

## Run it locally

```bash
node server.js     # then open http://localhost:5173
```

On Windows you can double-click `start.bat`. A local server is needed (not `file://`) so the WebGL video and textures load.

## Credits

- Photos: [Unsplash](https://unsplash.com) (Unsplash License)
- Video footage: [Mixkit](https://mixkit.co) (Mixkit License)
- Earth imagery: NASA Blue Marble / Black Marble (public domain)
- Coastline: © OpenStreetMap contributors, via [geoBoundaries](https://www.geoboundaries.org) (ODbL)
- Live weather: [Open-Meteo](https://open-meteo.com)
- Libraries: three.js, GSAP + ScrollTrigger, Lenis

Not affiliated with the Government of Mauritius. Travel facts are a general guide; check official sources before travelling.
