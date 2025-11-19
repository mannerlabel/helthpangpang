import { useRef } from 'react'
import { useCamera } from '@/hooks/useCamera'
import { CameraConfig } from '@/types/camera'

interface CameraViewProps {
  width?: number
  height?: number
  facingMode?: 'user' | 'environment'
  onStreamReady?: (stream: MediaStream) => void
}

const CameraView = ({
  width = 1280,
  height = 720,
  facingMode = 'user',
  onStreamReady,
}: CameraViewProps) => {
  const { state, videoRef, start, stop, switchCamera } = useCamera({
    width,
    height,
    facingMode,
  })

  const handleStart = async () => {
    await start()
    if (state.stream && onStreamReady) {
      onStreamReady(state.stream)
    }
  }

  return (
    <div className="relative">
      <video
        ref={videoRef}
        width={width}
        height={height}
        className="rounded-lg"
        autoPlay
        playsInline
        muted
      />
      <div className="absolute top-4 right-4 flex gap-2">
        {state.isActive && (
          <>
            <button
              onClick={switchCamera}
              className="px-4 py-2 bg-primary-500 rounded-lg hover:bg-primary-600"
            >
              카메라 전환
            </button>
            <button
              onClick={stop}
              className="px-4 py-2 bg-red-500 rounded-lg hover:bg-red-600"
            >
              중지
            </button>
          </>
        )}
        {!state.isActive && (
          <button
            onClick={handleStart}
            className="px-4 py-2 bg-green-500 rounded-lg hover:bg-green-600"
          >
            시작
          </button>
        )}
      </div>
      {state.error && (
        <div className="absolute bottom-4 left-4 bg-red-500 text-white px-4 py-2 rounded">
          {state.error}
        </div>
      )}
    </div>
  )
}

export default CameraView

