
import requests

API_URL = "https://earth-search.aws.element84.com/v1"

# Test location
latitude = 44.3187
longitude = -106.9325
extent = 0.05

bbox = [
    longitude - extent,
    latitude - extent,
    longitude + extent,
    latitude + extent
]

print("Testing Earth Search API...")

try:
    # Check API availability
    response = requests.get(
        f"{API_URL}/collections",
        timeout=30
    )
    response.raise_for_status()
    print("API CONNECTION: SUCCESS")

    # Search Landsat imagery
    payload = {
        "collections": ["landsat-c2-l2"],
        "bbox": bbox,
        "datetime": "2025-06-01T00:00:00Z/2025-08-31T23:59:59Z",
        "limit": 5
    }

    response = requests.post(
        f"{API_URL}/search",
        json=payload,
        timeout=60
    )
    response.raise_for_status()

    results = response.json()
    features = results.get("features", [])

    print("SEARCH SUCCESS")
    print("Scenes found:", len(features))

    for item in features:
        print("\nScene ID:", item.get("id"))
        print("Date:", item.get("properties", {}).get("datetime"))
        print("Cloud cover:", item.get("properties", {}).get("eo:cloud_cover"))

        print("Available assets:")
        for name, asset in item.get("assets", {}).items():
            print(" -", name, asset.get("href", "")[:120])

except requests.RequestException as error:
    print("API REQUEST FAILED:", error)
