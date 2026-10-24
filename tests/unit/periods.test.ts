import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clampPayday,
  lastPaydayDate,
  monthToDateWindow,
  rangeLabel,
  sincePaydayWindow,
} from '../../src/shared/lib/periods.ts'
import { formatDate, monthLabel } from '../../src/shared/lib/dates.ts'

test('clampPayday recorta al último día del mes', () => {
  assert.equal(clampPayday(31, '2026-02'), 28)
  assert.equal(clampPayday(31, '2028-02'), 29)
  assert.equal(clampPayday(31, '2026-04'), 30)
  assert.equal(clampPayday(15, '2026-10'), 15)
  assert.equal(clampPayday(0, '2026-10'), 1)
  assert.equal(clampPayday(null, '2026-10'), 1)
})

test('lastPaydayDate usa la nómina real más reciente', () => {
  assert.equal(
    lastPaydayDate({ salaries: [{ pay_date: '2026-09-30' }], asOf: '2026-10-02' }),
    '2026-09-30',
  )
  assert.equal(
    lastPaydayDate({
      salaries: [
        { pay_date: '2026-10-01' },
        { pay_date: '2026-10-10' },
        { pay_date: '2026-10-30' },
      ],
      asOf: '2026-10-15',
    }),
    '2026-10-10',
  )
})

test('lastPaydayDate ignora nóminas futuras y usa el payday', () => {
  assert.equal(
    lastPaydayDate({
      payday: 25,
      salaries: [{ pay_date: '2026-10-30' }],
      asOf: '2026-10-10',
    }),
    '2026-09-25',
  )
})

test('lastPaydayDate usa el payday del mes si ya llegó', () => {
  assert.equal(
    lastPaydayDate({ payday: 15, salaries: [], asOf: '2026-10-20' }),
    '2026-10-15',
  )
})

test('lastPaydayDate usa el mes anterior si el payday no llega', () => {
  assert.equal(
    lastPaydayDate({ payday: 25, salaries: [], asOf: '2026-10-10' }),
    '2026-09-25',
  )
})

test('lastPaydayDate recorta día 31 en febrero, bisiesto y abril', () => {
  assert.equal(
    lastPaydayDate({ payday: 31, salaries: [], asOf: '2026-02-28' }),
    '2026-02-28',
  )
  assert.equal(
    lastPaydayDate({ payday: 31, salaries: [], asOf: '2028-02-29' }),
    '2028-02-29',
  )
  assert.equal(
    lastPaydayDate({ payday: 31, salaries: [], asOf: '2026-04-30' }),
    '2026-04-30',
  )
})

test('lastPaydayDate acepta nómina atrasada como fecha real', () => {
  assert.equal(
    lastPaydayDate({
      payday: 30,
      salaries: [{ pay_date: '2026-10-01' }],
      asOf: '2026-10-03',
    }),
    '2026-10-01',
  )
})

test('monthToDateWindow cubre el mes en curso', () => {
  assert.deepEqual(monthToDateWindow('2026-10-24'), {
    start: '2026-10-01',
    end: '2026-10-24',
  })
  assert.deepEqual(monthToDateWindow('2026-11-01'), {
    start: '2026-11-01',
    end: '2026-11-01',
  })
})

test('sincePaydayWindow cruza meses', () => {
  assert.deepEqual(
    sincePaydayWindow({
      salaries: [{ pay_date: '2026-09-30' }],
      asOf: '2026-10-02',
    }),
    { start: '2026-09-30', end: '2026-10-02' },
  )
  assert.deepEqual(
    sincePaydayWindow({ payday: 27, salaries: [], asOf: '2026-10-10' }),
    { start: '2026-09-27', end: '2026-10-10' },
  )
})

test('rangeLabel usa español de Colombia y aclara el cruce de mes', () => {
  assert.equal(
    rangeLabel({ start: '2026-10-01', end: '2026-10-24' }),
    '1–24 de octubre',
  )
  assert.equal(
    rangeLabel({ start: '2026-09-30', end: '2026-10-02' }),
    '30 de septiembre – 2 de octubre',
  )
  assert.equal(
    rangeLabel({ start: '2026-10-24', end: '2026-10-24' }),
    '24 de octubre',
  )
  assert.equal(
    rangeLabel({ start: '2026-12-31', end: '2027-01-02' }),
    '31 de diciembre de 2026 – 2 de enero de 2027',
  )
  assert.match(monthLabel('2026-10-01'), /octubre/)
  assert.match(formatDate('2026-10-24'), /24/)
})
