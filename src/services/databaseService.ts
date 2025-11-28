/**
 * 데이터베이스 서비스
 * Supabase 전용 - 모든 데이터는 Supabase에 저장/로드
 */

import { supabase } from './supabaseClient'
import { authService } from './authService'
import { SingleGoal, JoggingGoal } from '@/types'

// Supabase 사용 여부 확인
const USE_SUPABASE = !!(import.meta as any).env?.VITE_SUPABASE_URL && !!(import.meta as any).env?.VITE_SUPABASE_ANON_KEY && supabase !== null

// 디버깅용 로그
if (USE_SUPABASE) {
  console.log('✅ Supabase 사용 중:', (import.meta as any).env?.VITE_SUPABASE_URL)
} else {
  console.error('❌ Supabase가 설정되지 않았습니다. .env 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해주세요.')
  throw new Error('Supabase 설정이 필요합니다. .env 파일을 확인해주세요.')
}

// 데이터베이스 테이블 타입 정의
export interface User {
  id: string
  email: string
  password: string // 실제로는 해시된 비밀번호
  name: string
  avatar?: string
  createdAt: number
  lastLoginAt?: number
  role?: 'user' | 'admin' // 기본값: 'user'
  isDeleted?: boolean // 탈퇴 여부
  deletedAt?: number // 탈퇴 시간
}

export interface Crew {
  id: string
  name: string
  maxMembers: number | null
  currentMembers: number
  exerciseType: string
  exerciseConfig: {
    type: string
    sets: number
    reps: number
    restTime: number
  }
  alarm?: {
    enabled: boolean
    time: string
    repeatType: 'daily' | 'weekly' | 'custom'
    repeatDays?: number[]
  }
  createdAt: number
  createdBy: string
  memberIds: string[]
  videoShareEnabled: boolean // 영상 공유 활성화 여부
  audioShareEnabled: boolean // 음성 공유 활성화 여부
  recommendations: number // 추천수
  isDormant?: boolean // 휴면 모드 여부
  lastActivityAt?: number // 마지막 활동 시간
  dormantAt?: number // 휴면 지정 시간
  scheduledDeletionAt?: number // 예정된 삭제 시간
}

export interface CrewMember {
  id: string
  crewId: string
  userId: string
  joinedAt: number
  role: 'owner' | 'member'
  videoEnabled: boolean // 개인 영상 공유 상태
  audioEnabled: boolean // 개인 음성 공유 상태
}

export interface JoggingCrew {
  id: string
  name: string
  maxMembers: number | null
  currentMembers: number
  targetDistance?: number // km
  targetTime?: number // 분
  alarm?: {
    enabled: boolean
    time: string
    repeatType: 'daily' | 'weekly' | 'custom'
    repeatDays?: number[]
  }
  videoShareEnabled: boolean
  audioShareEnabled: boolean
  createdAt: number
  createdBy: string
  memberIds: string[]
  recommendations: number // 추천수
  isDormant?: boolean // 휴면 모드 여부
  lastActivityAt?: number // 마지막 활동 시간
  dormantAt?: number // 휴면 지정 시간
  scheduledDeletionAt?: number // 예정된 삭제 시간
}

export interface ChatMessage {
  id: string
  crewId: string
  userId: string
  userName: string
  message: string
  timestamp: number
  type: 'text' | 'system'
}

export interface JoggingSession {
  id: string
  userId: string
  crewId?: string // 함께 조깅 모드일 경우
  mode: 'alone' | 'together'
  distance: number
  averageSpeed: number
  averageTime: number
  route: Array<{ lat: number; lng: number; timestamp: number }>
  startTime: number
  endTime?: number
  completed: boolean
  score?: number // AI 분석 점수
}

export interface SharedJoggingCourse {
  id: string
  userId: string // 생성자 ID
  name?: string // 코스 이름 (선택사항)
  route: Array<{ lat: number; lng: number; timestamp: number }>
  totalDistance: number // 총 거리 (km)
  createdAt: number
  updatedAt?: number
}

// 실시간 조깅 경로 공유 (조깅크루용)
export interface RealtimeJoggingRoute {
  id: string
  userId: string
  crewId: string
  userName?: string // 사용자 이름 (조회 시 조인)
  route: Array<{ lat: number; lng: number; timestamp: number }>
  totalDistance: number // 누적 거리 (km)
  startTime: number
  lastUpdateTime: number // 최근 경로 저장 시간
  isActive: boolean // 조깅 중인지 여부
}

export interface ExerciseSession {
  id: string
  userId: string
  crewId?: string
  mode: 'single' | 'crew'
  config: {
    type: string
    sets: number
    reps: number
    restTime: number
  }
  startTime: number
  endTime?: number
  counts: Array<{
    count: number
    timestamp: number
    poseScore: number
    image?: string
    setNumber: number
    angle?: number // 관절 각도
    depth?: number // 운동 깊이
    state?: string // 운동 상태
  }>
  bestScore?: {
    score: number
    image: string
    timestamp: number
  }
  worstScore?: {
    score: number
    image: string
    timestamp: number
  }
  averageScore: number
  completed: boolean
}

export interface ExerciseVideoPose {
  timestamp: number
  image: string // base64 encoded image
  keypoints: Array<{
    x: number
    y: number
    z?: number
    score?: number
    name?: string
  }>
  angles: {
    [key: string]: number // 예: "left_elbow": 90, "right_elbow": 90
  }
  description: string // 예: "팔각도 90도, 다리각도 180도, 일어서기"
}

export interface ExerciseVideo {
  id: string
  title: string
  description?: string
  videoUrl?: string
  createdBy: string
  createdAt: number
  updatedAt: number
  isActive: boolean
  poseData: ExerciseVideoPose[]
  totalPoses: number
  durationSeconds: number
}

class DatabaseService {
  private initialized = false
  private userIdMappingCache: Map<string, string> = new Map() // 사용자 ID 매핑 캐시

  // 데이터베이스 초기화
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    // Supabase가 설정되지 않았으면 에러
    if (!USE_SUPABASE || !supabase) {
      throw new Error('Supabase가 설정되지 않았습니다. .env 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해주세요.')
    }

