import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { FluidCursor } from "./components/FluidCursor.tsx";

createRoot(document.getElementById("root")!).render(
  <>
    <FluidCursor />
    <App />
  </>
);