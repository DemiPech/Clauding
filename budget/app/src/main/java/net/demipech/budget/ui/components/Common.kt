package net.demipech.budget.ui.components

import androidx.compose.foundation.background
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
import net.demipech.budget.data.Frequency
import net.demipech.budget.data.Kind
import net.demipech.budget.domain.Money
import net.demipech.budget.ui.theme.amountColor
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private const val MILLIS_PER_DAY = 86_400_000L

val DayFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.FRENCH)
val LongDayFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("EEEE d MMMM yyyy", Locale.FRENCH)

/** Palette proposée pour les catégories. */
val CategoryPalette = listOf(
    0xFFE53935, 0xFFD81B60, 0xFF8E24AA, 0xFF3949AB, 0xFF1E88E5, 0xFF00897B,
    0xFF43A047, 0xFF7CB342, 0xFFFDD835, 0xFFFB8C00, 0xFF8D6E63, 0xFF757575,
)

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
fun FormTopBar(title: String, onBack: () -> Unit, onDelete: (() -> Unit)? = null) {
    TopAppBar(
        title = { Text(title) },
        navigationIcon = {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
            }
        },
        actions = {
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
