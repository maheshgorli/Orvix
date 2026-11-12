
import requests
import numpy as np
import rasterio
from PIL import Image
from pathlib import Path

API = "https://earth-search.aws.element84.com/v1"

bbox = [
    -106.9825, 44.2687,
    -106.8825, 44.3687
]

payload = {
    "collections": ["sentinel-2-l2a"],
    "bbox": bbox,
    "datetime": "2025-06-01T00:00:00Z/2025-08-31T23:59:59Z",
    "limit": 3
}

output = Path("satellite_rgb")
output.mkdir(exist_ok=True)

print("Searching for satellite scenes...")

response = requests.post(
    f"{API}/search",
    json=payload,
    timeout=60
)
response.raise_for_status()

scenes = response.json()["features"]

if not scenes:
    raise RuntimeError("No scenes found")

# Choose a scene with the lowest available cloud cover
scene = min(
    scenes,
    key=lambda s: s["properties"].get("eo:cloud_cover", 100)
)

print("Selected:", scene["id"])

assets = scene["assets"]

bands = {
    "red": assets["red"]["href"],
    "green": assets["green"]["href"],
    "blue": assets["blue"]["href"]
}

arrays = []

for name, url in bands.items():
    print("Downloading:", name)

    response = requests.get(url, timeout=180)
    response.raise_for_status()

    path = output / f"{name}.tif"
    path.write_bytes(response.content)

    with rasterio.open(path) as src:
        band = src.read(1).astype(np.float32)
        arrays.append(band)

# RGB combination: Red, Green, Blue
rgb = np.stack(arrays, axis=-1)

# Percentile contrast stretching
valid = np.all(np.isfinite(rgb), axis=2)

result = np.zeros(rgb.shape, dtype=np.uint8)

for channel in range(3):
    values = rgb[:, :, channel][valid]

    low, high = np.percentile(values, [2, 98])

    if high > low:
        stretched = np.clip(
            (rgb[:, :, channel] - low) /
            (high - low), 0, 1
        )
        result[:, :, channel] = (
            stretched * 255
        ).astype(np.uint8)

image = Image.fromarray(result, mode="RGB")
image.save(output / "true_color_satellite.png")

print("\nSUCCESS!")
print("RGB image:", (output / "true_color_satellite.png").resolve())
print("Dimensions:", image.size)
