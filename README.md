# 헬스팡팡 (Health Pang Pang) 🏋️‍♂️

카메라 기반 실시간 운동 카운트 및 자세 분석 헬스케어 앱

## 주요 기능

### 모드 선택
- **싱글 모드**: 카메라를 통해 혼자 운동
- **크루 모드**: 참여자들이 방에 모여 함께 운동
- **조깅 모드**: 조깅 경로, 평균속도, 평균시간, 거리 자동 추적 및 분석 저장

### 운동 기능
- **종목 선택**: 스쿼트, 푸시업, 런지, + (종목 추가)
- **운동량 설정**: 세트, 갯수 (예: 2세트, 6개)
- **손가락 인식 시작**: 화면의 시작 버튼을 손가락으로 클릭하여 운동 시작
- **실시간 자세 분석**: 카운트마다 카메라를 통한 자세 점수 출력 (100점, 85점 등)
- **카운트 기능**: 화면에 카운트 출력, 화면출력과 함께 음성 카운트도 지원
- **실루엣 표시**: 점수에 따라 실루엣 두께와 무지개 색상으로 표시
  - 90점 이상: 빨강 (두께 8px)
  - 80점 이상: 주황 (두께 7px)
  - 70점 이상: 노랑 (두께 6px)
  - 60점 이상: 초록 (두께 5px)
  - 50점 이상: 파랑 (두께 4px)
  - 40점 이상: 남색 (두께 3px)
  - 40점 미만: 보라 (두께 2px)

### 운동 종료 후
- **최고/최저 점수 이미지 저장**: 최고점과 최저점의 점수와 이미지만 캡처하여 저장 후 비교 출력
- **AI 분석**: 최고, 최저 이미지와 점수, 평균점수, 종목의 자세 등 분석 요소를 전달하여 분석내용을 feedback받아서 출력

## 기술 스택

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **State Management**: Zustand
- **Pose Detection**: TensorFlow.js + MoveNet
- **Hand Detection**: TensorFlow.js + MediaPipe Hands
- **Audio**: Howler.js + Web Speech API
- **Routing**: React Router
- **Geolocation**: Web Geolocation API (조깅 모드)

## 프로젝트 구조

```
src/
├── components/          # UI 컴포넌트
│   ├── CameraView.tsx   # 카메라 뷰 컴포넌트
│   ├── PoseCanvas.tsx   # 자세 시각화 캔버스
│   ├── SilhouetteCanvas.tsx # 실루엣 표시 캔버스
│   ├── CountDisplay.tsx # 카운트 표시
│   └── EffectOverlay.tsx # 효과 오버레이
├── pages/              # 페이지 컴포넌트
│   ├── HomePage.tsx    # 홈 페이지
│   ├── ModeSelectionPage.tsx # 모드 선택 페이지
│   ├── ExerciseSelectPage.tsx # 종목 선택 페이지
│   ├── TrainingPage.tsx # 운동 페이지
│   ├── ResultPage.tsx  # 결과 페이지
│   └── JoggingPage.tsx # 조깅 페이지
├── features/            # 기능별 모듈
│   ├── camera/          # 카메라 관련
│   ├── pose-detection/  # 자세 인식
│   ├── count/           # 카운트 기능
│   ├── audio/           # 음성
│   ├── graphics/        # 그래픽/애니메이션
│   └── mission/         # 미션 관리
├── hooks/               # 커스텀 훅
│   ├── useCamera.ts     # 카메라 훅
│   └── usePoseDetection.ts # 자세 인식 훅
├── services/            # 서비스 레이어
│   ├── cameraService.ts      # 카메라 서비스
│   ├── poseDetectionService.ts # 자세 인식 서비스
│   ├── handDetectionService.ts # 손 인식 서비스
│   ├── countService.ts        # 카운트 서비스
│   ├── audioService.ts        # 오디오 서비스
│   ├── silhouetteService.ts   # 실루엣 서비스
│   ├── imageCaptureService.ts # 이미지 캡처 서비스
│   ├── aiAnalysisService.ts    # AI 분석 서비스
│   ├── joggingService.ts      # 조깅 서비스
│   └── missionService.ts      # 미션 서비스
├── store/               # 상태 관리
│   └── useAppStore.ts   # 전역 상태
├── types/               # TypeScript 타입 정의
├── utils/               # 유틸리티 함수
│   ├── poseAnalyzer.ts  # 자세 분석
│   ├── effects.ts       # 효과 생성
│   └── envLoader.ts     # 환경 변수 로더
└── assets/              # 정적 자산 (이미지, 사운드 등)
```

