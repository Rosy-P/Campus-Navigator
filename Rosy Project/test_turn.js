// Test Turn Detection Logic
// This script simulates a route and checks if the correct instructions are generated.

const mockRoute = [
    { lat: 10, lng: 10 },
    { lat: 10.0001, lng: 10 },    // Straight
    { lat: 10.0002, lng: 10 },    // Straight
    { lat: 10.0002, lng: 10.0002 } // Right Turn (approx 90 deg)
];

function calculateAngle(p1, p2, p3) {
    const angle1 = Math.atan2(p2.lng - p1.lng, p2.lat - p1.lat);
    const angle2 = Math.atan2(p3.lng - p2.lng, p3.lat - p2.lat);
    let diff = (angle2 - angle1) * (180 / Math.PI);

    // Normalize to -180 to 180
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    return diff;
}

const p1 = mockRoute[1];
const p2 = mockRoute[2];
const p3 = mockRoute[3];

const angle = calculateAngle(p1, p2, p3);
console.log(`Angle: ${angle}`); // Should be around 90 or -90 depending on coordinate system
if (Math.abs(angle) > 30) {
    console.log("Turn Detected");
} else {
    console.log("Straight");
}