    this.initialized = true
  }

  // 데이터베이스 초기화 (빈 데이터)
  private initDatabase(): void {
    const tables = {
      users: [],
      crews: [],
      crew_members: [],
      jogging_crews: [],
      jogging_sessions: [],
      exercise_sessions: [],
      chats: [],
      single_goals: [],
      jogging_goals: [],
    }

    Object.entries(tables).forEach(([key, value]) => {
      localStorage.setItem(`db_${key}`, JSON.stringify(value))
    })
  }

  // 초기 테스트 사용자 확인 및 생성
  private async ensureTestUsers(): Promise<void> {
    const testUsers = [
      { email: 'bap@healthpangpang.com', password: '123456', name: '밥' },
      { email: 'banchan@healthpangpang.com', password: '123456', name: '반찬' },
      { email: 'meng@healthpangpang.com', password: '123456', name: '맹' },
    ]

    // initialize()가 완료된 후에만 실행되므로 직접 테이블에 접근
    const users = this.readTable<User>('users')

    for (const user of testUsers) {
      // 이미 존재하는지 확인
      const existing = users.find((u) => u.email === user.email)
      if (!existing) {
        // createUser를 호출하지 않고 직접 추가 (순환 호출 방지)
        const newUser: User = {
          email: user.email,
          password: btoa(user.password), // base64 인코딩 (authService의 hashPassword와 동일)
          name: user.name,
          id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: Date.now(),
        }
        users.push(newUser)
      }
    }

    // 변경사항 저장
    if (users.length > 0) {
      this.writeTable('users', users)
    }
  }

  // 초기 테스트 크루 확인 및 생성
  private async ensureTestCrews(): Promise<void> {
    const users = this.readTable<User>('users')
    const crews = this.readTable<Crew>('crews')

    // 테스트 사용자 찾기
    const bap = users.find((u) => u.email === 'bap@healthpangpang.com')
    const banchan = users.find((u) => u.email === 'banchan@healthpangpang.com')
    const meng = users.find((u) => u.email === 'meng@healthpangpang.com')

    if (!bap || !banchan || !meng) {
      // 사용자가 아직 생성되지 않았으면 크루 생성 건너뛰기
      return
    }

    // 밥의 크루 3개
    const bapCrews: Array<Omit<Crew, 'id' | 'createdAt' | 'currentMembers' | 'memberIds' | 'recommendations'>> = [
      {
        name: '아침 스쿼트 크루',
        maxMembers: 20,
        exerciseType: 'squat',
        exerciseConfig: { type: 'squat', sets: 3, reps: 10, restTime: 10 },
        alarm: { enabled: true, time: '06:00', repeatType: 'daily' },
        createdBy: bap.id,
        videoShareEnabled: true,
        audioShareEnabled: true,
      },
      {
        name: '저녁 푸시업 크루',
        maxMembers: null,
        exerciseType: 'pushup',
        exerciseConfig: { type: 'pushup', sets: 4, reps: 15, restTime: 15 },
        alarm: { enabled: true, time: '19:00', repeatType: 'daily' },
        createdBy: bap.id,
        videoShareEnabled: false,
        audioShareEnabled: true,
      },
      {
        name: '주말 런지 크루',
        maxMembers: 15,
        exerciseType: 'lunge',
        exerciseConfig: { type: 'lunge', sets: 3, reps: 12, restTime: 10 },
        alarm: { enabled: true, time: '09:00', repeatType: 'weekly' },
        createdBy: bap.id,
        videoShareEnabled: true,
        audioShareEnabled: false,
      },
    ]

    // 반찬의 크루 3개
    const banchanCrews: Array<Omit<Crew, 'id' | 'createdAt' | 'currentMembers' | 'memberIds' | 'recommendations'>> = [
      {
        name: '올데이 스쿼트',
        maxMembers: 30,
        exerciseType: 'squat',
        exerciseConfig: { type: 'squat', sets: 5, reps: 20, restTime: 20 },
        alarm: { enabled: true, time: '08:00', repeatType: 'daily' },
        createdBy: banchan.id,
        videoShareEnabled: true,
        audioShareEnabled: true,
      },
      {
        name: '푸시업 챌린지',
        maxMembers: null,
        exerciseType: 'pushup',
        exerciseConfig: { type: 'pushup', sets: 3, reps: 25, restTime: 10 },
        alarm: { enabled: true, time: '07:30', repeatType: 'daily' },
        createdBy: banchan.id,
        videoShareEnabled: false,
        audioShareEnabled: false,
      },
      {
        name: '점심 운동 크루',
        maxMembers: 10,
        exerciseType: 'squat',
        exerciseConfig: { type: 'squat', sets: 2, reps: 15, restTime: 5 },
        alarm: { enabled: true, time: '12:00', repeatType: 'daily' },
        createdBy: banchan.id,
        videoShareEnabled: true,
        audioShareEnabled: true,
      },
    ]

    // 맹의 크루 3개
    const mengCrews: Array<Omit<Crew, 'id' | 'createdAt' | 'currentMembers' | 'memberIds' | 'recommendations'>> = [
      {
        name: '저녁 런지 크루',
        maxMembers: 25,
        exerciseType: 'lunge',
        exerciseConfig: { type: 'lunge', sets: 4, reps: 10, restTime: 15 },
        alarm: { enabled: true, time: '20:00', repeatType: 'daily' },
        createdBy: meng.id,
        videoShareEnabled: true,
        audioShareEnabled: false,
      },
      {
        name: '주중 운동 크루',
        maxMembers: null,
        exerciseType: 'pushup',
        exerciseConfig: { type: 'pushup', sets: 3, reps: 20, restTime: 12 },
        alarm: { enabled: true, time: '18:30', repeatType: 'custom' },
        createdBy: meng.id,
        videoShareEnabled: false,
        audioShareEnabled: true,
      },
      {
        name: '초보자 크루',
        maxMembers: 15,
        exerciseType: 'squat',
        exerciseConfig: { type: 'squat', sets: 2, reps: 8, restTime: 20 },
        alarm: { enabled: true, time: '09:00', repeatType: 'weekly' },
        createdBy: meng.id,
        videoShareEnabled: true,
        audioShareEnabled: true,
      },
    ]

    // 모든 크루 생성
    const allCrews = [...bapCrews, ...banchanCrews, ...mengCrews]
    const existingCrewNames = new Set(crews.map((c) => c.name))

    for (const crewData of allCrews) {
      // 이미 존재하는 크루는 건너뛰기
      if (existingCrewNames.has(crewData.name)) {
        continue
      }

      // createCrew를 호출하지 않고 직접 추가 (순환 호출 방지)
      const newCrew: Crew = {
        ...crewData,
        id: `crew_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now() - Math.random() * 86400000 * 30, // 최근 30일 내 랜덤 시간
        currentMembers: 1,
        memberIds: [crewData.createdBy],
        recommendations: Math.floor(Math.random() * 50), // 0-49 랜덤 추천수
      }
      crews.push(newCrew)

      // 크루 멤버도 추가 (크루장)
      const members = this.readTable<CrewMember>('crew_members')
      const newMember: CrewMember = {
        id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        crewId: newCrew.id,
        userId: crewData.createdBy,
        joinedAt: newCrew.createdAt,
        role: 'owner',
        videoEnabled: false,
        audioEnabled: false,
      }
      members.push(newMember)
      this.writeTable('crew_members', members)
    }

    // 변경사항 저장
    if (crews.length > 0) {
      this.writeTable('crews', crews)
    }
  }

  // 초기 테스트 조깅 크루 확인 및 생성
  private async ensureTestJoggingCrews(): Promise<void> {
    let allUsers: User[] = []
    
    if (USE_SUPABASE && supabase) {
      try {
        // Supabase에서 모든 사용자 가져오기
        const { data: supabaseUsers, error } = await supabase
          .from('users')
          .select('*')
        
        if (error) {
          console.error('사용자 조회 실패:', error)
          return
        }
        
        if (!supabaseUsers || supabaseUsers.length === 0) {
          return
        }
        
        // Supabase 사용자를 User 형식으로 변환
        allUsers = supabaseUsers.map(u => this.mapSupabaseUser(u))
      } catch (e) {
        console.error('Supabase 사용자 조회 중 오류:', e)
        return
      }
    } else {
      // localStorage에서 사용자 가져오기
      const users = this.readTable<User>('users')
      allUsers = users
    }
    
    if (allUsers.length === 0) {
      return
    }
    
    // 기존 크루 이름 확인 (Supabase와 localStorage 모두)
    const existingCrewNames = new Set<string>()
    
    if (USE_SUPABASE && supabase) {
      try {
        const { data: existingCrews } = await supabase
          .from('jogging_crews')
          .select('name')
        
        if (existingCrews) {
          existingCrews.forEach(c => existingCrewNames.add(c.name))
        }
      } catch (e) {
        console.error('기존 조깅 크루 조회 실패:', e)
      }
    }
    
    const joggingCrews = this.readTable<JoggingCrew>('jogging_crews')
    joggingCrews.forEach(c => existingCrewNames.add(c.name))

    for (const user of allUsers) {
      const userJoggingCrews: Array<Omit<JoggingCrew, 'id' | 'createdAt' | 'currentMembers' | 'memberIds' | 'recommendations'>> = [
        {
          name: `${user.name}의 아침 조깅 크루`,
          maxMembers: 20,
          targetDistance: 5,
          targetTime: 30,
          alarm: { enabled: true, time: '06:00', repeatType: 'daily' },
          createdBy: user.id,
          videoShareEnabled: true,
          audioShareEnabled: true,
        },
        {
          name: `${user.name}의 저녁 러닝 크루`,
          maxMembers: null,
          targetDistance: 10,
          targetTime: 60,
          alarm: { enabled: true, time: '19:00', repeatType: 'daily' },
          createdBy: user.id,
          videoShareEnabled: false,
          audioShareEnabled: true,
        },
      ]

      for (const crewData of userJoggingCrews) {
        // 이미 존재하는 크루는 건너뛰기
        if (existingCrewNames.has(crewData.name)) {
          continue
        }

        // createJoggingCrew를 호출하지 않고 직접 추가 (순환 호출 방지)
        const newCrew: JoggingCrew = {
          ...crewData,
          id: `jcrew_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: Date.now() - Math.random() * 86400000 * 30, // 최근 30일 내 랜덤 시간
          currentMembers: 1,
          memberIds: [crewData.createdBy],
          recommendations: Math.floor(Math.random() * 50), // 0-49 랜덤 추천수
        }
        joggingCrews.push(newCrew)
        existingCrewNames.add(crewData.name)

        // 조깅 크루 멤버도 추가 (크루장)
        if (USE_SUPABASE && supabase) {
          try {
            let supabaseUserId = crewData.createdBy
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            if (!uuidRegex.test(crewData.createdBy)) {
              supabaseUserId = await this.getSupabaseUserId(crewData.createdBy)
            }

            // Supabase에 조깅 크루 생성
            const { data, error } = await supabase
              .from('jogging_crews')
              .insert({
                name: newCrew.name,
                max_members: newCrew.maxMembers,
                target_distance: newCrew.targetDistance || null,
                target_time: newCrew.targetTime || null,
                alarm: newCrew.alarm || null,
                created_by: supabaseUserId,
                video_share_enabled: newCrew.videoShareEnabled || false,
                audio_share_enabled: newCrew.audioShareEnabled || false,
                current_members: 1,
                member_ids: [supabaseUserId],
                recommendations: newCrew.recommendations,
              })
              .select()
              .single()

            if (error) {
              console.error('Supabase 조깅 크루 샘플 생성 실패:', error)
            }
          } catch (e) {
            console.error('Supabase 조깅 크루 샘플 생성 중 오류:', e)
          }
        }
      }
    }

    // 변경사항 저장 (localStorage)
    if (joggingCrews.length > 0) {
      this.writeTable('jogging_crews', joggingCrews)
    }
  }

  // 테이블 읽기
  private readTable<T>(tableName: string): T[] {
    try {
      const data = localStorage.getItem(`db_${tableName}`)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error(`Error reading table ${tableName}:`, error)
      return []
    }
  }

  // 테이블 쓰기
  private writeTable<T>(tableName: string, data: T[]): void {
    try {
      localStorage.setItem(`db_${tableName}`, JSON.stringify(data))
    } catch (error) {
      console.error(`Error writing table ${tableName}:`, error)
      throw error
    }
  }

  // ============ User 관련 ============
  async createUser(user: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    await this.initialize()
    
    if (!USE_SUPABASE || !supabase) {
      throw new Error('Supabase가 설정되지 않았습니다.')
    }
    
    try {
      const { data, error } = await supabase
        .from('users')
        .insert({
          email: user.email,
          password: user.password,
          name: user.name,
          avatar: user.avatar || null,
        })
        .select()
        .single()
      
      if (error) {
        console.error('Supabase 사용자 생성 실패:', error)
        throw error
      }
      
      return this.mapSupabaseUser(data)
    } catch (e) {
      console.error('사용자 생성 중 오류:', e)
      throw e
    }
  }

  async getUserById(id: string): Promise<User | null> {
    await this.initialize()
    
    if (!USE_SUPABASE || !supabase) {
      throw new Error('Supabase가 설정되지 않았습니다.')
    }
    
    try {
      // localStorage 형식의 ID를 Supabase UUID로 변환
      let supabaseUserId = id
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(id)) {
        // UUID 형식이 아니면 변환 시도
        try {
          supabaseUserId = await this.getSupabaseUserId(id)
        } catch (error) {
          // 변환 실패 시 null 반환 (사용자를 찾을 수 없음)
          console.warn(`사용자 ID 변환 실패 (${id}):`, error)
          return null
        }
      }
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseUserId)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          // 데이터가 없음
          return null
        }
        console.error('Supabase getUserById 실패:', error)
        throw error
      }
      
      return data ? this.mapSupabaseUser(data) : null
    } catch (e) {
      console.error('getUserById 오류:', e)
      throw e
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    await this.initialize()
    
    if (!USE_SUPABASE || !supabase) {
      throw new Error('Supabase가 설정되지 않았습니다.')
    }
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          // 데이터가 없음
          return null
        }
        console.error('Supabase getUserByEmail 실패:', error)
        throw error
      }
      
      return data ? this.mapSupabaseUser(data) : null
    } catch (e) {
      console.error('getUserByEmail 오류:', e)
      throw e
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    await this.initialize()
    
    if (!USE_SUPABASE || !supabase) {
      throw new Error('Supabase가 설정되지 않았습니다.')
    }
    
    try {
      const updateData: any = {}
      if (updates.email) updateData.email = updates.email
      if (updates.password) updateData.password = updates.password
      if (updates.name) updateData.name = updates.name
      if (updates.avatar !== undefined) updateData.avatar = updates.avatar
      if (updates.lastLoginAt) updateData.last_login_at = new Date(updates.lastLoginAt).toISOString()
      if (updates.role !== undefined) updateData.role = updates.role
      if (updates.isDeleted !== undefined) updateData.is_deleted = updates.isDeleted
      if (updates.deletedAt !== undefined) updateData.deleted_at = updates.deletedAt ? new Date(updates.deletedAt).toISOString() : null
      
      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
      
      if (error) {
        console.error('Supabase updateUser 실패:', error)
        throw error
      }
      
      return data ? this.mapSupabaseUser(data) : null
    } catch (e) {
      console.error('updateUser 오류:', e)
      throw e
    }
  }

  // ============ Crew 관련 ============
  async createCrew(crew: Omit<Crew, 'id' | 'createdAt' | 'currentMembers' | 'memberIds' | 'recommendations'>): Promise<Crew> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        // UUID 매핑
        let supabaseUserId = crew.createdBy
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(crew.createdBy)) {
          supabaseUserId = await this.getSupabaseUserId(crew.createdBy)
        }
        
        const { data, error } = await supabase
          .from('crews')
          .insert({
            name: crew.name,
            max_members: crew.maxMembers,
            exercise_type: crew.exerciseType,
            exercise_config: crew.exerciseConfig,
            alarm: crew.alarm || null,
            created_by: supabaseUserId,
            video_share_enabled: crew.videoShareEnabled || false,
            audio_share_enabled: crew.audioShareEnabled || false,
            current_members: 1,
            member_ids: [supabaseUserId],
            recommendations: 0,
          })
          .select()
          .single()
        
        if (error) {
          console.error('Supabase 크루 생성 실패:', error)
          throw error
        }
        
        // 크루 멤버 추가
        await this.addCrewMember(data.id, supabaseUserId, 'owner')
        
        return this.mapSupabaseCrew(data)
      } catch (e) {
        console.error('Supabase 크루 생성 중 오류:', e)
        throw e
      }
    }
    
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  async getCrewById(id: string): Promise<Crew | null> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      if (!supabase) throw new Error('Supabase client not initialized')
      
      const { data: crew, error } = await supabase
        .from('crews')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('크루 조회 에러:', error)
        if (error.code === 'PGRST116') {
          // 결과가 없음
          return null
        }
        throw error
      }

      if (!crew) return null

      // 실시간으로 멤버 수 계산
      const { data: members } = await supabase
        .from('crew_members')
        .select('user_id')
        .eq('crew_id', id)

      const actualMemberCount = members?.length || 0
      const actualMemberIds = members?.map(m => m.user_id) || []

      // 멤버 수가 다르면 업데이트
      if (crew.current_members !== actualMemberCount || 
          JSON.stringify((crew.member_ids || []).sort()) !== JSON.stringify(actualMemberIds.sort())) {
        try {
          await supabase
            .from('crews')
            .update({
              current_members: actualMemberCount,
              member_ids: actualMemberIds.length > 0 ? actualMemberIds : [],
            })
            .eq('id', id)
        } catch (updateError: any) {
          console.warn('크루 멤버 수 업데이트 실패:', updateError)
          // current_members만 업데이트 시도
          try {
            await supabase
              .from('crews')
              .update({
                current_members: actualMemberCount,
              })
              .eq('id', id)
          } catch (e) {
            console.warn('current_members 업데이트도 실패:', e)
          }
        }
      }

      return this.mapSupabaseCrew({
        ...crew,
        current_members: actualMemberCount,
        member_ids: actualMemberIds,
      })
    } else {
    const crews = this.readTable<Crew>('crews')
      const crew = crews.find((c) => c.id === id)
      if (!crew) return null
      
      // 실시간으로 멤버 수 계산하여 반환
      const members = this.readTable<CrewMember>('crew_members')
      const crewMembers = members.filter((m) => m.crewId === id)
      const actualMemberCount = crewMembers.length
      const actualMemberIds = crewMembers.map((m) => m.userId)
      
      // 실제 멤버 수와 저장된 멤버 수가 다르면 업데이트
      if (crew.currentMembers !== actualMemberCount || 
          JSON.stringify(crew.memberIds.sort()) !== JSON.stringify(actualMemberIds.sort())) {
        await this.updateCrew(id, {
          currentMembers: actualMemberCount,
          memberIds: actualMemberIds,
        })
        return { ...crew, currentMembers: actualMemberCount, memberIds: actualMemberIds }
      }
      
      return crew
    }
  }

  async getCrewsByUserId(userId: string, limit: number = 50, offset: number = 0): Promise<{ data: Crew[]; hasMore: boolean; total?: number }> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      // localStorage 사용자는 UUID가 아닐 수 있으므로, email로 Supabase 사용자 찾기
      let supabaseUserId = userId
      
      // UUID 형식이 아니면 email로 사용자 찾기
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(userId)) {
        // 캐시 확인
        if (this.userIdMappingCache.has(userId)) {
          supabaseUserId = this.userIdMappingCache.get(userId)!
        } else {
          // localStorage 사용자 정보에서 email 가져오기
          const userStr = localStorage.getItem(`user_${userId}`)
          if (userStr) {
            const user = JSON.parse(userStr)
            if (user.email) {
              // Supabase에서 email로 사용자 찾기
              const { data: supabaseUser, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('email', user.email)
                .single()
              
              if (userError) {
                console.warn('Supabase 사용자를 찾을 수 없음:', userError)
                return [] // Supabase에 사용자가 없으면 빈 배열 반환
              }
              
              if (supabaseUser) {
                supabaseUserId = supabaseUser.id
                // 캐시에 저장하여 반복 쿼리 방지
                this.userIdMappingCache.set(userId, supabaseUserId)
                console.log('Supabase 사용자 ID 매핑 (캐시 저장):', userId, '->', supabaseUserId)
              } else {
                return [] // Supabase에 사용자가 없으면 빈 배열 반환
              }
            }
          }
        }
      }
      
      // 사용자가 멤버인 크루 조회
      const { data: memberRecords, error } = await supabase
        .from('crew_members')
        .select('crew_id')
        .eq('user_id', supabaseUserId)

      if (error) {
        console.error('crew_members 조회 에러:', error)
        throw error
      }
      
      if (!memberRecords || memberRecords.length === 0) return { data: [], hasMore: false }

      const crewIds = memberRecords.map(m => m.crew_id)
      const totalCrews = crewIds.length
      
      // 페이지네이션 적용
      const paginatedCrewIds = crewIds.slice(offset, offset + limit)
      
      const { data: crews, error: crewsError } = await supabase
        .from('crews')
        .select('*')
        .in('id', paginatedCrewIds)

      if (crewsError) {
        console.error('crews 조회 에러:', crewsError)
        throw crewsError
      }

      // 각 크루의 실시간 멤버 수 계산
      if (!supabase) throw new Error('Supabase client not initialized')
      const supabaseClient = supabase // 지역 변수로 할당하여 null 체크 우회
      
      const crewsWithMembers = await Promise.all(
        (crews || []).map(async (crew) => {
          const { data: members } = await supabaseClient
            .from('crew_members')
            .select('user_id')
            .eq('crew_id', crew.id)

          const actualMemberCount = members?.length || 0
          const actualMemberIds = members?.map(m => m.user_id) || []

          // member_ids 업데이트는 선택적으로 (에러 발생 시 무시)
          if (crew.current_members !== actualMemberCount || 
              JSON.stringify((crew.member_ids || []).sort()) !== JSON.stringify(actualMemberIds.sort())) {
            try {
              await supabaseClient
                .from('crews')
                .update({
                  current_members: actualMemberCount,
                  member_ids: actualMemberIds.length > 0 ? actualMemberIds : [],
                })
                .eq('id', crew.id)
            } catch (updateError: any) {
              // member_ids 업데이트 실패는 무시하고 current_members만 업데이트 시도
              console.warn('member_ids 업데이트 실패, current_members만 업데이트:', updateError)
              try {
                await supabaseClient
                  .from('crews')
                  .update({
                    current_members: actualMemberCount,
                  })
                  .eq('id', crew.id)
              } catch (e) {
                console.warn('current_members 업데이트도 실패:', e)
              }
            }
          }

          // createdBy 필드도 UUID 매핑 필요 (localStorage 사용자 ID를 Supabase UUID로 변환)
          let mappedCreatedBy = crew.created_by
          if (crew.created_by === supabaseUserId) {
            // Supabase UUID와 일치하면 localStorage 사용자 ID로 매핑
            mappedCreatedBy = userId
          }

          return this.mapSupabaseCrew({
            ...crew,
            current_members: actualMemberCount,
            member_ids: actualMemberIds,
            created_by: mappedCreatedBy, // 매핑된 createdBy 사용
          })
        })
      )

      const hasMore = offset + limit < totalCrews
      return { data: crewsWithMembers, hasMore, total: totalCrews }
    } else {
    const crews = this.readTable<Crew>('crews')
      const members = this.readTable<CrewMember>('crew_members')
      
      // 실시간으로 멤버 수 계산하여 반환
      const filteredCrews = crews.filter((c) => c.memberIds.includes(userId))
      const totalCrews = filteredCrews.length
      const paginatedCrews = filteredCrews.slice(offset, offset + limit)
      
      const crewsWithMembers = paginatedCrews.map((crew) => {
          const crewMembers = members.filter((m) => m.crewId === crew.id)
          const actualMemberCount = crewMembers.length
          const actualMemberIds = crewMembers.map((m) => m.userId)
          
          // 실제 멤버 수와 저장된 멤버 수가 다르면 업데이트
          if (crew.currentMembers !== actualMemberCount || 
              JSON.stringify(crew.memberIds.sort()) !== JSON.stringify(actualMemberIds.sort())) {
            this.updateCrew(crew.id, {
              currentMembers: actualMemberCount,
              memberIds: actualMemberIds,
            })
            return { ...crew, currentMembers: actualMemberCount, memberIds: actualMemberIds }
          }
          return crew
        })
      
      const hasMore = offset + limit < totalCrews
      return { data: crewsWithMembers, hasMore, total: totalCrews }
    }
  }

  async getAllCrews(limit: number = 50, offset: number = 0): Promise<{ data: Crew[]; hasMore: boolean; total?: number }> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      console.log('Supabase에서 크루 목록 가져오기 시작')
      const { data: crews, error, count } = await supabase
        .from('crews')
        .select('*', { count: 'exact' })
        .eq('is_dormant', false) // 휴면 크루 제외
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('Supabase 크루 조회 에러:', error)
        console.error('에러 상세:', error.message, error.code, error.details, error.hint)
        throw error
      }
      
      console.log('Supabase에서 가져온 크루 수:', crews?.length || 0)
      if (crews && crews.length > 0) {
        console.log('첫 번째 크루 샘플:', crews[0])
      }

      // 각 크루의 실시간 멤버 수 계산
      if (!supabase) throw new Error('Supabase client not initialized')
      const supabaseClient = supabase // 지역 변수로 할당하여 null 체크 우회
      
      const crewsWithMembers = await Promise.all(
        (crews || []).map(async (crew) => {
          const { data: members } = await supabaseClient
            .from('crew_members')
            .select('user_id')
            .eq('crew_id', crew.id)

          const actualMemberCount = members?.length || 0
          const actualMemberIds = members?.map(m => m.user_id) || []

          // member_ids 업데이트는 선택적으로 (에러 발생 시 무시)
          if (crew.current_members !== actualMemberCount || 
              JSON.stringify((crew.member_ids || []).sort()) !== JSON.stringify(actualMemberIds.sort())) {
            try {
              await supabaseClient
                .from('crews')
                .update({
                  current_members: actualMemberCount,
                  member_ids: actualMemberIds.length > 0 ? actualMemberIds : [],
                })
                .eq('id', crew.id)
            } catch (updateError: any) {
              // member_ids 업데이트 실패는 무시하고 current_members만 업데이트 시도
              console.warn('member_ids 업데이트 실패, current_members만 업데이트:', updateError)
              try {
                await supabaseClient
                  .from('crews')
                  .update({
                    current_members: actualMemberCount,
                  })
                  .eq('id', crew.id)
              } catch (e) {
                console.warn('current_members 업데이트도 실패:', e)
              }
            }
          }

          return this.mapSupabaseCrew({
            ...crew,
            current_members: actualMemberCount,
            member_ids: actualMemberIds,
          })
        })
      )

      const hasMore = count ? offset + limit < count : false
      return { data: crewsWithMembers, hasMore, total: count || undefined }
    }
    
    // localStorage 폴백
    const crews = this.readTable<Crew>('crews')
    const paginatedCrews = crews.slice(offset, offset + limit)
    const hasMore = offset + limit < crews.length
    return { data: paginatedCrews, hasMore, total: crews.length }
  }

  async updateCrew(id: string, updates: Partial<Crew>): Promise<Crew | null> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        const updateData: any = {}
        if (updates.name !== undefined) updateData.name = updates.name
        if (updates.maxMembers !== undefined) updateData.max_members = updates.maxMembers
        if (updates.exerciseType !== undefined) updateData.exercise_type = updates.exerciseType
        if (updates.exerciseConfig !== undefined) updateData.exercise_config = updates.exerciseConfig
        if (updates.alarm !== undefined) updateData.alarm = updates.alarm || null
        if (updates.videoShareEnabled !== undefined) updateData.video_share_enabled = updates.videoShareEnabled
        if (updates.audioShareEnabled !== undefined) updateData.audio_share_enabled = updates.audioShareEnabled
        if (updates.currentMembers !== undefined) updateData.current_members = updates.currentMembers
        if (updates.memberIds !== undefined) updateData.member_ids = updates.memberIds
        if (updates.recommendations !== undefined) updateData.recommendations = updates.recommendations
        if (updates.isDormant !== undefined) updateData.is_dormant = updates.isDormant
        if (updates.lastActivityAt !== undefined) updateData.last_activity_at = new Date(updates.lastActivityAt).toISOString()
        if (updates.dormantAt !== undefined) updateData.dormant_at = updates.dormantAt ? new Date(updates.dormantAt).toISOString() : null
        if (updates.scheduledDeletionAt !== undefined) updateData.scheduled_deletion_at = updates.scheduledDeletionAt ? new Date(updates.scheduledDeletionAt).toISOString() : null
        
        const { data, error } = await supabase
          .from('crews')
          .update(updateData)
          .eq('id', id)
          .select()
          .single()
        
        if (error) {
          console.error('Supabase 크루 수정 실패:', error)
          throw error
        }
        
        return data ? this.mapSupabaseCrew(data) : null
      } catch (e) {
        console.error('Supabase 크루 수정 중 오류:', e)
        throw e
      }
    }
    
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  async deleteCrew(id: string): Promise<boolean> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        // 채팅 메시지 먼저 삭제 (CASCADE로 자동 삭제되지만 명시적으로 삭제)
        await supabase
          .from('chat_messages')
          .delete()
          .eq('crew_id', id)
        
        // 크루 멤버 삭제
        await supabase
          .from('crew_members')
          .delete()
          .eq('crew_id', id)
        
        // 크루 삭제
        const { error } = await supabase
          .from('crews')
          .delete()
          .eq('id', id)
        
        if (error) {
          console.error('Supabase 크루 삭제 실패:', error)
          throw error
        }
        
        return true
      } catch (e) {
        console.error('Supabase 크루 삭제 중 오류:', e)
        // Supabase 실패 시 에러를 다시 throw하여 사용자에게 알림
        throw e
      }
    }
    
    // localStorage 삭제
    const crews = this.readTable<Crew>('crews')
    const filtered = crews.filter((c) => c.id !== id)
    this.writeTable('crews', filtered)
    
    // 채팅 메시지도 삭제
    const chats = this.readTable<ChatMessage>('chats')
    const filteredChats = chats.filter((c) => c.crewId !== id)
    this.writeTable('chats', filteredChats)
    
    // 크루 멤버도 삭제
    const members = this.readTable<CrewMember>('crew_members')
    const filteredMembers = members.filter((m) => m.crewId !== id)
    this.writeTable('crew_members', filteredMembers)
    
    return filtered.length < crews.length
  }

  async hasUserRecommendedCrew(crewId: string, userId: string): Promise<boolean> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        let supabaseUserId = userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId)) {
          supabaseUserId = await this.getSupabaseUserId(userId)
        }
        
        const { data, error } = await supabase
          .from('crew_recommendations')
          .select('id')
          .eq('crew_id', crewId)
          .eq('user_id', supabaseUserId)
          .maybeSingle()
        
        if (error && error.code !== 'PGRST116') {
          console.error('추천 확인 실패:', error)
          return false
        }
        
        return !!data
      } catch (e) {
        console.error('추천 확인 중 오류:', e)
        return false
      }
    }
    
    // localStorage: 간단한 체크 (실제로는 완벽하지 않음)
    const recommendations = this.readTable<{ crewId: string; userId: string }>('crew_recommendations')
    return recommendations.some(r => r.crewId === crewId && r.userId === userId)
  }

  async hasUserCancelledCrewRecommendation(crewId: string, userId: string): Promise<boolean> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        let supabaseUserId = userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId)) {
          supabaseUserId = await this.getSupabaseUserId(userId)
        }
        
        console.log('🔍 취소 기록 조회:', { crewId, supabaseUserId })
        const { data, error } = await supabase
          .from('crew_recommendation_cancels')
          .select('id, crew_id, user_id, created_at')
          .eq('crew_id', crewId)
          .eq('user_id', supabaseUserId)
          .maybeSingle()
        
        console.log('📋 취소 기록 조회 결과:', { data, error: error ? { code: error.code, message: error.message } : null })
        
        // 테이블이 없으면 false 반환 (테이블이 생성되지 않았을 수 있음)
        if (error) {
          if (error.code === 'PGRST205' || error.code === '42P01') {
            // 테이블이 없는 경우 - 추천 취소 기능이 아직 활성화되지 않음
            console.warn('crew_recommendation_cancels 테이블이 없습니다. ADD_RECOMMENDATION_CANCEL.sql을 실행해주세요.')
            return false
          }
          if (error.code !== 'PGRST116') {
            console.error('추천 취소 확인 실패:', error)
            return false
          }
        }
        
        const hasCancelled = !!data
        console.log('✅ 취소 기록 최종 결과:', hasCancelled, data ? '취소 기록 있음' : '취소 기록 없음')
        return hasCancelled
      } catch (e) {
        console.error('추천 취소 확인 중 오류:', e)
        return false
      }
    }
    
    // localStorage
    const cancels = this.readTable<{ crewId: string; userId: string }>('crew_recommendation_cancels')
    return cancels.some(r => r.crewId === crewId && r.userId === userId)
  }

  async toggleCrewRecommendation(crewId: string, userId: string): Promise<{ success: boolean; recommendations: number; isRecommended: boolean }> {
    await this.initialize()
    
    console.log('🔄 toggleCrewRecommendation 시작:', { crewId, userId })
    
    // 취소 기록이 있으면 다시 추천 불가능
    console.log('🔍 취소 기록 확인 중...')
    const hasCancelled = await this.hasUserCancelledCrewRecommendation(crewId, userId)
    console.log('📋 취소 기록 확인 결과:', hasCancelled)
    
    if (hasCancelled) {
      console.log('⚠️ 취소 기록이 있습니다. 취소 기록을 삭제하고 추천을 진행합니다.')
      
      // 취소 기록 삭제하여 다시 추천 가능하도록 함
      if (USE_SUPABASE && supabase) {
        try {
          let supabaseUserId = userId
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          if (!uuidRegex.test(userId)) {
            supabaseUserId = await this.getSupabaseUserId(userId)
          }
          
          const { error: deleteError } = await supabase
            .from('crew_recommendation_cancels')
            .delete()
            .eq('crew_id', crewId)
            .eq('user_id', supabaseUserId)
          
          if (deleteError) {
            console.error('취소 기록 삭제 실패:', deleteError)
            // 삭제 실패해도 계속 진행 (이미 추천한 경우를 확인)
          } else {
            console.log('✅ 취소 기록 삭제 성공. 추천을 진행합니다.')
          }
        } catch (e) {
          console.warn('취소 기록 삭제 중 오류 (무시하고 계속):', e)
        }
      }
      
      // 취소 기록 삭제 후 추천 프로세스 계속 진행
    }
    
    // 현재 추천 상태 확인
    console.log('🔍 추천 상태 확인 중...')
    const hasRecommended = await this.hasUserRecommendedCrew(crewId, userId)
    console.log('📋 추천 상태 확인 결과:', hasRecommended)
    
    if (USE_SUPABASE && supabase) {
      try {
        let supabaseUserId = userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId)) {
          supabaseUserId = await this.getSupabaseUserId(userId)
        }
        
        const crew = await this.getCrewById(crewId)
        if (!crew) return { success: false, recommendations: 0, isRecommended: false }
        
        if (hasRecommended) {
          // 추천 취소: 추천 기록 삭제, 취소 기록 저장, 추천수 감소
          const { error: deleteError } = await supabase
            .from('crew_recommendations')
            .delete()
            .eq('crew_id', crewId)
            .eq('user_id', supabaseUserId)
          
          if (deleteError) {
            console.error('추천 기록 삭제 실패:', deleteError)
            throw deleteError
          }
          
          // 취소 기록 저장 (이미 존재하면 무시)
          // 먼저 존재 여부 확인
          try {
            const { data: existingCancel, error: checkError } = await supabase
              .from('crew_recommendation_cancels')
              .select('id')
              .eq('crew_id', crewId)
              .eq('user_id', supabaseUserId)
              .maybeSingle()
            
            // 테이블이 없으면 취소 기록 저장 건너뛰기 (테이블이 생성되지 않았을 수 있음)
            if (checkError && (checkError.code === 'PGRST205' || checkError.code === '42P01')) {
              console.warn('crew_recommendation_cancels 테이블이 없습니다. 취소 기록 저장을 건너뜁니다.')
              console.warn('ADD_RECOMMENDATION_CANCEL.sql을 실행하여 테이블을 생성해주세요.')
            } else if (!existingCancel && (!checkError || checkError.code === 'PGRST116')) {
              // 취소 기록이 없으면 삽입
              const { error: cancelError } = await supabase
                .from('crew_recommendation_cancels')
                .insert({
                  crew_id: crewId,
                  user_id: supabaseUserId,
                })
              
              if (cancelError) {
                // UNIQUE 제약 조건 위반은 무시 (이미 취소 기록이 있는 경우)
                if (cancelError.code !== '23505' && cancelError.code !== 'PGRST116' && cancelError.code !== 'PGRST205' && cancelError.code !== '42P01') {
                  console.error('취소 기록 저장 실패:', cancelError)
                  throw cancelError
                } else {
                  console.log('취소 기록이 이미 존재하거나 테이블이 없습니다:', cancelError)
                }
              }
            }
          } catch (e: any) {
            // 테이블이 없는 경우 에러를 무시하고 계속 진행
            if (e?.code === 'PGRST205' || e?.code === '42P01') {
              console.warn('crew_recommendation_cancels 테이블이 없습니다. 취소 기록 저장을 건너뜁니다.')
            } else {
              throw e
            }
          }
          
          // 추천수 감소
          const newRecommendations = Math.max(0, (crew.recommendations || 0) - 1)
          const updated = await this.updateCrew(crewId, { recommendations: newRecommendations })
          return { success: true, recommendations: updated?.recommendations || 0, isRecommended: false }
        } else {
          // 추천: 추천 기록 저장, 추천수 증가
          console.log('⭐ 추천 시작:', { crewId, userId, supabaseUserId, currentRecommendations: crew.recommendations })
          
          // 먼저 이미 추천했는지 확인
          const { data: existingRec, error: checkError } = await supabase
            .from('crew_recommendations')
            .select('id')
            .eq('crew_id', crewId)
            .eq('user_id', supabaseUserId)
            .maybeSingle()
          
          if (checkError && checkError.code !== 'PGRST116') {
            console.error('추천 확인 중 오류:', checkError)
          }
          
          if (existingRec) {
            // 이미 추천한 경우 - 추천수만 반환
            console.log('✅ 이미 추천한 크루입니다.')
            return { success: true, recommendations: crew.recommendations || 0, isRecommended: true }
          }
          
          console.log('📝 추천 기록 삽입 시도...')
          const { data: insertData, error: recError } = await supabase
            .from('crew_recommendations')
            .insert({
              crew_id: crewId,
              user_id: supabaseUserId,
            })
            .select()
          
          if (recError) {
            console.error('❌ 추천 기록 삽입 실패:', recError)
            // UNIQUE 제약 조건 위반은 이미 추천한 경우
            if (recError.code === '23505') {
              console.log('이미 추천한 크루입니다.')
              return { success: true, recommendations: crew.recommendations || 0, isRecommended: true }
            }
            // RLS 정책 오류
            if (recError.code === '42501' || recError.message?.includes('permission denied')) {
              console.error('RLS 정책 오류 - 추천 기록 저장 실패:', recError)
              throw new Error('추천 기능을 사용하려면 Supabase에서 FIX_RLS_POLICIES.sql 파일을 실행하여 RLS 정책을 설정해주세요.')
            }
            // 테이블이 없는 경우
            if (recError.code === 'PGRST205' || recError.code === '42P01') {
              console.error('crew_recommendations 테이블이 없습니다. ADD_RECOMMENDATIONS_FEATURE.sql을 실행해주세요.')
              throw new Error('추천 기능을 사용하려면 데이터베이스 테이블을 생성해주세요.')
            }
            console.error('추천 기록 저장 실패:', recError)
            throw recError
          }
          
          console.log('✅ 추천 기록 삽입 성공:', insertData)
          
          // 추천수 증가
          console.log('📈 추천수 증가 시도...', { before: crew.recommendations, after: (crew.recommendations || 0) + 1 })
          try {
            const updated = await this.updateCrew(crewId, { recommendations: (crew.recommendations || 0) + 1 })
            if (!updated) {
              console.error('❌ 추천수 업데이트 실패: updateCrew가 null 반환')
              // 추천 기록은 저장되었지만 추천수 업데이트 실패 - 추천 기록 삭제 시도
              try {
                await supabase
                  .from('crew_recommendations')
                  .delete()
                  .eq('crew_id', crewId)
                  .eq('user_id', supabaseUserId)
                console.log('🔄 추천 기록 롤백 완료')
              } catch (deleteErr) {
                console.error('❌ 추천 기록 삭제 실패:', deleteErr)
              }
              throw new Error('추천수 업데이트에 실패했습니다.')
            }
            console.log('✅ 추천수 업데이트 성공:', updated.recommendations)
            return { success: true, recommendations: updated.recommendations || 0, isRecommended: true }
          } catch (updateError: any) {
            console.error('❌ updateCrew 실행 중 오류:', updateError)
            // 추천 기록은 저장되었지만 추천수 업데이트 실패 - 추천 기록 삭제 시도
            try {
              await supabase
                .from('crew_recommendations')
                .delete()
                .eq('crew_id', crewId)
                .eq('user_id', supabaseUserId)
              console.log('🔄 추천 기록 롤백 완료')
            } catch (deleteErr) {
              console.error('❌ 추천 기록 삭제 실패:', deleteErr)
            }
            throw updateError
          }
        }
      } catch (e: any) {
        console.error('❌ 추천 토글 중 오류:', e)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        console.error('에러 상세:', {
          code: e?.code,
          message: e?.message,
          details: e?.details,
          hint: e?.hint,
          userId,
          crewId,
          supabaseUserId: uuidRegex.test(userId) ? userId : '변환 필요'
        })
        
        // 에러가 발생했지만 추천 기록은 저장되었을 수 있으므로 확인
        try {
          const crew = await this.getCrewById(crewId)
          const currentHasRecommended = await this.hasUserRecommendedCrew(crewId, userId)
          
          // 추천 기록이 있으면 성공으로 처리 (추천수는 현재 값 사용)
          if (currentHasRecommended && crew) {
            console.log('⚠️ 에러 발생했지만 추천 기록은 존재함. 성공으로 처리:', crew.recommendations)
            return { success: true, recommendations: crew.recommendations || 0, isRecommended: true }
          }
          
          // 추천 기록이 없으면 실패
          return { success: false, recommendations: crew?.recommendations || 0, isRecommended: false }
        } catch (checkError) {
          console.error('크루 정보 확인 중 오류:', checkError)
        }
        
        // 에러를 다시 throw하여 상위에서 처리할 수 있도록 함
        throw e
      }
    }
    
    // localStorage
    const crew = await this.getCrewById(crewId)
    if (!crew) return { success: false, recommendations: 0, isRecommended: false }
    
    if (hasRecommended) {
      // 추천 취소
      const recommendations = this.readTable<{ crewId: string; userId: string }>('crew_recommendations')
      const index = recommendations.findIndex(r => r.crewId === crewId && r.userId === userId)
      if (index !== -1) {
        recommendations.splice(index, 1)
        this.writeTable('crew_recommendations', recommendations)
      }
      
      // 취소 기록 저장 (중복 체크)
      const cancels = this.readTable<{ crewId: string; userId: string }>('crew_recommendation_cancels')
      const cancelExists = cancels.some(r => r.crewId === crewId && r.userId === userId)
      if (!cancelExists) {
        cancels.push({ crewId, userId })
        this.writeTable('crew_recommendation_cancels', cancels)
      }
      
      const newRecommendations = Math.max(0, (crew.recommendations || 0) - 1)
      const updated = await this.updateCrew(crewId, { recommendations: newRecommendations })
      return { success: true, recommendations: updated?.recommendations || 0, isRecommended: false }
    } else {
      // 추천
      const recommendations = this.readTable<{ crewId: string; userId: string }>('crew_recommendations')
      recommendations.push({ crewId, userId })
      this.writeTable('crew_recommendations', recommendations)
      
      const updated = await this.updateCrew(crewId, { recommendations: (crew.recommendations || 0) + 1 })
      return { success: true, recommendations: updated?.recommendations || 0, isRecommended: true }
    }
  }

  // 하위 호환성을 위한 함수 (기존 코드에서 사용)
  async incrementCrewRecommendations(crewId: string, userId: string): Promise<{ success: boolean; recommendations: number }> {
    const result = await this.toggleCrewRecommendation(crewId, userId)
    return { success: result.success, recommendations: result.recommendations }
  }

  async hasUserRecommendedJoggingCrew(crewId: string, userId: string): Promise<boolean> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        let supabaseUserId = userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId)) {
          supabaseUserId = await this.getSupabaseUserId(userId)
        }
        
        const { data, error } = await supabase
          .from('jogging_crew_recommendations')
          .select('id')
          .eq('jogging_crew_id', crewId)
          .eq('user_id', supabaseUserId)
          .maybeSingle()
        
        // 테이블이 없으면 false 반환
        if (error) {
          if (error.code === 'PGRST205' || error.code === '42P01') {
            console.warn('jogging_crew_recommendations 테이블이 없습니다. ADD_RECOMMENDATIONS_FEATURE.sql을 실행해주세요.')
            return false
          }
          if (error.code !== 'PGRST116') {
            console.error('조깅 크루 추천 확인 실패:', error)
            return false
          }
        }
        
        return !!data
      } catch (e) {
        console.error('조깅 크루 추천 확인 중 오류:', e)
        return false
      }
    }
    
    // localStorage
    const recommendations = this.readTable<{ crewId: string; userId: string }>('jogging_crew_recommendations')
    return recommendations.some(r => r.crewId === crewId && r.userId === userId)
  }

  async hasUserCancelledJoggingCrewRecommendation(crewId: string, userId: string): Promise<boolean> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        let supabaseUserId = userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId)) {
          supabaseUserId = await this.getSupabaseUserId(userId)
        }
        
        const { data, error } = await supabase
          .from('jogging_crew_recommendation_cancels')
          .select('id')
          .eq('jogging_crew_id', crewId)
          .eq('user_id', supabaseUserId)
          .maybeSingle()
        
        // 테이블이 없으면 false 반환 (테이블이 생성되지 않았을 수 있음)
        if (error) {
          if (error.code === 'PGRST205' || error.code === '42P01') {
            // 테이블이 없는 경우 - 추천 취소 기능이 아직 활성화되지 않음
            console.warn('jogging_crew_recommendation_cancels 테이블이 없습니다. ADD_RECOMMENDATION_CANCEL.sql을 실행해주세요.')
            return false
          }
          if (error.code !== 'PGRST116') {
            console.error('조깅 크루 추천 취소 확인 실패:', error)
            return false
          }
        }
        
        return !!data
      } catch (e) {
        console.error('조깅 크루 추천 취소 확인 중 오류:', e)
        return false
      }
    }
    
    // localStorage
    const cancels = this.readTable<{ crewId: string; userId: string }>('jogging_crew_recommendation_cancels')
    return cancels.some(r => r.crewId === crewId && r.userId === userId)
  }

  async toggleJoggingCrewRecommendation(crewId: string, userId: string): Promise<{ success: boolean; recommendations: number; isRecommended: boolean }> {
    await this.initialize()
    
    console.log('🔄 toggleJoggingCrewRecommendation 시작:', { crewId, userId })
    
    // 취소 기록 확인
    console.log('🔍 취소 기록 확인 중...')
    const hasCancelled = await this.hasUserCancelledJoggingCrewRecommendation(crewId, userId)
    console.log('📋 취소 기록 확인 결과:', hasCancelled)
    
    if (hasCancelled) {
      console.log('⚠️ 취소 기록이 있습니다. 취소 기록을 삭제하고 추천을 진행합니다.')
      
      // 취소 기록 삭제하여 다시 추천 가능하도록 함
      if (USE_SUPABASE && supabase) {
        try {
          let supabaseUserId = userId
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          if (!uuidRegex.test(userId)) {
            supabaseUserId = await this.getSupabaseUserId(userId)
          }
          
          const { error: deleteError } = await supabase
            .from('jogging_crew_recommendation_cancels')
            .delete()
            .eq('jogging_crew_id', crewId)
            .eq('user_id', supabaseUserId)
          
          if (deleteError) {
            console.error('조깅 크루 취소 기록 삭제 실패:', deleteError)
            // 삭제 실패해도 계속 진행 (이미 추천한 경우를 확인)
          } else {
            console.log('✅ 취소 기록 삭제 성공. 추천을 진행합니다.')
          }
        } catch (e) {
          console.warn('조깅 크루 취소 기록 삭제 중 오류 (무시하고 계속):', e)
        }
      }
      
      // 취소 기록 삭제 후 추천 프로세스 계속 진행
    }
    
    // 현재 추천 상태 확인
    console.log('🔍 추천 상태 확인 중...')
    const hasRecommended = await this.hasUserRecommendedJoggingCrew(crewId, userId)
    console.log('📋 추천 상태 확인 결과:', hasRecommended)
    
    if (USE_SUPABASE && supabase) {
      try {
        let supabaseUserId = userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId)) {
          supabaseUserId = await this.getSupabaseUserId(userId)
        }
        
        console.log('🔍 조깅 크루 정보 조회 중...', { crewId })
        const crew = await this.getJoggingCrewById(crewId)
        console.log('📋 조깅 크루 정보 조회 결과:', crew ? '크루 찾음' : '크루 없음', crew ? { id: crew.id, name: crew.name, recommendations: crew.recommendations } : null)
        
        if (!crew) {
          console.error('❌ 조깅 크루를 찾을 수 없습니다:', crewId)
          return { success: false, recommendations: 0, isRecommended: false }
        }
        
        console.log('⭐ 조깅 크루 추천 시작:', { crewId, userId, supabaseUserId, currentRecommendations: crew.recommendations })
        
        if (hasRecommended) {
          // 추천 취소: 추천 기록 삭제, 취소 기록 저장, 추천수 감소
          const { error: deleteError } = await supabase
            .from('jogging_crew_recommendations')
            .delete()
            .eq('jogging_crew_id', crewId)
            .eq('user_id', supabaseUserId)
          
          if (deleteError) {
            console.error('조깅 크루 추천 기록 삭제 실패:', deleteError)
            throw deleteError
          }
          
          // 취소 기록 저장 (이미 존재하면 무시)
          // 먼저 존재 여부 확인
          try {
            const { data: existingCancel, error: checkError } = await supabase
              .from('jogging_crew_recommendation_cancels')
              .select('id')
              .eq('jogging_crew_id', crewId)
              .eq('user_id', supabaseUserId)
              .maybeSingle()
            
            // 테이블이 없으면 취소 기록 저장 건너뛰기 (테이블이 생성되지 않았을 수 있음)
            if (checkError && (checkError.code === 'PGRST205' || checkError.code === '42P01')) {
              console.warn('jogging_crew_recommendation_cancels 테이블이 없습니다. 취소 기록 저장을 건너뜁니다.')
              console.warn('ADD_RECOMMENDATION_CANCEL.sql을 실행하여 테이블을 생성해주세요.')
            } else if (!existingCancel && (!checkError || checkError.code === 'PGRST116')) {
              // 취소 기록이 없으면 삽입
              const { error: cancelError } = await supabase
                .from('jogging_crew_recommendation_cancels')
                .insert({
                  jogging_crew_id: crewId,
                  user_id: supabaseUserId,
                })
              
              if (cancelError) {
                // UNIQUE 제약 조건 위반은 무시 (이미 취소 기록이 있는 경우)
                if (cancelError.code !== '23505' && cancelError.code !== 'PGRST116' && cancelError.code !== 'PGRST205' && cancelError.code !== '42P01') {
                  console.error('조깅 크루 취소 기록 저장 실패:', cancelError)
                  throw cancelError
                } else {
                  console.log('조깅 크루 취소 기록이 이미 존재하거나 테이블이 없습니다:', cancelError)
                }
              }
            }
          } catch (e: any) {
            // 테이블이 없는 경우 에러를 무시하고 계속 진행
            if (e?.code === 'PGRST205' || e?.code === '42P01') {
              console.warn('jogging_crew_recommendation_cancels 테이블이 없습니다. 취소 기록 저장을 건너뜁니다.')
            } else {
              throw e
            }
          }
          
          // 추천수 감소
          console.log('📉 조깅 크루 추천수 감소 시도...', { before: crew.recommendations, after: Math.max(0, (crew.recommendations || 0) - 1) })
          const newRecommendations = Math.max(0, (crew.recommendations || 0) - 1)
          const { data, error } = await supabase
            .from('jogging_crews')
            .update({ recommendations: newRecommendations })
            .eq('id', crewId)
            .select()
            .single()
          
          if (error) {
            console.error('❌ 조깅 크루 추천수 감소 실패:', error)
            throw error
          }
          
          console.log('✅ 조깅 크루 추천수 감소 성공:', data.recommendations)
          return { success: true, recommendations: data.recommendations || 0, isRecommended: false }
        } else {
          // 추천: 추천 기록 저장, 추천수 증가
          console.log('📝 조깅 크루 추천 기록 삽입 시도...')
          
          // 먼저 이미 추천했는지 확인
          const { data: existingRec, error: checkError } = await supabase
            .from('jogging_crew_recommendations')
            .select('id')
            .eq('jogging_crew_id', crewId)
            .eq('user_id', supabaseUserId)
            .maybeSingle()
          
          if (checkError && checkError.code !== 'PGRST116') {
            console.error('조깅 크루 추천 확인 중 오류:', checkError)
          }
          
          if (existingRec) {
            // 이미 추천한 경우 - 추천수만 반환
            console.log('✅ 이미 추천한 조깅 크루입니다.')
            return { success: true, recommendations: crew.recommendations || 0, isRecommended: true }
          }
          
          const { data: insertData, error: recError } = await supabase
            .from('jogging_crew_recommendations')
            .insert({
              jogging_crew_id: crewId,
              user_id: supabaseUserId,
            })
            .select()
          
          if (recError) {
            console.error('❌ 조깅 크루 추천 기록 삽입 실패:', recError)
            
            // UNIQUE 제약 조건 위반은 이미 추천한 경우
            if (recError.code === '23505') {
              console.log('✅ 이미 추천한 조깅 크루입니다.')
              return { success: true, recommendations: crew.recommendations || 0, isRecommended: true }
            }
            // RLS 정책 오류
            if (recError.code === '42501' || recError.message?.includes('permission denied')) {
              console.error('RLS 정책 오류 - 조깅 크루 추천 기록 저장 실패:', recError)
              throw new Error('추천 기능을 사용하려면 Supabase에서 FIX_RLS_POLICIES.sql 파일을 실행하여 RLS 정책을 설정해주세요.')
            }
            // 테이블이 없는 경우
            if (recError.code === 'PGRST205' || recError.code === '42P01') {
              console.error('jogging_crew_recommendations 테이블이 없습니다. ADD_RECOMMENDATIONS_FEATURE.sql을 실행해주세요.')
              throw new Error('추천 기능을 사용하려면 데이터베이스 테이블을 생성해주세요.')
            }
            throw recError
          }
          
          console.log('✅ 조깅 크루 추천 기록 삽입 성공:', insertData)
          
          // 추천수 증가
          console.log('📈 조깅 크루 추천수 증가 시도...', { before: crew.recommendations, after: (crew.recommendations || 0) + 1 })
          try {
            const { data, error } = await supabase
              .from('jogging_crews')
              .update({ recommendations: (crew.recommendations || 0) + 1 })
              .eq('id', crewId)
              .select()
              .single()
            
            if (error) {
              console.error('❌ 조깅 크루 추천수 증가 실패:', error)
              // 추천 기록은 저장되었지만 추천수 업데이트 실패 - 추천 기록 삭제 시도
              try {
                await supabase
                  .from('jogging_crew_recommendations')
                  .delete()
                  .eq('jogging_crew_id', crewId)
                  .eq('user_id', supabaseUserId)
                console.log('🔄 조깅 크루 추천 기록 롤백 완료')
              } catch (deleteErr) {
                console.error('❌ 조깅 크루 추천 기록 삭제 실패:', deleteErr)
              }
              throw error
            }
            
            console.log('✅ 조깅 크루 추천수 증가 성공:', data.recommendations)
            return { success: true, recommendations: data.recommendations || 0, isRecommended: true }
          } catch (updateError: any) {
            console.error('❌ updateJoggingCrew 실행 중 오류:', updateError)
            // 추천 기록은 저장되었지만 추천수 업데이트 실패 - 추천 기록 삭제 시도
            try {
              await supabase
                .from('jogging_crew_recommendations')
                .delete()
                .eq('jogging_crew_id', crewId)
                .eq('user_id', supabaseUserId)
              console.log('🔄 조깅 크루 추천 기록 롤백 완료')
            } catch (deleteErr) {
              console.error('❌ 조깅 크루 추천 기록 삭제 실패:', deleteErr)
            }
            throw updateError
          }
        }
      } catch (e: any) {
        console.error('❌ 조깅 크루 추천 토글 중 오류:', e)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        console.error('에러 상세:', {
          code: e?.code,
          message: e?.message,
          details: e?.details,
          hint: e?.hint,
          userId,
          crewId,
          supabaseUserId: uuidRegex.test(userId) ? userId : '변환 필요'
        })
        
        // 에러가 발생했지만 추천 기록은 저장되었을 수 있으므로 확인
        try {
          const crew = await this.getJoggingCrewById(crewId)
          const currentHasRecommended = await this.hasUserRecommendedJoggingCrew(crewId, userId)
          
          // 추천 기록이 있으면 성공으로 처리 (추천수는 현재 값 사용)
          if (currentHasRecommended && crew) {
            console.log('⚠️ 에러 발생했지만 추천 기록은 존재함. 성공으로 처리:', crew.recommendations)
            return { success: true, recommendations: crew.recommendations || 0, isRecommended: true }
          }
          
          // 추천 기록이 없으면 실패
          return { success: false, recommendations: crew?.recommendations || 0, isRecommended: false }
        } catch (checkError) {
          console.error('조깅 크루 정보 확인 중 오류:', checkError)
        }
        
        // 에러를 다시 throw하여 상위에서 처리할 수 있도록 함
        throw e
      }
    }
    
    // localStorage
    const crew = await this.getJoggingCrewById(crewId)
    if (!crew) return { success: false, recommendations: 0, isRecommended: false }
    
    if (hasRecommended) {
      // 추천 취소
      const recommendations = this.readTable<{ crewId: string; userId: string }>('jogging_crew_recommendations')
      const index = recommendations.findIndex(r => r.crewId === crewId && r.userId === userId)
      if (index !== -1) {
        recommendations.splice(index, 1)
        this.writeTable('jogging_crew_recommendations', recommendations)
      }
      
      // 취소 기록 저장 (중복 체크)
      const cancels = this.readTable<{ crewId: string; userId: string }>('jogging_crew_recommendation_cancels')
      const cancelExists = cancels.some(r => r.crewId === crewId && r.userId === userId)
      if (!cancelExists) {
        cancels.push({ crewId, userId })
        this.writeTable('jogging_crew_recommendation_cancels', cancels)
      }
      
      const newRecommendations = Math.max(0, (crew.recommendations || 0) - 1)
      const updatedCrew: JoggingCrew = {
        ...crew,
        recommendations: newRecommendations,
      }
      
      const crews = this.readTable<JoggingCrew>('jogging_crews')
      const crewIndex = crews.findIndex(c => c.id === crewId)
      if (crewIndex !== -1) {
        crews[crewIndex] = updatedCrew
        this.writeTable('jogging_crews', crews)
      }
      
      return { success: true, recommendations: updatedCrew.recommendations, isRecommended: false }
    } else {
      // 추천
      const recommendations = this.readTable<{ crewId: string; userId: string }>('jogging_crew_recommendations')
      recommendations.push({ crewId, userId })
      this.writeTable('jogging_crew_recommendations', recommendations)
      
      const updatedCrew: JoggingCrew = {
        ...crew,
        recommendations: (crew.recommendations || 0) + 1,
      }
      
      const crews = this.readTable<JoggingCrew>('jogging_crews')
      const crewIndex = crews.findIndex(c => c.id === crewId)
      if (crewIndex !== -1) {
        crews[crewIndex] = updatedCrew
        this.writeTable('jogging_crews', crews)
      }
      
      return { success: true, recommendations: updatedCrew.recommendations, isRecommended: true }
    }
  }

  // 하위 호환성을 위한 함수 (기존 코드에서 사용)
  async incrementJoggingCrewRecommendations(crewId: string, userId: string): Promise<{ success: boolean; recommendations: number }> {
    const result = await this.toggleJoggingCrewRecommendation(crewId, userId)
    return { success: result.success, recommendations: result.recommendations }
  }

  // ============ CrewMember 관련 ============
  async addCrewMember(crewId: string, userId: string, role: 'owner' | 'member' = 'member'): Promise<CrewMember> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      // Supabase 사용
      if (!supabase) throw new Error('Supabase client not initialized')
      
      console.log('addCrewMember - crewId:', crewId, 'userId:', userId)
      
      // localStorage 사용자는 UUID가 아닐 수 있으므로, email로 Supabase 사용자 찾기
      let supabaseUserId = userId
      
      // UUID 형식이 아니면 email로 사용자 찾기
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(userId)) {
        const userStr = localStorage.getItem(`user_${userId}`)
        if (userStr) {
          const user = JSON.parse(userStr)
          if (user.email) {
            const { data: supabaseUser, error: userError } = await supabase
              .from('users')
              .select('id')
              .eq('email', user.email)
              .single()
            
            if (userError || !supabaseUser) {
              throw new Error('Supabase에 사용자가 등록되어 있지 않습니다. 먼저 로그인해주세요.')
            }
            
            supabaseUserId = supabaseUser.id
            console.log('Supabase 사용자 ID 매핑:', userId, '->', supabaseUserId)
          }
        }
      }
      
      // 이미 멤버인지 확인
      const { data: existingMembers, error: checkError } = await supabase
        .from('crew_members')
        .select('*')
        .eq('crew_id', crewId)
        .eq('user_id', supabaseUserId)

      if (checkError) {
        console.error('멤버 확인 에러:', checkError)
        // 에러가 있어도 계속 진행 (중복 체크는 선택사항)
      }

      if (existingMembers && existingMembers.length > 0) {
        return this.mapSupabaseCrewMember(existingMembers[0])
      }

      // 크루 존재 확인 및 멤버 제한 확인
      const crew = await this.getCrewById(crewId)
      if (!crew) {
        throw new Error('크루를 찾을 수 없습니다.')
      }
      if (crew.maxMembers !== null && crew.currentMembers >= crew.maxMembers) {
        throw new Error('크루 인원이 가득 찼습니다.')
      }

      // 멤버 추가
      const { data: newMember, error } = await supabase
        .from('crew_members')
        .insert({
          crew_id: crewId,
          user_id: supabaseUserId,
          role,
          video_enabled: false,
          audio_enabled: false,
        })
        .select()
        .single()

      if (error) {
        console.error('crew_members 삽입 에러:', error)
        throw error
      }

      // 크루의 멤버 수 업데이트 및 활동 시간 업데이트
      const { data: allMembers } = await supabase
        .from('crew_members')
        .select('user_id')
        .eq('crew_id', crewId)

      if (allMembers) {
        try {
          await supabase
            .from('crews')
            .update({
              current_members: allMembers.length,
              member_ids: allMembers.map(m => m.user_id),
              last_activity_at: new Date().toISOString(), // 활동 시간 업데이트
            })
            .eq('id', crewId)
          
          // 크루 계급 업데이트 (비동기, 에러가 나도 계속 진행)
          import('@/services/rankService').then(({ rankService }) => {
            rankService.updateCrewRank(crewId, false).catch(err => {
              console.warn('크루 계급 업데이트 실패:', err)
            })
          })
        } catch (updateError: any) {
          console.warn('크루 멤버 수 업데이트 실패:', updateError)
          // current_members만 업데이트 시도
          try {
            await supabase
              .from('crews')
              .update({
                current_members: allMembers.length,
              })
              .eq('id', crewId)
          } catch (e) {
            console.warn('current_members 업데이트도 실패:', e)
          }
        }
      }

      return this.mapSupabaseCrewMember(newMember)
    } else {
      // localStorage 사용
      // 이미 멤버인지 확인
    const members = this.readTable<CrewMember>('crew_members')
      const existingMember = members.find((m) => m.crewId === crewId && m.userId === userId)
      if (existingMember) {
        // 이미 멤버인 경우 기존 멤버 정보 반환
        return existingMember
      }

      // 크루 존재 확인 및 멤버 제한 확인
      const crew = await this.getCrewById(crewId)
      if (!crew) {
        throw new Error('크루를 찾을 수 없습니다.')
      }
      if (crew.maxMembers !== null && crew.currentMembers >= crew.maxMembers) {
        throw new Error('크루 인원이 가득 찼습니다.')
      }

    const newMember: CrewMember = {
      id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      crewId,
      userId,
      joinedAt: Date.now(),
      role,
      videoEnabled: false,
      audioEnabled: false,
    }
    members.push(newMember)
    this.writeTable('crew_members', members)

      // 크루의 멤버 수를 실시간으로 계산하여 업데이트
      const allCrewMembers = this.readTable<CrewMember>('crew_members')
      const crewMembers = allCrewMembers.filter((m) => m.crewId === crewId)
      const actualMemberCount = crewMembers.length
      const actualMemberIds = crewMembers.map((m) => m.userId)
      
      await this.updateCrew(crewId, {
        currentMembers: actualMemberCount,
        memberIds: actualMemberIds,
      })

      // 크루 계급 업데이트 (비동기, 에러가 나도 계속 진행)
      import('@/services/rankService').then(({ rankService }) => {
        rankService.updateCrewRank(crewId, false).catch(err => {
          console.warn('크루 계급 업데이트 실패:', err)
        })
      })

    return newMember
    }
  }

  async removeCrewMember(crewId: string, userId: string): Promise<boolean> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      if (!supabase) throw new Error('Supabase client not initialized')
      
      console.log('removeCrewMember - crewId:', crewId, 'userId:', userId)
      
      // localStorage 사용자는 UUID가 아닐 수 있으므로, email로 Supabase 사용자 찾기
      let supabaseUserId = userId
      
      // UUID 형식이 아니면 email로 사용자 찾기
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(userId)) {
        const userStr = localStorage.getItem(`user_${userId}`)
        if (userStr) {
          const user = JSON.parse(userStr)
          if (user.email) {
            const { data: supabaseUser, error: userError } = await supabase
              .from('users')
              .select('id')
              .eq('email', user.email)
              .single()
            
            if (userError || !supabaseUser) {
              console.warn('Supabase 사용자를 찾을 수 없음:', userError)
              // Supabase에 사용자가 없으면 localStorage로 폴백
    const members = this.readTable<CrewMember>('crew_members')
    const filtered = members.filter((m) => !(m.crewId === crewId && m.userId === userId))
    this.writeTable('crew_members', filtered)
              return filtered.length < members.length
            }
            
            supabaseUserId = supabaseUser.id
            console.log('Supabase 사용자 ID 매핑:', userId, '->', supabaseUserId)
          }
        }
      }
      
      // 멤버 삭제
      const { error } = await supabase
        .from('crew_members')
        .delete()
        .eq('crew_id', crewId)
        .eq('user_id', supabaseUserId)

      if (error) {
        console.error('crew_members 삭제 에러:', error)
        throw error
      }

    // 크루의 멤버 수 업데이트
      const { data: allMembers } = await supabase
        .from('crew_members')
        .select('user_id')
        .eq('crew_id', crewId)

      if (allMembers) {
        try {
          await supabase
            .from('crews')
            .update({
              current_members: allMembers.length,
              member_ids: allMembers.map(m => m.user_id),
            })
            .eq('id', crewId)
        } catch (updateError: any) {
          console.warn('크루 멤버 수 업데이트 실패:', updateError)
          // current_members만 업데이트 시도
          try {
            await supabase
              .from('crews')
              .update({
                current_members: allMembers.length,
              })
              .eq('id', crewId)
          } catch (e) {
            console.warn('current_members 업데이트도 실패:', e)
          }
        }
      }

      return true
    } else {
      const members = this.readTable<CrewMember>('crew_members')
      const filtered = members.filter((m) => !(m.crewId === crewId && m.userId === userId))
      this.writeTable('crew_members', filtered)

      // 크루의 멤버 수를 실시간으로 계산하여 업데이트
      const crewMembers = filtered.filter((m) => m.crewId === crewId)
      const actualMemberCount = crewMembers.length
      const actualMemberIds = crewMembers.map((m) => m.userId)
      
      await this.updateCrew(crewId, {
        currentMembers: actualMemberCount,
        memberIds: actualMemberIds,
      })

    return filtered.length < members.length
    }
  }

  async getCrewMembers(crewId: string): Promise<CrewMember[]> {
    await this.initialize()
    
    console.log('📋 getCrewMembers 호출:', { crewId, useSupabase: USE_SUPABASE && !!supabase })
    
    if (USE_SUPABASE && supabase) {
      if (!supabase) throw new Error('Supabase client not initialized')
      
      const { data, error } = await supabase
        .from('crew_members')
        .select('*')
        .eq('crew_id', crewId)
      
      if (error) {
        console.error('❌ crew_members 조회 에러:', error)
        throw error
      }
      
      console.log('✅ getCrewMembers 결과:', {
        crewId,
        memberCount: data?.length || 0,
        members: data?.map(m => ({
          id: m.id,
          user_id: m.user_id,
          crew_id: m.crew_id,
          video_enabled: m.video_enabled,
          audio_enabled: m.audio_enabled,
        })) || [],
      })
      
      return (data || []).map(m => this.mapSupabaseCrewMember(m))
    } else {
    const members = this.readTable<CrewMember>('crew_members')
      const filtered = members.filter((m) => m.crewId === crewId)
      console.log('✅ getCrewMembers 결과 (localStorage):', {
        crewId,
        memberCount: filtered.length,
        members: filtered.map(m => ({ id: m.id, userId: m.userId, videoEnabled: m.videoEnabled })),
      })
      return filtered
    }
  }

  async updateCrewMember(crewId: string, userId: string, updates: Partial<CrewMember>): Promise<CrewMember | null> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      if (!supabase) throw new Error('Supabase client not initialized')
      
      console.log('updateCrewMember - crewId:', crewId, 'userId:', userId)
      
      // localStorage 사용자는 UUID가 아닐 수 있으므로, email로 Supabase 사용자 찾기
      let supabaseUserId = userId
      
      // UUID 형식이 아니면 email로 사용자 찾기
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(userId)) {
        const userStr = localStorage.getItem(`user_${userId}`)
        if (userStr) {
          const user = JSON.parse(userStr)
          if (user.email) {
            const { data: supabaseUser, error: userError } = await supabase
              .from('users')
              .select('id')
              .eq('email', user.email)
              .single()
            
            if (userError || !supabaseUser) {
              console.warn('Supabase 사용자를 찾을 수 없음:', userError)
              // Supabase에 사용자가 없으면 localStorage로 폴백
    const members = this.readTable<CrewMember>('crew_members')
    const index = members.findIndex((m) => m.crewId === crewId && m.userId === userId)
    if (index === -1) return null
    members[index] = { ...members[index], ...updates }
    this.writeTable('crew_members', members)
    return members[index]
            }
            
            supabaseUserId = supabaseUser.id
            console.log('Supabase 사용자 ID 매핑:', userId, '->', supabaseUserId)
          }
        }
      }
      
      const updateData: any = {}
      if (updates.videoEnabled !== undefined) {
        updateData.video_enabled = updates.videoEnabled
        console.log(`📹 updateCrewMember: video_enabled 업데이트`, {
          crewId,
          userId,
          supabaseUserId,
          videoEnabled: updates.videoEnabled,
        })
      }
      if (updates.audioEnabled !== undefined) {
        updateData.audio_enabled = updates.audioEnabled
        console.log(`🔊 updateCrewMember: audio_enabled 업데이트`, {
          crewId,
          userId,
          supabaseUserId,
          audioEnabled: updates.audioEnabled,
        })
      }
      if (updates.role !== undefined) updateData.role = updates.role

      // 먼저 멤버가 존재하는지 확인
      const { data: existingMember, error: checkError } = await supabase
        .from('crew_members')
        .select('*')
        .eq('crew_id', crewId)
        .eq('user_id', supabaseUserId)
        .maybeSingle() // single() 대신 maybeSingle() 사용 (없을 수도 있음)
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116은 "not found" 오류
        console.error('crew_members 조회 에러:', checkError)
        // 406 오류인 경우 RLS 정책 문제일 수 있음
        if (checkError.code === 'PGRST301' || checkError.message?.includes('406')) {
          console.warn('⚠️ RLS 정책 문제로 인한 조회 실패. 멤버를 새로 생성합니다.')
        } else {
          throw checkError
        }
      }

      if (!existingMember) {
        // 멤버가 없으면 생성 (upsert 방식)
        // 조깅 크루인지 확인 (jogging_crews 테이블에 존재하는지 확인)
        const { data: joggingCrew } = await supabase
          .from('jogging_crews')
          .select('id')
          .eq('id', crewId)
          .single()
        
        if (joggingCrew) {
          // 조깅 크루인 경우: crew_members 테이블을 사용하지 않음
          // 조깅 크루는 memberIds로 관리되므로 crew_members 테이블에 insert하지 않음
          console.log('⚠️ 조깅 크루는 crew_members 테이블을 사용하지 않습니다. memberIds로 관리됩니다.')
          // 조깅 크루의 경우 빈 CrewMember 객체 반환 (로컬 상태만 사용)
          return {
            id: `jogging_member_${supabaseUserId}_${Date.now()}`,
            crewId: crewId,
            userId: supabaseUserId,
            role: 'member',
            videoEnabled: updates.videoEnabled ?? false,
            audioEnabled: updates.audioEnabled ?? false,
            joinedAt: Date.now(),
          }
        }
        
        // 일반 크루인 경우에만 crew_members 테이블에 insert
        console.log('📝 crew_members에 멤버가 없어서 생성:', { crewId, supabaseUserId })
        const { data: newMember, error: insertError } = await supabase
          .from('crew_members')
          .insert({
            crew_id: crewId,
            user_id: supabaseUserId,
            role: 'member',
            video_enabled: updates.videoEnabled ?? false,
            audio_enabled: updates.audioEnabled ?? false,
          })
          .select()
          .single()

        if (insertError) {
          console.error('crew_members 생성 에러:', insertError)
          throw insertError
        }
        return newMember ? this.mapSupabaseCrewMember(newMember) : null
      }

      // 멤버가 있으면 업데이트
      const { data, error } = await supabase
        .from('crew_members')
        .update(updateData)
        .eq('crew_id', crewId)
        .eq('user_id', supabaseUserId)
        .select()
        .single()

      if (error) {
        console.error('crew_members 업데이트 에러:', error)
        throw error
      }
      return data ? this.mapSupabaseCrewMember(data) : null
    } else {
      const members = this.readTable<CrewMember>('crew_members')
      const index = members.findIndex((m) => m.crewId === crewId && m.userId === userId)
      if (index === -1) {
        // 멤버가 없으면 생성 (upsert 방식)
        console.log('📝 crew_members에 멤버가 없어서 생성 (localStorage):', { crewId, userId })
        const newMember: CrewMember = {
          id: `member_${crewId}_${userId}_${Date.now()}`,
          crewId,
          userId,
          role: 'member',
          videoEnabled: updates.videoEnabled ?? false,
          audioEnabled: updates.audioEnabled ?? false,
          joinedAt: Date.now(),
        }
        members.push(newMember)
        this.writeTable('crew_members', members)
        return newMember
      }
      members[index] = { ...members[index], ...updates }
      this.writeTable('crew_members', members)
      return members[index]
    }
  }

  // ============ JoggingCrew 관련 ============
  async createJoggingCrew(crew: Omit<JoggingCrew, 'id' | 'createdAt' | 'currentMembers' | 'memberIds'>): Promise<JoggingCrew> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        // UUID 매핑
        let supabaseUserId = crew.createdBy
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(crew.createdBy)) {
          supabaseUserId = await this.getSupabaseUserId(crew.createdBy)
        }
        
        const { data, error } = await supabase
          .from('jogging_crews')
          .insert({
            name: crew.name,
            max_members: crew.maxMembers,
            target_distance: crew.targetDistance || null,
            target_time: crew.targetTime || null,
            alarm: crew.alarm || null,
            created_by: supabaseUserId,
            video_share_enabled: crew.videoShareEnabled || false,
            audio_share_enabled: crew.audioShareEnabled || false,
            current_members: 1,
            member_ids: [supabaseUserId],
            recommendations: 0,
          })
          .select()
          .single()
        
        if (error) {
          console.error('Supabase 조깅 크루 생성 실패:', error)
          throw error
        }
        
        return this.mapSupabaseJoggingCrew(data)
      } catch (e) {
        console.error('Supabase 조깅 크루 생성 중 오류:', e)
        // Supabase 실패 시 에러를 다시 throw하여 사용자에게 알림
        throw e
      }
    }
    
    // localStorage 저장
    const crews = this.readTable<JoggingCrew>('jogging_crews')
    const newCrew: JoggingCrew = {
      ...crew,
      id: `jcrew_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      currentMembers: 1,
      memberIds: [crew.createdBy],
      recommendations: 0,
    }
    crews.push(newCrew)
    this.writeTable('jogging_crews', crews)
    return newCrew
  }

  async getJoggingCrewById(id: string): Promise<JoggingCrew | null> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      if (!supabase) throw new Error('Supabase client not initialized')
      
      console.log('getJoggingCrewById - id:', id)
      const { data: crew, error } = await supabase
        .from('jogging_crews')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('조깅 크루 조회 에러:', error)
        if (error.code === 'PGRST116') {
          // 결과가 없음
          return null
        }
        throw error
      }

      if (!crew) return null

      return this.mapSupabaseJoggingCrew(crew)
    }
    
    // localStorage
    const crews = this.readTable<JoggingCrew>('jogging_crews')
    return crews.find((c) => c.id === id) || null
  }

  async getJoggingCrewsByUserId(userId: string, limit: number = 50, offset: number = 0): Promise<{ data: JoggingCrew[]; hasMore: boolean; total?: number }> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      console.log('getJoggingCrewsByUserId - userId:', userId)
      
      // localStorage 사용자는 UUID가 아닐 수 있으므로, email로 Supabase 사용자 찾기
      let supabaseUserId = userId
      
      // UUID 형식이 아니면 email로 사용자 찾기
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(userId)) {
        // localStorage 사용자 정보에서 email 가져오기
        const userStr = localStorage.getItem(`user_${userId}`)
        if (userStr) {
          const user = JSON.parse(userStr)
          if (user.email) {
            // Supabase에서 email로 사용자 찾기
            const { data: supabaseUser, error: userError } = await supabase
              .from('users')
              .select('id')
              .eq('email', user.email)
              .single()
            
            if (userError) {
              console.warn('Supabase 사용자를 찾을 수 없음:', userError)
              return { data: [], hasMore: false } // Supabase에 사용자가 없으면 빈 배열 반환
            }
            
            if (supabaseUser) {
              supabaseUserId = supabaseUser.id
              console.log('Supabase 사용자 ID 매핑:', userId, '->', supabaseUserId)
            } else {
              return { data: [], hasMore: false } // Supabase에 사용자가 없으면 빈 배열 반환
            }
          }
        }
      }
      
      // 사용자가 멤버인 조깅 크루 조회
      const { data: allCrews, error } = await supabase
        .from('jogging_crews')
        .select('*')
        .contains('member_ids', [supabaseUserId])
      
      if (error) {
        console.error('jogging_crews 조회 에러:', error)
        throw error
      }
      
      console.log('조회된 조깅 크루:', allCrews)
      
      if (!allCrews || allCrews.length === 0) return { data: [], hasMore: false }
      
      // 페이지네이션 적용
      const totalCrews = allCrews.length
      const paginatedCrews = allCrews.slice(offset, offset + limit)
      
      // 각 크루의 실시간 멤버 수 계산
      if (!supabase) throw new Error('Supabase client not initialized')
      const supabaseClient = supabase
      
      const crewsWithMembers = await Promise.all(
        paginatedCrews.map(async (crew) => {
          // member_ids 배열에서 실제 멤버 수 계산
          const actualMemberIds = crew.member_ids || []
          const actualMemberCount = actualMemberIds.length
          
          // 실제 멤버 수와 저장된 멤버 수가 다르면 업데이트
          if (crew.current_members !== actualMemberCount) {
            try {
              await supabaseClient
                .from('jogging_crews')
                .update({
                  current_members: actualMemberCount,
                })
                .eq('id', crew.id)
            } catch (updateError: any) {
              console.warn('current_members 업데이트 실패:', updateError)
            }
          }
          
          // createdBy 필드도 UUID 매핑 필요 (localStorage 사용자 ID를 Supabase UUID로 변환)
          let mappedCreatedBy = crew.created_by
          if (crew.created_by === supabaseUserId) {
            // Supabase UUID와 일치하면 localStorage 사용자 ID로 매핑
            mappedCreatedBy = userId
          }
          
          return this.mapSupabaseJoggingCrew({
            ...crew,
            current_members: actualMemberCount,
            member_ids: actualMemberIds,
            created_by: mappedCreatedBy, // 매핑된 createdBy 사용
          })
        })
      )
      
      const hasMore = offset + limit < totalCrews
      return { data: crewsWithMembers, hasMore, total: totalCrews }
    } else {
      const crews = this.readTable<JoggingCrew>('jogging_crews')
      const filteredCrews = crews.filter((c) => c.memberIds.includes(userId))
      const totalCrews = filteredCrews.length
      const paginatedCrews = filteredCrews.slice(offset, offset + limit)
      const hasMore = offset + limit < totalCrews
      return { data: paginatedCrews, hasMore, total: totalCrews }
    }
  }

  async getAllJoggingCrews(limit: number = 50, offset: number = 0): Promise<{ data: JoggingCrew[]; hasMore: boolean; total?: number }> {
    await this.initialize()
    
    // 샘플 조깅 크루 생성 (localStorage만)
    if (!USE_SUPABASE || !supabase) {
      await this.ensureTestJoggingCrews()
    }
    
    if (USE_SUPABASE && supabase) {
      try {
        const { data, error, count } = await supabase
          .from('jogging_crews')
          .select('*', { count: 'exact' })
          .eq('is_dormant', false) // 휴면 크루 제외
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)
        
        if (error) {
          console.error('Supabase 조깅 크루 조회 에러:', error)
          throw error
        }
        
        const crews = (data || []).map(c => this.mapSupabaseJoggingCrew(c))
        const hasMore = count ? offset + limit < count : false
        return { data: crews, hasMore, total: count || undefined }
      } catch (e) {
        console.error('Supabase 조깅 크루 조회 중 오류:', e)
        const crews = this.readTable<JoggingCrew>('jogging_crews')
        const paginatedCrews = crews.slice(offset, offset + limit)
        const hasMore = offset + limit < crews.length
        return { data: paginatedCrews, hasMore, total: crews.length }
      }
    }
    
    const crews = this.readTable<JoggingCrew>('jogging_crews')
    const paginatedCrews = crews.slice(offset, offset + limit)
    const hasMore = offset + limit < crews.length
    return { data: paginatedCrews, hasMore, total: crews.length }
  }

  async updateJoggingCrew(id: string, updates: Partial<JoggingCrew>): Promise<JoggingCrew | null> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        const updateData: any = {}
        if (updates.name !== undefined) updateData.name = updates.name
        if (updates.maxMembers !== undefined) updateData.max_members = updates.maxMembers
        if (updates.targetDistance !== undefined) updateData.target_distance = updates.targetDistance || null
        if (updates.targetTime !== undefined) updateData.target_time = updates.targetTime || null
        if (updates.alarm !== undefined) updateData.alarm = updates.alarm || null
        if (updates.videoShareEnabled !== undefined) updateData.video_share_enabled = updates.videoShareEnabled
        if (updates.audioShareEnabled !== undefined) updateData.audio_share_enabled = updates.audioShareEnabled
        if (updates.currentMembers !== undefined) updateData.current_members = updates.currentMembers
        if (updates.memberIds !== undefined) updateData.member_ids = updates.memberIds
        if (updates.recommendations !== undefined) updateData.recommendations = updates.recommendations
        if (updates.isDormant !== undefined) updateData.is_dormant = updates.isDormant
        if (updates.lastActivityAt !== undefined) updateData.last_activity_at = new Date(updates.lastActivityAt).toISOString()
        if (updates.dormantAt !== undefined) updateData.dormant_at = updates.dormantAt ? new Date(updates.dormantAt).toISOString() : null
        if (updates.scheduledDeletionAt !== undefined) updateData.scheduled_deletion_at = updates.scheduledDeletionAt ? new Date(updates.scheduledDeletionAt).toISOString() : null
        
        const { data, error } = await supabase
          .from('jogging_crews')
          .update(updateData)
          .eq('id', id)
          .select()
          .single()
        
        if (error) {
          console.error('Supabase 조깅 크루 수정 실패:', error)
          throw error
        }
        
        return data ? this.mapSupabaseJoggingCrew(data) : null
      } catch (e) {
        console.error('Supabase 조깅 크루 수정 중 오류:', e)
        // Supabase 실패 시 localStorage로 폴백
      }
    }
    
    // localStorage 수정
    const crews = this.readTable<JoggingCrew>('jogging_crews')
    const index = crews.findIndex((c) => c.id === id)
    if (index === -1) return null
    crews[index] = { ...crews[index], ...updates }
    this.writeTable('jogging_crews', crews)
    return crews[index]
  }

  async deleteJoggingCrew(id: string): Promise<boolean> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        // 채팅 메시지 삭제 (조깅 크루는 채팅이 없을 수 있지만 안전을 위해)
        // 조깅 크루는 채팅 테이블이 없으므로 스킵
        
        // 조깅 크루 삭제
        const { error } = await supabase
          .from('jogging_crews')
          .delete()
          .eq('id', id)
        
        if (error) {
          console.error('Supabase 조깅 크루 삭제 실패:', error)
          throw error
        }
        
        return true
      } catch (e) {
        console.error('Supabase 조깅 크루 삭제 중 오류:', e)
        // Supabase 실패 시 에러를 다시 throw하여 사용자에게 알림
        throw e
      }
    }
    
    // localStorage 삭제
    const crews = this.readTable<JoggingCrew>('jogging_crews')
    const filtered = crews.filter((c) => c.id !== id)
    this.writeTable('jogging_crews', filtered)
    
    return filtered.length < crews.length
  }

  async joinJoggingCrew(crewId: string, userId: string): Promise<boolean> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        // Supabase 사용
        if (!supabase) throw new Error('Supabase client not initialized')
        
        console.log('joinJoggingCrew - crewId:', crewId, 'userId:', userId)
        
        // localStorage 사용자는 UUID가 아닐 수 있으므로, email로 Supabase 사용자 찾기
        let supabaseUserId = userId
        
        // UUID 형식이 아니면 email로 사용자 찾기
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId)) {
          supabaseUserId = await this.getSupabaseUserId(userId)
        }
        
        // 크루 존재 확인 및 멤버 제한 확인
        const crew = await this.getJoggingCrewById(crewId)
        if (!crew) {
          throw new Error('조깅 크루를 찾을 수 없습니다.')
        }
        if (crew.maxMembers !== null && crew.currentMembers >= crew.maxMembers) {
          throw new Error('조깅 크루 인원이 가득 찼습니다.')
        }
        
        // 이미 멤버인지 확인
        if (crew.memberIds.includes(supabaseUserId)) {
          console.log('이미 조깅 크루 멤버입니다.')
          return true
        }
        
        // memberIds 배열에 사용자 추가
        const updatedMemberIds = [...crew.memberIds, supabaseUserId]
        
        // 조깅 크루 업데이트
        await this.updateJoggingCrew(crewId, {
          currentMembers: crew.currentMembers + 1,
          memberIds: updatedMemberIds,
          lastActivityAt: Date.now(),
        })
        
        // 조깅 크루 계급 업데이트 (비동기, 에러가 나도 계속 진행)
        import('@/services/rankService').then(({ rankService }) => {
          rankService.updateCrewRank(crewId, true).catch(err => {
            console.warn('조깅 크루 계급 업데이트 실패:', err)
          })
        })
        
        console.log('조깅 크루 참여 성공')
        return true
      } catch (e) {
        console.error('조깅 크루 참여 실패:', e)
        throw e
      }
    }
    
    // localStorage
    const crew = await this.getJoggingCrewById(crewId)
    if (!crew) return false
    if (crew.maxMembers && crew.currentMembers >= crew.maxMembers) return false
    if (crew.memberIds.includes(userId)) return false

    await this.updateJoggingCrew(crewId, {
      currentMembers: crew.currentMembers + 1,
      memberIds: [...crew.memberIds, userId],
    })
    return true
  }

  async leaveJoggingCrew(crewId: string, userId: string): Promise<boolean> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        // Supabase 사용
        if (!supabase) throw new Error('Supabase client not initialized')
        
        // localStorage 사용자는 UUID가 아닐 수 있으므로, email로 Supabase 사용자 찾기
        let supabaseUserId = userId
        
        // UUID 형식이 아니면 email로 사용자 찾기
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId)) {
          supabaseUserId = await this.getSupabaseUserId(userId)
        }
        
        const crew = await this.getJoggingCrewById(crewId)
        if (!crew) return false
        
        // 멤버가 아닌 경우
        if (!crew.memberIds.includes(supabaseUserId)) {
          console.log('조깅 크루 멤버가 아닙니다.')
          return false
        }

        // memberIds 배열에서 사용자 제거
        const updatedMemberIds = crew.memberIds.filter((id) => id !== supabaseUserId)
        
        await this.updateJoggingCrew(crewId, {
          currentMembers: Math.max(0, crew.currentMembers - 1),
          memberIds: updatedMemberIds,
        })
        
        console.log('조깅 크루 탈퇴 성공')
        return true
      } catch (e) {
        console.error('조깅 크루 탈퇴 실패:', e)
        throw e
      }
    }
    
    // localStorage
    const crew = await this.getJoggingCrewById(crewId)
    if (!crew) return false

    await this.updateJoggingCrew(crewId, {
      currentMembers: Math.max(0, crew.currentMembers - 1),
      memberIds: crew.memberIds.filter((id) => id !== userId),
    })
    return true
  }

  // ============ Chat 관련 ============
  async addChatMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      if (!supabase) throw new Error('Supabase client not initialized')
      
      console.log('addChatMessage - crewId:', message.crewId, 'userId:', message.userId)
      
      // localStorage 사용자는 UUID가 아닐 수 있으므로, email로 Supabase 사용자 찾기
      let supabaseUserId = message.userId
      
      // 시스템 메시지인 경우 특별 처리
      // 시스템 메시지는 실제 사용자 ID를 사용하거나, 시스템 사용자를 생성해야 함
      // 여기서는 시스템 메시지를 보낸 사용자(현재 사용자)의 ID를 사용
      if (message.userId === 'system') {
        // 시스템 메시지는 현재 로그인한 사용자의 ID를 사용
        const currentUser = authService.getCurrentUser()
        if (currentUser) {
          // 현재 사용자의 UUID 찾기
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          if (uuidRegex.test(currentUser.id)) {
            supabaseUserId = currentUser.id
          } else {
            // localStorage ID인 경우 email로 UUID 찾기
            const userStr = localStorage.getItem(`user_${currentUser.id}`)
            if (userStr) {
              const user = JSON.parse(userStr)
              if (user.email) {
                const { data: supabaseUser } = await supabase
                  .from('users')
                  .select('id')
                  .eq('email', user.email)
                  .single()
                
                if (supabaseUser) {
                  supabaseUserId = supabaseUser.id
                } else {
                  // Supabase에 사용자가 없으면 localStorage로 폴백
    const messages = this.readTable<ChatMessage>('chats')
    const newMessage: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    }
    messages.push(newMessage)
    this.writeTable('chats', messages)
    return newMessage
                }
              }
            }
          }
        } else {
          // 현재 사용자가 없으면 localStorage로 폴백
          const messages = this.readTable<ChatMessage>('chats')
          const newMessage: ChatMessage = {
            ...message,
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
          }
          messages.push(newMessage)
          this.writeTable('chats', messages)
          return newMessage
        }
      } else {
        // UUID 형식이 아니면 email로 사용자 찾기
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(message.userId)) {
          const userStr = localStorage.getItem(`user_${message.userId}`)
          if (userStr) {
            const user = JSON.parse(userStr)
            if (user.email) {
              const { data: supabaseUser, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('email', user.email)
                .single()
              
              if (userError || !supabaseUser) {
                console.warn('Supabase 사용자를 찾을 수 없음:', userError)
                // Supabase에 사용자가 없으면 localStorage로 폴백
                const messages = this.readTable<ChatMessage>('chats')
                const newMessage: ChatMessage = {
                  ...message,
                  id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  timestamp: Date.now(),
                }
                messages.push(newMessage)
                this.writeTable('chats', messages)
                return newMessage
              }
              
              supabaseUserId = supabaseUser.id
              console.log('Supabase 사용자 ID 매핑:', message.userId, '->', supabaseUserId)
            }
          }
        }
      }
      
      // crewId가 일반 크루인지 조깅크루인지 확인
      let isJoggingCrew = false
      let crewIdToUse = message.crewId
      let joggingCrewIdToUse: string | null = null
      
      try {
        // 먼저 jogging_crews 테이블에서 확인
        const { data: joggingCrew, error: joggingError } = await supabase
          .from('jogging_crews')
          .select('id')
          .eq('id', message.crewId)
          .maybeSingle()
        
        if (!joggingError && joggingCrew) {
          isJoggingCrew = true
          joggingCrewIdToUse = message.crewId
          crewIdToUse = null
          console.log('💬 조깅크루로 확인됨:', message.crewId)
        } else {
          // 일반 크루인지 확인
          const { data: regularCrew, error: regularError } = await supabase
            .from('crews')
            .select('id')
            .eq('id', message.crewId)
            .maybeSingle()
          
          if (!regularError && regularCrew) {
            isJoggingCrew = false
            crewIdToUse = message.crewId
            joggingCrewIdToUse = null
            console.log('💬 일반 크루로 확인됨:', message.crewId)
          } else {
            console.warn('💬 크루를 찾을 수 없음 (일반 크루도 조깅크루도 아님):', message.crewId)
            // 기본적으로 일반 크루로 처리 (하위 호환성)
            isJoggingCrew = false
            crewIdToUse = message.crewId
            joggingCrewIdToUse = null
          }
        }
      } catch (e) {
        console.error('💬 크루 타입 확인 실패:', e)
        // 에러 발생 시 기본적으로 일반 크루로 처리
        isJoggingCrew = false
        crewIdToUse = message.crewId
        joggingCrewIdToUse = null
      }
      
      // 시스템 메시지의 경우 중복 체크 (최근 10초 이내 동일한 메시지가 있는지 확인)
      if (message.type === 'system') {
        const tenSecondsAgo = new Date(Date.now() - 10000).toISOString()
        let query = supabase
          .from('chat_messages')
          .select('id, message, timestamp')
          .eq('type', 'system')
          .eq('message', message.message)
          .gte('timestamp', tenSecondsAgo)
          .order('timestamp', { ascending: false })
          .limit(1)
        
        if (isJoggingCrew) {
          query = query.eq('jogging_crew_id', message.crewId)
        } else {
          query = query.eq('crew_id', message.crewId)
        }
        
        const { data: recentMessages } = await query
        
        if (recentMessages && recentMessages.length > 0) {
          console.log('⚠️ 중복 시스템 메시지 감지, 저장 건너뜀:', message.message)
          // 최근 메시지를 반환 (중복 저장 방지)
          const recentMsg = recentMessages[0]
          return {
            id: recentMsg.id,
            crewId: message.crewId,
            userId: message.userId,
            userName: message.userName,
            message: recentMsg.message,
            timestamp: new Date(recentMsg.timestamp).getTime(),
            type: message.type,
          }
        }
      }
      
      // 메시지 삽입
      const insertData: any = {
        user_id: supabaseUserId,
        user_name: message.userName,
        message: message.message,
        type: message.type,
      }
      
      if (isJoggingCrew) {
        insertData.jogging_crew_id = joggingCrewIdToUse
        insertData.crew_id = null
      } else {
        insertData.crew_id = crewIdToUse
        insertData.jogging_crew_id = null
      }
      
      const { data: newMessage, error } = await supabase
        .from('chat_messages')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error('chat_messages 삽입 에러:', error)
        throw error
      }

      return {
        id: newMessage.id,
        crewId: newMessage.crew_id || newMessage.jogging_crew_id || message.crewId, // crew_id 또는 jogging_crew_id 사용
        userId: message.userId, // 원본 userId 유지
        userName: newMessage.user_name,
        message: newMessage.message,
        timestamp: new Date(newMessage.timestamp).getTime(),
        type: newMessage.type as 'text' | 'system',
      }
    } else {
      const messages = this.readTable<ChatMessage>('chats')
      const newMessage: ChatMessage = {
        ...message,
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      }
      messages.push(newMessage)
      this.writeTable('chats', messages)
      return newMessage
    }
  }

  async getChatMessages(crewId: string, limit?: number): Promise<ChatMessage[]> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      if (!supabase) throw new Error('Supabase client not initialized')
      
      // crewId가 조깅크루인지 일반 크루인지 확인
      let isJoggingCrew = false
      try {
        const { data: joggingCrew, error: joggingError } = await supabase
          .from('jogging_crews')
          .select('id')
          .eq('id', crewId)
          .maybeSingle()
        
        if (!joggingError && joggingCrew) {
          isJoggingCrew = true
        } else {
          // 조깅크루가 아니면 일반 크루로 처리
          isJoggingCrew = false
        }
      } catch (e) {
        // 조깅크루가 아니면 일반 크루로 처리
        isJoggingCrew = false
      }
      
      // crew_id 또는 jogging_crew_id로 조회
      let query = supabase
        .from('chat_messages')
        .select('*')
        .order('timestamp', { ascending: true })

      if (isJoggingCrew) {
        query = query.eq('jogging_crew_id', crewId)
      } else {
        query = query.eq('crew_id', crewId)
      }

      if (limit) {
        query = query.limit(limit)
      }

      const { data: messages, error } = await query

      if (error) {
        console.error('chat_messages 조회 에러:', error)
        throw error
      }

      // Supabase 메시지를 로컬 형식으로 변환
      // userId는 원본을 유지하기 위해 users 테이블에서 조회 필요
      const chatMessages: ChatMessage[] = []
      
      for (const msg of messages || []) {
        // crewId는 crew_id 또는 jogging_crew_id 중 하나를 사용
        const msgCrewId = msg.crew_id || msg.jogging_crew_id || crewId
        
        // 시스템 메시지인 경우
        if (msg.user_id === '00000000-0000-0000-0000-000000000000') {
          chatMessages.push({
            id: msg.id,
            crewId: msgCrewId,
            userId: 'system',
            userName: msg.user_name,
            message: msg.message,
            timestamp: new Date(msg.timestamp).getTime(),
            type: msg.type as 'text' | 'system',
          })
        } else {
          // 일반 메시지인 경우, userId는 원본을 찾기 어려우므로 Supabase user_id를 그대로 사용
          // 또는 users 테이블에서 email로 찾아서 매핑
          chatMessages.push({
            id: msg.id,
            crewId: msgCrewId,
            userId: msg.user_id, // Supabase UUID 사용
            userName: msg.user_name,
            message: msg.message,
            timestamp: new Date(msg.timestamp).getTime(),
            type: msg.type as 'text' | 'system',
          })
        }
      }

      return chatMessages
    } else {
    const messages = this.readTable<ChatMessage>('chats')
    const filtered = messages.filter((m) => m.crewId === crewId).sort((a, b) => a.timestamp - b.timestamp)
    return limit ? filtered.slice(-limit) : filtered
    }
  }

  // ============ JoggingSession 관련 ============
  async createJoggingSession(session: Omit<JoggingSession, 'id'>): Promise<JoggingSession> {
    await this.initialize()
    const sessions = this.readTable<JoggingSession>('jogging_sessions')
    const newSession: JoggingSession = {
      ...session,
      id: `jsession_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }
    sessions.push(newSession)
    this.writeTable('jogging_sessions', sessions)
    return newSession
  }

  async getJoggingSessionById(id: string): Promise<JoggingSession | null> {
    await this.initialize()
    const sessions = this.readTable<JoggingSession>('jogging_sessions')
    return sessions.find((s) => s.id === id) || null
  }

  async updateJoggingSession(id: string, updates: Partial<JoggingSession>): Promise<JoggingSession | null> {
    await this.initialize()
    const sessions = this.readTable<JoggingSession>('jogging_sessions')
    const index = sessions.findIndex((s) => s.id === id)
    if (index === -1) return null
    sessions[index] = { ...sessions[index], ...updates }
    this.writeTable('jogging_sessions', sessions)
    return sessions[index]
  }

  async getJoggingSessionsByUserId(
    userId: string,
    options?: {
      limit?: number
      offset?: number
      orderBy?: 'start_time' | 'end_time'
      orderDirection?: 'asc' | 'desc'
    }
  ): Promise<{ sessions: JoggingSession[]; total: number; hasMore: boolean }> {
    await this.initialize()
    
    const limit = options?.limit || 50
    const offset = options?.offset || 0
    const orderBy = options?.orderBy || 'end_time'
    const orderDirection = options?.orderDirection || 'desc'

    if (USE_SUPABASE && supabase) {
      try {
        // UUID 매핑
        let supabaseUserId = userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId)) {
          supabaseUserId = await this.getSupabaseUserId(userId)
        }

        // 총 개수 조회
        const { count, error: countError } = await supabase
          .from('jogging_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', supabaseUserId)
          .eq('completed', true)

        if (countError) {
          console.error('❌ Supabase 조깅 세션 개수 조회 실패:', countError)
          throw countError
        }

        // 페이지네이션으로 데이터 조회
        let query = supabase
          .from('jogging_sessions')
          .select('*')
          .eq('user_id', supabaseUserId)
          .eq('completed', true)
          .order(orderBy === 'start_time' ? 'start_time' : 'end_time', { ascending: orderDirection === 'asc' })
          .range(offset, offset + limit - 1)

        const { data, error } = await query

        if (error) {
          console.error('❌ Supabase 조깅 세션 조회 실패:', error)
          throw error
        }

        const sessions = (data || []).map(s => this.mapSupabaseJoggingSession(s))
        const total = count || 0
        const hasMore = offset + limit < total

        return { sessions, total, hasMore }
      } catch (error) {
        console.error('조깅 세션 조회 중 오류:', error)
        throw error
      }
    } else {
      const sessions = this.readTable<JoggingSession>('jogging_sessions')
      const userSessions = sessions
        .filter(s => s.userId === userId && s.completed)
        .sort((a, b) => {
          const aTime = orderBy === 'start_time' ? a.startTime : (a.endTime || a.startTime)
          const bTime = orderBy === 'start_time' ? b.startTime : (b.endTime || b.startTime)
          return orderDirection === 'asc' ? aTime - bTime : bTime - aTime
        })
      
      const total = userSessions.length
      const paginatedSessions = userSessions.slice(offset, offset + limit)
      const hasMore = offset + limit < total

      return { sessions: paginatedSessions, total, hasMore }
    }
  }

  private mapSupabaseJoggingSession(data: any): JoggingSession {
    return {
      id: data.id,
      userId: data.user_id,
      crewId: data.crew_id || undefined,
      mode: data.mode,
      distance: data.distance,
      averageSpeed: data.average_speed,
      averageTime: data.average_time,
      route: data.route || [],
      startTime: new Date(data.start_time).getTime(),
      endTime: data.end_time ? new Date(data.end_time).getTime() : undefined,
      completed: data.completed,
      score: data.score || undefined,
    }
  }

  // ============ SharedJoggingCourse 관련 ============
  async createSharedJoggingCourse(course: Omit<SharedJoggingCourse, 'id' | 'createdAt'>): Promise<SharedJoggingCourse> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        // UUID 매핑 (localStorage 사용자 ID를 Supabase UUID로 변환)
        let supabaseUserId = course.userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(course.userId)) {
          supabaseUserId = await this.getSupabaseUserId(course.userId)
        }

        const now = Date.now()
        const { data, error } = await supabase
          .from('shared_jogging_courses')
          .insert({
            user_id: supabaseUserId,
            name: course.name || null,
            route: course.route,
            total_distance: course.totalDistance,
            created_at: new Date(now).toISOString(),
          })
          .select()
          .single()

        if (error) {
          console.error('조깅 코스 공유 저장 실패:', error)
          // RLS 정책 에러인 경우 더 자세한 메시지 제공
          if (error.code === '42501') {
            console.error('❌ RLS 정책 위반: shared_jogging_courses 테이블의 RLS 정책을 확인해주세요.')
            console.error('요청한 사용자 ID:', course.userId)
            console.error('변환된 Supabase UUID:', supabaseUserId)
            console.error('')
            console.error('🔧 해결 방법:')
            console.error('1. Supabase SQL Editor에서 다음 중 하나를 실행하세요:')
            console.error('   - docs/FIX_SHARED_JOGGING_COURSES_RLS.sql (RLS 정책 수정)')
            console.error('   - docs/DISABLE_SHARED_JOGGING_COURSES_RLS.sql (RLS 완전 비활성화)')
            console.error('')
            console.error('2. 또는 Supabase 대시보드에서:')
            console.error('   - Authentication → Policies → shared_jogging_courses')
            console.error('   - INSERT 정책을 "TO anon, authenticated"로 변경')
            console.error('   - WITH CHECK를 "true"로 변경')
          }
          throw error
        }

        return {
          id: data.id,
          userId: course.userId, // 원본 userId 유지
          name: data.name || undefined,
          route: data.route,
          totalDistance: data.total_distance,
          createdAt: new Date(data.created_at).getTime(),
          updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : undefined,
        }
      } catch (error) {
        console.error('조깅 코스 공유 저장 중 오류:', error)
        throw error
      }
    } else {
      const courses = this.readTable<SharedJoggingCourse>('shared_jogging_courses')
      const now = Date.now()
      const newCourse: SharedJoggingCourse = {
        ...course,
        id: `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
      }
      courses.push(newCourse)
      this.writeTable('shared_jogging_courses', courses)
      return newCourse
    }
  }

  async getSharedJoggingCourses(limit: number = 50, offset: number = 0): Promise<{ data: SharedJoggingCourse[]; hasMore: boolean }> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        // 전체 개수 조회
        const { count } = await supabase
          .from('shared_jogging_courses')
          .select('*', { count: 'exact', head: true })

        const { data, error } = await supabase
          .from('shared_jogging_courses')
          .select(`
            *,
            users!shared_jogging_courses_user_id_fkey(id, name, email)
          `)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (error) {
          console.error('공유 조깅 코스 조회 실패:', error)
          return { data: [], hasMore: false }
        }

        const hasMore = count ? offset + limit < count : false

        // userId 매핑 (Supabase UUID를 localStorage userId로 변환)
        const courses: SharedJoggingCourse[] = []
        for (const item of data || []) {
          try {
            // Supabase UUID를 localStorage userId로 변환 시도
            let originalUserId = item.user_id
            // 역매핑 시도 (캐시에서 찾기)
            for (const [localId, supabaseId] of this.userIdMappingCache.entries()) {
              if (supabaseId === item.user_id) {
                originalUserId = localId
                break
              }
            }

            courses.push({
              id: item.id,
              userId: originalUserId,
              name: item.name || undefined,
              route: item.route,
              totalDistance: item.total_distance,
              createdAt: new Date(item.created_at).getTime(),
              updatedAt: item.updated_at ? new Date(item.updated_at).getTime() : undefined,
            })
          } catch (error) {
            console.error('코스 변환 실패:', error)
          }
        }

        return { data: courses, hasMore }
      } catch (error) {
        console.error('공유 조깅 코스 조회 중 오류:', error)
        return { data: [], hasMore: false }
      }
    } else {
      const courses = this.readTable<SharedJoggingCourse>('shared_jogging_courses')
      const sorted = courses.sort((a, b) => b.createdAt - a.createdAt)
      const paginated = sorted.slice(offset, offset + limit)
      return {
        data: paginated,
        hasMore: offset + limit < sorted.length,
      }
    }
  }

  async getSharedJoggingCourseById(id: string): Promise<SharedJoggingCourse | null> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        const { data, error } = await supabase
          .from('shared_jogging_courses')
          .select('*')
          .eq('id', id)
          .single()

        if (error || !data) {
          return null
        }

        // userId 역매핑
        let originalUserId = data.user_id
        for (const [localId, supabaseId] of this.userIdMappingCache.entries()) {
          if (supabaseId === data.user_id) {
            originalUserId = localId
            break
          }
        }

        return {
          id: data.id,
          userId: originalUserId,
          name: data.name || undefined,
          route: data.route,
          totalDistance: data.total_distance,
          createdAt: new Date(data.created_at).getTime(),
          updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : undefined,
        }
      } catch (error) {
        console.error('공유 조깅 코스 조회 실패:', error)
        return null
      }
    } else {
      const courses = this.readTable<SharedJoggingCourse>('shared_jogging_courses')
      return courses.find((c) => c.id === id) || null
    }
  }

  async deleteSharedJoggingCourse(id: string, userId: string): Promise<boolean> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        // UUID 매핑
        let supabaseUserId = userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId)) {
          supabaseUserId = await this.getSupabaseUserId(userId)
        }

        // 소유자 확인
        const course = await this.getSharedJoggingCourseById(id)
        if (!course) {
          return false
        }

        // userId 비교 (원본 userId와 비교)
        let courseSupabaseUserId = course.userId
        const courseUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!courseUuidRegex.test(course.userId)) {
          courseSupabaseUserId = await this.getSupabaseUserId(course.userId)
        }

        if (courseSupabaseUserId !== supabaseUserId) {
          throw new Error('본인이 생성한 코스만 삭제할 수 있습니다.')
        }

        const { error } = await supabase
          .from('shared_jogging_courses')
          .delete()
          .eq('id', id)

        if (error) {
          console.error('조깅 코스 삭제 실패:', error)
          return false
        }

        return true
      } catch (error) {
        console.error('조깅 코스 삭제 중 오류:', error)
        return false
      }
    } else {
      const courses = this.readTable<SharedJoggingCourse>('shared_jogging_courses')
      const index = courses.findIndex((c) => c.id === id && c.userId === userId)
      if (index === -1) return false
      courses.splice(index, 1)
      this.writeTable('shared_jogging_courses', courses)
      return true
    }
  }

  // ============ RealtimeJoggingRoute 관련 (조깅크루 실시간 경로 공유) ============
  async upsertRealtimeJoggingRoute(route: Omit<RealtimeJoggingRoute, 'id'>): Promise<RealtimeJoggingRoute> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        // UUID 매핑
        let supabaseUserId = route.userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(route.userId)) {
          supabaseUserId = await this.getSupabaseUserId(route.userId)
        }

        // userName 가져오기 (route.userName이 없으면 데이터베이스에서 조회)
        let userName = route.userName
        if (!userName) {
          const userProfile = await this.getUserById(route.userId)
          userName = userProfile?.name || 'Unknown'
        }

        const now = Date.now()
        
        // user_name 컬럼이 있는지 확인하여 조건부로 포함
        // SQL 마이그레이션 스크립트 실행 전까지는 user_name을 저장하지 않음
        const upsertData: any = {
          user_id: supabaseUserId,
          crew_id: route.crewId,
          route: route.route,
          total_distance: route.totalDistance,
          start_time: new Date(route.startTime).toISOString(),
          last_update_time: new Date(route.lastUpdateTime).toISOString(),
          is_active: route.isActive,
        }
        
        // user_name 컬럼이 있으면 포함 (마이그레이션 후)
        // 주석 해제: SQL 마이그레이션 스크립트 실행 후 활성화
        // upsertData.user_name = userName
        
        const { data, error } = await supabase
          .from('realtime_jogging_routes')
          .upsert(upsertData, {
            onConflict: 'user_id,crew_id',
          })
          .select()
          .single()

        if (error) {
          console.error('실시간 경로 공유 저장 실패:', error)
          throw error
        }

        return {
          id: data.id,
          userId: route.userId, // 원본 userId 유지
          crewId: data.crew_id,
          userName: userName, // route.userName 또는 조회한 userName 사용 (user_name 컬럼은 마이그레이션 후 사용)
          route: data.route,
          totalDistance: data.total_distance,
          startTime: new Date(data.start_time).getTime(),
          lastUpdateTime: new Date(data.last_update_time).getTime(),
          isActive: data.is_active,
        }
      } catch (error) {
        console.error('실시간 경로 공유 저장 중 오류:', error)
        throw error
      }
    } else {
      const routes = this.readTable<RealtimeJoggingRoute>('realtime_jogging_routes')
      const existingIndex = routes.findIndex(r => r.userId === route.userId && r.crewId === route.crewId)
      
      if (existingIndex !== -1) {
        routes[existingIndex] = { ...routes[existingIndex], ...route }
      } else {
        routes.push({
          ...route,
          id: `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        })
      }
      this.writeTable('realtime_jogging_routes', routes)
      return routes[existingIndex !== -1 ? existingIndex : routes.length - 1]
    }
  }

  async getRealtimeJoggingRoutesByCrew(crewId: string): Promise<RealtimeJoggingRoute[]> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        const { data, error } = await supabase
          .from('realtime_jogging_routes')
          .select(`
            *,
            users!realtime_jogging_routes_user_id_fkey(id, name, email)
          `)
          .eq('crew_id', crewId)
          .eq('is_active', true) // 활성화된 경로만 조회
          .order('last_update_time', { ascending: false })
        
        console.log('🔍 실시간 경로 조회 결과:', { 
          crewId, 
          dataCount: data?.length || 0,
          data: data?.map(d => ({ 
            user_id: d.user_id, 
            user_name: d.user_name, 
            is_active: d.is_active,
            route_points: d.route?.length || 0,
            users: d.users 
          })) 
        })

        if (error) {
          console.error('실시간 경로 조회 실패:', error)
          return []
        }

        // userId 역매핑
        const routes: RealtimeJoggingRoute[] = []
        for (const item of data || []) {
          try {
            let originalUserId = item.user_id
            for (const [localId, supabaseId] of this.userIdMappingCache.entries()) {
              if (supabaseId === item.user_id) {
                originalUserId = localId
                break
              }
            }

            // userName 가져오기 (users 조인 또는 user_name 필드)
            let userName = item.user_name || 'Unknown'
            if (item.users && typeof item.users === 'object' && 'name' in item.users) {
              userName = (item.users as any).name || userName
            }

            routes.push({
              id: item.id,
              userId: originalUserId,
              crewId: item.crew_id,
              userName: userName,
              route: item.route,
              totalDistance: item.total_distance,
              startTime: new Date(item.start_time).getTime(),
              lastUpdateTime: new Date(item.last_update_time).getTime(),
              isActive: item.is_active,
            })
          } catch (error) {
            console.error('경로 변환 실패:', error)
          }
        }

        return routes
      } catch (error) {
        console.error('실시간 경로 조회 중 오류:', error)
        return []
      }
    } else {
      const routes = this.readTable<RealtimeJoggingRoute>('realtime_jogging_routes')
      return routes.filter(r => r.crewId === crewId && r.isActive)
    }
  }

  async deactivateRealtimeJoggingRoute(userId: string, crewId: string): Promise<boolean> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        // UUID 매핑
        let supabaseUserId = userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId)) {
          supabaseUserId = await this.getSupabaseUserId(userId)
        }

        const { error } = await supabase
          .from('realtime_jogging_routes')
          .update({ is_active: false })
          .eq('user_id', supabaseUserId)
          .eq('crew_id', crewId)

        if (error) {
          console.error('실시간 경로 비활성화 실패:', error)
          return false
        }

        return true
      } catch (error) {
        console.error('실시간 경로 비활성화 중 오류:', error)
        return false
      }
    } else {
      const routes = this.readTable<RealtimeJoggingRoute>('realtime_jogging_routes')
      const index = routes.findIndex(r => r.userId === userId && r.crewId === crewId)
      if (index !== -1) {
        routes[index].isActive = false
        this.writeTable('realtime_jogging_routes', routes)
        return true
      }
      return false
    }
  }

  // 크루의 모든 실시간 경로 비활성화 (조깅 종료 시 사용)
  async deactivateAllRealtimeJoggingRoutesByCrew(crewId: string): Promise<boolean> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        const { error } = await supabase
          .from('realtime_jogging_routes')
          .update({ is_active: false })
          .eq('crew_id', crewId)
          .eq('is_active', true) // 활성화된 것만 비활성화

        if (error) {
          console.error('크루의 모든 실시간 경로 비활성화 실패:', error)
          return false
        }

        console.log('✅ 크루의 모든 실시간 경로 비활성화 완료:', crewId)
        return true
      } catch (error) {
        console.error('크루의 모든 실시간 경로 비활성화 중 오류:', error)
        return false
      }
    } else {
      const routes = this.readTable<RealtimeJoggingRoute>('realtime_jogging_routes')
      const crewRoutes = routes.filter(r => r.crewId === crewId && r.isActive)
      crewRoutes.forEach(route => {
        route.isActive = false
      })
      this.writeTable('realtime_jogging_routes', routes)
      return true
    }
  }

  // ============ ExerciseSession 관련 ============
  async createExerciseSession(session: Omit<ExerciseSession, 'id'>): Promise<ExerciseSession> {
    await this.initialize()
    
    console.log('📊 운동 세션 저장 시작:', {
      USE_SUPABASE,
      supabaseAvailable: !!supabase,
      userId: session.userId,
      mode: session.mode,
      counts: session.counts.length,
      hasBestScore: !!session.bestScore,
      hasWorstScore: !!session.worstScore,
      hasAnalysis: !!session.analysis,
    })
    
    if (USE_SUPABASE && supabase) {
      try {
        // UUID 매핑
        let supabaseUserId = session.userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(session.userId)) {
          supabaseUserId = await this.getSupabaseUserId(session.userId)
        }
        
        // 중복 체크: 동일한 start_time, user_id, mode를 가진 세션이 이미 존재하는지 확인
        // (같은 시간에 같은 사용자가 같은 운동을 한 경우 중복으로 간주)
        // end_time도 포함하여 더 정확한 중복 체크
        const startTimeISO = new Date(session.startTime).toISOString()
        const endTimeISO = session.endTime ? new Date(session.endTime).toISOString() : null
        
        // 첫 번째 중복 체크: start_time 기준 (정확한 시간 매칭)
        const { data: existingSessions, error: checkError } = await supabase
          .from('exercise_sessions')
          .select('id, start_time, end_time, user_id, mode')
          .eq('user_id', supabaseUserId)
          .eq('mode', session.mode)
          .eq('start_time', startTimeISO) // 정확한 시간 매칭
          .limit(5) // 여러 개가 있을 수 있으므로 5개까지 확인
        
        if (checkError) {
          console.warn('⚠️ 중복 체크 중 오류 (계속 진행):', checkError)
        } else if (existingSessions && existingSessions.length > 0) {
          // end_time도 있는 경우 end_time도 비교
          let matchedSession = null
          if (endTimeISO) {
            matchedSession = existingSessions.find(s => s.end_time === endTimeISO)
          } else {
            // end_time이 없는 경우 첫 번째 세션 사용
            matchedSession = existingSessions[0]
          }
          
          if (matchedSession) {
            console.warn('⚠️ 중복 세션 발견 (정확한 시간 매칭). 기존 세션 반환:', {
              existingId: matchedSession.id,
              startTime: matchedSession.start_time,
              endTime: matchedSession.end_time,
              checkTime: new Date().toISOString(),
            })
            
            // 기존 세션 조회하여 반환
            const existing = await this.getExerciseSessionById(matchedSession.id)
            if (existing) {
              return existing
            }
          } else if (existingSessions.length > 0) {
            // start_time은 같지만 end_time이 다른 경우도 중복으로 간주 (같은 운동의 다른 저장 시도)
            console.warn('⚠️ 중복 세션 발견 (start_time 일치, end_time 다름). 기존 세션 반환:', {
              existingId: existingSessions[0].id,
              startTime: existingSessions[0].start_time,
              endTime: existingSessions[0].end_time,
              newEndTime: endTimeISO,
            })
            
            const existing = await this.getExerciseSessionById(existingSessions[0].id)
            if (existing) {
              return existing
            }
          }
        }
        
        // 두 번째 중복 체크: 시간 범위 기준 (1초 전후, race condition 방지)
        const { data: rangeSessions, error: rangeCheckError } = await supabase
          .from('exercise_sessions')
          .select('id, start_time, end_time')
          .eq('user_id', supabaseUserId)
          .eq('mode', session.mode)
          .eq('completed', true)
          .gte('start_time', new Date(session.startTime - 2000).toISOString()) // 2초 전
          .lte('start_time', new Date(session.startTime + 2000).toISOString()) // 2초 후
          .limit(1)
        
        if (!rangeCheckError && rangeSessions && rangeSessions.length > 0) {
          const rangeSession = rangeSessions[0]
          console.warn('⚠️ 중복 세션 발견 (시간 범위 체크). 기존 세션 반환:', {
            existingId: rangeSession.id,
            startTime: rangeSession.start_time,
            endTime: rangeSession.end_time,
            timeDiff: Math.abs(new Date(rangeSession.start_time).getTime() - session.startTime),
          })
          
          const existing = await this.getExerciseSessionById(rangeSession.id)
          if (existing) {
            return existing
          }
        }
        
        console.log('💾 Supabase에 저장 시도:', {
          table: 'exercise_sessions',
          originalUserId: session.userId,
          mappedUserId: supabaseUserId,
          userIdMatch: session.userId === supabaseUserId,
          mode: session.mode,
          completed: session.completed,
          hasCounts: session.counts.length > 0,
          hasBestScore: !!session.bestScore,
          hasWorstScore: !!session.worstScore,
          hasAnalysis: !!session.analysis,
        })
        
        // Supabase에 저장
        // analysis 컬럼이 없을 수 있으므로 조건부로 포함
        const insertData: any = {
          user_id: supabaseUserId,
          crew_id: session.crewId || null,
          mode: session.mode,
          config: session.config,
          start_time: new Date(session.startTime).toISOString(),
          end_time: session.endTime ? new Date(session.endTime).toISOString() : null,
          counts: session.counts,
          best_score: session.bestScore || null,
          worst_score: session.worstScore || null,
          average_score: session.averageScore,
          completed: session.completed,
        }
        
        // analysis 컬럼이 있는 경우에만 추가 (에러 방지)
        // 컬럼이 없으면 나중에 추가할 수 있도록 일단 제외
        // analysis 컬럼을 추가한 후에는 이 조건을 제거하세요
        if (session.analysis) {
          insertData.analysis = session.analysis
        }
        
        const { data, error } = await supabase
          .from('exercise_sessions')
          .insert(insertData)
          .select()
          .single()
        
        if (error) {
          // 중복 키 오류인 경우 (unique constraint 위반)
          if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
            console.warn('⚠️ 중복 키 오류 발생. 기존 세션 조회 시도:', error)
            // start_time과 user_id로 기존 세션 찾기
            const { data: existingData } = await supabase
              .from('exercise_sessions')
              .select('id')
              .eq('user_id', supabaseUserId)
              .eq('start_time', new Date(session.startTime).toISOString())
              .limit(1)
              .single()
            
            if (existingData) {
              const existing = await this.getExerciseSessionById(existingData.id)
              if (existing) {
                console.log('✅ 기존 세션 반환:', existing.id)
                return existing
              }
            }
          }
          
          console.error('❌ Supabase 운동 세션 저장 실패:', error)
          console.error('에러 상세:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          })
          throw error
        }
        
        console.log('✅ Supabase 저장 성공:', {
          sessionId: data?.id,
          userId: data?.user_id,
          completed: data?.completed,
          mode: data?.mode,
          endTime: data?.end_time,
          averageScore: data?.average_score,
          countsLength: Array.isArray(data?.counts) ? data.counts.length : 0,
        })
        console.log('📊 저장된 데이터 상세 확인:', {
          hasAnalysis: !!data?.analysis,
          hasBestScore: !!data?.best_score,
          hasWorstScore: !!data?.worst_score,
          bestScoreImageSize: data?.best_score?.image ? data.best_score.image.length : 0,
          worstScoreImageSize: data?.worst_score?.image ? data.worst_score.image.length : 0,
          analysisKeys: data?.analysis ? Object.keys(data.analysis) : [],
        })
        
        // 저장된 user_id가 현재 사용자와 일치하는지 확인
        if (data?.user_id !== supabaseUserId) {
          console.warn('⚠️ 저장된 user_id가 예상과 다릅니다:', {
            expected: supabaseUserId,
            actual: data?.user_id,
          })
        }
        
        // Supabase 데이터를 로컬 형식으로 변환
        return this.mapSupabaseExerciseSession(data)
      } catch (e) {
        console.error('❌ Supabase 운동 세션 저장 중 오류:', e)
        throw new Error(`운동 세션 저장 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`)
      }
    }
    
    // Supabase가 설정되지 않았으면 에러
    throw new Error('Supabase가 설정되지 않았습니다. .env 파일을 확인해주세요.')
  }

  async getExerciseSessionById(id: string): Promise<ExerciseSession | null> {
    await this.initialize()
    
    if (!USE_SUPABASE || !supabase) {
      throw new Error('Supabase가 설정되지 않았습니다.')
    }
    
    try {
      const { data, error } = await supabase
        .from('exercise_sessions')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          // 데이터가 없음
          return null
        }
        console.error('Supabase 운동 세션 조회 실패:', error)
        throw error
      }
      
      return data ? this.mapSupabaseExerciseSession(data) : null
    } catch (e) {
      console.error('운동 세션 조회 중 오류:', e)
      throw e
    }
  }

  async updateExerciseSession(id: string, updates: Partial<ExerciseSession>): Promise<ExerciseSession | null> {
    await this.initialize()
    
    if (!USE_SUPABASE || !supabase) {
      throw new Error('Supabase가 설정되지 않았습니다.')
    }
    
    try {
      const updateData: any = {}
      
      if (updates.config) updateData.config = updates.config
      if (updates.startTime) updateData.start_time = new Date(updates.startTime).toISOString()
      if (updates.endTime) updateData.end_time = new Date(updates.endTime).toISOString()
      if (updates.counts) updateData.counts = updates.counts
      if (updates.bestScore) updateData.best_score = updates.bestScore
      if (updates.worstScore) updateData.worst_score = updates.worstScore
      if (updates.averageScore !== undefined) updateData.average_score = updates.averageScore
      if (updates.completed !== undefined) updateData.completed = updates.completed
      if (updates.analysis) updateData.analysis = updates.analysis
      
      const { data, error } = await supabase
        .from('exercise_sessions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
      
      if (error) {
        console.error('Supabase 운동 세션 업데이트 실패:', error)
        throw error
      }
      
      return data ? this.mapSupabaseExerciseSession(data) : null
    } catch (e) {
      console.error('운동 세션 업데이트 중 오류:', e)
      throw e
    }
  }

  // 페이지네이션으로 운동 세션 조회
  async getExerciseSessionsByUserId(
    userId: string,
    options?: {
      limit?: number
      offset?: number
      orderBy?: 'start_time' | 'end_time'
      orderDirection?: 'asc' | 'desc'
    }
  ): Promise<{ sessions: ExerciseSession[]; total: number; hasMore: boolean }> {
    await this.initialize()
    
    const limit = options?.limit || 5
    const offset = options?.offset || 0
    const orderBy = options?.orderBy || 'end_time'
    const orderDirection = options?.orderDirection || 'desc'

    console.log('📖 운동 세션 조회 시작:', {
      USE_SUPABASE,
      supabaseAvailable: !!supabase,
      userId,
      limit,
      offset,
    })

    if (USE_SUPABASE && supabase) {
      try {
        // UUID 매핑
        let supabaseUserId = userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId)) {
          supabaseUserId = await this.getSupabaseUserId(userId)
        }

        console.log('🔍 Supabase에서 조회 시도:', {
          table: 'exercise_sessions',
          userId: supabaseUserId,
        })

        // 총 개수 조회
        const { count, error: countError } = await supabase
          .from('exercise_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', supabaseUserId)
          .eq('completed', true)

        if (countError) {
          console.error('❌ Supabase 운동 세션 개수 조회 실패:', countError)
          console.error('에러 상세:', {
            message: countError.message,
            details: countError.details,
            hint: countError.hint,
            code: countError.code,
          })
          throw countError
        }

        // 페이지네이션으로 데이터 조회
        // completed가 true인 세션만 조회 (운동 완료된 세션만)
        let query = supabase
          .from('exercise_sessions')
          .select('*')
          .eq('user_id', supabaseUserId)
          .eq('completed', true)
          .order(orderBy === 'start_time' ? 'start_time' : 'end_time', { ascending: orderDirection === 'asc' })
          .range(offset, offset + limit - 1)
        
        console.log('🔍 조회 쿼리 조건:', {
          user_id: supabaseUserId,
          completed: true,
          orderBy,
          orderDirection,
          offset,
          limit,
        })

        const { data, error } = await query

        if (error) {
          console.error('❌ Supabase 운동 세션 조회 실패:', error)
          console.error('에러 상세:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          })
          throw error
        }
        
        console.log('📊 조회된 원본 데이터:', {
          rawDataCount: data?.length || 0,
          firstItemSample: data?.[0] ? {
            id: data[0].id,
            user_id: data[0].user_id,
            completed: data[0].completed,
            has_end_time: !!data[0].end_time,
            has_best_score: !!data[0].best_score,
            has_worst_score: !!data[0].worst_score,
            has_analysis: !!data[0].analysis,
          } : null,
        })

        // 원본 데이터에서 중복 제거 (ID 기준)
        const uniqueDataMap = new Map()
        ;(data || []).forEach((s: any) => {
          if (!uniqueDataMap.has(s.id)) {
            uniqueDataMap.set(s.id, s)
          } else {
            console.warn('⚠️ 중복된 세션 ID 발견 (원본 데이터):', {
              id: s.id,
              start_time: s.start_time,
              end_time: s.end_time,
            })
          }
        })
        
        const uniqueData = Array.from(uniqueDataMap.values())
        
        // 매핑 후에도 중복 제거 (이중 안전장치)
        const sessionsMap = new Map()
        uniqueData.forEach((s: any) => {
          const mapped = this.mapSupabaseExerciseSession(s)
          if (sessionsMap.has(mapped.id)) {
            console.warn('⚠️ 중복된 세션 ID 발견 (매핑 후):', {
              id: mapped.id,
              startTime: mapped.startTime,
              endTime: mapped.endTime,
            })
          } else {
            sessionsMap.set(mapped.id, mapped)
          }
        })
        
        const sessions = Array.from(sessionsMap.values())
        const total = count || 0
        const hasMore = offset + limit < total

        // 조회된 데이터 확인
        const sessionsWithAnalysis = sessions.filter(s => s.analysis).length
        const sessionsWithBestScore = sessions.filter(s => s.bestScore).length
        const sessionsWithWorstScore = sessions.filter(s => s.worstScore).length
        const sessionsWithImages = sessions.filter(s => s.bestScore?.image || s.worstScore?.image).length
        
        // 중복 제거 전후 비교
        if (data && data.length !== uniqueData.length) {
          console.warn('⚠️ 원본 데이터에서 중복 제거:', {
            원본개수: data.length,
            중복제거후: uniqueData.length,
            제거된개수: data.length - uniqueData.length,
          })
        }
        
        if (uniqueData.length !== sessions.length) {
          console.warn('⚠️ 매핑 후 중복 제거:', {
            매핑전개수: uniqueData.length,
            매핑후개수: sessions.length,
            제거된개수: uniqueData.length - sessions.length,
          })
        }
        
        console.log('✅ Supabase 조회 성공:', {
          sessionsCount: sessions.length,
          total,
          hasMore,
          sessionsWithAnalysis,
          sessionsWithBestScore,
          sessionsWithWorstScore,
          sessionsWithImages,
        })

        return { sessions, total, hasMore }
      } catch (e) {
        console.error('❌ Supabase 운동 세션 조회 중 오류:', e)
        throw new Error(`운동 세션 조회 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`)
      }
    }

    // Supabase가 설정되지 않았으면 에러
    throw new Error('Supabase가 설정되지 않았습니다. .env 파일을 확인해주세요.')
  }

  // Supabase 데이터 매핑 헬퍼 함수들
  private mapSupabaseUser(user: any): User {
    return {
      id: user.id,
      email: user.email,
      password: user.password,
      name: user.name,
      avatar: user.avatar,
      createdAt: new Date(user.created_at).getTime(),
      lastLoginAt: user.last_login_at ? new Date(user.last_login_at).getTime() : undefined,
      role: user.role || 'user',
      isDeleted: user.is_deleted || false,
      deletedAt: user.deleted_at ? new Date(user.deleted_at).getTime() : undefined,
    }
  }

  private mapSupabaseCrew(crew: any): Crew {
    return {
      id: crew.id,
      name: crew.name,
      maxMembers: crew.max_members,
      currentMembers: crew.current_members,
      exerciseType: crew.exercise_type,
      exerciseConfig: crew.exercise_config,
      alarm: crew.alarm,
      createdAt: new Date(crew.created_at).getTime(),
      createdBy: crew.created_by,
      memberIds: crew.member_ids || [],
      videoShareEnabled: crew.video_share_enabled,
      audioShareEnabled: crew.audio_share_enabled,
      recommendations: crew.recommendations || 0,
      isDormant: crew.is_dormant || false,
      lastActivityAt: crew.last_activity_at ? new Date(crew.last_activity_at).getTime() : undefined,
      dormantAt: crew.dormant_at ? new Date(crew.dormant_at).getTime() : undefined,
      scheduledDeletionAt: crew.scheduled_deletion_at ? new Date(crew.scheduled_deletion_at).getTime() : undefined,
    }
  }

  private mapSupabaseCrewMember(member: any): CrewMember {
    return {
      id: member.id,
      crewId: member.crew_id,
      userId: member.user_id,
      joinedAt: new Date(member.joined_at).getTime(),
      role: member.role,
      videoEnabled: member.video_enabled,
      audioEnabled: member.audio_enabled,
    }
  }

  private mapSupabaseJoggingCrew(crew: any): JoggingCrew {
    return {
      id: crew.id,
      name: crew.name,
      maxMembers: crew.max_members,
      currentMembers: crew.current_members,
      targetDistance: crew.target_distance || undefined,
      targetTime: crew.target_time || undefined,
      alarm: crew.alarm || undefined,
      videoShareEnabled: crew.video_share_enabled,
      audioShareEnabled: crew.audio_share_enabled,
      createdAt: new Date(crew.created_at).getTime(),
      createdBy: crew.created_by,
      memberIds: crew.member_ids || [],
      recommendations: crew.recommendations || 0,
      isDormant: crew.is_dormant || false,
      lastActivityAt: crew.last_activity_at ? new Date(crew.last_activity_at).getTime() : undefined,
      dormantAt: crew.dormant_at ? new Date(crew.dormant_at).getTime() : undefined,
      scheduledDeletionAt: crew.scheduled_deletion_at ? new Date(crew.scheduled_deletion_at).getTime() : undefined,
    }
  }

  private mapSupabaseExerciseSession(session: any): ExerciseSession {
    try {
      const mapped = {
        id: session.id,
        userId: session.user_id,
        crewId: session.crew_id || undefined,
        mode: session.mode,
        config: session.config,
        startTime: session.start_time ? new Date(session.start_time).getTime() : Date.now(),
        endTime: session.end_time ? new Date(session.end_time).getTime() : undefined,
        counts: session.counts || [],
        bestScore: session.best_score || undefined,
        worstScore: session.worst_score || undefined,
        averageScore: session.average_score || 0,
        completed: session.completed !== undefined ? session.completed : false,
        analysis: session.analysis || undefined,
      }
      
      // 매핑 결과 로깅 (첫 번째 항목만)
      if (!this._mappingLogged) {
        console.log('🔍 데이터 매핑 결과:', {
          original: {
            id: session.id,
            completed: session.completed,
            end_time: session.end_time,
          },
          mapped: {
            id: mapped.id,
            completed: mapped.completed,
            endTime: mapped.endTime,
            hasBestScore: !!mapped.bestScore,
            hasWorstScore: !!mapped.worstScore,
            hasAnalysis: !!mapped.analysis,
          },
        })
        this._mappingLogged = true
      }
      
      return mapped
    } catch (e) {
      console.error('❌ 데이터 매핑 실패:', e, session)
      throw e
    }
  }
  
  private _mappingLogged = false

  // ============ SingleGoal 관련 ============
  async createSingleGoal(goal: Omit<SingleGoal, 'id' | 'createdAt' | 'createdBy' | 'isActive'> & { createdBy: string }): Promise<SingleGoal> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        // UUID 매핑
        let supabaseUserId = goal.createdBy
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(goal.createdBy)) {
          supabaseUserId = await this.getSupabaseUserId(goal.createdBy)
        }
        
        const { data, error } = await supabase
          .from('single_goals')
          .insert({
            user_id: supabaseUserId,
            name: goal.name,
            exercise_type: goal.exerciseType,
            exercise_config: goal.exerciseConfig,
            alarm: goal.alarm || null,
            background_music: goal.backgroundMusic || null,
            is_active: true,
          })
          .select()
          .single()
        
        if (error) {
          console.error('Supabase 싱글 목표 저장 실패:', error)
          throw error
        }
        
        return this.mapSupabaseSingleGoal(data)
      } catch (e) {
        console.error('Supabase 싱글 목표 저장 중 오류:', e)
        // Supabase 실패 시 에러를 다시 throw하여 사용자에게 알림
        throw e
      }
    }
    
    // localStorage 저장
    const goals = this.readTable<SingleGoal>('single_goals')
    const newGoal: SingleGoal = {
      ...goal,
      id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      isActive: true,
    }
    goals.push(newGoal)
    this.writeTable('single_goals', goals)
    return newGoal
  }

  async getSingleGoalsByUserId(
    userId: string, 
    limit?: number, 
    offset?: number
  ): Promise<SingleGoal[] | { data: SingleGoal[]; hasMore: boolean; total?: number }> {
    await this.initialize()
    
    const usePagination = limit !== undefined && offset !== undefined
    const paginationLimit = limit || 1000
    const paginationOffset = offset || 0
    
    if (USE_SUPABASE && supabase) {
      try {
        let supabaseUserId = userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId)) {
          supabaseUserId = await this.getSupabaseUserId(userId)
        }
        
        // 전체 개수 조회 (pagination이 필요한 경우)
        let count = 0
        if (usePagination) {
          const { count: totalCount } = await supabase
          .from('single_goals')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', supabaseUserId)
            .eq('is_active', true)
          count = totalCount || 0
        }
        
        const { data, error } = await supabase
          .from('single_goals')
          .select('*')
          .eq('user_id', supabaseUserId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .range(paginationOffset, paginationOffset + paginationLimit - 1)
        
        if (error) {
          console.error('Supabase 싱글 목표 조회 실패:', error)
          throw error
        }
        
        const goals = (data || []).map((g: any) => this.mapSupabaseSingleGoal(g))
        
        if (usePagination) {
          const hasMore = paginationOffset + paginationLimit < count
          return { data: goals, hasMore, total: count }
        }
        
        return goals
      } catch (e) {
        console.error('Supabase 싱글 목표 조회 중 오류:', e)
        // Supabase 실패 시 localStorage로 폴백
      }
    }
    
    // localStorage 조회
    const goals = this.readTable<SingleGoal>('single_goals')
    const filteredGoals = goals.filter((g) => g.createdBy === userId && g.isActive)
    
    if (usePagination) {
    const totalGoals = filteredGoals.length
      const paginatedGoals = filteredGoals.slice(paginationOffset, paginationOffset + paginationLimit)
      const hasMore = paginationOffset + paginationLimit < totalGoals
    return { data: paginatedGoals, hasMore, total: totalGoals }
    }
    
    return filteredGoals
  }

  async updateSingleGoal(id: string, updates: Partial<SingleGoal>): Promise<SingleGoal | null> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        const updateData: any = {}
        if (updates.name !== undefined) updateData.name = updates.name
        if (updates.exerciseType !== undefined) updateData.exercise_type = updates.exerciseType
        if (updates.exerciseConfig !== undefined) updateData.exercise_config = updates.exerciseConfig
        if (updates.alarm !== undefined) updateData.alarm = updates.alarm || null
        if (updates.backgroundMusic !== undefined) updateData.background_music = updates.backgroundMusic || null
        if (updates.isActive !== undefined) updateData.is_active = updates.isActive
        
        const { data, error } = await supabase
          .from('single_goals')
          .update(updateData)
          .eq('id', id)
          .select()
          .single()
        
        if (error) {
          console.error('Supabase 싱글 목표 수정 실패:', error)
          throw error
        }
        
        return data ? this.mapSupabaseSingleGoal(data) : null
      } catch (e) {
        console.error('Supabase 싱글 목표 수정 중 오류:', e)
        // Supabase 실패 시 localStorage로 폴백
      }
    }
    
    // localStorage 수정
    const goals = this.readTable<SingleGoal>('single_goals')
    const index = goals.findIndex((g) => g.id === id)
    if (index === -1) return null
    goals[index] = { ...goals[index], ...updates }
    this.writeTable('single_goals', goals)
    return goals[index]
  }

  async deleteSingleGoal(id: string): Promise<boolean> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        const { error } = await supabase
          .from('single_goals')
          .delete()
          .eq('id', id)
        
        if (error) {
          console.error('Supabase 싱글 목표 삭제 실패:', error)
          throw error
        }
        return true
      } catch (e) {
        console.error('Supabase 싱글 목표 삭제 중 오류:', e)
        // Supabase 실패 시 에러를 다시 throw하여 사용자에게 알림
        throw e
      }
    }
    
    // localStorage 삭제
    const goals = this.readTable<SingleGoal>('single_goals')
    const filtered = goals.filter((g) => g.id !== id)
    this.writeTable('single_goals', filtered)
    return true
  }

  private mapSupabaseSingleGoal(goal: any): SingleGoal {
    return {
      id: goal.id,
      name: goal.name,
      exerciseType: goal.exercise_type,
      exerciseConfig: goal.exercise_config,
      alarm: goal.alarm || undefined,
      backgroundMusic: goal.background_music || undefined,
      createdAt: new Date(goal.created_at).getTime(),
      createdBy: goal.user_id,
      isActive: goal.is_active !== false,
    }
  }

  // ============ JoggingGoal 관련 ============
  async createJoggingGoal(goal: Omit<JoggingGoal, 'id' | 'createdAt' | 'createdBy' | 'isActive'> & { createdBy: string }): Promise<JoggingGoal> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        let supabaseUserId = goal.createdBy
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(goal.createdBy)) {
          supabaseUserId = await this.getSupabaseUserId(goal.createdBy)
        }
        
        const { data, error } = await supabase
          .from('jogging_goals')
          .insert({
            user_id: supabaseUserId,
            name: goal.name,
            target_distance: goal.targetDistance || null,
            target_time: goal.targetTime || null,
            alarm: goal.alarm || null,
            background_music: goal.backgroundMusic || null,
            shared_course_id: goal.sharedCourseId || null,
            is_active: true,
          })
          .select()
          .single()
        
        if (error) {
          console.error('Supabase 조깅 목표 저장 실패:', error)
          throw error
        }
        
        return this.mapSupabaseJoggingGoal(data)
      } catch (e) {
        console.error('Supabase 조깅 목표 저장 중 오류:', e)
        // Supabase 실패 시 localStorage로 폴백
      }
    }
    
    // localStorage 저장
    const goals = this.readTable<JoggingGoal>('jogging_goals')
    const newGoal: JoggingGoal = {
      ...goal,
      id: `jgoal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      isActive: true,
    }
    goals.push(newGoal)
    this.writeTable('jogging_goals', goals)
    return newGoal
  }

  async getJoggingGoalsByUserId(
    userId: string, 
    limit?: number, 
    offset?: number
  ): Promise<JoggingGoal[] | { data: JoggingGoal[]; hasMore: boolean; total?: number }> {
    await this.initialize()
    
    const usePagination = limit !== undefined && offset !== undefined
    const paginationLimit = limit || 1000
    const paginationOffset = offset || 0
    
    if (USE_SUPABASE && supabase) {
      try {
        let supabaseUserId = userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId)) {
          supabaseUserId = await this.getSupabaseUserId(userId)
        }
        
        // 전체 개수 조회 (pagination이 필요한 경우)
        let count = 0
        if (usePagination) {
          const { count: totalCount } = await supabase
            .from('jogging_goals')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', supabaseUserId)
            .eq('is_active', true)
          count = totalCount || 0
        }
        
        const { data, error } = await supabase
          .from('jogging_goals')
          .select('*')
          .eq('user_id', supabaseUserId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .range(paginationOffset, paginationOffset + paginationLimit - 1)
        
        if (error) {
          console.error('Supabase 조깅 목표 조회 실패:', error)
          throw error
        }
        
        const goals = (data || []).map((g: any) => this.mapSupabaseJoggingGoal(g))
        
        if (usePagination) {
          const hasMore = paginationOffset + paginationLimit < count
          return { data: goals, hasMore, total: count }
        }
        
        return goals
      } catch (e) {
        console.error('Supabase 조깅 목표 조회 중 오류:', e)
        // Supabase 실패 시 localStorage로 폴백
      }
    }
    
    // localStorage 조회
    const goals = this.readTable<JoggingGoal>('jogging_goals')
    const filteredGoals = goals.filter((g) => g.createdBy === userId && g.isActive)
    
    if (usePagination) {
    const totalGoals = filteredGoals.length
      const paginatedGoals = filteredGoals.slice(paginationOffset, paginationOffset + paginationLimit)
      const hasMore = paginationOffset + paginationLimit < totalGoals
    return { data: paginatedGoals, hasMore, total: totalGoals }
    }
    
    return filteredGoals
  }

  async updateJoggingGoal(id: string, updates: Partial<JoggingGoal>): Promise<JoggingGoal | null> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        const updateData: any = {}
        if (updates.name !== undefined) updateData.name = updates.name
        if (updates.targetDistance !== undefined) updateData.target_distance = updates.targetDistance || null
        if (updates.targetTime !== undefined) updateData.target_time = updates.targetTime || null
        if (updates.alarm !== undefined) updateData.alarm = updates.alarm || null
        if (updates.backgroundMusic !== undefined) updateData.background_music = updates.backgroundMusic || null
        if (updates.sharedCourseId !== undefined) updateData.shared_course_id = updates.sharedCourseId || null
        if (updates.isActive !== undefined) updateData.is_active = updates.isActive
        
        const { data, error } = await supabase
          .from('jogging_goals')
          .update(updateData)
          .eq('id', id)
          .select()
          .single()
        
        if (error) {
          console.error('Supabase 조깅 목표 수정 실패:', error)
          throw error
        }
        
        return data ? this.mapSupabaseJoggingGoal(data) : null
      } catch (e) {
        console.error('Supabase 조깅 목표 수정 중 오류:', e)
        // Supabase 실패 시 localStorage로 폴백
      }
    }
    
    // localStorage 수정
    const goals = this.readTable<JoggingGoal>('jogging_goals')
    const index = goals.findIndex((g) => g.id === id)
    if (index === -1) return null
    goals[index] = { ...goals[index], ...updates }
    this.writeTable('jogging_goals', goals)
    return goals[index]
  }

  async deleteJoggingGoal(id: string): Promise<boolean> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        const { error } = await supabase
          .from('jogging_goals')
          .delete()
          .eq('id', id)
        
        if (error) {
          console.error('Supabase 조깅 목표 삭제 실패:', error)
          throw error
        }
        return true
      } catch (e) {
        console.error('Supabase 조깅 목표 삭제 중 오류:', e)
        // Supabase 실패 시 에러를 다시 throw하여 사용자에게 알림
        throw e
      }
    }
    
    // localStorage 삭제
    const goals = this.readTable<JoggingGoal>('jogging_goals')
    const filtered = goals.filter((g) => g.id !== id)
    this.writeTable('jogging_goals', filtered)
    return true
  }

  private mapSupabaseJoggingGoal(goal: any): JoggingGoal {
    return {
      id: goal.id,
      name: goal.name,
      targetDistance: goal.target_distance || undefined,
      targetTime: goal.target_time || undefined,
      alarm: goal.alarm || undefined,
      backgroundMusic: goal.background_music || undefined,
      sharedCourseId: goal.shared_course_id || undefined,
      createdAt: new Date(goal.created_at).getTime(),
      createdBy: goal.user_id,
      isActive: goal.is_active !== false,
    }
  }

  // localStorage 사용자 ID를 Supabase UUID로 변환하는 헬퍼 함수
  private async getSupabaseUserId(localStorageUserId: string): Promise<string> {
    if (!USE_SUPABASE || !supabase) {
      return localStorageUserId
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(localStorageUserId)) {
      // 이미 UUID 형식이면 그대로 반환
      return localStorageUserId
    }

    // 캐시 확인
    if (this.userIdMappingCache.has(localStorageUserId)) {
      return this.userIdMappingCache.get(localStorageUserId)!
    }

    // localStorage에서 사용자 정보 가져오기
    const userStr = localStorage.getItem(`user_${localStorageUserId}`)
    if (!userStr) {
      throw new Error('사용자 정보를 찾을 수 없습니다.')
    }

    const user = JSON.parse(userStr)
    if (!user.email) {
      throw new Error('사용자 이메일 정보가 없습니다.')
    }

    // Supabase에서 email로 사용자 찾기
    const { data: supabaseUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single()

    if (userError || !supabaseUser) {
      throw new Error('Supabase에 사용자가 등록되어 있지 않습니다. 먼저 로그인해주세요.')
    }

    // 캐시에 저장
    this.userIdMappingCache.set(localStorageUserId, supabaseUser.id)
    return supabaseUser.id
  }

  // 운동 영상 관련 함수들
  async createExerciseVideo(video: Omit<ExerciseVideo, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExerciseVideo> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        const { data, error } = await supabase
          .from('exercise_videos')
          .insert({
            title: video.title,
            description: video.description || null,
            // video_url은 저장하지 않음 (영상 파일은 저장하지 않고 포즈 데이터만 저장)
            created_by: video.createdBy,
            is_active: video.isActive !== false,
            pose_data: video.poseData,
            total_poses: video.totalPoses || video.poseData.length,
            duration_seconds: video.durationSeconds || 0,
          })
          .select()
          .single()
        
        if (error) {
          console.error('Supabase 운동 영상 생성 실패:', error)
          throw error
        }
        
        return this.mapSupabaseExerciseVideo(data)
      } catch (e) {
        console.error('Supabase 운동 영상 생성 중 오류:', e)
        throw e
      }
    }
    
    // localStorage (개발용)
    const videos = this.readTable<ExerciseVideo>('exercise_videos')
    const newVideo: ExerciseVideo = {
      ...video,
      id: `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    videos.push(newVideo)
    this.writeTable('exercise_videos', videos)
    return newVideo
  }

  async getExerciseVideos(limit: number = 50, offset: number = 0): Promise<{ data: ExerciseVideo[]; hasMore: boolean }> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        const { data, error } = await supabase
          .from('exercise_videos')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)
        
        if (error) {
          console.error('Supabase 운동 영상 조회 실패:', error)
          throw error
        }
        
        const videos = (data || []).map(v => this.mapSupabaseExerciseVideo(v))
        const hasMore = videos.length === limit
        
        return { data: videos, hasMore }
      } catch (e) {
        console.error('Supabase 운동 영상 조회 중 오류:', e)
        throw e
      }
    }
    
    // localStorage (개발용)
    const videos = this.readTable<ExerciseVideo>('exercise_videos')
    const sorted = videos.sort((a, b) => b.createdAt - a.createdAt)
    const paginated = sorted.slice(offset, offset + limit)
    return {
      data: paginated,
      hasMore: offset + limit < sorted.length,
    }
  }

  async getExerciseVideoById(id: string): Promise<ExerciseVideo | null> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        const { data, error } = await supabase
          .from('exercise_videos')
          .select('*')
          .eq('id', id)
          .single()
        
        if (error) {
          if (error.code === 'PGRST116') {
            return null
          }
          console.error('Supabase 운동 영상 조회 실패:', error)
          throw error
        }
        
        return data ? this.mapSupabaseExerciseVideo(data) : null
      } catch (e) {
        console.error('Supabase 운동 영상 조회 중 오류:', e)
        throw e
      }
    }
    
    // localStorage (개발용)
    const videos = this.readTable<ExerciseVideo>('exercise_videos')
    return videos.find(v => v.id === id) || null
  }

  async updateExerciseVideo(id: string, updates: Partial<ExerciseVideo>): Promise<ExerciseVideo | null> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        const updateData: any = {}
        if (updates.title !== undefined) updateData.title = updates.title
        if (updates.description !== undefined) updateData.description = updates.description
        // videoUrl은 업데이트하지 않음 (영상 파일은 저장하지 않음)
        if (updates.isActive !== undefined) updateData.is_active = updates.isActive
        if (updates.poseData !== undefined) updateData.pose_data = updates.poseData
        if (updates.totalPoses !== undefined) updateData.total_poses = updates.totalPoses
        if (updates.durationSeconds !== undefined) updateData.duration_seconds = updates.durationSeconds
        
        const { data, error } = await supabase
          .from('exercise_videos')
          .update(updateData)
          .eq('id', id)
          .select()
          .single()
        
        if (error) {
          console.error('Supabase 운동 영상 수정 실패:', error)
          throw error
        }
        
        return data ? this.mapSupabaseExerciseVideo(data) : null
      } catch (e) {
        console.error('Supabase 운동 영상 수정 중 오류:', e)
        throw e
      }
    }
    
    // localStorage (개발용)
    const videos = this.readTable<ExerciseVideo>('exercise_videos')
    const index = videos.findIndex(v => v.id === id)
    if (index === -1) return null
    
    videos[index] = {
      ...videos[index],
      ...updates,
      updatedAt: Date.now(),
    }
    this.writeTable('exercise_videos', videos)
    return videos[index]
  }

  async deleteExerciseVideo(id: string): Promise<boolean> {
    await this.initialize()
    
    if (USE_SUPABASE && supabase) {
      try {
        const { error } = await supabase
          .from('exercise_videos')
          .delete()
          .eq('id', id)
        
        if (error) {
          console.error('Supabase 운동 영상 삭제 실패:', error)
          throw error
        }
        return true
      } catch (e) {
        console.error('Supabase 운동 영상 삭제 중 오류:', e)
        throw e
      }
    }
    
    // localStorage (개발용)
    const videos = this.readTable<ExerciseVideo>('exercise_videos')
    const filtered = videos.filter(v => v.id !== id)
    this.writeTable('exercise_videos', filtered)
    return true
  }

  private mapSupabaseExerciseVideo(video: any): ExerciseVideo {
    return {
      id: video.id,
      title: video.title,
      description: video.description || undefined,
      videoUrl: video.video_url || undefined,
      createdBy: video.created_by,
      createdAt: new Date(video.created_at).getTime(),
      updatedAt: new Date(video.updated_at).getTime(),
      isActive: video.is_active !== false,
      poseData: video.pose_data || [],
      totalPoses: video.total_poses || 0,
      durationSeconds: video.duration_seconds || 0,
    }
  }
}

export const databaseService = new DatabaseService()

