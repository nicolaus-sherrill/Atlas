import type { WorkSpot } from "./types";
import { CATEGORIES, computeWorkabilityScore } from "./types";

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
      city: spot.city,
      address: spot.address,
      description: spot.description,
      workabilityScore: computeWorkabilityScore(spot),
      wifi: spot.ratings.wifi,
      power: spot.ratings.power,
      noise: spot.ratings.noise,
      coffee: spot.ratings.coffee,
      lighting: spot.ratings.lighting,
      seating: spot.ratings.seating,
      outlets: spot.ratings.outlets,
      food: spot.food,
      drink: spot.drink,
      ada: spot.ada,
      transit: spot.transit,
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
      const score = computeWorkabilityScore(spot);
      return `    <Placemark>
      <name>${escapeXml(spot.name)}</name>
      <description>${escapeXml(
        `${cat?.icon || ""} ${cat?.label || spot.category} | ${spot.city}\n${spot.address}\n\nWorkability: ${score.toFixed(1)}/5\nWiFi: ${spot.ratings.wifi}/5 | Power: ${spot.ratings.power}/5 | Noise: ${spot.ratings.noise}/5 | Lighting: ${spot.ratings.lighting}/5 | Seating: ${spot.ratings.seating}/5 | Outlets: ${spot.ratings.outlets}/5\n\n${spot.aiSummary || spot.description}`
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
    <name>Atlas - Work Spots</name>
    <description>Remote work spots exported from Atlas</description>
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
