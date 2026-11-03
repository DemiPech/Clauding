package net.demipech.budget.domain

import net.demipech.budget.data.Frequency
import net.demipech.budget.data.ScheduledOperation
import java.time.LocalDate

object Recurrence {
    /** Garde-fou : une série quotidienne commencée il y a très longtemps reste bornée. */
    private const val MAX_PER_RUN = 10_000

    /**
     * Date de l'échéance n° [index] (0 = la première). Calculée depuis la date de
     * départ et non de proche en proche : une série mensuelle commencée un 31
     * tombe le 30 ou le 28/29 les mois courts, puis revient au 31.
     */
    fun occurrenceDate(start: LocalDate, frequency: Frequency, interval: Int, index: Int): LocalDate {
        val step = index.toLong() * interval.coerceAtLeast(1)
        return when (frequency) {
            Frequency.NONE -> start
            Frequency.DAILY -> start.plusDays(step)
            Frequency.WEEKLY -> start.plusWeeks(step)
            Frequency.MONTHLY -> start.plusMonths(step)
            Frequency.YEARLY -> start.plusYears(step)
        }
    }

    /** Nombre total d'échéances, null = sans fin. */
    fun total(item: ScheduledOperation): Int? =
        if (item.frequency == Frequency.NONE) 1 else item.occurrences

    /** Échéances restant à créer, null = sans fin. */
    fun remaining(item: ScheduledOperation): Int? =
        total(item)?.let { (it - item.generatedCount).coerceAtLeast(0) }

    fun isFinished(item: ScheduledOperation): Boolean = remaining(item) == 0

    /** Prochaine échéance pas encore créée, null si la série est terminée. */
    fun nextDate(item: ScheduledOperation): LocalDate? =
        if (isFinished(item)) null
        else occurrenceDate(item.startDate, item.frequency, item.interval, item.generatedCount)

    /** Échéances pas encore créées dont la date est atteinte (<= [today]). */
    fun dueDates(item: ScheduledOperation, today: LocalDate): List<LocalDate> {
        val total = total(item)
        val dates = mutableListOf<LocalDate>()
        var index = item.generatedCount
        while ((total == null || index < total) && dates.size < MAX_PER_RUN) {
            val date = occurrenceDate(item.startDate, item.frequency, item.interval, index)
            if (date.isAfter(today)) break
            dates += date
            index++
        }
        return dates
    }
}
