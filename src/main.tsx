import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Mount point #root is missing from index.html — the app cannot start");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Visible in the browser console — confirms the JavaScript bundle executed.
console.info("[app] mounted — Client Engagement Tracker v2");
