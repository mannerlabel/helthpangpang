import { useEffect, useState } from 'react'
import { Pose } from '@/types'

interface DebugInfoProps {
  poses: Pose[]
  isEnabled?: boolean
}

const DebugInfo = ({ poses, isEnabled = false }: DebugInfoProps) => {
  const [keypointCount, setKeypointCount] = useState(0)

  useEffect(() => {
    if (poses.length > 0) {
      setKeypointCount(poses[0].keypoints?.length || 0)
    }
  }, [poses])

  if (!isEnabled) return null

  return (
    <div className="absolute bottom-20 left-4 bg-black/80 text-white text-xs p-2 rounded z-50">
      <div>감지된 자세: {poses.length}</div>
      <div>키포인트: {keypointCount}</div>
      {poses.length > 0 && poses[0].keypoints && (
        <div className="mt-1">
          {['left_hip', 'right_hip', 'left_knee', 'right_knee'].map((name) => {
            const kp = poses[0].keypoints.find((k) => k.name === name)
            return (
              <div key={name} className="text-xs">
                {name}: {kp ? `✓ (${(kp.score || 0).toFixed(2)})` : '✗'}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default DebugInfo

