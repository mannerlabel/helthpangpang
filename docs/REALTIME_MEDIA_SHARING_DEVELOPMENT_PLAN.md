# 실시간 카메라 화면 및 음성 공유 개발 계획

## 📋 개발 순서

### Phase 1: 기본 WebRTC 연결 (1-2주)

#### 1단계: WebRTC 서비스 클래스 구현
- [x] 파일 정리 (SQL, MD 파일을 docs 디렉토리로 이동)
- [x] `src/services/webrtcService.ts` 생성
  - [x] PeerConnection 생성 및 관리
  - [x] Offer/Answer 교환 로직
  - [x] ICE candidate 처리
  - [x] Remote stream 수신 및 관리
  - [x] 연결 종료 처리

#### 2단계: Supabase Realtime Signaling 구현
- [x] `src/services/signalingService.ts` 생성
  - [x] Supabase Realtime 채널 구독
  - [x] Signaling 메시지 타입 정의 (offer, answer, ice-candidate, user-joined, user-left)
  - [x] 메시지 송수신 로직
  - [x] 채널 관리 (구독/해제)

#### 3단계: CrewMeetingView 통합
- [x] WebRTC 서비스와 Signaling 서비스 통합
- [x] Remote video stream 표시
- [x] 연결 상태 관리 (connecting, connected, disconnected)
- [ ] 에러 처리 및 재연결 로직 (Phase 4에서 구현)

#### 4단계: 기본 테스트 (2명 P2P)
- [ ] 로컬 환경에서 2명 간 연결 테스트
- [ ] 영상/음성 전송 확인
- [ ] 연결 상태 표시 확인

---

### Phase 2: 다중 참여자 지원 (1주)

#### 5단계: 다중 PeerConnection 관리
- [ ] 여러 참여자와 동시 연결 관리
- [ ] 참여자 추가/제거 처리
- [ ] UI에 모든 참여자 영상 표시

#### 6단계: Mesh 네트워크 구현
- [ ] 각 참여자와 P2P 연결 유지
- [ ] 연결 품질 모니터링
- [ ] 자동 재연결 로직

---

### Phase 3: 상태 동기화 (1주)

#### 7단계: 실시간 상태 동기화
- [ ] 멤버 상태 실시간 업데이트 (Supabase Realtime)
- [ ] 영상/음성 ON/OFF 실시간 반영
- [ ] 참여자 입장/퇴장 실시간 감지

#### 8단계: UI 개선
- [ ] 연결 상태 표시 (연결 중, 연결됨, 연결 끊김)
- [ ] 네트워크 품질 표시
- [ ] 에러 메시지 표시

---

### Phase 4: 최적화 및 에러 처리 (1주)

#### 9단계: 재연결 로직
- [ ] 네트워크 끊김 감지
- [ ] 자동 재연결 시도
- [ ] 연결 실패 시 사용자 알림

#### 10단계: 성능 최적화
- [ ] 비디오 품질 조절 (네트워크 상태에 따라)
- [ ] 불필요한 리소스 정리
- [ ] 메모리 누수 방지

---

## 👤 사용자가 해야 할 일

### 개발 시작 전 (필수)

1. **HTTPS 환경 설정**
   - WebRTC는 HTTPS 환경에서만 작동 (localhost 제외)
   - 개발 환경: Vite의 HTTPS 설정 또는 ngrok 사용
   - 프로덕션: 실제 HTTPS 인증서 필요

2. **STUN/TURN 서버 확인**
   - 초기 개발: Google의 공개 STUN 서버 사용 가능
     - `stun:stun.l.google.com:19302`
   - 프로덕션: TURN 서버 구축 필요 (NAT 통과 실패 시)

3. **Supabase Realtime 활성화**
   - Supabase 프로젝트에서 Realtime 기능 활성화 확인
   - `crew_members` 테이블에 Realtime 구독 권한 확인

### Phase 1 완료 후

4. **로컬 테스트**
   - 같은 네트워크에서 2개의 브라우저/디바이스로 테스트
   - 영상/음성 전송 확인
   - 연결 상태 확인

5. **네트워크 환경 테스트**
   - 다른 네트워크에서 테스트 (모바일 핫스팟 등)
   - NAT 통과 테스트
   - 방화벽 설정 확인

### Phase 2 완료 후

6. **다중 참여자 테스트**
   - 3명 이상 동시 연결 테스트
   - 참여자 추가/제거 테스트
   - 연결 품질 확인

### Phase 3 완료 후

7. **실제 디바이스 테스트**
   - 모바일 디바이스 테스트 (iOS/Android)
   - 다양한 브라우저 호환성 테스트
   - 성능 최적화 (실제 사용량 기반)

### Phase 4 완료 후

8. **프로덕션 배포 준비**
   - TURN 서버 구축 (필요 시)
   - 보안 설정 확인
   - 모니터링 도구 설정

---

## 🔧 기술 스택

- **WebRTC API**: 브라우저 내장 API (추가 패키지 불필요)
- **Supabase Realtime**: Signaling 서버로 사용
- **STUN/TURN 서버**: NAT 통과 지원

---

## 📝 참고 사항

1. **WebRTC 제한사항**
   - HTTPS 필수 (localhost 제외)
   - 브라우저 호환성 확인 필요
   - 모바일 브라우저 지원 확인 필요

2. **Supabase Realtime 제한사항**
   - 무료 플랜: 200 동시 연결
   - 유료 플랜: 더 많은 연결 지원

3. **네트워크 고려사항**
   - NAT 통과 실패 시 TURN 서버 필요
   - 방화벽 설정 확인 필요
   - 네트워크 대역폭 고려

---

**작성일**: 2025-01-XX  
**버전**: 1.0

