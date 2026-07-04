import React from "react";
import ReactDOM from "react-dom/client";

function App() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0e1a",
      color: "#e5e7eb",
      fontFamily: "'Inter', sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        textAlign: "center",
        padding: "3rem",
        background: "#1a2035",
        border: "1px solid #2a3555",
        borderRadius: "1rem",
        maxWidth: "480px",
      }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏢</div>
        <h1 style={{
          fontSize: "1.5rem",
          marginBottom: "0.5rem",
          background: "linear-gradient(135deg, #3b82f6, #818cf8)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          ClearBorder Office
        </h1>
        <p style={{ color: "#9ca3af", lineHeight: 1.6, fontSize: "0.9rem" }}>
          Pixel-agents visualization will be integrated in Phase 4.
          Three agents — Translator, Case-file, Portal — will animate
          from real backend events here.
        </p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
