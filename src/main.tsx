import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";

if (window.isSecureContext) {
  registerSW({ immediate: true });
}

if (new URLSearchParams(window.location.search).get("widget") === "1") {
  document.documentElement.classList.add("desktop-widget-window");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
