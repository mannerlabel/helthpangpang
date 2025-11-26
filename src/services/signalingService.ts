/**
 * Signaling 서비스
 * Supabase Realtime을 사용하여 WebRTC Signaling 메시지를 교환합니다.
 */

import { supabase } from './supabaseClient'
import { webrtcService } from './webrtcService'
import { authService } from './authService'

export type SignalingMessageType =
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'user-joined'
  | 'user-left'

export interface SignalingMessage {
  type: SignalingMessageType
  from: string // 사용자 ID
  to?: string // 특정 사용자에게만 전송할 경우
  data: any
  timestamp: number
}

export type SignalingMessageCallback = (message: SignalingMessage) => void

class SignalingService {
  private channels: Map<string, any> = new Map() // crewId -> channel
  private channelToCrewId: Map<string, string> = new Map() // channel name -> crewId
  private messageCallbacks: Set<SignalingMessageCallback> = new Set()
  private currentUserId: string | null = null // localStorage ID 또는 UUID
  private currentUserUuid: string | null = null // Supabase UUID (항상 UUID 형식)

  constructor() {
    // 현재 사용자 ID 가져오기
    const user = authService.getCurrentUser()
    if (user) {
      this.currentUserId = user.id
      // UUID 형식이면 currentUserUuid에도 저장
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (uuidRegex.test(user.id)) {
        this.currentUserUuid = user.id
      }
    }
  }

