window.addEventListener("load", () => {
  setTimeout(() => {
    document.getElementById("splash").style.display = "none";
    document.getElementById("app").classList.remove("hidden");
    document.getElementById("searchBar").classList.remove("hidden");

    // Fix map rendering issue after unhiding
    if (map) {
      map.invalidateSize();
    }
  }, 3000);
});
// ---------------- ROUTING UTILS (GLOBAL) ----------------
let navigationRoutePoints = [];
let routeProgressIndex = 0;
let activeRoutePoints = [];
let activeRouteIndex = 0;


// Convert lat/lng to unique node key
function nodeKey(lat, lng) {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

// Convert key back to LatLng
function keyToLatLng(key) {
  const [lat, lng] = key.split(",").map(Number);
  return L.latLng(lat, lng);
}

// DIJKSTRA ALGORITHM
function dijkstra(graph, startKey, endKey) {
  const distances = {};
  const previous = {};
  const visited = new Set();

  Object.keys(graph).forEach(node => {
    distances[node] = Infinity;
    previous[node] = null;
  });

  distances[startKey] = 0;

  while (true) {
    let closestNode = null;
    let smallestDistance = Infinity;

    for (let node in distances) {
      if (!visited.has(node) && distances[node] < smallestDistance) {
        smallestDistance = distances[node];
        closestNode = node;
      }
    }

    if (!closestNode) break;
    if (closestNode === endKey) break;

    visited.add(closestNode);

    graph[closestNode].forEach(neighbor => {
      const alt = distances[closestNode] + neighbor.weight;
      if (alt < distances[neighbor.node]) {
        distances[neighbor.node] = alt;
        previous[neighbor.node] = closestNode;
      }
    });
  }

  // Reconstruct path
  const path = [];
  let current = endKey;
  while (current) {
    path.unshift(current);
    current = previous[current];
  }

  return path;
}


//Route test function
// ==========================================
// 🚀 UNIFIED ROUTING MODULE (Clean & Reusable)
// ==========================================

// 1. PURE LOGIC: Calculates path between two LatLngs
function calculateRoute(startLatLng, endLatLng) {
  console.log(`🔍 Calculating Route:`, startLatLng, "->", endLatLng);

  if (!campusPathsGeoJSON || !graph) {
    console.warn("⚠️ Graph/Paths not ready yet");
    return null;
  }

  // A. Snap to nearest nodes
  // Increased debugging for snapping
  const startNode = findNearestPathPoint(startLatLng, campusPathsGeoJSON);
  const endNode = findNearestPathPoint(endLatLng, campusPathsGeoJSON);

  if (!startNode || !endNode) {
    console.warn("❌ Snapping failed. Start snapped:", startNode, "End snapped:", endNode);
    alert("Debug: Could not snap your point to a nearby road.");
    return null;
  }

  // B. Convert to keys
  const startKey = nodeKey(startNode.lat, startNode.lng);
  const endKey = nodeKey(endNode.lat, endNode.lng);

  console.log(`📍 Snapped Keys: Start [${startKey}] -> End [${endKey}]`);

  if (!graph[startKey]) {
    console.warn(`❌ Start node key [${startKey}] not found in graph keys:`, Object.keys(graph).slice(0, 5));
    return null;
  }
  if (!graph[endKey]) {
    console.warn(`❌ End node key [${endKey}] not found in graph`);
    return null;
  }

  // C. Run Dijkstra
  const routeKeys = dijkstra(graph, startKey, endKey);

  if (!routeKeys || routeKeys.length < 2) {
    console.warn("❌ Dijkstra returned no path. Graph might be disconnected.");
    return null;
  }

  // D. Return Array of LatLngs
  return routeKeys.map(keyToLatLng);
}

// 2. RENDERING: Draws the route on the map
let currentRouteLayers = L.layerGroup(); // Group for shadow, main, and highlight
let routeShadow = null;
let routeHighlight = null;
let completedRouteLayer = null; // Gray portion
let remainingRouteLayer = null; // Blue portion

// Navigation State
let isNavigating = false;
let navMarkers = L.layerGroup(); // To hold pulsing start and flag destination

// Helper to calculate weights based on zoom (Touch-friendly & Premium feel)
function getLayerWeights(zoom) {
  // Adaptive scaling: Route gets thicker as we zoom in
  let baseWeight = 12;
  if (zoom === 17) baseWeight = 14;
  if (zoom === 18) baseWeight = 20;
  if (zoom === 19) baseWeight = 28;
  if (zoom >= 20) baseWeight = 36;

  return {
    shadow: baseWeight * 1.15, // Tighter shadow
    main: baseWeight,
    highlight: baseWeight * 0.3
  };
}

function updateRouteStyle() {
  if (isNavigating && map) {
    const weights = getLayerWeights(map.getZoom());
    if (routeShadow) routeShadow.setStyle({ weight: weights.shadow });
    if (completedRouteLayer) completedRouteLayer.setStyle({ weight: weights.main });
    if (remainingRouteLayer) remainingRouteLayer.setStyle({ weight: weights.main });
    if (routeHighlight) routeHighlight.setStyle({ weight: weights.highlight });
  }
}

function drawRoute(routePoints) {
  if (!routePoints || routePoints.length < 2) return;

  // Clear previous route
  currentRouteLayers.clearLayers();
  routeShadow = routeHighlight = completedRouteLayer = remainingRouteLayer = null;

  // ✅ STORE ROUTE DATA FOR NAVIGATION
  navigationRoutePoints = routePoints;
  activeRoutePoints = routePoints;
  activeRouteIndex = 0;

  if (!map) return;

  const weights = getLayerWeights(map.getZoom());

  // Layer 1: Outer casing (Shadow) - Covers the whole path
  routeShadow = L.polyline(routePoints, {
    color: "#1a1a1a",
    weight: weights.shadow,
    opacity: 0.4,
    lineJoin: "round",
    lineCap: "round"
  });

  // Layer 2 & 3: Progress-aware layers
  completedRouteLayer = L.polyline([], {
    color: "#64748b", // Slate/Gray
    weight: weights.main,
    opacity: 0.8,
    lineJoin: "round",
    lineCap: "round"
  });

  remainingRouteLayer = L.polyline(routePoints, {
    color: "#1E40AF", // Deep Blue
    weight: weights.main,
    opacity: 1,
    lineJoin: "round",
    lineCap: "round"
  });

  routeHighlight = L.polyline(routePoints, {
    color: "#3b82f6", // Brighter Blue Highlight
    weight: weights.highlight,
    opacity: 0.8,
    lineJoin: "round",
    lineCap: "round"
  });

  // Add all to group
  currentRouteLayers.addLayer(routeShadow);
  currentRouteLayers.addLayer(completedRouteLayer);
  currentRouteLayers.addLayer(remainingRouteLayer);
  currentRouteLayers.addLayer(routeHighlight);
  currentRouteLayers.addTo(map);

  // Initial progress update
  updateRouteProgress();

  // Smart Zoom
  map.fitBounds(remainingRouteLayer.getBounds(), {
    padding: [80, 80],
    maxZoom: 19,
    animate: true,
    duration: 1.5
  });

  // Attach Zoom Listener
  map.off('zoomend', updateRouteStyle);
  map.on('zoomend', updateRouteStyle);
}

// Update Route Coloring based on index
function updateRouteProgress() {
  if (!activeRoutePoints || !completedRouteLayer || !remainingRouteLayer) return;

  const completed = activeRoutePoints.slice(0, activeRouteIndex + 1);
  const remaining = activeRoutePoints.slice(activeRouteIndex);

  completedRouteLayer.setLatLngs(completed);
  remainingRouteLayer.setLatLngs(remaining);

  // Also update highlight to only show on remaining part
  if (routeHighlight) {
    routeHighlight.setLatLngs(remaining);
  }
}

// 🚀 PROGRESS TRACKING: Computes distance from current position to end
function calculateRemainingDistance() {
  if (!activeRoutePoints || activeRoutePoints.length === 0) return 0;

  let distance = 0;
  // Sum distance from the NEXT node to the end
  for (let i = activeRouteIndex; i < activeRoutePoints.length - 1; i++) {
    const p1 = L.latLng(activeRoutePoints[i].lat, activeRoutePoints[i].lng);
    const p2 = L.latLng(activeRoutePoints[i + 1].lat, activeRoutePoints[i + 1].lng);
    distance += p1.distanceTo(p2);
  }
  return distance;
}

// 3. MAIN WRAPPER (Easy to use)
function navigateTo(start, end) {
  console.log("🚗 Calculating route...");
  const points = calculateRoute(start, end);

  if (points) {
    drawRoute(points);
    console.log(`✅ Route found: ${points.length} nodes`);
  } else {
    alert("Could not find a path to this location.");
  }
}

// Test function (can be used for debugging)
function testRouting() {
  const mainGate = L.latLng(12.923163, 80.120584);
  const library = L.latLng(12.920080, 80.120353);
  navigateTo(mainGate, library);
}


let map, userMarker, allMarkers = L.layerGroup();
const MCC_CENTER = [12.91628, 80.122061];

// 1) Define campus bounds (adjust if needed)
const southWest = L.latLng(12.9125, 80.1120);
const northEast = L.latLng(12.9270, 80.1300);
const campusBounds = L.latLngBounds(southWest, northEast);



// 2) Initialize MCC map with limited zoom
// 2) Initialize MCC map with limited zoom
map = L.map('map', {
  center: MCC_CENTER,
  zoom: 17,
  minZoom: 16,
  maxZoom: 22,                      // Allow close zooming
  maxBounds: campusBounds,          // hard limit
  maxBoundsViscosity: 1.0           // “rubber band” effect at edges
});

// 3) Base layer - Google Maps (Standard Roadmap)
// 3) Base layer - CartoDB Voyager No Labels (Clean, Academic)
const lightMapUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png';
const darkMapUrl = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';

let tileLayer = L.tileLayer(lightMapUrl, {
  attribution: '&copy; CartoDB &copy; OpenStreetMap',
  subdomains: 'abcd',
  maxNativeZoom: 19,
  maxZoom: 22
});
tileLayer.addTo(map);
let campusBoundaryLayer;
let campusBound;

// ---------------- MAP DATA LOADING ----------------
let pathGraph = []; // stores all path points (nodes)
let graph = {};
let campusPathsGeoJSON = null;

fetch("mcc-boundary.geojson")
  .then(res => res.json())
  .then(data => {
    campusBoundaryLayer = L.geoJSON(data);
    campusBound = campusBoundaryLayer.getBounds();

    // Initial Focus on Campus
    map.fitBounds(campusBound);
    map.zoomOut(0.5); // Slightly zoom out for a better overview

    // 1. Set zoom limit (Allowed to zoom out slightly more)
    map.setMinZoom(16);

    // 2. Tight Bounds (User cannot pan away)
    // pad(0.3) gives a 30% buffer (increased from 0.05) as requested
    map.setMaxBounds(campusBound.pad(0.3));

    // --- SPOTLIGHT / VIGNETTE EFFECT (Smooth Oval) ---
    // User requested "circle/oval", "lighter to darker smooth transition".
    // We use a CSS Overlay for the perfect gradient.
    const vignette = document.createElement('div');
    vignette.className = 'vignette-layer';
    document.body.appendChild(vignette);

    // Load paths ONLY after boundary is set
    loadPaths();
  });

function loadPaths() {
  fetch("mcc-paths.geojson")
    .then(res => res.json())
    .then(data => {
      campusPathsGeoJSON = data; // ✅ store globally

      // 🔒 Hidden path layer (for routing only, not visible)
      // We keep the object but don't add it to the map to keep it invisible
      // If we need it for Leaflet-dependent logic, we can add it with opacity: 0
      /* 
      const hiddenPathLayer = L.geoJSON(data, {
        style: { opacity: 0, weight: 0 }
      });
      */

      // 2️⃣ Build graph with Filtering
      data.features.forEach(feature => {
        if (feature.geometry.type !== "LineString") return;

        const coords = feature.geometry.coordinates;

        for (let i = 0; i < coords.length - 1; i++) {
          const [lng1, lat1] = coords[i];
          const [lng2, lat2] = coords[i + 1];

          const p1 = L.latLng(lat1, lng1);
          const p2 = L.latLng(lat2, lng2);

          // 🛡️ FILTER: Ignore paths outside campus
          if (!campusBound.contains(p1) || !campusBound.contains(p2)) {
            continue;
          }

          const key1 = nodeKey(lat1, lng1);
          const key2 = nodeKey(lat2, lng2);
          const dist = p1.distanceTo(p2);

          if (!graph[key1]) graph[key1] = [];
          if (!graph[key2]) graph[key2] = [];

          graph[key1].push({ node: key2, weight: dist });
          graph[key2].push({ node: key1, weight: dist });
        }
      });

      console.log("✅ Graph ready (filtered):", Object.keys(graph).length);

      // 3️⃣ ROUTE TEST REMOVED
      // testRouting();
    })
    .catch(err => console.error("Error loading MCC paths:", err));
}



//finding nearest road (snapping)
//finding nearest road (snapping)
function findNearestPathPoint(startLatLng, geojson, maxRadius = 0.01) {
  let nearestPoint = null;
  let minDistance = Infinity;

  geojson.features.forEach(feature => {
    if (feature.geometry.type !== "LineString") return;

    feature.geometry.coordinates.forEach(coord => {
      // IMPORTANT: GeoJSON is [lng, lat]
      const pathPoint = L.latLng(coord[1], coord[0]);

      const distance = startLatLng.distanceTo(pathPoint);

      if (distance < minDistance) {
        minDistance = distance;

        // Only accept if within radius
        if (distance <= maxRadius * 111000) {
          nearestPoint = pathPoint;
        }
      }
    });
  });

  if (!nearestPoint) {
    console.warn(`⚠️ No path point found within ${(maxRadius * 111).toFixed(2)} km. Closest was: ${(minDistance).toFixed(1)} m`);
  } else {
    console.log(`✅ Snapped to path. Distance: ${(minDistance).toFixed(1)} m`);
  }

  return nearestPoint;
}


// Data Storage
let allLocations = [];
const markerLayer = L.layerGroup().addTo(map);

// Category Group Mapping
const categoryGroups = {
  "Academic": "classrooms",
  "Lab": "classrooms",
  "Department": "departments",
  "Hostel": "halls",
  "Auditorium": "halls",
  "Library": "amenities",
  "Sports": "amenities",
  "Service": "amenities",
  "Entrance": "amenities",
  "Facility": "amenities",
  "Arts": "amenities",
  "Landmark": "amenities",
  "Commerce Block": "departments",
  "Computer Science Dept": "departments"
};

// Icon Mapping
function getCategoryIcon(category) {
  const cat = category.toLowerCase();
  if (cat.includes('academic') || cat.includes('class')) return 'fas fa-graduation-cap';
  if (cat.includes('lab')) return 'fas fa-flask';
  if (cat.includes('department') || cat.includes('commerce') || cat.includes('science')) return 'fas fa-building';
  if (cat.includes('library')) return 'fas fa-book';
  if (cat.includes('hostel')) return 'fas fa-bed';
  if (cat.includes('sports') || cat.includes('box')) return 'fas fa-dumbbell';
  if (cat.includes('entr')) return 'fas fa-torii-gate';
  if (cat.includes('service') || cat.includes('atm')) return 'fas fa-money-bill';
  if (cat.includes('art')) return 'fas fa-palette';
  if (cat.includes('audit')) return 'fas fa-theater-masks';
  return 'fas fa-map-marker-alt';
}

function getCategoryClass(category) {
  const cat = category.toLowerCase();
  if (cat.includes('academic') || cat.includes('lab')) return 'academic';
  if (cat.includes('department')) return 'department';
  if (cat.includes('sports')) return 'sports';
  if (cat.includes('library') || cat.includes('arts')) return 'library';
  return 'facility';
}


// Load Data
fetch('mcc-full-data.json')
  .then(res => res.json())
  .then(data => {
    // Flatten Data
    const sections = ['classrooms', 'departments', 'facilities'];
    sections.forEach(section => {
      if (data[section]) {
        data[section].forEach(loc => {
          // Assign group
          loc.group = categoryGroups[loc.category] || "others";
          if (!loc.group && (loc.category === 'Department')) loc.group = 'departments';

          allLocations.push(loc);
        });
      }
    });

    // Initial Render (All)
    renderMarkers("all");
  })
  .catch(err => console.error("Error loading map data:", err));


// ===== FILTER LOGIC =====
// Filter chips removed - using quick access buttons instead
/*
const filterChips = document.querySelectorAll('.filter-chip');

filterChips.forEach(chip => {
  chip.addEventListener('click', () => {
    // UI Update
    filterChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    // Filter Map
    const group = chip.dataset.filter;
    renderMarkers(group);
  });
});
*/

function renderMarkers(filterGroup) {
  markerLayer.clearLayers();

  allLocations.forEach(loc => {
    if (filterGroup === "all" || loc.group === filterGroup || (filterGroup === 'classrooms' && (loc.category === 'Academic' || loc.category === 'Lab'))) {
      createMarker(loc);
    }
  });
}

function createMarker(loc) {
  const icon = L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="marker-icon ${getCategoryClass(loc.category)}">
        <div class="icon-circle">
          <i class="${getCategoryIcon(loc.category)}"></i>
        </div>
      </div>
      <div class="marker-label">${loc.name}</div>
    `,
    iconSize: [40, 50],
    iconAnchor: [20, 50],
    popupAnchor: [0, -50]
  });

  const marker = L.marker([loc.lat, loc.lng], { icon: icon });

  marker.on('click', () => {
    map.flyTo([loc.lat, loc.lng], 20, { duration: 1.5 });
    openInfoPanel(loc, loc.category);
  });

  markerLayer.addLayer(marker);
}

function openInfoPanel(item, type) {
  // 1. Basic Info
  document.getElementById("infoTitle").innerText = item.name;

  const category = item.category || type || "Campus Location";
  // Zone logic (simple mock based on lat/lng or just hardcode for now)
  const zone = "Main Campus";
  document.getElementById("infoSubtitle").innerText = `${category} • ${zone}`;

  // 2. Walk Info (Mock calculation from Main Gate)
  // Main Gate: 12.923163, 80.120584
  const startLat = 12.923163;
  const startLng = 80.120584;
  updateWalkInfo(startLat, startLng, item.lat, item.lng);

  // 3. Header Image
  const mainImage = document.getElementById("infoImage");
  if (item.images && item.images.length > 0) {
    mainImage.src = item.images[0];
  } else {
    mainImage.src = "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=600&q=80";
  }
  mainImage.style.display = "block";

  // 4. Photo Gallery
  const gallery = document.getElementById("photoGallery");
  gallery.innerHTML = "";

  if (item.images && item.images.length > 0) {
    item.images.forEach(imgUrl => {
      const img = document.createElement("img");
      img.src = imgUrl;
      img.alt = item.name;
      gallery.appendChild(img);
    });
    // Add placeholder to fill scroll
    const placeholder = document.createElement("img");
    placeholder.src = "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=600&q=80";
    gallery.appendChild(placeholder);
  } else {
    gallery.innerHTML = "<p style='padding:10px; color:#777;'>No extra photos available.</p>";
  }

  // 5. Button Actions
  const btnNavigate = document.getElementById("btnNavigate");
  const btnStart = document.getElementById("btnStart");

  // Clone to remove old event listeners
  const newBtnNav = btnNavigate.cloneNode(true);
  btnNavigate.parentNode.replaceChild(newBtnNav, btnNavigate);

  const newBtnStart = btnStart.cloneNode(true);
  btnStart.parentNode.replaceChild(newBtnStart, btnStart);

  newBtnNav.addEventListener("click", () => {
    // Switch to Navigation View within the same panel
    // Ensure the function exists (it is defined at the end of file)
    if (typeof openNavSetup === "function") {
      openNavSetup(item);
    } else {
      console.error("openNavSetup not found");
    }
  });

  newBtnStart.addEventListener("click", () => {
    // For now, Start just zooms in and closes panel
    map.flyTo([item.lat, item.lng], 20);
    closeInfoPanel();
  });

  // Show right panel
  document.body.classList.add("info-open");
  document.body.classList.add("sidebar-collapsed");

  // Adjust map
  setTimeout(() => {
    map.invalidateSize();
    map.flyTo([item.lat, item.lng], 20, { duration: 1.2 });
  }, 300);
}

function updateWalkInfo(lat1, lng1, lat2, lng2) {
  const p1 = L.latLng(lat1, lng1);
  const p2 = L.latLng(lat2, lng2);
  const distMeters = p1.distanceTo(p2);

  // Average walking speed ~ 5 km/h = ~83 m/min => ~1.4 m/s
  // Using 4.5km/h => 75m/min for relaxed campus walk
  const timeMin = Math.ceil(distMeters / 75);

  let distDisplay = distMeters < 1000 ? `${Math.round(distMeters)}m` : `${(distMeters / 1000).toFixed(1)}km`;

  document.getElementById("walkDist").innerText = distDisplay;
  document.getElementById("walkTime").innerText = `${timeMin} min walk`;
}

// Sub-function to generate star HTML
function generateStars(rating) {
  let stars = "";
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      stars += '<i class="fas fa-star"></i>';
    } else if (i - 0.5 <= rating) {
      stars += '<i class="fas fa-star-half-alt"></i>';
    } else {
      stars += '<i class="far fa-star"></i>';
    }
  }
  return stars;
}
//close info panel
function closeInfoPanel() {
  document.body.classList.remove("info-open");
  document.body.classList.remove("sidebar-collapsed");

  setTimeout(() => {
    map.invalidateSize();
  }, 300);
  // 🆕 ADD THIS
  stopLocationTracking();

  if (locationBtn) {
    locationBtn.classList.remove("active");
  }

}

// ==========================================
// 📍 USER LOCATION TRACKING MODULE
// ==========================================

let userLocationMarker = null;
let userAccuracyCircle = null;
let watchId = null;
let userCurrentLocation = null;
let isTrackingLocation = false;
let locationUpdateInterval = null;

// Demo mode for testing (simulates movement)
const DEMO_MODE = true; // Set to false for real GPS
let demoLat = 12.923163;
let demoLng = 80.120584;

function initializeLocationTracking() {
  console.log("🔵 Initializing location tracking...");

  if (!navigator.geolocation && !DEMO_MODE) {
    console.warn("❌ Geolocation not supported");
    alert("Location services are not available on this device.");
    return false;
  }

  createUserLocationMarker();
  return true;
}

function createUserLocationMarker() {
  if (userLocationMarker) {
    map.removeLayer(userLocationMarker);
  }
  if (userAccuracyCircle) {
    map.removeLayer(userAccuracyCircle);
  }

  const userIcon = L.divIcon({
    className: 'user-location-marker',
    html: `
      <div class="user-dot">
        <div class="dot-inner"></div>
        <div class="pulse-ring"></div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  userLocationMarker = L.marker([12.923163, 80.120584], {
    icon: userIcon,
    zIndexOffset: 2000
  });

  console.log("✅ User location marker created");
}

function startLocationTracking() {
  if (isTrackingLocation) {
    console.log("ℹ️ Location tracking already active");
    return;
  }

  isTrackingLocation = true;
  console.log("🚀 Starting location tracking...");

  if (DEMO_MODE) {
    startDemoTracking();
  } else {
    startGPSTracking();
  }
}

function startGPSTracking() {
  const options = {
    enableHighAccuracy: true,
    maximumAge: 3000,
    timeout: 10000
  };

  watchId = navigator.geolocation.watchPosition(
    onLocationSuccess,
    onLocationError,
    options
  );

  console.log("📡 GPS tracking active");
}

function onLocationSuccess(position) {
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  const accuracy = position.coords.accuracy;

  console.log(`📍 GPS Update: ${lat.toFixed(6)}, ${lng.toFixed(6)} (±${Math.round(accuracy)}m)`);
  updateUserLocation(lat, lng, accuracy);
}

function onLocationError(error) {
  console.error("❌ GPS Error:", error.message);

  switch (error.code) {
    case error.PERMISSION_DENIED:
      alert("Location permission denied. Please enable location access.");
      break;
    case error.POSITION_UNAVAILABLE:
      console.warn("Position unavailable, using last known location");
      break;
    case error.TIMEOUT:
      console.warn("Location request timed out");
      break;
  }
}

function startDemoTracking() {
  if (!navigationRoutePoints || navigationRoutePoints.length === 0) {
    console.warn("❌ No route available for navigation");
    return;
  }

  routeProgressIndex = 0;

  locationUpdateInterval = setInterval(() => {
    if (routeProgressIndex >= navigationRoutePoints.length) {
      console.log("🏁 Destination reached");
      stopLocationTracking();
      return;
    }

    const point = navigationRoutePoints[routeProgressIndex];
    activeRouteIndex = routeProgressIndex; // Sync for distance calculation
    updateUserLocation(point.lat, point.lng, 10);

    routeProgressIndex++;
  }, 2000);
}


function updateUserLocation(lat, lng, accuracy) {
  userCurrentLocation = L.latLng(lat, lng);

  if (!map.hasLayer(userLocationMarker)) {
    userLocationMarker.addTo(map);
  }

  userLocationMarker.setLatLng(userCurrentLocation);

  if (userAccuracyCircle) {
    userAccuracyCircle.setLatLng(userCurrentLocation);
    userAccuracyCircle.setRadius(accuracy);
  } else {
    userAccuracyCircle = L.circle(userCurrentLocation, {
      radius: accuracy,
      color: '#4A90E2',
      fillColor: '#4A90E2',
      fillOpacity: 0.1,
      weight: 1,
      opacity: 0.3
    }).addTo(map);
  }

  if (isNavigating) {
    centerMapOnUser();

    // Update live progress visuals
    updateRouteProgress();

    // Update live progress stats
    const remaining = calculateRemainingDistance();
    const timeMin = Math.ceil(remaining / 75); // 75m/min walking speed

    const distEl = document.getElementById("navDist");
    const timeEl = document.getElementById("navTime");

    if (distEl) distEl.innerText = remaining < 1000 ? Math.round(remaining) + " m" : (remaining / 1000).toFixed(1) + " km";
    if (timeEl) timeEl.innerText = timeMin + " min";
  }
}

function centerMapOnUser(animated = true) {
  if (!userCurrentLocation) return;

  if (animated) {
    map.flyTo(userCurrentLocation, map.getZoom(), {
      duration: 0.5,
      easeLinearity: 0.5
    });
  } else {
    map.panTo(userCurrentLocation);
  }
}

function stopLocationTracking() {
  if (!isTrackingLocation) return;

  console.log("⏹️ Stopping location tracking");

  isTrackingLocation = false;

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  if (locationUpdateInterval) {
    clearInterval(locationUpdateInterval);
    locationUpdateInterval = null;
  }

  if (userLocationMarker && map.hasLayer(userLocationMarker)) {
    map.removeLayer(userLocationMarker);
  }

  if (userAccuracyCircle && map.hasLayer(userAccuracyCircle)) {
    map.removeLayer(userAccuracyCircle);
  }
}

// Location button handler
const locationBtn = document.getElementById("locationBtn");

if (locationBtn) {
  locationBtn.addEventListener("click", () => {
    if (!isTrackingLocation) {
      if (initializeLocationTracking()) {
        startLocationTracking();
        locationBtn.classList.add("active");
      }
    } else {
      centerMapOnUser(true);
    }
  });
}

// Global access
window.userLocationTracking = {
  start: startLocationTracking,
  stop: stopLocationTracking,
  center: centerMapOnUser,
  getCurrentLocation: () => userCurrentLocation
};

console.log("✅ Location tracking module loaded");
// ===== SMART SEARCH LOGIC =====
const searchInput = document.getElementById('searchInput');
const searchSuggestions = document.getElementById('searchSuggestions');

searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();

  if (query.length < 1) {
    searchSuggestions.classList.add('hidden');
    return;
  }

  // Filter Suggestions
  const matches = allLocations.filter(loc =>
    loc.name.toLowerCase().includes(query) ||
    loc.category.toLowerCase().includes(query)
  ).slice(0, 5); // Limit to top 5

  renderSuggestions(matches);
});

