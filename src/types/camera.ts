export interface CameraConfig {
  width: number
  height: number
  facingMode: 'user' | 'environment'
  frameRate?: number
}

export interface CameraState {
  isActive: boolean
  stream: MediaStream | null
  error: string | null
}

