/**
 * 계급 배지 컴포넌트
 * 회원 및 크루 계급을 아이콘과 함께 표시
 */

import { USER_RANKS, CREW_RANKS, RankInfo } from '@/services/rankService'

interface RankBadgeProps {
  rank: number
  type: 'user' | 'crew'
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

const RankBadge = ({ rank, type, size = 'md', showText = true }: RankBadgeProps) => {
  const ranks = type === 'user' ? USER_RANKS : CREW_RANKS
  const rankInfo = ranks.find(r => r.level === rank) || ranks[0]

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  const iconSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl'
  }

  const badgeSizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  }

  const levelTextSizeClasses = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm'
  }

  // 크루 계급은 배지 스타일로 표시
  const isCrew = type === 'crew'

  return (
    <div className={`inline-flex items-center gap-1.5 ${sizeClasses[size]}`}>
      <div className="relative inline-flex items-center justify-center">
        {isCrew ? (
          // 크루 계급: 배지 스타일 (배경색과 함께)
          <span 
            className={`${iconSizeClasses[size]} ${badgeSizeClasses[size]} inline-flex items-center justify-center rounded-full ${
              rank >= 9 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
              rank >= 7 ? 'bg-gradient-to-br from-purple-400 to-pink-500' :
              rank >= 5 ? 'bg-gradient-to-br from-blue-400 to-cyan-500' :
              rank >= 3 ? 'bg-gradient-to-br from-green-400 to-emerald-500' :
              'bg-gradient-to-br from-gray-400 to-gray-500'
            }`}
            title={`${rankInfo.name} (${rank}단계)`}
          >
            {rankInfo.icon}
          </span>
        ) : (
          // 회원 계급: 일반 아이콘
          <span className={`${iconSizeClasses[size]} ${badgeSizeClasses[size]} inline-flex items-center justify-center`} title={`${rankInfo.name} (${rank}단계)`}>
            {rankInfo.icon}
          </span>
        )}
        {/* 레벨 숫자 오버레이 */}
        <span 
          className={`absolute -top-1 -right-1 ${levelTextSizeClasses[size]} font-bold text-white bg-red-500 rounded-full ${badgeSizeClasses[size]} flex items-center justify-center shadow-lg border-2 border-white`}
          style={{ 
            width: size === 'sm' ? '16px' : size === 'md' ? '18px' : '20px',
            height: size === 'sm' ? '16px' : size === 'md' ? '18px' : '20px',
            fontSize: size === 'sm' ? '10px' : size === 'md' ? '11px' : '12px'
          }}
        >
          {rank}
        </span>
      </div>
      {showText && (
        <span className="font-semibold text-white whitespace-nowrap">
          {rankInfo.name}
        </span>
      )}
    </div>
  )
}

export default RankBadge

