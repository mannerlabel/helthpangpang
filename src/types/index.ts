// 자세 인식 관련 타입
export interface PoseKeypoint {
  x: number
  y: number
  z?: number
  score?: number
  name?: string
}

export interface Pose {
  keypoints: PoseKeypoint[]
  score?: number
  box?: {
    xMin: number
    yMin: number
    xMax: number
    yMax: number
    width: number
    height: number
  }
}

// 운동 카운트 관련 타입
export interface ExerciseCount {
  count: number
  timestamp: number
  poseScore: number
  image?: string // base64 이미지 (최고/최저 점수용)
  setNumber: number // 현재 세트 번호
}

// 앱 모드 타입
export type AppMode = 'single' | 'crew' | 'jogging'

// 운동 종목 타입
export type ExerciseType = 'squat' | 'pushup' | 'lunge' | 'custom'

// 운동 설정
export interface ExerciseConfig {
  type: ExerciseType
  sets: number
  reps: number // 갯수
  customName?: string // 종목 추가 시 이름
  restTime?: number // 쉬는 시간 (초, 기본값 10)
}

// 앱 설정
export interface AppSettings {
  audioEnabled: boolean
  audioVolume: number
  voiceType: 'male' | 'female'
  backgroundMusic?: number // 배경음악 ID (1-6)
}

// 운동 세션
export interface ExerciseSession {
  id: string
  mode: AppMode
  config: ExerciseConfig
  startTime?: number
  endTime?: number
  counts: ExerciseCount[]
  bestScore?: {
    score: number
    image: string // base64 이미지
    timestamp: number
  }
  worstScore?: {
    score: number
    image: string // base64 이미지
    timestamp: number
  }
  averageScore: number
}

// 미션 관련 타입
export interface Mission {
  id: string
  name: string
  exerciseType: ExerciseType
  targetCount: number
  duration: number // 초 단위
  participants: string[]
  startTime?: number
  endTime?: number
}

export interface MissionParticipant {
  id: string
  name: string
  currentCount: number
  poseScore: number
}

// 자세 점수 관련 타입
export interface PoseScore {
  overall: number // 0-100
  details: {
    alignment: number
    range: number
    stability: number
  }
  feedback: string[]
}

// 오디오 관련 타입
export interface AudioConfig {
  enabled: boolean
  volume: number
  voiceType?: 'male' | 'female'
  backgroundMusic?: number // 배경음악 ID (1-6)
}

// 그래픽 효과 관련 타입
export interface Effect {
  type: 'emoji' | 'icon' | 'particle'
  content: string
  position: { x: number; y: number }
  duration: number
}

// 실루엣 표시 관련 타입
export interface SilhouetteConfig {
  enabled: boolean
  thickness: number // 점수에 따라 두께 변경
  color: string // 점수에 따라 색상 변경 (무지개 색상)
}

// 손가락 인식 관련 타입
export interface HandDetection {
  detected: boolean
  position?: { x: number; y: number }
  confidence: number
}

// 알람 설정 타입
export interface AlarmConfig {
  enabled: boolean
  time: string // HH:mm 형식
  repeatType: 'daily' | 'weekly' | 'custom' // 매일, 매주, 사용자 정의
  repeatDays?: number[] // 요일 배열 (0=일요일, 1=월요일, ..., 6=토요일)
}

// 조깅 모드 관련 타입
export type JoggingMode = 'alone' | 'together' // 혼자, 함께

export interface JoggingTogetherConfig {
  videoShare: boolean // 영상 공유
  audioShare: boolean // 음성 공유
}

export interface JoggingConfig {
  mode: JoggingMode
  targetDistance?: number // 목표 거리 (km)
  targetTime?: number // 목표 시간 (분)
  alarm?: AlarmConfig // 알람 설정
  togetherConfig?: JoggingTogetherConfig // 함께 모드 설정
}

export interface WeatherInfo {
  date: string // 날짜
  temperature: number // 온도 (℃)
  humidity: number // 습도 (%)
  uvIndex: number // 자외선 지수
  condition: string // 날씨 상태 (맑음, 흐림 등)
}

export interface JoggingData {
  distance: number // km
  averageSpeed: number // km/h
  averageTime: number // 초
  route: Array<{ lat: number; lng: number; timestamp: number }>
  startTime: number
  endTime?: number
  config?: JoggingConfig // 조깅 설정
  weather?: WeatherInfo[] // 날씨 정보 (오늘, 내일, 모레)
}

// AI 분석 결과
export interface AIAnalysis {
  summary: string
  bestPoseFeedback: string
  worstPoseFeedback: string
  averageScore: number
  recommendations: string[]
  exerciseType: ExerciseType
}

// 크루 모드 관련 타입 (Supabase 연동 준비)
export interface Crew {
  id: string
  name: string // 크루명
  maxMembers: number | null // 최대 멤버 수 (null이면 제한없음)
  currentMembers: number // 현재 멤버 수
  exerciseType: ExerciseType // 종목
  exerciseConfig: ExerciseConfig // 운동량 (sets, reps 등)
  alarm?: AlarmConfig // 알람 설정
  createdAt: number // 생성 시간
  createdBy: string // 생성자 ID (차후 Supabase user_id로 대체)
  memberIds: string[] // 멤버 ID 목록 (차후 Supabase 관계로 대체)
}

export interface CrewMember {
  id: string
  crewId: string
  userId: string // 차후 Supabase user_id로 대체
  joinedAt: number
  role: 'owner' | 'member' // 크루장 또는 멤버
}

// 싱글 모드 목표 관련 타입 (Supabase 연동 준비)
export interface SingleGoal {
  id: string
  name: string // 목표명
  exerciseType: ExerciseType // 운동 종목
  exerciseConfig: ExerciseConfig // 운동량 (sets, reps 등)
  alarm?: AlarmConfig // 알람 설정
  backgroundMusic?: number // 배경 사운드 ID (1-6)
  createdAt: number // 생성 시간
  createdBy: string // 생성자 ID (차후 Supabase user_id로 대체)
  isActive: boolean // 활성 상태
}

