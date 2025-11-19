import { Pose, PoseKeypoint } from '@/types'
import { calculateAngle, findKeypoint } from '@/utils/poseUtils'

/**
 * 팔꿈치 각도를 사용한 푸시업 카운트 감지 유틸리티
 */
export class PushupCounter {
  private elbowAngleHistory: number[] = [] // 팔꿈치 각도 히스토리 (스무딩용)
  private readonly historySize = 5 // 더 빠른 반응을 위해 줄임
  
  // 팔꿈치 각도 임계값 (측면/정면 모두 고려하여 더 유연하게)
  private readonly upAngleThreshold = 130 // up 상태: 팔을 뻗은 상태 (각도가 큼, 더 여유있게)
  private readonly downAngleThreshold = 100 // down 상태: 팔을 구부린 상태 (각도가 작음, 더 여유있게)
  
  // 측면/정면 감지를 위한 임계값
  private readonly sideViewThreshold = 0.5 // 측면 감지 임계값 (어깨-팔꿈치-손목의 X 좌표 차이)
  
  private state: 'up' | 'down' = 'up'
  private wasDown: boolean = false // 이전 프레임에서 down 상태였는지
  private minElbowAngle: number | null = null // 가장 작았던 팔꿈치 각도 (가장 구부린 상태)
  private upElbowAngle: number | null = null // up 상태일 때의 팔꿈치 각도 (기준점)
  private debugCounter = 0 // 디버깅용 카운터

  // 공통 유틸리티 사용 (calculateAngle, findKeypoint는 poseUtils에서 import)

