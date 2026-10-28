
<img width="1422" height="726" alt="image" src="https://github.com/user-attachments/assets/8db2e994-1ecb-4603-8f00-8152613b47cb" />

<img width="1432" height="830" alt="image" src="https://github.com/user-attachments/assets/f6219511-232e-4304-a78b-fae72c1b10ea" />

## TerraLink | GIS-Based Telecom Asset Management

**A full-stack GIS application for telecom asset validation, geospatial storage, interactive mapping, and proximity-based asset discovery.**

TerraLink combines a React-based map interface, a FastAPI backend, and a PostgreSQL/PostGIS database to manage and query telecom asset locations. QGIS is used to inspect the spatial data and independently verify geospatial query results.

> **Project status:** Core data validation, asset import, interactive mapping, and nearby-asset search are implemented and tested. QGIS connects to the same PostGIS database for desktop GIS inspection and analysis.

## Key Features

- **Data validation:** Checks required fields, missing or unusable values, coordinate ranges, and duplicate asset IDs.
- **Spatial data storage:** Stores asset attributes and geographic locations in PostgreSQL with PostGIS.
- **Interactive map:** Visualizes asset locations using React and Leaflet, with distinct categories for fibre nodes and towers.
- **Proximity search:** Finds assets within a specified radius and returns their distances from a search location.
- **CSV ingestion:** Generates synthetic datasets, including deliberately invalid records, to test validation and import workflows.
- **GIS verification:** Uses QGIS to inspect the PostGIS table and compare spatial query results against the FastAPI endpoint.

## Technology Stack

| Component | Technology | Purpose |
|---|---|---|
| Frontend | React, TypeScript, Vite | User interface and interactive mapping |
| Mapping | Leaflet | Geographic visualization |
| Backend | Python, FastAPI | Validation, data import, and API endpoints |
| Database | PostgreSQL, Supabase | Persistent asset storage |
| Spatial database | PostGIS | Geographic queries and distance calculations |
| Database access | SQLAlchemy, Psycopg | Python-to-PostgreSQL connectivity |
| Desktop GIS | QGIS | Spatial data inspection and query verification |

## Architecture

```text
       Synthetic CSV Data
               |
               v
       FastAPI Validation
               |
               v
        Asset Import API
               |
               v
      PostgreSQL + PostGIS
          /           \
         v             v
  React + Leaflet     QGIS
  Web Application     Desktop GIS
         |
         v
  Nearby Asset Search
  through FastAPI
```

The web application and QGIS are separate interfaces connected to the same database. QGIS is used for desktop GIS inspection and analysis; it is not embedded in TerraLink.

## Spatial Data Model

The `telecom_assets` table stores asset attributes and geographic locations.

| Column | Description |
|---|---|
| `asset_id` | Unique asset identifier and primary key |
| `asset_type` | Asset category |
| `latitude` | Latitude in decimal degrees |
| `longitude` | Longitude in decimal degrees |
| `location` | PostGIS `GEOGRAPHY(POINT, 4326)` location |
| `created_at` | Record creation timestamp |

**Supported asset types:**
- `fibre_node`
- `tower`

A GiST index on the geographic location supports spatial queries.

The project uses synthetic telecom asset data around southern Kerala for demonstration purposes. These coordinates do not represent verified real-world telecom infrastructure.

## API Capabilities

| Endpoint | Purpose |
|---|---|
| `GET /` | Root endpoint |
| `GET /health` | Health and database connectivity checks |
| `POST /assets/validate` | Validates incoming asset data |
| `POST /assets/import` | Imports valid asset records |
| `GET /assets` | Retrieves stored assets |
| `GET /assets/nearby` | Searches for assets within a specified radius |

Interactive API documentation is available through FastAPI's Swagger UI at `/docs` when the backend is running locally.

## GIS Implementation

### 1. Coordinate validation

Incoming records are checked for required fields, usable values, valid latitude and longitude ranges, and duplicate asset IDs.

This prevents structurally invalid records from being treated as valid spatial assets. However, valid coordinates do not prove that an asset physically exists at the specified location.

### 2. Spatial storage

Asset coordinates are stored as `GEOGRAPHY(POINT, 4326)` values.

This representation uses longitude and latitude with the WGS 84 coordinate reference system. PostGIS geography operations allow distance-based queries to work in metres.

### 3. Proximity-based asset discovery

The nearby-assets endpoint uses PostGIS spatial functions:

