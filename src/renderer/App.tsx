import { MemoryRouter as Router, Route, Routes } from 'react-router-dom';
import './App.css';
import { DanceDetails } from './pages/DanceDetails';
import { Dances } from './pages/Dances';
import { PlaylistDetails } from './pages/PlaylistDetails';
import { Playlists } from './pages/Playlists';
import { Settings } from './pages/Settings';
import { Songs } from './pages/Songs';
import { PracticeTime } from './pages/PracticeTime';
import { Showtime } from './pages/Showtime';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PracticeTime />} />
        <Route path="/showtime" element={<Showtime />} />
        <Route path="/songs" element={<Songs />} />
        <Route path="/dances" element={<Dances />} />
        <Route path="/dances/:danceId" element={<DanceDetails />} />
        <Route path="/playlists" element={<Playlists />} />
        <Route path="/playlists/:playlistId" element={<PlaylistDetails />} />
        <Route path="Settings" element={<Settings />} />
      </Routes>
    </Router>
  );
}
