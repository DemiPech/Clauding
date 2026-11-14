package net.demipech.budget.domain

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class FallbackTest {
    @Test
    fun shortfall() {
        assertEquals(0L, Fallback.shortfall(5000, 2000))
        assertEquals(0L, Fallback.shortfall(2000, 2000))
        assertEquals(500L, Fallback.shortfall(1500, 2000)) // 15 € de solde, paiement de 20 € : 5 € du secours
        assertEquals(2000L, Fallback.shortfall(0, 2000))
        assertEquals(2000L, Fallback.shortfall(-3000, 2000))
    }

    @Test
    fun simulationTopsUpFromTheBackupAccount() {
        val day = LocalDate.of(2026, 11, 14)
        val series = Fallback.simulate(
            start = mapOf(1L to 1500L, 2L to 10000L, 3L to 0L),
            moves = listOf(
                PlannedMove(day.plusDays(1), 1, -2000, coverable = true), // 15 € puis 5 € du compte 2
                PlannedMove(day.plusDays(2), 1, -1000, coverable = true), // solde 0 : tout du compte 2
                PlannedMove(day.plusDays(2), 3, -500, coverable = true), // pas de secours : négatif
                PlannedMove(day.plusDays(3), 1, -1000), // pas couvrable (ex. débit différé)
            ),
            fallbackOf = mapOf(1L to 2L),
            from = day,
            days = 3,
        )
        assertEquals(listOf(1500L, 0L, 0L, -1000L), series.getValue(1).map { it.cents })
        assertEquals(listOf(10000L, 9500L, 8500L, 8500L), series.getValue(2).map { it.cents })
        assertEquals(listOf(0L, 0L, -500L, -500L), series.getValue(3).map { it.cents })
    }
}
