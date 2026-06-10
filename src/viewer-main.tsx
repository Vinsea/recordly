import React from "react";
import ReactDOM from "react-dom/client";
import { I18nProvider } from "./contexts/I18nContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { WebViewerPage } from "./pages/web-viewer/WebViewerPage";
import "./index.css";

document.documentElement.dataset.platform = /mac/i.test(navigator.platform) ? "macos" : "other";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<ThemeProvider>
			<I18nProvider>
				<WebViewerPage />
			</I18nProvider>
		</ThemeProvider>
	</React.StrictMode>,
);
