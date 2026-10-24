import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import {
  fetchMemberAvailable,
  memberAvailableKey,
} from '@/modules/finance/lib/memberAvailable'

export function useMemberAvailable(asOf: string) {
  const { profile } = useAuth()
  const householdId = profile?.household_id
  const memberId = profile?.id

  return useQuery({
    queryKey: memberAvailableKey(householdId, memberId, asOf),
    queryFn: () => fetchMemberAvailable(supabase, asOf),
    enabled: !!householdId && !!memberId,
  })
}
