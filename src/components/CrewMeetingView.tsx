/**
 * 크루 미팅 화면 컴포넌트
 * Zoom 스타일 영상 화면
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { databaseService, CrewMember, User } from '@/services/databaseService'
import { authService } from '@/services/authService'
import { rankService } from '@/services/rankService'
import { webrtcService } from '@/services/webrtcService'
import { signalingService } from '@/services/signalingService'
import RankBadge from '@/components/RankBadge'

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
  myStatus: 'active' | 'completed' | 'resting' | 'inactive'
  myScore?: number
  myCurrentCount?: number
  onHeightChange?: (height: number) => void // 높이 변경 콜백
  onEntryMessage?: (message: string) => void // 입장 메시지 콜백 (데이터베이스에 저장하지 않음)
  crewType?: 'crew' | 'jogging' // 크루 타입 (기본값: 'crew')
  sharedVideoStream?: MediaStream | null // 공유 비디오 스트림 (자세 측정용 카메라 스트림)
  videoShareEnabled?: boolean // 크루 영상 공유 설정 (기본값: true)
  audioShareEnabled?: boolean // 크루 음성 공유 설정 (기본값: true)
  onParticipantsChange?: () => void // 참여자 목록 변경 콜백 (조깅 크루의 실시간 경로 갱신용)
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
  crewType = 'crew',
  sharedVideoStream,
  videoShareEnabled = true,
  audioShareEnabled = true,
  onParticipantsChange,
}: CrewMeetingViewProps) => {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [myVideoStream, setMyVideoStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const [connectionStates, setConnectionStates] = useState<Map<string, string>>(new Map())
  const myVideoRef = useRef<HTMLVideoElement>(null)
  const participantVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())
  const [height, setHeight] = useState(120) // 현재 높이 (px)
  const [isExpanded, setIsExpanded] = useState(false) // 펼쳐진 상태 여부
  const [userRanks, setUserRanks] = useState<Record<string, number>>({}) // 사용자별 계급 캐시
  const isWebRTCInitialized = useRef(false)
  const currentUserUuidRef = useRef<string | null>(null) // 현재 사용자 UUID 캐시
  const previousCrewIdRef = useRef<string | null>(null) // 이전 crewId 추적
  const [webRTCReinitTrigger, setWebRTCReinitTrigger] = useState(0) // WebRTC 재초기화 트리거
  // 초기 화질 설정: 모든 환경에서 저화질 (참여자 미팅 영상은 기본적으로 저화질)
  const getInitialVideoQuality = (): 'auto' | 'low' | 'medium' | 'high' => {
    return 'low' // 모든 환경: 저화질
  }
  
  const [videoQuality, setVideoQuality] = useState<'auto' | 'low' | 'medium' | 'high'>(getInitialVideoQuality()) // 화질 선택 상태
  const [showQualityMenu, setShowQualityMenu] = useState(false) // 화질 선택 메뉴 표시 여부
  const qualityMenuRef = useRef<HTMLDivElement>(null) // 화질 메뉴 참조 (외부 클릭 감지용)
  
  // 5명 이상일 때 자동으로 저화질로 설정 (한 번만)
  useEffect(() => {
    const activeVideoCount = participants.filter(p => p.status !== 'inactive' && p.videoEnabled).length + (myVideoEnabled ? 1 : 0)
    if (activeVideoCount >= 5 && videoQuality === 'auto') {
      // 자동 모드이고 5명 이상이면 저화질로 자동 전환 (사용자가 수동으로 선택한 경우는 유지)
      console.log('📊 참여자 5명 이상 감지: 자동으로 저화질 모드 적용')
    }
  }, [participants.length, myVideoEnabled, videoQuality])
  
  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(event.target as Node)) {
        setShowQualityMenu(false)
      }
    }
    
    if (showQualityMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showQualityMenu])
  
  // 높이 제한: 최소 높이와 최대 높이
  const COLLAPSED_HEIGHT = 120 // 접힌 상태 높이 (핸들바 + 제목)
  const MAX_HEIGHT = window.innerHeight * 0.7 // 최대 높이 (화면의 70%)

  // WebRTC 초기화
  useEffect(() => {
    // 강제로 로그 출력 (에러가 있어도 실행되도록)
    try {
      console.log('🔧 WebRTC 초기화 useEffect 실행', { 
      crewId, 
      isInitialized: isWebRTCInitialized.current, 
      previousCrewId: previousCrewIdRef.current,
      webRTCReinitTrigger,
      componentMounted: true 
    })
    
    // crewId가 변경되면 재초기화
    if (previousCrewIdRef.current !== null && previousCrewIdRef.current !== crewId) {
      console.log('🔄 crewId 변경 감지, WebRTC 재초기화:', { previous: previousCrewIdRef.current, current: crewId })
      // 이전 크루의 채널 구독 해제
      if (previousCrewIdRef.current) {
        signalingService.unsubscribe(previousCrewIdRef.current).catch(err => {
          console.warn('이전 크루 채널 구독 해제 실패:', err)
        })
      }
      isWebRTCInitialized.current = false
      console.log('🔄 isWebRTCInitialized 리셋 완료')
    }
    previousCrewIdRef.current = crewId
    
    if (isWebRTCInitialized.current) {
      console.log('⚠️ WebRTC가 이미 초기화되었습니다. 재초기화를 원하면 컴포넌트를 언마운트 후 다시 마운트하세요.')
      console.log('   현재 crewId:', crewId)
      console.log('   이전 crewId:', previousCrewIdRef.current)
      // 채널 구독 상태 확인
      const isSubscribed = signalingService.isSubscribed(crewId)
      console.log('   채널 구독 상태:', isSubscribed ? '구독됨' : '구독 안 됨')
      if (!isSubscribed) {
        console.log('   ⚠️ 채널이 구독되지 않았습니다. 재구독을 시도합니다...')
        // 채널이 구독되지 않았으면 재구독 시도
        isWebRTCInitialized.current = false
        console.log('   🔄 isWebRTCInitialized를 false로 리셋, 재초기화 진행')
        // 아래 초기화 로직 계속 실행
      } else {
        console.log('   ✅ 채널이 구독되어 있습니다. 재초기화 불필요')
        return
      }
    }
    isWebRTCInitialized.current = true
    console.log('✅ isWebRTCInitialized를 true로 설정, 초기화 시작')

    const initializeWebRTC = async () => {
      try {
        console.log('🚀 WebRTC 초기화 시작...', crewId)
        const user = authService.getCurrentUser()
        if (!user) {
          console.warn('⚠️ WebRTC 초기화: 사용자가 로그인하지 않았습니다')
          return
        }
        console.log('✅ 사용자 확인 완료:', user.id)

        // 현재 사용자 ID 업데이트 (UUID도 함께 전달)
        const userUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (userUuidRegex.test(user.id)) {
          // 이미 UUID인 경우
          signalingService.updateCurrentUserId(user.id)
        } else {
          // localStorage ID인 경우, UUID를 찾아서 전달
          // currentUserUuidRef가 이미 설정되어 있을 수 있음
          signalingService.updateCurrentUserId(user.id, currentUserUuidRef.current || undefined)
        }

        // Signaling 채널 구독 (재시도 로직 포함)
        let subscribeAttempts = 0
        const maxSubscribeAttempts = 3
        let subscribeSuccess = false
        
        while (subscribeAttempts < maxSubscribeAttempts && !subscribeSuccess) {
          try {
            subscribeAttempts++
            console.log(`📡 Signaling 채널 구독 시도 중... (${subscribeAttempts}/${maxSubscribeAttempts})`, crewId)
            await signalingService.subscribe(crewId)
            
            // 구독 성공 확인
            // subscribe() Promise가 resolve되면 채널이 이미 등록되어 있어야 함
            // 하지만 채널 상태가 'joined'가 되기까지 약간의 시간이 필요할 수 있음
            // subscribe()가 성공적으로 완료되었으므로, 채널이 등록되었는지 확인
            await new Promise(resolve => setTimeout(resolve, 1000)) // 1초 대기 (채널 등록 및 상태 업데이트 대기)
            
            const isSubscribed = signalingService.isSubscribed(crewId)
            console.log(`🔍 채널 구독 확인: ${crewId}`, { 
              isSubscribed,
              subscribeAttempt: subscribeAttempts,
              maxAttempts: maxSubscribeAttempts 
            })
            
            if (isSubscribed) {
              console.log('✅ Signaling 채널 구독 성공:', crewId)
              subscribeSuccess = true
            } else {
              console.warn(`⚠️ 채널 구독 후 확인 실패 (${subscribeAttempts}/${maxSubscribeAttempts}), 재시도 중...`)
              console.warn('   subscribe()는 성공했지만 채널이 등록되지 않았습니다.')
              console.warn('   Supabase Realtime 연결 상태를 확인해주세요.')
              if (subscribeAttempts < maxSubscribeAttempts) {
                await new Promise(resolve => setTimeout(resolve, 2000)) // 2초 대기 후 재시도
              }
            }
          } catch (subscribeError) {
            console.error(`⚠️ Signaling 채널 구독 실패 (${subscribeAttempts}/${maxSubscribeAttempts}):`, subscribeError)
            console.error('   구독 실패 원인:', subscribeError instanceof Error ? subscribeError.message : String(subscribeError))
            
            if (subscribeAttempts < maxSubscribeAttempts) {
              console.log(`   재시도 중... (${subscribeAttempts + 1}/${maxSubscribeAttempts})`)
              await new Promise(resolve => setTimeout(resolve, 1000)) // 1초 대기 후 재시도
            } else {
              console.error('   💡 Supabase Realtime이 활성화되어 있는지 확인해주세요.')
              console.error('   💡 네트워크 연결 상태를 확인해주세요.')
              // 구독 실패해도 앱은 계속 작동 (WebRTC 없이도 기본 기능 사용 가능)
              // 사용자에게 알림은 하지 않음 (조용히 실패)
              return
            }
          }
        }
        
        if (!subscribeSuccess) {
          console.error('❌ 채널 구독 최종 실패: 모든 재시도 실패')
          return
        }

        // Remote stream 수신 처리
        const unsubscribeRemoteStream = webrtcService.onRemoteStream(
          (userId, stream) => {
            if (stream) {
              setRemoteStreams((prev) => {
                const newMap = new Map(prev)
                newMap.set(userId, stream)
                return newMap
              })
            } else {
              setRemoteStreams((prev) => {
                const newMap = new Map(prev)
                newMap.delete(userId)
                return newMap
              })
            }
          }
        )

        // 연결 상태 변경 처리
        const unsubscribeConnectionState = webrtcService.onConnectionStateChange(
          (userId, state) => {
            setConnectionStates((prev) => {
              const newMap = new Map(prev)
              newMap.set(userId, state.iceConnectionState)
              return newMap
            })
          }
        )

        return () => {
          unsubscribeRemoteStream()
          unsubscribeConnectionState()
          signalingService.unsubscribe(crewId)
          webrtcService.closeAllConnections()
        }
      } catch (error) {
        console.error('❌ WebRTC 초기화 실패:', error)
        // 초기화 실패 시 리셋하여 재시도 가능하도록 함
        isWebRTCInitialized.current = false
        console.log('🔄 초기화 실패로 인해 isWebRTCInitialized를 false로 리셋')
      }
    }

    const cleanup = initializeWebRTC()

    return () => {
      console.log('🧹 WebRTC cleanup 실행', { crewId })
      cleanup.then((cleanupFn) => {
        if (cleanupFn) {
          cleanupFn()
        }
      }).catch(err => {
        console.warn('Cleanup 함수 실행 실패:', err)
      })
      isWebRTCInitialized.current = false
      console.log('🔄 cleanup 완료, isWebRTCInitialized를 false로 리셋')
      }
    } catch (error) {
      console.error('❌ WebRTC 초기화 useEffect 실행 중 에러:', error)
    }
  }, [crewId, webRTCReinitTrigger]) // crewId나 webRTCReinitTrigger가 변경되면 재실행

  // 디버깅: useEffect 실행 확인
  useEffect(() => {
    console.log('🔍 CrewMeetingView 컴포넌트 마운트/업데이트 확인', {
      crewId,
      myVideoEnabled,
      componentMounted: true,
      timestamp: new Date().toISOString(),
    })
  })


  // myVideoEnabled가 true로 변경될 때 WebRTC 연결 즉시 시작
  useEffect(() => {
    if (!crewId || !myVideoEnabled) return
    
    console.log('🎥 myVideoEnabled가 true로 변경됨, WebRTC 연결 즉시 시작 시도', { 
      crewId, 
      myVideoEnabled,
      isSubscribed: signalingService.isSubscribed(crewId),
      isWebRTCInitialized: isWebRTCInitialized.current,
    })
    
    // 채널이 구독되지 않았으면 WebRTC 재초기화 트리거
    if (!signalingService.isSubscribed(crewId)) {
      console.warn('⚠️ 채널이 구독되지 않았습니다. WebRTC 재초기화를 트리거합니다...')
      // isWebRTCInitialized를 false로 리셋하고 재초기화 트리거 증가
      isWebRTCInitialized.current = false
      setWebRTCReinitTrigger(prev => prev + 1) // WebRTC 초기화 useEffect 재실행 트리거
      console.log('🔄 isWebRTCInitialized를 false로 리셋, WebRTC 초기화 재시도 트리거')
      // WebRTC 초기화 useEffect가 자동으로 재실행되어 채널 구독을 시도함
      // 약간의 지연 후 loadParticipants 호출 (채널 구독 완료 대기)
      const timer = setTimeout(() => {
        console.log('🔄 myVideoEnabled 변경 후 loadParticipants 재호출 (채널 구독 대기)')
        loadParticipants()
      }, 2000) // 2초 후 재시도 (채널 구독 완료 대기)
      return () => clearTimeout(timer)
    }
    
    // 채널이 이미 구독되어 있으면 즉시 loadParticipants 호출
    console.log('✅ 채널이 이미 구독되어 있습니다. 즉시 loadParticipants 호출')
    const timer = setTimeout(() => {
      console.log('🔄 myVideoEnabled 변경 후 loadParticipants 재호출')
      loadParticipants()
    }, 500) // 0.5초 후 재시도
    
    return () => clearTimeout(timer)
  }, [myVideoEnabled, crewId]) // myVideoEnabled가 true로 변경될 때만 실행

  // 사용자 계급 로드
  const loadUserRanks = async () => {
    const rankMap: Record<string, number> = {}
    for (const participant of participants) {
      if (!userRanks[participant.userId]) { // 캐시에 없을 때만 로드
        try {
          const rank = await rankService.getUserRank(participant.userId)
          rankMap[participant.userId] = rank
        } catch (error) {
          console.error(`사용자 ${participant.userId}의 계급 로드 실패:`, error)
          rankMap[participant.userId] = 1
        }
      } else {
        rankMap[participant.userId] = userRanks[participant.userId]
      }
    }
    setUserRanks(prev => ({ ...prev, ...rankMap }))
  }

  // 참여자가 변경될 때마다 계급 업데이트
  useEffect(() => {
    if (participants.length > 0) {
      loadUserRanks()
    }
  }, [participants.length])
  
  // 디버깅: 활성 사용자 감지 로그 (useRef로 이전 값 추적하여 무한 루프 방지)
  const previousParticipantsRef = useRef<string>('')
  useEffect(() => {
    const participantsKey = JSON.stringify(participants.map(p => ({
      userId: p.userId,
      status: p.status,
      videoEnabled: p.videoEnabled,
    })))
    
    // 이전 값과 같으면 로그 출력하지 않음 (무한 루프 방지)
    if (previousParticipantsRef.current === participantsKey) {
      return
    }
    previousParticipantsRef.current = participantsKey
    
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
  }, [participants]) // participants는 dependency로 유지하되, 내부에서 중복 체크

  // 화질 설정 정의
  const qualityPresets = {
    high: {
      width: { ideal: 1280, min: 640, max: 1920 },
      height: { ideal: 720, min: 360, max: 1080 },
      frameRate: { ideal: 30, max: 30, min: 20 },
      bitrate: 2000000, // 2Mbps
      label: '고화질 (HD)',
      description: '1280x720 @ 30fps',
    },
    medium: {
      width: { ideal: 640, min: 480, max: 1280 },
      height: { ideal: 360, min: 270, max: 720 },
      frameRate: { ideal: 20, max: 25, min: 15 },
      bitrate: 1000000, // 1Mbps
      label: '중간 화질 (SD)',
      description: '640x360 @ 20fps',
    },
    low: {
      width: { ideal: 480, min: 320, max: 640 },
      height: { ideal: 270, min: 180, max: 360 },
      frameRate: { ideal: 15, max: 20, min: 10 },
      bitrate: 500000, // 500Kbps
      label: '저화질',
      description: '480x270 @ 15fps',
    },
  }

  // 참여자 수에 따른 비디오 품질 계산
  const getVideoQuality = (participantCount: number, userSelectedQuality?: 'auto' | 'low' | 'medium' | 'high') => {
    const activeVideoCount = participantCount
    const selectedQuality = userSelectedQuality || videoQuality
    
    // 사용자가 수동으로 선택한 경우
    if (selectedQuality !== 'auto' && selectedQuality in qualityPresets) {
      return qualityPresets[selectedQuality as keyof typeof qualityPresets]
    }
    
    // 자동 모드: 기본값은 중간 화질, 5명 이상일 때만 저화질
    if (activeVideoCount >= 5) {
      // 5명 이상: 저화질 (자동)
      return qualityPresets.low
    } else {
      // 1-4명: 중간 화질 (기본값)
      return qualityPresets.medium
    }
  }

  // 입장 시 초기 스트림 획득 보장 (마운트 시 한 번만 실행)
  const hasInitializedRef = useRef(false)
  useEffect(() => {
    if (!hasInitializedRef.current && myVideoEnabled && !myVideoStream) {
      console.log('🚀 입장 시 초기 스트림 획득 시도', {
        myVideoEnabled,
        hasMyVideoStream: !!myVideoStream,
      })
      hasInitializedRef.current = true
      // 스트림 획득을 위해 의도적으로 상태 변경 (useEffect 재실행 유도)
      // 아래 useEffect가 실행되도록 함
    }
  }, []) // 마운트 시 한 번만 실행

  // 공유 스트림이 있으면 사용 (카메라 스트림 공유 최적화)
  useEffect(() => {
    if (!sharedVideoStream || !myVideoEnabled) {
      return // 공유 스트림이 없거나 비디오가 비활성화된 경우
    }
    
    console.log('🔄 공유 스트림 사용 (카메라 스트림 공유 최적화)', {
      streamId: sharedVideoStream.id,
      active: sharedVideoStream.active,
      videoTracks: sharedVideoStream.getVideoTracks().length,
      hasMyVideoStream: !!myVideoStream,
    })
    
    // 공유 스트림의 비디오 트랙 가져오기
    const sharedVideoTrack = sharedVideoStream.getVideoTracks()[0]
    if (!sharedVideoTrack) {
      console.warn('⚠️ 공유 스트림에 비디오 트랙이 없습니다')
      return
    }
    
    // 현재 스트림 확인
    const currentVideoTrack = myVideoStream?.getVideoTracks()[0]
    const isUsingSharedTrack = currentVideoTrack === sharedVideoTrack
    
    if (!isUsingSharedTrack) {
      // 공유 스트림을 사용하지 않는 경우, 새 스트림 생성
      const newStream = new MediaStream([sharedVideoTrack])
      
      // 기존 스트림 정리 (공유 스트림이 아닌 경우만)
      if (myVideoStream && currentVideoTrack && currentVideoTrack !== sharedVideoTrack) {
        // 기존 비디오 트랙만 정리 (오디오는 유지)
        const existingAudioTracks = myVideoStream.getAudioTracks()
        existingAudioTracks.forEach(track => {
          newStream.addTrack(track) // 기존 오디오 트랙 유지
        })
        currentVideoTrack.stop() // 기존 비디오 트랙만 정리
      }
      
      // 오디오 처리
      const hasAudio = newStream.getAudioTracks().length > 0
      if (myAudioEnabled && !hasAudio) {
        // 오디오 추가 필요
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(audioStream => {
            audioStream.getAudioTracks().forEach(track => {
              newStream.addTrack(track)
            })
            setMyVideoStream(newStream)
            webrtcService.setLocalStream(newStream)
            console.log('✅ 공유 스트림 + 오디오 설정 완료')
          })
          .catch(error => {
            console.warn('⚠️ 오디오 획득 실패, 비디오만 사용:', error)
            setMyVideoStream(newStream)
            webrtcService.setLocalStream(newStream)
          })
      } else if (!myAudioEnabled && hasAudio) {
        // 오디오 제거 필요
        newStream.getAudioTracks().forEach(track => {
          track.stop()
          newStream.removeTrack(track)
        })
        setMyVideoStream(newStream)
        webrtcService.setLocalStream(newStream)
        console.log('✅ 공유 스트림 설정 완료 (오디오 제거)')
      } else {
        // 오디오 상태가 맞음
        setMyVideoStream(newStream)
        webrtcService.setLocalStream(newStream)
        console.log('✅ 공유 스트림 설정 완료')
      }
    } else {
      // 이미 공유 스트림을 사용 중이면 오디오만 확인
      if (!myVideoStream) {
        console.warn('⚠️ myVideoStream이 null입니다. 스트림을 먼저 획득해야 합니다.')
        return
      }
      
      const hasAudio = myVideoStream.getAudioTracks().length > 0
      if (hasAudio !== myAudioEnabled) {
        if (myAudioEnabled) {
          // 오디오 추가
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(audioStream => {
              if (myVideoStream) {
                audioStream.getAudioTracks().forEach(track => {
                  myVideoStream.addTrack(track)
                })
                webrtcService.setLocalStream(myVideoStream)
                console.log('✅ 오디오 추가 완료')
              }
            })
            .catch(error => {
              console.warn('⚠️ 오디오 추가 실패:', error)
            })
        } else {
          // 오디오 제거
          if (myVideoStream) {
            myVideoStream.getAudioTracks().forEach(track => {
              track.stop()
              myVideoStream.removeTrack(track)
            })
            webrtcService.setLocalStream(myVideoStream)
            console.log('✅ 오디오 제거 완료')
          }
        }
      }
    }
  }, [sharedVideoStream, myVideoEnabled, myAudioEnabled, myVideoStream])

  // 화질 변경 강제 재획득 플래그
  const forceReacquireRef = useRef(false)
  
  useEffect(() => {
    // 내 영상 스트림 설정 (공유 스트림이 없는 경우에만)
    if (sharedVideoStream && myVideoEnabled) {
      return // 공유 스트림이 있으면 위 useEffect에서 처리
    }
    
    const activeVideoCount = participants.filter(p => p.status !== 'inactive' && p.videoEnabled).length + (myVideoEnabled ? 1 : 0)
    const quality = getVideoQuality(activeVideoCount, videoQuality)
    
    console.log('🎥 카메라 스트림 useEffect 실행', { 
      myVideoEnabled, 
      myAudioEnabled, 
      hasMyVideoStream: !!myVideoStream,
      activeVideoCount,
      videoQuality,
      forceReacquire: forceReacquireRef.current,
      quality: {
        resolution: `${quality.width.ideal}x${quality.height.ideal}`,
        frameRate: quality.frameRate.ideal,
        bitrate: `${quality.bitrate / 1000}Kbps`,
      },
    })
    
    if (myVideoEnabled) {
      console.log('🎥 카메라 스트림 획득 시작...', { myVideoEnabled, myAudioEnabled, activeVideoCount, quality, videoQuality })
      
      // 화질 변경으로 인한 강제 재획득인 경우
      if (forceReacquireRef.current) {
        console.log('🔄 화질 변경으로 인한 강제 재획득')
        if (myVideoStream) {
          const currentVideoTrack = myVideoStream.getVideoTracks()[0]
          const sharedVideoTrack = sharedVideoStream?.getVideoTracks()[0]
          // 공유 스트림의 트랙이 아닌 경우만 stop
          if (!sharedVideoStream || currentVideoTrack !== sharedVideoTrack) {
            console.log('🛑 기존 스트림 정리 (화질 변경)')
            myVideoStream.getTracks().forEach(track => {
              if (track !== sharedVideoTrack) {
                track.stop()
              }
            })
          }
          setMyVideoStream(null)
        }
        forceReacquireRef.current = false // 플래그 리셋
        // 아래에서 스트림 재획득 계속 진행 (해상도 차이 체크 무시)
      }
      // 이미 스트림이 있으면 재획득하지 않음 (무한 루프 방지)
      // 단, 화질 변경으로 인한 강제 재획득이 아닌 경우에만 체크
      // 모바일에서 카메라 권한 재요청을 방지하기 위해 더 보수적으로 처리
      else if (myVideoStream && myVideoStream.active && !forceReacquireRef.current) {
        const currentSettings = myVideoStream.getVideoTracks()[0]?.getSettings()
        const currentWidth = currentSettings?.width || 0
        const currentHeight = currentSettings?.height || 0
        const targetWidth = typeof quality.width.ideal === 'number' ? quality.width.ideal : 1280
        const targetHeight = typeof quality.height.ideal === 'number' ? quality.height.ideal : 720
        
        // 해상도가 크게 다르면 재획득 (50% 이상 차이 - 더 보수적으로 변경)
        // 모바일에서 카메라 권한 재요청을 최소화하기 위해 임계값을 높임
        const widthDiff = Math.abs(currentWidth - targetWidth) / Math.max(targetWidth, 1)
        const heightDiff = Math.abs(currentHeight - targetHeight) / Math.max(targetHeight, 1)
        
        if (widthDiff < 0.5 && heightDiff < 0.5) {
          console.log('✅ 이미 활성 스트림이 있습니다. 재획득하지 않습니다.', {
            streamId: myVideoStream.id,
            active: myVideoStream.active,
            currentResolution: `${currentWidth}x${currentHeight}`,
            targetResolution: `${targetWidth}x${targetHeight}`,
            widthDiff: `${(widthDiff * 100).toFixed(1)}%`,
            heightDiff: `${(heightDiff * 100).toFixed(1)}%`,
          })
          // 기존 스트림이 활성 상태이고 해상도 차이가 크지 않으면 재획득하지 않음
          // 단, 오디오 상태가 변경된 경우는 스트림을 재획득해야 함 (모바일에서 권한 재요청 최소화를 위해 조건부 처리)
          const hasAudioTrack = myVideoStream.getAudioTracks().length > 0
          const needsAudio = myAudioEnabled
          if (hasAudioTrack !== needsAudio) {
            console.log('🔄 오디오 상태 변경 감지, 스트림 재획득 필요:', {
              hasAudioTrack,
              needsAudio,
            })
            // 오디오 상태 변경 시 스트림 재획득 (불가피하지만 최소화)
            myVideoStream.getTracks().forEach(track => track.stop())
            setMyVideoStream(null)
            // 아래에서 스트림 재획득 계속 진행
          } else {
            // 해상도와 오디오 상태 모두 변경되지 않았으면 재획득하지 않음
            return
          }
        } else {
          console.log('🔄 참여자 수 변경으로 인한 해상도 조정 필요:', {
            currentResolution: `${currentWidth}x${currentHeight}`,
            targetResolution: `${targetWidth}x${targetHeight}`,
            widthDiff: `${(widthDiff * 100).toFixed(1)}%`,
            heightDiff: `${(heightDiff * 100).toFixed(1)}%`,
          })
          // 기존 스트림 정리
          myVideoStream.getTracks().forEach(track => track.stop())
          setMyVideoStream(null)
        }
      }
      
      // 미디어 디바이스 사용 가능 여부 확인
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('❌ 미디어 디바이스 API를 사용할 수 없습니다')
        console.error('   HTTPS 연결이 필요합니다. 현재 프로토콜:', window.location.protocol)
        console.error('   User Agent:', navigator.userAgent)
        return
      }
      
      console.log('📱 모바일 디바이스 확인:', {
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        userAgent: navigator.userAgent,
      })
      
      navigator.mediaDevices
        .getUserMedia({ 
          video: {
            facingMode: 'user', // 전면 카메라 사용
            width: quality.width,
            height: quality.height,
            frameRate: quality.frameRate,
          }, 
          audio: myAudioEnabled 
        })
        .then(async (stream) => {
          console.log('✅ 내 영상 스트림 획득 성공:', {
            streamId: stream.id,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            active: stream.active,
            videoTrackSettings: stream.getVideoTracks()[0]?.getSettings(),
          })
          setMyVideoStream(stream)
          
          // 스트림 상태 모니터링: 스트림이 종료되면 자동으로 재획득
          stream.getVideoTracks().forEach((track) => {
            track.onended = () => {
              console.warn('⚠️ 비디오 트랙이 종료되었습니다. 재획득을 시도합니다...')
              // 스트림 재획득을 위해 상태를 null로 설정
              setMyVideoStream(null)
              hasInitializedRef.current = false // 재획득 허용
            }
            track.onmute = () => {
              console.warn('⚠️ 비디오 트랙이 음소거되었습니다.')
            }
            track.onunmute = () => {
              console.log('✅ 비디오 트랙 음소거 해제됨')
            }
          })
          
          // 비디오 요소에 스트림 설정은 myVideoStream useEffect에서 처리
          // 여기서는 스트림만 획득하고 상태에 저장
          console.log('✅ 스트림 상태에 저장 완료, 비디오 요소는 myVideoStream useEffect에서 설정됩니다')
          
          // WebRTC 서비스에 로컬 스트림 설정
          await webrtcService.setLocalStream(stream)
          console.log('✅ WebRTC 서비스에 로컬 스트림 설정 완료')
        })
        .catch((error) => {
          console.error('❌ 영상 스트림 가져오기 실패:', error)
          console.error('   에러 이름:', error.name)
          console.error('   에러 메시지:', error.message)
          if (error.name === 'NotAllowedError') {
            console.error('   💡 카메라 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.')
          } else if (error.name === 'NotFoundError') {
            console.error('   💡 카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.')
          } else if (error.name === 'NotReadableError') {
            console.error('   💡 카메라에 접근할 수 없습니다. 다른 앱에서 사용 중일 수 있습니다.')
          } else {
            // 기타 오류의 경우 재시도 (윈도우 PC에서 간혹 발생하는 문제 대응)
            console.warn('   ⚠️ 스트림 획득 실패, 2초 후 재시도...')
            const retryKey = `stream_retry_${crewId || 'default'}`
            const retryCount = (window as any)[retryKey] || 0
            if (retryCount < 5) {
              (window as any)[retryKey] = retryCount + 1
              setTimeout(() => {
                // 스트림 재획득을 위해 상태를 null로 설정하여 useEffect 재실행 유도
                if (!myVideoStream && myVideoEnabled) {
                  console.log(`   🔄 스트림 재획득 시도... (${retryCount + 1}/5)`)
                  hasInitializedRef.current = false // 재획득 허용
                  // useEffect가 다시 실행되도록 하기 위해 의도적으로 상태 변경
                  setMyVideoStream(null)
                }
              }, 2000) // 2초 후 재시도
            } else {
              console.error('   ❌ 스트림 획득 재시도 횟수 초과 (최대 5회)')
              // 재시도 카운터 리셋 (나중에 다시 시도할 수 있도록)
              delete (window as any)[retryKey]
            }
          }
        })
    } else {
      if (myVideoStream) {
        myVideoStream.getTracks().forEach((track) => track.stop())
        setMyVideoStream(null)
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = null
        }
        // WebRTC 서비스에서 로컬 스트림 제거
        webrtcService.removeLocalStream()
      }
    }

    return () => {
      // cleanup 함수는 컴포넌트 언마운트 시에만 실행
      // 스트림 재획득 시에는 위에서 이미 정리함
    }
  }, [myVideoEnabled, myAudioEnabled, videoQuality, sharedVideoStream]) // videoQuality 변경 시 재획득 (participants.length 제거: 참여자 변경 시 스트림 재획득 방지)

  // 각 참여자의 화질 정보 계산 함수
  const getParticipantQuality = (participant: Participant, isCurrentUser: boolean = false): 'high' | 'medium' | 'low' => {
    // 내 영상인 경우: 사용자가 선택한 화질 설정을 우선 표시
    if (isCurrentUser) {
      // 사용자가 선택한 화질 설정 확인
      if (videoQuality === 'high') {
        return 'high'
      } else if (videoQuality === 'medium') {
        return 'medium'
      } else if (videoQuality === 'low') {
        return 'low'
      } else {
        // auto 모드인 경우 참여자 수에 따라 결정
        const activeVideoCount = participants.filter(p => p.status !== 'inactive' && p.videoEnabled).length + (myVideoEnabled ? 1 : 0)
        if (activeVideoCount >= 5) {
          return 'low'
        } else {
          return 'medium'
        }
      }
    }
    
    // 다른 참여자의 경우: 실제 스트림 해상도 확인 (가능한 경우)
    const remoteStream = remoteStreams.get(participant.userId)
    if (remoteStream) {
      const videoTrack = remoteStream.getVideoTracks()[0]
      if (videoTrack) {
        const settings = videoTrack.getSettings()
        const width = settings.width || 0
        const height = settings.height || 0
        
        // 해상도에 따라 화질 판단
        if (width >= 1280 || height >= 720) {
          return 'high'
        } else if (width >= 640 || height >= 360) {
          return 'medium'
        } else {
          return 'low'
        }
      }
    }
    
    // 스트림이 없으면 기본값 (자동 화질)
    const activeVideoCount = participants.filter(p => p.status !== 'inactive' && p.videoEnabled).length + (myVideoEnabled ? 1 : 0)
    if (activeVideoCount >= 5) {
      return 'low'
    } else {
      return 'medium'
    }
  }

  // myVideoStream이 변경될 때 비디오 요소에 스트림 설정
  useEffect(() => {
    if (myVideoStream) {
      // 비디오 요소에 스트림 설정 함수
      const setVideoStreamToElement = () => {
        if (myVideoRef.current && myVideoStream) {
          // 이미 같은 스트림이 설정되어 있으면 스킵
          if (myVideoRef.current.srcObject === myVideoStream) {
            console.log('✅ 비디오 요소에 이미 같은 스트림이 설정되어 있습니다.')
            return true
          }
          
          myVideoRef.current.srcObject = myVideoStream
          console.log('✅ myVideoStream 변경: 비디오 요소에 스트림 설정 완료', {
            streamId: myVideoStream.id,
            videoTracks: myVideoStream.getVideoTracks().length,
            elementReady: !!myVideoRef.current,
            srcObjectSet: !!myVideoRef.current.srcObject,
          })
          
          // 비디오 요소가 로드되었는지 확인
          myVideoRef.current.onloadedmetadata = () => {
            console.log('✅ 비디오 메타데이터 로드 완료')
          }
          myVideoRef.current.onerror = (error) => {
            console.error('❌ 비디오 요소 오류:', error)
          }
          
          // 모바일에서 autoplay 문제 해결을 위해 명시적으로 play 시도
          // 모바일에서는 약간의 지연 후 재생 시도
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
          const playVideo = () => {
            if (myVideoRef.current) {
              myVideoRef.current.play().then(() => {
                console.log('✅ 비디오 재생 시작 성공')
              }).catch((playError) => {
                console.warn('⚠️ 비디오 재생 실패 (autoplay 정책):', playError)
                console.warn('   사용자가 수동으로 재생해야 할 수 있습니다.')
                // 모바일에서 재생 실패 시 한 번 더 시도
                if (isMobile) {
                  setTimeout(() => {
                    if (myVideoRef.current) {
                      myVideoRef.current.play().catch(() => {
                        console.warn('⚠️ 비디오 재생 재시도 실패')
                      })
                    }
                  }, 500)
                }
              })
            }
          }
          
          if (isMobile) {
            // 모바일에서는 메타데이터 로드 후 재생
            myVideoRef.current.onloadedmetadata = () => {
              console.log('✅ 비디오 메타데이터 로드 완료 (모바일)')
              setTimeout(playVideo, 100)
            }
          } else {
            playVideo()
          }
          return true
        }
        return false
      }
      
      // 즉시 시도
      if (setVideoStreamToElement()) {
        return // 성공하면 종료
      }
      
      // 비디오 요소가 준비될 때까지 대기 (모바일에서 더 오래 대기)
      let retryCount = 0
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      const maxRetries = isMobile ? 50 : 30 // 모바일에서는 최대 5초 대기 (100ms * 50)
      const setVideoStream = () => {
        if (setVideoStreamToElement()) {
          return // 성공
        }
        
        retryCount++
        if (retryCount < maxRetries) {
          // ref가 아직 준비되지 않았으면 잠시 후 재시도
          setTimeout(setVideoStream, 100)
        } else {
          console.warn('⚠️ 비디오 요소를 찾을 수 없습니다. 최대 재시도 횟수 초과:', maxRetries)
          console.warn('   비디오 요소가 조건부 렌더링으로 아직 DOM에 없을 수 있습니다.')
          console.warn('   참여자 목록이 업데이트되면 자동으로 설정됩니다.')
        }
      }
      setVideoStream()
    } else if (myVideoRef.current) {
      myVideoRef.current.srcObject = null
      console.log('비디오 스트림 제거됨')
    }
  }, [myVideoStream])

  // remoteStreams가 변경될 때 각 참여자 비디오 요소에 스트림 설정 및 참여자 상태 업데이트
  useEffect(() => {
    remoteStreams.forEach((stream, userId) => {
      const videoElement = participantVideoRefs.current.get(userId)
      
      // 원격 스트림의 비디오/오디오 트랙 확인 및 참여자 상태 업데이트
      const videoTracks = stream.getVideoTracks()
      const audioTracks = stream.getAudioTracks()
      const hasVideo = videoTracks.length > 0 && videoTracks[0].enabled && !videoTracks[0].muted
      const hasAudio = audioTracks.length > 0 && audioTracks[0].enabled && !audioTracks[0].muted
      
      console.log(`🔍 참여자 ${userId} 스트림 상태 확인:`, {
        hasVideo,
        hasAudio,
        videoTracksCount: videoTracks.length,
        audioTracksCount: audioTracks.length,
        videoTrackEnabled: videoTracks[0]?.enabled,
        videoTrackMuted: videoTracks[0]?.muted,
        audioTrackEnabled: audioTracks[0]?.enabled,
        audioTrackMuted: audioTracks[0]?.muted,
      })
      
      // 참여자 상태 업데이트 (원격 스트림의 실제 상태 반영)
      setParticipants(prev => prev.map(p => {
        if (p.userId === userId) {
          return {
            ...p,
            videoEnabled: hasVideo,
            audioEnabled: hasAudio,
          }
        }
        return p
      }))
      
      if (videoElement && videoElement.srcObject !== stream) {
        console.log(`🔄 Remote stream 업데이트: ${userId}`, {
          streamId: stream.id,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          streamActive: stream.active,
          hasVideo,
          hasAudio,
        })
        videoElement.srcObject = stream
        
        // iOS에서 비디오 재생을 위한 추가 속성 설정
        videoElement.setAttribute('playsinline', 'true')
        videoElement.setAttribute('webkit-playsinline', 'true')
        videoElement.setAttribute('x5-playsinline', 'true')
        videoElement.setAttribute('x5-video-player-type', 'h5')
        videoElement.setAttribute('x5-video-player-fullscreen', 'true')
        
        // 비디오 재생 시도
        const playVideo = async () => {
          try {
            await videoElement.play()
            console.log(`✅ Remote video 재생 성공: ${userId}`)
          } catch (playError) {
            console.warn(`⚠️ Remote video 재생 실패: ${userId}`, playError)
            // iOS에서 재생 실패 시 한 번 더 시도
            const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
            if (isIOS) {
              setTimeout(async () => {
                try {
                  await videoElement.play()
                  console.log(`✅ Remote video 재생 재시도 성공: ${userId}`)
                } catch (retryError) {
                  console.warn(`⚠️ Remote video 재생 재시도 실패: ${userId}`, retryError)
                }
              }, 500)
            }
          }
        }
        
        // 메타데이터 로드 후 재생
        videoElement.onloadedmetadata = () => {
          console.log(`✅ Remote video 메타데이터 로드: ${userId}`)
          playVideo()
        }
        
        // 이미 메타데이터가 로드되어 있으면 즉시 재생
        if (videoElement.readyState >= 1) {
          playVideo()
        }
      }
      
      // 스트림 트랙 상태 변경 감지
      videoTracks.forEach(track => {
        track.onended = () => {
          console.log(`⚠️ 참여자 ${userId} 비디오 트랙 종료`)
          setParticipants(prev => prev.map(p => 
            p.userId === userId ? { ...p, videoEnabled: false } : p
          ))
        }
        track.onmute = () => {
          console.log(`⚠️ 참여자 ${userId} 비디오 트랙 음소거`)
          setParticipants(prev => prev.map(p => 
            p.userId === userId ? { ...p, videoEnabled: false } : p
          ))
        }
        track.onunmute = () => {
          console.log(`✅ 참여자 ${userId} 비디오 트랙 음소거 해제`)
          setParticipants(prev => prev.map(p => 
            p.userId === userId ? { ...p, videoEnabled: true } : p
          ))
        }
      })
      
      audioTracks.forEach(track => {
        track.onended = () => {
          console.log(`⚠️ 참여자 ${userId} 오디오 트랙 종료`)
          setParticipants(prev => prev.map(p => 
            p.userId === userId ? { ...p, audioEnabled: false } : p
          ))
        }
        track.onmute = () => {
          console.log(`⚠️ 참여자 ${userId} 오디오 트랙 음소거`)
          setParticipants(prev => prev.map(p => 
            p.userId === userId ? { ...p, audioEnabled: false } : p
          ))
        }
        track.onunmute = () => {
          console.log(`✅ 참여자 ${userId} 오디오 트랙 음소거 해제`)
          setParticipants(prev => prev.map(p => 
            p.userId === userId ? { ...p, audioEnabled: true } : p
          ))
        }
      })
    })
  }, [remoteStreams])

  // 참여자 목록이 업데이트될 때 비디오 요소에 스트림 설정 (조건부 렌더링 대응)
  useEffect(() => {
    if (myVideoStream && myVideoRef.current) {
      // 이미 같은 스트림이 설정되어 있으면 스킵
      if (myVideoRef.current.srcObject === myVideoStream) {
        return
      }
      
      console.log('🔄 참여자 목록 업데이트: 비디오 요소에 스트림 설정 시도', {
        streamId: myVideoStream.id,
        elementReady: !!myVideoRef.current,
      })
      
      myVideoRef.current.srcObject = myVideoStream
      console.log('✅ 참여자 목록 업데이트: 비디오 요소에 스트림 설정 완료')
      
      // 모바일에서 autoplay 문제 해결을 위해 명시적으로 play 시도
      myVideoRef.current.play().then(() => {
        console.log('✅ 비디오 재생 시작 성공 (참여자 목록 업데이트 후)')
      }).catch((playError) => {
        console.warn('⚠️ 비디오 재생 실패 (참여자 목록 업데이트 후):', playError)
      })
    }
  }, [participants, myVideoStream]) // participants가 변경될 때마다 시도

  // useRef를 사용하여 동기적으로 관리 (비동기 상태 업데이트 문제 해결)
  const previousActiveUserIdsRef = useRef<Set<string>>(new Set())
  // 입장 메시지 전송 추적 (중복 방지)
  const sentEntryMessagesRef = useRef<Set<string>>(new Set())
  // 퇴장 메시지 전송 추적 (중복 방지)
  const sentExitMessagesRef = useRef<Set<string>>(new Set())

  const loadParticipants = useCallback(async () => {
    try {
      const user = authService.getCurrentUser()
      if (!user) {
        console.log('⚠️ loadParticipants: 사용자가 로그인하지 않았습니다')
        return
      }
      console.log('📋 loadParticipants 실행 중...', { userId: user.id, crewId, myVideoEnabled })

      let members: CrewMember[] = []
      
      // 조깅 크루인 경우: crew_members 테이블과 memberIds 모두 확인
      if (crewType === 'jogging') {
        try {
          // 먼저 crew_members 테이블에서 멤버 로드 (영상/음성 상태 포함)
          const crewMembers = await databaseService.getCrewMembers(crewId)
          console.log('📋 조깅 크루: crew_members에서 로드한 멤버:', crewMembers.length, crewMembers.map(m => ({ userId: m.userId, videoEnabled: m.videoEnabled, audioEnabled: m.audioEnabled })))
          
          // memberIds도 확인하여 누락된 멤버 추가
          const joggingCrew = await databaseService.getJoggingCrewById(crewId)
          if (joggingCrew && joggingCrew.memberIds) {
            const existingMemberIds = new Set(crewMembers.map(m => m.userId))
            
            // memberIds에 있지만 crew_members에 없는 멤버 추가
            for (const memberId of joggingCrew.memberIds) {
              if (!existingMemberIds.has(memberId)) {
                crewMembers.push({
                  id: `jogging_member_${memberId}_${Date.now()}`,
                  crewId: crewId,
                  userId: memberId,
                  role: 'member' as const,
                  videoEnabled: false,
                  audioEnabled: false,
                  joinedAt: joggingCrew.createdAt,
                })
                console.log('📝 조깅 크루: 누락된 멤버 추가:', memberId)
              }
            }
            
            members = crewMembers
            console.log('📋 조깅 크루: 최종 멤버 목록:', members.length, members.map(m => ({ userId: m.userId, videoEnabled: m.videoEnabled, audioEnabled: m.audioEnabled })))
          } else {
            members = crewMembers
          }
        } catch (error) {
          console.error('조깅 크루 멤버 로드 실패:', error)
          // 에러 발생 시 빈 배열로 초기화
          members = []
        }
      } else {
        members = await databaseService.getCrewMembers(crewId)
        console.log('📋 getCrewMembers 결과:', {
          crewId,
          memberCount: members.length,
          members: members.map(m => ({
            id: m.id,
            userId: m.userId,
            videoEnabled: m.videoEnabled,
            audioEnabled: m.audioEnabled,
          })),
        })
      }
      
      // 활성 사용자 ID 수집 (localStorage + Supabase)
      const activeUserIds = new Set<string>()
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      
      // 현재 사용자는 항상 활성으로 간주 (localStorage ID와 UUID 모두 추가)
      activeUserIds.add(user.id)
      
      // 현재 사용자의 UUID도 추가 (조깅 크루의 경우 memberIds가 UUID이므로)
      if (!uuidRegex.test(user.id)) {
        // localStorage ID인 경우, UUID로 변환하여 추가
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
                  activeUserIds.add(supabaseUser.id)
                  currentUserUuidRef.current = supabaseUser.id
                  console.log('✅ 현재 사용자 UUID 추가:', user.id, '->', supabaseUser.id)
                }
              }
            }
          }
        } catch (e) {
          console.error('현재 사용자 UUID 변환 실패:', e)
        }
      } else {
        // 이미 UUID인 경우
        currentUserUuidRef.current = user.id
        console.log('✅ 현재 사용자는 이미 UUID:', user.id)
      }
      
      // localStorage에서 현재 활성 세션 확인 (같은 브라우저/탭)
      try {
        const activeSessions = localStorage.getItem('active_training_sessions')
        if (activeSessions) {
          const sessions = JSON.parse(activeSessions)
          sessions.forEach((session: { userId: string; crewId: string }) => {
            if (session.crewId === crewId) {
              activeUserIds.add(session.userId)
              console.log('✅ localStorage 세션에서 활성 사용자 추가:', session.userId)
            }
          })
        }
      } catch (e) {
        console.error('localStorage 세션 읽기 실패:', e)
      }

      // Supabase에서 실제 활성 사용자 확인
      // 조깅 크루는 jogging_crew_members 테이블이 없으므로 crew_members 테이블만 사용
      if (crewType !== 'jogging') {
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
              console.log('📊 각 멤버의 video_enabled 상태:', 
                allMembers.map(m => ({ user_id: m.user_id, video_enabled: m.video_enabled, audio_enabled: m.audio_enabled }))
              )
              
              // video_enabled가 true인 사용자는 모두 활성으로 간주
              for (const member of allMembers) {
                // 현재 사용자는 myVideoEnabled 상태를 확인하여 강제로 활성화
                const isCurrentUser = member.user_id === user.id || 
                  (currentUserUuidRef.current && member.user_id === currentUserUuidRef.current)
                
                if (isCurrentUser && myVideoEnabled) {
                  // 현재 사용자가 myVideoEnabled=true이면 강제로 활성화
                  activeUserIds.add(member.user_id)
                  console.log('✅ 현재 사용자 강제 활성화 (myVideoEnabled=true):', member.user_id, {
                    supabaseVideoEnabled: member.video_enabled,
                    myVideoEnabled,
                  })
                } else if (member.video_enabled === true) {
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
      } else {
        // 조깅 크루의 경우: realtime_jogging_routes 테이블에서 활성 참여자 확인
        console.log('🏃 조깅 크루: realtime_jogging_routes 테이블에서 활성 참여자 확인')
        
        try {
          const { databaseService } = await import('@/services/databaseService')
          // realtime_jogging_routes 테이블에서 활성(is_active=true) 참여자 조회
          const activeRoutes = await databaseService.getRealtimeJoggingRoutesByCrew(crewId)
          console.log('🏃 조깅 크루: realtime_jogging_routes에서 조회한 활성 참여자:', activeRoutes.length, activeRoutes.map(r => ({ userId: r.userId, userName: r.userName, isActive: r.isActive })))
          
          // 활성 참여자의 userId를 activeUserIds에 추가
          for (const route of activeRoutes) {
            if (route.isActive) {
              activeUserIds.add(route.userId)
              console.log('✅ 조깅 크루: 활성 참여자 추가 (realtime_jogging_routes):', route.userId, route.userName)
            }
          }
          
          // localStorage의 active_training_sessions에서도 확인 (백업)
          const activeLocalStorageIds = Array.from(activeUserIds).filter(id => !uuidRegex.test(id))
          if (activeLocalStorageIds.length > 0) {
            console.log('🔍 조깅 크루: localStorage ID를 UUID로 변환할 목록:', activeLocalStorageIds)
            const { supabase } = await import('@/services/supabaseClient')
            if (supabase) {
              for (const localStorageId of activeLocalStorageIds) {
                try {
                  const userStr = localStorage.getItem(`user_${localStorageId}`)
                  if (userStr) {
                    const userData = JSON.parse(userStr)
                    if (userData.email) {
                      const { data: supabaseUser } = await supabase
                        .from('users')
                        .select('id')
                        .eq('email', userData.email)
                        .single()
                      
                      if (supabaseUser) {
                        activeUserIds.add(supabaseUser.id)
                        console.log('✅ 조깅 크루: localStorage ID -> UUID 매핑:', localStorageId, '->', supabaseUser.id)
                      }
                    }
                  }
                } catch (e) {
                  console.error('조깅 크루 사용자 매핑 실패:', localStorageId, e)
                }
              }
            }
          }
        } catch (e) {
          console.error('❌ 조깅 크루: realtime_jogging_routes 조회 실패:', e)
          // 실패 시 localStorage 세션만 사용
          console.log('⚠️ 조깅 크루: localStorage 세션만 사용하여 활성 사용자 확인 (fallback)')
        }
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
      const activeUuids = Array.from(activeUserIds).filter(id => uuidRegex.test(id)).sort()
      const previousActiveUuids = Array.from(previousActiveUserIdsRef.current).filter(id => uuidRegex.test(id)).sort()
      
      // 새로 입장한 UUID만 필터링 (이전에 없었던 UUID)
      const newActiveUuids = activeUuids.filter(uuid => !previousActiveUuids.includes(uuid))
      
      // 나간 사용자 확인 (이전에 있었지만 현재 없는 UUID)
      const leftUserUuids = previousActiveUuids.filter(uuid => !activeUuids.includes(uuid))
      
      // 현재 사용자의 UUID 확인 (비교용)
      let currentUserUuid = user.id
      const userUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (userUuidRegex.test(user.id)) {
        // 이미 UUID인 경우
        currentUserUuidRef.current = user.id
      } else {
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
                  // UUID 캐시에 저장
                  currentUserUuidRef.current = supabaseUser.id
                  console.log('✅ 현재 사용자 UUID 캐시 저장:', user.id, '->', supabaseUser.id)
                  // signalingService에도 UUID 업데이트
                  signalingService.updateCurrentUserId(user.id, supabaseUser.id)
                }
              }
            }
          }
        } catch (e) {
          // 무시
        }
      }
      
      // 나간 사용자 먼저 처리 (sentEntryMessagesRef에서 제거 및 퇴장 메시지 전송)
      for (const leftUserId of leftUserUuids) {
        sentEntryMessagesRef.current.delete(leftUserId)
        console.log('나간 사용자 제거:', leftUserId)
        
        // 퇴장 메시지 처리 (한 번만 전송)
        if (!sentExitMessagesRef.current.has(leftUserId) && leftUserId !== currentUserUuid) {
          try {
            const leftUser = await databaseService.getUserById(leftUserId)
            if (leftUser) {
              // 전송 전에 sentExitMessagesRef에 먼저 추가 (동시 실행 방지)
              sentExitMessagesRef.current.add(leftUserId)
              
              // 데이터베이스에 저장하지 않고 콜백으로 전달
              const exitMessage = `${leftUser.name}님이 퇴장하셨습니다`
              if (onEntryMessage) {
                onEntryMessage(exitMessage)
              }
              console.log('✅ 퇴장 메시지 표시 완료 (DB 저장 안함):', leftUser.name, 'userId:', leftUserId)
            }
          } catch (error) {
            console.error('퇴장 메시지 처리 실패:', error)
            // 실패한 경우 sentExitMessagesRef에서 제거 (재시도 가능)
            sentExitMessagesRef.current.delete(leftUserId)
          }
        }
      }
      
      // 다시 입장한 사용자는 퇴장 메시지 추적에서 제거 (재입장 가능하도록)
      for (const newUserId of newActiveUuids) {
        sentExitMessagesRef.current.delete(newUserId)
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
          const isMemberUUID = uuidRegex.test(member.userId)
          
          // 1. 직접 비교 (현재 사용자) - localStorage ID와 UUID 모두 확인
          if (member.userId === user.id || member.userId === currentUserUuidRef.current) {
            isActive = true
            console.log('✅ 활성 사용자 (현재 사용자):', member.userId, memberUser.name)
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
                  
                  // 조깅 크루의 경우: 현재 사용자의 UUID와도 비교
                  if (!isActive && currentUserUuidRef.current && member.userId === currentUserUuidRef.current) {
                    isActive = true
                    console.log('✅ 활성 사용자 (현재 사용자 UUID 매칭):', member.userId, memberUser.name)
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
          
          // 현재 사용자인 경우 myVideoEnabled, myAudioEnabled 사용
          // 현재 사용자 확인: localStorage ID, UUID, 또는 currentUserUuidRef 모두 확인
          const isCurrentUser = member.userId === user.id || 
            member.userId === currentUserUuidRef.current ||
            (currentUserUuidRef.current && member.userId === currentUserUuidRef.current)
          
          // 현재 사용자는 항상 활성으로 표시
          if (isCurrentUser) {
            isActive = true
            console.log('✅ 현재 사용자 강제 활성화:', member.userId, memberUser.name)
          }
          
          participantList.push({
            id: member.id,
            userId: member.userId,
            userName: memberUser.name,
            videoEnabled: isCurrentUser ? myVideoEnabled : (isActive ? member.videoEnabled : false),
            audioEnabled: isCurrentUser ? myAudioEnabled : (isActive ? member.audioEnabled : false),
            status: isCurrentUser ? myStatus : (isActive ? 'active' : 'inactive'),
            score: isCurrentUser ? myScore : undefined,
            currentCount: isCurrentUser ? myCurrentCount : undefined,
          })
        }
      }

      // 참여자 목록을 일관된 순서로 정렬 (userId 기준)
      participantList.sort((a, b) => {
        // 현재 사용자를 맨 앞에 배치
        if (a.userId === user.id) return -1
        if (b.userId === user.id) return 1
        
        // 활성 사용자를 비활성 사용자보다 앞에 배치
        if (a.status !== 'inactive' && b.status === 'inactive') return -1
        if (a.status === 'inactive' && b.status !== 'inactive') return 1
        
        // 같은 상태면 userId로 정렬 (일관된 순서 유지)
        return a.userId.localeCompare(b.userId)
      })

      console.log('최종 참여자 목록:', participantList.map(p => ({ 
        name: p.userName, 
        userId: p.userId, 
        status: p.status, 
        isActive: p.status !== 'inactive' 
      })))
      setParticipants(participantList)

      // 참여자 목록이 변경되었을 때 콜백 호출 (조깅 크루의 실시간 경로 갱신용)
      if (onParticipantsChange && crewType === 'jogging') {
        console.log('🔄 참여자 목록 변경 감지: 실시간 경로 갱신 트리거')
        onParticipantsChange()
      }

      // 활성 참여자와 WebRTC 연결 시작 (참여자 섹션이 펼쳐진 경우에만)
      const currentUser = authService.getCurrentUser()
      const activeParticipants = participantList.filter(p => p.status !== 'inactive')
      
      console.log('🔍 WebRTC 연결 시작 조건 확인:', {
        hasCurrentUser: !!currentUser,
        currentUserId: currentUser?.id,
        myVideoEnabled,
        isSubscribed: signalingService.isSubscribed(crewId),
        participantCount: participantList.length,
        activeParticipantCount: activeParticipants.length,
        activeParticipants: activeParticipants.map(p => ({ name: p.userName, userId: p.userId })),
        isExpanded, // 참여자 섹션 펼침 상태
      })
      
      // 참여자 섹션이 접혀있으면 WebRTC 연결 시작하지 않음 (로컬 시스템 부하 방지)
      if (!isExpanded) {
        console.log('ℹ️ WebRTC 연결 시작 안 함: 참여자 섹션이 접혀있습니다 (로컬 시스템 부하 방지)')
        return
      }
      
      // 조건 확인 로그를 항상 출력 (조건이 맞지 않아도)
      if (!currentUser) {
        console.warn('⚠️ WebRTC 연결 시작 실패: 사용자가 로그인하지 않았습니다')
        return
      }
      
      if (!myVideoEnabled) {
        console.log('ℹ️ WebRTC 연결 시작 안 함: myVideoEnabled가 false입니다')
        console.log('   💡 참고: WebRTC 연결을 시작하려면 카메라를 켜야 합니다.')
        console.log('   💡 참고: 다른 참여자의 영상을 보려면 자신의 카메라도 켜야 할 수 있습니다.')
        return
      }
      
      // 채널이 구독되어 있는지 확인
      if (!signalingService.isSubscribed(crewId)) {
        console.warn('⚠️ 채널이 구독되지 않아 WebRTC 연결을 시작할 수 없습니다:', crewId)
        console.warn('   채널 구독을 기다리는 중... (WebRTC 초기화가 완료되지 않았을 수 있음)')
        return
      }
      
      // 활성 참여자가 없으면 연결 시작할 필요 없음
      if (activeParticipants.length === 0) {
        console.log('ℹ️ WebRTC 연결 시작 안 함: 활성 참여자가 없습니다')
        return
      }
      
      // WebRTC 연결 시작
      {

        console.log(`🔗 WebRTC 연결 시작 준비: ${participantList.length}명의 참여자 중 활성 참여자 확인 중...`)
        for (const participant of participantList) {
          // 현재 사용자는 제외 (UUID와 localStorage ID 모두 확인)
          const isCurrentParticipant = 
            participant.userId === currentUser.id ||
            participant.userId === currentUser.id.replace('user_', '') ||
            (currentUserUuidRef.current && participant.userId === currentUserUuidRef.current)
          
          if (isCurrentParticipant) {
            console.log(`현재 사용자 제외: ${participant.userName} (${participant.userId})`)
            continue
          }
          
          // 비활성 사용자는 제외 (단, 비디오가 활성화된 경우는 포함)
          if (participant.status === 'inactive' && !participant.videoEnabled) {
            console.log(`비활성 사용자 제외: ${participant.userName} (${participant.userId})`)
            continue
          }
          
          // 이미 연결이 있으면 제외 (단, 원격 스트림이 없는 경우 재연결 시도)
          const existingConnection = webrtcService.getPeerConnection(participant.userId)
          const hasRemoteStream = remoteStreams.has(participant.userId)
          
          // 재연결 시도 횟수 추적 (무한 루프 방지)
          const reconnectKey = `reconnect_${participant.userId}`
          const reconnectCount = (window as any)[reconnectKey] || 0
          
          if (existingConnection) {
            const state = existingConnection.iceConnectionState
            const signalingState = existingConnection.signalingState
            // iceConnectionState는 'new' | 'checking' | 'connected' | 'completed' | 'failed' | 'disconnected' | 'closed'
            if (state === 'connected' || state === 'completed' || state === 'checking') {
              if (hasRemoteStream) {
                const logMessage = `이미 연결 중: ${participant.userName} (${participant.userId}), 상태: ${state}, 스트림 있음`
                if (typeof console !== 'undefined' && console.log) {
                  console.log(logMessage)
                }
                // 스트림이 있으면 재연결 카운터 리셋
                (window as any)[reconnectKey] = 0
                continue
              } else {
                // 재연결 시도 횟수 제한 (최대 2회)
                if (reconnectCount >= 2) {
                  console.warn(`⚠️ 재연결 시도 횟수 초과: ${participant.userName} (${participant.userId}), 재연결 중단`)
                  continue
                }
                
                const warnMessage1 = `⚠️ 연결은 되어 있지만 원격 스트림이 없습니다: ${participant.userName} (${participant.userId})`
                const warnData = {
                  iceConnectionState: state,
                  signalingState: signalingState,
                  reconnectCount: reconnectCount + 1,
                }
                if (typeof console !== 'undefined' && console.warn) {
                  console.warn(warnMessage1, warnData)
                  console.warn(`   재연결을 시도합니다... (${reconnectCount + 1}/2)`)
                }
                
                // 재연결 카운터 증가
                (window as any)[reconnectKey] = reconnectCount + 1
                
                // 기존 연결 종료 후 재연결
                try {
                  await webrtcService.closeConnection(participant.userId)
                  // 잠시 대기 후 재연결
                  await new Promise(resolve => setTimeout(resolve, 1000))
                } catch (error) {
                  console.error(`재연결 중 에러: ${participant.userName}`, error)
                  continue
                }
              }
            }
          } else {
            // 연결이 없으면 재연결 카운터 리셋
            (window as any)[reconnectKey] = 0
          }

          // WebRTC 연결 시작
          // 동시 실행 방지: 이미 연결 시도 중인지 확인
          const connectingKey = `connecting_${participant.userId}`
          if ((window as any)[connectingKey]) {
            console.warn(`⚠️ 이미 연결 시도 중입니다: ${participant.userName} (${participant.userId})`)
            continue
          }
          
          (window as any)[connectingKey] = true
          
          try {
            console.log(`🚀 WebRTC 연결 시작: ${participant.userName} (${participant.userId})`)
            
            // STUN 서버 상태 확인
            const peerConnection = webrtcService.getPeerConnection(participant.userId)
            if (peerConnection) {
              console.log(`🔍 WebRTC 연결 상태 확인 (${participant.userName}):`, {
                connectionState: peerConnection.connectionState,
                iceConnectionState: peerConnection.iceConnectionState,
                iceGatheringState: peerConnection.iceGatheringState,
                signalingState: peerConnection.signalingState,
                localDescription: peerConnection.localDescription ? '설정됨' : '없음',
                remoteDescription: peerConnection.remoteDescription ? '설정됨' : '없음',
              })
            }
            
            const offer = await webrtcService.createOffer(participant.userId)
            console.log(`✅ Offer 생성 완료: ${participant.userName}`, {
              offerType: offer.type,
              hasSdp: !!offer.sdp,
              sdpLength: offer.sdp?.length || 0,
            })
            
            // Signal 서버 상태 확인
            const isSubscribed = (signalingService as any).isSubscribed?.(crewId)
            console.log(`📡 Signal 서버 상태 확인:`, {
              crewId,
              isSubscribed: isSubscribed !== undefined ? isSubscribed : '확인 불가',
              channelName: `crew_${crewId}_signaling`,
            })
            
            await signalingService.sendOffer(crewId, participant.userId, offer)
            // getCurrentUserId가 없을 수 있으므로 안전하게 처리
            let currentUserId = 'unknown'
            try {
              if (typeof (signalingService as any).getCurrentUserId === 'function') {
                currentUserId = (signalingService as any).getCurrentUserId()
              }
            } catch (error) {
              console.warn('getCurrentUserId 호출 실패:', error)
            }
            
            console.log(`✅ Offer 전송 완료: ${participant.userName}`, {
              from: currentUserId,
              to: participant.userId,
            })

            // ICE candidate 수집 및 전송
            const peerConnectionAfterOffer = webrtcService.getPeerConnection(participant.userId)
            if (peerConnectionAfterOffer) {
              peerConnectionAfterOffer.onicecandidate = async (event) => {
                if (event.candidate) {
                  console.log(`🧊 ICE candidate 수집됨 (${participant.userName}):`, {
                    candidateType: event.candidate.type,
                    candidateProtocol: event.candidate.protocol,
                    candidateAddress: event.candidate.address,
                    candidatePort: event.candidate.port,
                  })
                  await signalingService.sendIceCandidate(
                    crewId,
                    participant.userId,
                    event.candidate
                  )
                } else {
                  console.log(`✅ ICE candidate 수집 완료 (${participant.userName})`)
                }
              }
            }
          } catch (error) {
            console.error(`WebRTC 연결 실패 (${participant.userName}):`, error)
          } finally {
            // 연결 시도 완료 (성공 또는 실패)
            (window as any)[connectingKey] = false
          }
        }
      }
    } catch (error) {
      console.error('참여자 로드 실패:', error)
    }
  }, [crewId, myVideoEnabled, crewType, isExpanded]) // isExpanded가 변경될 때마다 새로운 함수 생성

  // loadParticipants 주기적 호출 (loadParticipants 정의 후에 배치)
  useEffect(() => {
    if (!crewId) return
    
    console.log('📋 loadParticipants 호출 시작', { crewId, myVideoEnabled, isExpanded, myStatus })
    
    // 초기 로드
    loadParticipants()
    
    // 주기적 갱신 (참여자 섹션이 펼쳐진 경우에만)
    const interval = setInterval(() => {
      if (isExpanded) {
        console.log('📋 loadParticipants 주기적 호출', { crewId, myVideoEnabled, isExpanded })
        loadParticipants()
      }
    }, 2000) // 2초마다 갱신
    
    return () => clearInterval(interval)
  }, [crewId, loadParticipants, isExpanded]) // isExpanded가 변경되면 재실행

  // myStatus가 'active'로 변경될 때 참여자 목록 새로고침 (조깅 시작 시)
  useEffect(() => {
    if (!crewId) return
    
    // myStatus가 'active'로 변경되면 참여자 목록을 즉시 새로고침
    if (myStatus === 'active') {
      console.log('🏃 조깅 시작 감지: 참여자 목록 새로고침', { crewId, myStatus })
      // 약간의 지연 후 호출 (WebRTC 초기화 완료 대기)
      const timer = setTimeout(() => {
        loadParticipants()
      }, 1000) // 1초 후 참여자 목록 새로고침
      
      return () => clearTimeout(timer)
    }
  }, [myStatus, crewId, loadParticipants]) // myStatus가 변경될 때 실행

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

  const handleToggle = async () => {
    // 클릭 시 접기/펼치기 토글
    const newIsExpanded = !isExpanded
    setIsExpanded(newIsExpanded)
    const newHeight = newIsExpanded ? MAX_HEIGHT : COLLAPSED_HEIGHT
    setHeight(newHeight)
    if (onHeightChange) {
      onHeightChange(newHeight)
    }
    
    // 참여자 섹션을 닫으면 모든 WebRTC 연결 종료 (로컬 시스템 부하 방지)
    if (!newIsExpanded) {
      console.log('🛑 참여자 섹션 닫힘: 모든 WebRTC 연결 종료 및 스트림 정리')
      try {
        // 모든 WebRTC 연결 종료
        await webrtcService.closeAllConnections()
        // 원격 스트림 정리
        setRemoteStreams(new Map())
        // 연결 상태 정리
        setConnectionStates(new Map())
        // 비디오 요소의 srcObject 정리
        participantVideoRefs.current.forEach((videoElement) => {
          if (videoElement) {
            videoElement.srcObject = null
          }
        })
        console.log('✅ 모든 WebRTC 연결 및 스트림 정리 완료')
      } catch (error) {
        console.error('❌ WebRTC 연결 종료 중 오류:', error)
      }
    } else {
      // 참여자 섹션을 펼치면 WebRTC 연결 시작
      console.log('📹 참여자 섹션 펼침: WebRTC 연결 시작')
      // loadParticipants가 useEffect에서 자동으로 호출되어 연결이 시작됨
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
      className="bg-gray-900/95 rounded-t-2xl overflow-hidden fixed left-0 right-0 z-50"
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
            {isExpanded ? `참여자 (${activeCount}/${participants.length}명)` : `참여자 (${activeCount}/${participants.length}명)`}
          </h3>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => onVideoToggle(!myVideoEnabled)}
            disabled={!videoShareEnabled}
            className={`px-3 py-2 rounded-lg font-semibold text-sm transition ${
              !videoShareEnabled
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
                : myVideoEnabled
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title={!videoShareEnabled ? '이 크루에서는 영상 공유가 비활성화되어 있습니다' : ''}
          >
            📹 {myVideoEnabled ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => onAudioToggle(!myAudioEnabled)}
            disabled={!audioShareEnabled}
            className={`px-3 py-2 rounded-lg font-semibold text-sm transition ${
              !audioShareEnabled
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
                : myAudioEnabled
                ? 'bg-green-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title={!audioShareEnabled ? '이 크루에서는 음성 공유가 비활성화되어 있습니다' : ''}
          >
            🎤 {myAudioEnabled ? 'ON' : 'OFF'}
          </button>
          
          {/* 화질 선택 버튼 */}
          {myVideoEnabled && (
            <div className="relative" ref={qualityMenuRef}>
              <button
                onClick={() => setShowQualityMenu(!showQualityMenu)}
                className="px-3 py-2 rounded-lg font-semibold text-sm transition bg-purple-500 text-white hover:bg-purple-600 flex items-center gap-1"
                title="화질 선택"
              >
                <span>⚙️</span>
                <span className="hidden sm:inline">
                  {videoQuality === 'auto' 
                    ? (participants.length >= 5 ? '자동(저화질)' : '자동(중간)')
                    : qualityPresets[videoQuality as keyof typeof qualityPresets]?.label.split(' ')[0] || '화질'
                  }
                </span>
                <svg 
                  className={`w-4 h-4 transition-transform ${showQualityMenu ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* 화질 선택 메뉴 */}
              {showQualityMenu && (
                <div className="absolute right-0 mt-2 bg-gray-800 rounded-lg shadow-xl z-50 min-w-[200px] border border-gray-700">
                  <div className="p-2">
                    <div className="text-xs text-gray-400 px-3 py-2 mb-1">화질 선택</div>
                    {(['auto', 'high', 'medium', 'low'] as const).map((quality) => {
                      const preset = quality === 'auto' 
                        ? null 
                        : qualityPresets[quality as keyof typeof qualityPresets]
                      const isSelected = videoQuality === quality
                      
                      return (
                        <button
                          key={quality}
                          onClick={() => {
                            console.log('🎬 화질 변경 요청:', {
                              from: videoQuality,
                              to: quality,
                              hasSharedStream: !!sharedVideoStream,
                              hasMyVideoStream: !!myVideoStream,
                            })
                            
                            setVideoQuality(quality)
                            setShowQualityMenu(false)
                            
                            // 공유 스트림을 사용하는 경우 화질 변경 제한
                            if (sharedVideoStream && myVideoStream) {
                              const currentVideoTrack = myVideoStream.getVideoTracks()[0]
                              const sharedVideoTrack = sharedVideoStream.getVideoTracks()[0]
                              
                              // 공유 스트림의 트랙을 사용 중이면 해상도 변경 불가, 비트레이트만 조정
                              if (currentVideoTrack === sharedVideoTrack) {
                                console.log('⚠️ 공유 스트림 사용 중: 해상도 변경 불가, 비트레이트만 조정')
                                
                                // 비트레이트만 조정 (해상도는 변경하지 않음)
                                const activeVideoCount = participants.filter(p => p.status !== 'inactive' && p.videoEnabled).length + (myVideoEnabled ? 1 : 0)
                                const qualityPreset = getVideoQuality(activeVideoCount, quality)
                                
                                console.log('📊 비트레이트 조정:', {
                                  quality,
                                  bitrate: `${qualityPreset.bitrate / 1000}Kbps`,
                                  participantCount: participants.length,
                                })
                                
                                // WebRTC 연결의 비트레이트만 조정
                                participants.forEach(participant => {
                                  const peerConnection = webrtcService.getPeerConnection(participant.userId)
                                  if (peerConnection) {
                                    webrtcService.applyBitrateLimit(peerConnection, qualityPreset.bitrate).catch(err => {
                                      console.warn(`비트레이트 조정 실패 (${participant.userName}):`, err)
                                    })
                                  }
                                })
                                
                                // 로컬 스트림의 비트레이트도 조정
                                const localPeerConnections = webrtcService.getAllPeerConnections()
                                localPeerConnections.forEach((peerConnection, userId) => {
                                  webrtcService.applyBitrateLimit(peerConnection, qualityPreset.bitrate).catch(err => {
                                    console.warn(`로컬 비트레이트 조정 실패 (${userId}):`, err)
                                  })
                                })
                                
                                return // 공유 스트림을 사용 중이면 스트림 재획득하지 않음
                              }
                            }
                            
                            // 공유 스트림을 사용하지 않는 경우 스트림 재획득
                            // 화질 변경 시 강제로 스트림 재획득 (해상도 차이 체크 무시)
                            console.log('🔄 화질 변경: 스트림 재획득 시작', {
                              hasMyVideoStream: !!myVideoStream,
                              hasSharedStream: !!sharedVideoStream,
                            })
                            
                            if (myVideoStream) {
                              const currentVideoTrack = myVideoStream.getVideoTracks()[0]
                              const sharedVideoTrack = sharedVideoStream?.getVideoTracks()[0]
                              
                              // 공유 스트림의 트랙이 아니면 정리
                              if (!sharedVideoStream || currentVideoTrack !== sharedVideoTrack) {
                                console.log('🛑 화질 변경: 기존 스트림 정리 및 재획득 플래그 설정')
                                // 공유 스트림의 트랙이 아닌 경우만 stop
                                myVideoStream.getTracks().forEach(track => {
                                  if (track !== sharedVideoTrack) {
                                    track.stop()
                                  }
                                })
                                setMyVideoStream(null)
                                // 스트림 재획득을 위해 hasInitializedRef 리셋 및 강제 재획득 플래그 설정
                                hasInitializedRef.current = false
                                forceReacquireRef.current = true
                                console.log('✅ 화질 변경: 재획득 플래그 설정 완료, useEffect가 스트림 재획득을 시작합니다')
                              } else {
                                console.log('⚠️ 공유 스트림 사용 중: 스트림 재획득 불가')
                              }
                            } else {
                              // 스트림이 없으면 재획득 허용
                              console.log('🔄 화질 변경: 스트림이 없으므로 재획득 허용')
                              hasInitializedRef.current = false
                              forceReacquireRef.current = true
                            }
                          }}
                          className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                            isSelected
                              ? 'bg-purple-600 text-white'
                              : 'text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">
                                {quality === 'auto' 
                                  ? '자동' 
                                  : preset?.label
                                }
                              </div>
                              {preset && (
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {preset.description}
                                </div>
                              )}
                              {quality === 'auto' && (
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {participants.length >= 5 ? '5명 이상: 저화질' : '기본: 중간 화질'}
                                </div>
                              )}
                            </div>
                            {isSelected && (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
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
            key={participant.userId}
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
                            <div className="text-gray-500 text-xs mt-1 flex items-center gap-1 justify-center">
                              {participant.userName}
                              <RankBadge rank={userRanks[participant.userId] || 1} type="user" size="sm" showText={false} />
                            </div>
                          </div>
                      </div>
                    ) : participant.videoEnabled ? (
                      <div className="w-full h-full bg-gray-700 relative overflow-hidden">
                        {(() => {
                          const currentUser = authService.getCurrentUser()
                          // UUID와 localStorage ID 모두 비교
                          let isCurrentUser = false
                          if (currentUser) {
                            // 직접 비교
                            if (participant.userId === currentUser.id) {
                              isCurrentUser = true
                            }
                            // localStorage ID 제거 후 비교
                            else if (participant.userId === currentUser.id.replace('user_', '')) {
                              isCurrentUser = true
                            }
                            // 캐시된 UUID와 비교
                            else if (currentUserUuidRef.current && participant.userId === currentUserUuidRef.current) {
                              isCurrentUser = true
                            }
                          }
                          
                          console.log(`비디오 렌더링 체크: ${participant.userName}`, {
                            participantUserId: participant.userId,
                            currentUserId: currentUser?.id,
                            currentUserUuid: currentUserUuidRef.current,
                            isCurrentUser,
                            myVideoEnabled,
                            participantVideoEnabled: participant.videoEnabled,
                            hasMyVideoStream: !!myVideoStream,
                          })
                          
                          console.log(`비디오 렌더링 체크: ${participant.userName}`, {
                            participantUserId: participant.userId,
                            currentUserId: currentUser?.id,
                            currentUserUuid: currentUserUuidRef.current,
                            isCurrentUser,
                            myVideoEnabled,
                            participantVideoEnabled: participant.videoEnabled,
                            hasMyVideoStream: !!myVideoStream,
                          })
                          
                          if (isCurrentUser) {
                            // 내 영상
                            if (!myVideoStream) {
                              console.warn(`⚠️ 내 영상 스트림이 없습니다: ${participant.userName}`)
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gray-700">
                                  <div className="text-center">
                                    <div className="text-3xl mb-2">📹</div>
                                    <div className="text-gray-300 text-sm">영상 로딩 중...</div>
                                  </div>
                                </div>
                              )
                            }
                            return (
                              <video
                                ref={myVideoRef}
                                autoPlay
                                muted
                                playsInline
                                webkit-playsinline="true"
                                x5-playsinline="true"
                                x5-video-player-type="h5"
                                x5-video-player-fullscreen="true"
                                className="w-full h-full object-cover"
                                onLoadedMetadata={() => {
                                  console.log(`✅ 내 영상 메타데이터 로드 완료: ${participant.userName}`)
                                }}
                                onError={(error) => {
                                  console.error(`❌ 내 영상 오류: ${participant.userName}`, error)
                                }}
                              />
                            )
                          } else {
                            // 다른 참여자 영상 (WebRTC로 스트림 받기)
                            const remoteStream = remoteStreams.get(participant.userId)
                            const connectionState = connectionStates.get(participant.userId)
                            
                            console.log(`참여자 ${participant.userName} (${participant.userId}):`, {
                              hasRemoteStream: !!remoteStream,
                              connectionState,
                              videoEnabled: participant.videoEnabled,
                              streamActive: remoteStream?.active,
                              videoTracks: remoteStream?.getVideoTracks().length || 0,
                            })
                            
                            // remoteStream이 있거나 연결 중이면 비디오 표시 시도
                            if (remoteStream && remoteStream.active && remoteStream.getVideoTracks().length > 0) {
                              // Remote stream이 있으면 비디오 표시
                              return (
                                <video
                                  ref={(el) => {
                                    if (el) {
                                      participantVideoRefs.current.set(participant.userId, el)
                                      // 스트림은 useEffect에서 설정 (remoteStreams 변경 시)
                                      if (el.srcObject !== remoteStream) {
                                        el.srcObject = remoteStream
                                        console.log(`✅ Remote video 설정: ${participant.userName}`, {
                                          streamId: remoteStream.id,
                                          videoTracks: remoteStream.getVideoTracks().length,
                                          streamActive: remoteStream.active,
                                        })
                                      }
                                      el.onloadedmetadata = () => {
                                        console.log(`✅ Remote video 메타데이터 로드: ${participant.userName}`)
                                      }
                                      el.onerror = (error) => {
                                        console.error(`❌ Remote video 오류 (${participant.userName}):`, error)
                                      }
                                    }
                                  }}
                                  autoPlay
                                  playsInline
                                  webkit-playsinline="true"
                                  x5-playsinline="true"
                                  x5-video-player-type="h5"
                                  x5-video-player-fullscreen="true"
                                  className="w-full h-full object-cover"
                                />
                              )
                            } else if (connectionState === 'connecting' || connectionState === 'checking') {
                              // 연결 중
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                                  <div className="text-center">
                                    <div className="text-3xl mb-2 animate-pulse">📹</div>
                                    <div className="text-gray-300 text-sm font-semibold flex items-center gap-1 justify-center">
                                      {participant.userName}
                                      <RankBadge rank={userRanks[participant.userId] || 1} type="user" size="sm" showText={false} />
                                    </div>
                                    <div className="text-gray-400 text-xs mt-1">연결 중...</div>
                                  </div>
                                </div>
                              )
                            } else {
                              // 연결 대기 또는 실패
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                                  <div className="text-center">
                                    <div className="text-3xl mb-2">📹</div>
                                    <div className="text-gray-300 text-sm font-semibold flex items-center gap-1 justify-center">
                                      {participant.userName}
                                      <RankBadge rank={userRanks[participant.userId] || 1} type="user" size="sm" showText={false} />
                                    </div>
                                    <div className="text-gray-400 text-xs mt-1">영상 공유 중</div>
                                  </div>
                                </div>
                              )
                            }
                          }
                        })()}
                        {/* 사용자 이름 오버레이 */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <div className="text-white text-sm font-semibold truncate flex items-center gap-1">
                            {participant.userName}
                            <RankBadge rank={userRanks[participant.userId] || 1} type="user" size="sm" showText={false} />
                            {/* 화질 정보 표시 (사용자 이름 옆) */}
                            {participant.videoEnabled && (() => {
                              const currentUser = authService.getCurrentUser()
                              const isCurrentUser = currentUser && (
                                participant.userId === currentUser.id ||
                                participant.userId === currentUser.id.replace('user_', '') ||
                                (currentUserUuidRef.current && participant.userId === currentUserUuidRef.current)
                              )
                              
                              const hasStream = isCurrentUser ? !!myVideoStream : !!remoteStreams.get(participant.userId)
                              if (hasStream) {
                                const quality = getParticipantQuality(participant, isCurrentUser || false)
                                const qualityLabels = {
                                  high: '고화질',
                                  medium: '중화질',
                                  low: '저화질',
                                }
                                const qualityColors = {
                                  high: 'bg-green-500/80',
                                  medium: 'bg-yellow-500/80',
                                  low: 'bg-red-500/80',
                                }
                                return (
                                  <span className={`${qualityColors[quality]} text-white text-xs px-1.5 py-0.5 rounded font-semibold ml-1`}>
                                    {qualityLabels[quality]}
                                  </span>
                                )
                              }
                              return null
                            })()}
                          </div>
                        </div>
              </div>
            ) : (
                      <div className="w-full h-full bg-gray-700 flex flex-col items-center justify-center">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mb-3">
                          <div className="text-3xl text-white font-bold">{participant.userName.charAt(0)}</div>
                        </div>
                        <div className="text-gray-300 text-sm font-semibold flex items-center gap-1 justify-center">
                          {participant.userName}
                          <RankBadge rank={userRanks[participant.userId] || 1} type="user" size="sm" showText={false} />
                        </div>
                        {/* 사용자 이름 오버레이 */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <div className="text-white text-sm font-semibold truncate flex items-center gap-1">
                            {participant.userName}
                            <RankBadge rank={userRanks[participant.userId] || 1} type="user" size="sm" showText={false} />
                          </div>
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
