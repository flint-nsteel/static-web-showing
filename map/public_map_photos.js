//Photo point layer for the PUBLIC map. Read-only: fetches the same GeoJSON
//the editor writes to, draws direction arrows, opens a popup on click, and
//exposes filter helpers that plug into your existing year/tag UI.
//
//usage in your main map page, after the map exists:
//
//  <script src="public_map_photos.js"></script>
//  <script>
//    map.on("load", () => addPhotoLayer(map, "https://poggiocivitate.net/api/photos"));
//    //later, from your year checkboxes:
//    setPhotoYearFilter(map, [1958, 1959, 1962]);   //or null for all years
//    setPhotoTagFilter(map, "north wall");          //or null for all tags
//  </script>

function makePhotoArrowImage() {
  const s = 64, c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(s * 0.44, s * 0.86); ctx.lineTo(s * 0.56, s * 0.86);
  ctx.lineTo(s * 0.56, s * 0.38); ctx.lineTo(s * 0.44, s * 0.38);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.10); ctx.lineTo(s * 0.76, s * 0.42);
  ctx.lineTo(s * 0.24, s * 0.42);
  ctx.closePath(); ctx.fill();
  return ctx.getImageData(0, 0, s, s);
}

const photoFilters = { years: null, tag: null };

function buildPhotoFilter() {
  const parts = ["all"];
  if (photoFilters.years && photoFilters.years.length) {
    parts.push(["in", ["get", "year"], ["literal", photoFilters.years]]);
  }
  if (photoFilters.tag) {
    parts.push(["in", photoFilters.tag, ["get", "tags"]]);
  }
  return parts.length > 1 ? parts : null;
}

function applyPhotoFilter(map) {
  map.setFilter("photo-points", buildPhotoFilter());
}

function setPhotoYearFilter(map, years) {
  photoFilters.years = years;
  applyPhotoFilter(map);
}

function setPhotoTagFilter(map, tag) {
  photoFilters.tag = tag;
  applyPhotoFilter(map);
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g,
    ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

async function addPhotoLayer(map, apiUrl) {
  if (!map.hasImage("photo-arrow")) {
    map.addImage("photo-arrow", makePhotoArrowImage(), { sdf: true });
  }

  //fetching once at load is fine; the layer only changes when someone edits
  const data = await fetch(apiUrl).then(r => r.json());
  map.addSource("photos", { type: "geojson", data });

  map.addLayer({
    id: "photo-points",
    type: "symbol",
    source: "photos",
    minzoom: 15,
    layout: {
      "icon-image": "photo-arrow",
      "icon-size": ["interpolate", ["linear"], ["zoom"], 15, 0.3, 19, 0.55],
      "icon-rotate": ["get", "rotation"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true
    },
    paint: {
      "icon-color": "#26221c"
    }
  });

  map.on("click", "photo-points", e => {
    const p = e.features[0].properties;
    //maplibre serialises array properties to json strings in events
    const tags = typeof p.tags === "string" ? JSON.parse(p.tags || "[]") : (p.tags || []);
    const html = `
      <div style="max-width:240px;font:13px/1.45 system-ui,sans-serif">
        ${p.year ? `<strong>${escapeHtml(p.year)}</strong><br>` : ""}
        ${escapeHtml(p.description)}
        ${tags.length ? `<div style="margin-top:4px;color:#7a7264;font-size:12px">${tags.map(escapeHtml).join(" &middot; ")}</div>` : ""}
        ${p.image_url ? `<div style="margin-top:6px"><a href="${escapeHtml(p.image_url)}" target="_blank" rel="noopener">View photograph</a></div>` : ""}
      </div>`;
    new maplibregl.Popup({ offset: 12 })
      .setLngLat(e.features[0].geometry.coordinates)
      .setHTML(html)
      .addTo(map);
  });
  map.on("mouseenter", "photo-points", () => map.getCanvas().style.cursor = "pointer");
  map.on("mouseleave", "photo-points", () => map.getCanvas().style.cursor = "");
}
