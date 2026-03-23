import type { Constellation } from "./types";

export function detectConstellation(rawName: string): Constellation {
  const name = rawName.toUpperCase();

  if (name.startsWith("STARLINK"))                                      return "Starlink";
  if (name.startsWith("ONEWEB"))                                        return "OneWeb";
  if (name.includes("GPS") || name.includes("NAVSTAR"))                 return "GPS";
  if (name.startsWith("GALILEO"))                                       return "Galileo";
  if (name.startsWith("GLONASS"))                                       return "GLONASS";
  if (name.includes("ISS") || name.includes("TIANGONG") || name.includes("CSS")) return "Space Station";
  if (name.includes("NOAA") || name.includes("GOES") ||
      name.includes("METEOSAT") || name.includes("METEOR"))             return "Weather";
  if (name.includes("HUBBLE") || name.includes("CHANDRA"))              return "Science";
  return "Other";
}
