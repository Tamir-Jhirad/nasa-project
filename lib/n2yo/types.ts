// lib/n2yo/types.ts

export interface N2YOSatelliteAbove {
  satid: number;
  satname: string;
  intDesignator: string;
  launchDate: string;   // "YYYY-MM-DD"
  satlat: number;
  satlng: number;
  satalt: number;       // km above surface
}

export interface N2YOAboveResponse {
  info: {
    category: string;
    satcount: number;
    transactionscount: number;
  };
  above: N2YOSatelliteAbove[];
}

export interface N2YOTleResponse {
  info: {
    satid: number;
    satname: string;
    transactionscount: number;
  };
  tle: string;   // "LINE1\r\nLINE2"
}
