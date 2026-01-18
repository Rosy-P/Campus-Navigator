class RedesignedCampusVoice {
    constructor() {
        this.map = null;
        this.markers = L.layerGroup();
        this.userMarker = null;
        this.allLocations = {}; // Your JSON data
        this.init();
    }

    async init() {
        // Load your JSON data
        await this.loadMccData();
        
        // Hide splash after 3s
        setTimeout(() => document.getElementById('splashScreen').style.display = 'none', 3000);
        
        this.initMap();
        this.initVoice();
        this.bindEvents();
        this.addMarkers();
        this.loadQuickAccess();
    }

    async loadMccData() {
        // Your exact JSON structure from previous message
        this.allLocations = {
            // classrooms, departments, facilities from your mcc-full-data.json
            mainGate: {name: "Main Gate", lat: 12.9172, lng: 80.1370, floor: "ground", category: "facilities"},
            library: {name: "Library", lat: 12.9182, lng: 80.1390, floor: "ground", category: "facilities"},
            // ... all 25+ from your JSON
        };
    }

    initMap() {
        this.map = L.map('map').setView([12.9175, 80.1378], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
        this.markers.addTo(this.map);
    }

    bindEvents() {
        // Sidebar toggle
        document.getElementById('toggleSidebar').onclick = () => {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('collapsed');
            sidebar.classList.toggle('mobile-open');
        };

        // Search
        document.getElementById('searchInput').onkeypress = (e) => e.key === 'Enter' && this.search();
        document.getElementById('voiceBtn').onclick = () => this.toggleVoice();
        document.getElementById('locationBtn').onclick = () => this.getLocation();

        // Menu categories
        document.querySelectorAll('.menu-item').forEach(item => {
            item.onclick = (e) => {
                document.querySelector('.menu-item.active').classList.remove('active');
                item.classList.add('active');
                this.filterMarkers(item.dataset.category);
            };
        });

        // Close info panel
        document.getElementById('closeInfo').onclick = () => {
            document.getElementById('infoPanel').classList.remove('visible');
        };
    }

    initVoice() {
        if ('webkitSpeechRecognition' in window) {
            const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            recognition.lang = 'en-IN';
            recognition.onresult = (e) => {
                document.getElementById('searchInput').value = e.results[0][0].transcript;
                this.search();
            };
            this.recognition = recognition;
        }
    }

    toggleVoice() {
        if (this.recognition) {
            this.recognition.start();
            document.getElementById('voiceBtn').innerHTML = '<i class="fas fa-stop"></i>';
        }
    }

    async search() {
        const query = document.getElementById('searchInput').value.toLowerCase();
        const location = Object.values(this.allLocations).find(loc => 
            loc.name.toLowerCase().includes(query)
        );

        if (location) {
            this.navigateTo(location);
        }
    }

    navigateTo(location) {
        // Zoom to destination (Google Maps style)
        this.map.flyTo([location.lat, location.lng], 18, { duration: 1.5 });
        
        // Show info panel
        document.getElementById('infoPanel').classList.add('visible');
        document.getElementById('destinationTitle').textContent = location.name;
        document.getElementById('destinationInfo').innerHTML = `
            <p><strong>Floor:</strong> ${location.floor}</p>
            <p><strong>Category:</strong> ${location.category}</p>
            <button class="btn btn-primary w-100" onclick="navigator.startNavigation('${location.lat}', '${location.lng}')">
                Start Navigation
            </button>
        `;
        
        // Collapse sidebar
        document.getElementById('sidebar').classList.add('collapsed');
    }

    getLocation() {
        navigator.geolocation.getCurrentPosition(pos => {
            if (this.userMarker) this.map.removeLayer(this.userMarker);
            this.userMarker = L.marker([pos.coords.latitude, pos.coords.longitude], {
                icon: L.divIcon({html: '<i class="fas fa-user-circle text-primary"></i>', iconSize: [30,30]})
            }).addTo(this.map);
            this.map.flyTo([pos.coords.latitude, pos.coords.longitude], 17);
        });
    }

    addMarkers() {
        Object.values(this.allLocations).forEach(loc => {
            const marker = L.marker([loc.lat, loc.lng]).bindPopup(loc.name);
            marker.options.category = loc.category;
            this.markers.addLayer(marker);
        });
    }

    filterMarkers(category) {
        this.markers.clearLayers();
        Object.values(this.allLocations)
            .filter(loc => category === 'all' || loc.category === category)
            .forEach(loc => {
                const marker = L.marker([loc.lat, loc.lng]).bindPopup(loc.name);
                marker.options.category = loc.category;
                this.markers.addLayer(marker);
            });
    }

    loadQuickAccess() {
        document.querySelector('.quick-btn.hostel').onclick = () => this.quickNavigate('hostel');
        document.querySelector('.quick-btn.lab').onclick = () => this.quickNavigate('labs');
        document.querySelector('.quick-btn.canteen').onclick = () => this.quickNavigate('canteen');
    }

    quickNavigate(type) {
        const locations = Object.values(this.allLocations).filter(loc => loc.category === type)[0];
        if (locations) this.navigateTo(locations);
    }

    startNavigation(lat, lng) {
        // Draw route from user to destination
        if (this.userMarker) {
            const route = L.polyline([
                this.userMarker.getLatLng(),
                [parseFloat(lat), parseFloat(lng)]
            ], {color: '#ff6b6b', weight: 8}).addTo(this.map);
            this.map.fitBounds(route.getBounds());
        }
    }
}

// Initialize
let navigator;
document.addEventListener('DOMContentLoaded', () => {
    navigator = new RedesignedCampusVoice();
    window.navigator = navigator;
});