function renderSuggestions(matches) {
  searchSuggestions.innerHTML = '';

  if (matches.length === 0) {
    searchSuggestions.classList.add('hidden');
    return;
  }

  matches.forEach(loc => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.innerHTML = `
      <div class="s-name">${loc.name}</div>
      <div class="s-desc">${loc.category}</div>
    `;

    div.addEventListener('click', () => {
      selectLocation(loc);
    });

    searchSuggestions.appendChild(div);
  });

  searchSuggestions.classList.remove('hidden');
}

function selectLocation(loc) {
  searchInput.value = loc.name;
  searchSuggestions.classList.add('hidden');

  // Ensure all markers are visible
  renderMarkers("all");

  map.flyTo([loc.lat, loc.lng], 20, { duration: 1.5 });
  openInfoPanel(loc, loc.category);
}

// Hide suggestions when clicking outside
window.addEventListener('click', (e) => {
  if (!e.target.closest('.search-container')) {
    searchSuggestions.classList.add('hidden');
  }
});



// ===== THEME & SETTINGS LOGIC =====
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const closeSettingsBtn = document.getElementById("closeSettings");
const themeInputs = document.querySelectorAll('input[name="theme"]');
const mapInputs = document.querySelectorAll('input[name="mapType"]');
const notifEvents = document.getElementById("notifEvents");
const notifEmergency = document.getElementById("notifEmergency");

