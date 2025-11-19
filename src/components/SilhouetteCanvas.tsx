import { useEffect, useRef } from 'react'
import { Pose } from '@/types'
import { silhouetteService } from '@/services/silhouetteService'

interface SilhouetteCanvasProps {
  poses: Pose[]
  poseScore: number
  videoWidth: number
  videoHeight: number
}

const SilhouetteCanvas = ({
  poses,
  poseScore,
  videoWidth,
  videoHeight,
}: SilhouetteCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !poses.length) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = videoWidth
    canvas.height = videoHeight

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const pose = poses[0]
    const config = silhouetteService.getSilhouetteConfig(pose, poseScore)
    silhouetteService.drawSilhouette(ctx, pose, config)
  }, [poses, poseScore, videoWidth, videoHeight])

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 pointer-events-none"
      style={{
        width: videoWidth,
        height: videoHeight,
      }}
    />
  )
}

export default SilhouetteCanvas

