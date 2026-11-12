/**
 * Centralized API client for ORVIX (Earth Intelligence Systems).
 *
 * All primary communications target `/api/*` endpoints.
 * Automatically unwraps the uniform `{ success, message, data, error }` response envelope.
 */
import axios from "axios";

export const API_BASE_URL = "http://127.0.0.1:8000";

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 25000,
});

/**
 * Perform a GET request and unwrap the `ApiResponse[T]` envelope.
 * Throws an Error with the server's message/error if success is false.
 */
export async function apiGet(path, params = {}) {
  try {
    const res = await client.get(path, { params });
    if (!res.data || res.data.success === false) {
      const err = res.data?.error || res.data?.message || `Request to ${path} failed`;
      throw new Error(err);
    }
    return res.data.data;
  } catch (err) {
    if (err.response?.data) {
      const serverErr = err.response.data.error || err.response.data.message || err.response.data.detail;
      if (serverErr) throw new Error(serverErr, { cause: err });
    }
    throw err;
  }
}

/**
 * Perform a POST request and unwrap the `ApiResponse[T]` envelope.
 */
export async function apiPost(path, body = {}) {
  try {
    const res = await client.post(path, body);
    if (!res.data || res.data.success === false) {
      const err = res.data?.error || res.data?.message || `POST to ${path} failed`;
      throw new Error(err);
    }
    return res.data.data;
  } catch (err) {
    if (err.response?.data) {
      const serverErr = err.response.data.error || err.response.data.message || err.response.data.detail;
      if (serverErr) throw new Error(serverErr, { cause: err });
    }
    throw err;
  }
}

/**
 * Perform a DELETE request and unwrap the `ApiResponse[T]` envelope.
 */
export async function apiDelete(path) {
  try {
    const res = await client.delete(path);
    if (!res.data || res.data.success === false) {
      const err = res.data?.error || res.data?.message || `DELETE to ${path} failed`;
      throw new Error(err);
    }
    return res.data.data;
  } catch (err) {
    if (err.response?.data) {
      const serverErr = err.response.data.error || err.response.data.message || err.response.data.detail;
      if (serverErr) throw new Error(serverErr, { cause: err });
    }
    throw err;
  }
}

// ── Specific /api/* Endpoint Helpers ──────────────────────────────────────────

/** Fetch health status for NASA EONET, Copernicus CDSE, and MongoDB */
export function getSystemStatus() {
  return apiGet("/api/status");
}

/** Fetch Copernicus CDSE OAuth token metadata (redacted) */
export function getTokenInfo() {
  return apiGet("/api/token");
}

/** Fetch active disaster events (wildfires and severe storms) */
export function getDisasters(params = {}) {
  return apiGet("/api/disasters", params);
}

/** Fetch metadata for the most recently acquired satellite image */
export function getLatestImage() {
  return apiGet("/api/latest-image");
}

/** Fetch list of all saved satellite imagery */
export function getGallery() {
  return apiGet("/api/gallery");
}

/** Fetch pipeline implementation status (validation, spectral, model) */
export function getAnalysisStatus() {
  return apiGet("/api/analysis/status");
}

/** Acquire and save a Sentinel-2 true-colour image */
export function postCaptureImage(body) {
  return apiPost("/api/image", body);
}

/** Permanently delete a stored satellite image by filename */
export function deleteImage(filename) {
  return apiDelete(`/api/image/${encodeURIComponent(filename)}`);
}

/** Fetch historical image downloads with optional type filter */
export function getHistory(params = {}) {
  return apiGet("/api/history", params);
}

/** Search Earth Search STAC catalogue for scenes matching coords, dates, cloud cover */
export function searchSatelliteScenes(params = {}) {
  return apiGet("/api/imagery/scenes", params);
}

/** Acquire and composite a satellite scene (True Color, False Color, NDVI, NDWI, NBR) */
export function acquireSatelliteScene(body = {}) {
  return apiPost("/api/imagery/acquire", body);
}

/** Fetch metadata for the most recently acquired satellite scene */
export function getLatestAcquisition() {
  return apiGet("/api/imagery/latest");
}

/** Fetch details for a specific acquisition */
export function getAcquisitionDetails(sceneId) {
  return apiGet(`/api/imagery/${encodeURIComponent(sceneId)}`);
}

/** Fetch available satellite collections */
export function getSatelliteCollections() {
  return apiGet("/api/imagery/collections");
}

/** Download raster or PNG file URL */
export function getDownloadUrl(filename) {
  return `${API_BASE_URL}/api/gallery/${encodeURIComponent(filename)}/download`;
}

/** Batch trigger NASA disaster monitoring and Sentinel-2 acquisition */
export function getMonitor(params = {}) {
  return apiGet("/api/monitor", params);
}

export default client;
