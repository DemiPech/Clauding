package net.demipech.budget.ui.operations

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import net.demipech.budget.data.AccountWithBalance
import net.demipech.budget.data.BudgetRepository
import net.demipech.budget.data.Kind
import net.demipech.budget.data.OperationDetails
import net.demipech.budget.data.signedCents
import net.demipech.budget.domain.Money
import net.demipech.budget.ui.components.AmountText
import net.demipech.budget.ui.components.ColorDot
import net.demipech.budget.ui.components.EmptyState
import net.demipech.budget.ui.components.LongDayFormat
import net.demipech.budget.ui.components.label
import net.demipech.budget.ui.repository
import net.demipech.budget.ui.theme.amountColor
import java.time.YearMonth

class OperationsViewModel(repo: BudgetRepository, accountId: Long?) : ViewModel() {
    val operations: StateFlow<List<OperationDetails>?> =
        repo.operations(accountId).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    val account: StateFlow<AccountWithBalance?> =
        (if (accountId == null) flowOf(null)
        else repo.accountsWithBalance().map { list -> list.find { it.account.id == accountId } })
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
}

/** Toutes les opérations ([accountId] null) ou celles d'un compte. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OperationsScreen(
    accountId: Long?,
    onEditOperation: (Long) -> Unit,
    onAddOperation: () -> Unit,
    onBack: (() -> Unit)? = null,
    onEditAccount: (() -> Unit)? = null,
) {
    val repo = repository()
    val vm = viewModel(key = "operations-$accountId") { OperationsViewModel(repo, accountId) }
    val operations by vm.operations.collectAsStateWithLifecycle()
    val account by vm.account.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(account?.account?.name ?: "Opérations") },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                        }
                    }
                },
                actions = {
                    if (onEditAccount != null) {
                        IconButton(onClick = onEditAccount) {
                            Icon(Icons.Filled.Edit, contentDescription = "Modifier le compte")
                        }
                    }
                },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onAddOperation,
                icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                text = { Text("Opération") },
            )
        },
    ) { padding ->
        val list = operations ?: return@Scaffold
        val grouped = remember(list) { list.groupBy { it.operation.date } }
        val month = remember(list) { MonthSummary.of(list, YearMonth.now()) }

        LazyColumn(contentPadding = PaddingValues(bottom = 88.dp), modifier = Modifier.padding(padding)) {
            item { SummaryCard(account, month) }
            if (list.isEmpty()) {
                item { EmptyState("Aucune opération.\nAjoutez une dépense ou une rentrée avec le bouton +.") }
            }
            grouped.forEach { (date, ops) ->
                item(key = "day-$date") {
                    Text(
                        date.format(LongDayFormat).replaceFirstChar { it.uppercase() },
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 4.dp),
                    )
                }
                items(ops, key = { it.operation.id }) { op ->
                    OperationRow(op, showAccount = accountId == null, onClick = { onEditOperation(op.operation.id) })
                }
            }
        }
    }
}

private data class MonthSummary(val income: Long, val expense: Long) {
    companion object {
        fun of(list: List<OperationDetails>, month: YearMonth): MonthSummary {
            val ops = list.map { it.operation }.filter { YearMonth.from(it.date) == month }
            return MonthSummary(
                income = ops.filter { it.kind == Kind.INCOME }.sumOf { it.amountCents },
                expense = ops.filter { it.kind == Kind.EXPENSE }.sumOf { it.amountCents },
            )
        }
    }
}

@Composable
private fun SummaryCard(account: AccountWithBalance?, month: MonthSummary) {
    Card(Modifier.fillMaxWidth().padding(16.dp)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (account != null) {
                Text("Solde", style = MaterialTheme.typography.labelLarge)
                Text(
                    Money.format(account.balanceCents),
                    style = MaterialTheme.typography.headlineMedium,
                    color = amountColor(account.balanceCents),
                )
            }
            Text("Ce mois-ci", style = MaterialTheme.typography.labelLarge)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text("Rentrées", style = MaterialTheme.typography.bodySmall)
                    AmountText(month.income)
                }
                Column {
                    Text("Dépenses", style = MaterialTheme.typography.bodySmall)
                    AmountText(-month.expense)
                }
                Column {
                    Text("Bilan", style = MaterialTheme.typography.bodySmall)
                    AmountText(month.income - month.expense)
                }
            }
        }
    }
}

@Composable
private fun OperationRow(op: OperationDetails, showAccount: Boolean, onClick: () -> Unit) {
    val details = listOfNotNull(
        op.operation.note.takeIf { it.isNotBlank() },
        op.accountName.takeIf { showAccount },
        "planifiée".takeIf { op.operation.scheduledId != null },
    ).joinToString(" · ")
    ListItem(
        leadingContent = { ColorDot(op.categoryColor) },
        headlineContent = { Text(op.categoryName ?: op.operation.kind.label()) },
        supportingContent = if (details.isNotEmpty()) ({ Text(details) }) else null,
        trailingContent = { AmountText(op.operation.signedCents) },
        modifier = Modifier.clickable(onClick = onClick),
    )
}
