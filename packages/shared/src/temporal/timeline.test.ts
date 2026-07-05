import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CaseRecord } from "../models";
import { buildParcelTimeline, getParcelStateNow } from "./build";
import { ParcelTimeline } from "./timeline";
import type { ParcelCorridor, ProcessObservation } from "./types";

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

describe("ParcelTimeline", () => {
  it("returns full confidence at an exact observation time", () => {
    const timeline = buildParcelTimeline({
      case: heroCase,
      declaration: {
        status: "HELD_VALUATION",
        arrivedAt: "2026-06-30T06:14:00+02:00",
        updatedAt: "2026-07-02T13:41:00+02:00",
      },
      events: [
        {
          id: "e1",
          seq: 1,
          at: "2026-07-02T14:00:00+02:00",
          day: 1,
          caseId: heroCase.id,
          type: "case.status_changed",
          from: "NEW",
          to: "HELD_VALUATION",
        },
      ],
    });

    const state = timeline.getStateAt("2026-07-02T14:00:00+02:00");
    assert.equal(state.inferenceMode, "observed");
    assert.equal(state.confidence, 1);
    assert.equal(state.process.caseStatus, "HELD_VALUATION");
  });

  it("places the parcel at customs during a valuation hold", () => {
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

    assert.equal(state.location.anchorId, "customs");
    assert.equal(state.location.place.city, "Basel");
    assert.equal(state.process.caseStatus, "HELD_VALUATION");
    assert.ok(state.confidence > 0.5);
  });

  it("interpolates in-transit location between origin departure and customs arrival", () => {
    const timeline = buildParcelTimeline({
      case: heroCase,
      declaration: {
        status: "PENDING_REVIEW",
        arrivedAt: "2026-06-30T06:14:00+02:00",
        updatedAt: "2026-06-30T06:14:00+02:00",
      },
    });

    const midTransit = timeline.getStateAt("2026-06-28T06:14:00+02:00");
    assert.equal(midTransit.location.anchorId, "transit");
    assert.match(midTransit.location.place.label, /In transit/);
    assert.ok(midTransit.location.corridorProgress > 0);
    assert.ok(midTransit.location.corridorProgress < 0.55);
  });

  it("decays confidence when extrapolating far beyond last observation", () => {
    const corridor: ParcelCorridor = {
      origin: {
        id: "origin",
        kind: "origin",
        place: { label: "A", city: "A", countryCode: "CN" },
      },
      customs: {
        id: "customs",
        kind: "customs",
        place: { label: "B", city: "Basel", countryCode: "CH" },
        enteredAt: "2026-07-01T00:00:00Z",
      },
      destination: {
        id: "destination",
        kind: "destination",
        place: { label: "C", city: "Zürich", countryCode: "CH" },
      },
      anchors: [],
    };
    corridor.anchors = [corridor.origin, corridor.customs, corridor.destination];

    const observations: ProcessObservation[] = [
      {
        at: "2026-07-01T00:00:00Z",
        label: "At customs",
        source: "test",
      },
    ];

    const timeline = new ParcelTimeline(corridor, observations, {
      confidenceHalfLifeHours: 24,
    });

    const near = timeline.getStateAt("2026-07-02T00:00:00Z");
    const far = timeline.getStateAt("2026-07-10T00:00:00Z");

    assert.equal(near.inferenceMode, "extrapolated");
    assert.ok(near.confidence > far.confidence);
    assert.ok(far.uncertainty);
    assert.ok(Date.parse(far.uncertainty!.latest) > Date.parse(far.at));
  });
});
