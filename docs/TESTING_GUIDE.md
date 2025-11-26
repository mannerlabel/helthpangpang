# 실시간 카메라 화면 및 음성 공유 - 테스트 가이드

## ✅ Supabase Realtime 설정 확인 완료

다음 설정이 확인되었습니다:
- ✅ Realtime service: ON
- ✅ Allow public access: ON
- ✅ Max concurrent clients: 200
- ✅ Max events per second: 100

---

## 🧪 Phase 1 테스트 절차

### 1. HTTPS 환경 설정

**중요**: WebRTC는 HTTPS 환경에서만 작동합니다 (localhost 제외)

#### 옵션 A: Vite HTTPS 설정 (권장 - 개발 환경)

`vite.config.ts` 파일을 확인하고, 필요시 다음 설정 추가:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    https: true, // 또는 자체 서명 인증서 사용
    port: 5173,
  },
})
```

또는 간단하게:
```bash
npm run dev -- --https
```

#### 옵션 B: ngrok 사용 (로컬 테스트용)

```bash
# ngrok 설치 (https://ngrok.com/)
ngrok http 5173

# 생성된 HTTPS URL 사용 (예: https://xxxx-xx-xx-xx-xx.ngrok.io)
```

#### 옵션 C: 실제 HTTPS 인증서 (프로덕션)
- 실제 도메인에 HTTPS 인증서 설정 필요

---

### 2. 테스트 준비

#### 필요한 것:
1. **2개의 브라우저/디바이스**
   - 같은 네트워크: 데스크톱 브라우저 2개 또는 데스크톱 + 모바일
   - 다른 네트워크: 모바일 핫스팟 사용

2. **테스트 계정 2개**
   - 서로 다른 사용자로 로그인
   - 같은 크루에 입장

---

### 3. 테스트 시나리오

#### 시나리오 1: 기본 연결 테스트 (같은 네트워크)

1. **사용자 A (첫 번째 브라우저)**
   - 크루 생성 또는 기존 크루 입장
   - TrainingPage에서 영상 ON
   - CrewMeetingView 확인

2. **사용자 B (두 번째 브라우저)**
   - 같은 크루 입장
   - TrainingPage에서 영상 ON
   - CrewMeetingView 확인

3. **확인 사항**
   - [ ] 브라우저 콘솔에서 WebRTC 연결 로그 확인
   - [ ] "연결 중..." → "연결됨" 상태 변화 확인
   - [ ] 상대방 영상이 표시되는지 확인
   - [ ] 음성이 전송되는지 확인 (마이크 ON 시)

#### 시나리오 2: 다른 네트워크 테스트

1. **사용자 A**: WiFi 네트워크
2. **사용자 B**: 모바일 핫스팟 또는 다른 WiFi
3. **확인 사항**
   - [ ] NAT 통과 성공 여부 확인
   - [ ] 연결 실패 시 에러 메시지 확인

---

### 4. 브라우저 콘솔 확인

#### 정상 동작 시 예상 로그:

```
✅ Subscribed to channel: crew_{crewId}_signaling
✅ WebRTC 연결 시작: {userName} ({userId})
✅ Handling offer from {userId}
✅ ICE candidate for {userId}: {candidate}
✅ Remote stream received from {userId}: {streams}
✅ ICE connection state for {userId}: connected
```

#### 문제 발생 시 확인할 로그:

```
❌ WebRTC 초기화 실패: {error}
❌ Failed to send message to crew {crewId}: {error}
❌ Error handling offer from {userId}: {error}
❌ Connection state for {userId}: failed
```

---

### 5. 문제 해결

#### 문제 1: WebRTC 연결 실패

**증상**: "연결 중..." 상태에서 멈춤

**해결 방법**:
1. HTTPS 환경인지 확인 (주소창에 🔒 표시)
2. 브라우저 콘솔에서 에러 메시지 확인
3. STUN/TURN 서버 설정 확인
4. 방화벽 설정 확인

#### 문제 2: 영상이 표시되지 않음

**증상**: 연결은 되었지만 영상이 보이지 않음

**해결 방법**:
1. 브라우저 콘솔에서 "Remote stream received" 로그 확인
2. 비디오 요소의 `srcObject` 설정 확인
3. 카메라 권한 확인
4. 다른 브라우저에서 테스트

#### 문제 3: Supabase Realtime 연결 실패

**증상**: Signaling 메시지가 전송되지 않음

**해결 방법**:
1. Supabase Realtime 활성화 확인 (이미 확인됨 ✅)
2. 채널 구독 상태 확인 (콘솔 로그)
3. 네트워크 연결 확인
4. Supabase 프로젝트의 API 키 확인

#### 문제 4: ICE candidate 교환 실패

**증상**: 연결이 "checking" 상태에서 멈춤

**해결 방법**:
1. STUN 서버 연결 확인
2. NAT 통과 실패 시 TURN 서버 필요
3. 방화벽/라우터 설정 확인

---

### 6. 테스트 체크리스트

#### Phase 1 기본 테스트
- [ ] HTTPS 환경 설정 완료
- [ ] Supabase Realtime 활성화 확인 ✅
- [ ] 2명 간 P2P 연결 성공
- [ ] 영상 전송 확인
- [ ] 음성 전송 확인
- [ ] 연결 상태 표시 확인 ("연결 중" → "연결됨")
- [ ] 다른 네트워크에서 연결 테스트

#### 추가 테스트 (선택사항)
- [ ] 연결 끊김 후 재연결 테스트
- [ ] 참여자 추가/제거 테스트
- [ ] 영상 ON/OFF 토글 테스트
- [ ] 음성 ON/OFF 토글 테스트

---

## 📊 성능 확인

### 연결 품질 확인:
1. **지연 시간**: 영상/음성 지연 확인
2. **화질**: 영상 품질 확인
3. **안정성**: 연결 유지 시간 확인

### 네트워크 사용량:
- 브라우저 개발자 도구 → Network 탭에서 확인
- WebRTC 연결의 데이터 전송량 확인

---

## 🐛 디버깅 팁

### 1. 브라우저 개발자 도구 활용
- **Console**: WebRTC 로그 확인
- **Network**: Signaling 메시지 확인
- **Application**: localStorage 확인

### 2. WebRTC 내부 상태 확인
```javascript
// 브라우저 콘솔에서 실행
const peerConnection = webrtcService.getPeerConnection('{userId}')
console.log('Connection state:', peerConnection.connectionState)
console.log('ICE connection state:', peerConnection.iceConnectionState)
console.log('ICE gathering state:', peerConnection.iceGatheringState)
```

### 3. Signaling 메시지 확인
- Supabase Realtime Inspector 사용
- 채널 구독 상태 확인

---

## 📝 테스트 결과 기록

테스트 후 다음 정보를 기록하세요:

1. **테스트 환경**
   - 브라우저: Chrome/Firefox/Safari/Edge
   - OS: Windows/Mac/Linux/iOS/Android
   - 네트워크: 같은 네트워크 / 다른 네트워크

2. **테스트 결과**
   - 연결 성공/실패
   - 영상 전송 성공/실패
   - 음성 전송 성공/실패
   - 발견된 문제점

3. **에러 로그**
   - 브라우저 콘솔 에러
   - 네트워크 에러

---

## 🚀 다음 단계

Phase 1 테스트가 성공적으로 완료되면:
1. 테스트 결과를 개발자에게 공유
2. 발견된 문제점 보고
3. Phase 2 개발 시작 (다중 참여자 지원)

---

**작성일**: 2025-01-XX  
**버전**: 1.0

