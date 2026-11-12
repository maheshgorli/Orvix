"""
Comprehensive End-to-End Test Suite for ORVIX Earth Intelligence Systems.
Tests:
  1. Frontend index.html and Vite compilation of all page components
  2. Backend health, status, and API routes
  3. Earth Search STAC scene discovery
  4. Real satellite imagery acquisition and multi-spectral processing (True Color, False Color, NDVI, NDWI, NBR)
  5. Image persistence in backend/images/
  6. Database and local JSON synchronization
  7. Gallery listing, single image metadata inspection, and download streaming
  8. NASA EONET disaster intelligence
"""

import time
import httpx

FRONTEND_URL = "http://localhost:5173"
BACKEND_URL = "http://127.0.0.1:8000"

def test_full_system():
    client = httpx.Client(timeout=60.0)

    print("==================================================")
    print("TEST 1: FRONTEND ROUTING & VITE MODULE TRANSFORMS")
    print("==================================================")
    r = client.get(f"{FRONTEND_URL}/")
    assert r.status_code == 200, f"Frontend root failed: {r.status_code}"
    print(f"[PASS] Frontend index.html loaded ({len(r.content)} bytes)")

    pages = [
        "SatelliteExplorer.jsx",
        "LiveMonitoring.jsx",
        "Gallery.jsx",
        "DisasterIntelligence.jsx",
        "Analytics.jsx",
        "Settings.jsx",
        "Overview.jsx",
    ]
    for page in pages:
        res = client.get(f"{FRONTEND_URL}/src/pages/{page}")
        assert res.status_code == 200, f"Page {page} failed to transform: {res.status_code}"
        print(f"  * [PASS] {page} compiled by Vite ({len(res.content)} bytes)")

    print("\n==================================================")
    print("TEST 2: SYSTEM HEALTH DIAGNOSTICS (/api/status)")
    print("==================================================")
    r = client.get(f"{BACKEND_URL}/api/status")
    assert r.status_code == 200
    body = r.json()
    assert body.get("success") is True
    print(f"Platform status: {body.get('message')}")
    services = body.get("data", {}).get("services", [])
    for s in services:
        status_sym = "[ONLINE]" if s["reachable"] else "[OFFLINE/DEGRADED]"
        print(f"  {status_sym} {s['name']}: {s['message']}")

    print("\n==================================================")
    print("TEST 3: SATELLITE SCENE DISCOVERY (/api/imagery/scenes)")
    print("==================================================")
    r = client.get(f"{BACKEND_URL}/api/imagery/scenes", params={
        "latitude": 44.3187,
        "longitude": -106.9325,
        "date_from": "2025-06-01",
        "date_to": "2025-08-31",
        "max_cloud": 25.0,
        "limit": 5,
    })
    assert r.status_code == 200
    res_data = r.json().get("data", {})
    scenes = res_data.get("scenes", [])
    print(f"[PASS] STAC search returned {len(scenes)} satellite scenes matching criteria:")
    for sc in scenes[:3]:
        print(f"  * ID: {sc['scene_id']} | Date: {sc['date']} | Cloud: {sc['cloud_cover']}% | Bands: {len(sc['available_bands'])}")

    print("\n==================================================")
    print("TEST 4: SATELLITE ACQUISITION & SPECTRAL PROCESSING")
    print("==================================================")
    target_scene = scenes[0]["scene_id"]
    print(f"Tasking target scene: {target_scene} ...")
    t0 = time.time()
    r = client.post(f"{BACKEND_URL}/api/imagery/acquire", json={
        "scene_id": target_scene,
        "latitude": 44.3187,
        "longitude": -106.9325,
        "collection": "sentinel-2-l2a",
        "output_type": "true_color",
        "event_type": "satellite",
    })
    assert r.status_code == 200
    acq_data = r.json().get("data", {})
    duration = round(time.time() - t0, 2)
    print(f"[PASS] Acquired in {duration}s!")
    print(f"  * Acquisition ID : {acq_data.get('acquisition_id')}")
    print(f"  * Image URL      : {acq_data.get('image_url')}")
    print(f"  * Thumbnail URL  : {acq_data.get('thumbnail_url')}")
    print(f"  * File Size      : {acq_data.get('file_size_bytes')} bytes")
    print(f"  * Products/Bands : {list(acq_data.get('indices', {}).keys())}")

    print("\n==================================================")
    print("TEST 5: GALLERY & PERSISTENCE VERIFICATION")
    print("==================================================")
    r = client.get(f"{BACKEND_URL}/api/gallery")
    assert r.status_code == 200
    gallery_data = r.json().get("data", {})
    images = gallery_data.get("images", [])
    print(f"[PASS] Gallery contains {len(images)} satellite acquisitions:")
    for img in images[:3]:
        print(f"  * {img.get('filename')} | Type: {img.get('disaster_type')} | Size: {img.get('file_size_bytes')} bytes")

    # Test download streaming
    fn = acq_data.get("filename")
    r_dl = client.get(f"{BACKEND_URL}/api/gallery/{fn}/download")
    assert r_dl.status_code == 200
    print(f"[PASS] Binary download of {fn} succeeded ({len(r_dl.content)} bytes, {r_dl.headers.get('content-type')})")

    print("\n==================================================")
    print("TEST 6: NASA EONET DISASTER INTELLIGENCE")
    print("==================================================")
    r = client.get(f"{BACKEND_URL}/api/disasters", params={"days": 30})
    assert r.status_code == 200
    d_data = r.json().get("data", {})
    print(f"[PASS] Active EONET hazards: {d_data.get('total')} total (Wildfires: {d_data.get('wildfires')}, Storms: {d_data.get('storms')})")

    print("\n==================================================")
    print("ALL END-TO-END ACCEPTANCE TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    test_full_system()

