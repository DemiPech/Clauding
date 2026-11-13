package net.demipech.budget.domain

import net.demipech.budget.data.Frequency
import net.demipech.budget.data.Kind
import net.demipech.budget.data.Operation
import net.demipech.budget.data.OperationDetails
import net.demipech.budget.data.ScheduledDetails
import net.demipech.budget.data.ScheduledOperation
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class ForecastTest {
    private fun op(kind: Kind, cents: Long, rootId: Long?, name: String?) = OperationDetails(
        operation = Operation(accountId = 1, categoryId = rootId, kind = kind, amountCents = cents, date = LocalDate.of(2026, 11, 1)),
        accountName = "Compte",
        accountColor = 0,
        categoryName = name,
        subcategoryName = null,
        categoryEmoji = null,
        categoryColor = null,
        rootCategoryId = rootId,
        scheduledFrequency = null,
        scheduledInterval = null,
    )

    @Test
    fun breakdownGroupsByRootCategoryAndSortsDescending() {
        val ops = listOf(
            op(Kind.EXPENSE, 1000, 1, "Loisirs"),
            op(Kind.EXPENSE, 2500, 2, "Logement"),
            op(Kind.EXPENSE, 700, 1, "Loisirs"),
            op(Kind.EXPENSE, 300, null, null),
            op(Kind.INCOME, 9999, 3, "Salaire"),
        )
        val slices = Forecast.breakdown(ops, Kind.EXPENSE)
        assertEquals(listOf("Logement", "Loisirs", "Sans catégorie"), slices.map { it.name })
        assertEquals(listOf(2500L, 1700L, 300L), slices.map { it.cents })
    }

    @Test
    fun upcomingIsChronologicalAcrossSchedules() {
        fun details(start: LocalDate, kind: Kind, note: String) = ScheduledDetails(
            scheduled = ScheduledOperation(
                accountId = 1, categoryId = null, kind = kind, amountCents = 1000, note = note,
                startDate = start, frequency = Frequency.MONTHLY, occurrences = null,
            ),
            accountName = "Compte", categoryName = null, subcategoryName = null, categoryEmoji = null, categoryColor = null,
        )
        val items = listOf(
            details(LocalDate.of(2026, 11, 20), Kind.EXPENSE, "Loyer"),
            details(LocalDate.of(2026, 11, 5), Kind.INCOME, "Salaire"),
        )
        val upcoming = Forecast.upcoming(items, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 12, 31))
        assertEquals(listOf("Salaire", "Loyer", "Salaire", "Loyer"), upcoming.map { it.details.scheduled.note })
        assertEquals(0L, upcoming.sumOf { it.signedCents })
    }
}
