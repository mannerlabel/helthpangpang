import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { audioService } from '@/services/audioService'
import { AppSettings } from '@/types'

const SettingsPage = () => {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<AppSettings>({
    audioEnabled: true,
    audioVolume: 1.0,
    voiceType: 'female',
    backgroundMusic: 1,
  })
  const [previewingMusicId, setPreviewingMusicId] = useState<number | null>(null)

  useEffect(() => {
    // 로컬 스토리지에서 설정 불러오기
    const savedSettings = localStorage.getItem('appSettings')
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings)
      setSettings(parsed)
      // 오디오 서비스에 설정 적용
      audioService.setConfig({
        enabled: parsed.audioEnabled,
        volume: parsed.audioVolume,
        voiceType: parsed.voiceType,
        backgroundMusic: parsed.backgroundMusic || 1,
      })
    }

    // 컴포넌트 언마운트 시 미리듣기 정지
    return () => {
      audioService.stopPreview()
    }
  }, [])

  const handleSave = () => {
    // 로컬 스토리지에 저장
    localStorage.setItem('appSettings', JSON.stringify(settings))
    // 오디오 서비스에 설정 적용
      audioService.setConfig({
        enabled: settings.audioEnabled,
        volume: settings.audioVolume,
        voiceType: settings.voiceType,
        backgroundMusic: settings.backgroundMusic || 1,
      })
    navigate(-1) // 이전 페이지로 돌아가기
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 text-center">설정</h1>

        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">음성 설정</h2>
          
          {/* 음성 기능 켜기/끄기 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-white text-lg">음성 기능</label>
              <button
                onClick={() => setSettings((prev) => ({ ...prev, audioEnabled: !prev.audioEnabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.audioEnabled ? 'bg-primary-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.audioEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-gray-400 text-sm">카운트 음성 안내를 켜거나 끕니다</p>
          </div>

          {/* 음성 볼륨 */}
          {settings.audioEnabled && (
            <div className="mb-6">
              <label className="block text-white mb-2">볼륨</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.audioVolume}
                onChange={(e) => setSettings((prev) => ({ ...prev, audioVolume: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <div className="text-gray-400 text-sm mt-1">{Math.round(settings.audioVolume * 100)}%</div>
            </div>
          )}

          {/* 음성 타입 */}
          {settings.audioEnabled && (
            <div className="mb-6">
              <label className="block text-white mb-2">음성 타입</label>
              <div className="flex gap-4">
                <button
                  onClick={() => setSettings((prev) => ({ ...prev, voiceType: 'female' }))}
                  className={`px-4 py-2 rounded-lg transition ${
                    settings.voiceType === 'female'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  여성
                </button>
                <button
                  onClick={() => setSettings((prev) => ({ ...prev, voiceType: 'male' }))}
                  className={`px-4 py-2 rounded-lg transition ${
                    settings.voiceType === 'male'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  남성
                </button>
              </div>
            </div>
          )}

          {/* 배경음악 선택 */}
          {settings.audioEnabled && (
            <div className="mb-6">
              <label className="block text-white mb-2">배경음악</label>
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((musicId) => (
                  <div
                    key={musicId}
                    className={`relative rounded-lg transition ${
                      settings.backgroundMusic === musicId
                        ? 'bg-primary-500 text-white ring-2 ring-primary-300'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setSettings((prev) => ({ ...prev, backgroundMusic: musicId }))
                      }}
                      className="w-full px-4 py-3 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-lg font-semibold">BGM {musicId}</div>
                          <div className="text-xs opacity-80">
                            {settings.backgroundMusic === musicId ? '선택됨' : '선택'}
                          </div>
                        </div>
                        <div className="text-2xl">🎵</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        if (previewingMusicId === musicId) {
                          // 미리듣기 중이면 정지
                          audioService.stopPreview()
                          setPreviewingMusicId(null)
                        } else {
                          // 미리듣기 시작
                          audioService.stopPreview()
                          audioService.playBackgroundMusic(musicId, true)
                          setPreviewingMusicId(musicId)
                          // 5초 후 자동으로 미리듣기 상태 해제
                          setTimeout(() => {
                            setPreviewingMusicId(null)
                          }, 5000)
                        }
                      }}
                      className={`absolute top-2 right-2 p-2 rounded-full transition ${
                        previewingMusicId === musicId
                          ? 'bg-red-500 hover:bg-red-600'
                          : 'bg-gray-600 hover:bg-gray-500'
                      }`}
                      title={previewingMusicId === musicId ? '정지' : '미리듣기'}
                    >
                      {previewingMusicId === musicId ? (
                        <span className="text-white text-sm">⏸</span>
                      ) : (
                        <span className="text-white text-sm">▶</span>
                      )}
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-gray-400 text-sm mt-2">
                운동 시작 시 선택한 배경음악이 재생됩니다 (▶ 버튼으로 미리듣기)
              </p>
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 px-6 py-4 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-6 py-4 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage

