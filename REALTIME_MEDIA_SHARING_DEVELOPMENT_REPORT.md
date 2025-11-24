# 실시간 카메라 화면 및 음성 공유 개발 보고서

## 📋 현재 상태 분석

### ✅ 이미 구현된 기능
1. **로컬 미디어 스트림 획득**
   - `CrewMeetingView.tsx`: `getUserMedia`를 사용하여 로컬 비디오/오디오 스트림 획득
   - `cameraService.ts`: 카메라 초기화 및 스트림 관리
   - `useCamera.ts`: 카메라 훅을 통한 스트림 관리

2. **UI 상태 관리**
   - `videoEnabled`, `audioEnabled` 상태 관리
   - 크루 목록에서 미디어 공유 설정 UI
   - `CrewMeetingView`에서 참여자 목록 표시

3. **데이터베이스 구조**
   - `CrewMember` 인터페이스에 `videoEnabled`, `audioEnabled` 필드 존재
   - Supabase를 통한 멤버 상태 저장 가능

### ❌ 아직 구현되지 않은 기능
1. **실시간 P2P 연결 (WebRTC)**
   - Peer-to-Peer 연결 설정
   - Signaling 서버 (WebSocket/HTTP)
   - ICE candidate 교환
   - Remote stream 수신 및 표시

2. **미디어 서버 (선택사항)**
   - SFU (Selective Forwarding Unit) 또는 MCU (Multipoint Control Unit)
   - 대규모 참여자 지원

3. **실시간 상태 동기화**
   - 멤버의 영상/음성 ON/OFF 상태 실시간 업데이트
   - 참여자 입장/퇴장 실시간 감지

---

## 🛠️ 개발 방향 및 구현 방법

### 옵션 1: WebRTC P2P 방식 (권장 - 소규모 그룹)

#### 필요한 기술 스택
- **WebRTC API**: 브라우저 내장 API
- **Signaling 서버**: WebSocket 또는 Supabase Realtime
- **STUN/TURN 서버**: NAT 통과를 위한 서버 (공개 서버 사용 가능)

#### 구현 단계

**1단계: WebRTC 서비스 생성**
```
src/services/webrtcService.ts
```
- PeerConnection 생성 및 관리
- Offer/Answer 교환
- ICE candidate 처리
- Remote stream 수신

**2단계: Signaling 서버 구현**
- **옵션 A**: Supabase Realtime 사용 (권장)
  - Supabase Realtime 채널 생성
  - Signaling 메시지 교환 (offer, answer, ICE candidate)
- **옵션 B**: WebSocket 서버 구축
  - Node.js + Socket.io 또는 ws 라이브러리
  - Express 서버에 WebSocket 엔드포인트 추가

**3단계: CrewMeetingView 확장**
- WebRTC 서비스 통합
- Remote video stream 표시
- 연결 상태 관리 (connecting, connected, disconnected)

**4단계: 상태 동기화**
- Supabase Realtime을 통한 멤버 상태 업데이트
- `crew_members` 테이블의 `videoEnabled`, `audioEnabled` 실시간 구독

#### 예상 코드 구조
```typescript
// src/services/webrtcService.ts
class WebRTCService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map()
  private localStream: MediaStream | null = null
  
  async createPeerConnection(userId: string): Promise<RTCPeerConnection>
  async createOffer(userId: string): Promise<RTCSessionDescriptionInit>
  async handleAnswer(userId: string, answer: RTCSessionDescriptionInit): Promise<void>
  async addIceCandidate(userId: string, candidate: RTCIceCandidateInit): Promise<void>
  async setLocalStream(stream: MediaStream): Promise<void>
  async closeConnection(userId: string): Promise<void>
}
```

### 옵션 2: 미디어 서버 방식 (대규모 그룹)

#### 필요한 기술 스택
- **미디어 서버**: Janus Gateway, Kurento, 또는 Mediasoup
- **SFU 서버**: 선택적 전송 (Selective Forwarding Unit)
- **서버 인프라**: 별도 서버 필요

#### 구현 단계
1. 미디어 서버 구축 및 배포
2. 클라이언트에서 미디어 서버로 스트림 전송
3. 서버가 다른 참여자들에게 스트림 전달

#### 장단점
- ✅ 대규모 참여자 지원 가능
- ✅ 서버 부하 분산 가능
- ❌ 별도 서버 인프라 필요
- ❌ 초기 설정 복잡

---

## 📝 Cursor AI가 할 수 있는 것

### ✅ 가능한 작업

1. **코드 구조 설계 및 구현**
   - WebRTC 서비스 클래스 작성
   - React 컴포넌트 확장
   - TypeScript 타입 정의
   - 상태 관리 로직 구현

2. **Supabase Realtime 통합**
   - Realtime 채널 구독 코드 작성
   - Signaling 메시지 교환 로직 구현
   - 상태 동기화 로직 작성

3. **UI 컴포넌트 개발**
   - Remote video 표시 컴포넌트
   - 연결 상태 표시 UI
   - 에러 처리 UI

4. **로컬 테스트 코드 작성**
   - WebRTC 연결 테스트 함수
   - 시그널링 메시지 테스트

5. **문서화**
   - 코드 주석 작성
   - API 문서 작성
   - 사용 가이드 작성

### ❌ Cursor AI가 할 수 없는 것

1. **실제 서버 배포 및 운영**
   - STUN/TURN 서버 구축 (공개 서버 사용 가능)
   - 미디어 서버 배포 (옵션 2 선택 시)
   - 프로덕션 환경 설정

2. **네트워크 환경 테스트**
   - 다양한 네트워크 환경에서의 테스트
   - NAT 통과 테스트
   - 방화벽 설정 확인

3. **실제 디바이스 테스트**
   - 모바일 디바이스 테스트
   - 다양한 브라우저 호환성 테스트
   - 성능 최적화 (실제 사용량 기반)

4. **보안 설정**
   - HTTPS 인증서 설정 (WebRTC 필수)
   - 방화벽 규칙 설정
   - 서버 보안 강화

5. **실시간 디버깅**
   - 실제 연결 문제 해결
   - 네트워크 이슈 진단
   - 성능 병목 지점 파악

---

## 🚀 권장 개발 순서

### Phase 1: 기본 WebRTC 연결 (1-2주)
1. WebRTC 서비스 클래스 구현
2. Supabase Realtime을 통한 Signaling 구현
3. 2명 간 P2P 연결 테스트

### Phase 2: 다중 참여자 지원 (1주)
1. 여러 PeerConnection 관리
2. 참여자 추가/제거 처리
3. UI에 모든 참여자 영상 표시

### Phase 3: 상태 동기화 (1주)
1. 멤버 상태 실시간 업데이트
2. 영상/음성 ON/OFF 실시간 반영
3. 연결 상태 표시

### Phase 4: 최적화 및 에러 처리 (1주)
1. 재연결 로직
2. 네트워크 에러 처리
3. 성능 최적화

---

## 📦 필요한 추가 패키지

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.83.0" // 이미 설치됨 (Realtime 사용)
    // 추가 패키지 불필요 (WebRTC는 브라우저 내장 API)
  }
}
```

**참고**: WebRTC는 브라우저 내장 API이므로 추가 패키지 설치 불필요

---

## 🔧 기술적 고려사항

### 1. STUN/TURN 서버
- **공개 STUN 서버**: Google의 `stun:stun.l.google.com:19302` 사용 가능
- **TURN 서버**: NAT 통과 실패 시 필요 (별도 구축 또는 서비스 이용)

### 2. HTTPS 필수
- WebRTC는 HTTPS 환경에서만 작동 (localhost 제외)
- 개발 환경: `vite`의 HTTPS 설정 또는 ngrok 사용

### 3. 브라우저 호환성
- Chrome, Firefox, Safari, Edge 지원
- 모바일 브라우저 지원 확인 필요

### 4. Supabase Realtime 제한사항
- 무료 플랜: 200 동시 연결
- 유료 플랜: 더 많은 연결 지원

---

## 📊 예상 개발 시간

- **최소 구현 (2명 P2P)**: 1주
- **다중 참여자 지원**: +1주
- **상태 동기화 및 최적화**: +1주
- **총 예상 시간**: 3-4주

---

## 🎯 다음 단계

1. **WebRTC 서비스 클래스 구현 시작**
   - `src/services/webrtcService.ts` 생성
   - 기본 PeerConnection 로직 구현

2. **Supabase Realtime 채널 설정**
   - `crew_{crewId}_signaling` 채널 생성
   - Signaling 메시지 타입 정의

3. **CrewMeetingView 확장**
   - WebRTC 서비스 통합
   - Remote video 표시 영역 추가

---

## 📚 참고 자료

- [WebRTC MDN 문서](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Supabase Realtime 문서](https://supabase.com/docs/guides/realtime)
- [WebRTC Samples](https://webrtc.github.io/samples/)

---

**작성일**: 2025-01-XX  
**작성자**: Cursor AI  
**버전**: 1.0

