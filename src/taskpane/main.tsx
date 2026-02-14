import { createRoot } from "react-dom/client";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import App from "./App";
import "./styles.css";

function render(): void {
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Root container not found");
  }

  createRoot(container).render(
    <FluentProvider theme={webLightTheme}>
      <App />
    </FluentProvider>
  );
}

if (typeof Office !== "undefined") {
  Office.onReady(() => {
    render();
  });
} else {
  render();
}
