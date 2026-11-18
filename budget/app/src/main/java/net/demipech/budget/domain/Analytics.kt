package net.demipech.budget.domain

import net.demipech.budget.data.Kind
import net.demipech.budget.data.OperationDetails
import net.demipech.budget.data.isTransfer
import java.text.Normalizer
import java.time.LocalDate
import java.time.YearMonth

/** Revenus et dépenses d'une période (virements exclus). */
data class Totals(val income: Long, val expense: Long) {
    val net: Long get() = income - expense
}

data class MonthTotals(val month: YearMonth, val totals: Totals)

/** État d'un budget : sous 80 %, entre 80 et 100 %, dépassé. */
enum class BudgetLevel { OK, WARNING, OVER }

/** Un point de la courbe de solde prévisionnel. */
data class BalancePoint(val date: LocalDate, val cents: Long)

object Analytics {
    fun totals(operations: List<OperationDetails>): Totals {
        val ops = operations.filter { !it.operation.isTransfer }
        return Totals(
            income = ops.filter { it.operation.kind == Kind.INCOME }.sumOf { it.operation.amountCents },
            expense = ops.filter { it.operation.kind == Kind.EXPENSE }.sumOf { it.operation.amountCents },
        )
    }

    /** Totaux mois par mois, y compris les mois sans opération. */
    fun monthly(operations: List<OperationDetails>, months: List<YearMonth>): List<MonthTotals> {
        val byMonth = operations.groupBy { YearMonth.from(it.operation.date) }
        return months.map { MonthTotals(it, totals(byMonth[it].orEmpty())) }
    }

    fun budgetLevel(spentCents: Long, budgetCents: Long): BudgetLevel = when {
        budgetCents <= 0 -> BudgetLevel.OK
        spentCents > budgetCents -> BudgetLevel.OVER
        spentCents * 100 >= budgetCents * 80 -> BudgetLevel.WARNING
        else -> BudgetLevel.OK
    }

    /**
     * Solde jour par jour de [from] à [from] + [days] : on part de [startCents] et on
     * ajoute chaque mouvement prévu ([events], montants signés) à sa date.
     */
    fun projection(startCents: Long, events: List<Pair<LocalDate, Long>>, from: LocalDate, days: Int): List<BalancePoint> {
        val byDay = events.groupBy({ it.first }, { it.second }).mapValues { it.value.sum() }
        var balance = startCents + events.filter { it.first.isBefore(from) }.sumOf { it.second }
        return (0..days).map { offset ->
            val day = from.plusDays(offset.toLong())
            balance += byDay[day] ?: 0
            BalancePoint(day, balance)
        }
    }

    /** Minuscules sans accents, pour chercher « sante » dans « Santé ». */
    fun normalize(text: String): String =
        Normalizer.normalize(text, Normalizer.Form.NFD).replace(Regex("\\p{Mn}+"), "").lowercase().trim()

    /** Vrai si tous les mots de [query] se trouvent dans le libellé, la catégorie ou le compte. */
    fun matches(op: OperationDetails, query: String): Boolean {
        val words = normalize(query).split(Regex("\\s+")).filter { it.isNotEmpty() }
        if (words.isEmpty()) return true
        val haystack = normalize(
            listOfNotNull(
                op.operation.note, op.categoryName, op.subcategoryName, op.accountName, op.transferAccountName,
                Money.plain(op.operation.amountCents),
            ).joinToString(" ")
        )
        return words.all { it in haystack }
    }

    /** Détail d'une catégorie principale par sous-catégorie (nom null = la catégorie elle-même). */
    fun subBreakdown(operations: List<OperationDetails>, rootId: Long?, kind: Kind): List<Pair<String?, Long>> =
        operations.filter { it.rootCategoryId == rootId && it.operation.kind == kind && !it.operation.isTransfer }
            .groupBy { it.subcategoryName }
            .map { (name, ops) -> name to ops.sumOf { it.operation.amountCents } }
            .sortedByDescending { it.second }
}

/**
 * Un mouvement prévu sur un compte. [coverable] = dépense planifiée que le compte
 * de secours complète si le solde ne suffit pas.
 */
data class PlannedMove(val date: LocalDate, val accountId: Long, val cents: Long, val coverable: Boolean = false)

object Fallback {
    /**
     * Part d'un paiement de [amountCents] qui doit venir du compte de secours quand
     * le compte a [balanceCents] : rien si le solde suffit, tout s'il est à zéro ou
     * négatif, sinon le manque (20 € avec 15 € de solde : 5 €).
     */
    fun shortfall(balanceCents: Long, amountCents: Long): Long =
        (amountCents - balanceCents.coerceAtLeast(0)).coerceIn(0, amountCents)

