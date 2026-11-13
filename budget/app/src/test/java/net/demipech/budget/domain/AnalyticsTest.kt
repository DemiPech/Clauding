package net.demipech.budget.domain

import net.demipech.budget.data.Kind
import net.demipech.budget.data.Operation
import net.demipech.budget.data.OperationDetails
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.YearMonth

class AnalyticsTest {
    private fun op(
        kind: Kind, cents: Long, date: LocalDate, note: String = "", category: String? = null,
        sub: String? = null, rootId: Long? = null, transfer: Long? = null,
    ) = OperationDetails(
        operation = Operation(accountId = 1, categoryId = rootId, kind = kind, amountCents = cents, date = date, note = note, transferId = transfer),
        accountName = "Boursorama", accountColor = 0, categoryName = category, subcategoryName = sub,
        categoryEmoji = null, categoryColor = null, rootCategoryId = rootId, scheduledFrequency = null, scheduledInterval = null,
    )

    private val nov = LocalDate.of(2026, 11, 10)
    private val oct = LocalDate.of(2026, 10, 10)

    @Test
    fun monthlyTotalsSkipTransfersAndKeepEmptyMonths() {
        val ops = listOf(
            op(Kind.INCOME, 250000, nov), op(Kind.EXPENSE, 11000, nov), op(Kind.EXPENSE, 50000, nov, transfer = 9),
            op(Kind.EXPENSE, 3000, oct),
        )
        val months = listOf(YearMonth.of(2026, 9), YearMonth.of(2026, 10), YearMonth.of(2026, 11))
        val result = Analytics.monthly(ops, months)
        assertEquals(listOf(0L, 0L, 250000L), result.map { it.totals.income })
        assertEquals(listOf(0L, 3000L, 11000L), result.map { it.totals.expense })
        assertEquals(239000L, result.last().totals.net)
    }

    @Test
    fun budgetLevels() {
        assertEquals(BudgetLevel.OK, Analytics.budgetLevel(7900, 10000))
        assertEquals(BudgetLevel.WARNING, Analytics.budgetLevel(8000, 10000))
        assertEquals(BudgetLevel.WARNING, Analytics.budgetLevel(10000, 10000))
        assertEquals(BudgetLevel.OVER, Analytics.budgetLevel(10001, 10000))
    }

    @Test
    fun projectionAddsEventsDayByDay() {
        val from = LocalDate.of(2026, 11, 13)
        val points = Analytics.projection(
            startCents = 10000,
            events = listOf(from.plusDays(2) to -6000L, from.plusDays(2) to -5000L, from.plusDays(4) to 20000L),
            from = from,
            days = 5,
        )
        assertEquals(listOf(10000L, 10000L, -1000L, -1000L, 19000L, 19000L), points.map { it.cents })
        assertEquals(from.plusDays(5), points.last().date)
    }

    @Test
    fun searchIgnoresCaseAndAccentsAndNeedsAllWords() {
        val o = op(Kind.EXPENSE, 1615, nov, note = "mkm cartes", category = "Loisirs", sub = "Jeux")
        assertTrue(Analytics.matches(o, "MKM"))
        assertTrue(Analytics.matches(o, "loisirs jeux"))
        assertTrue(Analytics.matches(o, "boursorama"))
        assertTrue(Analytics.matches(o, "16,15"))
        assertFalse(Analytics.matches(o, "mkm santé"))
        assertTrue(Analytics.matches(op(Kind.EXPENSE, 100, nov, category = "Santé"), "sante"))
    }

    @Test
    fun subBreakdownOfACategory() {
        val ops = listOf(
            op(Kind.EXPENSE, 1199, nov, category = "Loisirs", sub = "Abonnements", rootId = 1),
            op(Kind.EXPENSE, 360, nov, category = "Loisirs", sub = "Abonnements", rootId = 1),
            op(Kind.EXPENSE, 2000, nov, category = "Loisirs", rootId = 1),
            op(Kind.EXPENSE, 9999, nov, category = "Logement", rootId = 2),
        )
        assertEquals(listOf<Pair<String?, Long>>(null to 2000L, "Abonnements" to 1559L), Analytics.subBreakdown(ops, 1, Kind.EXPENSE))
    }
}
