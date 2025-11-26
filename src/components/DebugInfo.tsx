import { useEffect, useState } from 'react'
import { Pose } from '@/types'

interface DebugInfoProps {
  poses: Pose[]
  isEnabled?: boolean
  isCrewMode?: boolean // 크루 모드 여부
  meetingViewHeight?: number // 참여자 섹션 높이
}

const DebugInfo = ({ poses, isEnabled = false, isCrewMode = false, meetingViewHeight = 0 }: DebugInfoProps) => {
  const [keypointCount, setKeypointCount] = useState(0)

  useEffect(() => {
    if (poses.length > 0) {
      setKeypointCount(poses[0].keypoints?.length || 0)
    }
  }, [poses])

  if (!isEnabled) return null

  // 크루 모드일 때는 참여자 섹션 위에 배치 (참여자 섹션을 가리지 않도록)
  const bottomPosition = isCrewMode 
    ? `calc(${meetingViewHeight + 100}px + env(safe-area-inset-bottom, 0px))` 
    : '5rem' // 단일 모드일 때는 기존 위치

  return (
    <div 
      className="absolute left-4 bg-black/80 text-white text-xs p-2 rounded z-10"
      style={{ 
        bottom: bottomPosition,
        pointerEvents: 'none', // 클릭 이벤트 차단 (참여자 영상 클릭 가능하도록)
      }}
    >
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

