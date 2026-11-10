# Browser AMAN on vatIRIS

The frontend deployment builds the standalone SAAMAN browser editor from the exact commit pinned in `scripts/build-saaman-browser.mjs`, then publishes it at **https://vatiris.se/aman/index.html**. Its relative assets stay below `/aman/`; no SAAMAN UI source or generated bundles are stored in this repository.

The normal vatIRIS build runs first. A missing pin, checkout failure or SAAMAN build failure stops deployment before S3 synchronization. The vatIRIS service worker excludes `/aman/` from its navigation fallback and precache.

Update the pin after testing a new SAAMAN browser build. Keep an active SAAMAN EuroScope sequencer online; the browser only sends controller edits and cannot calculate the sequence. Connecting uses an existing online EuroScope callsign and requires no second VATSIM connection.

Use the explicit `/aman/index.html` address: this does not rely on S3/CloudFront directory-index rewrites or add a vatIRIS SPA route. The hosting change is independent of the TopSky public-feed change.
