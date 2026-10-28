import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

import {
  MapPin,
  LayoutDashboard,
  Layers3,
  FileCheck2,
  Upload,
  Search,
  Bell,
  Settings,
  ChevronDown,
  Activity,
  RadioTower,
  Cable,
  CircleCheck,
  Navigation,
  Crosshair,
  Menu,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  X,
  Map as MapIcon,
  Filter,
  ArrowUpRight,
  LoaderCircle,
} from "lucide-react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

import {
  fetchAssets,
  fetchNearbyAssets,
  validateCsv,
  importCsv,
  type Asset,
} from "./api";

/* =========================================================
   CONFIGURATION
========================================================= */

const DEFAULT_CENTER: [number, number] = [9.27, 76.78];

const assetIcon = L.divIcon({
  className: "asset-marker-wrapper",
  html: '<div class="asset-marker"><span></span></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const navigationItems = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Asset Explorer", icon: MapPin },
  { name: "Data Validation", icon: FileCheck2 },
  { name: "Import Data", icon: Upload },
] as const;

type PageName = (typeof navigationItems)[number]["name"];

type GenericResult = Record<string, unknown>;

type NearbyResult = {
  assets: Asset[];
  total_found?: number;
  radius_m?: number;
};

type ImportSummary = {
  inserted?: number;
  skipped?: number;
  total?: number;
  valid?: number;
  invalid?: number;
};

/* =========================================================
   HELPERS
========================================================= */

function assetTypeLabel(type: string): string {
  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

function getNumber(
  data: GenericResult | null,
  keys: string[],
): number | null {
  if (!data) return null;

  for (const key of keys) {
    const value = data[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function getArrayFromResponse(
  data: GenericResult | null,
  keys: string[],
): unknown[] {
  if (!data) return [];

  for (const key of keys) {
    if (Array.isArray(data[key])) {
      return data[key] as unknown[];
    }
  }

  return [];
}

function formatDistance(meters?: number): string {
  if (meters === undefined || !Number.isFinite(meters)) {
    return "Distance unavailable";
  }

  return meters >= 1000
    ? `${(meters / 1000).toFixed(2)} km`
    : `${Math.round(meters)} m`;
}

/* =========================================================
   MAP COMPONENTS
========================================================= */

function MapRecenter({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const map = useMap();

  return (
    <button
      className="map-control"
      title="Center map on selected asset"
      aria-label="Center map on selected asset"
      onClick={() => map.setView([latitude, longitude], 15)}
    >
      <Crosshair size={17} />
    </button>
  );
}

/* =========================================================
   REUSABLE UI COMPONENTS
========================================================= */

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="page-heading">
      <div>
        <div className="eyebrow">
          <span className="eyebrow-line" />
          {eyebrow}
        </div>

        <h2>
          {title}
          <span>.</span>
        </h2>

        <p>{description}</p>
      </div>

      {action}
    </section>
  );
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      {action}
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  color,
  loading,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: ReactNode;
  color: string;
  loading?: boolean;
}) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <div className={`stat-icon ${color}`}>{icon}</div>
      </div>

      <div className="stat-value">
        {loading ? "—" : value}
      </div>

      <div className="stat-foot">
        <span className={`mini-dot ${color}-dot`} />
        <span>{description}</span>
      </div>
    </article>
  );
}

function StatusMessage({
  type,
  children,
}: {
  type: "success" | "error" | "info";
  children: ReactNode;
}) {
  const icon =
    type === "success" ? (
      <CheckCircle2 size={18} />
    ) : type === "error" ? (
      <AlertCircle size={18} />
    ) : (
      <Activity size={18} />
    );

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "13px 15px",
        marginTop: 16,
        borderRadius: 10,
        border:
          type === "success"
            ? "1px solid #bbf7d0"
            : type === "error"
              ? "1px solid #fecaca"
              : "1px solid #c7d2fe",
        background:
          type === "success"
            ? "#f0fdf4"
            : type === "error"
              ? "#fef2f2"
              : "#eef2ff",
        color:
          type === "success"
            ? "#166534"
            : type === "error"
              ? "#991b1b"
              : "#3730a3",
        fontSize: 13,
        lineHeight: 1.6,
        overflowWrap: "anywhere",
      }}
    >
      {icon}
      <div>{children}</div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="empty-state"
      style={{
        padding: 30,
        textAlign: "center",
      }}
    >
      <div style={{ marginBottom: 12 }}>{icon}</div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        padding: 24,
        color: "#64748b",
        fontSize: 14,
      }}
    >
      <LoaderCircle size={18} className="spin" />
      {message}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  secondary = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  secondary?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={secondary ? "secondary-button" : "primary-button"}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

