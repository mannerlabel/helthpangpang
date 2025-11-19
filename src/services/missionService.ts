import { Mission, MissionParticipant, ExerciseType } from '@/types'

class MissionService {
  private missions: Map<string, Mission> = new Map()
  private participants: Map<string, MissionParticipant> = new Map()
  private currentMissionId: string | null = null

  createMission(
    name: string,
    exerciseType: ExerciseType,
    targetCount: number,
    duration: number,
    participantIds: string[]
  ): Mission {
    const mission: Mission = {
      id: `mission_${Date.now()}`,
      name,
      exerciseType,
      targetCount,
      duration,
      participants: participantIds,
    }

    this.missions.set(mission.id, mission)
    return mission
  }

  startMission(missionId: string): void {
    const mission = this.missions.get(missionId)
    if (!mission) {
      throw new Error('미션을 찾을 수 없습니다.')
    }

    mission.startTime = Date.now()
    mission.endTime = mission.startTime + mission.duration * 1000
    this.currentMissionId = missionId
  }

  getMission(missionId: string): Mission | undefined {
    return this.missions.get(missionId)
  }

  getCurrentMission(): Mission | null {
    if (!this.currentMissionId) return null
    return this.missions.get(this.currentMissionId) || null
  }

  updateParticipantCount(participantId: string, count: number, poseScore: number): void {
    const participant = this.participants.get(participantId)
    if (participant) {
      participant.currentCount = count
      participant.poseScore = poseScore
    }
  }

  addParticipant(id: string, name: string): MissionParticipant {
    const participant: MissionParticipant = {
      id,
      name,
      currentCount: 0,
      poseScore: 0,
    }
    this.participants.set(id, participant)
    return participant
  }

  getParticipant(id: string): MissionParticipant | undefined {
    return this.participants.get(id)
  }

  getAllParticipants(): MissionParticipant[] {
    return Array.from(this.participants.values())
  }

  checkMissionComplete(missionId: string): boolean {
    const mission = this.missions.get(missionId)
    if (!mission) return false

    const allParticipants = mission.participants.map((id) => this.participants.get(id))
    const totalCount = allParticipants.reduce((sum, p) => sum + (p?.currentCount || 0), 0)

    return totalCount >= mission.targetCount
  }

  endMission(missionId: string): void {
    if (this.currentMissionId === missionId) {
      this.currentMissionId = null
    }
  }
}

export const missionService = new MissionService()

