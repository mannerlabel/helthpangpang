import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { countService } from '@/services/countService'
import { analyzePose } from '@/utils/poseAnalyzer'
import { createCountEffect, createPoseScoreEffect } from '@/utils/effects'
import EffectOverlay from '@/components/EffectOverlay'
import PoseCanvas from '@/components/PoseCanvas'
import { poseDetectionService } from '@/services/poseDetectionService'
import { ExerciseConfig, Effect, ExerciseType } from '@/types'
import { EXERCISE_TYPE_NAMES } from '@/constants/exerciseTypes'
import { ExerciseVideo, ExerciseVideoPose } from '@/services/databaseService'
import { Pose, PoseKeypoint } from '@/types'
import { calculateAngle, findKeypoint } from '@/utils/poseUtils'

const ExerciseVideoTestPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { video, config } = (location.state as {
    video: ExerciseVideo
    config?: ExerciseConfig
  }) || {}

  if (!video) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl mb-4">영상 데이터가 없습니다.</p>
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            돌아가기
          </button>
        </div>
      </div>
    )
  }

  // 운동 설정 (영상 데이터 기반 또는 기본값)
  const exerciseConfig: ExerciseConfig = config || {
    type: 'squat', // 기본값, 실제로는 영상 데이터에서 추론 가능
    sets: 1,
    reps: video.totalPoses || 10,
    restTime: 10,
  }

  const [isStarted, setIsStarted] = useState(false)
  const [currentSet, setCurrentSet] = useState(1)
  const [currentCount, setCurrentCount] = useState(0)
  const [poseScore, setPoseScore] = useState(0)
  const [lastCountScore, setLastCountScore] = useState<number | null>(null)
  const [currentFeedback, setCurrentFeedback] = useState<string>('')
  const [effects, setEffects] = useState<Effect[]>([])
  const [bestScore, setBestScore] = useState<{ score: number; image: string; angles?: { [key: string]: number } } | null>(null)
  const [worstScore, setWorstScore] = useState<{ score: number; image: string } | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0)
  const [testResults, setTestResults] = useState<{
    totalPoses: number
    averageScore: number
    bestScore: number
    worstScore: number
    analyzedPoses: Array<{
      index: number
      score: number
      description: string
      timestamp: number
    }>
  } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const poseIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const poseDetectionIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [currentPoses, setCurrentPoses] = useState<Pose[]>([]) // 실시간 포즈 데이터
  const [targetPose, setTargetPose] = useState<Pose | null>(null) // 비교할 목표 포즈 (저장된 포즈)
  const targetPoseRef = useRef<Pose | null>(null) // 목표 포즈 참조 (비동기 상태 업데이트 문제 해결)
  const [currentPoseAngles, setCurrentPoseAngles] = useState<{ [key: string]: number }>({}) // 현재 포즈 각도
  const [isPoseDetectionReady, setIsPoseDetectionReady] = useState(false) // 포즈 인식 서비스 초기화 완료 여부
  const targetPoseImageRef = useRef<HTMLImageElement>(null) // 목표 포즈 이미지 참조
  const [targetPoseImageSize, setTargetPoseImageSize] = useState<{ width: number; height: number } | null>(null) // 목표 포즈 이미지 크기

  // 영상 포즈 데이터를 Pose 형식으로 변환
  const convertVideoPoseToPose = (videoPose: ExerciseVideoPose): Pose => {
    return {
      keypoints: videoPose.keypoints.map(kp => ({
        x: kp.x,
        y: kp.y,
        z: kp.z,
        score: kp.score,
        name: kp.name,
      })),
      score: 1.0, // 영상 데이터는 신뢰도가 높다고 가정
    }
  }

  // 포즈 인식 초기화
  useEffect(() => {
    const initPoseDetection = async () => {
      try {
        console.log('🔄 포즈 인식 초기화 시작...')
        await poseDetectionService.initialize()
        setIsPoseDetectionReady(true)
        console.log('✅ 포즈 인식 초기화 완료')
      } catch (error) {
        console.error('❌ 포즈 인식 초기화 실패:', error)
        setIsPoseDetectionReady(false)
      }
    }
    initPoseDetection()
  }, [])

  // 카메라 시작
  const startCamera = async () => {
    try {
      // 비디오 요소가 DOM에 있는지 확인
      if (!videoRef.current) {
        throw new Error('비디오 엘리먼트가 DOM에 없습니다.')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      })
      streamRef.current = stream
      
      if (!videoRef.current) {
        // 스트림을 얻은 후에도 비디오 요소가 없으면 스트림 정리
        stream.getTracks().forEach(track => track.stop())
        throw new Error('비디오 엘리먼트가 DOM에서 제거되었습니다.')
      }

      // 기존 srcObject가 있으면 먼저 정리
      if (videoRef.current.srcObject) {
        const oldStream = videoRef.current.srcObject as MediaStream
        oldStream.getTracks().forEach(track => track.stop())
      }
      
      videoRef.current.srcObject = stream
      // 비디오 요소가 화면에 표시되도록 강제
      videoRef.current.load()
      
      // 비디오가 준비될 때까지 기다리기 (타임아웃 추가)
      await new Promise<void>((resolve, reject) => {
        if (!videoRef.current) {
          reject(new Error('비디오 엘리먼트가 없습니다.'))
          return
        }
        
        const video = videoRef.current
        let resolved = false
        
        // 타임아웃 설정 (5초)
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true
            video.removeEventListener('loadedmetadata', onLoadedMetadata)
            video.removeEventListener('error', onError)
            video.removeEventListener('playing', onPlaying)
            console.warn('⚠️ 비디오 준비 타임아웃, 계속 진행')
            resolve() // 타임아웃이어도 계속 진행
          }
        }, 5000)
        
        const onLoadedMetadata = () => {
          if (resolved) return
          clearTimeout(timeoutId)
          video.removeEventListener('loadedmetadata', onLoadedMetadata)
          video.removeEventListener('error', onError)
          video.removeEventListener('playing', onPlaying)
          
          // 비디오 재생 시도
          video.play()
            .then(() => {
              // 재생이 시작될 때까지 추가 대기
              setTimeout(() => {
                if (!resolved) {
                  resolved = true
                  console.log('✅ 카메라 시작 완료:', {
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight,
                    readyState: video.readyState
                  })
                  resolve()
                }
              }, 300)
            })
            .catch((playError) => {
              console.warn('⚠️ 비디오 재생 실패, 계속 진행:', playError)
              // 재생 실패해도 메타데이터가 로드되었으면 계속 진행
              if (!resolved) {
                resolved = true
                resolve()
              }
            })
        }
        
        const onPlaying = () => {
          if (resolved) return
          clearTimeout(timeoutId)
          video.removeEventListener('loadedmetadata', onLoadedMetadata)
          video.removeEventListener('error', onError)
          video.removeEventListener('playing', onPlaying)
          if (!resolved) {
            resolved = true
            console.log('✅ 카메라 재생 시작:', {
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              readyState: video.readyState
            })
            resolve()
          }
        }
        
        const onError = (e: Event) => {
          clearTimeout(timeoutId)
          video.removeEventListener('loadedmetadata', onLoadedMetadata)
          video.removeEventListener('error', onError)
          video.removeEventListener('playing', onPlaying)
          if (!resolved) {
            resolved = true
            console.error('❌ 비디오 로드 에러:', e)
            reject(new Error('비디오 로드 실패'))
          }
        }
        
        video.addEventListener('loadedmetadata', onLoadedMetadata)
        video.addEventListener('playing', onPlaying)
        video.addEventListener('error', onError)
        
        // 이미 로드되어 있으면 즉시 처리
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          clearTimeout(timeoutId)
          video.play()
            .then(() => {
              setTimeout(() => {
                if (!resolved) {
                  resolved = true
                  resolve()
                }
              }, 300)
            })
            .catch(() => {
              if (!resolved) {
                resolved = true
                resolve()
              }
            })
        }
      })
    } catch (error) {
      console.error('카메라 접근 실패:', error)
      alert('카메라에 접근할 수 없습니다.')
      throw error
    }
  }

  // 카메라 중지
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  // 포즈 유사도 계산 (저장된 포즈와 현재 포즈 비교)
  const calculatePoseSimilarity = (currentPose: Pose, targetPose: Pose): number => {
    if (!currentPose.keypoints || !targetPose.keypoints) return 0
    
    const currentKeypoints = currentPose.keypoints
    const targetKeypoints = targetPose.keypoints
    
    // 주요 관절 목록
    const majorJoints = [
      'left_shoulder', 'right_shoulder',
      'left_elbow', 'right_elbow',
      'left_wrist', 'right_wrist',
      'left_hip', 'right_hip',
      'left_knee', 'right_knee',
      'left_ankle', 'right_ankle',
    ]
    
    let totalScore = 0
    let validJoints = 0
    
    // 각 주요 관절의 위치 차이 계산
    majorJoints.forEach(jointName => {
      const currentJoint = currentKeypoints.find(kp => kp.name === jointName && kp.score && kp.score > 0.3)
      const targetJoint = targetKeypoints.find(kp => kp.name === jointName && kp.score && kp.score > 0.3)
      
      if (currentJoint && targetJoint) {
        // 정규화된 좌표로 변환 (비디오 크기에 관계없이 비교)
        const currentX = currentJoint.x <= 1.0 ? currentJoint.x : currentJoint.x / 640
        const currentY = currentJoint.y <= 1.0 ? currentJoint.y : currentJoint.y / 480
        const targetX = targetJoint.x <= 1.0 ? targetJoint.x : targetJoint.x / 640
        const targetY = targetJoint.y <= 1.0 ? targetJoint.y : targetJoint.y / 480
        
        // 유클리드 거리 계산
        const distance = Math.sqrt(
          Math.pow(currentX - targetX, 2) + Math.pow(currentY - targetY, 2)
        )
        
        // 거리를 점수로 변환 (0.1 이내면 100점, 0.2 이내면 80점, ...)
        const jointScore = Math.max(0, 100 - (distance * 500))
        totalScore += jointScore
        validJoints++
      }
    })
    
    if (validJoints === 0) return 0
    return totalScore / validJoints
  }

  // 현재 포즈의 각도 계산
  const calculateCurrentPoseAngles = (pose: Pose): { [key: string]: number } => {
    const keypoints = pose.keypoints
    const angles: { [key: string]: number } = {}

    // 왼쪽 팔꿈치 각도
    const leftShoulder = findKeypoint(keypoints, 'left_shoulder')
    const leftElbow = findKeypoint(keypoints, 'left_elbow')
    const leftWrist = findKeypoint(keypoints, 'left_wrist')
    if (leftShoulder && leftElbow && leftWrist) {
      angles.left_elbow = Math.round(calculateAngle(
        { x: leftShoulder.x, y: leftShoulder.y },
        { x: leftElbow.x, y: leftElbow.y },
        { x: leftWrist.x, y: leftWrist.y }
      ))
    }

    // 오른쪽 팔꿈치 각도
    const rightShoulder = findKeypoint(keypoints, 'right_shoulder')
    const rightElbow = findKeypoint(keypoints, 'right_elbow')
    const rightWrist = findKeypoint(keypoints, 'right_wrist')
    if (rightShoulder && rightElbow && rightWrist) {
      angles.right_elbow = Math.round(calculateAngle(
        { x: rightShoulder.x, y: rightShoulder.y },
        { x: rightElbow.x, y: rightElbow.y },
        { x: rightWrist.x, y: rightWrist.y }
      ))
    }

    // 왼쪽 무릎 각도
    const leftHip = findKeypoint(keypoints, 'left_hip')
    const leftKnee = findKeypoint(keypoints, 'left_knee')
    const leftAnkle = findKeypoint(keypoints, 'left_ankle')
    if (leftHip && leftKnee && leftAnkle) {
      angles.left_knee = Math.round(calculateAngle(
        { x: leftHip.x, y: leftHip.y },
        { x: leftKnee.x, y: leftKnee.y },
        { x: leftAnkle.x, y: leftAnkle.y }
      ))
    }

    // 오른쪽 무릎 각도
    const rightHip = findKeypoint(keypoints, 'right_hip')
    const rightKnee = findKeypoint(keypoints, 'right_knee')
    const rightAnkle = findKeypoint(keypoints, 'right_ankle')
    if (rightHip && rightKnee && rightAnkle) {
      angles.right_knee = Math.round(calculateAngle(
        { x: rightHip.x, y: rightHip.y },
        { x: rightKnee.x, y: rightKnee.y },
        { x: rightAnkle.x, y: rightAnkle.y }
      ))
    }

    // 어깨 각도
    if (leftShoulder && rightShoulder && leftHip && rightHip) {
      const shoulderAngle = Math.round(calculateAngle(
        { x: leftHip.x, y: leftHip.y },
        { x: leftShoulder.x, y: leftShoulder.y },
        { x: rightShoulder.x, y: rightShoulder.y }
      ))
      angles.shoulder = shoulderAngle
    }

    // 목 각도 (어깨와 코 기준)
    const nose = findKeypoint(keypoints, 'nose')
    if (leftShoulder && rightShoulder && nose) {
      const neckAngle = Math.round(calculateAngle(
        { x: leftShoulder.x, y: leftShoulder.y },
        { x: nose.x, y: nose.y },
        { x: rightShoulder.x, y: rightShoulder.y }
      ))
      angles.neck = neckAngle
    }

    // 손목 각도
    if (leftElbow && leftWrist && leftShoulder) {
      const leftWristAngle = Math.round(calculateAngle(
        { x: leftShoulder.x, y: leftShoulder.y },
        { x: leftElbow.x, y: leftElbow.y },
        { x: leftWrist.x, y: leftWrist.y }
      ))
      angles.left_wrist = leftWristAngle
    }
    if (rightElbow && rightWrist && rightShoulder) {
      const rightWristAngle = Math.round(calculateAngle(
        { x: rightShoulder.x, y: rightShoulder.y },
        { x: rightElbow.x, y: rightElbow.y },
        { x: rightWrist.x, y: rightWrist.y }
      ))
      angles.right_wrist = rightWristAngle
    }

    // 발목 각도
    if (leftKnee && leftAnkle && leftHip) {
      const leftAnkleAngle = Math.round(calculateAngle(
        { x: leftHip.x, y: leftHip.y },
        { x: leftKnee.x, y: leftKnee.y },
        { x: leftAnkle.x, y: leftAnkle.y }
      ))
      angles.left_ankle = leftAnkleAngle
    }
    if (rightKnee && rightAnkle && rightHip) {
      const rightAnkleAngle = Math.round(calculateAngle(
        { x: rightHip.x, y: rightHip.y },
        { x: rightKnee.x, y: rightKnee.y },
        { x: rightAnkle.x, y: rightAnkle.y }
      ))
      angles.right_ankle = rightAnkleAngle
    }

    return angles
  }

  // 실시간 포즈 인식
  const detectPoseRealtime = useCallback(async () => {
    if (!videoRef.current) {
      console.warn('⚠️ videoRef.current가 없습니다.')
      return
    }
    
    if (!poseDetectionService.getInitialized()) {
      // 초기화가 완료되지 않았으면 재시도
      if (!isPoseDetectionReady) {
        console.warn('⚠️ 포즈 인식 서비스가 초기화되지 않았습니다. 재시도 중...')
        // 초기화 재시도
        poseDetectionService.initialize().then(() => {
          setIsPoseDetectionReady(true)
          console.log('✅ 포즈 인식 초기화 재시도 완료')
        }).catch((error) => {
          console.error('❌ 포즈 인식 초기화 재시도 실패:', error)
        })
      }
      return
    }
    
    // 비디오가 준비되지 않았으면 스킵 (readyState >= 2: HAVE_CURRENT_DATA 이상)
    if (!videoRef.current || videoRef.current.readyState < 2) {
      // readyState가 0이면 카메라가 아직 시작되지 않은 상태이므로 조용히 스킵
      // readyState가 1이면 로딩 중이므로 조용히 스킵
      return
    }
    
    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      // 첫 몇 번만 경고 출력
      if (Math.random() < 0.01) {
        console.warn('⚠️ 비디오 크기가 0입니다.')
      }
      return
    }

    try {
      const poses = await poseDetectionService.detectPose(videoRef.current)
      
      if (poses.length > 0) {
        setCurrentPoses(poses)
        
        // 목표 포즈와 비교하여 점수 계산 (ref를 사용하여 최신 값 보장)
        const currentTargetPose = targetPoseRef.current || targetPose
        if (currentTargetPose) {
          const currentPose = poses[0]
          
          // 현재 포즈 각도 계산
          const angles = calculateCurrentPoseAngles(currentPose)
          setCurrentPoseAngles(angles)
          
          const similarityScore = calculatePoseSimilarity(currentPose, currentTargetPose)
          setPoseScore(similarityScore)
          
          // 디버깅: 점수 계산 로그 (처음 몇 번만)
          if (Math.random() < 0.1) {
            console.log('📊 포즈 점수 계산:', {
              similarityScore: Math.round(similarityScore),
              hasTargetPose: !!currentTargetPose,
              hasCurrentPose: !!currentPose,
              posesCount: poses.length,
              targetPoseKeypoints: currentTargetPose.keypoints?.length || 0,
              currentPoseKeypoints: currentPose.keypoints?.length || 0
            })
          }
          
          // 최고/최저 점수 업데이트 (최고 점수일 때 각도도 함께 저장)
          setBestScore(prev => {
            if (!prev || similarityScore > prev.score) {
              return { score: similarityScore, image: '', angles: { ...angles } }
            }
            return prev
          })
          setWorstScore(prev => {
            if (!prev || similarityScore < prev.score) {
              return { score: similarityScore, image: '' }
            }
            return prev
          })
          
          // 피드백 생성
          if (similarityScore >= 90) {
            setCurrentFeedback('완벽한 자세입니다!')
          } else if (similarityScore >= 80) {
            setCurrentFeedback('좋은 자세입니다.')
          } else if (similarityScore >= 70) {
            setCurrentFeedback('자세를 조금 더 개선해보세요.')
          } else {
            setCurrentFeedback('자세를 다시 확인해주세요.')
          }
          
          // 점수 효과
          const scoreEffects = createPoseScoreEffect(similarityScore)
          setEffects(prev => [...prev, ...scoreEffects])
        }
      } else {
        // 포즈가 감지되지 않았을 때도 상태 업데이트
        setCurrentPoses([])
        // 디버깅: 포즈가 감지되지 않을 때 (처음 몇 번만)
        if (Math.random() < 0.05) {
          console.warn('⚠️ 포즈가 감지되지 않았습니다.')
        }
      }
    } catch (error) {
      // 에러는 로그만 남기고 무시
      if (error instanceof Error && !error.message.includes('back resource')) {
        console.error('포즈 인식 실패:', error)
      }
    }
  }, [targetPose, isPoseDetectionReady])

  // 영상 포즈 데이터를 이미지로 표시 (테스트 시작 전)
  useEffect(() => {
    if (isStarted || !canvasRef.current || !video.poseData || video.poseData.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const currentPose = video.poseData[0] // 첫 번째 포즈를 표시
    if (!currentPose || !currentPose.image) return

    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
    }
    img.src = currentPose.image
  }, [isStarted, video.poseData])

  // 운동 시작
  const handleStart = async () => {
    try {
      // 포즈 인식 서비스가 초기화되지 않았으면 초기화 시도
      if (!poseDetectionService.getInitialized()) {
        console.log('🔄 포즈 인식 서비스 초기화 중...')
        try {
          await poseDetectionService.initialize()
          setIsPoseDetectionReady(true)
          console.log('✅ 포즈 인식 초기화 완료')
        } catch (error) {
          console.error('❌ 포즈 인식 초기화 실패:', error)
          alert('포즈 인식 서비스를 초기화할 수 없습니다. 페이지를 새로고침해주세요.')
          return
        }
      }
      
      // 목표 포즈 설정 (저장된 첫 번째 포즈 또는 선택된 포즈)
      if (video.poseData && video.poseData.length > 0) {
        const targetVideoPose = video.poseData[0] // 첫 번째 포즈를 목표로 설정
        const convertedPose = convertVideoPoseToPose(targetVideoPose)
        setTargetPose(convertedPose)
        targetPoseRef.current = convertedPose // ref에도 저장 (즉시 사용 가능)
        setCurrentPoseIndex(0)
        console.log('✅ 목표 포즈 설정 완료:', {
          hasPoseData: !!video.poseData,
          poseDataLength: video.poseData.length,
          hasKeypoints: !!convertedPose.keypoints,
          keypointsCount: convertedPose.keypoints?.length || 0
        })
      } else {
        console.warn('⚠️ 포즈 데이터가 없습니다.')
        targetPoseRef.current = null
      }
      
      // 카메라 시작
      await startCamera()
      
      // startCamera()가 완료된 후 비디오 상태 확인
      if (!videoRef.current) {
        throw new Error('비디오 엘리먼트를 찾을 수 없습니다.')
      }

      // 비디오가 완전히 준비될 때까지 확인 (추가 확인)
      let retryCount = 0
      const maxRetries = 20 // 최대 2초 대기 (100ms * 20)
      while (retryCount < maxRetries) {
        if (videoRef.current && 
            videoRef.current.readyState >= 2 && 
            videoRef.current.videoWidth > 0 && 
            videoRef.current.videoHeight > 0) {
          console.log('✅ 비디오 준비 완료:', {
            readyState: videoRef.current.readyState,
            size: `${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`
          })
          break
        }
        await new Promise(resolve => setTimeout(resolve, 100))
        retryCount++
      }
      
      if (retryCount >= maxRetries) {
        console.warn('⚠️ 비디오 준비 시간 초과, 계속 진행', {
          hasVideoRef: !!videoRef.current,
          readyState: videoRef.current?.readyState,
          videoWidth: videoRef.current?.videoWidth,
          videoHeight: videoRef.current?.videoHeight
        })
        // 비디오가 준비되지 않았어도 화면은 표시되도록 함
      }
      
      // 비디오가 준비된 후에만 시작 상태로 변경
      // 이렇게 하면 화면이 제대로 표시됨
      setIsStarted(true)
      setCurrentCount(0)
      setTotalCount(0)
      setPoseScore(0)
      setBestScore(null)
      setWorstScore(null)
      setTestResults(null)
      setEffects([])
      setCurrentPoses([])

      // 실시간 포즈 인식 시작 (30fps)
      poseDetectionIntervalRef.current = setInterval(() => {
        detectPoseRealtime()
      }, 33) // 약 30fps
      
      console.log('✅ 테스트 시작 완료', {
        poseDetectionReady: isPoseDetectionReady,
        videoReady: videoRef.current?.readyState,
        videoSize: videoRef.current ? `${videoRef.current.videoWidth}x${videoRef.current.videoHeight}` : 'N/A',
        hasTargetPose: !!targetPose,
        intervalId: poseDetectionIntervalRef.current
      })
      
      // 즉시 한 번 포즈 인식 시도 (디버깅)
      setTimeout(() => {
        console.log('🔍 첫 포즈 인식 시도...')
        detectPoseRealtime()
      }, 500)
    } catch (error) {
      console.error('테스트 시작 실패:', error)
      alert('테스트를 시작할 수 없습니다.')
      setIsStarted(false)
    }
  }

  // 운동 중지
  const handleStop = () => {
    setIsStarted(false)
    
    // 모든 인터벌 정리
    if (poseIntervalRef.current) {
      clearInterval(poseIntervalRef.current)
      poseIntervalRef.current = null
    }
    if (poseDetectionIntervalRef.current) {
      clearInterval(poseDetectionIntervalRef.current)
      poseDetectionIntervalRef.current = null
    }
    
    // 카메라 중지
    stopCamera()
    
    // 최종 결과 계산
    if (bestScore && worstScore) {
      const analyzedPoses: Array<{
        index: number
        score: number
        description: string
        timestamp: number
      }> = []
      
      // 테스트 결과 생성
      setTestResults({
        totalPoses: totalCount,
        averageScore: (bestScore.score + worstScore.score) / 2,
        bestScore: bestScore.score,
        worstScore: worstScore.score,
        analyzedPoses,
      })
    }
  }

  // 정리
  useEffect(() => {
    return () => {
      if (poseIntervalRef.current) {
        clearInterval(poseIntervalRef.current)
      }
      if (poseDetectionIntervalRef.current) {
        clearInterval(poseDetectionIntervalRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      stopCamera()
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* 헤더 */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">🧪 운동 영상 테스트</h1>
            <p className="text-gray-400">{video.title}</p>
            {video.description && (
              <p className="text-gray-500 text-sm mt-2">{video.description}</p>
            )}
          </div>

          {/* 테스트 결과 요약 */}
          {testResults && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/90 rounded-2xl p-6 mb-6"
            >
              <h2 className="text-2xl font-bold text-white mb-4">📊 테스트 결과</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-gray-400 text-sm mb-1">총 포즈 수</div>
                  <div className="text-2xl font-bold text-white">{testResults.totalPoses}</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-gray-400 text-sm mb-1">평균 점수</div>
                  <div className="text-2xl font-bold text-green-400">{Math.round(testResults.averageScore)}</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-gray-400 text-sm mb-1">최고 점수</div>
                  <div className="text-2xl font-bold text-blue-400">{Math.round(testResults.bestScore)}</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-gray-400 text-sm mb-1">최저 점수</div>
                  <div className="text-2xl font-bold text-red-400">{Math.round(testResults.worstScore)}</div>
                </div>
              </div>
            </motion.div>
          )}

          <div className="space-y-6">
            {/* 포즈 시각화 */}
            <div className="bg-gray-800/90 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">포즈 시각화</h2>
              
              {/* 실시간 영상과 목표 포즈 이미지를 나란히 표시 (크게) */}
              {/* 모바일에서는 세로로 배치, 데스크톱에서는 가로로 배치 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
                {/* 실시간 영상 */}
                <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3', minHeight: '250px' }}>
                  {/* 비디오 요소는 항상 렌더링 (DOM에 존재해야 함) */}
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                    autoPlay={isStarted}
                    style={{ display: isStarted ? 'block' : 'none' }}
                  />
                  
                  {/* 비디오가 준비되지 않았을 때 표시 */}
                  {isStarted && videoRef.current && (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                      <div className="text-white text-center">
                        <p className="text-sm">비디오 로딩 중...</p>
                        <p className="text-xs text-gray-400 mt-1">readyState: {videoRef.current.readyState}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* 포즈 캔버스 (시작된 경우에만 표시) */}
                  {isStarted && videoRef.current && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0 && (
                    <PoseCanvas
                      poses={currentPoses}
                      videoWidth={videoRef.current.videoWidth}
                      videoHeight={videoRef.current.videoHeight}
                      canvasWidth={videoRef.current.clientWidth}
                      canvasHeight={videoRef.current.clientHeight}
                    />
                  )}
                  
                  {/* 실시간 점수 오버레이 (시작된 경우에만 표시) */}
                  {isStarted && (
                    <>
                      <div className="absolute top-4 right-4 bg-black/70 rounded-lg px-3 py-2">
                        <div className="text-white text-sm mb-1">실시간 점수</div>
                        <div className={`text-3xl font-bold ${
                          poseScore >= 90 ? 'text-green-400' :
                          poseScore >= 80 ? 'text-yellow-400' :
                          poseScore >= 70 ? 'text-orange-400' :
                          'text-red-400'
                        }`}>
                          {Math.round(poseScore)}
                        </div>
                      </div>
                      <div className="absolute bottom-4 left-4 bg-black/70 rounded px-3 py-2">
                        <div className="text-white text-sm font-semibold">현재 포즈</div>
                      </div>
                    </>
                  )}
                  
                  {/* 테스트 시작 전 대기 메시지 */}
                  {!isStarted && (
                    <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-900">
                      <div className="text-white text-center">
                        <p className="text-lg mb-2">테스트 시작 대기 중</p>
                        <p className="text-sm text-gray-400">"테스트 시작" 버튼을 클릭하세요</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* 목표 포즈 이미지 */}
                {video.poseData && video.poseData.length > 0 && (
                  <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3', minHeight: '250px' }}>
                    <img
                      ref={targetPoseImageRef}
                      src={video.poseData[0].image}
                      alt="목표 포즈"
                      className="w-full h-full object-cover"
                      onLoad={() => {
                        if (targetPoseImageRef.current) {
                          setTargetPoseImageSize({
                            width: targetPoseImageRef.current.naturalWidth,
                            height: targetPoseImageRef.current.naturalHeight,
                          })
                        }
                      }}
                    />
                    {video.poseData[0].keypoints && 
                     targetPoseImageSize && 
                     targetPoseImageRef.current && (
                      <PoseCanvas
                        poses={[{
                          keypoints: video.poseData[0].keypoints.map(kp => ({
                            x: kp.x,
                            y: kp.y,
                            z: kp.z,
                            score: kp.score ?? 1.0,
                            name: kp.name,
                          })),
                        }]}
                        videoWidth={targetPoseImageSize.width}
                        videoHeight={targetPoseImageSize.height}
                        canvasWidth={targetPoseImageRef.current.clientWidth}
                        canvasHeight={targetPoseImageRef.current.clientHeight}
                      />
                    )}
                    <div className="absolute bottom-4 left-4 bg-black/70 rounded px-3 py-2">
                      <div className="text-white text-sm font-semibold">목표 포즈</div>
                    </div>
                  </div>
                )}
              </div>

              {/* 목표 포즈 정보 */}
              {!isStarted && video.poseData && video.poseData.length > 0 && (
                <div className="bg-gray-700 rounded-lg p-4 mb-4">
                  <div className="text-sm font-semibold text-gray-300 mb-2">목표 포즈 관절 각도:</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(video.poseData[0].angles).map(([key, value]) => (
                      <div key={key} className="text-gray-400">
                        {key}: <span className="text-white font-semibold">{value}°</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-sm text-gray-300">
                    설명: {video.poseData[0].description}
                  </div>
                </div>
              )}

              {/* 컨트롤 버튼 */}
              <div className="flex gap-2">
                {!isStarted ? (
                  <button
                    onClick={handleStart}
                    className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold"
                  >
                    테스트 시작
                  </button>
                ) : (
                  <button
                    onClick={handleStop}
                    className="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold"
                  >
                    테스트 중지
                  </button>
                )}
                <button
                  onClick={() => navigate('/admin/dashboard')}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold"
                >
                  돌아가기
                </button>
              </div>
            </div>

            {/* 포즈 비교 분석 (포즈 시각화 아래로 이동) */}
            {isStarted && targetPose && video.poseData && video.poseData.length > 0 && (
              <div className="bg-gray-800/90 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">📊 포즈 비교 분석</h2>
                <div className="space-y-4">
                  {/* 핵심 포즈와 현재 포즈를 나란히 배치 (모바일에서는 세로로) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 핵심 포즈 (목표) */}
                    <div className="bg-gray-700/50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-blue-400 mb-3">🎯 핵심 포즈 (목표)</h3>
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-white mb-1">
                          제목: {video.title}
                        </div>
                        {video.description && (
                          <div className="text-sm text-gray-300 mb-2">
                            설명: {video.description}
                          </div>
                        )}
                        <div className="text-sm text-gray-300 mb-2">
                          {video.poseData[0]?.description}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(video.poseData[0].angles || {}).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-gray-400">{key.replace('_', ' ')}:</span>
                              <span className="text-white font-semibold">{value}°</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 현재 포즈 */}
                    <div className="bg-gray-700/50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-green-400 mb-3">📹 현재 포즈</h3>
                      <div className="space-y-2">
                        {currentPoses.length > 0 ? (
                          <>
                            <div className="text-sm text-gray-300 mb-2">
                              {currentFeedback || '포즈 인식 중...'}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {Object.entries(currentPoseAngles).map(([key, value]) => {
                                const targetAngle = video.poseData[0]?.angles?.[key]
                                const diff = targetAngle ? Math.abs(value - targetAngle) : null
                                const isGood = diff !== null && diff <= 10
                                const isWarning = diff !== null && diff > 10 && diff <= 20
                                const isBad = diff !== null && diff > 20
                                
                                return (
                                  <div key={key} className="flex justify-between items-center">
                                    <span className="text-gray-400">{key.replace('_', ' ')}:</span>
                                    <div className="flex items-center gap-2">
                                      <span className={`font-semibold ${
                                        isGood ? 'text-green-400' :
                                        isWarning ? 'text-yellow-400' :
                                        isBad ? 'text-red-400' :
                                        'text-white'
                                      }`}>
                                        {value}°
                                      </span>
                                      {diff !== null && (
                                        <span className={`text-xs ${
                                          isGood ? 'text-green-400' :
                                          isWarning ? 'text-yellow-400' :
                                          'text-red-400'
                                        }`}>
                                          ({diff > 0 ? '+' : ''}{diff}°)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-400">포즈를 인식하는 중...</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 비교 요약 */}
                  {Object.keys(currentPoseAngles).length > 0 && (
                    <div className="bg-gray-700/50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-purple-400 mb-3">📈 비교 요약</h3>
                      <div className="space-y-2 text-sm">
                        {Object.entries(currentPoseAngles).map(([key, value]) => {
                          const targetAngle = video.poseData[0]?.angles?.[key]
                          if (!targetAngle) return null
                          
                          const diff = Math.abs(value - targetAngle)
                          const percentage = Math.max(0, 100 - (diff / targetAngle * 100))
                          
                          return (
                            <div key={key} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-400">{key.replace('_', ' ')}</span>
                                <span className={`font-semibold ${
                                  diff <= 10 ? 'text-green-400' :
                                  diff <= 20 ? 'text-yellow-400' :
                                  'text-red-400'
                                }`}>
                                  {percentage.toFixed(0)}% 일치
                                </span>
                              </div>
                              <div className="w-full bg-gray-600 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    diff <= 10 ? 'bg-green-400' :
                                    diff <= 20 ? 'bg-yellow-400' :
                                    'bg-red-400'
                                  }`}
                                  style={{ width: `${Math.min(100, percentage)}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 최고 점수 */}
            {bestScore && (
              <div className="bg-gray-800/90 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">최고 점수</h2>
                <div className="text-center">
                  <div className="text-5xl font-bold text-blue-400">{Math.round(bestScore.score)}</div>
                </div>
              </div>
            )}

            {/* 효과 오버레이 */}
            <EffectOverlay effects={effects} />
          </div>

          {/* 상세 분석 결과 */}
          {testResults && bestScore && bestScore.angles && video.poseData && video.poseData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/90 rounded-2xl p-6 mt-6"
            >
              <h2 className="text-2xl font-bold text-white mb-4">📈 상세 분석 결과</h2>
              
              {/* 최고 점수 시점의 관절 각도 비교 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* 왼쪽: 원래 관절 각도 (목표 포즈) */}
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-400 mb-4">🎯 원래 관절 각도 (목표)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-600">
                          <th className="text-left py-2 px-3 text-gray-300">관절</th>
                          <th className="text-right py-2 px-3 text-gray-300">각도</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(video.poseData[0].angles || {}).map(([key, value]) => (
                          <tr key={key} className="border-b border-gray-700/50">
                            <td className="py-2 px-3 text-gray-300">{key.replace(/_/g, ' ')}</td>
                            <td className="py-2 px-3 text-right text-white font-semibold">{value}°</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 오른쪽: 최고 점수 시점의 관절 각도 */}
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-400 mb-4">⭐ 최고 점수 시점 관절 각도</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-600">
                          <th className="text-left py-2 px-3 text-gray-300">관절</th>
                          <th className="text-right py-2 px-3 text-gray-300">각도</th>
                          <th className="text-right py-2 px-3 text-gray-300">차이</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(bestScore.angles).map(([key, value]) => {
                          const targetAngle = video.poseData[0]?.angles?.[key]
                          const diff = targetAngle ? Math.abs(value - targetAngle) : null
                          const isGood = diff !== null && diff <= 10
                          const isWarning = diff !== null && diff > 10 && diff <= 20
                          const isBad = diff !== null && diff > 20
                          
                          return (
                            <tr key={key} className="border-b border-gray-700/50">
                              <td className="py-2 px-3 text-gray-300">{key.replace(/_/g, ' ')}</td>
                              <td className="py-2 px-3 text-right text-white font-semibold">{value}°</td>
                              <td className={`py-2 px-3 text-right font-semibold ${
                                isGood ? 'text-green-400' :
                                isWarning ? 'text-yellow-400' :
                                isBad ? 'text-red-400' :
                                'text-gray-400'
                              }`}>
                                {diff !== null ? (
                                  <>
                                    {diff > 0 ? '+' : ''}{diff}°
                                    {targetAngle && (
                                      <span className="text-xs ml-1 text-gray-500">
                                        ({((1 - diff / targetAngle) * 100).toFixed(0)}%)
                                      </span>
                                    )}
                                  </>
                                ) : '-'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* 기존 분석 결과 테이블 (선택적) */}
              {testResults.analyzedPoses.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xl font-bold text-white mb-4">포즈별 상세 기록</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-2 px-4 text-gray-400">포즈 #</th>
                          <th className="text-left py-2 px-4 text-gray-400">점수</th>
                          <th className="text-left py-2 px-4 text-gray-400">설명</th>
                          <th className="text-left py-2 px-4 text-gray-400">시간</th>
                        </tr>
                      </thead>
                      <tbody>
                        {testResults.analyzedPoses.map((pose, index) => (
                          <tr key={index} className="border-b border-gray-700/50">
                            <td className="py-2 px-4 text-gray-300">{pose.index + 1}</td>
                            <td className="py-2 px-4">
                              <span
                                className={
                                  pose.score >= 90 ? 'text-red-400 font-semibold' :
                                  pose.score >= 80 ? 'text-orange-400 font-semibold' :
                                  pose.score >= 70 ? 'text-yellow-400 font-semibold' :
                                  pose.score >= 60 ? 'text-green-400 font-semibold' :
                                  'text-gray-400'
                                }
                              >
                                {Math.round(pose.score)}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-gray-400">{pose.description}</td>
                            <td className="py-2 px-4 text-gray-500">
                              {new Date(pose.timestamp).toLocaleTimeString('ko-KR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ExerciseVideoTestPage

