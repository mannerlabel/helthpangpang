import { useEffect, useRef, useState, useCallback } from 'react'

interface UseInfiniteScrollOptions {
  hasMore: boolean
  loading: boolean
  onLoadMore: () => Promise<void>
  threshold?: number
}

export const useInfiniteScroll = ({
  hasMore,
  loading,
  onLoadMore,
  threshold = 200,
}: UseInfiniteScrollOptions) => {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const elementRef = useRef<HTMLDivElement | null>(null)

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries
      if (target.isIntersecting && hasMore && !loading) {
        onLoadMore()
      }
    },
    [hasMore, loading, onLoadMore]
  )

  useEffect(() => {
    const option = {
      root: null,
      rootMargin: `${threshold}px`,
      threshold: 0,
    }

    observerRef.current = new IntersectionObserver(handleObserver, option)
    const currentElement = elementRef.current
    const currentObserver = observerRef.current

    if (currentElement) {
      currentObserver.observe(currentElement)
    }

    return () => {
      if (currentElement) {
        currentObserver.unobserve(currentElement)
      }
    }
  }, [handleObserver, threshold])

  return { elementRef }
}

