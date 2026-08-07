import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import type { Category } from '@/shared/lib/types'

export function useCategories() {
  const { profile } = useAuth()
  const householdId = profile?.household_id

  return useQuery({
    queryKey: ['categories', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('household_id', householdId!)
        .order('name')
      if (error) throw error
      return data as Category[]
    },
    enabled: !!householdId,
  })
}

export function useBudgets(month: string) {
  const { profile } = useAuth()
  const householdId = profile?.household_id

  return useQuery({
    queryKey: ['budgets', householdId, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_budgets')
        .select('id, category_id, amount')
        .eq('household_id', householdId!)
        .eq('month', month)
      if (error) throw error
      return data as { id: string; category_id: string; amount: number }[]
    },
    enabled: !!householdId,
  })
}

export function useUpsertBudget(month: string) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      categoryId,
      amount,
    }: {
      categoryId: string
      amount: number
    }) => {
      if (!profile?.household_id) throw new Error('Sin hogar')
      const { error } = await supabase
        .from('category_budgets')
        .upsert(
          {
            household_id: profile.household_id,
            category_id: categoryId,
            month,
            amount,
          },
          { onConflict: 'category_id,month' },
        )
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets'] }),
  })
}

export function useDeleteBudget(month: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase
        .from('category_budgets')
        .delete()
        .eq('category_id', categoryId)
        .eq('month', month)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets'] }),
  })
}

export function useAddCategory() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { name: string; color: string; icon: string }) => {
      if (!profile?.household_id) throw new Error('Sin hogar')
      const { error } = await supabase
        .from('categories')
        .insert({ ...input, household_id: profile.household_id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  })
}

