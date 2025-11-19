import { PoseKeypoint } from '@/types'

/**
 * 공통 포즈 유틸리티 함수
 * 모든 운동 카운터에서 공통으로 사용하는 함수들을 중앙화
 */

/**
 * 세 점 사이의 각도 계산 (도 단위)
 * point1 - point2 - point3 순서로 각도 계산
 * @param point1 첫 번째 점
 * @param point2 중간 점 (각도의 꼭짓점)
 * @param point3 세 번째 점
 * @returns 각도 (0-180도)
 */
export function calculateAngle(
  point1: { x: number; y: number },
  point2: { x: number; y: number },
  point3: { x: number; y: number }
): number {
  const radians = Math.atan2(point3.y - point2.y, point3.x - point2.x) -
                  Math.atan2(point1.y - point2.y, point1.x - point2.x)
  let angle = Math.abs(radians * 180.0 / Math.PI)
  if (angle > 180.0) {
    angle = 360 - angle
  }
  return angle
}

/**
 * 키포인트 찾기 (신뢰도 체크 포함)
 * @param keypoints 키포인트 배열
 * @param name 찾을 키포인트 이름
 * @param minScore 최소 신뢰도 점수 (기본값: 0.3)
 * @returns 찾은 키포인트 또는 null
 */
export function findKeypoint(
  keypoints: PoseKeypoint[],
  name: string,
  minScore: number = 0.3
): PoseKeypoint | null {
  const kp = keypoints.find((kp) => kp.name === name)
  if (kp && kp.score && kp.score > minScore) {
    return kp
  }
  return null
}

/**
 * 여러 키포인트를 한 번에 찾기
 * @param keypoints 키포인트 배열
 * @param names 찾을 키포인트 이름 배열
 * @param minScore 최소 신뢰도 점수 (기본값: 0.3)
 * @returns 찾은 키포인트들의 맵 (이름 -> 키포인트)
 */
export function findKeypoints(
  keypoints: PoseKeypoint[],
  names: string[],
  minScore: number = 0.3
): Record<string, PoseKeypoint | null> {
  const result: Record<string, PoseKeypoint | null> = {}
  for (const name of names) {
    result[name] = findKeypoint(keypoints, name, minScore)
  }
  return result
}

/**
 * 두 점 사이의 거리 계산
 * @param point1 첫 번째 점
 * @param point2 두 번째 점
 * @returns 거리
 */
export function calculateDistance(
  point1: { x: number; y: number },
  point2: { x: number; y: number }
): number {
  const dx = point2.x - point1.x
  const dy = point2.y - point1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * 값 배열의 평균 계산
 * @param values 값 배열
 * @returns 평균값
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * 값 배열의 분산 계산
 * @param values 값 배열
 * @returns 분산값
 */
export function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0
  const avg = calculateAverage(values)
  return values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length
}

