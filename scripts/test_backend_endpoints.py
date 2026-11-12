"""
Automated backend verification script for ORVIX Earth Intelligence Systems.
"""

import sys
from pathlib import Path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app

def run_tests():
    client = TestClient(app)

    print("========================================")
    print("1. Root Endpoint GET /")
    print("========================================")
    r = client.get("/")
    assert r.status_code == 200, f"Root failed: {r.status_code}"
    print("OK:", r.json())

    print("\n========================================")
    print("2. Platform Health Check GET /api/status")
    print("========================================")
    r = client.get("/api/status")
    assert r.status_code == 200, f"Status failed: {r.status_code}"
    body = r.json()
    print("Success:", body.get("success"), "| Message:", body.get("message"))
    for s in body.get("data", {}).get("services", []):
        print(f"  * {s['name']}: reachable={s['reachable']} | {s['message']}")

    print("\n========================================")
    print("3. Satellite Scene Search GET /api/imagery/scenes")
    print("========================================")
    r = client.get("/api/imagery/scenes", params={
        "latitude": 44.3187,
        "longitude": -106.9325,
        "date_from": "2025-06-01",
        "date_to": "2025-08-31",
        "max_cloud": 20,
        "limit": 3
    })
    assert r.status_code == 200, f"Scenes search failed: {r.status_code}"
    body = r.json()
    scenes = body.get("data", {}).get("scenes", [])
    print(f"Total scenes found: {len(scenes)}")
    for sc in scenes:
        print(f"  * Scene: {sc['scene_id']} | Date: {sc['date']} | Cloud: {sc['cloud_cover']}% | Bands: {len(sc['available_bands'])}")

    print("\n========================================")
    print("4. NASA EONET Disasters GET /api/disasters")
    print("========================================")
    r = client.get("/api/disasters", params={"days": 30})
    assert r.status_code == 200, f"Disasters failed: {r.status_code}"
    d_data = r.json().get("data", {})
    print(f"Total active events: {d_data.get('total')}, Wildfires: {d_data.get('wildfires')}, Storms: {d_data.get('storms')}")

    print("\n========================================")
    print("5. Gallery GET /api/gallery")
    print("========================================")
    r = client.get("/api/gallery")
    assert r.status_code == 200, f"Gallery failed: {r.status_code}"
    g_data = r.json().get("data", {})
    print(f"Total gallery images: {g_data.get('total')}")

    print("\n========================================")
    print("6. Satellite Acquisition POST /api/imagery/acquire")
    print("========================================")
    r = client.post("/api/imagery/acquire", json={
        "scene_id": "S2A_13TCK_20250823_1_L2A",
        "latitude": 44.3187,
        "longitude": -106.9325,
        "collection": "sentinel-2-l2a",
        "output_type": "true_color",
        "event_type": "satellite"
    })
    assert r.status_code == 200, f"Acquire failed: {r.status_code} {r.text}"
    acq_body = r.json()
    assert acq_body.get("success") is True, f"Acquire error: {acq_body.get('error')}"
    data = acq_body.get("data", {})
    print("Acquisition ID:", data.get("acquisition_id"))
    print("Image URL:", data.get("image_url"))
    print("Thumbnail URL:", data.get("thumbnail_url"))
    print("File size bytes:", data.get("file_size_bytes"))
    print("Spectral indices generated:", list(data.get("indices", {}).keys()))

    print("\n========================================")
    print("7. Verify Gallery Contains Acquired Image")
    print("========================================")
    r = client.get("/api/gallery")
    assert r.status_code == 200
    g_data = r.json().get("data", {})
    print(f"Total gallery images now: {g_data.get('total')}")
    assert g_data.get("total") >= 1, "Gallery should have at least 1 image now"

    print("\n========================================")
    print("8. Verify Image Download Stream")
    print("========================================")
    fn = data.get("filename")
    r = client.get(f"/api/gallery/{fn}/download")
    assert r.status_code == 200, f"Download failed: {r.status_code}"
    print(f"Downloaded {fn} successfully! Content-Type: {r.headers.get('content-type')}, bytes: {len(r.content)}")

    print("\nALL PRELIMINARY BACKEND API CHECKS PASSED!")

if __name__ == "__main__":
    run_tests()
