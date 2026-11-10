# MongoDB Setup & Persistence Architecture — ORVIX

This document provides setup instructions, schema specifications, and operational guidance for the MongoDB persistence layer in ORVIX (Earth Intelligence Systems).

---

## 1. Overview & Architecture

ORVIX uses an asynchronous persistence model powered by **Motor** (`motor.motor_asyncio`) and **PyMongo**:

- **File Storage on Disk**: Satellite image files (PNG format) are saved directly to the local filesystem under `backend/images/`.
- **Database Storage**: MongoDB stores only structured metadata, spatial coordinates, time-stamped telemetry, and the relative filesystem path (`images/{filename}`).
- **Graceful Fallback**: If MongoDB is not running or `MONGODB_URI` is omitted from `backend/.env`, the backend boots normally and operates in memory/disk-only mode. No requests crash or fail.

---

## 2. Quickstart Setup Options

### Option A: Docker (Recommended for Local Development)

Run MongoDB in a lightweight Docker container:

```bash
docker run -d \
  --name orvix-mongodb \
  -p 27017:27017 \
  -v orvix_mongo_data:/data/db \
  mongo:7.0
```

To stop and start the container:
```bash
docker stop orvix-mongodb
docker start orvix-mongodb
```

### Option B: Native Windows Installation

1. Download the MongoDB Community Server MSI installer from:
   [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
2. Follow the setup wizard, selecting **Complete** setup and ensuring **Install MongoDB as a Service** is checked.
3. Verify the service is running in PowerShell:
   ```powershell
   Get-Service MongoDB
   ```

### Option C: MongoDB Atlas (Cloud)

1. Create a free M0 cluster at [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Obtain your connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority
   ```
3. Paste the connection string into `backend/.env` as `MONGODB_URI`.

---

## 3. Environment Configuration

Add the following variables to `backend/.env`:

```env
# MongoDB Connection URI
MONGODB_URI=mongodb://localhost:27017

# Target Database Name
MONGODB_DB_NAME=orvix
```

---

## 4. Collections & Schemas

The database service automatically ensures indexes upon connection:

### 1. `disaster_events`
Stores natural events fetched from NASA EONET.
- **Deduplication**: Enforced via a unique index on `event_id`. Subsequent fetches perform an upsert (`$set`), updating `updated_at` without duplicating records.
- **Indexes**:
  * `event_id`: Unique
  * `category_id`: Ascending
  * `date`: Descending

### 2. `image_metadata`
Stores metadata and spatial bounding boxes for downloaded Sentinel-2 images.
- **Indexes**:
  * `filename`: Unique
  * `captured_at`: Descending
  * `(latitude, longitude)`: Compound 2D/coordinate index

### 3. `acquisition_history`
Chronological log of imagery fetch requests, query boundaries, success/failure statuses, and error diagnostics.
- **Indexes**: `timestamp`: Descending

### 4. `monitoring_sessions`
Records of batch monitoring runs (`GET /api/monitor`), tracking total events inspected, images saved, and error diagnostics.
- **Indexes**: `timestamp`: Descending

### 5. `alerts`
Alert notifications generated when high-severity disaster events are detected near critical zones.
- **Indexes**: `created_at`: Descending

### 6. `detection_results`
Records produced by the image analysis pipeline for detected disasters and confidence ratings.
- **Indexes**: `image_id`: Ascending

---

## 5. Verifying the Connection

Check backend service reachability:

```powershell
# Using PowerShell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/status" | ConvertTo-Json -Depth 4
```

Expected response when MongoDB is connected:
```json
{
  "name": "MongoDB Database",
  "reachable": true,
  "status_code": 200,
  "message": "Connected to MongoDB database 'orvix'."
}
```

Expected response when MongoDB is unconfigured or offline (app continues running):
```json
{
  "name": "MongoDB Database",
  "reachable": false,
  "status_code": null,
  "message": "MongoDB is not configured (MONGODB_URI not set). App running with memory/disk persistence only."
}
```

