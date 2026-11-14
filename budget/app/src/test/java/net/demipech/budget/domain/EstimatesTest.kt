package net.demipech.budget.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class EstimatesTest {
    @Test
    fun averageOfTheLastThreeConfirmedAmounts() {
        assertNull(Estimates.average(emptyList()))
        assertEquals(243752L, Estimates.average(listOf(243752)))
        assertEquals(250000L, Estimates.average(listOf(240000, 260000)))
        // Seuls les 3 plus récents comptent ; 2 437,52 + 2 512,00 + 2 498,31 = 7 447,83 → 2 482,61
        assertEquals(248261L, Estimates.average(listOf(243752, 251200, 249831, 999999)))
        // Arrondi au centime le plus proche : 10 / 3 = 3,33… → 3 ; 11 / 3 = 3,67 → 4
        assertEquals(3L, Estimates.average(listOf(3, 3, 4)))
        assertEquals(4L, Estimates.average(listOf(4, 4, 3)))
    }
}
