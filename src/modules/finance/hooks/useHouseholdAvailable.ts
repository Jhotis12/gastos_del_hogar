import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import {
  fetchHouseholdAvailable,
  householdAvailableKey,
} from '@/modules/finance/lib/householdAvailable'

export function useHouseholdAvailable(asOf: string) {
  const { profile } = useAuth()
  const householdId = profile?.household_id

  return useQuery({
    queryKey: householdAvailableKey(householdId, asOf),
    queryFn: () => fetchHouseholdAvailable(supabase, asOf),
    enabled: !!householdId,
  })
}
