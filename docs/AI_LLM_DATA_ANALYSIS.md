# AI LLM 분석 데이터 전송 상세 설명

## 에러 분석

### 1. Supabase API 키 조회 406 에러
```
GET .../api_keys?select=api_key,is_active&key_type=eq.llm&is_active=eq.true 406 (Not Acceptable)
```

**원인:**
- `api_keys` 테이블이 존재하지 않거나
- RLS 정책이 잘못 설정되어 있거나
- 컬럼명이 잘못되었을 수 있음

**영향:**
- 기능에는 영향 없음 (환경 변수로 폴백)
- OpenAI API 키를 환경 변수에서 가져오거나 기본 분석 사용

### 2. 로컬 AI 분석 API 연결 실패
```
POST http://localhost:8000/api/analyze net::ERR_CONNECTION_REFUSED
```

**원인:**
- 로컬 AI 분석 서버가 실행되지 않음
- `VITE_AI_API_URL` 환경 변수가 설정되어 있지만 서버가 없음

**영향:**
- 기능에는 영향 없음 (OpenAI API 직접 호출 또는 기본 분석 사용)

### 3. UUID 형식 에러 (22P02)
```
invalid input syntax for type uuid: "session_1764212958380"
```

**원인:**
- 일반 운동 세션 ID가 `session_${Date.now()}` 형식으로 생성됨 (예: `session_1764212958380`)
- Supabase의 `exercise_sessions` 테이블은 UUID 형식만 허용
- `getExerciseSessionById`에서 조깅 세션이 아닌 일반 세션의 ID를 조회하려고 할 때 발생
- `createExerciseSession`에서 Supabase에 저장할 때는 UUID를 자동 생성하지만, 클라이언트 측에서는 여전히 `session_` 형식의 ID를 사용

**해결:**
- 이미 수정됨: 조깅 세션인 경우 `getExerciseSessionById` 호출을 건너뜀
- 일반 운동 세션의 경우 `getExerciseSessionById`에서 UUID 형식 체크를 추가하여 비-UUID ID는 조회하지 않도록 처리
- `ResultPage.tsx`에서 조깅 세션이 아닌 경우에도 UUID 형식 체크를 추가하여 에러 방지

---

## AI LLM에게 전송하는 데이터 상세 설명

### 1. OpenAI API 직접 호출 시

#### 1.1 조깅 세션인 경우

**전송 데이터 구조:**
```json
{
  "model": "gpt-4o-mini",
  "messages": [
    {
      "role": "system",
      "content": "당신은 조깅 분석 전문가입니다. 조깅 거리, 속도, 시간을 분석하여 한국어로 상세한 피드백을 제공합니다."
    },
    {
      "role": "user",
      "content": "조깅 분석 전문가로서 다음 조깅 데이터를 분석해주세요:\n\n총 거리: {distance}km\n평균 속도: {averageSpeed}km/h\n총 시간: {timeInMinutes}분 {timeInSeconds}초\n\n다음 형식의 JSON으로 응답해주세요:\n{\n  \"summary\": \"조깅 요약 (한국어)\",\n  \"bestPoseFeedback\": \"조깅 자세에 대한 피드백 (한국어)\",\n  \"worstPoseFeedback\": \"개선이 필요한 부분에 대한 피드백 (한국어)\",\n  \"averageScore\": 0,\n  \"recommendations\": [\"추천사항1\", \"추천사항2\"],\n  \"exerciseType\": \"jogging\"\n}"
    }
  ],
  "temperature": 0.7,
  "response_format": { "type": "json_object" }
}
```

**전송되는 실제 데이터:**
- `distance`: 총 거리 (km, 소수점 2자리)
- `averageSpeed`: 평균 속도 (km/h, 소수점 2자리)
- `timeInMinutes`: 총 시간 (분)
- `timeInSeconds`: 총 시간 (초, 60초 미만)

**데이터 출처:**
```typescript
const joggingData = session.joggingData
const distance = joggingData.distance || 0
const averageSpeed = joggingData.averageSpeed || 0
const averageTime = joggingData.averageTime || 0  // 밀리초 단위
const timeInMinutes = Math.floor(averageTime / 60000)
const timeInSeconds = Math.floor((averageTime % 60000) / 1000)
```