// Toggle Settings Modal
if (settingsBtn) {
  settingsBtn.addEventListener("click", () => {
    settingsModal.classList.remove("hidden");
  });
}

if (closeSettingsBtn) {
  closeSettingsBtn.addEventListener("click", () => {
    settingsModal.classList.add("hidden");
  });
}

// Close modal when clicking outside
window.addEventListener("click", (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.add("hidden");
  }
});

// Settings State
let currentTheme = localStorage.getItem("app-theme") || "light";
let currentMapType = localStorage.getItem("app-map-type") || "default";

// Apply Changes
function applySettings() {
  const body = document.body;

  // 1. Theme (Light/Dark)
  // Only apply theme CSS if Map Type is "Default", OR always apply CSS but map tiles might change
  if (currentTheme === "light") {
    body.classList.add("light-mode");
  } else {
    body.classList.remove("light-mode");
  }

  // 2. Map Tiles logic
  updateMapTiles();

  // 3. Update Inputs UI
  const themeInput = document.querySelector(`input[name="theme"][value="${currentTheme}"]`);
  if (themeInput) themeInput.checked = true;

  const mapInput = document.querySelector(`input[name="mapType"][value="${currentMapType}"]`);
  if (mapInput) mapInput.checked = true;

  // Save
  localStorage.setItem("app-theme", currentTheme);
  localStorage.setItem("app-map-type", currentMapType);
}

