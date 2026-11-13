package net.demipech.budget.domain

import net.demipech.budget.data.Account
import net.demipech.budget.data.DebitDay
import net.demipech.budget.data.Kind
import net.demipech.budget.data.Operation
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class DeferredDebitTest {
    private fun d(y: Int, m: Int, day: Int) = LocalDate.of(y, m, day)

    @Test
    fun cutoffOnThe20thDebitedOnTheLastDay() {
        fun debit(date: LocalDate) = DeferredDebit.debitDate(date, 20, DebitDay.LAST_DAY, 1)
        assertEquals(d(2026, 11, 30), debit(d(2026, 11, 13)))
        assertEquals(d(2026, 11, 30), debit(d(2026, 11, 20)))
        assertEquals(d(2026, 12, 31), debit(d(2026, 11, 21)))
        assertEquals(d(2026, 11, 30), debit(d(2026, 10, 25)))
        assertEquals(d(2027, 2, 28), debit(d(2027, 2, 20)))
    }

    @Test
    fun endOfMonthCutoffDebitedOnThe5th() {
        fun debit(date: LocalDate) = DeferredDebit.debitDate(date, 31, DebitDay.DAY_OF_MONTH, 5)
        assertEquals(d(2026, 12, 5), debit(d(2026, 11, 13)))
        assertEquals(d(2026, 12, 5), debit(d(2026, 11, 30)))
        assertEquals(d(2027, 3, 5), debit(d(2027, 2, 28)))
    }

    @Test
    fun lastBusinessDay() {
        // 31 janvier 2027 = dimanche : arrêté au 20, débit le vendredi 29.
        assertEquals(d(2027, 1, 29), DeferredDebit.debitDate(d(2027, 1, 10), 20, DebitDay.LAST_BUSINESS_DAY, 1))
    }

    @Test
    fun onlyExpensesMarkedDeferredOnADeferredAccount() {
        val account = Account(id = 1, name = "Carte", deferredDebit = true, cutoffDay = 20)
        val expense = Operation(accountId = 1, categoryId = null, kind = Kind.EXPENSE, amountCents = 100, date = d(2026, 11, 13), deferred = true)
        assertEquals(d(2026, 11, 30), DeferredDebit.effectiveDate(expense, account))
        assertEquals(d(2026, 11, 13), DeferredDebit.effectiveDate(expense.copy(deferred = false), account))
        assertEquals(d(2026, 11, 13), DeferredDebit.effectiveDate(expense.copy(kind = Kind.INCOME), account))
        assertEquals(d(2026, 11, 13), DeferredDebit.effectiveDate(expense, account.copy(deferredDebit = false)))
    }
}
