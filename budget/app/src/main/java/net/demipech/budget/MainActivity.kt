package net.demipech.budget

import android.graphics.Color
import android.os.Bundle
import androidx.activity.SystemBarStyle
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import net.demipech.budget.ui.theme.isDark
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
        val themeSettings = (application as BudgetApp).themeSettings
        setContent {
            val mode by themeSettings.mode.collectAsState()
            val dark = mode.isDark()
            // Icônes de la barre d'état et de navigation claires ou foncées selon le thème choisi.
            DisposableEffect(dark) {
                val style = if (dark) SystemBarStyle.dark(Color.TRANSPARENT)
                else SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
                enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
                onDispose {}
            }
            BudgetTheme(mode) {
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
