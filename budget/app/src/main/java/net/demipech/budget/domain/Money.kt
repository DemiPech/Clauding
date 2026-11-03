package net.demipech.budget.domain

import java.math.BigDecimal
import java.math.RoundingMode
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

object Money {
    private val locale = Locale.FRANCE

    /** 123456 -> « 1 234,56 € ». */
    fun format(cents: Long): String {
        val format = NumberFormat.getCurrencyInstance(locale)
        format.currency = Currency.getInstance("EUR")
        return format.format(BigDecimal.valueOf(cents, 2))
    }

    /** Montant signé avec un « + » explicite pour les rentrées. */
    fun formatSigned(cents: Long): String = if (cents > 0) "+" + format(cents) else format(cents)

    /**
     * Saisie utilisateur -> centimes. Accepte « 12 », « 12,5 », « 12.50 », « -3 »,
     * « 1 234,56 ». Renvoie null si le texte n'est pas un montant valide
     * (dont plus de deux décimales).
     */
    fun parse(text: String): Long? {
        val cleaned = text.trim()
            .replace(" ", "").replace(" ", "").replace(" ", "")
            .replace("€", "")
            .replace(',', '.')
        if (cleaned.isEmpty()) return null
        val value = cleaned.toBigDecimalOrNull() ?: return null
        if (value.stripTrailingZeros().scale() > 2) return null
        return try {
            value.movePointRight(2).setScale(0, RoundingMode.UNNECESSARY).longValueExact()
        } catch (e: ArithmeticException) {
            null
        }
    }

    /** Centimes -> texte à éditer (« 12,5 » s'affiche « 12,50 »). */
    fun toInput(cents: Long): String = BigDecimal.valueOf(cents, 2).toPlainString().replace('.', ',')
}
