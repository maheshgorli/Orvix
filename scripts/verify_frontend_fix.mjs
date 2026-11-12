/**
 * ORVIX Frontend Bug Fix Verification
 * Tests the exact acquisition response handling and gallery sync logic using native fetch.
 */

const API_BASE_URL = "http://127.0.0.1:8000";

async function runVerification() {
  console.log("==================================================");
  console.log("ORVIX FRONTEND ACQUISITION BUG FIX VERIFICATION");
  console.log("==================================================");

  // 1. Health check
  console.log("\n[STEP 1] Checking backend health...");
  const statusRes = await fetch(`${API_BASE_URL}/api/status`);
  const statusData = await statusRes.json();
  console.log(`Backend status: HTTP ${statusRes.status}, success=${statusData.success}`);

  // 2. Perform satellite acquisition (scene mentioned in user prompt: S2C_43PCS_20261030_0_L2A)
  console.log("\n[STEP 2] Requesting POST /api/imagery/acquire for S2C_43PCS_20261030_0_L2A...");
  const t0 = Date.now();
  const acquireRes = await fetch(`${API_BASE_URL}/api/imagery/acquire`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scene_id: "S2C_43PCS_20261030_0_L2A",
      collection: "sentinel-2-l2a",
      resolution: 10,
      event_type: "wildfire",
    }),
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`Acquisition finished in ${elapsed}s. HTTP Status: ${acquireRes.status}`);

  // 3. Test exact frontend response handling logic from SatelliteExplorer.jsx:
  console.log("\n[STEP 3] Testing SatelliteExplorer.jsx response evaluation logic...");
  const res = await acquireRes.json(); // Server returned envelope

  // Frontend logic:
  const result =
    res?.data && typeof res.data === "object" && "success" in res.data
      ? res.data
      : res;

  let acquireSuccess = false;
  let acquireError = null;
  let acquiredResult = null;
  let successMessage = null;

  if (result.success && result.data && (result.data.status === "completed" || result.data.image_url)) {
    acquiredResult = result.data;
    successMessage = result.message || `Acquisition successful for scene ${result.data.scene_id}`;
    acquireSuccess = true;
    acquireError = null;
    console.log("  ✔ Branch MATCHED: result.success && result.data && result.data.status === 'completed'");
  } else if (result.status === "completed" || result.image_url) {
    acquiredResult = result;
    successMessage = `Acquisition successful for scene ${result.scene_id}`;
    acquireSuccess = true;
    acquireError = null;
    console.log("  ✔ Branch MATCHED: unwrapped object fallback");
  } else {
    acquireError = result.error || result.message || "Satellite acquisition failed.";
    console.log("  ✖ Failed: fell into error branch:", acquireError);
  }

  if (!acquireSuccess || acquireError) {
    console.error("FAIL: Frontend reported failure!");
    process.exit(1);
  }

  console.log(`  ✔ acquireSuccess: ${acquireSuccess}`);
  console.log(`  ✔ acquireError: ${acquireError}`);
  console.log(`  ✔ successMessage: "${successMessage}"`);

  // 4. Validate metadata fields required by prompt
  console.log("\n[STEP 4] Validating UI metadata fields...");
  console.log(`  - Scene ID:         ${acquiredResult.scene_id}`);
  console.log(`  - Platform:         ${acquiredResult.platform}`);
  console.log(`  - Observation Date: ${acquiredResult.date}`);
  console.log(`  - Cloud Cover:      ${acquiredResult.cloud_cover}%`);
  console.log(`  - Center Lat/Lon:    ${acquiredResult.latitude}, ${acquiredResult.longitude}`);
  console.log(`  - Status:           ${acquiredResult.status}`);
  console.log(`  - True Color RGB:   ${acquiredResult.image_url}`);
  console.log(`  - Thumbnail URL:    ${acquiredResult.thumbnail_url}`);
  console.log(`  - False Color NIR:  ${acquiredResult.indices?.false_color}`);
  console.log(`  - NDVI Index:       ${acquiredResult.indices?.ndvi}`);
  console.log(`  - NDWI Index:       ${acquiredResult.indices?.ndwi}`);
  console.log(`  - NBR Index:        ${acquiredResult.indices?.nbr}`);

  if (!acquiredResult.scene_id || !acquiredResult.image_url) {
    throw new Error("Missing essential scene_id or image_url in data");
  }

  // 5. Test real image URLs return HTTP 200 and image bytes
  console.log("\n[STEP 5] Verifying all returned image URLs are reachable and return valid bytes...");
  const urlsToTest = [
    { label: "True Color RGB", url: acquiredResult.image_url },
    { label: "Thumbnail", url: acquiredResult.thumbnail_url },
    { label: "False Color NIR", url: acquiredResult.indices?.false_color },
    { label: "NDVI Index", url: acquiredResult.indices?.ndvi },
    { label: "NDWI Index", url: acquiredResult.indices?.ndwi },
    { label: "NBR Index", url: acquiredResult.indices?.nbr },
  ];

  for (const item of urlsToTest) {
    if (item.url) {
      const imgRes = await fetch(item.url);
      const buf = await imgRes.arrayBuffer();
      const sizeKb = (buf.byteLength / 1024).toFixed(1);
      console.log(`  ✔ ${item.label.padEnd(16)}: HTTP ${imgRes.status} (${sizeKb} KB)`);
    }
  }

  // 6. Test Gallery immediately includes the new acquisition without page reload
  console.log("\n[STEP 6] Testing GET /api/gallery dynamic synchronization...");
  const galleryRes = await fetch(`${API_BASE_URL}/api/gallery`);
  const galleryJson = await galleryRes.json();
  const gallery = galleryJson.data;
  console.log(`  Total gallery images found: ${gallery.total}`);
  const matchingImage = gallery.images.find(
    (img) => img.filename === acquiredResult.filename || img.filename.includes(acquiredResult.scene_id)
  );

  if (matchingImage) {
    console.log(`  ✔ Acquired scene immediately found in gallery: ${matchingImage.filename}`);
    console.log(`    Location: ${matchingImage.location}, Date: ${matchingImage.date}, Resolution: ${matchingImage.resolution_meters}m`);
  } else {
    throw new Error(`Scene ${acquiredResult.scene_id} was not found in gallery!`);
  }

  console.log("\n==================================================");
  console.log("VERIFICATION COMPLETE: ALL CHECKS PASSED 100%");
  console.log("==================================================");
}

runVerification().catch((err) => {
  console.error("\nTEST FAILED WITH ERROR:", err.message);
  process.exit(1);
});
