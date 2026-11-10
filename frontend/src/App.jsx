import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { Overview } from "./pages/Overview";
import { LiveMonitoring } from "./pages/LiveMonitoring";
import { SatelliteExplorer } from "./pages/SatelliteExplorer";
import { Gallery } from "./pages/Gallery";
import { DisasterIntelligence } from "./pages/DisasterIntelligence";
import { Analytics } from "./pages/Analytics";
import { Settings } from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/monitoring" element={<LiveMonitoring />} />
          <Route path="/explorer" element={<SatelliteExplorer />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/intelligence" element={<DisasterIntelligence />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
