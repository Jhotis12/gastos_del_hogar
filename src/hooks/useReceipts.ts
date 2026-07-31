import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { ReceiptParsed } from '@/lib/types'

export function useCreateReceipt() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ storage_path }: { storage_path: string }) => {
      if (!user || !profile?.household_id) throw new Error('Sin hogar')
      const { data, error } = await supabase
        .from('receipts')
        .insert({
          household_id: profile.household_id,
          storage_path,
          uploaded_by: user.id,
        })
        .select('id')
        .single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['receipts'] }),
  })
}

export function useUpdateReceiptParsed() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, parsed }: { id: string; parsed: ReceiptParsed }) => {
      const { error } = await supabase
        .from('receipts')
        .update({ parsed_data: parsed })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['receipts'] }),
  })
}

export function useReceiptSignedUrl(path: string | null) {
  return useQuery({
    queryKey: ['receipt-url', path],
    queryFn: async () => {
      if (!path) return null
      const { data, error } = await supabase.storage
        .from('receipts')
        .createSignedUrl(path, 3600)
      if (error) throw error
      return data.signedUrl
    },
    enabled: !!path,
  })
}

export async function analyzeReceipt(householdId: string, path: string): Promise<ReceiptParsed> {
  const { data, error } = await supabase.functions.invoke('analyze-receipt', {
    body: { household_id: householdId, path },
  })
  if (error) throw new Error(error.message || 'No se pudo analizar la factura')
  const parsed = (data as { parsed?: ReceiptParsed }).parsed
  if (!parsed) throw new Error('No se pudo analizar la factura')
  if ('error' in parsed && parsed.error) throw new Error(parsed.error)
  return parsed
}

export async function uploadReceiptImage(
  householdId: string,
  blob: Blob,
): Promise<string> {
  const path = `${householdId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from('receipts')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return path
}
