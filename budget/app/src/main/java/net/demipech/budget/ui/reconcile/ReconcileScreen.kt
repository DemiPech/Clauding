package net.demipech.budget.ui.reconcile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TriStateCheckbox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import net.demipech.budget.data.AccountWithBalance
import net.demipech.budget.data.BudgetRepository
import net.demipech.budget.data.ClearStatus
import net.demipech.budget.data.OperationDetails
import net.demipech.budget.data.isDeferred
import net.demipech.budget.data.signedCents
import net.demipech.budget.domain.Money
import net.demipech.budget.ui.components.AmountField
import net.demipech.budget.ui.components.AmountText
import net.demipech.budget.ui.components.ConfirmDialog
import net.demipech.budget.ui.components.DayFormat
import net.demipech.budget.ui.components.FormTopBar
import net.demipech.budget.ui.components.Overline
import net.demipech.budget.ui.operations.title
import net.demipech.budget.ui.operations.transferRoute
import net.demipech.budget.ui.repository
import net.demipech.budget.ui.theme.amountColor
import net.demipech.budget.ui.theme.expenseColor
import net.demipech.budget.ui.theme.incomeColor
import java.time.LocalDate

class ReconcileViewModel(private val repo: BudgetRepository, private val accountId: Long) : ViewModel() {
    val account: StateFlow<AccountWithBalance?> =
        repo.accountsWithBalance().map { list -> list.find { it.account.id == accountId } }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val operations: StateFlow<List<OperationDetails>?> =
        repo.unreconciled(accountId).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    /** Solde indiqué sur le relevé de la banque. */
    var statement by mutableStateOf("")

    fun toggle(op: OperationDetails) = viewModelScope.launch {
        repo.setCleared(op.operation, op.operation.status == ClearStatus.NONE)
    }

    fun toggleDebit(debitDate: LocalDate, cleared: Boolean) = viewModelScope.launch {
        repo.setDeferredDebitCleared(accountId, debitDate, cleared)
    }

    fun reconcile() = viewModelScope.launch { repo.reconcile(accountId) }
}

/** Une ligne de l'écran : une opération, ou toutes les dépenses d'un débit différé. */
private sealed interface Line {
    val date: LocalDate
    val cents: Long

    data class Single(val op: OperationDetails) : Line {
        override val date: LocalDate get() = op.operation.debitDate
        override val cents: Long get() = op.operation.signedCents
    }

    data class Debit(override val date: LocalDate, val ops: List<OperationDetails>) : Line {
        override val cents: Long get() = -ops.sumOf { it.operation.amountCents }
        val state: ToggleableState
            get() = when {
                ops.all { it.operation.status != ClearStatus.NONE } -> ToggleableState.On
                ops.none { it.operation.status != ClearStatus.NONE } -> ToggleableState.Off
                else -> ToggleableState.Indeterminate
            }
    }
}

private fun lines(ops: List<OperationDetails>): List<Line> {
    val (deferred, others) = ops.partition { it.isDeferred }
    val debits = deferred.groupBy { it.operation.debitDate }.map { (date, group) -> Line.Debit(date, group) }
    return (others.map { Line.Single(it) } + debits).sortedByDescending { it.date }
}

