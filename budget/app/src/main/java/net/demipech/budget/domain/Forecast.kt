package net.demipech.budget.domain

import net.demipech.budget.data.Kind
import net.demipech.budget.data.OperationDetails
import net.demipech.budget.data.ScheduledDetails
import net.demipech.budget.data.isTransfer
import net.demipech.budget.data.signedCentsFor
import java.time.LocalDate

/**
 * Une échéance planifiée pas encore créée ; [signedCents] est vu du compte filtré
 * (un virement est neutre quand on regarde tous les comptes).
 */
data class Upcoming(val details: ScheduledDetails, val date: LocalDate, val signedCents: Long)

/** Part d'une catégorie principale dans les dépenses (ou rentrées) d'une période. */
data class Slice(
    val categoryId: Long?,
    val name: String,
    val emoji: String,
    val color: Long?,
    val cents: Long,
)

object Forecast {
    /**
     * Échéances à venir entre [from] et [to], dans l'ordre chronologique, vues du
     * compte [accountId] (null = tous les comptes).
     */
    fun upcoming(items: List<ScheduledDetails>, from: LocalDate, to: LocalDate, accountId: Long? = null): List<Upcoming> =
        items.flatMap { d ->
            val signed = d.scheduled.signedCentsFor(accountId)
            Recurrence.pendingBetween(d.scheduled, from, to).map { Upcoming(d, it, signed) }
        }.sortedBy { it.date }

    /**
     * Répartition par catégorie principale (les sous-catégories sont regroupées
     * dans leur parente), de la plus grosse à la plus petite.
     */
    fun breakdown(operations: List<OperationDetails>, kind: Kind): List<Slice> =
        operations.filter { it.operation.kind == kind && !it.operation.isTransfer }
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
