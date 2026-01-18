const mccBounds = L.latLngBounds(
  [12.9218, 80.1168],
  [12.9288, 80.1248]
);

const map = L.map("map", {
  center: [12.9255, 80.1208],
  zoom: 18,
  minZoom: 17,
  maxZoom: 20,
  maxBounds: mccBounds,
  maxBoundsViscosity: 1.0
});

L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  {
    attribution: "© OpenStreetMap © CARTO",
    subdomains: "abcd"
  }
).addTo(map);

map.fitBounds(mccBounds);


// Example marker
L.marker([12.9249, 80.1200])
  .addTo(map)
  .bindPopup("MCC Main Gate");
