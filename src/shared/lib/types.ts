export interface Household {
  id: string
  name: string
  invite_code: string
  created_at: string
}

export interface Profile {
  id: string
  household_id: string | null
  full_name: string
  avatar_path?: string | null
  payday?: number | null
  created_at: string
}

export interface Salary {
  id: string
  household_id: string
  profile_id: string
  amount: number
  month: string
  pay_date: string
  created_at: string
}

// Salario efectivo de una persona en un mes: la fila del mes si existe,
// o el último salario registrado en un mes anterior (heredado).
export interface EffectiveSalary {
  profile_id: string
  amount: number
  source_month: string | null
  pay_date: string
}

export interface Category {
  id: string
  household_id: string
  name: string
  color: string
  icon: string
  created_at: string
}

export interface Expense {
  id: string
  household_id: string
  category_id: string | null
  paid_by: string | null
  recurring_id: string | null
  receipt_id: string | null
  amount: number
  description: string
  expense_date: string
  created_at: string
}

export interface ReceiptItem {
  descripcion: string
  cantidad: number
  valor_unitario: number
  subtotal: number
}

export interface ReceiptParsed {
  comercio?: string
  fecha?: string
  items?: ReceiptItem[]
  total?: number
  error?: string
}

export interface Receipt {
  id: string
  household_id: string
  storage_path: string
  uploaded_by: string | null
  parsed_data: ReceiptParsed
  created_at: string
}

export interface ExpenseWithRelations extends Expense {
  category: Pick<Category, 'id' | 'name' | 'color' | 'icon'> | null
  payer: Pick<Profile, 'id' | 'full_name' | 'avatar_path'> | null
  recurring: Pick<RecurringExpense, 'id' | 'description'> | null
  receipt: Receipt | null
}

// Dinero extra: ingreso que no es nómina (venta, regalo, reembolso…).
// Se suma al fondo común como ingreso; member_id (quién recibió) es opcional.
export interface Income {
  id: string
  household_id: string
  member_id: string | null
  amount: number
  description: string
  income_date: string
  created_at: string
}

export interface IncomeWithRelations extends Income {
  member: Pick<Profile, 'id' | 'full_name' | 'avatar_path'> | null
}

export type Frequency = 'monthly' | 'bimonthly' | 'quarterly' | 'yearly'

export interface RecurringExpense {
  id: string
  household_id: string
  category_id: string | null
  paid_by: string | null
  amount: number
  description: string
  frequency: Frequency
  next_due_date: string
  is_active: boolean
  created_at: string
}

export interface RecurringExpenseWithRelations extends RecurringExpense {
  category: Pick<Category, 'id' | 'name' | 'color' | 'icon'> | null
  payer: Pick<Profile, 'id' | 'full_name' | 'avatar_path'> | null
}

export interface SavingsGoal {
  id: string
  household_id: string
  name: string
  target_amount: number
  saved_amount: number
  target_date: string | null
  created_at: string
}

export interface WishlistItem {
  id: string
  household_id: string
  created_by: string | null
  name: string
  price: number
  priority: 'necesidad' | 'deseo' | 'regalo'
  status: 'pendiente' | 'comprado' | 'descartado'
  payment_method: 'contado' | 'cuotas'
  initial_payment: number | null
  installments_count: number | null
  interest_rate: number | null
  cutoff_day: number | null
  purchase_date: string | null
  bought_at: string | null
  created_at: string
}