function updateMapTiles() {
  if (currentMapType === "satellite") {
    // Satellite Tiles (Esri World Imagery
    tileLayer.setUrl('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
  } else {
    // Default: Clean Academic Maps (No Labels)
    if (currentTheme === "light") {
      // Light: CartoDB Voyager No Labels
      tileLayer.setUrl(lightMapUrl);
    } else {
      // Dark: CartoDB Dark Matter No Labels
      tileLayer.setUrl(darkMapUrl);
    }
  }
}

// Event Listeners: Theme
themeInputs.forEach(input => {
  input.addEventListener("change", (e) => {
    currentTheme = e.target.value;
    applySettings();
  });
});

// Event Listeners: Map Type
mapInputs.forEach(input => {
  input.addEventListener("change", (e) => {
    currentMapType = e.target.value;
    applySettings();
  });
});

// Event Listeners: Notifications
if (notifEvents) {
  notifEvents.checked = localStorage.getItem("notif-events") !== "false";
  notifEvents.addEventListener("change", (e) => localStorage.setItem("notif-events", e.target.checked));
}

if (notifEmergency) {
  notifEmergency.checked = localStorage.getItem("notif-emergency") !== "false";
  notifEmergency.addEventListener("change", (e) => localStorage.setItem("notif-emergency", e.target.checked));
}

// ===== LOCATION & PRIVACY LOGIC =====
const privacyLocation = document.getElementById("privacyLocation");
const privacyLastKnown = document.getElementById("privacyLastKnown");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

if (privacyLocation) {
  privacyLocation.checked = localStorage.getItem("privacy-location") !== "false";
  privacyLocation.addEventListener("change", (e) => {
    localStorage.setItem("privacy-location", e.target.checked);
    if (!e.target.checked) {
      map.stopLocate();
    }
  });
}

if (privacyLastKnown) {
  privacyLastKnown.checked = localStorage.getItem("privacy-last-known") !== "false";
  privacyLastKnown.addEventListener("change", (e) => {
    localStorage.setItem("privacy-last-known", e.target.checked);
  });
}

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear your navigation history?")) {
      localStorage.removeItem("search-history");
      // Add other history keys here if any
      alert("Navigation history cleared.");
    }
  });
}

