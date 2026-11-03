package net.demipech.budget

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import net.demipech.budget.ui.BudgetNavHost
import net.demipech.budget.ui.theme.BudgetTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            BudgetTheme {
                BudgetNavHost()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Les échéances planifiées arrivées à terme deviennent des opérations.
        lifecycleScope.launch { (application as BudgetApp).repository.materializeDue() }
    }
}
