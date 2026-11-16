package net.demipech.budget.ui.installments

import android.content.Context

/** Compte proposé par défaut pour un nouveau paiement en plusieurs fois (ex. PayPal). */
object InstallmentDefaults {
    private const val PREFS = "budget"
    private const val KEY = "installmentAccountId"

    fun accountId(context: Context): Long? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY, -1L).takeIf { it >= 0 }

    fun setAccountId(context: Context, accountId: Long?) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().apply {
            if (accountId == null) remove(KEY) else putLong(KEY, accountId)
        }.apply()
    }
}
