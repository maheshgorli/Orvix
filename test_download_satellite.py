
import requests
from pathlib import Path

API = "https://earth-search.aws.element84.com/v1"

payload = {
    "collections": ["sentinel-2-l2a"],
    "bbox": [
        -106.9825, 44.2687,
        -106.8825, 44.3687
    ],
    "datetime": "2025-06-01T00:00:00Z/2025-08-31T23:59:59Z",
    "limit": 3
}

output_dir = Path("satellite_test_downloads")
output_dir.mkdir(exist_ok=True)

try:
    print("Searching satellite scenes...")

    search = requests.post(
        f"{API}/search",
        json=payload,
        timeout=60
    )
    search.raise_for_status()

    scenes = search.json().get("features", [])

    if not scenes:
        raise RuntimeError("No satellite scenes found.")

    scene = scenes[0]
    assets = scene.get("assets", {})

    print("Selected scene:", scene["id"])

    # Select actual Blue spectral band
    blue_asset = assets.get("blue")

    if not blue_asset:
        raise RuntimeError("Blue band is unavailable.")

    image_url = blue_asset["href"]

    print("Downloading Blue band...")

    response = requests.get(
        image_url,
        stream=True,
        timeout=120
    )
    response.raise_for_status()

    output_file = output_dir / "satellite_blue_B02.tif"

    with open(output_file, "wb") as file:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if chunk:
                file.write(chunk)

    size_mb = output_file.stat().st_size / (1024 * 1024)

    if size_mb == 0:
        raise RuntimeError("Downloaded file is empty.")

    with open(output_file, "rb") as file:
        signature = file.read(4)

    if signature not in (b"II*\x00", b"MM\x00*"):
        raise RuntimeError(
            "Downloaded response does not look like a TIFF image."
        )

    print("\nSUCCESS: Satellite image downloaded!")
    print("Saved to:", output_file.resolve())
    print(f"File size: {size_mb:.2f} MB")
    print("Format: TIFF")

except Exception as error:
    print("\nDOWNLOAD FAILED:", error)
