'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,        // 1분간 캐시 유지
        gcTime: 5 * 60 * 1000,       // 5분간 메모리 보관
        retry: 1,
        refetchOnWindowFocus: false, // 탭 전환 시 불필요한 재요청 방지
      },
    },
  }))

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
