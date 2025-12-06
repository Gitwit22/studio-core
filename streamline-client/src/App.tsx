import { Routes, Route } from "react-router-dom";

import Welcome from "./pages/Welcome";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import Join from "./pages/Join";
import Room from "./pages/Room";
import RoomExitPage from "./pages/RoomExitPage";
import Dashboard from "./pages/Dashboard";
import StreamSummaryPage from "./pages/StreamSummaryPage";
import AssetLibrary from "./editing/AssetLibrary";
import ProjectsDashboard from "./editing/ProjectsDashboard";
import EditorPage from "./editing/EditorPage";

function App() {
  return (
    <Routes>
      {/* Public / auth flow */}
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* User dashboard */}
      <Route path="/dashboard" element={<Dashboard />} />

      {/* Streaming flow */}
      <Route path="/join" element={<Join />} />
      <Route path="/room/:roomName" element={<Room />} />
      <Route path="/room-exit/:recordingId" element={<RoomExitPage />} />

      {/* Stream Summary */}
      <Route path="/stream-summary/:recordingId" element={<StreamSummaryPage />} />

      {/* Editing flow */}
      <Route path="/editing/assets" element={<AssetLibrary />} />
      <Route path="/editing/projects" element={<ProjectsDashboard />} />
      <Route path="/editing/editor/:projectId" element={<EditorPage />} />
    </Routes>
  );
}

export default App;