#### 1.2 일반 운동 세션인 경우

**전송 데이터 구조:**
```json
{
  "model": "gpt-4o-mini",
  "messages": [
    {
      "role": "system",
      "content": "당신은 운동 분석 전문가입니다. 운동 자세와 점수를 분석하여 한국어로 상세한 피드백을 제공합니다."
    },
    {
      "role": "user",
      "content": "운동 분석 전문가로서 다음 운동 데이터를 분석해주세요:\n\n운동 종목: {exerciseName}\n평균 점수: {averageScore}점\n최고 점수: {bestScore}점\n최저 점수: {worstScore}점\n총 카운트: {totalCount}회\n\n다음 형식의 JSON으로 응답해주세요:\n{\n  \"summary\": \"운동 요약 (한국어)\",\n  \"bestPoseFeedback\": \"최고 자세에 대한 피드백 (한국어)\",\n  \"worstPoseFeedback\": \"최저 자세에 대한 피드백 (한국어)\",\n  \"averageScore\": {averageScore},\n  \"recommendations\": [\"추천사항1\", \"추천사항2\"],\n  \"exerciseType\": \"{exerciseType}\"\n}"
    }
  ],
  "temperature": 0.7,
  "response_format": { "type": "json_object" }
}
```

**전송되는 실제 데이터:**
- `exerciseName`: 운동 종목 이름 (한국어)
  - 예: "스쿼트", "푸시업", "런지", "커스텀 운동" 등
- `averageScore`: 평균 점수 (소수점 1자리)
- `bestScore`: 최고 점수 (정수, 없으면 0)
- `worstScore`: 최저 점수 (정수, 없으면 0)
- `totalCount`: 총 카운트 (회)
  - `session.totalCount` 또는 `session.counts.length`

**데이터 출처:**
```typescript
const exerciseName = session.config.type === 'custom' 
  ? session.config.customName || '커스텀 운동'
  : EXERCISE_TYPE_NAMES[session.config.type] || '운동'
const totalCount = session.totalCount || session.counts.length
const averageScore = session.averageScore
const bestScore = session.bestScore?.score || 0
const worstScore = session.worstScore?.score || 0
```

### 2. 커스텀 API URL 사용 시 (로컬 서버)

**전송 데이터 구조 (POST 요청):**
```json
{
  "exerciseType": "squat" | "pushup" | "lunge" | "jogging" | "custom",
  "bestScore": {
    "score": 95,
    "image": "data:image/jpeg;base64,...",
    "timestamp": 1764212958380
  } | null,
  "worstScore": {
    "score": 65,
    "image": "data:image/jpeg;base64,...",
    "timestamp": 1764212958380
  } | null,
  "averageScore": 82.5,
  "counts": [
    {
      "count": 1,
      "timestamp": 1764212958380,
      "poseScore": 85,
      "image": "data:image/jpeg;base64,...",
      "setNumber": 1,
      "angle": 90,
      "depth": 0.8,
      "state": "down"
    },
    // ... 더 많은 카운트 데이터
  ],
  "joggingData": {  // 조깅 세션인 경우에만 포함
    "distance": 3.5,
    "averageSpeed": 7.2,
    "averageTime": 1800000,
    "route": [
      {
        "lat": 37.5665,
        "lng": 126.9780,
        "timestamp": 1764212958380
      },
      // ... 더 많은 경로 포인트
    ]
  }
}
```

**전송되는 실제 데이터 상세:**

#### 2.1 공통 필드
- `exerciseType`: 운동 종목 타입
  - 가능한 값: `"squat"`, `"pushup"`, `"lunge"`, `"jogging"`, `"custom"` 등
- `averageScore`: 평균 점수 (0-100)
- `bestScore`: 최고 점수 객체 (없으면 `null`)
  - `score`: 점수 (0-100)
  - `image`: Base64 인코딩된 이미지 데이터
  - `timestamp`: 타임스탬프 (밀리초)
- `worstScore`: 최저 점수 객체 (없으면 `null`)
  - 구조는 `bestScore`와 동일
