package net.demipech.budget.ui

import android.content.Context
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import net.demipech.budget.BudgetApp
import net.demipech.budget.data.BudgetRepository
import java.time.LocalDate

object Routes {
    // Onglets
    const val HOME = "home"
    const val OPERATIONS = "operations"
    const val STATS = "stats"
    const val MORE = "more"

    const val SCHEDULED = "scheduled"
    const val BUDGETS = "budgets"
    const val FORECAST = "forecast"
    const val SEARCH = "search"
    const val CATEGORIES = "categories"

    const val ACCOUNT = "account/{id}"
    fun account(id: Long) = "account/$id"

    const val RECONCILE = "reconcile/{id}"
    fun reconcile(accountId: Long) = "reconcile/$accountId"

    const val ACCOUNT_EDIT = "account-edit?id={id}"
    fun accountEdit(id: Long? = null) = "account-edit?id=${id ?: -1}"

    const val OPERATION_EDIT = "operation-edit?id={id}&accountId={accountId}&date={date}&copyOf={copyOf}"
    fun operationEdit(id: Long? = null, accountId: Long? = null, date: LocalDate? = null, copyOf: Long? = null) =
        "operation-edit?id=${id ?: -1}&accountId=${accountId ?: -1}&copyOf=${copyOf ?: -1}" +
            (date?.let { "&date=${it.toEpochDay()}" } ?: "")

    const val INSTALLMENTS_EDIT =
        "installments-edit?planId={planId}&amount={amount}&accountId={accountId}&categoryId={categoryId}&note={note}"
    fun installmentsEdit(
        planId: Long? = null,
        amountCents: Long? = null,
        accountId: Long? = null,
        categoryId: Long? = null,
        note: String? = null,
    ) = "installments-edit?planId=${planId ?: -1}&amount=${amountCents ?: -1}" +
        "&accountId=${accountId ?: -1}&categoryId=${categoryId ?: -1}" +
        (note?.takeIf { it.isNotBlank() }?.let { "&note=" + Uri.encode(it) } ?: "")

    const val SCHEDULED_EDIT = "scheduled-edit?id={id}"
    fun scheduledEdit(id: Long? = null) = "scheduled-edit?id=${id ?: -1}"
}

val Context.repository: BudgetRepository get() = (applicationContext as BudgetApp).repository

@Composable
fun repository(): BudgetRepository = LocalContext.current.repository
