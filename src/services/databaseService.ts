/**
 * JSON 파일 기반 임시 데이터베이스 서비스
 * 차후 Supabase로 전환 시 인터페이스만 변경하면 됨
 */

// 데이터베이스 파일 경로 (public 폴더에 저장)
const DB_PATH = '/data'

// 데이터베이스 테이블 타입 정의
export interface User {
  id: string
  email: string
  password: string // 실제로는 해시된 비밀번호
  name: string
  avatar?: string
  createdAt: number
  lastLoginAt?: number
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

class DatabaseService {
  private initialized = false

  // 데이터베이스 초기화
  async initialize(): Promise<void> {
    if (this.initialized) {
      // 이미 초기화되었어도 테스트 사용자는 확인
      await this.ensureTestUsers()
      return
    }

    // localStorage에 데이터베이스가 없으면 초기화
    if (!localStorage.getItem('db_initialized')) {
      this.initDatabase()
      localStorage.setItem('db_initialized', 'true')
    }

    // 테스트 사용자 확인 및 생성
    await this.ensureTestUsers()

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
    // initialize()는 외부에서 호출되므로 여기서는 호출하지 않음 (순환 호출 방지)
    if (!this.initialized) {
      await this.initialize()
    }
    const users = this.readTable<User>('users')
    const newUser: User = {
      ...user,
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
    }
    users.push(newUser)
    this.writeTable('users', users)
    return newUser
  }

  async getUserById(id: string): Promise<User | null> {
    await this.initialize()
    const users = this.readTable<User>('users')
    return users.find((u) => u.id === id) || null
  }

  async getUserByEmail(email: string): Promise<User | null> {
    await this.initialize()
    const users = this.readTable<User>('users')
    return users.find((u) => u.email === email) || null
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    await this.initialize()
    const users = this.readTable<User>('users')
    const index = users.findIndex((u) => u.id === id)
    if (index === -1) return null
    users[index] = { ...users[index], ...updates }
    this.writeTable('users', users)
    return users[index]
  }

  // ============ Crew 관련 ============
  async createCrew(crew: Omit<Crew, 'id' | 'createdAt' | 'currentMembers' | 'memberIds' | 'recommendations'>): Promise<Crew> {
    await this.initialize()
    const crews = this.readTable<Crew>('crews')
    const newCrew: Crew = {
      ...crew,
      id: `crew_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      currentMembers: 1,
      memberIds: [crew.createdBy],
      recommendations: 0,
    }
    crews.push(newCrew)
    this.writeTable('crews', crews)

    // 크루 멤버 추가
    await this.addCrewMember(newCrew.id, crew.createdBy, 'owner')

    return newCrew
  }

  async getCrewById(id: string): Promise<Crew | null> {
    await this.initialize()
    const crews = this.readTable<Crew>('crews')
    return crews.find((c) => c.id === id) || null
  }

  async getCrewsByUserId(userId: string): Promise<Crew[]> {
    await this.initialize()
    const crews = this.readTable<Crew>('crews')
    return crews.filter((c) => c.memberIds.includes(userId))
  }

  async getAllCrews(): Promise<Crew[]> {
    await this.initialize()
    return this.readTable<Crew>('crews')
  }

  async updateCrew(id: string, updates: Partial<Crew>): Promise<Crew | null> {
    await this.initialize()
    const crews = this.readTable<Crew>('crews')
    const index = crews.findIndex((c) => c.id === id)
    if (index === -1) return null
    crews[index] = { ...crews[index], ...updates }
    this.writeTable('crews', crews)
    return crews[index]
  }

  async deleteCrew(id: string): Promise<boolean> {
    await this.initialize()
    const crews = this.readTable<Crew>('crews')
    const filtered = crews.filter((c) => c.id !== id)
    this.writeTable('crews', filtered)
    return filtered.length < crews.length
  }

  async incrementCrewRecommendations(crewId: string): Promise<number> {
    await this.initialize()
    const crew = await this.getCrewById(crewId)
    if (!crew) return 0
    const updated = await this.updateCrew(crewId, { recommendations: crew.recommendations + 1 })
    return updated?.recommendations || 0
  }

  // ============ CrewMember 관련 ============
  async addCrewMember(crewId: string, userId: string, role: 'owner' | 'member' = 'member'): Promise<CrewMember> {
    await this.initialize()
    const members = this.readTable<CrewMember>('crew_members')
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

    // 크루의 멤버 수 업데이트
    const crew = await this.getCrewById(crewId)
    if (crew) {
      await this.updateCrew(crewId, {
        currentMembers: crew.currentMembers + 1,
        memberIds: [...crew.memberIds, userId],
      })
    }

    return newMember
  }

  async removeCrewMember(crewId: string, userId: string): Promise<boolean> {
    await this.initialize()
    const members = this.readTable<CrewMember>('crew_members')
    const filtered = members.filter((m) => !(m.crewId === crewId && m.userId === userId))
    this.writeTable('crew_members', filtered)

    // 크루의 멤버 수 업데이트
    const crew = await this.getCrewById(crewId)
    if (crew) {
      const updatedMemberIds = crew.memberIds.filter((id) => id !== userId)
      await this.updateCrew(crewId, {
        currentMembers: crew.currentMembers - 1,
        memberIds: updatedMemberIds,
      })
    }

    return filtered.length < members.length
  }

  async getCrewMembers(crewId: string): Promise<CrewMember[]> {
    await this.initialize()
    const members = this.readTable<CrewMember>('crew_members')
    return members.filter((m) => m.crewId === crewId)
  }

  async updateCrewMember(crewId: string, userId: string, updates: Partial<CrewMember>): Promise<CrewMember | null> {
    await this.initialize()
    const members = this.readTable<CrewMember>('crew_members')
    const index = members.findIndex((m) => m.crewId === crewId && m.userId === userId)
    if (index === -1) return null
    members[index] = { ...members[index], ...updates }
    this.writeTable('crew_members', members)
    return members[index]
  }

  // ============ JoggingCrew 관련 ============
  async createJoggingCrew(crew: Omit<JoggingCrew, 'id' | 'createdAt' | 'currentMembers' | 'memberIds'>): Promise<JoggingCrew> {
    await this.initialize()
    const crews = this.readTable<JoggingCrew>('jogging_crews')
    const newCrew: JoggingCrew = {
      ...crew,
      id: `jcrew_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      currentMembers: 1,
      memberIds: [crew.createdBy],
    }
    crews.push(newCrew)
    this.writeTable('jogging_crews', crews)
    return newCrew
  }