@Composable
fun ReconcileScreen(accountId: Long, onBack: () -> Unit) {
    val repo = repository()
    val vm = viewModel(key = "reconcile-$accountId") { ReconcileViewModel(repo, accountId) }
    val account by vm.account.collectAsStateWithLifecycle()
    val operations by vm.operations.collectAsStateWithLifecycle()
    var confirm by remember { mutableStateOf(false) }

    Scaffold(
        topBar = { FormTopBar(title = "Pointage · ${account?.account?.name.orEmpty()}", onBack = onBack) },
    ) { padding ->
        val acc = account ?: return@Scaffold
        val list = operations ?: return@Scaffold
        val statementCents = Money.parse(vm.statement)
        val gap = statementCents?.let { it - acc.clearedCents }
        val clearedCount = list.count { it.operation.status == ClearStatus.CLEARED }
        val today = LocalDate.now()
        val all = remember(list) { lines(list) }
        val (upcoming, past) = all.partition { it.date.isAfter(today) }

        LazyColumn(Modifier.padding(padding), contentPadding = PaddingValues(bottom = 32.dp)) {
            item {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surface)
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(
                        "Cochez chaque opération que vous retrouvez sur le relevé. Quand le solde pointé " +
                            "est égal au solde du relevé, rapprochez : les opérations pointées sont verrouillées.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    AmountField(vm.statement, { vm.statement = it }, "Solde du relevé")
                    Row {
                        Figure("Solde pointé", Money.format(acc.clearedCents), amountColor(acc.clearedCents), Modifier.weight(1f))
                        Figure(
                            "Écart",
                            gap?.let { Money.formatSigned(it) } ?: "—",
                            when (gap) {
                                null -> MaterialTheme.colorScheme.onSurface
                                0L -> incomeColor()
                                else -> expenseColor()
                            },
                            Modifier.weight(1f),
                        )
                        Figure("Solde réel", Money.format(acc.balanceCents), amountColor(acc.balanceCents), Modifier.weight(1f))
                    }
                    if (gap != null && gap != 0L) {
                        Text(
                            "Un écart reste : cherchez une opération du relevé absente de l'app, ou un montant différent.",
                            style = MaterialTheme.typography.bodySmall,
                            color = expenseColor(),
                        )
                    }
                    Button(
                        onClick = { confirm = true },
                        enabled = gap == 0L && clearedCount > 0,
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Rapprocher ($clearedCount pointée" + (if (clearedCount > 1) "s" else "") + ")") }
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }
            if (all.isEmpty()) {
                item {
                    Text(
                        "Tout est rapproché.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(24.dp),
                    )
                }
            }
            if (past.isNotEmpty()) item { Section("Opérations passées") }
            items(past, key = { it.key() }) { LineRow(it, vm) }
            if (upcoming.isNotEmpty()) item { Section("À venir (pas encore sur le relevé)") }
            items(upcoming, key = { it.key() }) { LineRow(it, vm) }
        }
    }

    if (confirm) {
        ConfirmDialog(
            title = "Rapprocher le compte ?",
            text = "Les opérations pointées seront verrouillées. Vous pourrez toujours en déverrouiller une depuis son formulaire.",
            confirmLabel = "Rapprocher",
            onConfirm = {
                confirm = false
                vm.reconcile()
            },
            onDismiss = { confirm = false },
        )
    }
}

private fun Line.key(): String = when (this) {
    is Line.Single -> "op-${op.operation.id}"
    is Line.Debit -> "debit-$date"
}

@Composable
private fun Figure(label: String, value: String, color: androidx.compose.ui.graphics.Color, modifier: Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Overline(label)
        Text(value, color = color, style = MaterialTheme.typography.titleMedium, maxLines = 1)
    }
}

@Composable
private fun Section(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 4.dp),
    )
}

@Composable
private fun LineRow(line: Line, vm: ReconcileViewModel) {
    when (line) {
        is Line.Single -> {
            val op = line.op
            val checked = op.operation.status != ClearStatus.NONE
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surface)
                    .clickable { vm.toggle(op) }
                    .padding(end = 16.dp, top = 4.dp, bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(checked = checked, onCheckedChange = { vm.toggle(op) })
                Column(Modifier.weight(1f)) {
                    Text(op.title, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(
                        op.operation.date.format(DayFormat) +
                            (if (op.operation.transferId != null) " · " + op.transferRoute else "") +
                            (op.categoryName?.let { " · $it" } ?: ""),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                AmountText(line.cents)
            }
        }
        is Line.Debit -> {
            val state = line.state
            val toggle = { vm.toggleDebit(line.date, state != ToggleableState.On) }
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surface)
                    .clickable { toggle() }
                    .padding(end = 16.dp, top = 4.dp, bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TriStateCheckbox(state = state, onClick = { toggle() })
                Column(Modifier.weight(1f)) {
                    Text("💳 Débit différé du ${line.date.format(DayFormat)}", fontWeight = FontWeight.Medium)
                    Text(
                        "${line.ops.size} dépense" + (if (line.ops.size > 1) "s" else "") + " carte, pointées ensemble",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                AmountText(line.cents)
            }
        }
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
}
