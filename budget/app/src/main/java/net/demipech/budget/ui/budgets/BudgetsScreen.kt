package net.demipech.budget.ui.budgets

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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import net.demipech.budget.data.Budget
import net.demipech.budget.data.BudgetRepository
import net.demipech.budget.data.Category
import net.demipech.budget.data.Kind
import net.demipech.budget.data.OperationDetails
import net.demipech.budget.domain.Forecast
import net.demipech.budget.domain.Money
import net.demipech.budget.ui.components.AmountField
import net.demipech.budget.ui.components.BudgetProgress
import net.demipech.budget.ui.components.CategoryBadge
import net.demipech.budget.ui.components.FormTopBar
import net.demipech.budget.ui.components.Overline
import net.demipech.budget.ui.components.label
import net.demipech.budget.ui.repository
import java.time.YearMonth

class BudgetsViewModel(private val repo: BudgetRepository) : ViewModel() {
    val month: YearMonth = YearMonth.now()
    val categories: StateFlow<List<Category>?> =
        repo.categories().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val budgets: StateFlow<List<Budget>> =
        repo.budgets().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val operations: StateFlow<List<OperationDetails>> =
        repo.operationsBetween(month.atDay(1), month.atEndOfMonth())
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun setBudget(categoryId: Long, cents: Long?) = viewModelScope.launch { repo.setBudget(categoryId, cents) }
}

/** Budget mensuel de chaque catégorie de dépense principale, et ce qui a été dépensé ce mois-ci. */
@Composable
fun BudgetsScreen(onBack: () -> Unit) {
    val repo = repository()
    val vm = viewModel { BudgetsViewModel(repo) }
    val categories by vm.categories.collectAsStateWithLifecycle()
    val budgets by vm.budgets.collectAsStateWithLifecycle()
    val operations by vm.operations.collectAsStateWithLifecycle()
    var editing by remember { mutableStateOf<Category?>(null) }

    Scaffold(topBar = { FormTopBar("Budgets · ${vm.month.label()}", onBack) }) { padding ->
        val all = categories ?: return@Scaffold
        val roots = all.filter { it.kind == Kind.EXPENSE && it.parentId == null }
        val spent = remember(operations) {
            Forecast.breakdown(operations, Kind.EXPENSE).associate { it.categoryId to it.cents }
        }
        val budgetOf = budgets.associate { it.categoryId to it.amountCents }
        val totalBudget = budgetOf.values.sum()
        val totalSpent = roots.filter { it.id in budgetOf }.sumOf { spent[it.id] ?: 0 }
        val (withBudget, without) = roots.partition { it.id in budgetOf }

        LazyColumn(Modifier.padding(padding), contentPadding = PaddingValues(bottom = 32.dp)) {
            item {
                Column(
                    Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Overline("Total des budgets")
                    if (totalBudget > 0) {
                        BudgetProgress(totalSpent, totalBudget)
                    } else {
                        Text(
                            "Aucun budget. Touchez une catégorie pour lui donner un budget mensuel.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }
            items(withBudget + without, key = { it.id }) { category ->
                val budget = budgetOf[category.id]
                Row(
                    Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surface)
                        .clickable { editing = category }
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    CategoryBadge(category.emoji, category.color)
                    Column(Modifier.weight(1f)) {
                        Text(category.name)
                        if (budget != null) {
                            BudgetProgress(spent[category.id] ?: 0, budget)
                        } else {
                            Text(
                                "Pas de budget · ${Money.format(spent[category.id] ?: 0)} ce mois-ci",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }
        }
    }

    editing?.let { category ->
        var text by remember(category) { mutableStateOf(budgets.find { it.categoryId == category.id }?.amountCents?.let(Money::toInput).orEmpty()) }
        AlertDialog(
            onDismissRequest = { editing = null },
            title = { Text("Budget mensuel · ${category.name}") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    AmountField(text, { text = it }, "Montant par mois", isError = text.isNotEmpty() && Money.parse(text) == null)
                    Text(
                        "Sous-catégories comprises. Laissez vide pour retirer le budget.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        vm.setBudget(category.id, Money.parse(text))
                        editing = null
                    },
                    enabled = text.isEmpty() || Money.parse(text) != null,
                ) { Text("Enregistrer") }
            },
            dismissButton = { TextButton(onClick = { editing = null }) { Text("Annuler") } },
        )
    }
}