- `counts`: 운동 카운트 배열
  - 각 카운트 객체:
    - `count`: 카운트 번호
    - `timestamp`: 타임스탬프 (밀리초)
    - `poseScore`: 자세 점수 (0-100)
    - `image`: Base64 인코딩된 이미지 데이터 (선택사항)
    - `setNumber`: 세트 번호
    - `angle`: 관절 각도 (선택사항)
    - `depth`: 운동 깊이 (선택사항, 0-1)
    - `state`: 운동 상태 (선택사항, 예: "up", "down")

#### 2.2 조깅 세션 전용 필드
- `joggingData`: 조깅 데이터 객체 (조깅 세션인 경우에만 포함)
  - `distance`: 총 거리 (km)
  - `averageSpeed`: 평균 속도 (km/h)
  - `averageTime`: 총 시간 (밀리초)
  - `route`: 경로 포인트 배열
    - 각 포인트:
      - `lat`: 위도
      - `lng`: 경도
      - `timestamp`: 타임스탬프 (밀리초)

### 3. 데이터 전송 흐름

```
1. ResultPage에서 fetchAnalysis() 호출
   ↓
2. aiAnalysisService.analyzeExercise(session) 호출
   ↓
3. API 키 가져오기 시도
   - Supabase에서 가져오기 시도 (실패 시 환경 변수 사용)
   ↓
4. OpenAI API 직접 호출 시도
   - 조깅 세션: 조깅 데이터 기반 프롬프트 생성
   - 일반 운동: 운동 데이터 기반 프롬프트 생성
   ↓
5. OpenAI API 실패 시 커스텀 API URL 시도
   - POST http://localhost:8000/api/analyze
   - JSON body로 전체 세션 데이터 전송
   ↓
6. 모든 API 실패 시 기본 분석 반환
   - generateDefaultAnalysis() 호출
```

### 4. 실제 전송 예시

#### 4.1 조깅 세션 예시
```json
{
  "exerciseType": "jogging",
  "averageScore": 0,
  "bestScore": null,
  "worstScore": null,
  "counts": [],
  "joggingData": {
    "distance": 5.2,
    "averageSpeed": 8.5,
    "averageTime": 2200000,
    "route": [
      {"lat": 37.5665, "lng": 126.9780, "timestamp": 1764212958380},
      {"lat": 37.5666, "lng": 126.9781, "timestamp": 1764212958410}
    ]
  }
}
```

#### 4.2 스쿼트 세션 예시
```json
{
  "exerciseType": "squat",
  "averageScore": 82.5,
  "bestScore": {
    "score": 95,
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "timestamp": 1764212958380
  },
  "worstScore": {
    "score": 65,
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "timestamp": 1764212958400
  },
  "counts": [
    {
      "count": 1,
      "timestamp": 1764212958380,
      "poseScore": 85,
      "setNumber": 1,
      "angle": 90,
      "depth": 0.8,
      "state": "down"
    },
    {
      "count": 2,
      "timestamp": 1764212958400,
      "poseScore": 80,
      "setNumber": 1,
      "angle": 88,
      "depth": 0.75,
      "state": "up"
    }
  ]
}
```

### 5. 응답 형식

**LLM이 반환해야 하는 JSON 형식:**
```json
{
  "summary": "운동 요약 (한국어)",
  "bestPoseFeedback": "최고 자세에 대한 피드백 (한국어)",
  "worstPoseFeedback": "최저 자세에 대한 피드백 (한국어)",
  "averageScore": 82.5,
  "recommendations": [
    "추천사항1",
    "추천사항2"
  ],
  "exerciseType": "squat"
}
```

---

## 참고사항

1. **이미지 데이터**: Base64 인코딩된 이미지는 매우 크므로, 실제로는 이미지 URL이나 축소된 이미지만 전송하는 것이 좋습니다.

2. **경로 데이터**: 조깅 경로는 포인트가 많을 수 있으므로, 분석에 필요한 핵심 포인트만 전송하는 것이 효율적입니다.

3. **에러 처리**: 모든 API 호출이 실패해도 기본 분석을 반환하므로, 사용자 경험에는 영향이 없습니다.

