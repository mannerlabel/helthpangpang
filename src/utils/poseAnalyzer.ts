import { Pose, PoseScore } from '@/types'

export const analyzePose = (pose: Pose, exerciseType: string): PoseScore => {
  const keypoints = pose.keypoints
  let alignment = 100
  let range = 100
  let stability = 100
  const feedback: string[] = []

  // 기본 검증
  if (keypoints.length < 10) {
    alignment = 50
    range = 50
    feedback.push('자세를 더 명확하게 보여주세요')
    return {
      overall: 50,
      details: { alignment, range, stability },
      feedback,
    }
  }

  // 운동 타입별 분석
  switch (exerciseType) {
    case 'pushup':
      return analyzePushup(pose, keypoints)
    case 'squat':
      return analyzeSquat(pose, keypoints)
    case 'lunge':
      return analyzeLunge(pose, keypoints)
    case 'situp':
      return analyzeSitup(pose, keypoints)
    default:
      return {
        overall: 75,
        details: { alignment, range, stability },
        feedback: ['운동을 계속하세요!'],
      }
  }
}

const analyzePushup = (pose: Pose, keypoints: any[]): PoseScore => {
  const leftShoulder = keypoints.find((kp) => kp.name === 'left_shoulder')
  const rightShoulder = keypoints.find((kp) => kp.name === 'right_shoulder')
  const leftWrist = keypoints.find((kp) => kp.name === 'left_wrist')
  const rightWrist = keypoints.find((kp) => kp.name === 'right_wrist')
  const leftHip = keypoints.find((kp) => kp.name === 'left_hip')
  const rightHip = keypoints.find((kp) => kp.name === 'right_hip')

  let alignment = 100
  let range = 100
  const feedback: string[] = []

  // 어깨 정렬 확인
  if (leftShoulder && rightShoulder) {
    const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y)
    if (shoulderDiff > 20) {
      alignment -= 20
      feedback.push('어깨를 수평으로 맞춰주세요')
    }
  }

  // 손목과 어깨의 거리 (범위 확인)
  if (leftShoulder && leftWrist) {
    const distance = Math.abs(leftWrist.y - leftShoulder.y)
    if (distance < 30) {
      range -= 30
      feedback.push('팔을 더 많이 구부려주세요')
    }
  }

  // 엉덩이 높이 확인
  if (leftShoulder && leftHip) {
    const hipHeight = leftHip.y - leftShoulder.y
    if (hipHeight > 100) {
      alignment -= 15
      feedback.push('엉덩이를 낮춰주세요')
    }
  }

  if (feedback.length === 0) {
    feedback.push('완벽한 자세입니다!')
  }

  return {
    overall: Math.max(0, Math.min(100, (alignment + range) / 2)),
    details: { alignment, range, stability: 100 },
    feedback,
  }
}

const analyzeSquat = (pose: Pose, keypoints: any[]): PoseScore => {
  const leftHip = keypoints.find((kp) => kp.name === 'left_hip')
  const rightHip = keypoints.find((kp) => kp.name === 'right_hip')
  const leftKnee = keypoints.find((kp) => kp.name === 'left_knee')
  const rightKnee = keypoints.find((kp) => kp.name === 'right_knee')
  const leftAnkle = keypoints.find((kp) => kp.name === 'left_ankle')
  const rightAnkle = keypoints.find((kp) => kp.name === 'right_ankle')

  let alignment = 100
  let range = 100
  const feedback: string[] = []

  // 무릎과 발목 정렬 확인
  if (leftKnee && leftAnkle) {
    const kneeAnkleDiff = Math.abs(leftKnee.x - leftAnkle.x)
    if (kneeAnkleDiff > 30) {
      alignment -= 25
      feedback.push('무릎이 발끝을 넘지 않도록 주의하세요')
    }
  }

  // 엉덩이 깊이 확인
  if (leftHip && leftKnee) {
    const depth = leftHip.y - leftKnee.y
    if (depth < 50) {
      range -= 30
      feedback.push('더 깊이 앉아주세요')
    }
  }

  if (feedback.length === 0) {
    feedback.push('좋은 자세입니다!')
  }

  return {
    overall: Math.max(0, Math.min(100, (alignment + range) / 2)),
    details: { alignment, range, stability: 100 },
    feedback,
  }
}

const analyzeSitup = (pose: Pose, keypoints: any[]): PoseScore => {
  // 시트업 분석 로직
  return {
    overall: 80,
    details: { alignment: 85, range: 75, stability: 100 },
    feedback: ['계속하세요!'],
  }
}

const analyzeLunge = (pose: Pose, keypoints: any[]): PoseScore => {
  const leftHip = keypoints.find((kp) => kp.name === 'left_hip')
  const rightHip = keypoints.find((kp) => kp.name === 'right_hip')
  const leftKnee = keypoints.find((kp) => kp.name === 'left_knee')
  const rightKnee = keypoints.find((kp) => kp.name === 'right_knee')
  const leftAnkle = keypoints.find((kp) => kp.name === 'left_ankle')
  const rightAnkle = keypoints.find((kp) => kp.name === 'right_ankle')

  let alignment = 100
  let range = 100
  const feedback: string[] = []

  // 무릎과 발목 정렬 확인
  if (leftKnee && leftAnkle) {
    const kneeAnkleDiff = Math.abs(leftKnee.x - leftAnkle.x)
    if (kneeAnkleDiff > 20) {
      alignment -= 20
      feedback.push('앞 무릎이 발끝을 넘지 않도록 주의하세요')
    }
  }

  // 엉덩이 높이 차이 확인
  if (leftHip && rightHip) {
    const hipDiff = Math.abs(leftHip.y - rightHip.y)
    if (hipDiff > 15) {
      alignment -= 15
      feedback.push('엉덩이를 수평으로 유지하세요')
    }
  }

  // 런지 깊이 확인
  if (leftHip && leftKnee && rightHip && rightKnee) {
    const frontKneeAngle = Math.abs(leftKnee.y - leftHip.y)
    const backKneeAngle = Math.abs(rightKnee.y - rightHip.y)
    if (frontKneeAngle < 40 || backKneeAngle < 40) {
      range -= 25
      feedback.push('더 깊이 런지하세요')
    }
  }

  if (feedback.length === 0) {
    feedback.push('좋은 런지 자세입니다!')
  }

  return {
    overall: Math.max(0, Math.min(100, (alignment + range) / 2)),
    details: { alignment, range, stability: 100 },
    feedback,
  }
}

