package net.demipech.budget.ui.scheduled

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import net.demipech.budget.data.BudgetRepository
import net.demipech.budget.data.Kind
import net.demipech.budget.data.ScheduledDetails
import net.demipech.budget.domain.Recurrence
import net.demipech.budget.ui.components.AmountText
import net.demipech.budget.ui.components.ColorDot
import net.demipech.budget.ui.components.DayFormat
import net.demipech.budget.ui.components.EmptyState
import net.demipech.budget.ui.components.describeRhythm
import net.demipech.budget.ui.components.label
import net.demipech.budget.ui.repository

class ScheduledViewModel(repo: BudgetRepository) : ViewModel() {
    val items: StateFlow<List<ScheduledDetails>?> =
        repo.scheduled().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduledScreen(onEdit: (Long) -> Unit, onAdd: () -> Unit) {
    val repo = repository()
    val vm = viewModel { ScheduledViewModel(repo) }
    val items by vm.items.collectAsStateWithLifecycle()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Planifié") }) },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onAdd,
                icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                text = { Text("Planifier") },
            )
        },
    ) { padding ->
        val list = items ?: return@Scaffold
        if (list.isEmpty()) {
            EmptyState(
                "Rien de planifié.\nAjoutez une dépense ou une rentrée future, ponctuelle ou récurrente " +
                    "(loyer, salaire, abonnement…).",
                Modifier.padding(padding),
            )
            return@Scaffold
        }
        val (finished, upcoming) = remember(list) {
            list.sortedBy { Recurrence.nextDate(it.scheduled) }.partition { Recurrence.isFinished(it.scheduled) }
        }
        LazyColumn(contentPadding = PaddingValues(bottom = 88.dp), modifier = Modifier.padding(padding)) {
            if (upcoming.isNotEmpty()) {
                item { SectionTitle("À venir") }
                items(upcoming, key = { it.scheduled.id }) { ScheduledRow(it) { onEdit(it.scheduled.id) } }
            }
            if (finished.isNotEmpty()) {
                item { SectionTitle("Terminées") }
                items(finished, key = { it.scheduled.id }) { ScheduledRow(it) { onEdit(it.scheduled.id) } }
            }
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 4.dp),
    )
}

@Composable
private fun ScheduledRow(item: ScheduledDetails, onClick: () -> Unit) {
    val s = item.scheduled
    val next = Recurrence.nextDate(s)
    val remaining = Recurrence.remaining(s)
    val title = s.note.ifBlank { item.categoryName ?: s.kind.label() }
    val progress = when {
        next == null -> "Terminée"
        remaining == null -> "Prochaine : ${next.format(DayFormat)} · sans fin"
        remaining == 1 -> "Prochaine : ${next.format(DayFormat)} · dernière"
        else -> "Prochaine : ${next.format(DayFormat)} · $remaining restantes"
    }
    ListItem(
        leadingContent = { ColorDot(item.categoryColor) },
        headlineContent = { Text(title) },
        supportingContent = {
            Text("${describeRhythm(s.frequency, s.interval)} · ${item.accountName}\n$progress")
        },
        trailingContent = { AmountText(if (s.kind == Kind.INCOME) s.amountCents else -s.amountCents) },
        modifier = Modifier.clickable(onClick = onClick),
    )
    HorizontalDivider()
}
