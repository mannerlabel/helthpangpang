/**
 * WebRTC 서비스
 * Peer-to-Peer 연결을 관리하고 미디어 스트림을 교환합니다.
 */

// 안전한 console 로깅 헬퍼 함수
// 함수가 덮어씌워지거나 재정의되는 것을 방지하기 위해 즉시 실행 함수로 래핑
const safeLog = (() => {
  const logFn = (...args: any[]) => {
    if (typeof console !== 'undefined' && console.log && typeof console.log === 'function') {
      try {
        console.log(...args)
      } catch (e) {
        // console.log 실패 시 무시
      }
    }
  }
  // 함수 객체에 직접 할당하여 덮어쓰기 방지
  Object.freeze(logFn)
  return logFn
})()

const safeWarn = (() => {
  const warnFn = (...args: any[]) => {
    if (typeof console !== 'undefined' && console.warn && typeof console.warn === 'function') {
      try {
        console.warn(...args)
      } catch (e) {
        // console.warn 실패 시 무시
      }
    }
  }
  Object.freeze(warnFn)
  return warnFn
})()

const safeError = (() => {
  const errorFn = (...args: any[]) => {
    if (typeof console !== 'undefined' && console.error && typeof console.error === 'function') {
      try {
        console.error(...args)
      } catch (e) {
        // console.error 실패 시 무시
      }
    }
  }
  Object.freeze(errorFn)
  return errorFn
})()

export interface WebRTCConfig {
  iceServers: RTCIceServer[]
  iceCandidatePoolSize?: number
}

export interface PeerConnectionState {
  connectionState: RTCPeerConnectionState
  iceConnectionState: RTCIceConnectionState
  iceGatheringState: RTCIceGatheringState
}

export type ConnectionStateChangeCallback = (
  userId: string,
  state: PeerConnectionState
) => void

export type RemoteStreamCallback = (
  userId: string,
  stream: MediaStream | null
) => void

