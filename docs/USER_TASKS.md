# 실시간 카메라 화면 및 음성 공유 - 사용자 작업 가이드

## 📋 개발 진행 상황

### ✅ 완료된 작업 (Phase 1)
1. ✅ 파일 정리 (SQL, MD 파일을 docs 디렉토리로 이동)
2. ✅ WebRTC 서비스 클래스 구현 (`src/services/webrtcService.ts`)
3. ✅ Supabase Realtime Signaling 서비스 구현 (`src/services/signalingService.ts`)
4. ✅ CrewMeetingView에 WebRTC 통합

---

## 👤 사용자가 해야 할 일

### 🔴 즉시 해야 할 일 (테스트 전 필수)

#### 1. HTTPS 환경 설정
**WebRTC는 HTTPS 환경에서만 작동합니다 (localhost 제외)**

**옵션 A: Vite HTTPS 설정 (개발 환경)**
```bash
# vite.config.ts 수정 필요
# 또는 다음 명령어로 실행:
npm run dev -- --https
```

**옵션 B: ngrok 사용 (로컬 테스트용)**
```bash
# ngrok 설치 후
ngrok http 5173
# 생성된 HTTPS URL 사용
```

**옵션 C: 실제 HTTPS 인증서 (프로덕션)**
- 실제 도메인에 HTTPS 인증서 설정 필요

#### 2. Supabase Realtime 활성화 확인
1. Supabase 대시보드 접속
2. 프로젝트 설정 → API → Realtime 활성화 확인
3. `crew_members` 테이블에 Realtime 구독 권한 확인
   - Supabase SQL Editor에서 실행:
   ```sql
   -- Realtime 활성화 확인
   SELECT * FROM pg_publication_tables WHERE tablename = 'crew_members';
   ```

#### 3. STUN/TURN 서버 확인
- 현재 기본 STUN 서버 사용 중 (Google 공개 서버)
- 프로덕션 환경에서는 TURN 서버 구축 권장

---

### 🟡 Phase 1 테스트 (2명 P2P 연결)

#### 4. 로컬 테스트 준비
1. **같은 네트워크에서 2개의 브라우저/디바이스 준비**
   - 예: 데스크톱 브라우저 2개 또는 데스크톱 + 모바일

2. **테스트 시나리오**
   - 두 사용자가 같은 크루에 입장
   - 두 사용자 모두 영상 ON
   - WebRTC 연결 확인
   - 영상/음성 전송 확인

3. **확인 사항**
   - [ ] 브라우저 콘솔에서 WebRTC 연결 로그 확인
   - [ ] "연결 중..." → "연결됨" 상태 변화 확인
   - [ ] 상대방 영상이 표시되는지 확인
   - [ ] 음성이 전송되는지 확인

#### 5. 네트워크 환경 테스트
1. **다른 네트워크에서 테스트**
   - 모바일 핫스팟 사용
   - 다른 WiFi 네트워크 사용

2. **확인 사항**
   - [ ] NAT 통과 성공 여부 확인
   - [ ] 연결 실패 시 에러 메시지 확인
   - [ ] 방화벽 설정 확인

---

### 🟢 Phase 2 이후 작업 (추후 진행)

#### 6. 다중 참여자 테스트 (Phase 2 완료 후)
- 3명 이상 동시 연결 테스트
- 참여자 추가/제거 테스트
- 연결 품질 확인

#### 7. 실제 디바이스 테스트 (Phase 3 완료 후)
- 모바일 디바이스 테스트 (iOS/Android)
- 다양한 브라우저 호환성 테스트
- 성능 최적화

#### 8. 프로덕션 배포 준비 (Phase 4 완료 후)
- TURN 서버 구축 (필요 시)
- 보안 설정 확인
- 모니터링 도구 설정

---

## 🐛 문제 해결 가이드

### 문제 1: WebRTC 연결 실패
**증상**: "연결 중..." 상태에서 멈춤

**해결 방법**:
1. HTTPS 환경인지 확인
2. 브라우저 콘솔에서 에러 메시지 확인
3. STUN/TURN 서버 설정 확인
4. 방화벽 설정 확인

### 문제 2: 영상이 표시되지 않음
**증상**: 연결은 되었지만 영상이 보이지 않음

**해결 방법**:
1. 브라우저 콘솔에서 "Remote stream received" 로그 확인
2. 비디오 요소의 `srcObject` 설정 확인
3. 카메라 권한 확인

### 문제 3: Supabase Realtime 연결 실패
**증상**: Signaling 메시지가 전송되지 않음

**해결 방법**:
1. Supabase Realtime 활성화 확인
2. 채널 구독 상태 확인
3. 네트워크 연결 확인

---

## 📝 테스트 체크리스트

### Phase 1 테스트 체크리스트
- [ ] HTTPS 환경 설정 완료
- [ ] Supabase Realtime 활성화 확인
- [ ] 2명 간 P2P 연결 성공
- [ ] 영상 전송 확인
- [ ] 음성 전송 확인
- [ ] 연결 상태 표시 확인
- [ ] 다른 네트워크에서 연결 테스트

---

## 📞 다음 단계

Phase 1 테스트가 완료되면 다음을 진행하세요:
1. 테스트 결과를 개발자에게 공유
2. 발견된 문제점 보고
3. Phase 2 개발 시작 (다중 참여자 지원)

---

**작성일**: 2025-01-XX  
**버전**: 1.0

