import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import { runWithOfflineFallback, invalidateIfOnline } from '@/shared/lib/offline/offlineSafe'
import type { WishlistItem } from '@/shared/lib/types'

export type WishlistInput = {
  name: string
  price: number
  priority: WishlistItem['priority']
  payment_method: WishlistItem['payment_method']
  initial_payment: number | null
  installments_count: number | null
  interest_rate: number | null
  cutoff_day: number | null
  purchase_date: string | null
}

export function useWishlist() {
  const { profile } = useAuth()
  const householdId = profile?.household_id

  return useQuery({
    queryKey: ['wishlist', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wishlist_items')
        .select('*')
        .eq('household_id', householdId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as WishlistItem[]
    },
    enabled: !!householdId,
  })
}

export function useAddWishlistItem() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: WishlistInput) =>
      runWithOfflineFallback(
        async () => {
          if (!profile?.household_id) throw new Error('Sin hogar')
          const { data, error } = await supabase
            .from('wishlist_items')
            .insert({
              ...input,
              id: crypto.randomUUID(),
              household_id: profile.household_id,
              created_by: profile.id,
              status: 'pendiente',
            })
            .select()
            .single()
          if (error) throw error
          return data as WishlistItem
        },
        () => {
          if (!profile?.household_id) throw new Error('Sin hogar')
          throw new Error('Sin conexión: vuelve a intentarlo cuando estés en línea')
        },
      ),
    onSuccess: () => invalidateIfOnline(queryClient, [['wishlist']]),
  })
}

export function useUpdateWishlistItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...input }: WishlistInput & { id: string }) =>
      runWithOfflineFallback(
        async () => {
          const { error } = await supabase
            .from('wishlist_items')
            .update(input)
            .eq('id', id)
          if (error) throw error
        },
        () => {
          throw new Error('Sin conexión: vuelve a intentarlo cuando estés en línea')
        },
      ),
    onSuccess: () => invalidateIfOnline(queryClient, [['wishlist']]),
  })
}

export function useSetWishlistStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string
      status: WishlistItem['status']
    }) =>
      runWithOfflineFallback(
        async () => {
          const { error } = await supabase
            .from('wishlist_items')
            .update({ status, bought_at: status === 'comprado' ? new Date().toISOString() : null })
            .eq('id', id)
          if (error) throw error
        },
        () => {
          throw new Error('Sin conexión: vuelve a intentarlo cuando estés en línea')
        },
      ),
    onSuccess: () => invalidateIfOnline(queryClient, [['wishlist']]),
  })
}

export function useDeleteWishlistItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      runWithOfflineFallback(
        async () => {
          const { error } = await supabase
            .from('wishlist_items')
            .delete()
            .eq('id', id)
          if (error) throw error
        },
        () => {
          throw new Error('Sin conexión: vuelve a intentarlo cuando estés en línea')
        },
      ),
    onSuccess: () => invalidateIfOnline(queryClient, [['wishlist']]),
  })
}
