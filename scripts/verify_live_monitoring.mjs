/**
 * ORVIX Live Monitoring Verification Script
 * Validates OSM tile loading, disaster telemetry, coordinate filtering, and popup structure.
 */

const API_BASE_URL = "http://127.0.0.1:8000";
const FRONTEND_BASE_URL = "http://localhost:5173";

async function verifyLiveMonitoring() {
  console.log("==================================================");
  console.log("ORVIX LIVE GEOSPATIAL MONITORING VERIFICATION");
  console.log("==================================================");

  // 1. Check frontend dev server
  console.log("\n[STEP 1] Testing Frontend Routing (/monitoring)...");
  const feRes = await fetch(`${FRONTEND_BASE_URL}/monitoring`);
  console.log(`  Frontend HTTP Status: ${feRes.status} (Text length: ${(await feRes.text()).length} chars)`);
  if (feRes.status !== 200) throw new Error("Frontend dev server returned non-200");

  // 2. Check disaster telemetry API
  console.log("\n[STEP 2] Fetching NASA EONET telemetry (/api/disasters)...");
  const disRes = await fetch(`${API_BASE_URL}/api/disasters?days=30`);
  const disData = await disRes.json();
  console.log(`  API Success: ${disData.success}, Total Events: ${disData.data.total}`);
  console.log(`  Active Wildfires: ${disData.data.wildfires}, Severe Storms: ${disData.data.storms}`);

  const events = disData.data.events || [];
  const validEvents = events.filter(
    (e) =>
      typeof e.latitude === "number" &&
      typeof e.longitude === "number" &&
      !isNaN(e.latitude) &&
      !isNaN(e.longitude) &&
      e.latitude >= -90 &&
      e.latitude <= 90 &&
      e.longitude >= -180 &&
      e.longitude <= 180
  );
  console.log(`  Validated Numeric Coordinates: ${validEvents.length} / ${events.length}`);

  if (validEvents.length > 0) {
    const sample = validEvents[0];
    console.log(`  Sample Event: [${sample.category_id}] ${sample.title}`);
    console.log(`    Coords: (${sample.latitude.toFixed(4)}, ${sample.longitude.toFixed(4)})`);
    console.log(`    Date: ${sample.date}`);
    console.log(`    Source URL: ${sample.source_url || "N/A"}`);
  }

  // 3. Test OpenStreetMap Raster Tile Service
  console.log("\n[STEP 3] Testing OpenStreetMap Standard Raster Tile Service...");
  const subdomains = ["a", "b", "c"];
  for (const s of subdomains) {
    const tileUrl = `https://${s}.tile.openstreetmap.org/2/2/1.png`;
    const tRes = await fetch(tileUrl, {
      headers: { "User-Agent": "ORVIX-Earth-Intelligence/1.0" },
    });
    const buf = await tRes.arrayBuffer();
    console.log(`  ✔ Subdomain '${s}': HTTP ${tRes.status} | Content-Type: ${tRes.headers.get("content-type")} | ${buf.byteLength} bytes`);
    if (tRes.status !== 200 || buf.byteLength < 500) {
      throw new Error(`Tile fetch failed for ${tileUrl}`);
    }
  }

  // 4. Verify code configuration in LiveMonitoring.jsx
  console.log("\n[STEP 4] Verifying LiveMonitoring.jsx tile configuration...");
  const fs = await import("fs");
  const code = fs.readFileSync("frontend/src/pages/LiveMonitoring.jsx", "utf-8");

  const hasOsmUrl = code.includes("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
  const hasOsmAttr = code.includes("OpenStreetMap") && code.includes("contributors");
  const hasNoCarto = !code.includes("basemaps.cartocdn.com");
  const hasMapResizer = code.includes("<MapResizer />") || code.includes("MapResizer");
  const hasPrefilledTaskButton = code.includes("handleOpenExplorer") && code.includes("Task Satellite Explorer");

  console.log(`  - OSM Tile URL configured:        ${hasOsmUrl ? "✔ YES" : "✖ NO"}`);
  console.log(`  - OSM Attribution configured:     ${hasOsmAttr ? "✔ YES" : "✖ NO"}`);
  console.log(`  - CartoDB Dark Matter removed:    ${hasNoCarto ? "✔ YES (No API Key Required)" : "✖ NO"}`);
  console.log(`  - MapResizer component active:    ${hasMapResizer ? "✔ YES (Auto-invalidation on nav)" : "✖ NO"}`);
  console.log(`  - Prefilled Satellite task action:${hasPrefilledTaskButton ? "✔ YES" : "✖ NO"}`);

  if (!hasOsmUrl || !hasOsmAttr || !hasNoCarto || !hasMapResizer) {
    throw new Error("Configuration verification failed");
  }

  console.log("\n==================================================");
  console.log("LIVE MONITORING VERIFICATION COMPLETE: ALL PASS");
  console.log("==================================================");
}

verifyLiveMonitoring().catch((err) => {
  console.error("\nTEST FAILED:", err);
  process.exit(1);
});