  /**
   * 크루 채널 구독
   */
  async subscribe(crewId: string): Promise<void> {
    if (!supabase) {
      const error = 'Supabase client not initialized'
      console.error(`❌ ${error}`)
      console.error('   💡 .env 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해주세요.')
      throw new Error(error)
    }
    
    // Supabase Realtime 연결 상태 확인 (채널 구독 시 자동으로 연결됨)
    try {
      const socket = (supabase.realtime as any).socket
      if (socket) {
        const realtimeState = socket.readyState
        console.log('🔍 Supabase Realtime 연결 상태:', 
          realtimeState === WebSocket.OPEN ? '연결됨' : 
          realtimeState === WebSocket.CONNECTING ? '연결 중' : 
          realtimeState === WebSocket.CLOSED ? '연결 안 됨' : 
          '알 수 없음'
        )
      } else {
        console.log('🔍 Supabase Realtime 소켓이 아직 초기화되지 않았습니다. (채널 구독 시 자동으로 연결됩니다)')
      }
    } catch (error) {
      console.log('🔍 Supabase Realtime 연결 상태 확인 실패 (채널 구독 시 자동으로 연결됩니다):', error)
    }

    // crewId 유효성 검사
    if (!crewId || typeof crewId !== 'string') {
      throw new Error(`Invalid crewId: ${crewId}`)
    }

    // 이미 구독 중이면 무시
    if (this.channels.has(crewId)) {
      console.log(`Already subscribed to crew: ${crewId}`)
      return
    }

    // 채널 이름 생성 (특수 문자 제거, 길이 제한)
    const sanitizedCrewId = crewId.replace(/[^a-zA-Z0-9_-]/g, '_')
    const channelName = `crew_${sanitizedCrewId}_signaling`
    
    // 채널 이름 길이 제한 (Supabase 제한: 최대 200자)
    if (channelName.length > 200) {
      throw new Error(`Channel name too long: ${channelName.length} characters (max 200)`)
    }

    console.log(`Attempting to subscribe to channel: ${channelName} (crewId: ${crewId})`)
    
    // Supabase Realtime 채널 생성
    // 참고: public 채널은 별도 설정 없이 사용 가능
    const channel = supabase.channel(channelName, {
      config: {
        // 채널 설정 (필요 시)
      }
    })

    // 메시지 수신
    channel.on('broadcast', { event: 'signaling' }, (payload) => {
      this.handleMessage(channelName, payload.payload as SignalingMessage)
    })
    
    // 채널 상태 변화 이벤트 (디버깅용)
    channel.on('system', {}, (payload) => {
      console.log(`채널 시스템 이벤트: ${channelName}`, payload)
    })

    // Presence 이벤트는 일단 제거 (채널이 닫히는 문제 해결을 위해)
    // 필요하면 나중에 다시 추가
    // channel.on('presence', { event: 'sync' }, () => {
    //   const state = channel.presenceState()
    //   console.log('Presence state:', state)
    // })

    // channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
    //   console.log('User joined:', key, newPresences)
    //   this.sendMessage(crewId, {
    //     type: 'user-joined',
    //     from: this.currentUserId || 'unknown',
    //     data: { userId: key },
    //     timestamp: Date.now(),
    //   })
    // })

    // channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    //   console.log('User left:', key, leftPresences)
    //   this.sendMessage(crewId, {
    //     type: 'user-left',
    //     from: this.currentUserId || 'unknown',
    //     data: { userId: key },
    //     timestamp: Date.now(),
    //   })
    // })

    // 채널 구독 (Promise 기반으로 래핑)
    return new Promise<void>((resolve, reject) => {
      let isResolved = false
      let isRejected = false
      let stateCheckInterval: NodeJS.Timeout | null = null
      let timeoutId: NodeJS.Timeout | null = null
      
      // 정리 함수
      const cleanup = () => {
        if (stateCheckInterval) {
          clearInterval(stateCheckInterval)
          stateCheckInterval = null
        }
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
      }
      
      // subscribe()는 콜백만 받고 Promise를 반환하지 않을 수 있음
      // 채널 상태 변경 이벤트 리스너 추가 (CLOSED 상태 감지)
      channel.on('close', () => {
        console.warn(`Channel closed: ${channelName}`)
        // cleanup 과정에서 닫히는 것은 정상이므로 에러로 처리하지 않음
        // 하지만 구독 시도 중에 닫히는 경우는 문제
        if (!isResolved && !isRejected && !this.channels.has(crewId)) {
          // 아직 채널이 등록되지 않았고, 구독이 완료되지 않았다면 구독 실패
          isRejected = true
          cleanup()
          reject(new Error(`Channel closed before subscription: ${channelName}`))
        }
      })

      // 채널 구독 (제미나이 분석에 따른 올바른 패턴)
      // subscribe() 메서드의 콜백에서 연결 상태를 확인합니다
      console.log(`📡 channel.subscribe() 호출 전: ${channelName}`, {
        channelExists: !!channel,
        channelState: (channel as any)?.state || 'unknown',
        supabaseRealtime: !!supabase?.realtime,
      })
      
      let subscribeResult: any = null
      
      try {
        console.log(`📡 channel.subscribe() 호출 직전: ${channelName}`, {
          channelType: channel.constructor.name,
          channelState: (channel as any)?.state || 'unknown',
        })
        
        subscribeResult = channel.subscribe((status, err) => {
          console.log(`📡 채널 구독 상태 변화: ${channelName}`, { 
            status, 
            err: err ? err.message : null,
            timestamp: new Date().toISOString(),
          })
        
          if (err) {
            console.error(`❌ Channel subscription error: ${channelName}`, err)
            if (!isResolved && !isRejected) {
              isRejected = true
              reject(new Error(`Channel subscription error: ${channelName} - ${err.message || String(err)}`))
            }
            return
          }

          // 구독 상태 확인 (SUBSCRIBED, TIMED_OUT, CLOSED, CHANNEL_ERROR)
          if (status === 'SUBSCRIBED') {
            // ✅ 채널이 성공적으로 열리고 구독되었습니다
            if (isResolved || isRejected) return // 이미 처리됨
            isResolved = true
            this.channels.set(crewId, channel)
            this.channelToCrewId.set(channelName, crewId)
            console.log(`✅ 채널 구독 성공: ${channelName} (crewId: ${crewId})`)
            console.log('   이제부터 실시간 데이터 수신 및 송신이 가능합니다.')
            
            // 주기적 상태 확인 및 타임아웃 중단
            cleanup()
            
            // Presence는 일단 사용하지 않음 (채널이 닫히는 문제 해결을 위해)
            // 필요하면 나중에 다시 추가
            resolve()
          } else if (status === 'TIMED_OUT') {
            if (isResolved || isRejected) return // 이미 처리됨
            isRejected = true
            const errorMessage = `Channel subscription timed out: ${channelName}. Check your network connection and Supabase Realtime settings.`
            console.error(errorMessage)
            reject(new Error(errorMessage))
          } else if (status === 'CHANNEL_ERROR') {
            if (isResolved || isRejected) return // 이미 처리됨
            isRejected = true
            const errorMessage = `Channel error: ${channelName}. Check Supabase Realtime configuration.`
            console.error(errorMessage)
            reject(new Error(errorMessage))
          } else if (status === 'CLOSED') {
            // CLOSED 상태는 구독 실패를 의미
            if (isResolved || isRejected) return // 이미 처리됨
            isRejected = true
            const errorMessage = `Channel closed during subscription: ${channelName}`
            console.warn(errorMessage)
            console.warn('This may indicate:')
            console.warn('1. Supabase Realtime is not enabled')
            console.warn('2. Network connection issue')
            console.warn('3. Supabase project settings issue')
            reject(new Error(errorMessage)) // 에러를 던져서 재시도 로직이 작동하도록 함
          } else {
            // 기타 상태는 일단 성공으로 처리 (SUBSCRIBED가 아닐 수 있음)
            console.warn(`Unexpected subscription status: ${status} for channel: ${channelName}`)
            // 일부 경우 SUBSCRIBED가 아닌 상태로도 작동할 수 있음
            this.channels.set(crewId, channel)
            this.channelToCrewId.set(channelName, crewId)
            resolve()
          }
        })
        
        console.log(`📡 channel.subscribe() 호출 후: ${channelName}`, {
          subscribeResult: subscribeResult,
          channelState: (channel as any)?.state || 'unknown',
        })
        
        // 채널 상태 확인 함수 (콜백이 호출되지 않는 경우를 대비)
        const checkChannelState = () => {
          if (isResolved || isRejected) {
            cleanup()
            return
          }
          
          const currentState = (channel as any)?.state || 'unknown'
          console.log(`🔍 채널 상태 확인: ${channelName} - ${currentState}`)
          
          if (currentState === 'joined') {
            console.log(`✅ 채널이 'joined' 상태로 변경됨: ${channelName}`)
            isResolved = true
            this.channels.set(crewId, channel)
            this.channelToCrewId.set(channelName, crewId)
            cleanup()
            resolve()
          } else if (currentState === 'closed' || currentState === 'errored' || currentState === 'timed_out') {
            console.warn(`⚠️ 채널이 ${currentState} 상태로 변경됨: ${channelName}`)
            isRejected = true
            cleanup()
            reject(new Error(`Channel ${currentState}: ${channelName}`))
          }
        }
        
        // 즉시 한 번 확인
        checkChannelState()
        
        // 채널 상태를 주기적으로 확인하여 'joined' 상태가 되면 성공으로 처리
        stateCheckInterval = setInterval(checkChannelState, 500) // 0.5초마다 상태 확인
        
        // 타임아웃 추가: 10초 내에 구독이 완료되지 않으면 실패로 간주
        timeoutId = setTimeout(() => {
          cleanup()
          if (!isResolved && !isRejected) {
            const currentState = (channel as any)?.state || 'unknown'
            console.warn(`⚠️ 채널 구독 타임아웃: ${channelName} (10초 내에 구독 완료되지 않음)`)
            console.warn(`   현재 채널 상태: ${currentState}`)
            isRejected = true
            reject(new Error(`Channel subscription timeout: ${channelName} - No status callback received within 10 seconds (state: ${currentState})`))
          }
        }, 10000) // 10초 타임아웃
        
      } catch (subscribeError) {
        console.error(`❌ channel.subscribe() 호출 중 에러: ${channelName}`, subscribeError)
        if (!isResolved && !isRejected) {
          isRejected = true
          reject(new Error(`Channel subscription call failed: ${channelName} - ${subscribeError instanceof Error ? subscribeError.message : String(subscribeError)}`))
        }
      }

      // subscribe()가 Promise를 반환하는 경우를 대비
      if (subscribeResult && typeof subscribeResult.catch === 'function') {
        subscribeResult.catch((error) => {
          console.error(`Error subscribing to channel ${channelName}:`, error)
          if (!isResolved && !isRejected) {
            isRejected = true
            reject(error)
          }
        })
      }
    })
  }

