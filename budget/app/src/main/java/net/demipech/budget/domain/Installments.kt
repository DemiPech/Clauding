package net.demipech.budget.domain

import net.demipech.budget.data.Frequency
import java.time.LocalDate

/** Calcul d'un échéancier de paiement en plusieurs fois. */
object Installments {
    /**
     * Répartit [totalCents] en [count] paiements égaux ; les centimes qui restent
     * vont sur le premier (100 € en 3 fois : 33,34 + 33,33 + 33,33).
     */
    fun split(totalCents: Long, count: Int): List<Long> {
        if (count < 1) return emptyList()
        val base = totalCents / count
        val rest = totalCents - base * count
        return List(count) { if (it == 0) base + rest else base }
    }

    /**
     * Dates de [count] paiements : [first] s'il est donné, puis les suivants à partir
     * de [next], tous les [interval] jours / semaines / mois.
     */
    fun dates(first: LocalDate?, next: LocalDate, count: Int, frequency: Frequency, interval: Int): List<LocalDate> {
        if (count < 1) return emptyList()
        val following = if (first != null) count - 1 else count
        val rest = List(following) { Recurrence.occurrenceDate(next, frequency, interval, it) }
        return if (first != null) listOf(first) + rest else rest
    }
}
