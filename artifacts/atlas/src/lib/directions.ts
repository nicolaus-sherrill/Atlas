// Links that open a spot in a directions app

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
