declare module "d3-geo-projection" {
  import type { GeoProjection } from "d3-geo";
  export function geoMiller(): GeoProjection;
  export function geoCylindricalEqualArea(): GeoProjection & { parallel(degrees: number): GeoProjection };
}
