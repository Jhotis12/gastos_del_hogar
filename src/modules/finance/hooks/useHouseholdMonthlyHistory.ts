import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import {
  fetchHouseholdMonthlyHistory,
  householdHistoryKey,
} from '@/modules/finance/lib/history'

export function useHouseholdMonthlyHistory() {
  const { profile } = useAuth()
  const householdId = profile?.household_id

  return useQuery({
    queryKey: householdHistoryKey(householdId),
    queryFn: () => fetchHouseholdMonthlyHistory(supabase),
    enabled: !!householdId,
  })
}
