import { Routes, Route } from "react-router-dom";

import Welcome from "./pages/Welcome";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import Join from "./pages/Join";
import Room from "./pages/Room";

// existing imports like Room, Dashboard, etc.

function App() {
  return (
    <Routes>
      {/* Public / auth flow */}
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Streaming flow */}
      <Route path="/join" element={<Join />} />
      <Route path="/room/:roomName" element={<Room />} />
    </Routes>
  );
}

export default App;

