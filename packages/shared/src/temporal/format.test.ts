import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CaseRecord } from "../models";
import { getParcelStateNow } from "./build";
import { formatParcelStateForPrompt } from "./format";
import { buildParcelTimeline } from "./build";

const heroCase: CaseRecord = {
  id: "CB-2481",
  reference: "CB-2481",
  declarationRef: "FCBA-2026-04417",
  status: "HELD_VALUATION",
  dayCount: 1,
  createdAt: "2026-07-02T13:45:00+02:00",
  updatedAt: "2026-07-02T13:45:00+02:00",
  shipperId: "shp-shenzhen-bright",
  consignee: {
    name: "Alpenrose Electronics GmbH",
    city: "Zürich",
    country: "Switzerland",
    countryCode: "CH",
  },
  shipment: {
    description: "BT-500 Bluetooth audio modules",
    trackingNumber: "RX448291023CN",
    carrier: "Swiss Post",
    originCity: "Shenzhen",
    originCountry: "China",
    originCountryCode: "CN",
    declaredValue: 240,
    currency: "USD",
    invoiceValue: 2400,
    invoiceNumber: "INV-SBE-88671",
    hsCode: "8517.62.00",
    incoterms: "DAP",
  },
  heldReason: "Valuation hold",
};

describe("formatParcelStateForPrompt (observed-only voice)", () => {
  it("states confirmed customs location when declaration.arrivedAt is on file", () => {
    const state = getParcelStateNow(
      {
        case: heroCase,
        declaration: {
          status: "HELD_VALUATION",
          arrivedAt: "2026-06-30T06:14:00+02:00",
          updatedAt: "2026-07-02T13:41:00+02:00",
        },
      },
      "2026-07-02T15:00:00+02:00",
    );

    const text = formatParcelStateForPrompt(state);
    assert.match(text, /Confirmed at Basel — FCBA customs/);
    assert.match(text, /Clearance stage:/);
    assert.doesNotMatch(text, /% along/);
    assert.doesNotMatch(text, /In transit/);
    assert.doesNotMatch(text, /corridor/);
  });

  it("refuses to claim in-transit location during dead-reckoned corridor interpolation", () => {
    const timeline = buildParcelTimeline({
      case: heroCase,
      declaration: {
        status: "PENDING_REVIEW",
        arrivedAt: "2026-06-30T06:14:00+02:00",
        updatedAt: "2026-06-30T06:14:00+02:00",
      },
    });

    const state = timeline.getStateAt("2026-06-28T06:14:00+02:00");
    const text = formatParcelStateForPrompt(state);

    assert.doesNotMatch(text, /In transit/);
    assert.doesNotMatch(text, /Shenzhen/);
    assert.doesNotMatch(text, /% along/);
    assert.match(text, /Physical shipment location is not confirmed/);
  });

  it("omits fabricated location when customs arrival was never observed", () => {
    const state = getParcelStateNow(
      {
        case: { ...heroCase, status: "NEW" },
        declaration: {
          status: "PENDING_REVIEW",
          arrivedAt: undefined as unknown as string,
          updatedAt: "2026-07-02T13:41:00+02:00",
        },
      },
      "2026-07-02T15:00:00+02:00",
    );

    const text = formatParcelStateForPrompt(state);
    assert.doesNotMatch(text, /Confirmed at/);
    assert.doesNotMatch(text, /Basel/);
    assert.match(text, /Physical shipment location is not confirmed/);
  });

  it("includes full diagnostic estimate when observedOnly is false", () => {
    const timeline = buildParcelTimeline({
      case: heroCase,
      declaration: {
        status: "PENDING_REVIEW",
        arrivedAt: "2026-06-30T06:14:00+02:00",
        updatedAt: "2026-06-30T06:14:00+02:00",
      },
    });

    const state = timeline.getStateAt("2026-06-28T06:14:00+02:00");
    const text = formatParcelStateForPrompt(state, { observedOnly: false });

    assert.match(text, /In transit/);
    assert.match(text, /% along/);
  });
});