    /**
     * Solde jour par jour de chaque compte, de [from] à [from] + [days], en appliquant
     * les mouvements prévus et les compléments automatiques ([fallbackOf] : compte →
     * compte de secours).
     */
    fun simulate(
        start: Map<Long, Long>,
        moves: List<PlannedMove>,
        fallbackOf: Map<Long, Long>,
        from: LocalDate,
        days: Int,
    ): Map<Long, List<BalancePoint>> {
        val balances = start.toMutableMap()
        val series = start.keys.associateWith { mutableListOf<BalancePoint>() }
        val byDay = moves.groupBy { if (it.date.isBefore(from)) from else it.date }
        for (offset in 0..days) {
            val day = from.plusDays(offset.toLong())
            byDay[day].orEmpty().forEach { move ->
                val balance = balances[move.accountId] ?: 0
                val backup = fallbackOf[move.accountId]?.takeIf { it != move.accountId && it in balances }
                if (move.coverable && move.cents < 0 && backup != null) {
                    val missing = shortfall(balance, -move.cents)
                    balances[move.accountId] = balance + move.cents + missing
                    balances[backup] = (balances[backup] ?: 0) - missing
                } else {
                    balances[move.accountId] = balance + move.cents
                }
            }
            series.forEach { (id, points) -> points += BalancePoint(day, balances[id] ?: 0) }
        }
        return series
    }
}

object Estimates {
    /** Combien de montants confirmés servent à estimer un montant variable. */
    const val SAMPLE = 3

    /**
     * Moyenne arrondie au centime des derniers montants confirmés (les plus récents
     * en premier), null s'il n'y en a aucun.
     */
    fun average(recentAmounts: List<Long>): Long? {
        val sample = recentAmounts.take(SAMPLE)
        if (sample.isEmpty()) return null
        return (sample.sum() * 2 + sample.size) / (sample.size * 2)
    }
}

/** Dépense mensuelle moyenne d'une catégorie principale. */
data class CategoryAverage(
    val categoryId: Long,
    val name: String,
    val emoji: String,
    val color: Long?,
    val averageCents: Long,
    /** Nombre de mois (sur la période) où la catégorie a eu des dépenses. */
    val activeMonths: Int,
)

/** Estimation des dépenses d'un mois, d'après la moyenne des mois passés. */
data class MonthlyEstimate(
    /** Mois réellement pris en compte (terminés, depuis le premier mois avec des données). */
    val months: List<YearMonth>,
    val totalCents: Long,
    val categories: List<CategoryAverage>,
)

object Estimation {
    /**
     * Les [count] derniers mois terminés avant [current], en ne gardant que ceux à partir
     * du premier mois où il y a des opérations (on ne divise pas par des mois vides
     * d'avant l'usage de l'app).
     */
    fun window(operations: List<OperationDetails>, current: YearMonth, count: Int): List<YearMonth> {
        val candidates = (count downTo 1).map { current.minusMonths(it.toLong()) }
        val first = operations.minOfOrNull { YearMonth.from(it.operation.date) } ?: return emptyList()
        return candidates.filter { !it.isBefore(first) }
    }

    /**
     * Moyenne mensuelle des dépenses sur [months], globale et par catégorie principale,
     * sans les dépenses sans catégorie ni les virements. Arrondie au centime.
     */
    fun estimate(operations: List<OperationDetails>, months: List<YearMonth>): MonthlyEstimate {
        if (months.isEmpty()) return MonthlyEstimate(months, 0, emptyList())
        val set = months.toSet()
        val expenses = operations.filter {
            it.operation.kind == Kind.EXPENSE && !it.operation.isTransfer && it.rootCategoryId != null &&
                YearMonth.from(it.operation.date) in set
        }
        val n = months.size
        fun avg(total: Long) = (total * 2 + n) / (n * 2)
        val categories = expenses.groupBy { it.rootCategoryId!! }.map { (id, ops) ->
            val first = ops.first()
            CategoryAverage(
                categoryId = id,
                name = first.categoryName.orEmpty(),
                emoji = first.categoryEmoji.orEmpty(),
                color = first.categoryColor,
                averageCents = avg(ops.sumOf { it.operation.amountCents }),
                activeMonths = ops.map { YearMonth.from(it.operation.date) }.distinct().size,
            )
        }.sortedByDescending { it.averageCents }
        return MonthlyEstimate(months, avg(expenses.sumOf { it.operation.amountCents }), categories)
    }

    /** Montant de budget proposé à partir d'une moyenne : arrondi aux 5 € supérieurs. */
    fun suggestedBudget(averageCents: Long): Long = ((averageCents + 499) / 500) * 500
}