// Initialize
applySettings();


// ===== SIDE PANEL NAVIGATION LOGIC =====
let currentDestination = null;
let currentStartPoint = null;
let isPickingStart = false;
let tempStartMarker = null;

// DOM Elements
const panelDetails = document.getElementById("panelDetails");
const panelNav = document.getElementById("panelNav");
const backToDetailsBtn = document.getElementById("backToDetails");
const startNavBtn = document.getElementById("startNavigationBtn");
const navInfoDest = document.getElementById("navInfoDest");
const startRadios = document.getElementsByName("startType");
const mapPickPill = document.getElementById("mapPickPill");
const confirmStartBtn = document.getElementById("confirmStartPoint");
const cancelPickBtn = document.getElementById("cancelMapPick");

// 1. Open Nav View
function openNavSetup(destinationItem) {
  currentDestination = destinationItem;
  navInfoDest.innerText = destinationItem.name;

  // Switch Views
  panelDetails.classList.add("hidden");
  panelNav.classList.remove("hidden");

  // Reset State
  currentStartPoint = null;
  document.querySelector('input[value="current"]').checked = true;
  document.getElementById("routeStats").classList.add("hidden");
}

// 2. Back to Details
backToDetailsBtn.addEventListener("click", () => {
  panelNav.classList.add("hidden");
  panelDetails.classList.remove("hidden");

  // Clean up
  if (tempStartMarker) {
    map.removeLayer(tempStartMarker);
    tempStartMarker = null;
  }
});

