import { Pose, SilhouetteConfig } from '@/types'

class SilhouetteService {
  // 점수에 따른 색상 반환 (무지개 색상)
  getColorByScore(score: number): string {
    if (score >= 90) return '#FF0000' // 빨강
    if (score >= 80) return '#FF7F00' // 주황
    if (score >= 70) return '#FFFF00' // 노랑
    if (score >= 60) return '#00FF00' // 초록
    if (score >= 50) return '#0000FF' // 파랑
    if (score >= 40) return '#4B0082' // 남색
    return '#9400D3' // 보라 (40점 미만)
  }

  // 점수에 따른 두께 반환
  getThicknessByScore(score: number): number {
    if (score >= 90) return 8
    if (score >= 80) return 7
    if (score >= 70) return 6
    if (score >= 60) return 5
    if (score >= 50) return 4
    if (score >= 40) return 3
    return 2
  }

  getSilhouetteConfig(pose: Pose, score: number): SilhouetteConfig {
    return {
      enabled: true,
      thickness: this.getThicknessByScore(score),
      color: this.getColorByScore(score),
    }
  }

  // 실루엣 그리기 (캔버스에)
  drawSilhouette(
    ctx: CanvasRenderingContext2D,
    pose: Pose,
    config: SilhouetteConfig
  ): void {
    if (!config.enabled || !pose.keypoints || pose.keypoints.length === 0) return

    ctx.strokeStyle = config.color
    ctx.lineWidth = config.thickness
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // 키포인트 연결 (실루엣 형태)
    const connections = [
      // 얼굴
      ['left_eye', 'right_eye'],
      ['left_eye', 'nose'],
      ['right_eye', 'nose'],
      // 상체
      ['left_shoulder', 'right_shoulder'],
      ['left_shoulder', 'left_elbow'],
      ['left_elbow', 'left_wrist'],
      ['right_shoulder', 'right_elbow'],
      ['right_elbow', 'right_wrist'],
      ['left_shoulder', 'left_hip'],
      ['right_shoulder', 'right_hip'],
      // 하체
      ['left_hip', 'right_hip'],
      ['left_hip', 'left_knee'],
      ['left_knee', 'left_ankle'],
      ['right_hip', 'right_knee'],
      ['right_knee', 'right_ankle'],
    ]

    connections.forEach(([startName, endName]) => {
      const start = pose.keypoints.find((kp) => kp.name === startName)
      const end = pose.keypoints.find((kp) => kp.name === endName)

      if (
        start &&
        end &&
        start.score &&
        end.score &&
        start.score > 0.3 &&
        end.score > 0.3
      ) {
        ctx.beginPath()
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(end.x, end.y)
        ctx.stroke()
      }
    })

    // 키포인트 그리기
    pose.keypoints.forEach((keypoint) => {
      if (keypoint.score && keypoint.score > 0.3) {
        ctx.beginPath()
        ctx.arc(keypoint.x, keypoint.y, config.thickness / 2, 0, 2 * Math.PI)
        ctx.fillStyle = config.color
        ctx.fill()
      }
    })
  }
}

export const silhouetteService = new SilhouetteService()

