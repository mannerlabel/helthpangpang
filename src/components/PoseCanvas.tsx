import { useEffect, useRef } from 'react'
import { Pose } from '@/types'

interface PoseCanvasProps {
  poses: Pose[]
  videoWidth: number
  videoHeight: number
  canvasWidth?: number
  canvasHeight?: number
}

const PoseCanvas = ({
  poses,
  videoWidth,
  videoHeight,
  canvasWidth,
  canvasHeight,
}: PoseCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 캔버스 크기 설정
    canvas.width = canvasWidth || videoWidth
    canvas.height = canvasHeight || videoHeight

    // 초기화 (매 프레임마다 완전히 지움)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // 자세가 없으면 아무것도 그리지 않음
    if (!poses || poses.length === 0) {
      return
    }

    // 스케일 계산 (MoveNet 좌표는 정규화된 값(0-1)이므로 비디오 크기로 변환)
    // videoWidth, videoHeight는 실제 비디오 크기
    // canvas.width, canvas.height는 표시 크기
    const scaleX = canvas.width / videoWidth
    const scaleY = canvas.height / videoHeight

    // 자세 그리기
    poses.forEach((pose) => {
      if (!pose.keypoints || pose.keypoints.length === 0) return

      // 주요 관절 포인트 정의 (더 크고 명확하게 표시)
      const majorJoints = [
        'left_shoulder', 'right_shoulder',
        'left_elbow', 'right_elbow',
        'left_wrist', 'right_wrist',
        'left_hip', 'right_hip',
        'left_knee', 'right_knee',
        'left_ankle', 'right_ankle',
      ]
      
      // 관절별 색상 정의 (이미지 참고)
      const getJointColor = (jointName: string | undefined): string => {
        if (!jointName) return '#00ff00'
        if (jointName.includes('shoulder') || jointName.includes('elbow') || jointName.includes('wrist')) {
          return '#ff00ff' // 핑크 (팔 관절)
        }
        if (jointName.includes('hip') || jointName.includes('knee') || jointName.includes('ankle')) {
          return '#ff0000' // 빨강 (다리 관절)
        }
        return '#00ff00' // 초록 (기타)
      }
      
      // 키포인트 그리기 (실제 관절 위치에 정확히 오버레이)
      pose.keypoints.forEach((keypoint) => {
        if (keypoint.score && keypoint.score > 0.3) {
          // MoveNet 좌표는 정규화된 값(0-1)이므로 비디오 크기로 변환 후 스케일 적용
          const normalizedX = keypoint.x
          const normalizedY = keypoint.y
          
          // 정규화된 값인지 픽셀 값인지 확인 (1보다 크면 픽셀 값)
          const isNormalized = normalizedX <= 1.0 && normalizedY <= 1.0
          
          const x = isNormalized 
            ? normalizedX * videoWidth * scaleX 
            : normalizedX * scaleX
          const y = isNormalized 
            ? normalizedY * videoHeight * scaleY 
            : normalizedY * scaleY
          
          // 주요 관절인지 확인
          const isMajorJoint = keypoint.name && majorJoints.includes(keypoint.name)
          const radius = isMajorJoint ? 12 : 8 // 주요 관절은 더 크게
          const fillColor = getJointColor(keypoint.name) // 관절별 색상
          
          // 키포인트 원 그리기 (더 명확하게)
          ctx.beginPath()
          ctx.arc(x, y, radius, 0, 2 * Math.PI)
          ctx.fillStyle = fillColor
          ctx.fill()
          
          // 키포인트 테두리 (더 두껍게)
          ctx.beginPath()
          ctx.arc(x, y, radius, 0, 2 * Math.PI)
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = isMajorJoint ? 4 : 3
          ctx.stroke()
          
          // 내부 원 (더 명확한 표시)
          ctx.beginPath()
          ctx.arc(x, y, radius * 0.6, 0, 2 * Math.PI)
          ctx.fillStyle = '#ffffff'
          ctx.fill()
        }
      })

      // MediaPipe 전체 스켈레톤 연결선 (완전한 관절 라인)
      const connections = [
        // 얼굴
        ['left_eye', 'right_eye'],
        ['left_eye', 'nose'],
        ['right_eye', 'nose'],
        ['left_ear', 'left_eye'],
        ['right_ear', 'right_eye'],
        // 상체
        ['nose', 'left_shoulder'],
        ['nose', 'right_shoulder'],
        ['left_shoulder', 'right_shoulder'],
        // 왼쪽 팔
        ['left_shoulder', 'left_elbow'],
        ['left_elbow', 'left_wrist'],
        // 오른쪽 팔
        ['right_shoulder', 'right_elbow'],
        ['right_elbow', 'right_wrist'],
        // 몸통
        ['left_shoulder', 'left_hip'],
        ['right_shoulder', 'right_hip'],
        ['left_hip', 'right_hip'],
        // 왼쪽 다리
        ['left_hip', 'left_knee'],
        ['left_knee', 'left_ankle'],
        // 오른쪽 다리
        ['right_hip', 'right_knee'],
        ['right_knee', 'right_ankle'],
      ]

      connections.forEach(([startName, endName]) => {
        const start = pose.keypoints.find((kp) => kp.name === startName)
        const end = pose.keypoints.find((kp) => kp.name === endName)

        if (start && end && start.score && end.score && start.score > 0.3 && end.score > 0.3) {
          // MoveNet 좌표 변환 (정규화된 값인지 확인)
          const isStartNormalized = start.x <= 1.0 && start.y <= 1.0
          const isEndNormalized = end.x <= 1.0 && end.y <= 1.0
          
          const startX = isStartNormalized 
            ? start.x * videoWidth * scaleX 
            : start.x * scaleX
          const startY = isStartNormalized 
            ? start.y * videoHeight * scaleY 
            : start.y * scaleY
          const endX = isEndNormalized 
            ? end.x * videoWidth * scaleX 
            : end.x * scaleX
          const endY = isEndNormalized 
            ? end.y * videoHeight * scaleY 
            : end.y * scaleY

          // 연결선 색상 (관절 타입에 따라)
          let lineColor = '#00ff00' // 기본 초록
          if (startName.includes('shoulder') || startName.includes('elbow') || startName.includes('wrist') ||
              endName.includes('shoulder') || endName.includes('elbow') || endName.includes('wrist')) {
            lineColor = '#ff00ff' // 핑크 (팔)
          } else if (startName.includes('hip') || startName.includes('knee') || startName.includes('ankle') ||
                     endName.includes('hip') || endName.includes('knee') || endName.includes('ankle')) {
            lineColor = '#ff0000' // 빨강 (다리)
          }

          // 연결선 그리기 (더 두껍고 명확하게)
          ctx.beginPath()
          ctx.moveTo(startX, startY)
          ctx.lineTo(endX, endY)
          ctx.strokeStyle = lineColor
          ctx.lineWidth = 4
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.stroke()
        }
      })
    })
  }, [poses, videoWidth, videoHeight, canvasWidth, canvasHeight])

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 pointer-events-none"
      style={{
        width: canvasWidth || videoWidth,
        height: canvasHeight || videoHeight,
      }}
    />
  )
}

export default PoseCanvas

