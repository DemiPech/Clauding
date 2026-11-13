package net.demipech.budget.ui.scheduled

import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import net.demipech.budget.domain.Money
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import net.demipech.budget.data.isTransfer
import net.demipech.budget.data.title
import net.demipech.budget.domain.Recurrence
import net.demipech.budget.ui.components.AmountText
import net.demipech.budget.ui.components.CategoryBadge
import net.demipech.budget.ui.components.DayFormat
import net.demipech.budget.ui.components.EmptyState
import net.demipech.budget.ui.components.describeSchedule
import net.demipech.budget.ui.components.label
import net.demipech.budget.ui.repository

class ScheduledViewModel(repo: BudgetRepository) : ViewModel() {
    val items: StateFlow<List<ScheduledDetails>?> =
        repo.scheduled().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduledScreen(
    onEdit: (Long) -> Unit,
    onAdd: () -> Unit,
    onEditPlan: (Long) -> Unit,
    onAddPlan: () -> Unit,
    onBack: () -> Unit,
) {
    val repo = repository()
    val vm = viewModel { ScheduledViewModel(repo) }
    val items by vm.items.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Opérations planifiées") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
        floatingActionButton = {
            Box {
                var menu by remember { mutableStateOf(false) }
                ExtendedFloatingActionButton(
                    onClick = { menu = true },
                    icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                    text = { Text("Planifier") },
                )
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    DropdownMenuItem(
                        text = { Text("Opération planifiée (ponctuelle ou récurrente)") },
                        onClick = { menu = false; onAdd() },
                    )
                    DropdownMenuItem(
                        text = { Text("Paiement en plusieurs fois") },
                        onClick = { menu = false; onAddPlan() },
                    )
                }
            }
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
        val (planRows, singles) = remember(list) { list.partition { it.scheduled.planId != null } }
        val plans = remember(planRows) {
            planRows.groupBy { it.scheduled.planId!! }.values.map { rows -> rows.sortedBy { it.scheduled.planIndex } }
        }
        val (finishedPlans, runningPlans) = remember(plans) {
            plans.partition { rows -> rows.all { Recurrence.isFinished(it.scheduled) } }
        }
        val (finished, upcoming) = remember(singles) {
            singles.sortedBy { Recurrence.nextDate(it.scheduled) }.partition { Recurrence.isFinished(it.scheduled) }
        }
        LazyColumn(contentPadding = PaddingValues(bottom = 88.dp), modifier = Modifier.padding(padding)) {
            if (runningPlans.isNotEmpty()) {
                item { SectionTitle("Paiements en plusieurs fois") }
                items(runningPlans, key = { "plan-" + it.first().scheduled.planId }) { rows ->
                    PlanRow(rows) { onEditPlan(rows.first().scheduled.planId!!) }
                }
            }
            if (upcoming.isNotEmpty()) {
                item { SectionTitle("À venir") }
                items(upcoming, key = { it.scheduled.id }) { ScheduledRow(it) { onEdit(it.scheduled.id) } }
            }
            if (finished.isNotEmpty() || finishedPlans.isNotEmpty()) {
                item { SectionTitle("Terminées") }
                items(finishedPlans, key = { "plan-" + it.first().scheduled.planId }) { rows ->
                    PlanRow(rows) { onEditPlan(rows.first().scheduled.planId!!) }
                }
                items(finished, key = { it.scheduled.id }) { ScheduledRow(it) { onEdit(it.scheduled.id) } }
            }
        }
    }
}

/** Un paiement en plusieurs fois : résumé puis chaque échéance (payée ou à venir). */
@Composable
private fun PlanRow(rows: List<ScheduledDetails>, onClick: () -> Unit) {
    val first = rows.first()
    val paid = rows.count { it.scheduled.generatedCount > 0 }
    val totalCents = rows.sumOf { it.scheduled.amountCents }
    val remainingCents = rows.filter { it.scheduled.generatedCount == 0 }.sumOf { it.scheduled.amountCents }
    val sign = if (first.scheduled.kind == Kind.INCOME) 1 else -1
    Column(
        Modifier
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick)
            .padding(bottom = 8.dp)
    ) {
        ListItem(
            leadingContent = { CategoryBadge(first.categoryEmoji, first.categoryColor) },
            headlineContent = { Text(first.scheduled.note.ifBlank { first.categoryName ?: "Paiement en plusieurs fois" }) },
            supportingContent = {
                Text(
                    "En ${rows.size} fois · $paid/${rows.size} payé" + (if (paid > 1) "s" else "") +
                        " · ${first.accountName}" +
                        if (remainingCents > 0) "\nReste ${Money.format(remainingCents)}" else "\nTerminé"
                )
            },
            trailingContent = { AmountText(sign * totalCents) },
            colors = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surface),
        )
        rows.forEach { row ->
            val s = row.scheduled
            val done = s.generatedCount > 0
            Row(Modifier.fillMaxWidth().padding(start = 72.dp, end = 16.dp, top = 2.dp, bottom = 2.dp)) {
                Text(
                    "${s.planIndex}/${s.planSize}  " + s.startDate.format(DayFormat) + if (done) "  ✓" else "",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (done) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    Money.format(s.amountCents),
                    style = MaterialTheme.typography.bodySmall,
                    color = if (done) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
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
    val title = item.title.ifBlank { s.kind.label() }
    val progress = when {
        next == null -> "Terminée"
        remaining == null -> "Prochaine : ${next.format(DayFormat)} · sans fin"
        remaining == 1 -> "Prochaine : ${next.format(DayFormat)} · dernière"
        else -> "Prochaine : ${next.format(DayFormat)} · $remaining restantes"
    }
    ListItem(
        leadingContent = { CategoryBadge(if (s.isTransfer) "⇄" else item.categoryEmoji, item.categoryColor) },
        headlineContent = { Text(title) },
        supportingContent = {
            val accounts = if (s.isTransfer) "${item.accountName} → ${item.toAccountName}" else item.accountName
            Text("${describeSchedule(s)} · $accounts\n$progress")
        },
        trailingContent = {
            if (s.isTransfer) {
                Text(Money.format(s.amountCents), color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                AmountText(if (s.kind == Kind.INCOME) s.amountCents else -s.amountCents)
            }
        },
        colors = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier.clickable(onClick = onClick),
    )
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
}