  /**
   * 푸시업 자세 분석 및 카운트
   * @param pose 자세 데이터
   * @param currentCount 현재 카운트
   * @param videoHeight 비디오 높이 (사용하지 않지만 호환성을 위해 유지)
   * @returns { count: number, isComplete: boolean, depth: number, state: string }
   */
  analyzePushup(pose: Pose, currentCount: number = 0, videoHeight: number = 720): {
    count: number
    isComplete: boolean
    depth: number
    state: string
  } {
    const keypoints = pose.keypoints
    
    // 필요한 키포인트 찾기
    const leftShoulder = findKeypoint(keypoints, 'left_shoulder')
    const rightShoulder = findKeypoint(keypoints, 'right_shoulder')
    const leftElbow = findKeypoint(keypoints, 'left_elbow')
    const rightElbow = findKeypoint(keypoints, 'right_elbow')
    const leftWrist = findKeypoint(keypoints, 'left_wrist')
    const rightWrist = findKeypoint(keypoints, 'right_wrist')

    // 필수 키포인트가 없으면 카운트하지 않음
    // 팔꿈치 각도 계산을 위해 어깨, 팔꿈치, 손목이 모두 필요
    if (!leftShoulder || !rightShoulder || !leftElbow || !rightElbow || 
        !leftWrist || !rightWrist) {
      return {
        count: currentCount,
        isComplete: false,
        depth: 0,
        state: this.state,
      }
    }

    // 왼쪽 팔꿈치 각도 계산 (어깨-팔꿈치-손목)
    const leftAngle = calculateAngle(
      { x: leftShoulder.x, y: leftShoulder.y },
      { x: leftElbow.x, y: leftElbow.y },
      { x: leftWrist.x, y: leftWrist.y }
    )
    
    // 오른쪽 팔꿈치 각도 계산 (어깨-팔꿈치-손목)
    const rightAngle = calculateAngle(
      { x: rightShoulder.x, y: rightShoulder.y },
      { x: rightElbow.x, y: rightElbow.y },
      { x: rightWrist.x, y: rightWrist.y }
    )
    
    // 평균 각도 계산
    const avgAngle = (leftAngle + rightAngle) / 2
    
    // 히스토리에 추가 (스무딩)
    this.elbowAngleHistory.push(avgAngle)
    if (this.elbowAngleHistory.length > this.historySize) {
      this.elbowAngleHistory.shift()
    }
    
    // 스무딩된 각도
    const smoothedAngle = this.elbowAngleHistory.reduce((a, b) => a + b, 0) / this.elbowAngleHistory.length
    
    // 측면/정면 감지: 어깨-팔꿈치-손목의 X 좌표 차이로 판단
    // 정규화된 좌표(0-1)를 사용하므로, X 좌표 차이가 작으면 측면으로 판단
    const leftShoulderX = leftShoulder.x
    const leftElbowX = leftElbow.x
    const leftWristX = leftWrist.x
    const rightShoulderX = rightShoulder.x
    const rightElbowX = rightElbow.x
    const rightWristX = rightWrist.x
    
    // 측면 감지: 어깨-팔꿈치-손목의 X 좌표 차이로 판단
    // 측면에서는 한쪽 팔의 X 좌표가 거의 일직선이 됨 (차이가 작음)
    const leftXDiff = Math.abs(leftShoulderX - leftElbowX) + Math.abs(leftElbowX - leftWristX)
    const rightXDiff = Math.abs(rightShoulderX - rightElbowX) + Math.abs(rightElbowX - rightWristX)
    const minXDiff = Math.min(leftXDiff, rightXDiff)
    const isSideView = minXDiff < this.sideViewThreshold
    
    // 측면/정면에 따라 다른 판단 로직
    let isDown: boolean
    let isUp: boolean
    
    if (isSideView) {
      // 측면: 한쪽 팔만 잘 보이므로, 보이는 팔의 각도만으로 판단 (더 관대하게)
      // 양쪽 각도 중 더 작은 각도(더 구부린 쪽)를 사용
      const visibleAngle = Math.min(leftAngle, rightAngle)
      isDown = visibleAngle < this.downAngleThreshold + 10 // 측면에서는 10도 더 관대하게
      isUp = visibleAngle > this.upAngleThreshold - 10 // 측면에서는 10도 더 관대하게
    } else {
      // 정면: 양쪽 팔 모두 보이므로, 평균 또는 한쪽이라도 조건 만족하면 인식
      isDown = smoothedAngle < this.downAngleThreshold || 
               leftAngle < this.downAngleThreshold || 
               rightAngle < this.downAngleThreshold
      isUp = smoothedAngle > this.upAngleThreshold || 
             leftAngle > this.upAngleThreshold || 
             rightAngle > this.upAngleThreshold
    }
    
    let newCount = currentCount
    let isComplete = false

    // 디버깅 정보 (주기적으로 출력)
    this.debugCounter++
    if (this.debugCounter % 30 === 0) {
      console.log('📊 푸시업 감지 (팔꿈치 각도):', {
        상태: this.state,
        평균각도: smoothedAngle.toFixed(1) + '°',
        왼쪽각도: leftAngle.toFixed(1) + '°',
        오른쪽각도: rightAngle.toFixed(1) + '°',
        isDown,
        isUp,
        wasDown: this.wasDown,
        최소각도: this.minElbowAngle?.toFixed(1) + '°' || 'null',
        up임계값: this.upAngleThreshold + '°',
        down임계값: this.downAngleThreshold + '°',
      })
    }

    // up 상태일 때 기준점 설정 (매우 안정적인 up 상태에서만)
    // up 상태이고 각도가 충분히 클 때만 기준점 설정
    if (isUp && this.state === 'up' && smoothedAngle >= this.upAngleThreshold) {
      if (this.upElbowAngle === null) {
        // up 상태가 충분히 안정적이면 기준점 설정
        // 히스토리가 충분히 쌓이고, 최근 값들이 안정적일 때만
        if (this.elbowAngleHistory.length >= 5) {
          const recentAngles = this.elbowAngleHistory.slice(-3)
          const avgRecent = recentAngles.reduce((a, b) => a + b, 0) / recentAngles.length
          const variance = recentAngles.reduce((sum, val) => sum + Math.pow(val - avgRecent, 2), 0) / recentAngles.length
          
          // 분산이 작고(안정적), 평균 각도가 충분히 클 때만 기준점 설정
          if (variance < 50 && avgRecent >= this.upAngleThreshold) {
            this.upElbowAngle = avgRecent
            console.log('🎯 푸시업 기준 각도 설정:', this.upElbowAngle.toFixed(1) + '°')
          }
        }
      } else {
        // up 상태에서 기준점 업데이트 (매우 점진적, 각도가 충분히 크고 안정적일 때만)
        // 기준점과의 차이가 작고(10도 이내), 각도가 충분히 클 때만
        const angleDiff = Math.abs(smoothedAngle - this.upElbowAngle)
        if (smoothedAngle >= this.upAngleThreshold && angleDiff < 10) {
          // 매우 점진적으로 업데이트 (98% 기존값 + 2% 새값)
          this.upElbowAngle = this.upElbowAngle * 0.98 + smoothedAngle * 0.02
        }
      }
    }

    // 상태 머신: up <-> down
    if (isDown) {
      // down 상태: 팔을 구부린 상태
      if (this.state === 'up') {
        // up -> down 전환
        this.state = 'down'
        this.minElbowAngle = smoothedAngle
        console.log('⬇️ 푸시업 시작 (down 상태)', {
          각도: smoothedAngle.toFixed(1) + '°',
          기준각도: this.upElbowAngle?.toFixed(1) + '°' || 'null',
        })
      }
      // 최소 각도 업데이트 (가장 구부린 상태)
      if (this.minElbowAngle === null || smoothedAngle < this.minElbowAngle) {
        this.minElbowAngle = smoothedAngle
      }
    } else if (isUp) {
      // up 상태로 복귀: 팔을 뻗은 상태
      if (this.state === 'down') {
        // down 상태였다가 up으로 복귀 = 푸시업 완료!
        // 기준점과 최소 각도의 차이로 깊이 판단
        // 기준각도가 최소각도보다 작으면 (최소각도가 더 크면) 각도 차이는 음수가 됨
        // 이 경우 최소각도가 기준각도보다 작아야 함 (더 구부려야 함)
        const angleDifference = this.upElbowAngle !== null && this.minElbowAngle !== null
          ? this.upElbowAngle - this.minElbowAngle
          : 0
        const minAngleDifference = 2 // 최소 각도 차이 (기준점에서 2도 이상 구부려야 함, 더 여유있게)
        
        // 기준점이 없으면 현재 각도를 기준으로 판단 (첫 번째 푸시업)
        const hasValidReference = this.upElbowAngle !== null && this.minElbowAngle !== null
        const minAngleThreshold = 105 // 최소 각도 임계값 (기준점이 없을 때 사용, 더 여유있게)
        
        console.log('🔄 푸시업 up으로 복귀 시도:', {
          상태: this.state,
          wasDown: this.wasDown,
          현재각도: smoothedAngle.toFixed(1) + '°',
          기준각도: this.upElbowAngle?.toFixed(1) + '°' || 'null',
          최소각도: this.minElbowAngle?.toFixed(1) + '°' || 'null',
          각도차이: angleDifference.toFixed(1) + '°',
          필요차이: minAngleDifference + '°',
          기준점유효: hasValidReference,
        })
        
        // 기준점이 있으면 각도 차이로 판단, 없으면 최소 각도로 판단
        // 각도 차이가 음수면 최소각도가 기준각도보다 크다는 의미 (기준점이 잘못 설정됨)
        // 이 경우 최소각도만으로 판단하거나, 기준점을 현재 각도로 업데이트
        let shouldCount = false
        
        if (hasValidReference) {
          if (angleDifference > 0) {
            // 정상적인 경우: 각도 차이가 양수면 차이로 판단
            shouldCount = angleDifference >= minAngleDifference
          } else {
            // 기준점이 잘못 설정된 경우 (각도 차이가 음수)
            // 최소각도가 기준각도보다 크다는 것은 기준점이 너무 낮게 설정되었다는 의미
            // 이 경우 최소각도가 충분히 작으면(팔을 충분히 구부렸으면) 카운트
            if (this.minElbowAngle !== null && this.minElbowAngle < minAngleThreshold) {
              shouldCount = true
              // 기준점을 현재 up 각도로 업데이트 (더 높은 각도로)
              this.upElbowAngle = smoothedAngle
            } else {
              // 각도가 부족하면 기준점만 업데이트하고 카운트하지 않음
              // 기준점을 현재 각도로 업데이트하여 다음 시도에서 정확하게 판단
              if (smoothedAngle > (this.upElbowAngle || 0)) {
                this.upElbowAngle = smoothedAngle
              }
            }
          }
        } else {
          // 기준점이 없으면 최소 각도로만 판단
          shouldCount = this.minElbowAngle !== null && this.minElbowAngle < minAngleThreshold
        }
        
        if (shouldCount) {
          newCount = currentCount + 1
          isComplete = true
          console.log('✅ 푸시업 완료! 카운트:', newCount, {
            기준각도: this.upElbowAngle?.toFixed(1) + '°' || 'null',
            최소각도: this.minElbowAngle?.toFixed(1) + '°' || 'null',
            각도차이: hasValidReference ? angleDifference.toFixed(1) + '°' : 'N/A',
            현재각도: smoothedAngle.toFixed(1) + '°',
          })
          this.minElbowAngle = null
          // 기준점 업데이트 (올라간 위치로, 점진적으로)
          if (this.upElbowAngle === null) {
            this.upElbowAngle = smoothedAngle
          } else {
            // 점진적으로 업데이트 (90% 기존값 + 10% 새값) - 기준점이 너무 자주 변경되지 않도록
            this.upElbowAngle = this.upElbowAngle * 0.9 + smoothedAngle * 0.1
          }
        } else {
          // 각도가 부족하면 카운트하지 않음
          console.log('⚠️ 푸시업 각도 부족, 카운트하지 않음', {
            기준각도: this.upElbowAngle?.toFixed(1) + '°' || 'null',
            최소각도: this.minElbowAngle?.toFixed(1) + '°' || 'null',
            각도차이: hasValidReference ? angleDifference.toFixed(1) + '°' : 'N/A',
            필요차이: hasValidReference ? minAngleDifference + '°' : minAngleThreshold + '°',
          })
        }
      }
      this.state = 'up'
    }

    // wasDown은 상태 변경 전에 설정 (다음 프레임을 위해)
    this.wasDown = this.state === 'down'
    
    // depth는 각도 기반으로 계산 (180도에서 현재 각도를 뺀 값, 정규화)
    // 각도가 작을수록 (팔을 많이 구부릴수록) depth가 큼
    const depth = this.minElbowAngle !== null 
      ? Math.max(0, (180 - this.minElbowAngle) / 180) // 0-1 범위로 정규화
      : 0

    return {
      count: newCount,
      isComplete,
      depth: Math.round(depth * 1000), // 정규화된 값을 1000배로 변환 (0.001 단위)
      state: this.state,
    }
  }

  /**
   * 카운터 리셋
   */
  reset(): void {
    this.elbowAngleHistory = []
    this.state = 'up'
    this.wasDown = false
    this.minElbowAngle = null
    this.upElbowAngle = null
    this.debugCounter = 0
  }

  /**
   * 현재 상태 반환
   */
  getState(): string {
    return this.state
  }
}
