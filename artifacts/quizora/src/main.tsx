import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ---------------------------------------------------------------------------
// Stale-cache busting
// Every Vite build bakes a unique timestamp via `define: { __APP_VERSION__ }`.
// If the stored version differs from the current build we clear sessionStorage
// (profile caches, etc.) so the user never sees data from an old build.
// ---------------------------------------------------------------------------
declare const __APP_VERSION__: string;

(function bustStaleSessionCache() {
  const BUILD_KEY = "quizora_build_version";
  try {
    const stored = localStorage.getItem(BUILD_KEY);
    if (stored !== __APP_VERSION__) {
      sessionStorage.clear();
      localStorage.setItem(BUILD_KEY, __APP_VERSION__);
    }
  } catch { /* ignore — private browsing or storage quota */ }
})();

// ---------------------------------------------------------------------------
// Stale-chunk recovery
// When Vite deploys a new build, old JS chunk hashes no longer exist on the
// server. Dynamic imports of those chunks throw "Failed to fetch dynamically
// imported module". Catching these errors and reloading forces the browser to
// fetch the fresh index.html (which references the new chunk hashes).
// ---------------------------------------------------------------------------
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

window.addEventListener("unhandledrejection", (event) => {
  const msg: string = event.reason?.message ?? "";
  if (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed")
  ) {
    event.preventDefault();
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