class WebRTCService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map()
  private localStream: MediaStream | null = null
  private config: WebRTCConfig
  private connectionStateCallbacks: Set<ConnectionStateChangeCallback> = new Set()
  private remoteStreamCallbacks: Set<RemoteStreamCallback> = new Set()
  private currentMaxBitrate: number | null = null // 현재 적용된 최대 비트레이트

  constructor() {
    // 기본 STUN 서버 설정 (Google 공개 서버 + 대안 서버)
    // 주의: Google STUN 서버는 테스트/개발용이며, 대규모 사용 시 제한이 있을 수 있음
    this.config = {
      iceServers: [
        // Google STUN 서버 (주 서버)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // 대안 STUN 서버 (부하 분산 및 안정성 향상)
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        // Mozilla STUN 서버 (대안)
        { urls: 'stun:stun.mozilla.org:3478' },
      ],
      // iceCandidatePoolSize를 줄여서 STUN 서버 부하 감소
      // 참고: 각 PeerConnection마다 이 수만큼의 ICE candidate를 미리 수집함
      iceCandidatePoolSize: 0, // 0으로 설정하면 필요할 때만 수집 (기본값)
    }
  }

  /**
   * WebRTC 설정 업데이트
   */
  updateConfig(config: Partial<WebRTCConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 로컬 미디어 스트림 설정
   */
  async setLocalStream(stream: MediaStream, maxBitrate?: number): Promise<void> {
    this.localStream = stream
    
    // 비트레이트 저장 (새로운 PeerConnection 생성 시 적용)
    if (maxBitrate !== undefined) {
      this.currentMaxBitrate = maxBitrate
      safeLog(`💾 비트레이트 제한 저장: ${maxBitrate / 1000}Kbps`)
    }

    // 기존 모든 PeerConnection에 로컬 스트림 추가
    for (const [userId, peerConnection] of this.peerConnections) {
      stream.getTracks().forEach((track) => {
        const sender = peerConnection.getSenders().find(
          (s) => s.track?.kind === track.kind
        )
        if (sender) {
          sender.replaceTrack(track)
        } else {
          peerConnection.addTrack(track, stream)
        }
      })
      
      // 비트레이트 제한 설정 (비디오 트랙에만)
      if (maxBitrate) {
        await this.applyBitrateLimit(peerConnection, maxBitrate)
      }
    }
  }

  /**
   * 비트레이트 제한 적용 (public)
   * 특정 PeerConnection에 비트레이트 제한을 적용합니다.
   */
  async applyBitrateLimit(
    peerConnection: RTCPeerConnection,
    maxBitrate: number
  ): Promise<void> {
    try {
      const senders = peerConnection.getSenders()
      for (const sender of senders) {
        if (sender.track && sender.track.kind === 'video') {
          const params = sender.getParameters()
          if (!params.encodings) {
            params.encodings = [{}]
          }
          
          // 각 인코딩에 비트레이트 제한 적용
          params.encodings.forEach((encoding: any) => {
            encoding.maxBitrate = maxBitrate
            // 최대 프레임레이트도 함께 제한 (선택사항)
            // encoding.maxFramerate = 30
          })
          
          await sender.setParameters(params)
          safeLog(`✅ 비트레이트 제한 적용: ${maxBitrate / 1000}Kbps`)
        }
      }
    } catch (error) {
      safeWarn('⚠️ 비트레이트 제한 적용 실패:', error)
    }
  }

  /**
   * 로컬 스트림 제거
   */
  removeLocalStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }
  }

  /**
   * PeerConnection 생성
   */
  async createPeerConnection(userId: string): Promise<RTCPeerConnection> {
    // 이미 존재하는 연결이 있으면 상태 확인
    const existingConnection = this.peerConnections.get(userId)
    if (existingConnection) {
      // 연결이 닫혔거나 실패한 상태면 정리하고 새로 생성
      if (
        existingConnection.connectionState === 'closed' ||
        existingConnection.iceConnectionState === 'closed' ||
        existingConnection.iceConnectionState === 'failed'
      ) {
        safeWarn(`⚠️ 기존 연결이 닫힌 상태입니다. 정리 후 재생성: ${userId}`, {
          connectionState: existingConnection.connectionState,
          iceConnectionState: existingConnection.iceConnectionState,
        })
        try {
          existingConnection.close()
        } catch (e) {
          // 이미 닫혔을 수 있음
        }
        this.peerConnections.delete(userId)
        // 새 연결 생성 계속 진행
      } else {
        // 정상 상태면 기존 연결 반환
        return existingConnection
      }
    }

    // PeerConnection 생성 시도 횟수 제한 (무한 루프 방지)
    const createKey = `create_${userId}`
    const createCount = (window as any)[createKey] || 0
    if (createCount >= 5) {
      throw new Error(`PeerConnection 생성 시도 횟수 초과: ${userId} (최대 5회)`)
    }
    (window as any)[createKey] = createCount + 1

    try {
      // RTCPeerConnection 지원 여부 확인
      // TypeScript에서 RTCPeerConnection이 타입으로 인식될 수 있으므로
      // window 객체에서 직접 확인 (대부분의 브라우저에서 window.RTCPeerConnection 사용)
      let RTCPeerConnectionConstructor: any = null
      
      if (typeof window !== 'undefined') {
        // window 객체에서 직접 확인
        RTCPeerConnectionConstructor = (window as any).RTCPeerConnection
      }
      
      // window에 없으면 globalThis에서 확인
      if (!RTCPeerConnectionConstructor && typeof globalThis !== 'undefined') {
        RTCPeerConnectionConstructor = (globalThis as any).RTCPeerConnection
      }
      
      // 함수인지 확인
      if (!RTCPeerConnectionConstructor || typeof RTCPeerConnectionConstructor !== 'function') {
        const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
        const hasWindow = typeof window !== 'undefined'
        const hasGlobalThis = typeof globalThis !== 'undefined'
        safeError('❌ RTCPeerConnection을 찾을 수 없습니다:', {
          userAgent,
          hasWindow,
          hasGlobalThis,
          windowRTCPeerConnection: typeof window !== 'undefined' ? typeof (window as any).RTCPeerConnection : 'N/A',
          globalThisRTCPeerConnection: typeof globalThis !== 'undefined' ? typeof (globalThis as any).RTCPeerConnection : 'N/A',
        })
        throw new Error(`RTCPeerConnection이 지원되지 않는 브라우저입니다. User Agent: ${userAgent}`)
      }
      
      // config 유효성 검사
      if (!this.config || !this.config.iceServers || !Array.isArray(this.config.iceServers)) {
        throw new Error('WebRTC config가 유효하지 않습니다')
      }
      
      // PeerConnection 생성 (디버깅 로그 추가)
      safeLog('🔧 RTCPeerConnection 생성 시도:', {
        userId,
        constructorType: typeof RTCPeerConnectionConstructor,
        isFunction: typeof RTCPeerConnectionConstructor === 'function',
        config: {
          iceServersCount: this.config.iceServers.length,
          iceCandidatePoolSize: this.config.iceCandidatePoolSize,
        },
      })
      
      // 생성자 호출 전 최종 확인
      if (typeof RTCPeerConnectionConstructor !== 'function') {
        throw new Error(`RTCPeerConnection 생성자가 함수가 아닙니다. 타입: ${typeof RTCPeerConnectionConstructor}`)
      }
      
      const peerConnection = new RTCPeerConnectionConstructor(this.config) as RTCPeerConnection
      
      // safeLog 호출 전 타입 체크 추가
      if (typeof safeLog === 'function') {
        safeLog('✅ RTCPeerConnection 생성 성공:', {
          userId,
          connectionState: peerConnection.connectionState,
          iceConnectionState: peerConnection.iceConnectionState,
        })
      }
      
      // 성공적으로 생성되면 카운터 리셋
      (window as any)[createKey] = 0

      // 로컬 스트림이 있으면 추가
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, this.localStream!)
        })
      }
      
      // 비트레이트 제한 적용 (설정된 경우, 비동기로 처리)
      // 화살표 함수로 this 바인딩 유지
      if (this.currentMaxBitrate) {
        // 약간의 지연 후 적용 (트랙이 추가된 후)
        const maxBitrate = this.currentMaxBitrate // 로컬 변수로 저장
        setTimeout(() => {
          // 비동기 처리를 Promise로 래핑
          this.applyBitrateLimit(peerConnection, maxBitrate).catch((error) => {
            safeWarn('⚠️ 비트레이트 제한 적용 중 에러 (무시):', error)
          })
        }, 100)
      }

      // ICE candidate 이벤트 처리
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // Signaling 서비스를 통해 전송 (외부에서 처리)
          safeLog(`ICE candidate for ${userId}:`, event.candidate)
        }
      }

      // ICE connection state 변경 감지
      peerConnection.oniceconnectionstatechange = () => {
        const state: PeerConnectionState = {
          connectionState: peerConnection.connectionState,
          iceConnectionState: peerConnection.iceConnectionState,
          iceGatheringState: peerConnection.iceGatheringState,
        }
        this.notifyConnectionStateChange(userId, state)
        safeLog(`ICE connection state for ${userId}:`, state.iceConnectionState)
      }

      // Connection state 변경 감지
      peerConnection.onconnectionstatechange = () => {
        const state: PeerConnectionState = {
          connectionState: peerConnection.connectionState,
          iceConnectionState: peerConnection.iceConnectionState,
          iceGatheringState: peerConnection.iceGatheringState,
        }
        this.notifyConnectionStateChange(userId, state)
        safeLog(`Connection state for ${userId}:`, state.connectionState)
      }

      // Remote stream 수신
      peerConnection.ontrack = (event) => {
        safeLog(`📹 Remote stream received from ${userId}:`, {
          streams: event.streams?.length || 0,
          tracks: event.track ? {
            kind: event.track.kind,
            id: event.track.id,
            enabled: event.track.enabled,
            readyState: event.track.readyState,
          } : null,
          streamsDetails: event.streams?.map(s => ({
            id: s.id,
            active: s.active,
            videoTracks: s.getVideoTracks().length,
            audioTracks: s.getAudioTracks().length,
          })),
          connectionState: peerConnection.connectionState,
          iceConnectionState: peerConnection.iceConnectionState,
        })
        if (event.streams && event.streams.length > 0) {
          const stream = event.streams[0]
          safeLog(`✅ Remote stream 설정: ${userId}`, {
            streamId: stream.id,
            active: stream.active,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
          })
          this.notifyRemoteStream(userId, stream)
        } else if (event.track) {
          // streams가 없지만 track이 있는 경우 (일부 브라우저)
          safeLog(`⚠️ streams가 없지만 track이 있습니다: ${userId}`, {
            trackKind: event.track.kind,
            trackId: event.track.id,
          })
          // track에서 stream 생성 (일부 브라우저에서 필요)
          const stream = new MediaStream([event.track])
          this.notifyRemoteStream(userId, stream)
        } else {
          safeWarn(`⚠️ Remote stream event에 streams와 track이 모두 없습니다: ${userId}`)
        }
      }
    
      // ontrack 이벤트가 발생하지 않는 경우를 디버깅하기 위한 로그
      safeLog(`🔧 ontrack 이벤트 리스너 설정 완료: ${userId}`, {
        connectionState: peerConnection.connectionState,
        iceConnectionState: peerConnection.iceConnectionState,
        localDescription: peerConnection.localDescription ? '설정됨' : '없음',
        remoteDescription: peerConnection.remoteDescription ? '설정됨' : '없음',
      })

      this.peerConnections.set(userId, peerConnection)
      return peerConnection
    } catch (error) {
      // 생성 실패 시 카운터는 유지 (재시도 가능)
      safeError(`❌ PeerConnection 생성 실패: ${userId}`, error)
      throw error
    }
  }

  /**
   * Offer 생성
   */
  async createOffer(userId: string): Promise<RTCSessionDescriptionInit> {
    const peerConnection = await this.createPeerConnection(userId)
    
    // 현재 상태 확인
    const signalingState = peerConnection.signalingState
    const hasLocalDescription = !!peerConnection.localDescription
    const hasRemoteDescription = !!peerConnection.remoteDescription
    
    safeLog(`🔍 Offer 생성 전 상태 확인: ${userId}`, {
      signalingState,
      hasLocalDescription,
      hasRemoteDescription,
      localDescriptionType: peerConnection.localDescription?.type,
      remoteDescriptionType: peerConnection.remoteDescription?.type,
    })
    
    // 이미 Offer가 있으면 재생성하지 않음
    if (hasLocalDescription && peerConnection.localDescription?.type === 'offer') {
      safeWarn(`⚠️ Offer가 이미 존재합니다: ${userId}`, {
        currentSignalingState: signalingState,
      })
      // 기존 Offer 반환
      return peerConnection.localDescription
    }
    
    // signalingState가 'stable' 또는 'have-local-offer'일 때만 Offer 생성 가능
    if (signalingState !== 'stable' && signalingState !== 'have-local-offer') {
      safeWarn(`⚠️ 잘못된 signaling state에서 Offer 생성 시도: ${userId}`, {
        currentState: signalingState,
        expectedStates: ['stable', 'have-local-offer'],
      })
      
      // 상태가 맞지 않으면 연결을 재생성
      if (signalingState === 'have-remote-offer' || signalingState === 'closed') {
        safeWarn(`   연결을 재생성합니다...`)
        await this.closeConnection(userId)
        return this.createOffer(userId)
      }
    }
    
    try {
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      })
      await peerConnection.setLocalDescription(offer)
      safeLog(`✅ Offer 생성 및 설정 완료: ${userId}`, {
        offerType: offer.type,
        hasSdp: !!offer.sdp,
        newSignalingState: peerConnection.signalingState,
      })
      return offer
    } catch (error) {
      safeError(`❌ Offer 생성 실패: ${userId}`, error)
      safeError(`   현재 상태:`, {
        signalingState: peerConnection.signalingState,
        iceConnectionState: peerConnection.iceConnectionState,
        connectionState: peerConnection.connectionState,
      })
      throw error
    }
  }

  /**
   * Answer 생성
   */
  async createAnswer(
    userId: string,
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    // 재시도 카운터 추가 (무한 재귀 방지)
    const answerKey = `answer_${userId}`
    const answerCount = (window as any)[answerKey] || 0
    if (answerCount >= 3) {
      safeError(`❌ Answer 생성 시도 횟수 초과: ${userId} (최대 3회)`)
      throw new Error(`Answer 생성 시도 횟수 초과: ${userId}`)
    }
    (window as any)[answerKey] = answerCount + 1
    
    try {
      const peerConnection = await this.createPeerConnection(userId)
      
      // 현재 상태 확인
      const signalingState = peerConnection.signalingState
      const hasRemoteDescription = !!peerConnection.remoteDescription
      const hasLocalDescription = !!peerConnection.localDescription
      
      if (typeof safeLog === 'function') {
      if (typeof safeLog === 'function') {
        safeLog(`🔍 Answer 생성 전 상태 확인: ${userId}`, {
          signalingState,
          hasRemoteDescription,
          hasLocalDescription,
          remoteDescriptionType: peerConnection.remoteDescription?.type,
          localDescriptionType: peerConnection.localDescription?.type,
        })
      } else {
        console.log(`🔍 Answer 생성 전 상태 확인: ${userId}`, {
          signalingState,
          hasRemoteDescription,
          hasLocalDescription,
          remoteDescriptionType: peerConnection.remoteDescription?.type,
          localDescriptionType: peerConnection.localDescription?.type,
        })
      }
      } else {
        console.log(`🔍 Answer 생성 전 상태 확인: ${userId}`, {
          signalingState,
          hasRemoteDescription,
          hasLocalDescription,
          remoteDescriptionType: peerConnection.remoteDescription?.type,
          localDescriptionType: peerConnection.localDescription?.type,
        })
      }
      
      // 이미 Answer가 있으면 재생성하지 않음
      if (hasLocalDescription && peerConnection.localDescription?.type === 'answer') {
        safeWarn(`⚠️ Answer가 이미 존재합니다: ${userId}`, {
          currentSignalingState: signalingState,
        })
        // 카운터 리셋 (성공적으로 처리됨)
        (window as any)[answerKey] = 0
        // 기존 Answer 반환
        return peerConnection.localDescription
      }
      
      // signalingState가 'have-remote-offer' 또는 'have-local-pranswer'일 때만 Answer 생성 가능
      // stable 상태이지만 description이 없는 경우는 연결을 재생성
      if (signalingState === 'stable' && !hasRemoteDescription && !hasLocalDescription) {
        safeWarn(`⚠️ stable 상태이지만 description이 없습니다. 연결을 재생성: ${userId}`)
        await this.closeConnection(userId)
        // 카운터 리셋 후 재시도
        const windowObj = window as any
        windowObj[answerKey] = 0
        // 새로운 PeerConnection 생성 후 Answer 생성 재시도
        const newPeerConnection = await this.createPeerConnection(userId)
        await newPeerConnection.setRemoteDescription(offer)
        const answer = await newPeerConnection.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        })
        await newPeerConnection.setLocalDescription(answer)
        windowObj[answerKey] = 0
        return answer
      }
      
      if (signalingState !== 'have-remote-offer' && signalingState !== 'have-local-pranswer') {
        safeWarn(`⚠️ 잘못된 signaling state에서 Answer 생성 시도: ${userId}`, {
          currentState: signalingState,
          expectedStates: ['have-remote-offer', 'have-local-pranswer'],
        })
        
        // 이미 Offer가 설정되어 있으면 그대로 사용
        const hasOffer = hasRemoteDescription && peerConnection.remoteDescription?.type === 'offer'
        const isInvalidState = signalingState === 'stable' || signalingState === 'closed'
        
        if (hasOffer) {
          if (typeof safeLog === 'function') {
            safeLog(`   이미 Offer가 설정되어 있습니다. Answer를 생성합니다...`)
          } else {
            console.log(`   이미 Offer가 설정되어 있습니다. Answer를 생성합니다...`)
          }
        } else if (isInvalidState) {
          // 상태가 맞지 않으면 에러를 throw (재귀 호출 제거)
          if (typeof safeError === 'function') {
            safeError(`   연결 상태가 올바르지 않습니다. 연결을 닫고 재시도하지 않습니다.`)
          } else {
            console.error(`   연결 상태가 올바르지 않습니다. 연결을 닫고 재시도하지 않습니다.`)
          }
          // 카운터 리셋
          (window as any)[answerKey] = 0
          // 연결 종료
          this.closeConnection(userId).catch(() => {
            // 연결 종료 실패는 무시
          })
          throw new Error(`Cannot create answer in state: ${signalingState}`)
        }
      }
      
      // Remote description 설정
      if (!hasRemoteDescription || peerConnection.remoteDescription?.type !== 'offer') {
        await peerConnection.setRemoteDescription(offer)
        if (typeof safeLog === 'function') {
          safeLog(`✅ Remote description 설정 완료: ${userId}`)
        } else {
          console.log(`✅ Remote description 설정 완료: ${userId}`)
        }
      } else {
        if (typeof safeLog === 'function') {
          safeLog(`✅ Remote description이 이미 설정되어 있습니다: ${userId}`)
        } else {
          console.log(`✅ Remote description이 이미 설정되어 있습니다: ${userId}`)
        }
      }
      
      // Answer 생성
      const answer = await peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      })
      
      // Local description 설정
      await peerConnection.setLocalDescription(answer)
      if (typeof safeLog === 'function') {
        safeLog(`✅ Answer 생성 및 설정 완료: ${userId}`, {
          answerType: answer.type,
          hasSdp: !!answer.sdp,
          newSignalingState: peerConnection.signalingState,
        })
      } else {
        console.log(`✅ Answer 생성 및 설정 완료: ${userId}`, {
          answerType: answer.type,
          hasSdp: !!answer.sdp,
          newSignalingState: peerConnection.signalingState,
        })
      }
      
      // 성공 시 카운터 리셋
      (window as any)[answerKey] = 0
      return answer
    } catch (error) {
      // 에러 발생 시 카운터는 유지 (재시도 허용)
      const peerConnection = this.peerConnections.get(userId)
      safeError(`❌ Answer 생성 실패: ${userId}`, error)
      if (peerConnection) {
        safeError(`   현재 상태:`, {
          signalingState: peerConnection.signalingState,
          iceConnectionState: peerConnection.iceConnectionState,
          connectionState: peerConnection.connectionState,
          hasRemoteDescription: !!peerConnection.remoteDescription,
          hasLocalDescription: !!peerConnection.localDescription,
        })
      }
      
      // PeerConnection 생성 실패 시 카운터 리셋 (더 이상 재시도하지 않음)
      if (error instanceof Error && error.message.includes('Cannot create so many PeerConnections')) {
        safeError(`   PeerConnection 생성 제한에 도달했습니다. 재시도를 중단합니다.`)
        (window as any)[answerKey] = 0
      }
      
      throw error
    }
  }

  /**
   * Answer 처리
   */
  async handleAnswer(
    userId: string,
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    safeLog(`📥 WebRTC Answer 처리 시작: ${userId}`, {
      answerType: answer.type,
      hasSdp: !!answer.sdp,
      hasPeerConnection: this.peerConnections.has(userId),
    })
    
    const peerConnection = this.peerConnections.get(userId)
    if (!peerConnection) {
      safeError(`❌ PeerConnection not found for user: ${userId}`)
      safeError(`   현재 PeerConnection 목록:`, Array.from(this.peerConnections.keys()))
      throw new Error(`PeerConnection not found for user: ${userId}`)
    }
    
    // WebRTC 상태 확인
    const signalingState = peerConnection.signalingState
    const remoteDescription = peerConnection.remoteDescription
    
    safeLog(`🔍 WebRTC 상태 확인: ${userId}`, {
      signalingState,
      hasRemoteDescription: !!remoteDescription,
      remoteDescriptionType: remoteDescription?.type,
      iceConnectionState: peerConnection.iceConnectionState,
      connectionState: peerConnection.connectionState,
    })
    
    // 이미 Answer가 설정되어 있으면 스킵
    if (remoteDescription && remoteDescription.type === 'answer') {
      safeWarn(`⚠️ Answer가 이미 설정되어 있습니다: ${userId}`, {
        currentSignalingState: signalingState,
      })
      return
    }
    
    // stable 상태이고 이미 local description이 있으면 이미 완료된 것으로 간주
    if (signalingState === 'stable' && peerConnection.localDescription) {
      safeWarn(`⚠️ 이미 연결이 완료된 상태입니다: ${userId}`, {
        localDescriptionType: peerConnection.localDescription.type,
        signalingState,
      })
      return
    }
    
    // signalingState가 'have-local-offer'일 때만 Answer 설정 가능
    if (signalingState !== 'have-local-offer') {
      safeWarn(`⚠️ 잘못된 signaling state에서 Answer 설정 시도: ${userId}`, {
        currentState: signalingState,
        expectedState: 'have-local-offer',
      })
      
      // 상태가 맞지 않으면 에러 throw (재시도하지 않음)
      if (signalingState === 'have-remote-offer') {
        safeWarn(`   Answer를 설정할 수 없습니다. Offer를 먼저 처리해야 합니다.`)
        throw new Error(`Cannot set answer in state: ${signalingState}`)
      } else if (signalingState === 'stable') {
        // stable 상태면 이미 완료된 것으로 간주
        safeLog(`   연결이 이미 완료된 상태입니다. 스킵합니다.`)
        return
      } else {
        throw new Error(`Cannot set answer in state: ${signalingState}`)
      }
    }
    
    try {
      await peerConnection.setRemoteDescription(answer)
      safeLog(`✅ Remote description 설정 완료: ${userId}`)
      safeLog(`   ICE connection state: ${peerConnection.iceConnectionState}`)
      safeLog(`   Connection state: ${peerConnection.connectionState}`)
      safeLog(`   Signaling state: ${peerConnection.signalingState}`)
    } catch (error) {
      safeError(`❌ Error setting remote description for ${userId}:`, error)
      safeError(`   현재 상태:`, {
        signalingState: peerConnection.signalingState,
        iceConnectionState: peerConnection.iceConnectionState,
        connectionState: peerConnection.connectionState,
        hasLocalDescription: !!peerConnection.localDescription,
        hasRemoteDescription: !!peerConnection.remoteDescription,
      })
      throw error
    }
  }

  /**
   * ICE candidate 추가
   */
  async addIceCandidate(
    userId: string,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    const peerConnection = this.peerConnections.get(userId)
    if (!peerConnection) {
      safeWarn(`⚠️ PeerConnection not found for user: ${userId}, ICE candidate 무시`)
      // PeerConnection이 없으면 새로 생성하지 않고 무시 (무한 루프 방지)
      return
    }

    // 연결이 닫힌 상태면 무시
    if (
      peerConnection.connectionState === 'closed' ||
      peerConnection.iceConnectionState === 'closed'
    ) {
      safeWarn(`⚠️ PeerConnection이 닫힌 상태입니다. ICE candidate 무시: ${userId}`)
      return
    }

    // Remote description이 설정되지 않았으면 무시
    if (!peerConnection.remoteDescription) {
      safeWarn(`⚠️ Remote description이 설정되지 않았습니다. ICE candidate를 큐에 저장: ${userId}`)
      // Remote description이 설정될 때까지 대기하는 대신 무시 (나중에 다시 시도할 수 있도록)
      return
    }

    try {
      await peerConnection.addIceCandidate(candidate)
      safeLog(`✅ ICE candidate 추가 완료: ${userId}`)
    } catch (error) {
      safeError(`Failed to add ICE candidate for ${userId}:`, error)
      // 에러가 발생해도 연결은 계속 진행될 수 있으므로 무시
    }
  }

  /**
   * 연결 종료
   */
  async closeConnection(userId: string): Promise<void> {
    const peerConnection = this.peerConnections.get(userId)
    if (peerConnection) {
      try {
        // 모든 트랙 정지
        peerConnection.getSenders().forEach(sender => {
          if (sender.track) {
            sender.track.stop()
          }
        })
        
        // 연결 종료
        peerConnection.close()
      } catch (error) {
        safeWarn(`연결 종료 중 에러 (무시): ${userId}`, error)
      }
      
      this.peerConnections.delete(userId)
      this.notifyRemoteStream(userId, null)
      
      // 생성 카운터도 리셋
      const createKey = `create_${userId}`
      if ((window as any)[createKey]) {
        (window as any)[createKey] = 0
      }
      
      safeLog(`✅ Connection closed for user: ${userId}`)
    }
  }

  /**
   * 모든 연결 종료
   */
  async closeAllConnections(): Promise<void> {
    const userIds = Array.from(this.peerConnections.keys())
    await Promise.all(userIds.map((userId) => this.closeConnection(userId)))
  }

  /**
   * PeerConnection 가져오기
   */
  getPeerConnection(userId: string): RTCPeerConnection | undefined {
    return this.peerConnections.get(userId)
  }

  /**
   * 모든 PeerConnection 가져오기
   */
  getAllPeerConnections(): Map<string, RTCPeerConnection> {
    return new Map(this.peerConnections)
  }

  /**
   * 연결 상태 변경 콜백 등록
   */
  onConnectionStateChange(callback: ConnectionStateChangeCallback): () => void {
    this.connectionStateCallbacks.add(callback)
    return () => {
      this.connectionStateCallbacks.delete(callback)
    }
  }

  /**
   * Remote stream 콜백 등록
   */
  onRemoteStream(callback: RemoteStreamCallback): () => void {
    this.remoteStreamCallbacks.add(callback)
    return () => {
      this.remoteStreamCallbacks.delete(callback)
    }
  }

  /**
   * 연결 상태 변경 알림
   */
  private notifyConnectionStateChange(
    userId: string,
    state: PeerConnectionState
  ): void {
    this.connectionStateCallbacks.forEach((callback) => {
      try {
        callback(userId, state)
      } catch (error) {
        safeError('Error in connection state callback:', error)
      }
    })
  }

  /**
   * Remote stream 알림
   */
  private notifyRemoteStream(
    userId: string,
    stream: MediaStream | null
  ): void {
    this.remoteStreamCallbacks.forEach((callback) => {
      try {
        callback(userId, stream)
      } catch (error) {
        safeError('Error in remote stream callback:', error)
      }
    })
  }

  /**
   * ICE candidate 가져오기 (외부에서 사용)
   */
  getIceCandidates(userId: string): Promise<RTCIceCandidate[]> {
    return new Promise((resolve) => {
      const peerConnection = this.peerConnections.get(userId)
      if (!peerConnection) {
        resolve([])
        return
      }

      const candidates: RTCIceCandidate[] = []
      const originalOnIceCandidate = peerConnection.onicecandidate

      peerConnection.onicecandidate = (event) => {
        if (originalOnIceCandidate) {
          originalOnIceCandidate(event)
        }
        if (event.candidate) {
          candidates.push(event.candidate)
        } else {
          // ICE gathering 완료
          peerConnection.onicecandidate = originalOnIceCandidate
          resolve(candidates)
        }
      }

      // 이미 완료된 경우
      if (peerConnection.iceGatheringState === 'complete') {
        resolve(candidates)
      }
    })
  }
}

export const webrtcService = new WebRTCService()

