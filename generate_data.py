import argparse
import csv
import random
from pathlib import Path
from typing import Any

COLUMNS = ["asset_id", "asset_type", "latitude", "longitude"]

# Approximate synthetic study area around Adoor and nearby parts of
# southern Kerala. These are generation bounds, NOT official boundaries.
LAT_MIN, LAT_MAX = 9.05, 9.55
LON_MIN, LON_MAX = 76.45, 77.05

# Illustrative synthetic activity centres.
# These are NOT verified telecom infrastructure locations.
# Format: latitude, longitude, latitude spread, longitude spread.
CENTRES = [
    (9.155, 76.735, 0.035, 0.045),
    (9.180, 76.610, 0.030, 0.035),
    (9.250, 76.780, 0.040, 0.045),
    (9.340, 76.700, 0.035, 0.040),
    (9.400, 76.830, 0.040, 0.045),
    (9.100, 76.900, 0.030, 0.035),
]


def clamp(value: float, low: float, high: float) -> float:
    """Keep a coordinate within the configured generation bounds."""
    return max(low, min(high, value))


def generate_clustered_point(
    rng: random.Random,
) -> tuple[float, float]:
    """Generate a point near a synthetic activity centre."""
    centre_lat, centre_lon, lat_spread, lon_spread = rng.choice(
        CENTRES
    )

    latitude = rng.gauss(centre_lat, lat_spread)
    longitude = rng.gauss(centre_lon, lon_spread)

    latitude = clamp(latitude, LAT_MIN, LAT_MAX)
    longitude = clamp(longitude, LON_MIN, LON_MAX)

    return round(latitude, 6), round(longitude, 6)


def generate_dispersed_point(
    rng: random.Random,
) -> tuple[float, float]:
    """Generate a more widely dispersed synthetic tower location."""
    latitude = rng.uniform(LAT_MIN, LAT_MAX)
    longitude = rng.uniform(LON_MIN, LON_MAX)

    return round(latitude, 6), round(longitude, 6)


def generate_assets(
    count: int,
    rng: random.Random,
) -> list[dict[str, Any]]:
    """
    Generate synthetic telecom assets.

    Approximately 75% are clustered fibre nodes.
    The remaining assets are more widely dispersed towers.
    """
    assets = []
    fibre_count = round(count * 0.75)

    for i in range(count):
        if i < fibre_count:
            asset_id = f"FIBRE{i + 1:03d}"
            asset_type = "fibre_node"

            latitude, longitude = generate_clustered_point(rng)

        else:
            tower_number = i - fibre_count + 1

            asset_id = f"TOWER{tower_number:03d}"
            asset_type = "tower"

            latitude, longitude = generate_dispersed_point(rng)

        assets.append(
            {
                "asset_id": asset_id,
                "asset_type": asset_type,
                "latitude": latitude,
                "longitude": longitude,
            }
        )

    return assets


def inject_errors(
    assets: list[dict[str, Any]],
    rng: random.Random,
    invalid_count: int = 9,
) -> list[dict[str, Any]]:
    """
    Create a dirty copy containing distinct records with injected errors.

    Each selected record receives one primary error. The duplicate-ID
    case is handled separately so that it does not accidentally overwrite
    another injected error.
    """
    if invalid_count < 0:
        raise ValueError("invalid_count must be zero or greater")

    if invalid_count > len(assets):
        raise ValueError("invalid_count cannot exceed the asset count")

    dirty = [row.copy() for row in assets]

    if invalid_count == 0:
        return dirty

    indices = rng.sample(range(len(dirty)), invalid_count)

    # Errors that match the current validator's existing checks.
    issue_functions = [
        lambda row: row.update(asset_id=""),
        lambda row: row.update(asset_id=""),
        lambda row: row.update(asset_type=""),
        lambda row: row.update(latitude=150),
        lambda row: row.update(longitude=-220),
        lambda row: row.update(latitude="north"),
        lambda row: row.update(longitude=""),
        lambda row: row.update(latitude=-91),
        lambda row: row.update(longitude="east"),
    ]

    rng.shuffle(issue_functions)

    for index, issue in zip(indices, issue_functions):
        issue(dirty[index])

    return dirty


def write_csv(
    filename: Path,
    records: list[dict[str, Any]],
) -> None:
    """Write records to a CSV file."""
    with filename.open(
        "w",
        newline="",
        encoding="utf-8",
    ) as file:
        writer = csv.DictWriter(file, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(records)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Generate synthetic telecom asset datasets "
            "for TerraLink testing."
        )
    )

    parser.add_argument(
        "--count",
        type=int,
        default=100,
        help="Number of assets per dataset (default: 100)",
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducible output (default: 42)",
    )

    parser.add_argument(
        "--invalid-count",
        type=int,
        default=9,
        help="Number of records receiving injected errors (default: 9)",
    )

    parser.add_argument(
        "--output-dir",
        default=".",
        help="Directory where the CSV files will be saved",
    )

    args = parser.parse_args()

    if args.count < 1:
        parser.error("--count must be at least 1")

    if not 0 <= args.invalid_count <= args.count:
        parser.error("--invalid-count must be between 0 and --count")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Separate random generators ensure that changing the error injection
    # logic does not change the clean dataset for the same seed.
    clean_rng = random.Random(args.seed)
    dirty_rng = random.Random(args.seed + 1)

    assets = generate_assets(args.count, clean_rng)

    dirty_assets = inject_errors(
        assets,
        dirty_rng,
        args.invalid_count,
    )

    clean_file = output_dir / "terralink_assets_clean.csv"
    dirty_file = output_dir / "terralink_assets_with_errors.csv"

    write_csv(clean_file, assets)
    write_csv(dirty_file, dirty_assets)

    print(f"Generated {args.count} records per dataset.")
    print(f"Requested records with injected errors: {args.invalid_count}")
    print("Distribution: clustered fibre nodes and dispersed towers.")
    print(
        "NOTE: Coordinates are synthetic, not verified telecom "
        "asset locations."
    )
    print(f"Clean dataset: {clean_file.resolve()}")
    print(f"Dataset with errors: {dirty_file.resolve()}")


if __name__ == "__main__":
    main()