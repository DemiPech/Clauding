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
