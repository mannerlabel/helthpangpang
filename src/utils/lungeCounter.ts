import { Pose, PoseKeypoint } from '@/types'
import { calculateAngle, findKeypoint } from '@/utils/poseUtils'

/**
 * MediaPipe를 사용한 런지 카운트 감지 유틸리티
 */
export class LungeCounter {
  private hipYHistory: number[] = [] // 엉덩이 Y 좌표 히스토리 (스무딩용)
  private readonly historySize = 5
  private readonly lungeDepthThreshold = 0.08 // 런지 깊이 임계값 (정규화된 값)
  private readonly minKneeAngle = 120 // 런지 시 최대 무릎 각도
  private debugCounter = 0
  
  private state: 'standing' | 'down' = 'standing'
  private lastHipY: number | null = null
  private standingHipY: number | null = null // 서 있을 때의 엉덩이 Y 좌표 (기준점)
  private minHipY: number | null = null // 가장 낮았던 엉덩이 Y 좌표
  private wasDown: boolean = false
  
  // 공통 유틸리티 사용 (calculateAngle, findKeypoint는 poseUtils에서 import)

  /**
   * 런지 자세 분석 및 카운트
   */
  analyzeLunge(pose: Pose, currentCount: number = 0): {
    count: number
    isComplete: boolean
    depth: number
    angle: number
    state: string
    feedback?: string
  } {
    const keypoints = pose.keypoints
    
    // 필요한 키포인트 찾기
    const leftHip = findKeypoint(keypoints, 'left_hip')
    const rightHip = findKeypoint(keypoints, 'right_hip')
    const leftKnee = findKeypoint(keypoints, 'left_knee')
    const rightKnee = findKeypoint(keypoints, 'right_knee')
    const leftAnkle = findKeypoint(keypoints, 'left_ankle')
    const rightAnkle = findKeypoint(keypoints, 'right_ankle')

    // 필수 키포인트가 없으면 카운트하지 않음
    if (!leftHip || !rightHip || !leftKnee || !rightKnee) {
      return {
        count: currentCount,
        isComplete: false,
        depth: 0,
        angle: 180,
        state: this.state,
        feedback: '필수 관절이 감지되지 않습니다',
      }
    }

    // 엉덩이 평균 Y 좌표 계산
    const avgHipY = (leftHip.y + rightHip.y) / 2
    
    // 히스토리에 추가 (스무딩)
    this.hipYHistory.push(avgHipY)
    if (this.hipYHistory.length > this.historySize) {
      this.hipYHistory.shift()
    }
    
    // 스무딩된 엉덩이 Y 좌표
    const smoothedHipY = this.hipYHistory.reduce((a, b) => a + b, 0) / this.hipYHistory.length

    // 서 있을 때의 엉덩이 Y 좌표 초기화
    if (this.standingHipY === null) {
      if (this.hipYHistory.length >= 3) {
        this.standingHipY = smoothedHipY
        console.log('🎯 런지 기준점 설정:', this.standingHipY.toFixed(3))
      }
    } else if (this.state === 'standing' && this.lastHipY !== null) {
      if (Math.abs(smoothedHipY - this.lastHipY) < 0.03) {
        this.standingHipY = (this.standingHipY * 0.95 + smoothedHipY * 0.05)
      }
    }

    // 무릎 각도 계산 (앞 무릎 기준)
    let kneeAngle = 180
    let feedback = ''
    
    // 앞 무릎과 뒷 무릎 중 더 구부러진 쪽을 사용
    let frontKneeAngle = 180
    let backKneeAngle = 180
    
    if (leftHip && leftKnee && leftAnkle) {
      frontKneeAngle = calculateAngle(
        { x: leftHip.x, y: leftHip.y },
        { x: leftKnee.x, y: leftKnee.y },
        { x: leftAnkle.x, y: leftAnkle.y }
      )
    }
    
    if (rightHip && rightKnee && rightAnkle) {
      backKneeAngle = calculateAngle(
        { x: rightHip.x, y: rightHip.y },
        { x: rightKnee.x, y: rightKnee.y },
        { x: rightAnkle.x, y: rightAnkle.y }
      )
    }
    
    // 더 작은 각도 (더 구부러진 쪽)를 사용
    kneeAngle = Math.min(frontKneeAngle, backKneeAngle)

    // 런지 깊이 계산
    let depth = 0
    if (this.standingHipY !== null) {
      const hipMovement = smoothedHipY - this.standingHipY
      depth = Math.max(0, hipMovement)
    }

    // 상태 판단
    const isDown = this.standingHipY !== null && 
                   depth > this.lungeDepthThreshold && 
                   kneeAngle < this.minKneeAngle
    
    // 피드백 생성
    if (kneeAngle > this.minKneeAngle && isDown) {
      feedback = '무릎 각도 부족'
    } else if (depth < this.lungeDepthThreshold && this.state === 'down') {
      feedback = '런지 깊이 부족'
    } else if (this.state === 'standing') {
      feedback = '정상 자세'
    }
    
    let newCount = currentCount
    let isComplete = false

    // 디버깅 정보
    this.debugCounter++
    if (this.debugCounter % 30 === 0 && this.standingHipY !== null) {
      console.log('📊 런지 감지:', {
        상태: this.state,
        깊이: (depth * 100).toFixed(1) + '%',
        무릎각도: Math.round(kneeAngle) + '°',
        엉덩이Y: smoothedHipY.toFixed(3),
        기준점: this.standingHipY.toFixed(3),
        isDown,
        피드백: feedback,
      })
    }

    // 상태 머신: standing <-> down
    if (isDown) {
      if (this.state === 'standing') {
        this.state = 'down'
        this.minHipY = smoothedHipY
        console.log('⬇️ 런지 시작 (down 상태)', {
          깊이: (depth * 100).toFixed(1) + '%',
          무릎각도: Math.round(kneeAngle) + '°',
        })
      }
      if (this.minHipY === null || smoothedHipY > this.minHipY) {
        this.minHipY = smoothedHipY
      }
    } else {
      if (this.state === 'down' && this.wasDown) {
        const maxDepth = this.minHipY && this.standingHipY 
          ? this.minHipY - this.standingHipY 
          : 0
        
        if (maxDepth >= this.lungeDepthThreshold) {
          newCount = currentCount + 1
          isComplete = true
          console.log('✅ 런지 완료! 카운트:', newCount, {
            최대깊이: (maxDepth * 100).toFixed(1) + '%',
            무릎각도: Math.round(kneeAngle) + '°',
          })
          this.minHipY = null
          this.standingHipY = smoothedHipY
          feedback = '런지 완료!'
        } else {
          feedback = '런지 깊이 부족'
          console.log('⚠️ 런지 깊이 부족, 카운트하지 않음', {
            최대깊이: (maxDepth * 100).toFixed(1) + '%',
            필요깊이: (this.lungeDepthThreshold * 100).toFixed(1) + '%',
          })
        }
      }
      this.state = 'standing'
    }

    this.wasDown = this.state === 'down'
    this.lastHipY = smoothedHipY

    return {
      count: newCount,
      isComplete,
      depth: Math.round(depth * 1000),
      angle: Math.round(kneeAngle),
      state: this.state,
      feedback,
    }
  }

  /**
   * 카운터 리셋
   */
  reset(): void {
    this.hipYHistory = []
    this.state = 'standing'
    this.lastHipY = null
    this.standingHipY = null
    this.minHipY = null
    this.wasDown = false
  }

  /**
   * 현재 상태 반환
   */
  getState(): string {
    return this.state
  }
}

