import { describe, expect, it } from "vitest"
import { normalizeApiBaseUrl } from "@/studio/persistence/cloudStateSync"

describe("normalizeApiBaseUrl", () => {
  it("converts a bare /v1 base to /api/v1", () => {
    expect(normalizeApiBaseUrl("https://nxt-lvl-api2.onrender.com/v1")).toBe("https://nxt-lvl-api2.onrender.com/api/v1")
  })

  it("leaves an api/v1 base unchanged", () => {
    expect(normalizeApiBaseUrl("https://nxt-lvl-api2.onrender.com/api/v1")).toBe("https://nxt-lvl-api2.onrender.com/api/v1")
  })

  it("trims trailing slashes", () => {
    expect(normalizeApiBaseUrl("https://nxt-lvl-api2.onrender.com/api/v1/")).toBe("https://nxt-lvl-api2.onrender.com/api/v1")
  })
})