  /**
   * 크루 채널 구독 해제
   */
  async unsubscribe(crewId: string): Promise<void> {
    const channel = this.channels.get(crewId)
    if (channel) {
      try {
        await channel.unsubscribe()
        this.channels.delete(crewId)
        const channelName = `crew_${crewId}_signaling`
        this.channelToCrewId.delete(channelName)
        console.log(`Unsubscribed from crew: ${crewId}`)
      } catch (error) {
        console.warn(`Error unsubscribing from crew ${crewId}:`, error)
        // 구독 해제 실패해도 채널 목록에서 제거
        this.channels.delete(crewId)
        const channelName = `crew_${crewId}_signaling`
        this.channelToCrewId.delete(channelName)
      }
    }
  }

  /**
   * 모든 채널 구독 해제
   */
  async unsubscribeAll(): Promise<void> {
    const crewIds = Array.from(this.channels.keys())
    await Promise.all(crewIds.map((crewId) => this.unsubscribe(crewId)))
  }

  /**
   * 채널 구독 상태 확인
   */
  isSubscribed(crewId: string): boolean {
    const channel = this.channels.get(crewId)
    if (!channel) {
      console.log(`채널 구독 상태 확인: ${crewId} - 채널 없음`)
      return false
    }
    
    // 채널의 실제 상태 확인
    try {
      // Supabase Realtime 채널의 상태 확인
      // channel.state는 'joined', 'closed', 'errored', 'timed_out' 등의 값을 가질 수 있음
      const state = (channel as any).state || 'unknown'
      console.log(`채널 구독 상태 확인: ${crewId} - 상태: ${state}`)
      
      // 채널이 닫혔거나 오류 상태인 경우 재구독 시도
      if (state === 'closed' || state === 'errored' || state === 'timed_out') {
        console.warn(`⚠️ 채널이 ${state} 상태입니다. 재구독이 필요할 수 있습니다.`)
        // 채널을 맵에서 제거하여 재구독 가능하도록 함
        this.channels.delete(crewId)
        const channelName = `crew_${crewId}_signaling`
        this.channelToCrewId.delete(channelName)
        return false
      }
      
      // 'joined' 상태이거나 다른 정상 상태인 경우 구독된 것으로 간주
      // 참고: Supabase Realtime 채널은 'joined' 상태가 구독 완료를 의미
      if (state === 'joined' || state === 'SUBSCRIBED') {
        return true
      }
      
      // 상태가 'unknown'이거나 다른 값인 경우, 채널이 존재하면 구독된 것으로 간주
      // (일부 경우 상태가 명확하지 않을 수 있음)
      console.log(`채널 구독 상태 확인: ${crewId} - 상태가 명확하지 않지만 채널 존재, 구독된 것으로 간주 (${state})`)
      return true
    } catch (error) {
      // 상태 확인 실패 시 채널이 존재하면 구독된 것으로 간주
      console.log(`채널 구독 상태 확인: ${crewId} - 상태 확인 실패, 채널 존재하므로 구독된 것으로 간주`, error)
      return true
    }
  }

