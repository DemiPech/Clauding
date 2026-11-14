package net.demipech.budget.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import net.demipech.budget.data.Kind

// Accent corail et code couleur revenus bleu / dépenses rouge (Money Manager),
// cartes blanches sur fond gris clair en thème clair (Wallet).
private val LightColors = lightColorScheme(
    primary = Color(0xFFE8473C),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFDAD5),
    onPrimaryContainer = Color(0xFF410001),
    secondary = Color(0xFF1A6BD6),
    onSecondary = Color.White,
    background = Color(0xFFF1F2F5),
    onBackground = Color(0xFF1B1C1F),
    surface = Color.White,
    onSurface = Color(0xFF1B1C1F),
    surfaceVariant = Color(0xFFE6E8EC),
    onSurfaceVariant = Color(0xFF5F6368),
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color.White,
    surfaceContainer = Color.White,
    surfaceContainerHigh = Color(0xFFF6F7F9),
    surfaceContainerHighest = Color(0xFFECEEF1),
    outlineVariant = Color(0xFFDADCE0),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFFF6B5E),
    onPrimary = Color(0xFF3B0904),
    primaryContainer = Color(0xFF6E1E16),
    onPrimaryContainer = Color(0xFFFFDAD5),
    secondary = Color(0xFF6AA9FF),
    onSecondary = Color(0xFF00315F),
    background = Color(0xFF18191D),
    onBackground = Color(0xFFE6E6EA),
    surface = Color(0xFF232529),
    onSurface = Color(0xFFE6E6EA),
    surfaceVariant = Color(0xFF34363C),
    onSurfaceVariant = Color(0xFF9EA2A9),
    surfaceContainerLowest = Color(0xFF18191D),
    surfaceContainerLow = Color(0xFF1E2024),
    surfaceContainer = Color(0xFF232529),
    surfaceContainerHigh = Color(0xFF2B2D32),
    surfaceContainerHighest = Color(0xFF34363C),
    outlineVariant = Color(0xFF3A3D43),
)

/** Noir pur : économise la batterie sur les écrans OLED. */
private val BlackColors = DarkColors.copy(
    background = Color.Black,
    surface = Color(0xFF0E0E10),
    surfaceVariant = Color(0xFF26272B),
    surfaceContainerLowest = Color.Black,
    surfaceContainerLow = Color(0xFF09090A),
    surfaceContainer = Color(0xFF0E0E10),
    surfaceContainerHigh = Color(0xFF17181B),
    surfaceContainerHighest = Color(0xFF202125),
    outlineVariant = Color(0xFF2A2C31),
)

/** Vrai quand l'interface est en sombre (thème choisi, ou téléphone en sombre). */
val LocalDarkTheme = staticCompositionLocalOf { false }

@Composable
fun ThemeMode.isDark(): Boolean = when (this) {
    ThemeMode.SYSTEM -> isSystemInDarkTheme()
    ThemeMode.LIGHT -> false
    ThemeMode.DARK, ThemeMode.BLACK -> true
}

@Composable
fun BudgetTheme(mode: ThemeMode = ThemeMode.SYSTEM, content: @Composable () -> Unit) {
    val dark = mode.isDark()
    val colors = when {
        !dark -> LightColors
        mode == ThemeMode.BLACK -> BlackColors
        else -> DarkColors
    }
    CompositionLocalProvider(LocalDarkTheme provides dark) {
        MaterialTheme(colorScheme = colors, content = content)
    }
}

@Composable
fun incomeColor(): Color = if (LocalDarkTheme.current) Color(0xFF6AA9FF) else Color(0xFF1A6BD6)

@Composable
fun expenseColor(): Color = if (LocalDarkTheme.current) Color(0xFFFF6B6B) else Color(0xFFE5484D)

@Composable
fun kindColor(kind: Kind): Color = if (kind == Kind.INCOME) incomeColor() else expenseColor()

/** Couleur d'un montant signé : bleu au-dessus de zéro, rouge en dessous. */
@Composable
fun amountColor(cents: Long): Color = when {
    cents > 0 -> incomeColor()
    cents < 0 -> expenseColor()
    else -> MaterialTheme.colorScheme.onSurface
}
