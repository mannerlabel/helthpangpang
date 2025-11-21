class ImageCaptureService {
  // 비디오에서 이미지 캡처 (base64)
  captureImage(video: HTMLVideoElement, canvas?: HTMLCanvasElement): string {
    const captureCanvas = canvas || document.createElement('canvas')
    captureCanvas.width = video.videoWidth
    captureCanvas.height = video.videoHeight

    const ctx = captureCanvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context를 가져올 수 없습니다.')

    ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height)
    return captureCanvas.toDataURL('image/jpeg', 0.8)
  }

  // 이미지 다운로드
  downloadImage(dataUrl: string, filename: string): void {
    const link = document.createElement('a')
    link.download = filename
    link.href = dataUrl
    link.click()
  }

  // 이미지를 Blob으로 변환
  dataURLtoBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',')
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }

    return new Blob([u8arr], { type: mime })
  }

  // 이미지를 모바일 사이즈로 리사이즈 (저장용량 최소화)
  async resizeImageForMobile(
    imageDataUrl: string,
    maxWidth: number = 800,
    maxHeight: number = 800,
    quality: number = 0.7
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        // 원본 비율 유지하면서 최대 크기 계산
        let width = img.width
        let height = img.height

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = width * ratio
          height = height * ratio
        }

        // Canvas에 리사이즈된 이미지 그리기
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context를 가져올 수 없습니다.'))
          return
        }

        // 이미지 품질 향상을 위한 설정
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        ctx.drawImage(img, 0, 0, width, height)

        // JPEG로 변환 (용량 최적화)
        const resizedDataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(resizedDataUrl)
      }
      img.onerror = () => {
        reject(new Error('이미지 로드 실패'))
      }
      img.src = imageDataUrl
    })
  }
}

export const imageCaptureService = new ImageCaptureService()

