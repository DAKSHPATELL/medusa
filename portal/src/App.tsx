import { useState } from "react";

// Mock shipment entry data — seeded for the demo
const SEED_ENTRY = {
  ref: "EU-2026-CBR-00417",
  declarant: "SolarTech GmbH",
  declarantId: "DE-EORI-2026-8847",
  origin: "Shenzhen, China",
  destination: "Hamburg, Germany",
  description: "Photovoltaic panels — monocrystalline silicon, 400W modules",
  invoiceValue: "€47,250.00",
  packingListValue: "€45,000.00", // mismatch vs invoice — Computer Use harmonizes this
  hsCode: "8541.40.90",
  currency: "EUR",
  incoterm: "CIF Hamburg",
  packages: "120",
  grossWeight: "2,640 kg",
  netWeight: "2,400 kg",
  vesselName: "MSC ELENA",
  voyageNo: "VY-2026-0891",
  eta: "2026-07-09",
};

type EntryData = typeof SEED_ENTRY;

export default function App() {
  const [entry, setEntry] = useState<EntryData>({ ...SEED_ENTRY });
  const [toast, setToast] = useState<{ type: string; msg: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function showToast(type: string, msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  function handleChange(field: keyof EntryData, value: string) {
    setEntry((prev) => ({ ...prev, [field]: value }));
  }

  function handleSaveDraft() {
    showToast("success", "Draft saved successfully");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    showToast("success", "Declaration submitted — Entry approved ✓");
  }

  return (
    <div>
      {/* === Header === */}
      <header className="portal-header">
        <div className="portal-header-top">
          <div className="logo-area">
            <div className="eu-stars">★</div>
            <div>
              <h1>European Union Customs Service</h1>
              <div className="subtitle">Single Window — Electronic Declaration Portal</div>
            </div>
          </div>
          <div className="user-info">
            Logged in as: <strong>ClearBorder Agent</strong> · Automated Session · <span style={{ opacity: 0.7 }}>🔒 TLS 1.3</span>
          </div>
        </div>
        <nav className="portal-nav">
          <a href="#" id="nav-dashboard">Dashboard</a>
          <a href="#" className="active" id="nav-entries">Entries</a>
          <a href="#" id="nav-tariff">Tariff Lookup</a>
          <a href="#" id="nav-compliance">Compliance</a>
          <a href="#" id="nav-reports">Reports</a>
        </nav>
      </header>

      {/* === Main === */}
      <main className="portal-main">
        <div className="breadcrumb">
          <a href="#">Home</a>
          <span>›</span>
          <a href="#">Entries</a>
          <span>›</span>
          {entry.ref}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="entry-card">
            <div className="entry-card-header">
              <div>
                <h2>Customs Declaration Entry</h2>
                <span className="entry-ref">{entry.ref}</span>
              </div>
              <span className={`entry-status ${submitted ? "submitted" : "pending"}`}>
                {submitted ? "✓ Submitted" : "● Pending Amendment"}
              </span>
            </div>

            <div className="entry-card-body">
              {/* Declarant info */}
              <div className="form-section">
                <div className="form-section-title">Declarant Information</div>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="declarant">Declarant Name</label>
                    <input
                      type="text"
                      id="declarant"
                      value={entry.declarant}
                      disabled
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="declarantId">EORI Number</label>
                    <input
                      type="text"
                      id="declarantId"
                      value={entry.declarantId}
                      disabled
                    />
                  </div>
                </div>
              </div>

              {/* Shipment details */}
              <div className="form-section">
                <div className="form-section-title">Shipment Details</div>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="origin">Country of Origin <span className="required">*</span></label>
                    <input
                      type="text"
                      id="origin"
                      value={entry.origin}
                      onChange={(e) => handleChange("origin", e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="destination">Port of Entry <span className="required">*</span></label>
                    <input
                      type="text"
                      id="destination"
                      value={entry.destination}
                      onChange={(e) => handleChange("destination", e.target.value)}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label htmlFor="description">Goods Description <span className="required">*</span></label>
                    <textarea
                      id="description"
                      rows={2}
                      value={entry.description}
                      onChange={(e) => handleChange("description", e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="vesselName">Vessel / Flight</label>
                    <input type="text" id="vesselName" value={entry.vesselName} disabled />
                  </div>
                  <div className="form-group">
                    <label htmlFor="voyageNo">Voyage / Flight No.</label>
                    <input type="text" id="voyageNo" value={entry.voyageNo} disabled />
                  </div>
                  <div className="form-group">
                    <label htmlFor="eta">ETA</label>
                    <input type="text" id="eta" value={entry.eta} disabled />
                  </div>
                  <div className="form-group">
                    <label htmlFor="incoterm">Incoterm</label>
                    <input type="text" id="incoterm" value={entry.incoterm} disabled />
                  </div>
                </div>
              </div>

              {/* Valuation */}
              <div className="form-section">
                <div className="form-section-title">Valuation & Classification</div>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="invoiceValue">Invoice Value <span className="required">*</span></label>
                    <input
                      type="text"
                      id="invoiceValue"
                      value={entry.invoiceValue}
                      onChange={(e) => handleChange("invoiceValue", e.target.value)}
                    />
                    <span className="field-hint">As stated on commercial invoice</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="packingListValue">Packing List Value <span className="required">*</span></label>
                    <input
                      type="text"
                      id="packingListValue"
                      value={entry.packingListValue}
                      onChange={(e) => handleChange("packingListValue", e.target.value)}
                    />
                    <span className="field-hint">Total value from packing list</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="hsCode">HS Code <span className="required">*</span></label>
                    <input
                      type="text"
                      id="hsCode"
                      value={entry.hsCode}
                      onChange={(e) => handleChange("hsCode", e.target.value)}
                    />
                    <span className="field-hint">Harmonized System tariff classification</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="currency">Currency</label>
                    <select id="currency" value={entry.currency} onChange={(e) => handleChange("currency", e.target.value)}>
                      <option value="EUR">EUR — Euro</option>
                      <option value="USD">USD — US Dollar</option>
                      <option value="GBP">GBP — British Pound</option>
                      <option value="CNY">CNY — Chinese Yuan</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Packaging */}
              <div className="form-section">
                <div className="form-section-title">Packaging</div>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="packages">Number of Packages</label>
                    <input
                      type="text"
                      id="packages"
                      value={entry.packages}
                      onChange={(e) => handleChange("packages", e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="grossWeight">Gross Weight</label>
                    <input
                      type="text"
                      id="grossWeight"
                      value={entry.grossWeight}
                      onChange={(e) => handleChange("grossWeight", e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="netWeight">Net Weight</label>
                    <input
                      type="text"
                      id="netWeight"
                      value={entry.netWeight}
                      onChange={(e) => handleChange("netWeight", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Value Proof Upload */}
              <div className="form-section">
                <div className="form-section-title">Supporting Documents</div>
                <div className="form-group">
                  <label>Value Proof Document</label>
                  <div className="file-upload" id="valueProofUpload">
                    <span className="upload-icon">📎</span>
                    <span className="upload-text">
                      <strong>Click to upload</strong> or drag and drop<br />
                      PDF, JPG, PNG up to 10 MB
                    </span>
                  </div>
                  <span className="field-hint">
                    Attach proof of declared value (bank transfer, purchase order, etc.)
                  </span>
                </div>
              </div>
            </div>

            {/* Action bar */}
            <div className="action-bar">
              <button type="button" className="save-draft" id="saveDraftBtn" onClick={handleSaveDraft}>
                Save Draft
              </button>
              <button type="submit" className="submit-btn" id="submitBtn" disabled={submitted}>
                {submitted ? "Submitted ✓" : "Submit Declaration"}
              </button>
            </div>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="portal-footer">
        European Union Customs Service — Single Window Portal v4.2.1 — Environment: PRODUCTION<br />
        © 2026 EUCS. Secured connection via TLS 1.3. Unauthorized access is prohibited under EU Regulation 2019/1020.<br />
        <span style={{ opacity: 0.6 }}>This is a demonstration environment. No actual customs declarations are processed.</span>
      </footer>

      {/* Toast */}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
