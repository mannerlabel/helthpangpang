# WebRTC 스트리밍 구현 가이드

현재 CrewMeetingView에서는 참여자들의 영상이 표시되지 않습니다. 실제 WebRTC를 구현하려면 다음 단계를 따라야 합니다.

## 1. WebRTC 기본 구조

WebRTC는 Peer-to-Peer 통신을 위해 다음이 필요합니다:
- **Signaling Server**: 피어 간 연결을 위한 정보 교환 (WebSocket 사용)
- **STUN/TURN Server**: NAT 통과를 위한 서버
- **MediaStream**: 사용자의 카메라/마이크 스트림

## 2. 구현 방법

### 옵션 1: 직접 구현 (복잡함)

```typescript
// WebRTC 서비스 생성
class WebRTCService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map()
  private localStream: MediaStream | null = null
  private signalingSocket: WebSocket | null = null

  async initialize(crewId: string, userId: string) {
    // 1. 로컬 스트림 가져오기
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    })

    // 2. Signaling 서버 연결 (WebSocket)
    this.signalingSocket = new WebSocket(`ws://your-signaling-server.com/crew/${crewId}`)
    
    this.signalingSocket.onmessage = (event) => {
      const message = JSON.parse(event.data)
      this.handleSignalingMessage(message, userId)
    }

    // 3. 다른 참여자들에게 자신의 스트림 공유
    this.broadcastLocalStream(userId)
  }

  private async handleSignalingMessage(message: any, userId: string) {
    switch (message.type) {
      case 'offer':
        await this.handleOffer(message, userId)
        break
      case 'answer':
        await this.handleAnswer(message, userId)
        break
      case 'ice-candidate':
        await this.handleIceCandidate(message, userId)
        break
    }
  }

  // Peer Connection 생성 및 Offer 전송
  private async createPeerConnection(targetUserId: string) {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // TURN 서버도 필요 (프로덕션 환경)
      ]
    })

    // 로컬 스트림 추가
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!)
      })
    }

    // 원격 스트림 수신
    pc.ontrack = (event) => {
      // 이벤트를 컴포넌트로 전달하여 비디오 요소에 연결
      this.onRemoteStream(targetUserId, event.streams[0])
    }

    // ICE Candidate 처리
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingSocket?.send(JSON.stringify({
          type: 'ice-candidate',
          targetUserId,
          candidate: event.candidate
        }))
      }
    }

    this.peerConnections.set(targetUserId, pc)
    return pc
  }

  private async handleOffer(message: any, userId: string) {
    const pc = await this.createPeerConnection(message.fromUserId)
    await pc.setRemoteDescription(new RTCSessionDescription(message.offer))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    this.signalingSocket?.send(JSON.stringify({
      type: 'answer',
      targetUserId: message.fromUserId,
      answer
    }))
  }

  private async handleAnswer(message: any, userId: string) {
    const pc = this.peerConnections.get(message.fromUserId)
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(message.answer))
    }
  }

  private async handleIceCandidate(message: any, userId: string) {
    const pc = this.peerConnections.get(message.fromUserId)
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(message.candidate))
    }
  }
}
```

### 옵션 2: 라이브러리 사용 (권장)

#### A. Simple-Peer (가장 간단)
```bash
npm install simple-peer
```

```typescript
import Peer from 'simple-peer'

const peer = new Peer({
  initiator: true,
  trickle: false,
  stream: localStream
})

peer.on('signal', (data) => {
  // Signaling 서버를 통해 다른 피어에게 전송
  signalingSocket.send(JSON.stringify(data))
})

peer.on('stream', (stream) => {
  // 원격 스트림을 비디오 요소에 연결
  videoRef.current.srcObject = stream
})
```

#### B. Socket.io + Simple-Peer
```bash
npm install socket.io-client simple-peer
```

#### C. Agora SDK (상용 솔루션, 가장 안정적)
```bash
npm install agora-rtc-sdk-ng
```

## 3. Signaling Server 구현

WebSocket 서버가 필요합니다 (Node.js 예시):

```javascript
const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 8080 })

const rooms = new Map()

wss.on('connection', (ws, req) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message)
    const { type, crewId, userId, targetUserId } = data

    if (!rooms.has(crewId)) {
      rooms.set(crewId, new Map())
    }
    const room = rooms.get(crewId)
    room.set(userId, ws)

    // 다른 참여자들에게 브로드캐스트
    room.forEach((client, id) => {
      if (id !== userId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          ...data,
          fromUserId: userId
        }))
      }
    })
  })

  ws.on('close', () => {
    // 연결 종료 처리
  })
})
```

## 4. CrewMeetingView에 통합

```typescript
// CrewMeetingView.tsx
useEffect(() => {
  if (mode === 'crew' && crewId && myVideoEnabled) {
    const webrtc = new WebRTCService()
    webrtc.initialize(crewId, user.id)
    
    webrtc.onRemoteStream = (userId, stream) => {
      // 해당 사용자의 비디오 요소에 스트림 연결
      const videoElement = participantVideoRefs.current.get(userId)
      if (videoElement) {
        videoElement.srcObject = stream
      }
    }

    return () => {
      webrtc.cleanup()
    }
  }
}, [crewId, myVideoEnabled])
```

## 5. 권장 사항

1. **개발 단계**: Simple-Peer + Socket.io 조합이 가장 빠르게 구현 가능
2. **프로덕션**: Agora나 Twilio 같은 상용 솔루션 사용 권장 (STUN/TURN 서버 관리 불필요)
3. **로컬 테스트**: 같은 네트워크에서는 STUN 서버만으로도 작동 가능

## 6. 현재 상태

현재는 localStorage 기반이므로 실제 WebRTC 구현이 불가능합니다. 
Supabase나 다른 백엔드 서비스로 전환 후 WebRTC를 구현해야 합니다.

