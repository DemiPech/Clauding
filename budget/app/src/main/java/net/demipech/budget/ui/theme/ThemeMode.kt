package net.demipech.budget.ui.theme

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** Choix d'apparence : suivre le téléphone, clair, sombre, ou noir pur (écrans OLED). */
enum class ThemeMode(val label: String) {
    SYSTEM("Système"),
    LIGHT("Clair"),
    DARK("Sombre"),
    BLACK("Noir"),
}

/** Thème choisi, mémorisé sur le téléphone ; l'interface se met à jour aussitôt. */
class ThemeSettings(context: Context) {
    private val prefs = context.getSharedPreferences("budget", Context.MODE_PRIVATE)
    private val state = MutableStateFlow(
        prefs.getString(KEY, null)?.let { name -> ThemeMode.entries.firstOrNull { it.name == name } } ?: ThemeMode.SYSTEM
    )
    val mode: StateFlow<ThemeMode> = state

    fun set(mode: ThemeMode) {
        prefs.edit().putString(KEY, mode.name).apply()
        state.value = mode
    }

    private companion object {
        const val KEY = "theme"
    }
}
