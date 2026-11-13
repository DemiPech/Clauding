package net.demipech.budget.domain

import net.demipech.budget.data.Frequency
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class InstallmentsTest {
    @Test
    fun splitPutsTheRestOnTheFirstPayment() {
        assertEquals(listOf(3334L, 3333L, 3333L), Installments.split(10000, 3))
        assertEquals(listOf(15000L, 15000L, 15000L, 15000L), Installments.split(60000, 4))
        assertEquals(10000L, Installments.split(10000, 7).sum())
        assertEquals(emptyList<Long>(), Installments.split(10000, 0))
    }

    @Test
    fun firstPaymentNowThenMonthly() {
        val dates = Installments.dates(
            first = LocalDate.of(2026, 11, 13),
            next = LocalDate.of(2026, 12, 13),
            count = 4,
            frequency = Frequency.MONTHLY,
            interval = 1,
        )
        assertEquals(
            listOf(LocalDate.of(2026, 11, 13), LocalDate.of(2026, 12, 13), LocalDate.of(2027, 1, 13), LocalDate.of(2027, 2, 13)),
            dates,
        )
    }

    @Test
    fun everyThirtyDaysWithoutFirst() {
        val dates = Installments.dates(null, LocalDate.of(2026, 12, 13), 2, Frequency.DAILY, 30)
        assertEquals(listOf(LocalDate.of(2026, 12, 13), LocalDate.of(2027, 1, 12)), dates)
    }
}