// 3. Handle Start Type Toggle
startRadios.forEach(radio => {
  radio.addEventListener("change", (e) => {
    if (e.target.value === "custom") {
      startMapPickMode();
    } else {
      if (tempStartMarker) map.removeLayer(tempStartMarker);
      currentStartPoint = null;
    }
  });
});

// 4. Map Pick Mode
function startMapPickMode() {
  isPickingStart = true;

  // Hide Side Panel temporarily
  document.body.classList.remove("info-open");

  mapPickPill.classList.remove("hidden");
  document.getElementById("map").style.cursor = "crosshair";
  map.on("click", onMapPickClick);
}

function onMapPickClick(e) {
  if (!isPickingStart) return;

  if (tempStartMarker) map.removeLayer(tempStartMarker);

  tempStartMarker = L.marker(e.latlng, {
    draggable: true
  }).addTo(map).bindPopup("Starting Point").openPopup();

  confirmStartBtn.disabled = false;
}

// Confirm Pick
confirmStartBtn.addEventListener("click", () => {
  if (!tempStartMarker) return;
  currentStartPoint = tempStartMarker.getLatLng();

  endMapPickMode();

  // Re-open Side Panel to Nav View
  document.body.classList.add("info-open");
});

// Cancel Pick
cancelPickBtn.addEventListener("click", () => {
  document.querySelector('input[value="current"]').checked = true;
  if (tempStartMarker) map.removeLayer(tempStartMarker);
  currentStartPoint = null;

  endMapPickMode();

  // Re-open Side Panel
  document.body.classList.add("info-open");
});

