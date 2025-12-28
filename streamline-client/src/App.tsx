import { Routes, Route } from "react-router-dom";
import AdminUsage from './pages/AdminUsage';

import Welcome from "./pages/Welcome";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import Join from "./pages/Join";
import Room from "./pages/Room";
import RoomExitPage from "./pages/RoomExitPage";
import Dashboard from "./pages/Dashboard";
import StreamSummaryPage from "./pages/StreamSummaryPage";
import PostStreamSummary from "./pages/PostStreamSummary";
import AssetLibrary from "./editing/AssetLibrary";
import ProjectsDashboard from "./editing/ProjectsDashboard";
import EditorPage from "./editing/EditorPage";
import RenderAndUploadPage from "./editing/pages/RenderAndUploadPage";
import ThankYou from "./pages/ThankYou";
import EditorDisabled from "./pages/EditorDisabled";

function App() {
  return (
    <Routes>

      <Route path="/admin/usage" element={<AdminUsage />} />
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
      <Route path="/editing/post-stream" element={<PostStreamSummary />} />
      
      {/* Thank You / Post-Stream */}
      <Route path="/thanks" element={<ThankYou />} />

      {/* Blocked Editing Routes - Coming Soon */}
      <Route path="/edit" element={<EditorDisabled />} />
      <Route path="/edit/:id" element={<EditorDisabled />} />
      <Route path="/editor" element={<EditorDisabled />} />
      <Route path="/editor/:id" element={<EditorDisabled />} />
      <Route path="/editing/assets" element={<EditorDisabled />} />
      <Route path="/editing/projects" element={<EditorDisabled />} />
      <Route path="/editing/editor/:projectId" element={<EditorDisabled />} />
      <Route path="/editing/export/:projectId" element={<EditorDisabled />} />
    </Routes>
  );
}

export default App;

