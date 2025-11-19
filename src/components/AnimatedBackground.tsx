import { useEffect, useState } from 'react'

interface AnimatedBackgroundProps {
  className?: string
}

/**
 * 동적 그라데이션 배경 컴포넌트
 * 스마트 헬스케어에 맞는 동적인 배경화면
 */
const AnimatedBackground = ({ className = '' }: AnimatedBackgroundProps) => {
  const [gradientIndex, setGradientIndex] = useState(0)
  const [hue, setHue] = useState(0)

  // 그라데이션 색상 조합 (헬스케어 테마)
  const gradients = [
    // 에너지/활력
    { from: '#3b82f6', via: '#8b5cf6', to: '#ec4899' },
    // 건강/자연
    { from: '#10b981', via: '#14b8a6', to: '#06b6d4' },
    // 동기부여/열정
    { from: '#f97316', via: '#ef4444', to: '#ec4899' },
    // 평온/집중
    { from: '#4f46e5', via: '#3b82f6', to: '#06b6d4' },
    // 활력/성장
    { from: '#10b981', via: '#22c55e', to: '#14b8a6' },
    // 강렬/도전
    { from: '#7c3aed', via: '#8b5cf6', to: '#d946ef' },
  ]

  useEffect(() => {
    // 5초마다 그라데이션 변경
    const interval = setInterval(() => {
      setGradientIndex((prev) => (prev + 1) % gradients.length)
    }, 5000)

    // 색상 회전 애니메이션
    const hueInterval = setInterval(() => {
      setHue((prev) => (prev + 1) % 360)
    }, 50)

    return () => {
      clearInterval(interval)
      clearInterval(hueInterval)
    }
  }, [gradients.length])

  const currentGradient = gradients[gradientIndex]

  return (
    <div
      className={`fixed inset-0 -z-10 ${className}`}
      style={{
        background: `linear-gradient(135deg, ${currentGradient.from} 0%, ${currentGradient.via} 50%, ${currentGradient.to} 100%)`,
        transition: 'background 5s ease-in-out',
        filter: `hue-rotate(${hue * 0.1}deg)`,
      }}
    />
  )
}

export default AnimatedBackground

