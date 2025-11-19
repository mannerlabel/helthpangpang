import * as poseDetection from '@tensorflow-models/pose-detection'
import '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-webgl'
import * as tf from '@tensorflow/tfjs'
import { Pose } from '@/types'

class PoseDetectionService {
  private detector: poseDetection.PoseDetector | null = null
  private isInitialized = false

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // TensorFlow.js 백엔드 초기화
      await tf.ready()

      // MoveNet 모델 사용 (빠르고 정확함)
      const model = poseDetection.SupportedModels.MoveNet
      
      // MoveNet 모델 타입 직접 지정 (올바른 형식)
      const detectorConfig = {
        modelType: 'SinglePose.Lightning' as const, // 'SinglePose.Lightning', 'SinglePose.Thunder', 'MultiPose.Lightning'
        enableSmoothing: true,
        minPoseScore: 0.2, // 더 낮은 임계값으로 더 많은 자세 감지
      }
      
      console.log('✅ 자세 인식 초기화 시작 (MoveNet Lightning)', detectorConfig)

      this.detector = await poseDetection.createDetector(model, detectorConfig)
      this.isInitialized = true
      console.log('✅ 자세 인식 초기화 완료 (MoveNet Lightning)')
    } catch (error) {
      throw new Error(`자세 인식 초기화 실패: ${error}`)
    }
  }

  async detectPose(video: HTMLVideoElement): Promise<Pose[]> {
    if (!this.detector || !this.isInitialized) {
      // 초기화가 완료되지 않았으면 빈 배열 반환 (오류 대신)
      return []
    }

    try {
      const poses = await this.detector.estimatePoses(video)
      return poses.map((pose) => ({
        keypoints: pose.keypoints.map((kp) => ({
          x: kp.x,
          y: kp.y,
          z: kp.z,
          score: kp.score,
          name: kp.name,
        })),
        score: pose.score,
        box: pose.box
          ? {
              xMin: pose.box.xMin,
              yMin: pose.box.yMin,
              xMax: pose.box.xMax,
              yMax: pose.box.yMax,
              width: pose.box.width,
              height: pose.box.height,
            }
          : undefined,
      }))
    } catch (error) {
      throw new Error(`자세 인식 실패: ${error}`)
    }
  }

  dispose(): void {
    if (this.detector) {
      this.detector.dispose()
      this.detector = null
      this.isInitialized = false
    }
  }

  getInitialized(): boolean {
    return this.isInitialized
  }
}

export const poseDetectionService = new PoseDetectionService()

