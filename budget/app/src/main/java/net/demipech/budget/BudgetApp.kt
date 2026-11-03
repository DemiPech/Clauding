package net.demipech.budget

import android.app.Application
import net.demipech.budget.data.BudgetDatabase
import net.demipech.budget.data.BudgetRepository

class BudgetApp : Application() {
    val repository: BudgetRepository by lazy { BudgetRepository(BudgetDatabase.create(this)) }
}