## 설치 및 실행

### 필수 요구사항

- Node.js 18+ 
- npm 또는 yarn
- Supabase 계정 (데이터베이스용)

### 설치

```bash
npm install
```

### 환경 변수 설정

**환경 변수 파일 위치: `C:/env/.env`**

`C:/env/.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# Supabase 설정 (필수)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI 분석 API URL (선택사항 - 커스텀 API 사용 시)
VITE_AI_API_URL=http://localhost:8000/api

# API 기본 URL (선택사항)
VITE_API_BASE_URL=http://localhost:8000

# OpenAI API Key (운동 분석용)
# OpenAI API를 직접 사용하여 운동 분석을 수행합니다
VITE_OPENAI_API_KEY=sk-proj-your-api-key-here
```

**중요**: 
- 환경 변수 파일은 **`C:/env/.env`** 경로에 위치해야 합니다.
- 모든 환경 변수는 `VITE_` 접두사를 사용해야 합니다.
- Supabase URL과 anon key는 필수입니다. (`DATABASE_SETUP.sql` 실행 후)
- `VITE_OPENAI_API_KEY`를 설정하면 OpenAI API를 직접 사용하여 운동 분석을 수행합니다.
- API 키는 절대 공개 저장소에 커밋하지 마세요.
- `vite.config.ts`에서 빌드 타임에 `C:/env/.env` 파일을 자동으로 로드합니다.
- 파일이 없으면 프로젝트 루트의 `.env` 파일을 사용합니다.

### 데이터베이스 설정

1. **Supabase 프로젝트 생성**
   - [Supabase](https://supabase.com)에서 새 프로젝트 생성
   - 프로젝트 URL과 anon key 확인

2. **데이터베이스 스키마 설정**
   - `DATABASE_SETUP.sql` 파일을 Supabase SQL Editor에서 실행
   - 모든 테이블, 인덱스, RLS 정책이 자동으로 생성됩니다

3. **자세한 설정 가이드는 `PROJECT_DOCUMENTATION.md` 참조**

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

### 빌드

```bash
npm run build
```

## 사용 방법

1. **모드 선택**: 홈에서 시작하기를 클릭하고 싱글/크루/조깅 모드 중 선택
2. **종목 선택**: 운동 종목(스쿼트, 푸시업, 런지 등) 선택
3. **운동량 설정**: 세트와 갯수 설정
4. **운동 시작**: 카메라 권한 허용 후, 화면의 시작 버튼을 손가락으로 클릭
5. **운동 중**: 
   - 실시간으로 자세 점수가 표시됩니다
   - 카운트가 증가할 때마다 음성으로 알려줍니다
   - 점수에 따라 실루엣 색상과 두께가 변경됩니다
6. **운동 종료**: 세트 완료 후 자동으로 결과 페이지로 이동
7. **결과 확인**: 최고/최저 점수 이미지와 AI 분석 결과를 확인

## 지원하는 운동

- 스쿼트 (Squat)
- 푸시업 (Push-up)
- 런지 (Lunge)
- 커스텀 운동 (종목 추가)

## 주요 기능 상세

### 실루엣 표시
점수에 따라 실루엣의 색상과 두께가 자동으로 변경됩니다:
- 높은 점수일수록 두껍고 밝은 색상
- 낮은 점수일수록 얇고 어두운 색상

### 손가락 인식
MediaPipe Hands를 사용하여 손가락 위치를 감지하고, 시작 버튼 영역과 겹치면 자동으로 운동을 시작합니다.

### AI 분석
운동 종료 후 최고/최저 점수 이미지와 평균 점수를 AI API에 전달하여 상세한 분석과 피드백을 받습니다.

## 문서

- **README.md**: 프로젝트 개요 및 빠른 시작 가이드
- **PROJECT_DOCUMENTATION.md**: 상세한 기능 가이드 및 문제 해결
- **DATABASE_SETUP.sql**: 데이터베이스 전체 설정 스크립트

## 라이선스

MIT

## 기여

이슈 및 풀 리퀘스트를 환영합니다!
