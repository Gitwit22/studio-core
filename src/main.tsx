import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { persistenceService } from "./studio/persistence";

async function bootstrap() {
	await persistenceService.hydrateFromCloud();
	createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