function endMapPickMode() {
  isPickingStart = false;
  mapPickPill.classList.add("hidden");
  document.getElementById("map").style.cursor = "";
  map.off("click", onMapPickClick);
  confirmStartBtn.disabled = true;
}

// 5. START NAVIGATION
startNavBtn.addEventListener("click", () => {
  if (!currentDestination) return;

  // Use GPS location if available
  let startForRoute = userCurrentLocation || currentStartPoint;

  if (!startForRoute) {
    // MOCK GPS (Main Gate)
    startForRoute = L.latLng(12.923163, 80.120584);
    console.log("📍 Using Default Current Location (Main Gate)");
  }

  const endForRoute = L.latLng(currentDestination.lat, currentDestination.lng);

  const points = calculateRoute(startForRoute, endForRoute);

  if (points) {
    // 🚩 ENTER NAVIGATION STATE
    isNavigating = true;
    document.body.classList.add("navigating");

    // 🔅 NAVIGATION MODE: Keep map bright and reduce POI noise
    if (tileLayer) tileLayer.setOpacity(1.0);

    drawRoute(points);

    // 🆕 START LOCATION TRACKING AFTER ROUTE IS DRAWN
    if (initializeLocationTracking()) {
      startLocationTracking();
    }

    // 📍 NAVIGATION MARKERS
    navMarkers.clearLayers();

    // Start: Pulsing Blue Dot (Even Larger)
    const startPoint = points[0];
    const startMarker = L.circleMarker(startPoint, {
      radius: 16,
      fillColor: "#2E7DFF",
      fillOpacity: 1,
      color: "#fff",
      weight: 4,
      className: 'pulsing-marker'
    }).addTo(navMarkers);

    // Destination: Google Pin (Premium)
    const endPoint = points[points.length - 1];
    const destIcon = L.divIcon({
      className: 'nav-dest-marker',
      html: `
        <div class="google-pin">
          <i class="fas fa-map-marker-alt"></i>
          <div class="pin-dot"></div>
        </div>
      `,
      iconSize: [50, 60],
      iconAnchor: [25, 60]
    });
    L.marker(endPoint, { icon: destIcon }).addTo(navMarkers);

    navMarkers.addTo(map);

    // UPDATE STATS
    const totalDist = points.reduce((acc, pt, i) => {
      if (i === 0) return 0;
      return acc + pt.distanceTo(points[i - 1]);
    }, 0);

    const timeMin = Math.ceil(totalDist / 75);

    document.getElementById("navDist").innerText = totalDist < 1000 ? Math.round(totalDist) + " m" : (totalDist / 1000).toFixed(1) + " km";
    document.getElementById("navTime").innerText = timeMin + " min";

    document.getElementById("routeStats").classList.remove("hidden");

  } else {
    alert("Could not calculate a path. Try a closer starting point.");
  }
});

// Override closeInfoPanel to reset view
const originalClosePanel = closeInfoPanel;
closeInfoPanel = function () {
  document.body.classList.remove("info-open");
  document.body.classList.remove("sidebar-collapsed");

  // 🚩 EXIT NAVIGATION STATE
  isNavigating = false;
  document.body.classList.remove("navigating");

  // 🔆 RESTORE MAP App State
  if (tileLayer) tileLayer.setOpacity(1.0);

  // Reset Map App State
  if (currentRouteLayers) currentRouteLayers.clearLayers();
  if (navMarkers) navMarkers.clearLayers();

  const routeStats = document.getElementById("routeStats");
  if (routeStats) routeStats.classList.add("hidden");

  // Clear search state
  currentDestination = null;
  currentStartPoint = null;

  setTimeout(() => {
    map.invalidateSize();
    // Reset to details view after closing
    panelNav.classList.add("hidden");
    panelDetails.classList.remove("hidden");
  }, 300);
}
