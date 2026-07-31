import { Home, Utensils, Car, Zap, Heart, Gamepad2, Tag } from 'lucide-react'
import type { Frequency } from '@/lib/types'

export const FREQUENCY_LABELS: Record<string, string> = {
  monthly: 'Mensual',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
  yearly: 'Anual',
}

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'bimonthly', label: 'Bimestral' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'yearly', label: 'Anual' },
]

export const CATEGORY_ICONS = {
  home: Home,
  utensils: Utensils,
  car: Car,
  zap: Zap,
  heart: Heart,
  gamepad: Gamepad2,
  tag: Tag,
} as const

export type CategoryIconKey = keyof typeof CATEGORY_ICONS

export const CATEGORY_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#0ea5e9',
  '#64748b',
]

export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
