package net.demipech.budget.domain

import net.demipech.budget.data.DateAdjust
import net.demipech.budget.data.DayRule
import net.demipech.budget.data.Frequency
import net.demipech.budget.data.ScheduledOperation
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth

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

    /** La règle de jour ne vaut que pour les séries mensuelles et annuelles. */
    fun usesDayRule(frequency: Frequency): Boolean =
        frequency == Frequency.MONTHLY || frequency == Frequency.YEARLY

    /**
     * Le décalage jour ouvré vaut pour une date « fixe » (même jour, dernier jour
     * du mois), pas pour une série quotidienne ni pour une règle déjà ouvrée.
     */
    fun usesAdjust(frequency: Frequency, rule: DayRule): Boolean =
        frequency != Frequency.DAILY &&
            (!usesDayRule(frequency) || rule == DayRule.SAME_DAY || rule == DayRule.LAST_DAY)

    /** Applique la règle de jour puis le décalage à une date de base. */
    private fun resolve(item: ScheduledOperation, base: LocalDate, withAdjust: Boolean = true): LocalDate {
        val month = YearMonth.from(base)
        val ruled = if (!usesDayRule(item.frequency)) base else when (item.dayRule) {
            DayRule.SAME_DAY -> base
            DayRule.LAST_DAY -> month.atEndOfMonth()
            DayRule.FIRST_BUSINESS_DAY -> BusinessDays.nth(month, 1)
            DayRule.LAST_BUSINESS_DAY -> BusinessDays.last(month)
            DayRule.NTH_BUSINESS_DAY -> BusinessDays.nth(month, item.ruleN)
            DayRule.NTH_WEEKDAY -> BusinessDays.nthWeekday(month, item.ruleN, DayOfWeek.of(item.ruleWeekday.coerceIn(1, 7)))
        }
        if (!withAdjust || !usesAdjust(item.frequency, item.dayRule)) return ruled
        return when (item.adjust) {
            DateAdjust.NONE -> ruled
            DateAdjust.NEXT_BUSINESS_DAY -> BusinessDays.onOrAfter(ruled)
            DateAdjust.PREVIOUS_BUSINESS_DAY -> BusinessDays.onOrBefore(ruled)
        }
    }

    /**
     * Date réelle de l'échéance n° [index] d'une série, règle de jour et décalage
     * compris. Si la règle de jour place la première échéance avant la date de départ
     * (ex. « 1er jour ouvré » choisi le 13), la série commence au mois suivant.
     */
    fun occurrence(item: ScheduledOperation, index: Int): LocalDate =
        resolve(item, baseDate(item, index))

    /** Date de base (avant règle de jour et décalage) de l'échéance n° [index]. */
    private fun baseDate(item: ScheduledOperation, index: Int): LocalDate {
        fun base(k: Int) = occurrenceDate(item.startDate, item.frequency, item.interval, k)
        // Seule la règle de jour peut repousser le départ au mois suivant ; un décalage
        // au jour ouvré précédent garde l'échéance du mois de départ.
        val skipFirst = item.frequency != Frequency.NONE &&
            resolve(item, base(0), withAdjust = false).isBefore(item.startDate)
        return base(if (skipFirst) index + 1 else index)
    }

    /**
     * Date à proposer comme point de départ quand on modifie la suite d'une série.
     * Pour une date « fixe » (même jour, dernier jour du mois), c'est la date avant
     * décalage, pour que « le 15, jour ouvré précédent » ne devienne pas « le 13 ».
     * Pour une règle (jour ouvré, 2ᵉ mardi…), c'est la prochaine échéance réelle.
     */
    fun nextAnchor(item: ScheduledOperation): LocalDate? {
        if (isFinished(item)) return null
        val fixedDay = !usesDayRule(item.frequency) || item.dayRule == DayRule.SAME_DAY || item.dayRule == DayRule.LAST_DAY
        return if (fixedDay) baseDate(item, item.generatedCount) else nextDate(item)
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
        else occurrence(item, item.generatedCount)

    /** Les [count] prochaines échéances pas encore créées (aperçu dans le formulaire). */
    fun preview(item: ScheduledOperation, count: Int): List<LocalDate> {
        val total = total(item)
        val end = if (total == null) item.generatedCount + count else minOf(total, item.generatedCount + count)
        return (item.generatedCount until end).map { occurrence(item, it) }
    }

    /** Échéances pas encore créées dont la date est atteinte (<= [today]). */
    fun dueDates(item: ScheduledOperation, today: LocalDate): List<LocalDate> {
        val total = total(item)
        val dates = mutableListOf<LocalDate>()
        var index = item.generatedCount
        while ((total == null || index < total) && dates.size < MAX_PER_RUN) {
            val date = occurrence(item, index)
            if (date.isAfter(today)) break
            dates += date
            index++
        }
        return dates
    }

    /**
     * Échéances pas encore créées dont la date tombe entre [from] et [to] inclus :
     * ce qui est encore à venir sur une période (bandeau « Récurrences », prévisions).
     */
    fun pendingBetween(item: ScheduledOperation, from: LocalDate, to: LocalDate): List<LocalDate> {
        val total = total(item)
        val dates = mutableListOf<LocalDate>()
        var index = item.generatedCount
        var steps = 0
        while ((total == null || index < total) && steps++ < MAX_PER_RUN) {
            val date = occurrence(item, index)
            if (date.isAfter(to)) break
            if (!date.isBefore(from)) dates += date
            index++
        }
        return dates
    }
}