/* =========================================================
   MAP VIEW
========================================================= */

function AssetMap({
  assets,
  selectedAsset,
  onSelect,
  radius,
}: {
  assets: Asset[];
  selectedAsset: Asset | null;
  onSelect: (asset: Asset) => void;
  radius: number;
}) {
  const map = useMapReference();

  return (
    <div className="map-frame">
      <div className="map-overlay-label">
        <MapPin size={15} />
        <span>ASSET LOCATIONS</span>
      </div>

      <MapContainer
        center={
          selectedAsset
            ? [selectedAsset.latitude, selectedAsset.longitude]
            : DEFAULT_CENTER
        }
        zoom={selectedAsset ? 13 : 9}
        scrollWheelZoom
        className="leaflet-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {assets.map((asset) => (
          <Marker
            key={asset.asset_id}
            position={[asset.latitude, asset.longitude]}
            icon={assetIcon}
            eventHandlers={{
              click: () => {
                onSelect(asset);
              },
            }}
          >
            <Popup>
              <strong>{asset.asset_id}</strong>
              <br />
              {assetTypeLabel(asset.asset_type)}
              <br />
              {asset.latitude.toFixed(5)},{" "}
              {asset.longitude.toFixed(5)}
            </Popup>
          </Marker>
        ))}

        {selectedAsset && (
          <>
            <MapRecenter
              latitude={selectedAsset.latitude}
              longitude={selectedAsset.longitude}
            />

            <Circle
              center={[
                selectedAsset.latitude,
                selectedAsset.longitude,
              ]}
              radius={radius}
              pathOptions={{
                color: "#635bda",
                fillColor: "#635bda",
                fillOpacity: 0.07,
                weight: 1,
                dashArray: "5 6",
              }}
            />
          </>
        )}
      </MapContainer>

      <div className="map-legend">
        <span className="legend-marker" />
        <span>Telecom asset</span>
        <span className="legend-circle" />
        <span>Search radius</span>
      </div>
    </div>
  );
}

/*
 * This helper keeps the map view code separate from the dashboard.
 * The actual map state remains managed by React Leaflet.
 */
function useMapReference() {
  return useRef<HTMLDivElement | null>(null);
}

/* =========================================================
   MAIN APP
========================================================= */

