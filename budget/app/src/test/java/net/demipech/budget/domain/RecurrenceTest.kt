package net.demipech.budget.domain

import net.demipech.budget.data.Frequency
import net.demipech.budget.data.Kind
import net.demipech.budget.data.ScheduledOperation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class RecurrenceTest {
    private fun scheduled(
        start: LocalDate,
        frequency: Frequency,
        occurrences: Int?,
        interval: Int = 1,
        generated: Int = 0,
    ) = ScheduledOperation(
        accountId = 1,
        categoryId = null,
        kind = Kind.EXPENSE,
        amountCents = 1000,
        startDate = start,
        frequency = frequency,
        interval = interval,
        occurrences = occurrences,
        generatedCount = generated,
    )

    @Test
    fun monthlyFromThe31stClampsThenComesBack() {
        val start = LocalDate.of(2026, 1, 31)
        assertEquals(LocalDate.of(2026, 2, 28), Recurrence.occurrenceDate(start, Frequency.MONTHLY, 1, 1))
        assertEquals(LocalDate.of(2026, 3, 31), Recurrence.occurrenceDate(start, Frequency.MONTHLY, 1, 2))
        assertEquals(LocalDate.of(2026, 4, 30), Recurrence.occurrenceDate(start, Frequency.MONTHLY, 1, 3))
    }

    @Test
    fun intervalMultipliesTheStep() {
        val start = LocalDate.of(2026, 1, 1)
        assertEquals(LocalDate.of(2026, 1, 29), Recurrence.occurrenceDate(start, Frequency.WEEKLY, 2, 2))
        assertEquals(LocalDate.of(2026, 7, 1), Recurrence.occurrenceDate(start, Frequency.MONTHLY, 3, 2))
        assertEquals(LocalDate.of(2030, 1, 1), Recurrence.occurrenceDate(start, Frequency.YEARLY, 2, 2))
        assertEquals(LocalDate.of(2026, 1, 4), Recurrence.occurrenceDate(start, Frequency.DAILY, 1, 3))
    }

    @Test
    fun finiteSeriesStopsAfterItsCount() {
        val s = scheduled(LocalDate.of(2026, 1, 15), Frequency.MONTHLY, occurrences = 3)
        val due = Recurrence.dueDates(s, today = LocalDate.of(2026, 12, 31))
        assertEquals(
            listOf(LocalDate.of(2026, 1, 15), LocalDate.of(2026, 2, 15), LocalDate.of(2026, 3, 15)),
            due,
        )
        assertTrue(Recurrence.isFinished(s.copy(generatedCount = 3)))
        assertNull(Recurrence.nextDate(s.copy(generatedCount = 3)))
    }

    @Test
    fun endlessSeriesOnlyCreatesWhatIsDue() {
        val s = scheduled(LocalDate.of(2026, 1, 1), Frequency.MONTHLY, occurrences = null)
        val due = Recurrence.dueDates(s, today = LocalDate.of(2026, 4, 15))
        assertEquals(4, due.size)
        assertNull(Recurrence.remaining(s))
        assertFalse(Recurrence.isFinished(s.copy(generatedCount = 1_000)))
    }

    @Test
    fun alreadyGeneratedOccurrencesAreSkipped() {
        val s = scheduled(LocalDate.of(2026, 1, 1), Frequency.MONTHLY, occurrences = null, generated = 3)
        assertEquals(LocalDate.of(2026, 4, 1), Recurrence.nextDate(s))
        assertEquals(listOf(LocalDate.of(2026, 4, 1)), Recurrence.dueDates(s, LocalDate.of(2026, 4, 30)))
        assertEquals(emptyList<LocalDate>(), Recurrence.dueDates(s, LocalDate.of(2026, 3, 31)))
    }

    @Test
    fun oneOffIsASingleOccurrenceWhateverTheCount() {
        val s = scheduled(LocalDate.of(2026, 6, 1), Frequency.NONE, occurrences = null)
        assertEquals(1, Recurrence.remaining(s))
        assertEquals(emptyList<LocalDate>(), Recurrence.dueDates(s, LocalDate.of(2026, 5, 31)))
        assertEquals(listOf(LocalDate.of(2026, 6, 1)), Recurrence.dueDates(s, LocalDate.of(2026, 9, 1)))
        assertEquals(emptyList<LocalDate>(), Recurrence.dueDates(s.copy(generatedCount = 1), LocalDate.of(2026, 9, 1)))
    }

    @Test
    fun futureStartCreatesNothingYet() {
        val s = scheduled(LocalDate.of(2027, 1, 1), Frequency.DAILY, occurrences = null)
        assertEquals(emptyList<LocalDate>(), Recurrence.dueDates(s, LocalDate.of(2026, 12, 31)))
        assertEquals(LocalDate.of(2027, 1, 1), Recurrence.nextDate(s))
    }
}