  /**
   * Signaling 메시지 전송
   */
  async sendMessage(crewId: string, message: SignalingMessage): Promise<void> {
    const channel = this.channels.get(crewId)
    if (!channel) {
      console.warn(`Cannot send message: Not subscribed to crew: ${crewId}`)
      // 채널이 구독되지 않은 경우 조용히 실패 (에러를 던지지 않음)
      return
    }

    try {
      const status = await channel.send({
        type: 'broadcast',
        event: 'signaling',
        payload: message,
      })

      if (status !== 'ok') {
        console.warn(`Failed to send message to crew ${crewId}:`, status)
      }
    } catch (error) {
      console.warn(`Error sending message to crew ${crewId}:`, error)
      // 메시지 전송 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
  }

  /**
   * Offer 전송
   */
  async sendOffer(
    crewId: string,
    toUserId: string,
    offer: RTCSessionDescriptionInit
  ): Promise<void> {
    // UUID가 있으면 UUID를 사용, 없으면 localStorage ID 사용
    const fromUserId = this.currentUserUuid || this.currentUserId || 'unknown'
    console.log(`📤 Offer 전송: ${fromUserId} -> ${toUserId}`)
    await this.sendMessage(crewId, {
      type: 'offer',
      from: fromUserId,
      to: toUserId,
      data: { offer },
      timestamp: Date.now(),
    })
  }

  /**
   * Answer 전송
   */
  async sendAnswer(
    crewId: string,
    toUserId: string,
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    // UUID가 있으면 UUID를 사용, 없으면 localStorage ID 사용
    const fromUserId = this.currentUserUuid || this.currentUserId || 'unknown'
    console.log(`📤 Answer 전송: ${fromUserId} -> ${toUserId}`)
    await this.sendMessage(crewId, {
      type: 'answer',
      from: fromUserId,
      to: toUserId,
      data: { answer },
      timestamp: Date.now(),
    })
  }

  /**
   * ICE candidate 전송
   */
  async sendIceCandidate(
    crewId: string,
    toUserId: string,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    // UUID가 있으면 UUID를 사용, 없으면 localStorage ID 사용
    const fromUserId = this.currentUserUuid || this.currentUserId || 'unknown'
    await this.sendMessage(crewId, {
      type: 'ice-candidate',
      from: fromUserId,
      to: toUserId,
      data: { candidate },
      timestamp: Date.now(),
    })
  }

  /**
   * 메시지 수신 처리
   */
  private async handleMessage(
    channelName: string,
    message: SignalingMessage
  ): Promise<void> {
    // 채널 이름에서 crewId 추출
    const crewId = this.channelToCrewId.get(channelName) || channelName.replace('crew_', '').replace('_signaling', '')
    // 내가 보낸 메시지는 무시 (UUID와 localStorage ID 모두 비교)
    if (this.isFromCurrentUser(message.from)) {
      console.log(`메시지 무시 (자신이 보낸 메시지): ${message.from}`, message.type)
      return
    }

    // 특정 사용자에게만 전송된 메시지인 경우 확인 (UUID와 localStorage ID 모두 비교)
    if (message.to && !this.isToCurrentUser(message.to)) {
      console.log(`메시지 무시 (다른 사용자에게 전송된 메시지): ${message.to}`, message.type)
      return
    }

    console.log(`📨 Received signaling message from ${message.from}:`, {
      type: message.type,
      crewId,
      channelName,
      hasCrewId: !!crewId,
    })

    try {
      switch (message.type) {
        case 'offer':
          console.log(`📥 Offer 수신 처리 시작: ${message.from}`, { crewId, channelName })
          await this.handleOffer(message.from, message.data.offer, crewId)
          break
        case 'answer':
          console.log(`📥 Answer 수신 처리 시작: ${message.from}`)
          await this.handleAnswer(message.from, message.data.answer)
          break
        case 'ice-candidate':
          console.log(`📥 ICE candidate 수신 처리 시작: ${message.from}`)
          await this.handleIceCandidate(message.from, message.data.candidate)
          break
        case 'user-joined':
          // 사용자 입장 처리 (외부에서 처리)
          this.notifyMessageCallbacks(message)
          break
        case 'user-left':
          // 사용자 퇴장 처리
          await webrtcService.closeConnection(message.data.userId)
          this.notifyMessageCallbacks(message)
          break
        default:
          console.warn('Unknown message type:', message.type)
      }
    } catch (error) {
      console.error('Error handling signaling message:', error)
    }

    // 콜백 호출
    this.notifyMessageCallbacks(message)
  }

  /**
   * Offer 처리
   */
  private async handleOffer(
    fromUserId: string,
    offer: RTCSessionDescriptionInit,
    crewId?: string
  ): Promise<void> {
    console.log(`📥 Handling offer from ${fromUserId}`, { crewId })
    try {
      const answer = await webrtcService.createAnswer(fromUserId, offer)
      console.log(`✅ Answer 생성 완료: ${fromUserId}`, answer.type)
      
      // Answer 전송을 위해 crewId가 필요함
      // crewId가 제공되지 않으면 첫 번째 구독 중인 채널 사용
      let targetCrewId = crewId
      if (!targetCrewId && this.channels.size > 0) {
        // 첫 번째 구독 중인 채널의 crewId 사용
        targetCrewId = Array.from(this.channels.keys())[0]
        console.log(`⚠️ crewId가 제공되지 않아 첫 번째 채널 사용: ${targetCrewId}`)
      }
      
      if (targetCrewId) {
        await this.sendAnswer(targetCrewId, fromUserId, answer)
        console.log(`✅ Answer 전송 완료: ${fromUserId} -> ${targetCrewId}`)
      } else {
        console.warn(`⚠️ crewId를 찾을 수 없어 Answer를 전송할 수 없습니다: ${fromUserId}`)
        // crewId를 찾을 수 없으면 콜백으로 처리
        this.notifyMessageCallbacks({
          type: 'answer',
          from: fromUserId,
          data: { answer, needsResponse: true },
          timestamp: Date.now(),
        })
      }

      // ICE candidate 수집 및 전송
      const peerConnection = webrtcService.getPeerConnection(fromUserId)
      if (peerConnection) {
        peerConnection.onicecandidate = async (event) => {
          if (event.candidate && targetCrewId) {
            await this.sendIceCandidate(targetCrewId, fromUserId, event.candidate)
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error handling offer from ${fromUserId}:`, error)
    }
  }


  /**
   * Answer 처리
   */
  private async handleAnswer(
    fromUserId: string,
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    console.log(`📥 Handling answer from ${fromUserId}`, {
      answerType: answer.type,
      hasSdp: !!answer.sdp,
    })
    try {
      await webrtcService.handleAnswer(fromUserId, answer)
      console.log(`✅ Answer 처리 완료: ${fromUserId}`)
    } catch (error) {
      console.error(`❌ Error handling answer from ${fromUserId}:`, error)
    }
  }

  /**
   * ICE candidate 처리
   */
  private async handleIceCandidate(
    fromUserId: string,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    console.log(`Handling ICE candidate from ${fromUserId}`)
    try {
      await webrtcService.addIceCandidate(fromUserId, candidate)
    } catch (error) {
      console.error(`Error handling ICE candidate from ${fromUserId}:`, error)
    }
  }

  /**
   * 메시지 콜백 등록
   */
  onMessage(callback: SignalingMessageCallback): () => void {
    this.messageCallbacks.add(callback)
    return () => {
      this.messageCallbacks.delete(callback)
    }
  }

  /**
   * 메시지 콜백 알림
   */
  private notifyMessageCallbacks(message: SignalingMessage): void {
    this.messageCallbacks.forEach((callback) => {
      try {
        callback(message)
      } catch (error) {
        console.error('Error in message callback:', error)
      }
    })
  }

  /**
   * 현재 사용자 ID 업데이트
   */
  updateCurrentUserId(userId: string, uuid?: string): void {
    this.currentUserId = userId
    if (uuid) {
      this.currentUserUuid = uuid
    } else {
      // UUID 형식이면 currentUserUuid에도 저장
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (uuidRegex.test(userId)) {
        this.currentUserUuid = userId
      }
    }
  }

  /**
   * 메시지가 현재 사용자로부터 온 것인지 확인 (UUID와 localStorage ID 모두 비교)
   */
  private isFromCurrentUser(fromUserId: string): boolean {
    if (!fromUserId) return false
    if (fromUserId === this.currentUserId) return true
    if (this.currentUserUuid && fromUserId === this.currentUserUuid) return true
    return false
  }

  /**
   * 메시지가 현재 사용자에게 전송된 것인지 확인 (UUID와 localStorage ID 모두 비교)
   */
  private isToCurrentUser(toUserId: string): boolean {
    if (!toUserId) return true // to가 없으면 모든 사용자에게 전송
    if (toUserId === this.currentUserId) return true
    if (this.currentUserUuid && toUserId === this.currentUserUuid) return true
    return false
  }
}

export const signalingService = new SignalingService()

