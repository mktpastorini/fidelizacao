import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { SplashCursor } from "./components/SplashCursor.tsx";

createRoot(document.getElementById("root")!).render(
  <>
    <SplashCursor />
    <App />
  </>
);