  async getJoggingCrewById(id: string): Promise<JoggingCrew | null> {
    await this.initialize()
    const crews = this.readTable<JoggingCrew>('jogging_crews')
    return crews.find((c) => c.id === id) || null
  }

  async getJoggingCrewsByUserId(userId: string): Promise<JoggingCrew[]> {
    await this.initialize()
    const crews = this.readTable<JoggingCrew>('jogging_crews')
    return crews.filter((c) => c.memberIds.includes(userId))
  }

  async getAllJoggingCrews(): Promise<JoggingCrew[]> {
    await this.initialize()
    return this.readTable<JoggingCrew>('jogging_crews')
  }

  async updateJoggingCrew(id: string, updates: Partial<JoggingCrew>): Promise<JoggingCrew | null> {
    await this.initialize()
    const crews = this.readTable<JoggingCrew>('jogging_crews')
    const index = crews.findIndex((c) => c.id === id)
    if (index === -1) return null
    crews[index] = { ...crews[index], ...updates }
    this.writeTable('jogging_crews', crews)
    return crews[index]
  }

  async joinJoggingCrew(crewId: string, userId: string): Promise<boolean> {
    await this.initialize()
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
    const crew = await this.getJoggingCrewById(crewId)
    if (!crew) return false

    await this.updateJoggingCrew(crewId, {
      currentMembers: crew.currentMembers - 1,
      memberIds: crew.memberIds.filter((id) => id !== userId),
    })
    return true
  }

  // ============ Chat 관련 ============
  async addChatMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    await this.initialize()
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

  async getChatMessages(crewId: string, limit?: number): Promise<ChatMessage[]> {
    await this.initialize()
    const messages = this.readTable<ChatMessage>('chats')
    const filtered = messages.filter((m) => m.crewId === crewId).sort((a, b) => a.timestamp - b.timestamp)
    return limit ? filtered.slice(-limit) : filtered
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

  // ============ ExerciseSession 관련 ============
  async createExerciseSession(session: Omit<ExerciseSession, 'id'>): Promise<ExerciseSession> {
    await this.initialize()
    const sessions = this.readTable<ExerciseSession>('exercise_sessions')
    const newSession: ExerciseSession = {
      ...session,
      id: `esession_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }
    sessions.push(newSession)
    this.writeTable('exercise_sessions', sessions)
    return newSession
  }

  async getExerciseSessionById(id: string): Promise<ExerciseSession | null> {
    await this.initialize()
    const sessions = this.readTable<ExerciseSession>('exercise_sessions')
    return sessions.find((s) => s.id === id) || null
  }

  async updateExerciseSession(id: string, updates: Partial<ExerciseSession>): Promise<ExerciseSession | null> {
    await this.initialize()
    const sessions = this.readTable<ExerciseSession>('exercise_sessions')
    const index = sessions.findIndex((s) => s.id === id)
    if (index === -1) return null
    sessions[index] = { ...sessions[index], ...updates }
    this.writeTable('exercise_sessions', sessions)
    return sessions[index]
  }
}

export const databaseService = new DatabaseService()

