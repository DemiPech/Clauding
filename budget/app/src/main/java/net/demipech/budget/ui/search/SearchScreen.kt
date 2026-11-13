package net.demipech.budget.ui.search

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import net.demipech.budget.data.Account
import net.demipech.budget.data.BudgetRepository
import net.demipech.budget.data.Category
import net.demipech.budget.data.Kind
import net.demipech.budget.data.OperationDetails
import net.demipech.budget.data.isTransfer
import net.demipech.budget.domain.Analytics
import net.demipech.budget.domain.Money
import net.demipech.budget.ui.components.AmountField
import net.demipech.budget.ui.components.CategoryBadge
import net.demipech.budget.ui.components.FormTopBar
import net.demipech.budget.ui.components.Selector
import net.demipech.budget.ui.components.TotalsRow
import net.demipech.budget.ui.components.emojiOf
import net.demipech.budget.ui.components.fullName
import net.demipech.budget.ui.components.ordered
import net.demipech.budget.ui.operations.OperationCardRow
import net.demipech.budget.ui.repository
import java.time.LocalDate
import java.time.YearMonth

/** Période de recherche. */
enum class Period(val label: String) {
    MONTH("Ce mois"),
    THREE_MONTHS("3 derniers mois"),
    YEAR("Cette année"),
    TWELVE_MONTHS("12 derniers mois"),
    ALL("Tout");

    fun range(today: LocalDate = LocalDate.now()): Pair<LocalDate, LocalDate> {
        val month = YearMonth.from(today)
        return when (this) {
            MONTH -> month.atDay(1) to month.atEndOfMonth()
            THREE_MONTHS -> month.minusMonths(2).atDay(1) to month.atEndOfMonth()
            YEAR -> LocalDate.of(today.year, 1, 1) to LocalDate.of(today.year, 12, 31)
            TWELVE_MONTHS -> month.minusMonths(11).atDay(1) to month.atEndOfMonth()
            ALL -> LocalDate.of(1900, 1, 1) to LocalDate.of(2200, 12, 31)
        }
    }
}

enum class TypeFilter(val label: String) { ALL("Tout"), EXPENSE("Dépenses"), INCOME("Rentrées"), TRANSFER("Virements") }

@OptIn(ExperimentalCoroutinesApi::class)
class SearchViewModel(repo: BudgetRepository) : ViewModel() {
    val period = MutableStateFlow(Period.TWELVE_MONTHS)
    val operations: StateFlow<List<OperationDetails>?> =
        period.flatMapLatest { p -> p.range().let { (from, to) -> repo.operationsBetween(from, to) } }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val accounts: StateFlow<List<Account>> =
        repo.accounts().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val categories: StateFlow<List<Category>> =
        repo.categories().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    var query by mutableStateOf("")
    var type by mutableStateOf(TypeFilter.ALL)
    var accountId by mutableStateOf<Long?>(null)
    var categoryId by mutableStateOf<Long?>(null)
    var minAmount by mutableStateOf("")
    var maxAmount by mutableStateOf("")

    fun reset() {
        query = ""; type = TypeFilter.ALL; accountId = null; categoryId = null; minAmount = ""; maxAmount = ""
        period.value = Period.TWELVE_MONTHS
    }

    fun filter(ops: List<OperationDetails>): List<OperationDetails> {
        val min = Money.parse(minAmount)
        val max = Money.parse(maxAmount)
        return ops.filter { d ->
            val op = d.operation
            when (type) {
                TypeFilter.ALL -> true
                TypeFilter.EXPENSE -> op.kind == Kind.EXPENSE && !op.isTransfer
                TypeFilter.INCOME -> op.kind == Kind.INCOME && !op.isTransfer
                TypeFilter.TRANSFER -> op.isTransfer
            } &&
                (accountId == null || op.accountId == accountId) &&
                (categoryId == null || op.categoryId == categoryId || d.rootCategoryId == categoryId) &&
                (min == null || op.amountCents >= min) &&
                (max == null || op.amountCents <= max) &&
                Analytics.matches(d, query)
        }
    }
}

@Composable
fun SearchScreen(onBack: () -> Unit, onEditOperation: (Long) -> Unit) {
    val repo = repository()
    val vm = viewModel { SearchViewModel(repo) }
    val period by vm.period.collectAsStateWithLifecycle()
    val operations by vm.operations.collectAsStateWithLifecycle()
    val accounts by vm.accounts.collectAsStateWithLifecycle()
    val categories by vm.categories.collectAsStateWithLifecycle()
    var showFilters by remember { mutableStateOf(false) }

    Scaffold(topBar = { FormTopBar("Rechercher", onBack) }) { padding ->
        val results = operations?.let { vm.filter(it) }
        LazyColumn(Modifier.padding(padding), contentPadding = PaddingValues(bottom = 32.dp)) {
            item {
                Column(
                    Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    OutlinedTextField(
                        value = vm.query,
                        onValueChange = { vm.query = it },
                        leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                        placeholder = { Text("Libellé, catégorie, compte, montant…") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Row {
                        Selector(
                            label = "Période",
                            options = Period.entries,
                            selected = period,
                            optionLabel = { it.label },
                            onSelect = { vm.period.value = it },
                            modifier = Modifier.weight(1f),
                        )
                        TextButton(onClick = { showFilters = !showFilters }) {
                            Text(if (showFilters) "Moins de filtres" else "Plus de filtres")
                        }
                    }
                    if (showFilters) {
                        Selector(
                            label = "Type",
                            options = TypeFilter.entries,
                            selected = vm.type,
                            optionLabel = { it.label },
                            onSelect = { vm.type = it },
                        )
                        Selector(
                            label = "Compte",
                            options = listOf<Account?>(null) + accounts,
                            selected = accounts.find { it.id == vm.accountId },
                            optionLabel = { it?.let { a -> "${a.icon} ${a.name}" } ?: "Tous les comptes" },
                            onSelect = { vm.accountId = it?.id },
                            emptyLabel = "Tous les comptes",
                        )
                        val options = remember(categories) { categories.ordered(Kind.EXPENSE) + categories.ordered(Kind.INCOME) }
                        Selector(
                            label = "Catégorie (sous-catégories comprises)",
                            options = listOf<Category?>(null) + options,
                            selected = options.find { it.id == vm.categoryId },
                            optionLabel = { it?.let { c -> categories.fullName(c) } ?: "Toutes les catégories" },
                            onSelect = { vm.categoryId = it?.id },
                            leading = { c -> CategoryBadge(c?.let { categories.emojiOf(it) }, c?.color, size = 28) },
                            emptyLabel = "Toutes les catégories",
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            AmountField(vm.minAmount, { vm.minAmount = it }, "Montant min", Modifier.weight(1f))
                            AmountField(vm.maxAmount, { vm.maxAmount = it }, "Montant max", Modifier.weight(1f))
                        }
                        TextButton(onClick = vm::reset) { Text("Effacer les filtres") }
                    }
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }
            if (results != null) {
                item {
                    val totals = Analytics.totals(results)
                    Column(Modifier.background(MaterialTheme.colorScheme.surface)) {
                        Text(
                            "${results.size} opération" + (if (results.size > 1) "s" else ""),
                            style = MaterialTheme.typography.titleSmall,
                            modifier = Modifier.padding(start = 16.dp, top = 12.dp),
                        )
                        TotalsRow(totals.income, totals.expense)
                    }
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                }
                items(results, key = { it.operation.id }) { op ->
                    OperationCardRow(op, onClick = { onEditOperation(op.operation.id) })
                }
            }
        }
    }
}
