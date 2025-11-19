import { Pose, PoseKeypoint } from '@/types'
import { calculateAngle, findKeypoint } from '@/utils/poseUtils'

/**
 * MediaPipe를 사용한 스쿼트 카운트 감지 유틸리티
 */
export class SquatCounter {
  private hipYHistory: number[] = [] // 엉덩이 Y 좌표 히스토리 (스무딩용)
  private readonly historySize = 5 // 더 빠른 반응을 위해 줄임
  private readonly squatDepthThreshold = 0.04 // 스쿼트 깊이 임계값 (정규화된 값, 더 관대하게)
  private readonly minKneeAngle = 160 // 스쿼트 시 최대 무릎 각도 (더 관대하게, 160도보다 작으면 구부린 것으로 인식)
  private debugCounter = 0 // 디버깅용 카운터
  private stableStandingFrames = 0 // 안정적인 standing 상태 프레임 수
  private readonly minStableFrames = 10 // 기준점 업데이트를 위한 최소 안정 프레임 수
  
  private state: 'standing' | 'down' = 'standing'
  private lastHipY: number | null = null
  private standingHipY: number | null = null // 서 있을 때의 엉덩이 Y 좌표 (기준점)
  private minHipY: number | null = null // 가장 낮았던 엉덩이 Y 좌표
  private wasDown: boolean = false // 이전 프레임에서 down 상태였는지
  private lastCountTime: number = 0 // 마지막 카운트 시간 (중복 방지)
  private readonly minCountInterval: number = 500 // 최소 카운트 간격 (밀리초, 0.5초로 줄임)
  
  // 공통 유틸리티 사용 (calculateAngle, findKeypoint는 poseUtils에서 import)

