package net.demipech.budget.domain

import net.demipech.budget.data.Kind
import net.demipech.budget.data.Operation
import net.demipech.budget.data.OperationDetails
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.YearMonth

class EstimationTest {
    private fun op(kind: Kind, cents: Long, date: LocalDate, rootId: Long?, name: String? = null, transfer: Long? = null) =
        OperationDetails(
            operation = Operation(accountId = 1, categoryId = rootId, kind = kind, amountCents = cents, date = date, transferId = transfer),
            accountName = "Compte", accountColor = 0, categoryName = name, subcategoryName = null,
            categoryEmoji = null, categoryColor = null, rootCategoryId = rootId, scheduledFrequency = null, scheduledInterval = null,
        )

    private val current = YearMonth.of(2026, 11)

    @Test
    fun windowKeepsOnlyFinishedMonthsSinceTheFirstData() {
        val ops = listOf(op(Kind.EXPENSE, 100, LocalDate.of(2026, 8, 3), 1))
        assertEquals(
            listOf(YearMonth.of(2026, 8), YearMonth.of(2026, 9), YearMonth.of(2026, 10)),
            Estimation.window(ops, current, 12),
        )
        assertEquals(listOf(YearMonth.of(2026, 9), YearMonth.of(2026, 10)), Estimation.window(ops, current, 2))
        assertEquals(emptyList<YearMonth>(), Estimation.window(emptyList(), current, 12))
    }

    @Test
    fun averagesPerCategoryWithoutUncategorizedOrTransfers() {
        val months = listOf(YearMonth.of(2026, 9), YearMonth.of(2026, 10))
        val ops = listOf(
            op(Kind.EXPENSE, 30000, LocalDate.of(2026, 9, 5), 1, "Alimentation"),
            op(Kind.EXPENSE, 20000, LocalDate.of(2026, 10, 5), 1, "Alimentation"),
            op(Kind.EXPENSE, 6000, LocalDate.of(2026, 10, 9), 2, "Loisirs"), // un seul mois : moyenne 30 €
            op(Kind.EXPENSE, 99999, LocalDate.of(2026, 10, 1), null), // sans catégorie : ignorée
            op(Kind.EXPENSE, 50000, LocalDate.of(2026, 10, 2), null, transfer = 4), // virement : ignoré
            op(Kind.INCOME, 250000, LocalDate.of(2026, 10, 28), 3, "Salaire"), // rentrée : ignorée
            op(Kind.EXPENSE, 7777, LocalDate.of(2026, 11, 2), 1, "Alimentation"), // mois en cours : hors période
        )
        val estimate = Estimation.estimate(ops, months)
        assertEquals(28000L, estimate.totalCents) // (300 + 200 + 60) / 2
        assertEquals(listOf("Alimentation", "Loisirs"), estimate.categories.map { it.name })
        assertEquals(listOf(25000L, 3000L), estimate.categories.map { it.averageCents })
        assertEquals(listOf(2, 1), estimate.categories.map { it.activeMonths })
    }

    @Test
    fun suggestedBudgetRoundsUpToFiveEuros() {
        assertEquals(25000L, Estimation.suggestedBudget(25000))
        assertEquals(25500L, Estimation.suggestedBudget(25001))
        assertEquals(500L, Estimation.suggestedBudget(1))
    }
}
