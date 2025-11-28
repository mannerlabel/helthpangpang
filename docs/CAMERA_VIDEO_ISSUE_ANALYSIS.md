# 카메라 및 영상 공유 문제 분석

## 문제 현상
1. 카메라를 on 시키면 상단의 메인화면이 꺼지면서 참여자 영상의 화면도 함께 꺼짐
2. 참여자의 카메라가 잠시 접속되는 듯 하다가 영상 출력이 안됨
3. 음성이 출력되지 않음
4. 크루와 조깅크루의 참여자 영상들이 공유되지 않음

## 원인 분석

### 1. 카메라 리소스 경쟁 문제
**문제점:**
- `CrewMeetingView`에서 `myVideoEnabled`가 변경될 때 `getUserMedia`를 호출
- 이미 다른 곳(예: TrainingPage의 자세 측정 카메라)에서 카메라를 사용 중이면 충돌 발생
- 브라우저가 카메라 접근을 제한하거나 기존 스트림을 종료시킬 수 있음

**코드 위치:**
- `src/components/CrewMeetingView.tsx:690-733` - `getUserMedia` 호출
- `src/pages/TrainingPage.tsx` - 자세 측정용 카메라 사용

**해결 방안:**
1. `sharedVideoStream`을 우선적으로 사용하도록 개선
2. 카메라 스트림을 공유하여 중복 접근 방지
3. 스트림 획득 전에 기존 스트림 상태 확인

### 2. 스트림 정리 문제
**문제점:**
- `myVideoEnabled`가 false로 변경되면 스트림을 정리하는데, 이 과정에서 다른 컴포넌트가 사용 중인 스트림도 정리될 수 있음
- `sharedVideoStream`의 트랙을 잘못 정리하면 메인 화면이 꺼짐

**코드 위치:**
- `src/components/CrewMeetingView.tsx:768-776` - 스트림 정리 로직
- `src/components/CrewMeetingView.tsx:612-616` - 공유 스트림 트랙 보호 로직

**해결 방안:**
1. 공유 스트림의 트랙은 절대 정리하지 않도록 보호
2. 스트림 정리 전에 트랙 소유권 확인
3. `sharedVideoStream`이 있으면 별도 스트림을 생성하지 않음

### 3. WebRTC 연결 문제
**문제점:**
- STUN 서버만 사용하고 있어서 NAT 뒤에 있는 사용자 간 연결이 실패할 수 있음
- TURN 서버가 없으면 일부 네트워크 환경에서 연결 불가
- WebRTC 연결 상태 모니터링 부족

**코드 위치:**
- `src/services/webrtcService.ts:84-94` - STUN 서버 설정
- TURN 서버 설정 없음

**해결 방안:**
1. TURN 서버 추가 (선택적, 필요시)
2. WebRTC 연결 상태 디버깅 로그 추가
3. 연결 실패 시 재시도 로직 개선

### 4. 음성 문제
**문제점:**
- 오디오 트랙이 제대로 추가되지 않거나
- WebRTC에서 오디오가 전송되지 않을 수 있음
- 오디오 트랙 상태 모니터링 부족

**코드 위치:**
- `src/components/CrewMeetingView.tsx:504-519` - 오디오 추가 로직
- `src/components/CrewMeetingView.tsx:543-570` - 오디오 상태 변경 처리

**해결 방안:**
1. 오디오 트랙 상태 확인 및 로깅
2. 오디오 트랙 추가/제거 로직 개선
3. WebRTC에서 오디오 트랙 전송 확인

### 5. 참여자 영상 공유 문제
**문제점:**
- WebRTC 연결이 제대로 설정되지 않아서 원격 스트림이 수신되지 않음
- Signaling 서버 연결 문제
- PeerConnection 상태 문제

**코드 위치:**
- `src/services/webrtcService.ts` - WebRTC 연결 관리
- `src/services/signalingService.ts` - Signaling 처리
- `src/components/CrewMeetingView.tsx:933-1062` - 원격 스트림 처리

**해결 방안:**
1. WebRTC 연결 상태 상세 로깅
2. Signaling 메시지 교환 확인
3. PeerConnection 상태 모니터링

## 즉시 확인할 사항

### 1. 브라우저 콘솔 로그 확인
다음 로그들을 확인하세요:
- `🎥 카메라 스트림 useEffect 실행`
- `✅ 내 영상 스트림 획득 성공`
- `✅ WebRTC 서비스에 로컬 스트림 설정 완료`
- `📹 Remote stream received from`
- `✅ Remote stream 설정`

### 2. 네트워크 탭 확인
- WebSocket 연결 상태 (Supabase Realtime)
- STUN 서버 연결 시도 여부

### 3. 카메라 권한 확인
- 브라우저 설정에서 카메라 권한이 허용되어 있는지 확인
- 다른 탭/앱에서 카메라를 사용 중인지 확인

## 권장 해결 순서

1. **즉시 해결 (코드 수정):**
   - 공유 스트림 보호 로직 강화
   - 스트림 정리 시 트랙 소유권 확인
   - 오디오 트랙 상태 로깅 추가

2. **단기 해결 (디버깅):**
   - WebRTC 연결 상태 상세 로깅
   - Signaling 메시지 교환 확인
   - PeerConnection 상태 모니터링

3. **장기 해결 (인프라):**
   - TURN 서버 추가 (필요시)
   - STUN 서버 대안 추가
   - 네트워크 환경별 연결 전략 수립

