/**
 * Google's encoded polyline decoder.
 *
 * Google and several other providers return route geometry as an encoded
 * string rather than GeoJSON. Twenty lines here is cheaper than a dependency,
 * and the format has not changed in fifteen years.
 */
export function decodePolyline(encoded: string, precision = 5): [number, number][] {
  const factor = 10 ** precision;
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  while (index < encoded.length) {
    lat += decodeValue();
    lon += decodeValue();
    points.push([lat / factor, lon / factor]);
  }

  return points;

  function decodeValue(): number {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    // The low bit is the sign, and negative values are stored inverted.
    return result & 1 ? ~(result >> 1) : result >> 1;
  }
}
