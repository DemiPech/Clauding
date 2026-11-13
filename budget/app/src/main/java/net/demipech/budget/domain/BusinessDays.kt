package net.demipech.budget.domain

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.MonthDay
import java.time.YearMonth
import java.time.temporal.TemporalAdjusters
import java.util.concurrent.ConcurrentHashMap

/**
 * Jours ouvrés : du lundi au vendredi, hors jours fériés français
 * (1er janvier, lundi de Pâques, 1er et 8 mai, Ascension, lundi de Pentecôte,
 * 14 juillet, 15 août, 1er et 11 novembre, 25 décembre).
 */
object BusinessDays {
    private val fixedHolidays = listOf(
        MonthDay.of(1, 1), MonthDay.of(5, 1), MonthDay.of(5, 8), MonthDay.of(7, 14),
        MonthDay.of(8, 15), MonthDay.of(11, 1), MonthDay.of(11, 11), MonthDay.of(12, 25),
    )
    private val cache = ConcurrentHashMap<Int, Set<LocalDate>>()

    /** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher, calendrier grégorien). */
    fun easter(year: Int): LocalDate {
        val a = year % 19
        val b = year / 100
        val c = year % 100
        val d = b / 4
        val e = b % 4
        val f = (b + 8) / 25
        val g = (b - f + 1) / 3
        val h = (19 * a + b - d - g + 15) % 30
        val i = c / 4
        val k = c % 4
        val l = (32 + 2 * e + 2 * i - h - k) % 7
        val m = (a + 11 * h + 22 * l) / 451
        val month = (h + l - 7 * m + 114) / 31
        val day = (h + l - 7 * m + 114) % 31 + 1
        return LocalDate.of(year, month, day)
    }

    fun holidays(year: Int): Set<LocalDate> = cache.getOrPut(year) {
        val easter = easter(year)
        fixedHolidays.map { it.atYear(year) }.toSet() +
            setOf(easter.plusDays(1), easter.plusDays(39), easter.plusDays(50))
    }

    fun isBusinessDay(date: LocalDate): Boolean =
        date.dayOfWeek != DayOfWeek.SATURDAY && date.dayOfWeek != DayOfWeek.SUNDAY &&
            date !in holidays(date.year)

    /** [date] si c'est un jour ouvré, sinon le suivant. */
    fun onOrAfter(date: LocalDate): LocalDate {
        var d = date
        while (!isBusinessDay(d)) d = d.plusDays(1)
        return d
    }

    /** [date] si c'est un jour ouvré, sinon le précédent. */
    fun onOrBefore(date: LocalDate): LocalDate {
        var d = date
        while (!isBusinessDay(d)) d = d.minusDays(1)
        return d
    }

    /** Nᵉ jour ouvré du mois ; le dernier si le mois en compte moins de N. */
    fun nth(month: YearMonth, n: Int): LocalDate {
        var d = onOrAfter(month.atDay(1))
        repeat(n.coerceAtLeast(1) - 1) {
            val next = onOrAfter(d.plusDays(1))
            if (YearMonth.from(next) != month) return d
            d = next
        }
        return d
    }

    fun last(month: YearMonth): LocalDate = onOrBefore(month.atEndOfMonth())

    /** Nᵉ [weekday] du mois (n = 1 à 4), ou le dernier pour n >= 5. */
    fun nthWeekday(month: YearMonth, n: Int, weekday: DayOfWeek): LocalDate =
        if (n >= 5) month.atEndOfMonth().with(TemporalAdjusters.lastInMonth(weekday))
        else month.atDay(1).with(TemporalAdjusters.dayOfWeekInMonth(n.coerceAtLeast(1), weekday))
}
