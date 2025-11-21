import { ExerciseType, ExerciseCount, Pose, PoseScore } from '@/types'
import { ExerciseStrategy } from '@/strategies/ExerciseStrategy'
import { ExerciseStrategyFactory } from '@/strategies/ExerciseStrategyFactory'
import { EXERCISE_TYPES } from '@/constants/exerciseTypes'
import { analyzePose } from '@/utils/poseAnalyzer'

class CountService {
  private counts: ExerciseCount[] = []
  private currentCount = 0
  private lastPoseState: 'up' | 'down' | 'neutral' = 'neutral'
  private exerciseType: ExerciseType = EXERCISE_TYPES.PUSHUP
  private strategy: ExerciseStrategy | null = null
  private lastFeedback: string = '' // 실시간 피드백 저장

  setExerciseType(type: ExerciseType): void {
    this.exerciseType = type
    this.strategy = ExerciseStrategyFactory.getStrategy(type)
    this.reset()
  }

  reset(): void {
    this.counts = []
    this.currentCount = 0
    this.lastPoseState = 'neutral'
    if (this.strategy) {
      this.strategy.reset()
    }
    this.lastFeedback = ''
  }

  getLastFeedback(): string {
    return this.lastFeedback
  }

  getCurrentCount(): number {
    return this.currentCount
  }

  getCounts(): ExerciseCount[] {
    return [...this.counts]
  }

  // 자세 분석 및 카운트
  analyzePose(pose: Pose, videoHeight?: number): { count: number; poseScore: PoseScore; shouldIncrement: boolean; feedback?: string; angle?: number; depth?: number; state?: string } {
    const poseScore = this.calculatePoseScore(pose)
    this.lastFeedback = '' // 피드백 초기화
    
    // 전략이 없으면 초기화
    if (!this.strategy) {
      this.strategy = ExerciseStrategyFactory.getStrategy(this.exerciseType)
    }
    
    // 전략 패턴을 사용하여 분석
    const result = this.strategy.analyze(pose, this.currentCount, videoHeight)
    
    // 디버깅: 분석 결과 로그 (주기적으로, 스쿼트만)
    if (this.exerciseType === EXERCISE_TYPES.SQUAT && Math.random() < 0.01) {
      console.log('🔍 운동 분석:', {
        운동타입: this.exerciseType,
        isComplete: result.isComplete,
        count: result.count,
        currentCount: this.currentCount,
        depth: result.depth,
        angle: result.angle,
        state: result.state,
      })
    }
    
    if (result.isComplete) {
      // 새 카운트가 현재 카운트 + 1인지 확인 (중복 방지)
      if (result.count === this.currentCount + 1) {
        this.currentCount = result.count
        this.counts.push({
          count: this.currentCount,
          timestamp: Date.now(),
          poseScore: poseScore.overall,
          setNumber: 1, // TODO: 실제 세트 번호 계산 필요
        })
        
        // 운동 타입별 로그
        const exerciseName = this.exerciseType === EXERCISE_TYPES.SQUAT ? '스쿼트' :
                           this.exerciseType === EXERCISE_TYPES.PUSHUP ? '푸시업' : '런지'
        console.log(`✅ ${exerciseName} 카운트 ${this.currentCount} 완료!`, {
          깊이: result.depth ? `${(result.depth / 10).toFixed(1)}%` : undefined,
          각도: result.angle ? `${result.angle}도` : undefined,
          상태: result.state,
        })
        
        // 피드백 생성
        this.lastFeedback = this.strategy.generateFeedback(result)
        
        return {
          count: this.currentCount,
          poseScore,
          shouldIncrement: true,
          feedback: this.lastFeedback,
          angle: result.angle, // 관절 각도
          depth: result.depth, // 운동 깊이
          state: result.state, // 운동 상태
        }
      } else {
        // 카운트가 예상과 다르면 무시
        console.warn(`카운트 불일치: 현재 ${this.currentCount}, 새 카운트 ${result.count}`)
      }
    }
    
    // 피드백 생성 (카운트가 안 될 때)
    this.lastFeedback = this.strategy.generateFeedback(result)
    
    return {
      count: this.currentCount,
      poseScore,
      shouldIncrement: false,
      feedback: this.lastFeedback,
      angle: result.angle, // 관절 각도
      depth: result.depth, // 운동 깊이
      state: result.state, // 운동 상태
    }
  }

