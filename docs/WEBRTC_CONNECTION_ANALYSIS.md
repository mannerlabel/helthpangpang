# WebRTC 연결 문제 분석

## 로그 분석 결과

### 현재 상태
1. ✅ 채널 구독: `joined` - 정상
2. ✅ WebRTC 연결 시작 조건: 모든 조건 충족
3. ⚠️ Offer 생성: 이미 Offer가 존재 (`have-local-offer` 상태)
4. ✅ Offer 전송: 성공적으로 전송됨

### 문제점

#### 1. Offer 중복 생성 시도
```
⚠️ Offer가 이미 존재합니다: 89a86d26-c936-4146-b029-5b55d1291455
{currentSignalingState: 'have-local-offer'}
```

**원인:**
- 이전 연결 시도에서 Offer가 생성되었지만 Answer를 받지 못한 상태
- `createPeerConnection`이 기존 연결을 재사용하여 `have-local-offer` 상태 유지
- 새로운 연결 시도 시 기존 Offer가 있어서 경고 발생

**영향:**
- 경고는 나오지만 기존 Offer를 반환하므로 기능상 문제는 없음
- 하지만 Answer를 받지 못하면 연결이 완료되지 않음

#### 2. Answer 수신 대기 문제
- Offer는 전송되었지만 Answer 수신 여부가 로그에 없음
- Answer를 받지 못하면 연결이 완료되지 않음

#### 3. 연결 상태 모니터링 부족
- `iceConnectionState`가 `new` 상태로 유지됨
- 연결이 실제로 진행되고 있는지 확인 어려움

## 해결 방안

### 1. Offer 타임아웃 처리
`have-local-offer` 상태에서 일정 시간(10초) 동안 Answer를 받지 못하면 연결을 재생성

### 2. Answer 수신 확인 로그 추가
Answer 수신 시 상세 로그 출력

### 3. 연결 상태 모니터링 강화
- `iceConnectionState` 변경 추적
- 연결 실패 시 자동 재시도

### 4. 중복 연결 시도 방지 개선
- `have-local-offer` 상태에서 일정 시간 대기 후 재시도
- 연결 상태에 따른 스마트 재시도 로직

## 확인 필요 사항

1. **Answer 수신 여부**
   - 브라우저 콘솔에서 `Answer 수신` 또는 `handleAnswer` 로그 확인
   - Answer가 수신되지 않으면 Signaling 서버 문제 가능성

2. **ICE 연결 상태**
   - `iceConnectionState`가 `checking` → `connected`로 변경되는지 확인
   - `failed` 또는 `disconnected` 상태가 지속되면 네트워크 문제

3. **원격 스트림 수신**
   - `📹 Remote stream 수신` 로그 확인
   - 로그가 없으면 연결이 완료되지 않은 것

## 다음 단계

1. Answer 수신 로그 확인
2. 연결 상태 모니터링 로그 추가
3. 타임아웃 처리 로직 추가
4. 필요시 TURN 서버 추가 검토

