const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

export type Asset = {
  asset_id: string;
  asset_type: string;
  latitude: number;
  longitude: number;
  distance_m?: number;
};

export type AssetsResponse = {
  total: number;
  assets: Asset[];
};

export type ValidationError = {
  row?: number | string;
  message?: string;
  error?: string;
  [key: string]: unknown;
};

export type ValidationResponse = {
  total_records?: number;
  valid_records?: number;
  invalid_records?: number;
  total?: number;
  valid?: number;
  invalid?: number;
  errors?: ValidationError[];
  [key: string]: unknown;
};

export type ImportResponse = {
  inserted_records: number;
  skipped_existing_records: number;
  validation?: ValidationResponse;
  [key: string]: unknown;
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${url}`, options);

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data.detail === "string"
        ? data.detail
        : `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data as T;
}

export async function fetchAssets(): Promise<AssetsResponse> {
  return request<AssetsResponse>("/assets");
}

export async function fetchNearbyAssets(
  latitude: number,
  longitude: number,
  radiusM: number,
) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    radius_m: String(radiusM),
  });

  return request<{
    search_location: { latitude: number; longitude: number };
    radius_m: number;
    total_found: number;
    assets: Asset[];
  }>(`/assets/nearby?${params.toString()}`);
}

export async function validateCsv(
  file: File,
): Promise<ValidationResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return request<ValidationResponse>("/assets/validate", {
    method: "POST",
    body: formData,
  });
}

export async function importCsv(file: File): Promise<ImportResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return request<ImportResponse>("/assets/import", {
    method: "POST",
    body: formData,
  });
}