  /**
   * 스쿼트 자세 분석 및 카운트
   * @returns { count: number, isComplete: boolean, depth: number, angle: number }
   */
  analyzeSquat(pose: Pose, currentCount: number = 0): {
    count: number
    isComplete: boolean
    depth: number
    angle: number
    state: string
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
      }
    }

    // 엉덩이 평균 Y 좌표 계산
    // MoveNet은 정규화된 좌표(0-1)를 반환하므로, 픽셀 좌표인지 확인하고 정규화
    let avgHipY = (leftHip.y + rightHip.y) / 2
    
    // 좌표가 정규화되지 않은 경우(픽셀 좌표) 정규화 (일반적으로 비디오 높이로 나눔)
    // 1보다 크면 픽셀 좌표로 간주 (비디오 높이로 나눔, 기본값 720)
    if (avgHipY > 1.0) {
      // 픽셀 좌표를 정규화 (비디오 높이로 나눔)
      avgHipY = avgHipY / 720 // 기본 비디오 높이로 정규화
    }
    
    // 히스토리에 추가 (스무딩)
    this.hipYHistory.push(avgHipY)
    if (this.hipYHistory.length > this.historySize) {
      this.hipYHistory.shift()
    }
    
    // 스무딩된 엉덩이 Y 좌표
    const smoothedHipY = this.hipYHistory.reduce((a, b) => a + b, 0) / this.hipYHistory.length

    // 서 있을 때의 엉덩이 Y 좌표 초기화 (standing 상태에서 안정적일 때만)
    if (this.standingHipY === null) {
      // 초기 기준점 설정: 히스토리가 충분히 쌓이면 바로 설정 (더 빠르게)
      if (this.hipYHistory.length >= 3) {
        // 히스토리의 최근 값들이 안정적인지 확인 (더 관대하게)
        const recentValues = this.hipYHistory.slice(-3)
        const variance = recentValues.reduce((sum, val) => {
          const avg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length
          return sum + Math.pow(val - avg, 2)
        }, 0) / recentValues.length
        if (variance < 0.01) { // 분산 임계값을 더 관대하게 (0.001 -> 0.01)
          this.standingHipY = smoothedHipY
          this.stableStandingFrames = 10 // 초기 설정 시 안정 프레임을 충분히 설정
          console.log('🎯 기준점 설정:', this.standingHipY.toFixed(3), {
            히스토리길이: this.hipYHistory.length,
            분산: variance.toFixed(6),
          })
        }
      }
    } else if (this.state === 'standing' && this.lastHipY !== null) {
      // standing 상태에서만 기준점 업데이트 (매우 엄격하게)
      const hipChange = Math.abs(smoothedHipY - this.lastHipY)
      if (hipChange < 0.01) { // 변화가 매우 작을 때만
        this.stableStandingFrames++
        // 충분히 안정적인 상태가 유지되면 기준점을 매우 천천히 업데이트
        if (this.stableStandingFrames >= this.minStableFrames) {
          this.standingHipY = (this.standingHipY * 0.98 + smoothedHipY * 0.02) // 매우 점진적 업데이트
        }
      } else {
        this.stableStandingFrames = Math.max(0, this.stableStandingFrames - 1) // 변화가 있으면 안정 프레임 감소
      }
    } else {
      // down 상태에서는 기준점 업데이트 안 함
      // down 상태에서는 안정 프레임을 유지 (리셋하지 않음)
    }

    // 무릎 각도 계산 (엉덩이-무릎-발목)
    // 양쪽 무릎 각도를 모두 계산하고 평균 사용 (더 정확함)
    let kneeAngle = 180
    let leftKneeAngle = 180
    let rightKneeAngle = 180
    
    if (leftHip && leftKnee && leftAnkle) {
      leftKneeAngle = calculateAngle(
        { x: leftHip.x, y: leftHip.y },
        { x: leftKnee.x, y: leftKnee.y },
        { x: leftAnkle.x, y: leftAnkle.y }
      )
    }
    
    if (rightHip && rightKnee && rightAnkle) {
      rightKneeAngle = calculateAngle(
        { x: rightHip.x, y: rightHip.y },
        { x: rightKnee.x, y: rightKnee.y },
        { x: rightAnkle.x, y: rightAnkle.y }
      )
    }
    
    // 양쪽 무릎 각도의 평균 사용 (둘 다 유효한 경우)
    if (leftKneeAngle < 180 && rightKneeAngle < 180) {
      kneeAngle = (leftKneeAngle + rightKneeAngle) / 2
    } else if (leftKneeAngle < 180) {
      kneeAngle = leftKneeAngle
    } else if (rightKneeAngle < 180) {
      kneeAngle = rightKneeAngle
    }

    // 스쿼트 깊이 계산 (엉덩이가 얼마나 내려갔는지)
    let depth = 0
    if (this.standingHipY !== null) {
      // 엉덩이가 내려간 정도 (Y 좌표가 증가 = 아래로 이동)
      // 정규화된 좌표(0-1) 또는 픽셀 좌표 모두 처리
      const hipMovement = Math.abs(smoothedHipY - this.standingHipY)
      depth = hipMovement // 절대값 사용 (좌표계에 관계없이)
    }

    // 상태 판단 (무릎 각도 우선, 깊이는 보조)
    // 무릎 각도가 충분히 작으면(구부렸으면) 깊이와 관계없이 down 상태로 인식
    const isDownByAngle = kneeAngle < this.minKneeAngle
    const isDownByDepth = this.standingHipY !== null && depth > this.squatDepthThreshold * 0.5
    
    // 무릎 각도가 충분히 작으면 무조건 down 상태로 인식 (깊이는 보조 조건)
    // 기준점이 설정되어 있고, 무릎 각도가 작으면 즉시 down 상태로 인식
    // 깊이 기반 전환은 안정 프레임이 충분할 때만
    const isDown = this.standingHipY !== null && 
                   (isDownByAngle || (isDownByDepth && this.stableStandingFrames >= 3))
    
    let newCount = currentCount
    let isComplete = false

    // 디버깅 정보 (주기적으로 출력, 빈도 감소)
    this.debugCounter++
    // 기준점이 설정되지 않았을 때도 로그 출력 (문제 파악용)
    if (this.debugCounter % 60 === 0) { // 60프레임마다 출력 (약 2초마다)
      if (this.standingHipY !== null) {
        console.log('📊 스쿼트 감지:', {
          상태: this.state,
          깊이: (depth * 100).toFixed(1) + '%',
          무릎각도: Math.round(kneeAngle) + '°',
          엉덩이Y: smoothedHipY.toFixed(3),
          기준점: this.standingHipY.toFixed(3),
          isDown,
          isDownByAngle: kneeAngle < this.minKneeAngle,
          isDownByDepth: depth > this.squatDepthThreshold * 0.5,
          minKneeAngle: this.minKneeAngle,
          stableStandingFrames: this.stableStandingFrames,
        })
      } else {
        console.log('⏳ 기준점 설정 대기 중:', {
          히스토리길이: this.hipYHistory.length,
          엉덩이Y: smoothedHipY.toFixed(3),
          무릎각도: Math.round(kneeAngle) + '°',
        })
      }
    }

    // 상태 머신: standing <-> down
    if (isDown) {
      if (this.state === 'standing') {
        // standing -> down 전환
        this.state = 'down'
        this.minHipY = smoothedHipY
        this.wasDown = true // down 상태로 전환했음을 표시
        console.log('⬇️ 스쿼트 시작 (down 상태)', {
          깊이: (depth * 100).toFixed(1) + '%',
          무릎각도: Math.round(kneeAngle) + '°',
          isDownByAngle,
          isDownByDepth,
        })
      }
      // 최저점 업데이트 (down 상태에서만)
      if (this.minHipY === null || smoothedHipY > this.minHipY) {
        this.minHipY = smoothedHipY
      }
      // down 상태에서는 wasDown 유지
      this.wasDown = true
    } else {
      // standing 상태로 복귀
      // down 상태였다가 standing으로 복귀할 때만 카운트
      if (this.state === 'down' && this.wasDown) {
        // down 상태였다가 standing으로 복귀 = 스쿼트 완료!
        // 깊이와 각도 모두 충분했는지 확인 (더 엄격한 체크)
        // 정규화된 좌표(0-1)를 사용하므로 절대값으로 계산
        // minHipY가 standingHipY보다 크면(아래로 내려간 것) 깊이가 양수
        const maxDepth = this.minHipY && this.standingHipY 
          ? Math.abs(this.minHipY - this.standingHipY) 
          : 0
        
        // 깊이 또는 각도 중 하나만 만족해도 카운트 (더 관대하게)
        const depthOk = maxDepth >= this.squatDepthThreshold * 0.8 // 80%만 만족해도 OK
        // 무릎 각도 조건: 각도가 충분히 작거나(구부렸거나), 깊이가 충분히 깊으면 OK
        const angleOk = kneeAngle < this.minKneeAngle || (this.minHipY && this.standingHipY && maxDepth > this.squatDepthThreshold * 1.0)
        
        // 중복 카운트 방지: 최소 깊이를 더 관대하게 체크
        const minDepthForCount = this.squatDepthThreshold * 0.9 // 90%만 만족해도 OK (더 관대하게)
        
        // 시간 기반 중복 카운트 방지: 마지막 카운트로부터 최소 간격이 지나야 함
        const currentTime = Date.now()
        const timeSinceLastCount = currentTime - this.lastCountTime
        const timeOk = timeSinceLastCount >= this.minCountInterval
        
        // 깊이 또는 각도 중 하나만 만족해도 카운트 (더 관대하게)
        if ((depthOk || angleOk) && maxDepth >= minDepthForCount && timeOk) {
          newCount = currentCount + 1
          isComplete = true
          this.lastCountTime = currentTime // 카운트 시간 업데이트
          console.log('✅ 스쿼트 완료! 카운트:', newCount, {
            최대깊이: (maxDepth * 100).toFixed(1) + '%',
            무릎각도: Math.round(kneeAngle) + '°',
            시간간격: timeSinceLastCount + 'ms',
          })
          this.minHipY = null
          // 기준점은 standing 상태에서 안정적으로 업데이트되도록 함 (여기서는 재설정 안 함)
          // 카운트 후 일시적으로 더 엄격한 조건 적용 (중복 방지)
          this.wasDown = false // 다음 카운트를 위해 리셋
          this.stableStandingFrames = 5 // 카운트 후 안정 프레임을 적절히 설정 (0으로 리셋하지 않음)
        } else {
          // 깊이, 각도, 또는 시간 조건이 부족하면 카운트하지 않음
          if (!timeOk) {
            // 시간 조건 부족은 로그 출력 안 함 (너무 많이 출력됨)
          } else {
            // 주기적으로만 로그 출력 (너무 많이 출력되지 않도록)
            if (Math.random() < 0.1) {
              console.log('⚠️ 스쿼트 조건 부족, 카운트하지 않음', {
                최대깊이: (maxDepth * 100).toFixed(1) + '%',
                필요깊이: (this.squatDepthThreshold * 100).toFixed(1) + '%',
                무릎각도: Math.round(kneeAngle) + '°',
                깊이OK: depthOk,
                각도OK: angleOk,
              })
            }
          }
        }
      } else {
        // standing 상태로 복귀 (isDown이 false일 때)
        if (this.state === 'down') {
          this.state = 'standing'
          this.stableStandingFrames = 5 // 상태 전환 시 안정 프레임을 적절히 설정
          this.wasDown = false // standing 상태로 복귀했으므로 wasDown 리셋
        }
      }
    }

    // wasDown 업데이트는 상태 전환 후에만 수행 (중복 업데이트 방지)
    if (this.state === 'down') {
      this.wasDown = true
    }
    this.lastHipY = smoothedHipY

    return {
      count: newCount,
      isComplete,
      depth: Math.round(depth * 1000), // 픽셀 단위로 변환 (0.001 단위)
      angle: Math.round(kneeAngle),
      state: this.state,
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
    this.lastCountTime = 0 // 카운트 시간도 리셋
    this.stableStandingFrames = 0 // 안정 프레임도 리셋
  }

  /**
   * 현재 상태 반환
   */
  getState(): string {
    return this.state
  }
}

