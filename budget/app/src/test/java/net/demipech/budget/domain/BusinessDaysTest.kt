package net.demipech.budget.domain

import net.demipech.budget.data.DateAdjust
import net.demipech.budget.data.DayRule
import net.demipech.budget.data.Frequency
import net.demipech.budget.data.Kind
import net.demipech.budget.data.ScheduledOperation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth

class BusinessDaysTest {
    @Test
    fun frenchHolidays() {
        assertEquals(LocalDate.of(2026, 4, 5), BusinessDays.easter(2026))
        assertEquals(LocalDate.of(2027, 3, 28), BusinessDays.easter(2027))
        val h = BusinessDays.holidays(2026)
        assertTrue(LocalDate.of(2026, 4, 6) in h) // lundi de Pâques
        assertTrue(LocalDate.of(2026, 5, 14) in h) // Ascension
        assertTrue(LocalDate.of(2026, 5, 25) in h) // lundi de Pentecôte
        assertTrue(LocalDate.of(2026, 7, 14) in h)
        assertEquals(11, h.size)
        assertFalse(BusinessDays.isBusinessDay(LocalDate.of(2026, 11, 11)))
        assertFalse(BusinessDays.isBusinessDay(LocalDate.of(2026, 11, 14))) // samedi
        assertTrue(BusinessDays.isBusinessDay(LocalDate.of(2026, 11, 13)))
    }

    @Test
    fun firstAndLastBusinessDays() {
        assertEquals(LocalDate.of(2026, 11, 30), BusinessDays.last(YearMonth.of(2026, 11)))
        assertEquals(LocalDate.of(2027, 1, 29), BusinessDays.last(YearMonth.of(2027, 1))) // 31 = dimanche
        assertEquals(LocalDate.of(2026, 5, 29), BusinessDays.last(YearMonth.of(2026, 5)))
        assertEquals(LocalDate.of(2027, 1, 4), BusinessDays.nth(YearMonth.of(2027, 1), 1)) // 1er janvier férié
        assertEquals(LocalDate.of(2026, 5, 4), BusinessDays.nth(YearMonth.of(2026, 5), 1)) // 1er mai férié
        assertEquals(LocalDate.of(2027, 1, 6), BusinessDays.nth(YearMonth.of(2027, 1), 3))
        // Plus de jours ouvrés que le mois n'en compte : le dernier.
        assertEquals(LocalDate.of(2026, 11, 30), BusinessDays.nth(YearMonth.of(2026, 11), 40))
    }

    @Test
    fun nthWeekday() {
        assertEquals(LocalDate.of(2026, 11, 10), BusinessDays.nthWeekday(YearMonth.of(2026, 11), 2, DayOfWeek.TUESDAY))
        assertEquals(LocalDate.of(2026, 11, 27), BusinessDays.nthWeekday(YearMonth.of(2026, 11), 5, DayOfWeek.FRIDAY))
    }

    private fun monthly(start: LocalDate, rule: DayRule, n: Int = 1, weekday: Int = 1, adjust: DateAdjust = DateAdjust.NONE) =
        ScheduledOperation(
            accountId = 1, categoryId = null, kind = Kind.INCOME, amountCents = 1000,
            startDate = start, frequency = Frequency.MONTHLY, occurrences = null,
            dayRule = rule, ruleN = n, ruleWeekday = weekday, adjust = adjust,
        )

    @Test
    fun lastBusinessDayOfEachMonth() {
        val s = monthly(LocalDate.of(2026, 11, 13), DayRule.LAST_BUSINESS_DAY)
        assertEquals(
            listOf(LocalDate.of(2026, 11, 30), LocalDate.of(2026, 12, 31), LocalDate.of(2027, 1, 29)),
            Recurrence.preview(s, 3),
        )
    }

    @Test
    fun ruleBeforeStartDateBeginsNextMonth() {
        val s = monthly(LocalDate.of(2026, 11, 13), DayRule.FIRST_BUSINESS_DAY)
        assertEquals(listOf(LocalDate.of(2026, 12, 1), LocalDate.of(2027, 1, 4)), Recurrence.preview(s, 2))
        assertEquals(emptyList<LocalDate>(), Recurrence.dueDates(s, LocalDate.of(2026, 11, 30)))
    }

    @Test
    fun secondTuesday() {
        val s = monthly(LocalDate.of(2026, 11, 1), DayRule.NTH_WEEKDAY, n = 2, weekday = 2)
        assertEquals(listOf(LocalDate.of(2026, 11, 10), LocalDate.of(2026, 12, 8)), Recurrence.preview(s, 2))
    }

    @Test
    fun fixedDayShiftedToABusinessDay() {
        // Le 15 novembre 2026 est un dimanche.
        val next = monthly(LocalDate.of(2026, 11, 15), DayRule.SAME_DAY, adjust = DateAdjust.NEXT_BUSINESS_DAY)
        assertEquals(listOf(LocalDate.of(2026, 11, 16), LocalDate.of(2026, 12, 15)), Recurrence.preview(next, 2))
        val previous = monthly(LocalDate.of(2026, 11, 1), DayRule.SAME_DAY, adjust = DateAdjust.PREVIOUS_BUSINESS_DAY)
        // 1er novembre (dimanche, férié) -> vendredi 30 octobre ; 1er janvier (férié) -> 31 décembre.
        assertEquals(
            listOf(LocalDate.of(2026, 10, 30), LocalDate.of(2026, 12, 1), LocalDate.of(2026, 12, 31)),
            Recurrence.preview(previous, 3),
        )
    }

    @Test
    fun editingKeepsTheReferenceDay() {
        val s = monthly(LocalDate.of(2026, 11, 15), DayRule.SAME_DAY, adjust = DateAdjust.PREVIOUS_BUSINESS_DAY)
        // Échéance de novembre (15 = dimanche -> vendredi 13) déjà créée.
        val done = s.copy(generatedCount = 1)
        assertEquals(LocalDate.of(2026, 12, 15), Recurrence.nextAnchor(done))
        val ruled = monthly(LocalDate.of(2026, 11, 13), DayRule.FIRST_BUSINESS_DAY).copy(generatedCount = 1)
        assertEquals(LocalDate.of(2027, 1, 4), Recurrence.nextAnchor(ruled))
    }
}
