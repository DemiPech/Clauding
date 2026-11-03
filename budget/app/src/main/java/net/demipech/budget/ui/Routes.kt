package net.demipech.budget.ui

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import net.demipech.budget.BudgetApp
import net.demipech.budget.data.BudgetRepository

object Routes {
    const val ACCOUNTS = "accounts"
    const val OPERATIONS = "operations"
    const val SCHEDULED = "scheduled"
    const val CATEGORIES = "categories"

    const val ACCOUNT = "account/{id}"
    fun account(id: Long) = "account/$id"

    const val ACCOUNT_EDIT = "account-edit?id={id}"
    fun accountEdit(id: Long? = null) = "account-edit?id=${id ?: -1}"

    const val OPERATION_EDIT = "operation-edit?id={id}&accountId={accountId}"
    fun operationEdit(id: Long? = null, accountId: Long? = null) =
        "operation-edit?id=${id ?: -1}&accountId=${accountId ?: -1}"

    const val SCHEDULED_EDIT = "scheduled-edit?id={id}"
    fun scheduledEdit(id: Long? = null) = "scheduled-edit?id=${id ?: -1}"
}

val Context.repository: BudgetRepository get() = (applicationContext as BudgetApp).repository

@Composable
fun repository(): BudgetRepository = LocalContext.current.repository
