import type { WorkSpot } from "./types";
import { CATEGORIES, spotScore, getSpotDisplayTags } from "./types";

export function spotsToGeoJSON(spots: WorkSpot[]): string {
  const features = spots.map((spot) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [spot.lng, spot.lat],
    },
    properties: {
      name: spot.name,
      category: spot.category,
      good_for: spot.goodFor,
      paid_entry: spot.paidEntry,
      city: spot.city,
      address: spot.address,
      description: spot.description,
      score: spotScore(spot),
      scores: spot.scores,
      tags: spot.tags,
    },
  }));

  return JSON.stringify(
    { type: "FeatureCollection", features },
    null,
    2
  );
}

export function spotsToKML(spots: WorkSpot[]): string {
  const placemarks = spots
    .map((spot) => {
      const cat = CATEGORIES.find((c) => c.value === spot.category);
      const score = spotScore(spot);
      const tagLabels = getSpotDisplayTags(spot).join(", ");
      return `    <Placemark>
      <name>${escapeXml(spot.name)}</name>
      <description>${escapeXml(
        `${cat?.icon || ""} ${cat?.label || spot.category} | ${spot.city}\n${spot.address}\n\nScore: ${score.toFixed(1)}/5.0\nTags: ${tagLabels}\n\n${spot.aiSummary || spot.description}`
      )}</description>
      <Point>
        <coordinates>${spot.lng},${spot.lat},0</coordinates>
      </Point>
    </Placemark>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Atlas - Third Spaces</name>
    <description>Public third spaces exported from Atlas</description>
${placemarks}
  </Document>
</kml>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getGoogleMapsUrl(lat: number, lng: number, name?: string): string {
  const destination = name
    ? `${encodeURIComponent(name)}+@${lat},${lng}`
    : `${lat},${lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

export function getAppleMapsUrl(lat: number, lng: number, name?: string): string {
  const daddr = name
    ? `${encodeURIComponent(name)}+@${lat},${lng}`
    : `${lat},${lng}`;
  return `https://maps.apple.com/?daddr=${daddr}&dirflg=d&t=m`;
}
