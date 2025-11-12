import { Routes, Route, Navigate } from 'react-router-dom';
import Room from './routes/Room';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/room/test" replace />} />
      <Route path="/room/:roomId" element={<Room />} />
    </Routes>
  );
}
