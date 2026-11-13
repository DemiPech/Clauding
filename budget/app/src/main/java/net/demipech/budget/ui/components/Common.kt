package net.demipech.budget.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.sp
import java.time.YearMonth
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import net.demipech.budget.data.DateAdjust
import net.demipech.budget.data.DayRule
import net.demipech.budget.data.DebitDay
import net.demipech.budget.data.Frequency
import net.demipech.budget.data.ScheduledOperation
import net.demipech.budget.domain.Recurrence
import net.demipech.budget.data.Kind
import net.demipech.budget.domain.Money
import net.demipech.budget.ui.theme.amountColor
import net.demipech.budget.ui.theme.expenseColor
import net.demipech.budget.ui.theme.incomeColor
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private const val MILLIS_PER_DAY = 86_400_000L

val MonthFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.FRENCH)
val ShortDayFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("dd/MM", Locale.FRENCH)
val DayFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.FRENCH)
val LongDayFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("EEEE d MMMM yyyy", Locale.FRENCH)

/** Palette proposée pour les catégories et les comptes. */
val CategoryPalette = listOf(
    0xFFE53935, 0xFFD81B60, 0xFFC2185B, 0xFF8E24AA, 0xFF5E35B1, 0xFF3949AB,
    0xFF1E88E5, 0xFF039BE5, 0xFF00897B, 0xFF43A047, 0xFF7CB342, 0xFFFBC02D,
    0xFFFB8C00, 0xFFF4511E, 0xFF8D6E63, 0xFF757575,
)

val CategoryEmojis = listOf(
    "🛒", "🧺", "🍽️", "☕", "🏠", "🔑", "💡", "🛡️", "🚗", "⛽", "🚆", "✈️",
    "🎮", "📺", "🎬", "🎵", "📚", "🃏", "💊", "🏥", "👕", "🛍️", "🎁", "❤️",
    "🐶", "👶", "📱", "💻", "🧾", "🏦", "📦", "💼", "💰", "↩️", "📈", "🎓",
)

val AccountIcons = listOf("🏦", "💳", "💶", "👛", "🐷", "💰", "📈", "🏠", "💼", "🪙")

fun YearMonth.label(): String = atDay(1).format(MonthFormat).replaceFirstChar { it.uppercase() }

fun Kind.label(): String = when (this) {
    Kind.EXPENSE -> "Dépense"
    Kind.INCOME -> "Rentrée"
}

fun Frequency.label(): String = when (this) {
    Frequency.NONE -> "Non, une seule fois"
    Frequency.DAILY -> "Chaque jour"
    Frequency.WEEKLY -> "Chaque semaine"
    Frequency.MONTHLY -> "Chaque mois"
    Frequency.YEARLY -> "Chaque année"
}

/** Unité de l'intervalle « tous les N … ». */
fun Frequency.unit(): String = when (this) {
    Frequency.NONE -> ""
    Frequency.DAILY -> "jour(s)"
    Frequency.WEEKLY -> "semaine(s)"
    Frequency.MONTHLY -> "mois"
    Frequency.YEARLY -> "an(s)"
}

fun describeRhythm(frequency: Frequency, interval: Int): String = when (frequency) {
    Frequency.NONE -> "Une seule fois"
    Frequency.DAILY -> if (interval == 1) "Tous les jours" else "Tous les $interval jours"
    Frequency.WEEKLY -> if (interval == 1) "Toutes les semaines" else "Toutes les $interval semaines"
    Frequency.MONTHLY -> if (interval == 1) "Tous les mois" else "Tous les $interval mois"
    Frequency.YEARLY -> if (interval == 1) "Tous les ans" else "Tous les $interval ans"
}

@Composable
fun ColorDot(color: Long?, modifier: Modifier = Modifier, size: Int = 14) {
    Box(
        modifier
            .size(size.dp)
            .background(color?.let { Color(it) } ?: MaterialTheme.colorScheme.outlineVariant, CircleShape)
    )
}

