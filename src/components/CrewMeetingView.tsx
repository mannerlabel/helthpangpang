/**
 * 크루 미팅 화면 컴포넌트
 * 참여자들의 영상/음성을 표시
 */

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { databaseService, CrewMember, User } from '@/services/databaseService'
import { authService } from '@/services/authService'

interface Participant {
  id: string
  userId: string
  userName: string
  videoEnabled: boolean
  audioEnabled: boolean
  status: 'active' | 'completed' | 'resting'
  score?: number
  currentCount?: number
}

interface CrewMeetingViewProps {
  crewId: string
  myVideoEnabled: boolean
  myAudioEnabled: boolean
  onVideoToggle: (enabled: boolean) => void
  onAudioToggle: (enabled: boolean) => void
  myStatus: 'active' | 'completed' | 'resting'
  myScore?: number
  myCurrentCount?: number
}

const CrewMeetingView = ({
  crewId,
  myVideoEnabled,
  myAudioEnabled,
  onVideoToggle,
  onAudioToggle,
  myStatus,
  myScore,
  myCurrentCount,
}: CrewMeetingViewProps) => {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [myVideoStream, setMyVideoStream] = useState<MediaStream | null>(null)
  const myVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    loadParticipants()
    const interval = setInterval(loadParticipants, 2000) // 2초마다 갱신
    return () => clearInterval(interval)
  }, [crewId])

  useEffect(() => {
    // 내 영상 스트림 설정
    if (myVideoEnabled) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: false })
        .then((stream) => {
          setMyVideoStream(stream)
          if (myVideoRef.current) {
            myVideoRef.current.srcObject = stream
          }
        })
        .catch((error) => {
          console.error('영상 스트림 가져오기 실패:', error)
        })
    } else {
      if (myVideoStream) {
        myVideoStream.getTracks().forEach((track) => track.stop())
        setMyVideoStream(null)
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = null
        }
      }
    }

    return () => {
      if (myVideoStream) {
        myVideoStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [myVideoEnabled])

  const loadParticipants = async () => {
    try {
      const user = authService.getCurrentUser()
      if (!user) return

      const members = await databaseService.getCrewMembers(crewId)
      const participantList: Participant[] = []

      for (const member of members) {
        const memberUser = await databaseService.getUserById(member.userId)
        if (memberUser) {
          participantList.push({
            id: member.id,
            userId: member.userId,
            userName: memberUser.name,
            videoEnabled: member.videoEnabled,
            audioEnabled: member.audioEnabled,
            status: member.userId === user.id ? myStatus : 'active', // 실제로는 세션에서 가져와야 함
            score: member.userId === user.id ? myScore : undefined,
            currentCount: member.userId === user.id ? myCurrentCount : undefined,
          })
        }
      }

      setParticipants(participantList)
    } catch (error) {
      console.error('참여자 로드 실패:', error)
    }
  }

  const getStatusText = (status: string, score?: number) => {
    if (status === 'completed') {
      return `완료 ${score ? `(${Math.round(score)}점)` : ''}`
    }
    if (status === 'resting') {
      return '휴식 중'
    }
    return '진행중'
  }

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'bg-green-500'
    if (status === 'resting') return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  return (
    <div className="bg-gray-900/95 rounded-t-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">참여자 ({participants.length}명)</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onVideoToggle(!myVideoEnabled)}
            className={`px-3 py-2 rounded-lg font-semibold text-sm transition ${
              myVideoEnabled
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            📹 {myVideoEnabled ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => onAudioToggle(!myAudioEnabled)}
            className={`px-3 py-2 rounded-lg font-semibold text-sm transition ${
              myAudioEnabled
                ? 'bg-green-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            🎤 {myAudioEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {participants.map((participant) => (
          <motion.div
            key={participant.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 rounded-lg p-3 relative overflow-hidden"
          >
            {/* 영상 또는 플레이스홀더 */}
            {participant.videoEnabled ? (
              <div className="aspect-video bg-gray-700 rounded mb-2 flex items-center justify-center">
                {participant.userId === authService.getCurrentUser()?.id && myVideoRef.current ? (
                  <video
                    ref={myVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <div className="text-gray-400 text-sm">영상 공유 중</div>
                )}
              </div>
            ) : (
              <div className="aspect-video bg-gray-700 rounded mb-2 flex items-center justify-center">
                <div className="text-4xl">{participant.userName.charAt(0)}</div>
              </div>
            )}

            {/* 사용자 정보 */}
            <div className="text-center">
              <div className="text-white text-sm font-semibold truncate">{participant.userName}</div>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(
                    participant.status
                  )} text-white`}
                >
                  {getStatusText(participant.status, participant.score)}
                </span>
              </div>
              {participant.currentCount !== undefined && (
                <div className="text-xs text-gray-400 mt-1">{participant.currentCount}개</div>
              )}
            </div>

            {/* 영상/음성 아이콘 */}
            <div className="absolute top-2 right-2 flex gap-1">
              {participant.videoEnabled && (
                <span className="text-xs bg-blue-500/80 text-white px-1.5 py-0.5 rounded">📹</span>
              )}
              {participant.audioEnabled && (
                <span className="text-xs bg-green-500/80 text-white px-1.5 py-0.5 rounded">🎤</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export default CrewMeetingView