- `ST_MakePoint()` constructs a point using **longitude first, then latitude**.
- `ST_SetSRID()` assigns the coordinate reference system.
- `ST_DWithin()` identifies assets within the requested distance.
- `ST_Distance()` calculates distances in metres.

Spatial filtering and distance calculations are performed in the database rather than manually calculating distances for every asset in Python.

### 4. QGIS integration

QGIS connects directly to the existing Supabase PostGIS database. The `telecom_assets` table can be loaded as a spatial layer, inspected through its attribute table, and styled by asset category.

QGIS and TerraLink use separate interfaces but query the same underlying spatial data.

## Verification and Results

A proximity search was executed independently in QGIS and through TerraLink's FastAPI endpoint.

**Test parameters**

| Parameter | Value |
|---|---:|
| Search latitude | 9.27 |
| Search longitude | 76.78 |
| Search radius | 5,000 metres |
| Assets returned | 6 |

Both queries returned the same six asset IDs in the same order, with matching distances to two decimal places.

| Asset ID | Type | Distance |
|---|---|---:|
| FIBRE008 | `fibre_node` | 2.09 km |
| FIBRE033 | `fibre_node` | 2.88 km |
| FIBRE041 | `fibre_node` | 3.68 km |
| FIBRE027 | `fibre_node` | 3.70 km |
| FIBRE020 | `fibre_node` | 3.95 km |
| FIBRE050 | `fibre_node` | 4.17 km |

This verified that the database's spatial search returned consistent results through both interfaces for the tested location and radius.

## Setup

### Prerequisites

- Python
- Node.js and npm
- A Supabase project with PostgreSQL and PostGIS
- QGIS (optional, for desktop GIS inspection)

### 1. Configure the database

Enable PostGIS in the Supabase database and create the `telecom_assets` table with its geographic column and GiST index.

Configure the backend database connection using environment variables. Keep database credentials out of source control.

### 2. Generate synthetic data

Run the data-generation script from the project directory:

```bash
python generate_assets.py --count 100 --invalid-count 9 --seed 42
```

This generates a clean dataset and a dataset containing deliberately introduced validation errors.

### 3. Start the backend

Activate your Python environment, install the project's dependencies, and start the FastAPI application using the configured entry point.

For example, if the application is exposed as `app.main:app`:

```bash
uvicorn app.main:app --reload
```

Open `/docs` on the local backend to inspect and test the API endpoints.

### 4. Start the frontend

From the frontend directory:

```bash
npm install
npm run dev
```

Open the local Vite URL displayed in the terminal.

### 5. Connect QGIS (optional)

Create a PostgreSQL connection using the connection details from Supabase. Configure the appropriate database credentials and SSL settings, then load `public.telecom_assets` as a layer.

**Note:** These are setup steps, not a guarantee that every environment is configured identically. Use the actual project dependencies, database settings, and application entry point from your local repository.

## Key Technical Learnings

- **Validation and spatial analysis solve different problems.** Validation checks whether incoming records satisfy data rules; spatial queries answer geographic questions about stored records.
- **A coordinate pair is not enough on its own.** Coordinate order and the coordinate reference system must be handled correctly.
- **PostGIS can perform spatial operations directly.** `ST_DWithin()` and `ST_Distance()` avoid the need to retrieve every record for distance calculations.
- **A spatial index matters.** A GiST index supports efficient spatial querying as datasets grow, although actual performance depends on the query and data.
- **Independent verification builds confidence.** Comparing QGIS results with API results helped verify the proximity-search implementation.
- **Shared storage does not mean shared interfaces.** TerraLink and QGIS are separate applications that access the same database.
- **Valid data is not necessarily accurate data.** Coordinate-range checks cannot establish whether an asset exists at its recorded location.

## Current Limitations

- The dataset is synthetic and intended for demonstration.
- Validation covers structural and coordinate checks, not verification against real infrastructure records.
- Nearby search is radius-based; network connectivity and actual service coverage are not modelled.
- QGIS is used as a separate desktop GIS tool, not as an embedded component of the web application.
- Performance at production scale and with real telecom datasets has not been established.

## Future Improvements

- Add automated tests for validation rules and spatial queries.
- Improve import reporting with explicit counts for accepted, rejected, and skipped records.
- Add map-based spatial filtering and result summaries to the web interface.
- Evaluate spatial query performance on larger datasets.

These are potential improvements, not features currently claimed as implemented.
(https://youtu.be/DaZ2ZUnUVEk)