@Composable
fun AmountText(cents: Long, modifier: Modifier = Modifier, signed: Boolean = true) {
    Text(
        text = if (signed) Money.formatSigned(cents) else Money.format(cents),
        color = amountColor(cents),
        fontWeight = FontWeight.SemiBold,
        style = MaterialTheme.typography.bodyLarge,
        modifier = modifier,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FormTopBar(
    title: String,
    onBack: () -> Unit,
    onDelete: (() -> Unit)? = null,
    extraActions: @Composable () -> Unit = {},
) {
    TopAppBar(
        title = { Text(title) },
        navigationIcon = {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
            }
        },
        actions = {
            extraActions()
            if (onDelete != null) {
                IconButton(onClick = onDelete) { Icon(Icons.Filled.Delete, contentDescription = "Supprimer") }
            }
        },
    )
}

@Composable
fun ConfirmDialog(
    title: String,
    text: String,
    confirmLabel: String = "Supprimer",
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(text) },
        confirmButton = { TextButton(onClick = onConfirm) { Text(confirmLabel) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Annuler") } },
    )
}

@Composable
fun AmountField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    isError: Boolean = false,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        suffix = { Text("€") },
        singleLine = true,
        isError = isError,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        modifier = modifier.fillMaxWidth(),
    )
}

@Composable
fun IntField(value: String, onValueChange: (String) -> Unit, label: String, modifier: Modifier = Modifier) {
    OutlinedTextField(
        value = value,
        onValueChange = { text -> onValueChange(text.filter(Char::isDigit).take(4)) },
        label = { Text(label) },
        singleLine = true,
        isError = (value.toIntOrNull() ?: 0) < 1,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = modifier,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateField(label: String, date: LocalDate, onDateChange: (LocalDate) -> Unit, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    OutlinedTextField(
        value = date.format(DayFormat),
        onValueChange = {},
        readOnly = true,
        label = { Text(label) },
        trailingIcon = {
            IconButton(onClick = { open = true }) { Icon(Icons.Filled.DateRange, contentDescription = "Choisir la date") }
        },
        modifier = modifier.fillMaxWidth(),
    )
    if (open) {
        val state = rememberDatePickerState(initialSelectedDateMillis = date.toEpochDay() * MILLIS_PER_DAY)
        DatePickerDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { onDateChange(LocalDate.ofEpochDay(Math.floorDiv(it, MILLIS_PER_DAY))) }
                    open = false
                }) { Text("OK") }
            },
            dismissButton = { TextButton(onClick = { open = false }) { Text("Annuler") } },
        ) {
            DatePicker(state = state)
        }
    }
}

/** Liste déroulante non éditable. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun <T> Selector(
    label: String,
    options: List<T>,
    selected: T?,
    optionLabel: (T) -> String,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier,
    leading: (@Composable (T) -> Unit)? = null,
    emptyLabel: String = "",
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }, modifier = modifier) {
        OutlinedTextField(
            value = selected?.let(optionLabel) ?: emptyLabel,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            leadingIcon = if (leading != null && selected != null) ({ leading(selected) }) else null,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                .fillMaxWidth(),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(optionLabel(option)) },
                    leadingIcon = if (leading != null) ({ leading(option) }) else null,
                    onClick = {
                        onSelect(option)
                        expanded = false
                    },
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun <T> Segmented(options: List<T>, selected: T, label: (T) -> String, onSelect: (T) -> Unit, modifier: Modifier = Modifier) {
    SingleChoiceSegmentedButtonRow(modifier.fillMaxWidth()) {
        options.forEachIndexed { index, option ->
            SegmentedButton(
                selected = option == selected,
                onClick = { onSelect(option) },
                shape = SegmentedButtonDefaults.itemShape(index = index, count = options.size),
            ) { Text(label(option)) }
        }
    }
}

@Composable
fun KindSelector(kind: Kind, onKindChange: (Kind) -> Unit, modifier: Modifier = Modifier) {
    Segmented(listOf(Kind.EXPENSE, Kind.INCOME), kind, { it.label() }, onKindChange, modifier)
}

@Composable
fun EmptyState(text: String, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
        Text(
            text,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

/** Carte blanche à coins arrondis (style Wallet), avec titre optionnel et lien « Afficher plus ». */
@Composable
fun SectionCard(
    modifier: Modifier = Modifier,
    title: String? = null,
    onShowMore: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(vertical = 16.dp)) {
            if (title != null) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 8.dp),
                )
            }
            content()
            if (onShowMore != null) {
                HorizontalLine(Modifier.padding(top = 8.dp))
                Text(
                    "Afficher plus",
                    color = MaterialTheme.colorScheme.secondary,
                    style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onShowMore)
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                )
            }
        }
    }
}

