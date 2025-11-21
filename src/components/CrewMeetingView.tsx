/**
 * 크루 미팅 화면 컴포넌트
 * Zoom 스타일 영상 화면
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
  status: 'active' | 'completed' | 'resting' | 'inactive'
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
  onHeightChange?: (height: number) => void // 높이 변경 콜백
  onEntryMessage?: (message: string) => void // 입장 메시지 콜백 (데이터베이스에 저장하지 않음)
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
  onHeightChange,
  onEntryMessage,
}: CrewMeetingViewProps) => {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [myVideoStream, setMyVideoStream] = useState<MediaStream | null>(null)
  const myVideoRef = useRef<HTMLVideoElement>(null)
  const participantVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())
  const [height, setHeight] = useState(120) // 현재 높이 (px)
  const [isExpanded, setIsExpanded] = useState(false) // 펼쳐진 상태 여부
  
  // 높이 제한: 최소 높이와 최대 높이
  const COLLAPSED_HEIGHT = 120 // 접힌 상태 높이 (핸들바 + 제목)
  const MAX_HEIGHT = window.innerHeight * 0.7 // 최대 높이 (화면의 70%)

  useEffect(() => {
    loadParticipants()
    const interval = setInterval(loadParticipants, 2000) // 2초마다 갱신
    return () => clearInterval(interval)
  }, [crewId])
  
  // 디버깅: 활성 사용자 감지 로그
  useEffect(() => {
    console.log('참여자 상태 업데이트:', {
      participants: participants.map(p => ({
        name: p.userName,
        userId: p.userId,
        status: p.status,
        videoEnabled: p.videoEnabled,
        audioEnabled: p.audioEnabled,
      })),
      activeCount: participants.filter(p => p.status !== 'inactive').length,
      totalCount: participants.length,
    })
  }, [participants])

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

  // useRef를 사용하여 동기적으로 관리 (비동기 상태 업데이트 문제 해결)
  const previousActiveUserIdsRef = useRef<Set<string>>(new Set())
  // 입장 메시지 전송 추적 (중복 방지)
  const sentEntryMessagesRef = useRef<Set<string>>(new Set())

  const loadParticipants = async () => {
    try {
      const user = authService.getCurrentUser()
      if (!user) return

      const members = await databaseService.getCrewMembers(crewId)
      
      // 활성 사용자 ID 수집 (localStorage + Supabase)
      const activeUserIds = new Set<string>()
      
      // 현재 사용자는 항상 활성으로 간주
      activeUserIds.add(user.id)
      
      // localStorage에서 현재 활성 세션 확인 (같은 브라우저/탭)
      try {
        const activeSessions = localStorage.getItem('active_training_sessions')
        if (activeSessions) {
          const sessions = JSON.parse(activeSessions)
          sessions.forEach((session: { userId: string; crewId: string }) => {
            if (session.crewId === crewId) {
              activeUserIds.add(session.userId)
            }
          })
        }
      } catch (e) {
        console.error('localStorage 세션 읽기 실패:', e)
      }

      // Supabase에서 실제 활성 사용자 확인
      // video_enabled가 true인 사용자는 모두 활성으로 간주
      // (TrainingPage에서 5초마다 video_enabled를 true로 업데이트하므로, 
      //  true면 현재 TrainingPage에 있는 것으로 간주)
      try {
        const { supabase } = await import('@/services/supabaseClient')
        if (supabase) {
          // crew_members 테이블에서 해당 크루의 모든 멤버 조회
          const { data: allMembers, error } = await supabase
            .from('crew_members')
            .select('user_id, video_enabled, audio_enabled')
            .eq('crew_id', crewId)
          
          if (error) {
            console.error('Supabase 멤버 조회 에러:', error)
          }
          
          if (allMembers) {
            console.log('Supabase에서 조회한 멤버:', allMembers)
            
            // video_enabled가 true인 사용자는 모두 활성으로 간주
            for (const member of allMembers) {
              if (member.video_enabled === true) {
                // UUID를 그대로 activeUserIds에 추가
                activeUserIds.add(member.user_id)
                console.log('✅ 활성 사용자 추가 (video_enabled=true):', member.user_id)
                
                // localStorage ID도 추가하기 위해 email로 매핑
                try {
                  const { data: supabaseUser, error: userError } = await supabase
                    .from('users')
                    .select('email')
                    .eq('id', member.user_id)
                    .single()
                  
                  if (userError) {
                    console.error('사용자 조회 에러:', userError)
                  }
                  
                  if (supabaseUser) {
                    // localStorage에서 email로 사용자 찾기
                    const localStorageKeys = Object.keys(localStorage)
                    for (const key of localStorageKeys) {
                      if (key.startsWith('user_')) {
                        try {
                          const userData = JSON.parse(localStorage.getItem(key) || '{}')
                          if (userData.email === supabaseUser.email) {
                            // localStorage ID도 추가 (현재 브라우저/탭의 사용자 확인용)
                            const localStorageId = key.replace('user_', '')
                            activeUserIds.add(localStorageId)
                            console.log('✅ UUID->localStorage 매핑:', member.user_id, '->', localStorageId)
                            break
                          }
                        } catch (e) {
                          // 무시
                        }
                      }
                    }
                  }
                } catch (e) {
                  console.error('사용자 매핑 실패:', e)
                }
              } else {
                console.log('❌ 비활성 멤버 (video_enabled=false):', member.user_id)
              }
            }
          } else {
            console.log('⚠️ Supabase에서 멤버를 찾을 수 없음')
          }
        }
      } catch (e) {
        console.error('Supabase 활성 사용자 조회 실패:', e)
      }
      
      console.log('활성 사용자 ID 목록 (Supabase 조회 후):', Array.from(activeUserIds))
      console.log('크루 멤버 수:', members.length)
      console.log('크루 멤버 ID 목록:', members.map(m => m.userId))
      
      // 디버깅: activeUserIds에 각 멤버의 UUID가 포함되어 있는지 확인
      members.forEach(member => {
        const isInActiveList = activeUserIds.has(member.userId)
        console.log(`멤버 ${member.userId} 활성 목록 포함 여부:`, isInActiveList)
      })

      // 새로 입장한 사용자 확인 및 입장 메시지 전송
      // UUID만 비교하여 중복 방지 (localStorage ID는 제외)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const activeUuids = Array.from(activeUserIds).filter(id => uuidRegex.test(id)).sort()
      const previousActiveUuids = Array.from(previousActiveUserIdsRef.current).filter(id => uuidRegex.test(id)).sort()
      
      // 새로 입장한 UUID만 필터링 (이전에 없었던 UUID)
      const newActiveUuids = activeUuids.filter(uuid => !previousActiveUuids.includes(uuid))
      
      // 나간 사용자 확인 (이전에 있었지만 현재 없는 UUID)
      const leftUserUuids = previousActiveUuids.filter(uuid => !activeUuids.includes(uuid))
      
      // 현재 사용자의 UUID 확인 (비교용)
      let currentUserUuid = user.id
      const userUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!userUuidRegex.test(user.id)) {
        // localStorage ID인 경우, email로 UUID 찾기
        try {
          const { supabase } = await import('@/services/supabaseClient')
          if (supabase) {
            const userStr = localStorage.getItem(`user_${user.id}`)
            if (userStr) {
              const userData = JSON.parse(userStr)
              if (userData.email) {
                const { data: supabaseUser } = await supabase
                  .from('users')
                  .select('id')
                  .eq('email', userData.email)
                  .single()
                
                if (supabaseUser) {
                  currentUserUuid = supabaseUser.id
                }
              }
            }
          }
        } catch (e) {
          // 무시
        }
      }
      
      // 나간 사용자 먼저 처리 (sentEntryMessagesRef에서 제거)
      for (const leftUserId of leftUserUuids) {
        sentEntryMessagesRef.current.delete(leftUserId)
        console.log('나간 사용자 제거:', leftUserId)
      }
      
      // 새로 입장한 사용자 확인 및 입장 메시지 전송
      // sentEntryMessagesRef를 엄격하게 체크하여 중복 방지
      for (const newUserId of newActiveUuids) {
        // 현재 사용자는 제외 (UUID로 비교)
        if (newUserId === currentUserUuid) {
          console.log('현재 사용자 제외:', newUserId)
          continue
        }
        
        // 이미 입장 메시지를 전송한 사용자는 제외 (중복 방지)
        // 이 체크가 가장 중요함 - sentEntryMessagesRef에 있으면 절대 메시지 전송하지 않음
        if (sentEntryMessagesRef.current.has(newUserId)) {
          console.log('⚠️ 이미 입장 메시지 전송됨 (건너뜀):', newUserId)
          continue
        }
        
        // 다른 사용자가 입장한 경우
        const newUser = await databaseService.getUserById(newUserId)
        if (newUser) {
          // 입장 메시지 처리 (데이터베이스에 저장하지 않고 채팅창에만 표시)
          try {
            // 전송하기 전에 다시 한 번 확인 (race condition 방지)
            if (sentEntryMessagesRef.current.has(newUserId)) {
              console.log('⚠️ 전송 직전 재확인: 이미 전송됨 (건너뜀):', newUserId)
              continue
            }
            
            // 전송 전에 sentEntryMessagesRef에 먼저 추가 (동시 실행 방지)
            sentEntryMessagesRef.current.add(newUserId)
            
            // 데이터베이스에 저장하지 않고 콜백으로 전달
            const entryMessage = `${newUser.name}님이 입장하셨습니다`
            if (onEntryMessage) {
              onEntryMessage(entryMessage)
            }
            console.log('✅ 입장 메시지 표시 완료 (DB 저장 안함):', newUser.name, 'userId:', newUserId)
          } catch (error) {
            console.error('입장 메시지 처리 실패:', error)
            // 실패한 경우 sentEntryMessagesRef에서 제거 (재시도 가능)
            sentEntryMessagesRef.current.delete(newUserId)
          }
        }
      }

      // previousActiveUserIdsRef 업데이트 (항상 업데이트하여 다음 비교를 위해 준비)
      // UUID만 저장하여 중복 방지 (localStorage ID는 제외)
      previousActiveUserIdsRef.current = new Set(activeUuids)
      console.log('✅ previousActiveUserIdsRef 업데이트 완료:', Array.from(previousActiveUserIdsRef.current))

      // 모든 멤버에 대한 카드 생성 (입장 여부와 관계없이) - Zoom 스타일
      const participantList: Participant[] = []

      for (const member of members) {
        console.log('멤버 처리 중:', member.userId)
        const memberUser = await databaseService.getUserById(member.userId)
        console.log('getUserById 결과:', memberUser ? memberUser.name : 'null', 'for userId:', member.userId)
        if (memberUser) {
          // 활성 상태 확인: UUID, localStorage ID, 또는 직접 비교
          let isActive = false
          
          // 활성 상태 확인 로직 개선
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          const isMemberUUID = uuidRegex.test(member.userId)
          
          // 1. 직접 비교 (현재 사용자)
          if (member.userId === user.id) {
            isActive = true
            console.log('✅ 활성 사용자 (직접 비교):', member.userId, memberUser.name)
          } 
          // 2. activeUserIds에 직접 포함되어 있는지 확인 (UUID 또는 localStorage ID)
          else if (activeUserIds.has(member.userId)) {
            isActive = true
            console.log('✅ 활성 사용자 (activeUserIds 직접 포함):', member.userId, memberUser.name)
          } 
          // 3. UUID인 경우, email로 매핑하여 localStorage ID 찾기
          else if (isMemberUUID) {
            try {
              const { supabase } = await import('@/services/supabaseClient')
              if (supabase) {
                const { data: supabaseUser } = await supabase
                  .from('users')
                  .select('email')
                  .eq('id', member.userId)
                  .single()
                
                if (supabaseUser) {
                  // localStorage에서 email로 사용자 찾기
                  const localStorageKeys = Object.keys(localStorage)
                  for (const key of localStorageKeys) {
                    if (key.startsWith('user_')) {
                      try {
                        const userData = JSON.parse(localStorage.getItem(key) || '{}')
                        if (userData.email === supabaseUser.email) {
                          const localStorageId = key.replace('user_', '')
                          if (activeUserIds.has(localStorageId)) {
                            isActive = true
                            console.log('✅ 활성 사용자 (UUID->localStorage 매핑):', member.userId, '->', localStorageId, memberUser.name)
                            break
                          }
                        }
                      } catch (e) {
                        // 무시
                      }
                    }
                  }
                }
              }
            } catch (e) {
              console.error('활성 상태 확인 실패:', e)
            }
          }
          // 4. localStorage ID인 경우 직접 비교
          else {
            if (activeUserIds.has(member.userId)) {
              isActive = true
              console.log('✅ 활성 사용자 (localStorage ID):', member.userId, memberUser.name)
            }
          }
          
          if (!isActive) {
            console.log('❌ 비활성 사용자:', member.userId, memberUser.name, '| activeUserIds:', Array.from(activeUserIds))
          }
          
          participantList.push({
            id: member.id,
            userId: member.userId,
            userName: memberUser.name,
            videoEnabled: isActive ? member.videoEnabled : false,
            audioEnabled: isActive ? member.audioEnabled : false,
            status: member.userId === user.id ? myStatus : (isActive ? 'active' : 'inactive'),
            score: member.userId === user.id ? myScore : undefined,
            currentCount: member.userId === user.id ? myCurrentCount : undefined,
          })
        }
      }

      console.log('최종 참여자 목록:', participantList.map(p => ({ 
        name: p.userName, 
        userId: p.userId, 
        status: p.status, 
        isActive: p.status !== 'inactive' 
      })))
      setParticipants(participantList)
    } catch (error) {
      console.error('참여자 로드 실패:', error)
    }
  }

  const getStatusText = (status: string, score?: number) => {
    if (status === 'inactive') {
      return '미참여'
    }
    if (status === 'completed') {
      return `완료 ${score ? `(${Math.round(score)}점)` : ''}`
    }
    if (status === 'resting') {
      return '휴식 중'
    }
    return '진행중'
  }

  const getStatusColor = (status: string) => {
    if (status === 'inactive') return 'bg-gray-500'
    if (status === 'completed') return 'bg-green-500'
    if (status === 'resting') return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  const handleToggle = () => {
    // 클릭 시 접기/펼치기 토글
    const newIsExpanded = !isExpanded
    setIsExpanded(newIsExpanded)
    const newHeight = newIsExpanded ? MAX_HEIGHT : COLLAPSED_HEIGHT
    setHeight(newHeight)
    if (onHeightChange) {
      onHeightChange(newHeight)
    }
  }

  // 높이 변경 시 콜백 호출
  useEffect(() => {
    if (onHeightChange) {
      onHeightChange(height)
    }
  }, [height, onHeightChange])

  // Zoom 스타일 그리드 계산
  const getGridLayout = (count: number) => {
    if (count === 0) return { cols: 1, rows: 1 }
    if (count === 1) return { cols: 1, rows: 1 }
    if (count === 2) return { cols: 2, rows: 1 }
    if (count <= 4) return { cols: 2, rows: 2 }
    if (count <= 6) return { cols: 3, rows: 2 }
    if (count <= 9) return { cols: 3, rows: 3 }
    if (count <= 12) return { cols: 4, rows: 3 }
    if (count <= 16) return { cols: 4, rows: 4 }
    // 16명 이상은 4x4 그리드로 스크롤
    return { cols: 4, rows: Math.ceil(count / 4) }
  }

  const gridLayout = getGridLayout(participants.length)
  const activeCount = participants.filter(p => p.status !== 'inactive').length

  return (
    <motion.div
      className="bg-gray-900/95 rounded-t-2xl overflow-hidden fixed left-0 right-0 z-30"
      style={{ 
        height: `${height}px`,
        bottom: 'env(safe-area-inset-bottom, 0px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0px)',
      }}
      initial={{ height: COLLAPSED_HEIGHT }}
      animate={{ height }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      {/* 핸들바 */}
      <div 
        className="flex justify-center pt-2 pb-1 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleToggle()
          }
        }}
        aria-label={isExpanded ? '접기' : '펼치기'}
      >
        <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
      </div>

      <div className="p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h3 className="text-white font-semibold">
            참여자 ({activeCount}/{participants.length}명)
          </h3>
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

        <AnimatePresence>
          {height > COLLAPSED_HEIGHT && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 overflow-y-auto"
            >
              {/* Zoom 스타일 그리드 레이아웃 */}
              <div 
                className="grid gap-2 w-full h-full"
                style={{
                  gridTemplateColumns: `repeat(${gridLayout.cols}, 1fr)`,
                  gridTemplateRows: `repeat(${gridLayout.rows}, 1fr)`,
                  minHeight: `${gridLayout.rows * 180}px`, // 최소 높이 보장
                }}
              >
        {participants.map((participant) => (
          <motion.div
            key={participant.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
                    className="bg-gray-800 rounded-lg relative overflow-hidden aspect-video"
          >
            {/* 영상 또는 플레이스홀더 */}
                    {participant.status === 'inactive' ? (
                      <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-5xl mb-3">🚫</div>
                          <div className="text-gray-400 text-sm font-semibold">미참여</div>
                          <div className="text-gray-500 text-xs mt-1">{participant.userName}</div>
                        </div>
                      </div>
                    ) : participant.videoEnabled ? (
                      <div className="w-full h-full bg-gray-700 relative overflow-hidden">
                        {participant.userId === authService.getCurrentUser()?.id ? (
                          // 내 영상
                  <video
                    ref={myVideoRef}
                    autoPlay
                    muted
                    playsInline
                            className="w-full h-full object-cover"
                  />
                ) : (
                          // 다른 참여자 영상 (현재는 플레이스홀더, 실제로는 WebRTC로 스트림 받아야 함)
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                            <div className="text-center">
                              <div className="text-3xl mb-2">📹</div>
                              <div className="text-gray-300 text-sm font-semibold">{participant.userName}</div>
                              <div className="text-gray-400 text-xs mt-1">영상 공유 중</div>
                            </div>
                          </div>
                        )}
                        {/* 사용자 이름 오버레이 */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <div className="text-white text-sm font-semibold truncate">{participant.userName}</div>
                        </div>
              </div>
            ) : (
                      <div className="w-full h-full bg-gray-700 flex flex-col items-center justify-center">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mb-3">
                          <div className="text-3xl text-white font-bold">{participant.userName.charAt(0)}</div>
                        </div>
                        <div className="text-gray-300 text-sm font-semibold">{participant.userName}</div>
                        {/* 사용자 이름 오버레이 */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <div className="text-white text-sm font-semibold truncate">{participant.userName}</div>
                        </div>
              </div>
            )}

                    {/* 상태 배지 */}
                    <div className="absolute top-2 left-2">
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(
                    participant.status
                        )} text-white shadow-lg`}
                >
                  {getStatusText(participant.status, participant.score)}
                </span>
            </div>

            {/* 영상/음성 아이콘 */}
            <div className="absolute top-2 right-2 flex gap-1">
              {participant.videoEnabled && (
                        <span className="text-xs bg-blue-500/90 text-white px-2 py-1 rounded-full shadow-lg">📹</span>
              )}
              {participant.audioEnabled && (
                        <span className="text-xs bg-green-500/90 text-white px-2 py-1 rounded-full shadow-lg">🎤</span>
              )}
            </div>

                    {/* 카운트 정보 */}
                    {participant.currentCount !== undefined && (
                      <div className="absolute bottom-10 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        {participant.currentCount}개
                      </div>
                    )}
          </motion.div>
        ))}
      </div>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
    </motion.div>
  )
}

export default CrewMeetingView
