
import os
import requests
from dotenv import load_dotenv
from pathlib import Path

# Find the backend .env file
env_path = Path("backend/.env")
load_dotenv(env_path)

client_id = os.getenv("SENTINEL_CLIENT_ID")
client_secret = os.getenv("SENTINEL_CLIENT_SECRET")

TOKEN_URL = (
    "https://identity.dataspace.copernicus.eu/"
    "auth/realms/CDSE/protocol/openid-connect/token"
)

print("Checking Copernicus credentials...")

if not client_id or not client_secret:
    print("FAILED: Client ID or Client Secret not loaded.")
    print("Expected .env location:", env_path.resolve())

else:
    try:
        response = requests.post(
            TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
            timeout=30,
        )

        print("HTTP Status:", response.status_code)

        if response.status_code == 200:
            print("SUCCESS: Copernicus authentication works!")
        else:
            print("Authentication failed:")
            print(response.text[:500])

    except requests.RequestException as error:
        print("Network error:", error)
