import { describe, expect, it } from "vitest";

import { buildMapboxProxyUrl } from "./mapbox-proxy";

describe("buildMapboxProxyUrl", () => {
  it("accepts legitimate Mapbox GL style, font stack with spaces, retina sprite, and vector tile paths", () => {
    const url = buildMapboxProxyUrl(["styles", "v1", "mapbox", "standard"], "?fresh=true", "pk.test_token");
    expect(url?.toString()).toBe("https://api.mapbox.com/styles/v1/mapbox/standard?fresh=true&access_token=pk.test_token");

    const tile = buildMapboxProxyUrl(["v4", "mapbox.country-boundaries-v1", "2", "1", "1.vector.pbf"], "", "pk.test_token");
    expect(tile?.toString()).toBe("https://api.mapbox.com/v4/mapbox.country-boundaries-v1/2/1/1.vector.pbf?access_token=pk.test_token");

    const font = buildMapboxProxyUrl(
      ["fonts", "v1", "mapbox", "DIN Offc Pro Medium,Arial Unicode MS Regular", "0-255.pbf"],
      "",
      "pk.test_token",
    );
    expect(font?.toString()).toBe(
      "https://api.mapbox.com/fonts/v1/mapbox/DIN%20Offc%20Pro%20Medium,Arial%20Unicode%20MS%20Regular/0-255.pbf?access_token=pk.test_token",
    );

    const sprite = buildMapboxProxyUrl(["styles", "v1", "mapbox", "standard", "sprite@2x.png"], "", "pk.test_token");
    expect(sprite?.toString()).toBe("https://api.mapbox.com/styles/v1/mapbox/standard/sprite@2x.png?access_token=pk.test_token");
  });

  it("rejects empty, traversal, encoded traversal, and non-map API prefixes", () => {
    expect(buildMapboxProxyUrl([], "", "pk.test")).toBeNull();
    expect(buildMapboxProxyUrl(["styles", "..", "tokens", "v2"], "", "pk.test")).toBeNull();
    expect(buildMapboxProxyUrl(["styles", "%2e%2e", "tokens"], "", "pk.test")).toBeNull();
    expect(buildMapboxProxyUrl(["tokens", "v2"], "", "pk.test")).toBeNull();
    expect(buildMapboxProxyUrl(["accounts", "v1", "me"], "", "pk.test")).toBeNull();
    expect(buildMapboxProxyUrl(["styles", "v1\\foo"], "", "pk.test")).toBeNull();
    expect(buildMapboxProxyUrl(["styles", "user@evil.com"], "", "pk.test")).toBeNull();
  });

  it("preserves non-empty access_token query param and fills empty or missing ones", () => {
    const url = buildMapboxProxyUrl(["fonts", "v1", "mapbox", "Arial", "0-255.pbf"], "?access_token=pk.client", "pk.server");
    expect(url?.toString()).toBe("https://api.mapbox.com/fonts/v1/mapbox/Arial/0-255.pbf?access_token=pk.client");

    const emptyToken = buildMapboxProxyUrl(["fonts", "v1", "mapbox", "Arial", "0-255.pbf"], "?access_token=", "pk.server");
    expect(emptyToken?.toString()).toBe("https://api.mapbox.com/fonts/v1/mapbox/Arial/0-255.pbf?access_token=pk.server");

    expect(buildMapboxProxyUrl(["styles", "v1"], "#fragment", "pk.server")).toBeNull();
    expect(buildMapboxProxyUrl(["styles", "v1"], "invalid", "pk.server")).toBeNull();
  });
});
