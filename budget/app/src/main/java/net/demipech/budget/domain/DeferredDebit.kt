package net.demipech.budget.domain

import net.demipech.budget.data.Account
import net.demipech.budget.data.DebitDay
import net.demipech.budget.data.Kind
import net.demipech.budget.data.Operation
import java.time.LocalDate
import java.time.YearMonth

/**
 * Carte à débit différé : les dépenses sont arrêtées le [Account.cutoffDay] du mois
 * (31 = fin de mois) et débitées en une fois à la date de débit qui suit l'arrêté.
 */
object DeferredDebit {
    /** Jour d'arrêté dans un mois donné (ramené au dernier jour pour un mois court). */
    private fun cutoffIn(month: YearMonth, cutoffDay: Int): LocalDate =
        month.atDay(cutoffDay.coerceIn(1, month.lengthOfMonth()))

    /** Date de débit d'un mois donné selon la règle du compte. */
    fun debitIn(month: YearMonth, rule: DebitDay, dayOfMonth: Int): LocalDate = when (rule) {
        DebitDay.LAST_DAY -> month.atEndOfMonth()
        DebitDay.LAST_BUSINESS_DAY -> BusinessDays.last(month)
        DebitDay.DAY_OF_MONTH -> month.atDay(dayOfMonth.coerceIn(1, month.lengthOfMonth()))
    }

    /**
     * Date à laquelle une dépense du [date] est débitée : on cherche l'arrêté qui
     * l'englobe (celui du mois si la dépense est faite au plus tard ce jour-là, sinon
     * celui du mois suivant), puis la première date de débit à partir de cet arrêté.
     * Arrêté le 20, débit le dernier jour : 13/11 → 30/11, 21/11 → 31/12.
     */
    fun debitDate(date: LocalDate, cutoffDay: Int, rule: DebitDay, dayOfMonth: Int): LocalDate {
        val month = YearMonth.from(date)
        val cutoffThisMonth = cutoffIn(month, cutoffDay)
        val cutoff = if (!date.isAfter(cutoffThisMonth)) cutoffThisMonth else cutoffIn(month.plusMonths(1), cutoffDay)
        var debitMonth = YearMonth.from(cutoff)
        var debit = debitIn(debitMonth, rule, dayOfMonth)
        while (debit.isBefore(cutoff)) {
            debitMonth = debitMonth.plusMonths(1)
            debit = debitIn(debitMonth, rule, dayOfMonth)
        }
        return debit
    }

    fun debitDate(date: LocalDate, account: Account): LocalDate =
        debitDate(date, account.cutoffDay, account.debitDay, account.debitDayOfMonth)

    /** Vrai si l'opération suit le débit différé de son compte. */
    fun applies(operation: Operation, account: Account): Boolean =
        account.deferredDebit && operation.deferred && operation.kind == Kind.EXPENSE

    /** Date à laquelle l'opération pèse sur le solde du compte. */
    fun effectiveDate(operation: Operation, account: Account): LocalDate =
        if (applies(operation, account)) debitDate(operation.date, account) else operation.date
}
