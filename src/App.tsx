import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ModeSelectionPage from './pages/ModeSelectionPage'
import ExerciseSelectPage from './pages/ExerciseSelectPage'
import TrainingPage from './pages/TrainingPage'
import ResultPage from './pages/ResultPage'
import JoggingPage from './pages/JoggingPage'
import JoggingModeSelectPage from './pages/JoggingModeSelectPage'
import JoggingConfigPage from './pages/JoggingConfigPage'
import SettingsPage from './pages/SettingsPage'
import CrewMainPage from './pages/CrewMainPage'
import CrewCreatePage from './pages/CrewCreatePage'
import CrewListPage from './pages/CrewListPage'
import CrewSearchPage from './pages/CrewSearchPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ModeSelectionPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/mode-select" element={<ModeSelectionPage />} />
        <Route path="/exercise-select" element={<ExerciseSelectPage />} />
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/jogging" element={<JoggingPage />} />
        <Route path="/jogging-mode-select" element={<JoggingModeSelectPage />} />
        <Route path="/jogging-config" element={<JoggingConfigPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/crew" element={<CrewMainPage />} />
        <Route path="/crew/create" element={<CrewCreatePage />} />
        <Route path="/crew/my-crews" element={<CrewListPage />} />
        <Route path="/crew/search" element={<CrewSearchPage />} />
      </Routes>
    </Router>
  )
}

export default App

