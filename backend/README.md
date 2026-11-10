# Backend

**Required working directory:** `backend/` (the folder that directly contains `app/`)

**Required startup command:**

cd backend
uvicorn app.main:app --reload

This matches `start_backend.bat`.

Do NOT run `uvicorn backend.app.main:app --reload` from the repo root —
that command matches an old import style this codebase no longer uses.
Every file under `app/` now imports as `from app.config import settings`,
`from app.services.image_service import image_service`, etc. — all rooted
at `app.`, not `backend.app.`. Running uvicorn from the repo root will fail
with:

ModuleNotFoundError: No module named 'app'

## Setup

cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r ../Requirements.txt
copy .env.example .env         # Windows
# cp .env.example .env         # macOS/Linux

Then fill in `backend/.env` with real values — see the OAuth section below.

## OAuth / Sentinel Hub (Copernicus Data Space Ecosystem)

This app authenticates against the Copernicus Data Space Ecosystem (CDSE),
not the old standalone Sentinel Hub service. You need OAuth credentials
created specifically at:

https://shapps.dataspace.copernicus.eu/dashboard/#/account/settings

Old credentials from `services.sentinel-hub.com` will NOT work here and will
fail with a 401 `invalid_client` error. Put the CDSE client ID/secret into
`backend/.env`:

SENTINEL_CLIENT_ID=your_cdse_client_id
SENTINEL_CLIENT_SECRET=your_cdse_client_secret

## Verifying it's running correctly

curl http://127.0.0.1:8000/
curl http://127.0.0.1:8000/sentinel-test
curl http://127.0.0.1:8000/auth/token

`sentinel-test` and `auth/token` should return "authenticated": true /
"success": true once real CDSE credentials are set.
