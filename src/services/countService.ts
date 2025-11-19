import { ExerciseType, ExerciseCount, Pose, PoseScore } from '@/types'
import { SquatCounter } from '@/utils/squatCounter'
import { PushupCounter } from '@/utils/pushupCounter'
import { LungeCounter } from '@/utils/lungeCounter'

class CountService {
  private counts: ExerciseCount[] = []
  private currentCount = 0
  private lastPoseState: 'up' | 'down' | 'neutral' = 'neutral'
  private exerciseType: ExerciseType = 'pushup'
  private squatCounter: SquatCounter = new SquatCounter()
  private pushupCounter: PushupCounter = new PushupCounter()
  private lungeCounter: LungeCounter = new LungeCounter()
  private lastFeedback: string = '' // 실시간 피드백 저장

  setExerciseType(type: ExerciseType): void {
    this.exerciseType = type
    this.reset()
  }

  reset(): void {
    this.counts = []
    this.currentCount = 0
    this.lastPoseState = 'neutral'
    this.squatCounter.reset()
    this.pushupCounter.reset()
    this.lungeCounter.reset()
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
  analyzePose(pose: Pose, videoHeight?: number): { count: number; poseScore: PoseScore; shouldIncrement: boolean; feedback?: string } {
    const poseScore = this.calculatePoseScore(pose)
    this.lastFeedback = '' // 피드백 초기화
    
    // 스쿼트의 경우 SquatCounter 사용
    if (this.exerciseType === 'squat') {
      // currentCount를 전달하여 정확한 카운트 계산
      const squatResult = this.squatCounter.analyzeSquat(pose, this.currentCount)
      
      // 디버깅: 스쿼트 분석 결과 로그 (주기적으로)
      if (Math.random() < 0.01) { // 1% 확률로 로그 출력
        console.log('🔍 SquatCounter 분석:', {
          isComplete: squatResult.isComplete,
          count: squatResult.count,
          currentCount: this.currentCount,
          depth: squatResult.depth,
          angle: squatResult.angle,
          state: squatResult.state,
        })
      }
      
      if (squatResult.isComplete) {
        // 새 카운트가 현재 카운트 + 1인지 확인 (중복 방지)
        if (squatResult.count === this.currentCount + 1) {
          this.currentCount = squatResult.count
          this.counts.push({
            count: this.currentCount,
            timestamp: Date.now(),
            poseScore: poseScore.overall,
          })
          
          console.log(`✅ 스쿼트 카운트 ${this.currentCount} 완료!`, {
            깊이: `${(squatResult.depth / 10).toFixed(1)}%`,
            무릎각도: `${squatResult.angle}도`,
            상태: squatResult.state,
          })
          
          // 피드백 생성
          let feedback = ''
          if (squatResult.angle > this.squatCounter['minKneeAngle']) {
            feedback = '무릎 각도 부족'
          } else if (squatResult.depth < 50) {
            feedback = '스쿼트 깊이 부족'
          } else {
            feedback = '정상 자세'
          }
          this.lastFeedback = feedback
          
          return {
            count: this.currentCount,
            poseScore,
            shouldIncrement: true,
            feedback,
          }
        } else {
          // 카운트가 예상과 다르면 무시
          console.warn(`스쿼트 카운트 불일치: 현재 ${this.currentCount}, 새 카운트 ${squatResult.count}`)
        }
      }
      
      // 피드백 생성 (카운트가 안 될 때)
      if (!squatResult.isComplete) {
        let feedback = ''
        const minKneeAngle = this.squatCounter['minKneeAngle']
        const state = this.squatCounter['state']
        
        // 상태에 따라 적절한 피드백 제공
        if (state === 'standing') {
          // standing 상태: 스쿼트를 시작해야 함
          // 무릎 각도가 너무 크면(다리가 펴져 있으면) 구부리라고 안내
          // 하지만 너무 자주 메시지가 나오지 않도록 조건 완화
          // 기준점이 설정되지 않았거나 깊이가 충분히 깊으면 피드백 없음
          if (this.squatCounter['standingHipY'] === null) {
            // 기준점이 아직 설정되지 않았으면 피드백 없음
            feedback = ''
          } else if (squatResult.angle > minKneeAngle + 20) {
            // 무릎 각도가 임계값보다 20도 이상 크면만 메시지 표시 (더 엄격하게)
            feedback = '무릎을 더 구부려주세요'
          } else if (squatResult.depth < 20 && squatResult.angle > minKneeAngle) {
            // 깊이가 20% 미만이고 각도도 부족할 때만 메시지 표시
            feedback = '조금 더 내려가주세요'
          } else {
            // 조건을 만족하면 피드백 없음 (메시지가 계속 나오지 않도록)
            feedback = ''
          }
        } else if (state === 'down') {
          // down 상태: 일어나야 함
          feedback = '일어나주세요'
        } else {
          feedback = ''
        }
        this.lastFeedback = feedback
      }
      
      return {
        count: this.currentCount,
        poseScore,
        shouldIncrement: false,
        feedback: this.lastFeedback,
      }
    }
    
    // 푸시업의 경우 PushupCounter 사용
    if (this.exerciseType === 'pushup') {
      // currentCount를 전달하여 정확한 카운트 계산
      // videoHeight는 매개변수로 전달받거나 기본값 사용
      // MoveNet 좌표는 정규화된 값이지만, 실제로는 픽셀일 수도 있으므로 동적 판단
      const height = videoHeight || 720 // 기본값 720px
      const pushupResult = this.pushupCounter.analyzePushup(pose, this.currentCount, height)
      
      if (pushupResult.isComplete) {
        // 새 카운트가 현재 카운트 + 1인지 확인 (중복 방지)
        if (pushupResult.count === this.currentCount + 1) {
          this.currentCount = pushupResult.count
          this.counts.push({
            count: this.currentCount,
            timestamp: Date.now(),
            poseScore: poseScore.overall,
          })
          
          console.log(`✅ 푸시업 카운트 ${this.currentCount} 완료!`, {
            깊이: `${(pushupResult.depth / 10).toFixed(1)}%`,
            상태: pushupResult.state,
          })
          
          // 피드백 생성
          this.lastFeedback = '푸시업 완료!'
          
          return {
            count: this.currentCount,
            poseScore,
            shouldIncrement: true,
            feedback: this.lastFeedback,
          }
        } else {
          // 카운트가 예상과 다르면 무시
          console.warn(`푸시업 카운트 불일치: 현재 ${this.currentCount}, 새 카운트 ${pushupResult.count}`)
        }
      }
      
      // 피드백 생성 (카운트가 안 될 때)
      if (!pushupResult.isComplete) {
        // 푸시업 카운터에서 상태 정보 가져오기
        const state = this.pushupCounter['state']
        const upAngle = this.pushupCounter['upAngleThreshold']
        const downAngle = this.pushupCounter['downAngleThreshold']
        const currentAngle = this.pushupCounter['elbowAngleHistory']?.slice(-1)[0] || 0
        
        if (state === 'up') {
          // up 상태면 팔을 구부려야 함
          this.lastFeedback = '팔을 더 구부려주세요'
        } else if (state === 'down') {
          // down 상태면 팔을 펴야 함
          this.lastFeedback = '팔을 더 펴주세요'
        } else {
          this.lastFeedback = '정상 자세'
        }
      }
      
      return {
        count: this.currentCount,
        poseScore,
        shouldIncrement: false,
        feedback: this.lastFeedback,
      }
    }
    
    // 런지의 경우 LungeCounter 사용
    if (this.exerciseType === 'lunge') {
      const lungeResult = this.lungeCounter.analyzeLunge(pose, this.currentCount)
      
      if (lungeResult.isComplete) {
        if (lungeResult.count === this.currentCount + 1) {
          this.currentCount = lungeResult.count
          this.counts.push({
            count: this.currentCount,
            timestamp: Date.now(),
            poseScore: poseScore.overall,
          })
          
          console.log(`✅ 런지 카운트 ${this.currentCount} 완료!`, {
            깊이: `${(lungeResult.depth / 10).toFixed(1)}%`,
            무릎각도: `${lungeResult.angle}도`,
            상태: lungeResult.state,
          })
          
          this.lastFeedback = lungeResult.feedback || '런지 완료!'
          
          return {
            count: this.currentCount,
            poseScore,
            shouldIncrement: true,
            feedback: this.lastFeedback,
          }
        }
      }
      
      this.lastFeedback = lungeResult.feedback || ''
      
      return {
        count: this.currentCount,
        poseScore,
        shouldIncrement: false,
        feedback: this.lastFeedback,
      }
    }
    
    // 다른 운동은 기존 로직 사용
    const shouldIncrement = this.checkRepetition(pose)

    if (shouldIncrement) {
      this.currentCount++
      this.counts.push({
        count: this.currentCount,
        timestamp: Date.now(),
        poseScore: poseScore.overall,
      })
    }

    return {
      count: this.currentCount,
      poseScore,
      shouldIncrement,
    }
  }

  private calculatePoseScore(pose: Pose): PoseScore {
    // 간단한 자세 점수 계산 로직 (실제로는 더 정교한 알고리즘 필요)
    const keypoints = pose.keypoints
    let alignment = 100
    let range = 100
    let stability = 100
    const feedback: string[] = []

    // 기본 점수 계산 (실제 구현 필요)
    if (keypoints.length < 10) {
      alignment = 50
      feedback.push('자세를 더 명확하게 보여주세요')
    }

    return {
      overall: Math.round((alignment + range + stability) / 3),
      details: {
        alignment,
        range,
        stability,
      },
      feedback,
    }
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

