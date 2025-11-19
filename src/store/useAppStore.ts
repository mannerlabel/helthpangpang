import { create } from 'zustand'
import { ExerciseType, Mission, MissionParticipant } from '@/types'

interface AppState {
  // 현재 운동 타입
  currentExerciseType: ExerciseType
  setExerciseType: (type: ExerciseType) => void

  // 현재 카운트
  currentCount: number
  setCount: (count: number) => void

  // 자세 점수
  poseScore: number
  setPoseScore: (score: number) => void

  // 미션 관련
  currentMission: Mission | null
  setCurrentMission: (mission: Mission | null) => void
  participants: MissionParticipant[]
  setParticipants: (participants: MissionParticipant[]) => void

  // 오디오 설정
  audioEnabled: boolean
  setAudioEnabled: (enabled: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentExerciseType: 'pushup',
  setExerciseType: (type) => set({ currentExerciseType: type }),

  currentCount: 0,
  setCount: (count) => set({ currentCount: count }),

  poseScore: 0,
  setPoseScore: (score) => set({ poseScore: score }),

  currentMission: null,
  setCurrentMission: (mission) => set({ currentMission: mission }),
  participants: [],
  setParticipants: (participants) => set({ participants }),

  audioEnabled: true,
  setAudioEnabled: (enabled) => set({ audioEnabled: enabled }),
}))