  private calculatePoseScore(pose: Pose): PoseScore {
    // poseAnalyzer의 정교한 점수 계산 로직 사용
    // 이렇게 하면 운동 타입별로 정확한 점수 계산이 가능하고, 100점까지 받을 수 있습니다
    return analyzePose(pose, this.exerciseType)
  }

  private checkRepetition(pose: Pose): boolean {
    // 운동 타입에 따른 반복 체크 로직
    // 실제로는 각 운동별로 다른 로직이 필요함
    const currentState = this.detectPoseState(pose)

    let shouldIncrement = false

    if (this.exerciseType === 'pushup') {
      // 푸시업: 아래 -> 위 -> 아래 순환
      if (this.lastPoseState === 'down' && currentState === 'up') {
        shouldIncrement = true
      }
    } else if (this.exerciseType === 'squat') {
      // 스쿼트: 위 -> 아래 -> 위 순환
      if (this.lastPoseState === 'down' && currentState === 'up') {
        shouldIncrement = true
      }
    } else if (this.exerciseType === 'lunge') {
      // 런지: 위 -> 아래 -> 위 순환
      if (this.lastPoseState === 'down' && currentState === 'up') {
        shouldIncrement = true
      }
    }

    this.lastPoseState = currentState
    return shouldIncrement
  }

  private detectPoseState(pose: Pose): 'up' | 'down' | 'neutral' {
    const keypoints = pose.keypoints

    if (this.exerciseType === 'squat') {
      // 스쿼트: 엉덩이와 무릎의 상대적 위치로 판단
      const leftHip = keypoints.find((kp) => kp.name === 'left_hip')
      const rightHip = keypoints.find((kp) => kp.name === 'right_hip')
      const leftKnee = keypoints.find((kp) => kp.name === 'left_knee')
      const rightKnee = keypoints.find((kp) => kp.name === 'right_knee')

      if (leftHip && leftKnee && rightHip && rightKnee) {
        // 엉덩이와 무릎의 평균 Y 좌표
        const avgHipY = (leftHip.y + rightHip.y) / 2
        const avgKneeY = (leftKnee.y + rightKnee.y) / 2
        
        // 엉덩이가 무릎보다 많이 아래에 있으면 'down' (앉은 상태)
        // 엉덩이와 무릎의 거리가 가까우면 'down'
        const hipKneeDistance = Math.abs(avgHipY - avgKneeY)
        
        if (hipKneeDistance < 80) {
          return 'down' // 앉은 상태
        } else if (hipKneeDistance > 120) {
          return 'up' // 서 있는 상태
        }
      }
    } else if (this.exerciseType === 'pushup') {
      // 푸시업: 어깨와 손목의 상대적 위치로 판단
      const shoulder = keypoints.find((kp) => kp.name === 'left_shoulder' || kp.name === 'right_shoulder')
      const wrist = keypoints.find((kp) => kp.name === 'left_wrist' || kp.name === 'right_wrist')

      if (shoulder && wrist) {
        if (wrist.y > shoulder.y + 50) return 'down'
        if (wrist.y < shoulder.y - 50) return 'up'
      }
    } else if (this.exerciseType === 'lunge') {
      // 런지: 엉덩이와 무릎의 위치로 판단
      const leftHip = keypoints.find((kp) => kp.name === 'left_hip')
      const rightHip = keypoints.find((kp) => kp.name === 'right_hip')
      const leftKnee = keypoints.find((kp) => kp.name === 'left_knee')
      const rightKnee = keypoints.find((kp) => kp.name === 'right_knee')

      if (leftHip && leftKnee && rightHip && rightKnee) {
        const avgHipY = (leftHip.y + rightHip.y) / 2
        const avgKneeY = (leftKnee.y + rightKnee.y) / 2
        const hipKneeDistance = Math.abs(avgHipY - avgKneeY)
        
        if (hipKneeDistance < 70) {
          return 'down'
        } else if (hipKneeDistance > 100) {
          return 'up'
        }
      }
    }

    return 'neutral'
  }
}

export const countService = new CountService()

