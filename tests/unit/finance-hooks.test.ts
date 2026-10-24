import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EMPTY_MEMBER_AVAILABLE,
  fetchMemberAvailable,
  memberAvailableKey,
  type MemberAvailableClient,
} from '../../src/modules/finance/lib/memberAvailable.ts'

test('memberAvailableKey incluye hogar, miembro y fecha', () => {
  assert.deepEqual(memberAvailableKey('h1', 'm1', '2026-10-24'), [
    'member-available',
    'h1',
    'm1',
    '2026-10-24',
  ])
})

test('fetchMemberAvailable normaliza la fila del RPC', async () => {
  const calls: Array<[string, Record<string, unknown>]> = []
  const client: MemberAvailableClient = {
    rpc: async (fn, args) => {
      calls.push([fn, args])
      return {
        data: [
          {
            available: '2000000.00',
            income_basis: '3500000.00',
            last_pay_date: '2026-10-01',
          },
        ],
        error: null,
      }
    },
  }

  assert.deepEqual(await fetchMemberAvailable(client, '2026-10-24'), {
    available: 2000000,
    income_basis: 3500000,
    last_pay_date: '2026-10-01',
  })
  assert.deepEqual(calls, [
    ['get_member_available', { p_as_of: '2026-10-24' }],
  ])
})

test('fetchMemberAvailable devuelve vacío sin fila o con disponible null', async () => {
  const empty: MemberAvailableClient = {
    rpc: async () => ({ data: [], error: null }),
  }
  assert.deepEqual(await fetchMemberAvailable(empty, '2026-10-24'), EMPTY_MEMBER_AVAILABLE)

  const noBase: MemberAvailableClient = {
    rpc: async () => ({
      data: [{ available: null, income_basis: 0, last_pay_date: null }],
      error: null,
    }),
  }
  assert.deepEqual(await fetchMemberAvailable(noBase, '2026-10-24'), {
    available: null,
    income_basis: 0,
    last_pay_date: null,
  })
})

test('fetchMemberAvailable propaga el error del RPC', async () => {
  const failing: MemberAvailableClient = {
    rpc: async () => ({ data: null, error: new Error('sin sesión') }),
  }
  await assert.rejects(fetchMemberAvailable(failing, '2026-10-24'), /sin sesión/)
})
