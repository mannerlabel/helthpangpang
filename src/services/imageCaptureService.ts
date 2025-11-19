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
}

export const imageCaptureService = new ImageCaptureService()

