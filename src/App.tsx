import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { databaseService } from './services/databaseService'
import { dormantService } from './services/dormantService'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import ModeSelectionPage from './pages/ModeSelectionPage'
import ExerciseSelectPage from './pages/ExerciseSelectPage'
import TrainingPage from './pages/TrainingPage'
import ResultPage from './pages/ResultPage'
import JoggingPage from './pages/JoggingPage'
import JoggingModeSelectPage from './pages/JoggingModeSelectPage'
import JoggingConfigPage from './pages/JoggingConfigPage'
import JoggingCrewMainPage from './pages/JoggingCrewMainPage'
import JoggingCrewCreatePage from './pages/JoggingCrewCreatePage'
import JoggingCrewListPage from './pages/JoggingCrewListPage'
import JoggingCrewSearchPage from './pages/JoggingCrewSearchPage'
import JoggingAlonePage from './pages/JoggingAlonePage'
import JoggingGoalCreatePage from './pages/JoggingGoalCreatePage'
import SettingsPage from './pages/SettingsPage'
import CrewMainPage from './pages/CrewMainPage'
import CrewCreatePage from './pages/CrewCreatePage'
import CrewListPage from './pages/CrewListPage'
import CrewSearchPage from './pages/CrewSearchPage'
import SingleModePage from './pages/SingleModePage'
import SingleGoalCreatePage from './pages/SingleGoalCreatePage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminDormantCrewsPage from './pages/AdminDormantCrewsPage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import { authService } from './services/authService'

// 인증이 필요한 페이지를 보호하는 컴포넌트
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    setIsAuthenticated(authService.isAuthenticated())
  }, [])

  if (isAuthenticated === null) {
    return <div className="min-h-screen flex items-center justify-center text-white">로딩 중...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  // 앱 시작 시 데이터베이스 초기화
  useEffect(() => {
    databaseService.initialize()
    
    // 휴면 크루 자동 지정 및 삭제 (매 시간마다 체크)
    const checkDormantCrews = async () => {
      try {
        await dormantService.markDormantCrews()
        await dormantService.deleteScheduledCrews()
      } catch (error) {
        console.error('휴면 크루 체크 중 오류:', error)
      }
    }
    
    // 즉시 한 번 실행
    checkDormantCrews()
    
    // 매 시간마다 실행
    const interval = setInterval(checkDormantCrews, 60 * 60 * 1000) // 1시간
    
    return () => clearInterval(interval)
  }, [])

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mode-select"
          element={
            <ProtectedRoute>
              <ModeSelectionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exercise-select"
          element={
            <ProtectedRoute>
              <ExerciseSelectPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/training"
          element={
            <ProtectedRoute>
              <TrainingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/result"
          element={
            <ProtectedRoute>
              <ResultPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/jogging"
          element={
            <ProtectedRoute>
              <JoggingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/jogging-mode-select"
          element={
            <ProtectedRoute>
              <JoggingModeSelectPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/jogging-config"
          element={
            <ProtectedRoute>
              <JoggingConfigPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/jogging-crew"
          element={
            <ProtectedRoute>
              <JoggingCrewMainPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/jogging-crew/create"
          element={
            <ProtectedRoute>
              <JoggingCrewCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/jogging-crew/edit/:crewId"
          element={
            <ProtectedRoute>
              <JoggingCrewCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/jogging-crew/my-crews"
          element={
            <ProtectedRoute>
              <JoggingCrewListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/jogging-crew/search"
          element={
            <ProtectedRoute>
              <JoggingCrewSearchPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/jogging-alone"
          element={
            <ProtectedRoute>
              <JoggingAlonePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/jogging-goal/create"
          element={
            <ProtectedRoute>
              <JoggingGoalCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/jogging-goal/edit/:goalId"
          element={
            <ProtectedRoute>
              <JoggingGoalCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/crew"
          element={
            <ProtectedRoute>
              <CrewMainPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/crew/create"
          element={
            <ProtectedRoute>
              <CrewCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/crew/my-crews"
          element={
            <ProtectedRoute>
              <CrewListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/crew/search"
          element={
            <ProtectedRoute>
              <CrewSearchPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/single"
          element={
            <ProtectedRoute>
              <SingleModePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/single/goal/create"
          element={
            <ProtectedRoute>
              <SingleGoalCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/single/goal/edit/:goalId"
          element={
            <ProtectedRoute>
              <SingleGoalCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dormant-crews"
          element={
            <ProtectedRoute>
              <AdminDormantCrewsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/announcements"
          element={
            <ProtectedRoute>
              <AnnouncementsPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  )
}

export default App

