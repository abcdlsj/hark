import ReactDOM from "react-dom/client";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/geist-mono";
import "./styles.css";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