function App() {
  const [activePage, setActivePage] = useState<PageName>("Overview");

  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [radius, setRadius] = useState("5000");

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [nearbyAssets, setNearbyAssets] =
    useState<Asset[] | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [validation, setValidation] =
    useState<GenericResult | null>(null);
  const [importResult, setImportResult] =
    useState<GenericResult | null>(null);

  const [fileError, setFileError] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [validationCompleted, setValidationCompleted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* -------------------------------------------------------
     LOAD ASSETS
  ------------------------------------------------------- */

  const loadAssets = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError(null);

      const response = await fetchAssets();

      const loadedAssets = Array.isArray(response.assets)
        ? response.assets
        : [];

      setAssets(loadedAssets);

      setSelectedAsset((current) => {
        if (!current) {
          return loadedAssets[0] ?? null;
        }

        return (
          loadedAssets.find(
            (asset) => asset.asset_id === current.asset_id,
          ) ?? loadedAssets[0] ?? null
        );
      });

      setLastUpdated(new Date());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAssets();

    // loadAssets is stable because it is wrapped in useCallback.
  }, [loadAssets]);

  /* -------------------------------------------------------
     FILTERS AND COUNTS
  ------------------------------------------------------- */

  const fibreCount = useMemo(
    () =>
      assets.filter(
        (asset) => asset.asset_type.toLowerCase() === "fibre_node",
      ).length,
    [assets],
  );

  const towerCount = useMemo(
    () =>
      assets.filter((asset) =>
        ["tower", "cell_tower"].includes(
          asset.asset_type.toLowerCase(),
        ),
      ).length,
    [assets],
  );

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesSearch = `${asset.asset_id} ${asset.asset_type}`
        .toLowerCase()
        .includes(search.toLowerCase().trim());

      const normalizedType = asset.asset_type.toLowerCase();

      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "fibre_node" &&
          normalizedType === "fibre_node") ||
        (typeFilter === "tower" &&
          ["tower", "cell_tower"].includes(normalizedType));

      return matchesSearch && matchesType;
    });
  }, [assets, search, typeFilter]);

  /* -------------------------------------------------------
     FILE SELECTION
  ------------------------------------------------------- */

  function handleCsvChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setFileError("");
    setValidation(null);
    setImportResult(null);
    setValidationCompleted(false);
    setCsvFile(null);

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFileError("Please select a file with the .csv extension.");
      event.target.value = "";
      return;
    }

    setCsvFile(file);
  }

  function resetFileWorkflow() {
    setCsvFile(null);
    setValidation(null);
    setImportResult(null);
    setFileError("");
    setValidationCompleted(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  /* -------------------------------------------------------
     VALIDATE CSV
  ------------------------------------------------------- */

  async function handleValidate() {
    if (!csvFile) {
      setFileError("Please choose a CSV file first.");
      return;
    }

    try {
      setFileLoading(true);
      setFileError("");
      setValidation(null);
      setImportResult(null);
      setValidationCompleted(false);

      const result = await validateCsv(csvFile);

      setValidation(result as GenericResult);
      setValidationCompleted(true);
    } catch (err) {
      setFileError(getErrorMessage(err));
    } finally {
      setFileLoading(false);
    }
  }

  /* -------------------------------------------------------
     IMPORT CSV
  ------------------------------------------------------- */

  async function handleImport() {
    if (!csvFile) {
      setFileError("Please choose a CSV file first.");
      return;
    }

    if (!validationCompleted || !validation) {
      setFileError(
        "Validate the selected CSV before importing it.",
      );
      return;
    }

    const invalidCount = getNumber(validation, [
      "invalid_records",
      "invalid",
      "invalid_count",
    ]);

    if (invalidCount !== null && invalidCount > 0) {
      const confirmed = window.confirm(
        `Validation found ${invalidCount} invalid record(s). ` +
          "Your backend must safely reject invalid records. Continue with the import request?",
      );

      if (!confirmed) return;
    }

    try {
      setFileLoading(true);
      setFileError("");
      setImportResult(null);

      const result = await importCsv(csvFile);

      setImportResult(result as GenericResult);

      // Reload database records so the dashboard and map update.
      await loadAssets(false);

      setNearbyAssets(null);
    } catch (err) {
      setFileError(getErrorMessage(err));
    } finally {
      setFileLoading(false);
    }
  }

  /* -------------------------------------------------------
     NEARBY SEARCH
  ------------------------------------------------------- */

  async function runNearbySearch() {
    if (!selectedAsset) {
      setNearbyError("Select an asset first.");
      return;
    }

    try {
      setNearbyLoading(true);
      setNearbyError(null);

      const response = (await fetchNearbyAssets(
        selectedAsset.latitude,
        selectedAsset.longitude,
        Number(radius),
      )) as NearbyResult;

      setNearbyAssets(
        Array.isArray(response.assets) ? response.assets : [],
      );
    } catch (err) {
      setNearbyError(getErrorMessage(err));
    } finally {
      setNearbyLoading(false);
    }
  }

  /* -------------------------------------------------------
     SHARED COMPONENTS
  ------------------------------------------------------- */

  const refreshButton = (
    <ActionButton
      secondary
      onClick={() => void loadAssets(false)}
      disabled={refreshing || loading}
    >
      <RefreshCw size={16} />
      {refreshing ? "Refreshing..." : "Refresh data"}
    </ActionButton>
  );

  const importButton = (
    <ActionButton
      onClick={() => {
        setActivePage("Import Data");
        setSidebarOpen(false);
      }}
    >
      <Upload size={16} />
      Import assets
    </ActionButton>
  );

  const pageDescription: Record<PageName, string> = {
    Overview:
      "A live overview of your telecom assets, spatial distribution, and network data.",
    "Asset Explorer":
      "Search, filter, inspect, and locate registered telecom infrastructure.",
    "Data Validation":
      "Check CSV files for missing values, invalid coordinates, and data-quality issues.",
    "Import Data":
      "Upload a CSV file, validate its records, and import them into the spatial database.",
  };

  /* -------------------------------------------------------
     PAGE CONTENT: OVERVIEW
  ------------------------------------------------------- */

  function renderOverview() {
    return (
      <>
        <PageHeading
          eyebrow="TELECOM INFRASTRUCTURE"
          title="Network overview"
          description={pageDescription.Overview}
          action={importButton}
        />

        {error && (
          <StatusMessage type="error">
            Unable to load assets: {error}
          </StatusMessage>
        )}

        <section className="stats-grid">
          <StatCard
            title="Total assets"
            value={formatNumber(assets.length).padStart(2, "0")}
            description="Registered database records"
            icon={<Layers3 size={19} />}
            color="purple"
            loading={loading}
          />

          <StatCard
            title="Fibre nodes"
            value={formatNumber(fibreCount).padStart(2, "0")}
            description="Fibre infrastructure"
            icon={<Cable size={19} />}
            color="teal"
            loading={loading}
          />

          <StatCard
            title="Cell towers"
            value={formatNumber(towerCount).padStart(2, "0")}
            description="Tower infrastructure"
            icon={<RadioTower size={19} />}
            color="orange"
            loading={loading}
          />

          <StatCard
            title="Data quality"
            value={
              validation
                ? getNumber(validation, [
                    "valid_records",
                    "valid",
                    "valid_count",
                  ]) ?? "Available"
                : "—"
            }
            description={
              validation
                ? "Valid records in last validation"
                : "Validate a CSV to inspect quality"
            }
            icon={<CircleCheck size={19} />}
            color="green"
          />
        </section>

        <section className="map-section">
          <SectionHeader
            title="Geospatial asset map"
            description="Explore the locations of assets registered in your database."
            action={
              <span className="map-badge">
                <span className="status-dot" />
                {assets.length} assets
              </span>
            }
          />

          <div className="map-layout">
            <div style={{ flex: 1, minWidth: 0 }}>
              {loading ? (
                <LoadingState message="Loading asset locations..." />
              ) : assets.length === 0 ? (
                <EmptyState
                  icon={<MapIcon size={28} />}
                  title="No assets to display"
                  description="Import a clean CSV file to populate the map."
                />
              ) : (
                <AssetMap
                  assets={assets}
                  selectedAsset={selectedAsset}
                  onSelect={setSelectedAsset}
                  radius={Number(radius)}
                />
              )}
            </div>

            <aside className="asset-panel">
              <div className="panel-title">
                <div>
                  <h3>Asset explorer</h3>
                  <p>Inspect network records</p>
                </div>

                <span className="record-count">
                  {filteredAssets.length.toString().padStart(2, "0")}
                </span>
              </div>

              <label className="search-box">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search assets..."
                />
              </label>

              <div className="asset-list">
                {filteredAssets.slice(0, 8).map((asset) => (
                  <button
                    key={asset.asset_id}
                    className={`asset-row ${
                      selectedAsset?.asset_id === asset.asset_id
                        ? "selected"
                        : ""
                    }`}
                    onClick={() => setSelectedAsset(asset)}
                  >
                    <div className="asset-type-icon">
                      {asset.asset_type.toLowerCase() === "fibre_node" ? (
                        <Cable size={18} />
                      ) : (
                        <RadioTower size={18} />
                      )}
                    </div>

                    <div className="asset-row-info">
                      <strong>{asset.asset_id}</strong>
                      <span>{assetTypeLabel(asset.asset_type)}</span>
                    </div>

                    <span className="asset-arrow">↗</span>
                  </button>
                ))}

                {filteredAssets.length === 0 && (
                  <EmptyState
                    icon={<Search size={20} />}
                    title="No matching assets"
                    description="Try a different search term."
                  />
                )}
              </div>

              {selectedAsset && (
                <div className="asset-details">
                  <div className="details-heading">
                    <span>SELECTED ASSET</span>
                    <span className="record-live">
                      <span className="status-dot" />
                      Stored
                    </span>
                  </div>

                  <h4>{selectedAsset.asset_id}</h4>

                  <p className="asset-type-label">
                    {assetTypeLabel(selectedAsset.asset_type)}
                  </p>

                  <div className="coordinate-row">
                    <span>Latitude</span>
                    <strong>
                      {selectedAsset.latitude.toFixed(5)}
                    </strong>
                  </div>

                  <div className="coordinate-row">
                    <span>Longitude</span>
                    <strong>
                      {selectedAsset.longitude.toFixed(5)}
                    </strong>
                  </div>
                </div>
              )}

              <div className="nearby-box">
                <div className="nearby-title">
                  <Navigation size={16} />
                  <strong>Nearby asset search</strong>
                </div>

                <p>
                  Find database assets within a radius of the selected asset.
                </p>

                <div className="radius-control">
                  <select
                    value={radius}
                    onChange={(event) => setRadius(event.target.value)}
                    aria-label="Search radius"
                  >
                    <option value="500">500 metres</option>
                    <option value="1000">1 kilometre</option>
                    <option value="2000">2 kilometres</option>
                    <option value="5000">5 kilometres</option>
                    <option value="10000">10 kilometres</option>
                  </select>

                  <button
                    onClick={() => void runNearbySearch()}
                    disabled={!selectedAsset || nearbyLoading}
                    title="Search nearby assets"
                  >
                    {nearbyLoading ? (
                      <LoaderCircle size={17} className="spin" />
                    ) : (
                      <Crosshair size={17} />
                    )}
                  </button>
                </div>

                {nearbyError && (
                  <p role="alert">{nearbyError}</p>
                )}

                {nearbyAssets !== null && (
                  <div style={{ marginTop: 12 }}>
                    <strong>
                      {nearbyAssets.length} result(s)
                    </strong>

                    {nearbyAssets.map((asset) => (
                      <button
                        key={asset.asset_id}
                        className="asset-row"
                        onClick={() => setSelectedAsset(asset)}
                        style={{ width: "100%" }}
                      >
                        <div className="asset-row-info">
                          <strong>{asset.asset_id}</strong>
                          <span>
                            {assetTypeLabel(asset.asset_type)}
                            {asset.distance_m !== undefined
                              ? ` · ${formatDistance(asset.distance_m)}`
                              : ""}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </section>
      </>
    );
  }

  /* -------------------------------------------------------
     PAGE CONTENT: ASSET EXPLORER
  ------------------------------------------------------- */

  function renderAssetExplorer() {
    return (
      <>
        <PageHeading
          eyebrow="SPATIAL DATA MANAGEMENT"
          title="Asset Explorer"
          description={pageDescription["Asset Explorer"]}
          action={refreshButton}
        />

        {error && (
          <StatusMessage type="error">
            {error}
          </StatusMessage>
        )}

        <section className="map-section">
          <SectionHeader
            title="Network asset inventory"
            description={`${filteredAssets.length} matching record(s)`}
            action={
              <ActionButton onClick={() => setSearch("")} secondary>
                <X size={15} />
                Clear search
              </ActionButton>
            }
          />

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <label className="search-box" style={{ flex: 1, minWidth: 220 }}>
              <Search size={16} />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by asset ID or type..."
              />
            </label>

            <label
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <Filter size={17} />

              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                aria-label="Filter asset type"
                style={{
                  padding: "10px 12px",
                  borderRadius: 9,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                }}
              >
                <option value="all">All asset types</option>
                <option value="fibre_node">Fibre nodes</option>
                <option value="tower">Towers</option>
              </select>
            </label>
          </div>

          {loading ? (
            <LoadingState message="Loading assets from the database..." />
          ) : filteredAssets.length === 0 ? (
            <EmptyState
              icon={<Database size={28} />}
              title="No assets found"
              description="Try changing your filters or import a CSV dataset."
            />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {[
                      "Asset ID",
                      "Asset Type",
                      "Latitude",
                      "Longitude",
                      "Action",
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: 14,
                          borderBottom: "1px solid #e2e8f0",
                          color: "#64748b",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredAssets.map((asset) => (
                    <tr
                      key={asset.asset_id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        background:
                          selectedAsset?.asset_id === asset.asset_id
                            ? "#f5f3ff"
                            : "#fff",
                      }}
                    >
                      <td style={{ padding: 14, fontWeight: 600 }}>
                        {asset.asset_id}
                      </td>

                      <td style={{ padding: 14 }}>
                        {assetTypeLabel(asset.asset_type)}
                      </td>

                      <td style={{ padding: 14 }}>
                        {asset.latitude.toFixed(5)}
                      </td>

                      <td style={{ padding: 14 }}>
                        {asset.longitude.toFixed(5)}
                      </td>

                      <td style={{ padding: 14 }}>
                        <button
                          onClick={() => {
                            setSelectedAsset(asset);
                            setActivePage("Overview");
                          }}
                          title="Locate asset on map"
                          aria-label={`Locate ${asset.asset_id}`}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#635bda",
                            cursor: "pointer",
                          }}
                        >
                          <MapPin size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 18, color: "#64748b", fontSize: 12 }}>
            {lastUpdated
              ? `Last refreshed: ${lastUpdated.toLocaleTimeString()}`
              : "Database refresh time unavailable"}
          </div>
        </section>

        {selectedAsset && (
          <section className="map-section">
            <SectionHeader
              title={`Location: ${selectedAsset.asset_id}`}
              description="The selected asset is highlighted on the map."
            />

            <AssetMap
              assets={filteredAssets}
              selectedAsset={selectedAsset}
              onSelect={setSelectedAsset}
              radius={Number(radius)}
            />
          </section>
        )}
      </>
    );
  }

  /* -------------------------------------------------------
     REUSABLE CSV UPLOAD PANEL
  ------------------------------------------------------- */

  function renderCsvUpload(mode: "validate" | "import") {
    const isImport = mode === "import";

    const totalRecords = getNumber(validation, [
      "total_records",
      "total",
      "total_count",
    ]);

    const validRecords = getNumber(validation, [
      "valid_records",
      "valid",
      "valid_count",
    ]);

    const invalidRecords = getNumber(validation, [
      "invalid_records",
      "invalid",
      "invalid_count",
    ]);

    const errorRows = getArrayFromResponse(validation, [
      "errors",
      "validation_errors",
      "issues",
    ]);

    const insertedRecords = getNumber(importResult, [
      "inserted_records",
      "inserted",
      "imported",
      "records_inserted",
    ]);

    const skippedRecords = getNumber(importResult, [
      "skipped_existing_records",
      "skipped",
      "duplicates_skipped",
    ]);

    const canImport =
      Boolean(csvFile) &&
      validationCompleted &&
      Boolean(validation) &&
      !fileLoading;

    return (
      <section className="map-section">
        <SectionHeader
          title={isImport ? "Import telecom assets" : "Validate asset data"}
          description={
            isImport
              ? "Validate your CSV and import valid records into Supabase PostGIS."
              : "Inspect CSV quality before making changes to the database."
          }
        />

        <div
          className="asset-panel"
          style={{
            padding: 24,
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div
              className="stat-icon purple"
              style={{ flexShrink: 0 }}
            >
              <FileSpreadsheet size={22} />
            </div>

            <div>
              <h3 style={{ margin: 0 }}>Upload CSV dataset</h3>
              <p style={{ marginTop: 5 }}>
                Required columns: asset_id, asset_type, latitude, longitude
              </p>
            </div>
          </div>

          <div
            style={{
              padding: 22,
              border: "1px dashed #cbd5e1",
              borderRadius: 12,
              background: "#fafbff",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvChange}
              aria-label="Choose a CSV file"
              style={{
                display: "block",
                width: "100%",
                marginBottom: 14,
                fontSize: 13,
              }}
            />

            {csvFile ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <FileSpreadsheet size={20} color="#635bda" />

                <div style={{ flex: 1, minWidth: 150 }}>
                  <strong style={{ fontSize: 13 }}>
                    {csvFile.name}
                  </strong>

                  <p style={{ margin: "4px 0 0", fontSize: 12 }}>
                    {(csvFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>

                <button
                  onClick={resetFileWorkflow}
                  aria-label="Remove selected file"
                  title="Remove selected file"
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                Select a CSV file from your computer to get started.
              </p>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 18,
            }}
          >
            <ActionButton
              onClick={() => void handleValidate()}
              disabled={!csvFile || fileLoading}
              secondary
            >
              {fileLoading ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <FileCheck2 size={16} />
              )}

              {fileLoading ? "Processing..." : "Validate CSV"}
            </ActionButton>

            {isImport && (
              <ActionButton
                onClick={() => void handleImport()}
                disabled={!canImport}
              >
                {fileLoading ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Upload size={16} />
                )}

                Import Valid Records
              </ActionButton>
            )}
          </div>

          {isImport && !validationCompleted && csvFile && (
            <p style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>
              Validate this file before importing it.
            </p>
          )}

          {fileError && (
            <StatusMessage type="error">
              {fileError}
            </StatusMessage>
          )}

          {validation && (
            <div style={{ marginTop: 26 }}>
              <SectionHeader
                title="Validation summary"
                description="Results returned by your FastAPI backend."
              />

              <div
                className="stats-grid"
                style={{ marginTop: 16 }}
              >
                <StatCard
                  title="Total records"
                  value={totalRecords ?? "—"}
                  description="Records checked"
                  icon={<Database size={18} />}
                  color="purple"
                />

                <StatCard
                  title="Valid records"
                  value={validRecords ?? "—"}
                  description="Passed validation"
                  icon={<CheckCircle2 size={18} />}
                  color="green"
                />

                <StatCard
                  title="Invalid records"
                  value={invalidRecords ?? "—"}
                  description="Require attention"
                  icon={<AlertCircle size={18} />}
                  color="orange"
                />
              </div>

              {invalidRecords === 0 && (
                <StatusMessage type="success">
                  No invalid records were reported by the backend.
                </StatusMessage>
              )}

              {invalidRecords !== null && invalidRecords > 0 && (
                <StatusMessage type="info">
                  {invalidRecords} invalid record(s) were reported.
                  Review the details below before importing.
                </StatusMessage>
              )}

              {errorRows.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h4>Validation issues</h4>

                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 13,
                        textAlign: "left",
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th style={{ padding: 12 }}>#</th>
                          <th style={{ padding: 12 }}>Details</th>
                        </tr>
                      </thead>

                      <tbody>
                        {errorRows.map((row, index) => (
                          <tr key={index}>
                            <td
                              style={{
                                padding: 12,
                                borderBottom: "1px solid #e2e8f0",
                              }}
                            >
                              {index + 1}
                            </td>

                            <td
                              style={{
                                padding: 12,
                                borderBottom: "1px solid #e2e8f0",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {typeof row === "string"
                                ? row
                                : JSON.stringify(row)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <details style={{ marginTop: 18 }}>
                <summary
                  style={{
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#635bda",
                  }}
                >
                  View complete validation response
                </summary>

                <pre
                  style={{
                    marginTop: 12,
                    padding: 16,
                    background: "#f8fafc",
                    borderRadius: 8,
                    fontSize: 12,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    overflowX: "auto",
                  }}
                >
                  {JSON.stringify(validation, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {importResult && (
            <div style={{ marginTop: 24 }}>
              <SectionHeader
                title="Import response"
                description="The response returned by the backend."
              />

              <StatusMessage type="success">
                The import endpoint returned a successful response.
                The asset list has been refreshed.
              </StatusMessage>

              <div
                className="stats-grid"
                style={{ marginTop: 16 }}
              >
                <StatCard
                  title="Inserted"
                  value={insertedRecords ?? "See details"}
                  description="New database records"
                  icon={<Database size={18} />}
                  color="green"
                />

                <StatCard
                  title="Skipped"
                  value={skippedRecords ?? "See details"}
                  description="Existing or duplicate records"
                  icon={<AlertCircle size={18} />}
                  color="orange"
                />
              </div>

              <details style={{ marginTop: 18 }}>
                <summary
                  style={{
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#635bda",
                  }}
                >
                  View complete import response
                </summary>

                <pre
                  style={{
                    marginTop: 12,
                    padding: 16,
                    background: "#f8fafc",
                    borderRadius: 8,
                    fontSize: 12,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    overflowX: "auto",
                  }}
                >
                  {JSON.stringify(importResult, null, 2)}
                </pre>
              </details>

              <div style={{ marginTop: 18 }}>
                <ActionButton
                  onClick={() => setActivePage("Asset Explorer")}
                >
                  <MapPin size={16} />
                  View imported assets
                  <ArrowUpRight size={15} />
                </ActionButton>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  /* -------------------------------------------------------
     RENDER ACTIVE PAGE
  ------------------------------------------------------- */

  function renderActivePage() {
    switch (activePage) {
      case "Overview":
        return renderOverview();

      case "Asset Explorer":
        return renderAssetExplorer();

      case "Data Validation":
        return (
          <>
            <PageHeading
              eyebrow="DATA QUALITY MANAGEMENT"
              title="Data Validation"
              description={pageDescription["Data Validation"]}
            />

            {renderCsvUpload("validate")}
          </>
        );

      case "Import Data":
        return (
          <>
            <PageHeading
              eyebrow="DATA INGESTION"
              title="Import Data"
              description={pageDescription["Import Data"]}
            />

            {renderCsvUpload("import")}
          </>
        );

      default:
        return renderOverview();
    }
  }

  /* -------------------------------------------------------
     APP SHELL
  ------------------------------------------------------- */

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}
      >
        <div className="brand">
          <div className="brand-mark">
            <Layers3 size={23} strokeWidth={2.1} />
          </div>

          <div>
            <h1>TerraLink</h1>
            <p>NETWORK INTELLIGENCE</p>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="sidebar-nav">
          {navigationItems.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${
                activePage === name ? "active" : ""
              }`}
              onClick={() => {
                setActivePage(name);
                setSidebarOpen(false);
              }}
            >
              <Icon size={18} />
              <span>{name}</span>

              {name === "Data Validation" && (
                <span className="nav-count">CSV</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span
              className="status-dot"
              style={{
                background: error ? "#ef4444" : "#22c55e",
              }}
            />

            <div>
              <strong>{error ? "Connection issue" : "System status"}</strong>
              <p>{error ? "Check backend" : "Database workspace"}</p>
            </div>
          </div>

          <button
            className="nav-item"
            onClick={() => void loadAssets(false)}
          >
            <Settings size={18} />
            <span>Refresh connection</span>
          </button>

          <div className="profile">
            <div className="avatar">TL</div>

            <div className="profile-info">
              <strong>Network Admin</strong>
              <span>Asset management</span>
            </div>

            <ChevronDown size={16} />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation"
          >
            <Menu size={21} />
          </button>

          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>{activePage}</strong>
          </div>

          <div className="topbar-actions">
            <div className="environment">
              <span
                className="status-dot"
                style={{
                  background: error ? "#ef4444" : "#22c55e",
                }}
              />
              {error ? "Backend unavailable" : "Live environment"}
            </div>

            <button
              className="icon-button"
              aria-label="Refresh assets"
              title="Refresh assets"
              onClick={() => void loadAssets(false)}
              disabled={refreshing || loading}
            >
              <RefreshCw size={18} />
            </button>

            <button
              className="icon-button notification"
              aria-label="Notifications"
              title="Notifications"
              onClick={() => {
                if (error) {
                  window.alert(`Backend connection issue: ${error}`);
                } else {
                  window.alert(
                    "No new notifications. Your workspace is ready.",
                  );
                }
              }}
            >
              <Bell size={18} />
            </button>
          </div>
        </header>

        <div className="page-content">
          {renderActivePage()}

          <footer className="page-footer">
            <span>
              <Activity size={14} />
              TerraLink Network Intelligence
            </span>

            <span>
              GIS workspace · Development environment
              {lastUpdated
                ? ` · Updated ${lastUpdated.toLocaleTimeString()}`
                : ""}
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;