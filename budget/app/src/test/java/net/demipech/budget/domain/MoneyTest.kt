package net.demipech.budget.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MoneyTest {
    @Test
    fun parsesFrenchAndEnglishDecimals() {
        assertEquals(1250L, Money.parse("12,50"))
        assertEquals(1250L, Money.parse("12.5"))
        assertEquals(1200L, Money.parse("12"))
        assertEquals(123456L, Money.parse("1 234,56"))
        assertEquals(-15000L, Money.parse("-150"))
        assertEquals(990L, Money.parse(" 9,90 € "))
    }

    @Test
    fun rejectsInvalidInput() {
        assertNull(Money.parse(""))
        assertNull(Money.parse("abc"))
        assertNull(Money.parse("1,234"))
        assertNull(Money.parse("1,2,3"))
    }

    @Test
    fun roundTripsThroughInput() {
        assertEquals("12,50", Money.toInput(1250))
        assertEquals("-0,05", Money.toInput(-5))
        assertEquals(1250L, Money.parse(Money.toInput(1250)))
    }

    @Test
    fun formatsInEuros() {
        val text = Money.format(123456)
        assertTrue(text, text.contains("234,56") && text.contains("€"))
        assertTrue(Money.formatSigned(500).startsWith("+"))
        assertTrue(Money.formatSigned(-500).startsWith("-"))
    }
}