@Composable
fun HorizontalLine(modifier: Modifier = Modifier) {
    androidx.compose.material3.HorizontalDivider(modifier, color = MaterialTheme.colorScheme.outlineVariant)
}

/** Petit libellé gris en capitales (« AUJOURD'HUI », « CE MOIS-CI »). */
@Composable
fun Overline(text: String, modifier: Modifier = Modifier) {
    Text(
        text.uppercase(),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier,
    )
}

/** Pastille ronde colorée avec l'emoji de la catégorie. */
@Composable
fun CategoryBadge(emoji: String?, color: Long?, modifier: Modifier = Modifier, size: Int = 40) {
    val base = color?.let { Color(it) } ?: MaterialTheme.colorScheme.outline
    Box(
        modifier
            .size(size.dp)
            .clip(CircleShape)
            .background(base.copy(alpha = 0.18f)),
        contentAlignment = Alignment.Center,
    ) {
        if (!emoji.isNullOrBlank()) {
            Text(emoji, fontSize = (size * 0.45f).sp)
        } else {
            Box(Modifier.size((size / 3).dp).background(base, CircleShape))
        }
    }
}

/** « ‹ Novembre 2026 › » ; toucher le mois revient au mois courant. */
@Composable
fun MonthSwitcher(month: YearMonth, onMonthChange: (YearMonth) -> Unit, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = { onMonthChange(month.minusMonths(1)) }) {
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = "Mois précédent")
        }
        Text(
            month.label(),
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier.clickable { onMonthChange(YearMonth.now()) },
        )
        IconButton(onClick = { onMonthChange(month.plusMonths(1)) }) {
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = "Mois suivant")
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ColorPicker(selected: Long, onSelect: (Long) -> Unit, modifier: Modifier = Modifier) {
    FlowRow(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        CategoryPalette.forEach { option ->
            Box(
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(Color(option))
                    .then(
                        if (option == selected) Modifier.border(3.dp, MaterialTheme.colorScheme.onSurface, CircleShape)
                        else Modifier
                    )
                    .clickable { onSelect(option) }
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun EmojiPicker(options: List<String>, selected: String, onSelect: (String) -> Unit, modifier: Modifier = Modifier) {
    FlowRow(modifier, horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        options.forEach { emoji ->
            Box(
                Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(
                        if (emoji == selected) MaterialTheme.colorScheme.primaryContainer
                        else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    )
                    .clickable { onSelect(emoji) },
                contentAlignment = Alignment.Center,
            ) { Text(emoji, fontSize = 20.sp) }
        }
    }
}

/** Trois montants côte à côte : Revenus, Dépenses, Total (bandeau Money Manager). */
@Composable
fun TotalsRow(income: Long, expense: Long, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        TotalCell("Revenus", Money.format(income), incomeColor(), Modifier.weight(1f))
        TotalCell("Dépenses", Money.format(expense), expenseColor(), Modifier.weight(1f))
        TotalCell("Total", Money.format(income - expense), MaterialTheme.colorScheme.onSurface, Modifier.weight(1f))
    }
}

@Composable
private fun TotalCell(label: String, value: String, color: Color, modifier: Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, style = MaterialTheme.typography.bodyMedium)
        Text(value, color = color, style = MaterialTheme.typography.titleMedium, maxLines = 1)
    }
}

@Composable
fun Gap(height: Int) = Spacer(Modifier.height(height.dp))

fun ordinal(n: Int): String = if (n == 1) "1er" else "${n}e"

fun weekdayName(isoDay: Int): String =
    java.time.DayOfWeek.of(isoDay.coerceIn(1, 7)).getDisplayName(java.time.format.TextStyle.FULL, Locale.FRENCH)

fun DayRule.label(): String = when (this) {
    DayRule.SAME_DAY -> "Le jour de la date choisie"
    DayRule.LAST_DAY -> "Le dernier jour du mois"
    DayRule.FIRST_BUSINESS_DAY -> "Le premier jour ouvré"
    DayRule.LAST_BUSINESS_DAY -> "Le dernier jour ouvré"
    DayRule.NTH_BUSINESS_DAY -> "Le Nᵉ jour ouvré"
    DayRule.NTH_WEEKDAY -> "Un jour de la semaine (ex. 2ᵉ mardi)"
}

fun DateAdjust.label(): String = when (this) {
    DateAdjust.NONE -> "Garder la date"
    DateAdjust.NEXT_BUSINESS_DAY -> "Jour ouvré suivant"
    DateAdjust.PREVIOUS_BUSINESS_DAY -> "Jour ouvré précédent"
}

/** « Tous les mois, le dernier jour ouvré », « Tous les mois, le 5 (jour ouvré suivant si férié) »… */
fun describeSchedule(s: ScheduledOperation): String {
    if (s.planId != null) return "Paiement ${s.planIndex}/${s.planSize}"
    val rhythm = describeRhythm(s.frequency, s.interval)
    val yearly = s.frequency == Frequency.YEARLY
    val ofMonth = if (yearly) " de " + s.startDate.format(DateTimeFormatter.ofPattern("MMMM", Locale.FRENCH)) else ""
    val rule = if (!Recurrence.usesDayRule(s.frequency)) "" else when (s.dayRule) {
        DayRule.SAME_DAY -> ", le " + (if (s.startDate.dayOfMonth == 1) "1er" else s.startDate.dayOfMonth.toString()) + ofMonth
        DayRule.LAST_DAY -> ", le dernier jour" + if (yearly) ofMonth else " du mois"
        DayRule.FIRST_BUSINESS_DAY -> ", le 1er jour ouvré$ofMonth"
        DayRule.LAST_BUSINESS_DAY -> ", le dernier jour ouvré$ofMonth"
        DayRule.NTH_BUSINESS_DAY -> ", le ${ordinal(s.ruleN)} jour ouvré$ofMonth"
        DayRule.NTH_WEEKDAY ->
            ", le " + (if (s.ruleN >= 5) "dernier" else ordinal(s.ruleN)) + " " + weekdayName(s.ruleWeekday) + ofMonth
    }
    val adjust = if (!Recurrence.usesAdjust(s.frequency, s.dayRule)) "" else when (s.adjust) {
        DateAdjust.NONE -> ""
        DateAdjust.NEXT_BUSINESS_DAY -> " (jour ouvré suivant si week-end ou férié)"
        DateAdjust.PREVIOUS_BUSINESS_DAY -> " (jour ouvré précédent si week-end ou férié)"
    }
    return rhythm + rule + adjust
}

fun DebitDay.label(): String = when (this) {
    DebitDay.LAST_DAY -> "Le dernier jour du mois"
    DebitDay.LAST_BUSINESS_DAY -> "Le dernier jour ouvré du mois"
    DebitDay.DAY_OF_MONTH -> "Un jour fixe du mois"
}

/** Ligne « Débit différé (carte) » avec interrupteur et date de débit calculée. */
@Composable
fun DeferredSwitch(checked: Boolean, onCheckedChange: (Boolean) -> Unit, debitDate: LocalDate?, modifier: Modifier = Modifier) {
    Row(
        modifier
            .fillMaxWidth()
            .clickable { onCheckedChange(!checked) }
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text("Débit différé (carte)", style = MaterialTheme.typography.bodyLarge)
            Text(
                if (checked && debitDate != null) "Débitée le ${debitDate.format(DayFormat)}"
                else "Débitée tout de suite",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        androidx.compose.material3.Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

/** Type saisi dans les formulaires : une dépense, une rentrée ou un virement entre comptes. */
enum class EntryType { EXPENSE, INCOME, TRANSFER }

fun EntryType.label(): String = when (this) {
    EntryType.EXPENSE -> "Dépense"
    EntryType.INCOME -> "Rentrée"
    EntryType.TRANSFER -> "Virement"
}

val EntryType.kind: Kind get() = if (this == EntryType.INCOME) Kind.INCOME else Kind.EXPENSE

@Composable
fun EntryTypeSelector(type: EntryType, onTypeChange: (EntryType) -> Unit, modifier: Modifier = Modifier) {
    Segmented(EntryType.entries, type, { it.label() }, onTypeChange, modifier)
}
