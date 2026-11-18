package net.demipech.budget.domain

import net.demipech.budget.data.Kind
import net.demipech.budget.data.Operation
import net.demipech.budget.data.OperationDetails
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDate
import java.time.YearMonth

class EstimationTest {
    private fun op(
        kind: Kind, cents: Long, date: LocalDate, rootId: Long?, name: String? = null,
        transfer: Long? = null, scheduled: Long? = null,
    ) = OperationDetails(
        operation = Operation(
            accountId = 1, categoryId = rootId, kind = kind, amountCents = cents, date = date,
            transferId = transfer, scheduledId = scheduled,
        ),
        accountName = "Compte", accountColor = 0, categoryName = name, subcategoryName = null,
        categoryEmoji = null, categoryColor = null, rootCategoryId = rootId, scheduledFrequency = null, scheduledInterval = null,
    )

    private val current = YearMonth.of(2026, 11)
    private fun d(m: Int, day: Int = 5) = LocalDate.of(2026, m, day)

    @Test
    fun windowKeepsOnlyFinishedMonthsSinceTheFirstData() {
        val ops = listOf(op(Kind.EXPENSE, 100, d(8, 3), 1))
        assertEquals(listOf(YearMonth.of(2026, 8), YearMonth.of(2026, 9), YearMonth.of(2026, 10)), Estimation.window(ops, current, 12))
        assertEquals(listOf(YearMonth.of(2026, 9), YearMonth.of(2026, 10)), Estimation.window(ops, current, 2))
        assertEquals(emptyList<YearMonth>(), Estimation.window(emptyList(), current, 12))
    }

    @Test
    fun averagesPerCategoryWithoutUncategorizedOrTransfers() {
        val months = listOf(YearMonth.of(2026, 9), YearMonth.of(2026, 10))
        val ops = listOf(
            op(Kind.EXPENSE, 30000, d(9), 1, "Alimentation"),
            op(Kind.EXPENSE, 20000, d(10), 1, "Alimentation"),
            op(Kind.EXPENSE, 6000, d(10, 9), 2, "Loisirs", scheduled = 8), // planifiée : fixe
            op(Kind.EXPENSE, 99999, d(10, 1), null), // sans catégorie : ignorée
            op(Kind.EXPENSE, 50000, d(10, 2), null, transfer = 4), // virement : ignoré
            op(Kind.INCOME, 250000, d(10, 28), 3, "Salaire"), // rentrée : ignorée
            op(Kind.EXPENSE, 7777, d(11, 2), 1, "Alimentation"), // mois en cours : hors période
        )
        val estimate = Estimation.estimate(ops, months)
        assertEquals(28000L, estimate.totalCents) // (300 + 200 + 60) / 2
        assertEquals(3000L, estimate.fixedCents)
        assertEquals(25000L, estimate.variableCents)
        assertEquals(listOf("Alimentation", "Loisirs"), estimate.categories.map { it.name })
        assertEquals(listOf(25000L, 3000L), estimate.categories.map { it.averageCents })
        assertEquals(listOf(2, 1), estimate.categories.map { it.activeMonths })
        assertEquals(3000L, estimate.categories[1].fixedCents)
        assertNull(estimate.categories[0].trendPercent) // 2 mois seulement : pas de tendance
    }

    @Test
    fun medianIgnoresAnExceptionalMonth() {
        val months = (5..10).map { YearMonth.of(2026, it) }
        val ops = (5..10).map { m -> op(Kind.EXPENSE, if (m == 7) 60000 else 10000, d(m), 1, "Maison") }
        assertEquals(18333L, Estimation.estimate(ops, months, EstimateMethod.MEAN).totalCents)
        assertEquals(10000L, Estimation.estimate(ops, months, EstimateMethod.MEDIAN).totalCents)
        assertEquals(10000L, Estimation.summarize(listOf(0, 10000, 10000, 20000), EstimateMethod.MEDIAN))
        assertEquals(5000L, Estimation.summarize(listOf(0, 10000), EstimateMethod.MEDIAN))
    }

    @Test
    fun trendComparesTheLastThreeMonthsToThePeriod() {
        val months = (5..10).map { YearMonth.of(2026, it) }
        // 100 € par mois de mai à juillet, puis 160 € : moyenne 130 €, 3 derniers mois 160 € → +23 %
        val ops = (5..10).map { m -> op(Kind.EXPENSE, if (m <= 7) 10000 else 16000, d(m), 1, "Courses") }
        assertEquals(23, Estimation.estimate(ops, months).categories.single().trendPercent)
    }

    @Test
    fun endOfMonthProjection() {
        // Le 10 novembre (30 jours) : 400 € dépensés, 150 € de planifié à venir, 600 € de courant habituel
        // → 400 + 150 + 600 × 20/30 = 950 €
        assertEquals(95000L, Estimation.endOfMonth(40000, 15000, 60000, LocalDate.of(2026, 11, 10)))
        assertEquals(55000L, Estimation.endOfMonth(40000, 15000, 60000, LocalDate.of(2026, 11, 30)))
    }

    @Test
    fun variableMovesSpreadTheEstimateOverTheDays() {
        val today = LocalDate.of(2026, 11, 20)
        // Novembre : 600 € estimés, 450 € déjà dépensés → 150 € sur les 10 jours restants.
        // Décembre : 600 € répartis sur 31 jours.
        val moves = Estimation.variableMoves(1, 60000, 45000, today, LocalDate.of(2026, 12, 31))
        val november = moves.filter { it.date.monthValue == 11 }
        val december = moves.filter { it.date.monthValue == 12 }
        assertEquals(10, november.size)
        assertEquals(-15000L, november.sumOf { it.cents })
        assertEquals(31, december.size)
        assertEquals(-60000L, december.sumOf { it.cents })
        assertEquals(LocalDate.of(2026, 11, 21), moves.first().date)
        // Déjà plus dépensé que l'estimation : rien pour le reste du mois.
        assertEquals(0, Estimation.variableMoves(1, 60000, 70000, today, LocalDate.of(2026, 11, 30)).size)
    }

    @Test
    fun suggestedBudgetRoundsUpToFiveEuros() {
        assertEquals(25000L, Estimation.suggestedBudget(25000))
        assertEquals(25500L, Estimation.suggestedBudget(25001))
        assertEquals(500L, Estimation.suggestedBudget(1))
    }
}
