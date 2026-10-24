import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import {
  fetchPersonalMonthlyHistory,
  personalHistoryKey,
} from '@/modules/finance/lib/history'

export function usePersonalMonthlyHistory() {
  const { profile } = useAuth()
  const householdId = profile?.household_id
  const memberId = profile?.id

  return useQuery({
    queryKey: personalHistoryKey(householdId, memberId),
    queryFn: () => fetchPersonalMonthlyHistory(supabase),
    enabled: !!householdId && !!memberId,
  })
}
