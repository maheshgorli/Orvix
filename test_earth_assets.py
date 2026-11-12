
import requests

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

response = requests.post(
    f"{API}/search",
    json=payload,
    timeout=60
)
response.raise_for_status()

items = response.json().get("features", [])

print("Scenes found:", len(items))

for item in items:
    print("\nScene:", item["id"])
    print("Date:", item["properties"].get("datetime"))

    for name, asset in item.get("assets", {}).items():
        href = asset.get("href", "")

        if href.startswith("https://"):
            print("PUBLIC HTTPS ASSET:", name)
            print(href)
        elif href.startswith("s3://"):
            print("S3 ASSET:", name, "(check access requirements)")
