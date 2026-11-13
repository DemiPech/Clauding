package net.demipech.budget.domain

import net.demipech.budget.data.Kind
import net.demipech.budget.data.OperationDetails
import net.demipech.budget.data.ScheduledDetails
import net.demipech.budget.data.signedCents
import java.time.LocalDate

/** Une échéance planifiée pas encore créée. */
data class Upcoming(val details: ScheduledDetails, val date: LocalDate) {
    val signedCents: Long get() = details.scheduled.signedCents
}

/** Part d'une catégorie principale dans les dépenses (ou rentrées) d'une période. */
data class Slice(
    val categoryId: Long?,
    val name: String,
    val emoji: String,
    val color: Long?,
    val cents: Long,
)

object Forecast {
    /** Échéances à venir entre [from] et [to], dans l'ordre chronologique. */
    fun upcoming(items: List<ScheduledDetails>, from: LocalDate, to: LocalDate): List<Upcoming> =
        items.flatMap { d -> Recurrence.pendingBetween(d.scheduled, from, to).map { Upcoming(d, it) } }
            .sortedBy { it.date }

    /**
     * Répartition par catégorie principale (les sous-catégories sont regroupées
     * dans leur parente), de la plus grosse à la plus petite.
     */
    fun breakdown(operations: List<OperationDetails>, kind: Kind): List<Slice> =
        operations.filter { it.operation.kind == kind }
            .groupBy { it.rootCategoryId }
            .map { (id, ops) ->
                val first = ops.first()
                Slice(
                    categoryId = id,
                    name = first.categoryName ?: "Sans catégorie",
                    emoji = first.categoryEmoji.orEmpty(),
                    color = first.categoryColor,
                    cents = ops.sumOf { it.operation.amountCents },
                )
            }
            .sortedByDescending { it.cents }
}
