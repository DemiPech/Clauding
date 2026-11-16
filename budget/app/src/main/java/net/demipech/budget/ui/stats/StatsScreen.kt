package net.demipech.budget.ui.stats

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
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
import net.demipech.budget.data.Budget
import net.demipech.budget.data.BudgetRepository
import net.demipech.budget.data.Kind
import net.demipech.budget.data.OperationDetails
import net.demipech.budget.domain.Analytics
import net.demipech.budget.domain.Forecast
import net.demipech.budget.domain.Money
import net.demipech.budget.domain.MonthTotals
import net.demipech.budget.ui.components.BudgetProgress
import net.demipech.budget.ui.components.CategoryBadge
import net.demipech.budget.ui.components.Donut
import net.demipech.budget.ui.components.MonthBar
import net.demipech.budget.ui.components.MonthlyBars
import net.demipech.budget.ui.components.Overline
import net.demipech.budget.ui.components.Segmented
import net.demipech.budget.ui.components.label
import net.demipech.budget.ui.repository
import net.demipech.budget.ui.theme.amountColor
import net.demipech.budget.ui.theme.expenseColor
import net.demipech.budget.ui.theme.incomeColor
import net.demipech.budget.ui.theme.kindColor
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

@OptIn(ExperimentalCoroutinesApi::class)
class StatsViewModel(repo: BudgetRepository) : ViewModel() {
    val month = MutableStateFlow(YearMonth.now())
    val operations: StateFlow<List<OperationDetails>?> =
        month.flatMapLatest { m -> repo.operationsBetween(m.atDay(1), m.atEndOfMonth()) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    /** Les 12 mois qui finissent au mois affiché. */
    val year: StateFlow<List<OperationDetails>> =
        month.flatMapLatest { m -> repo.operationsBetween(m.minusMonths(11).atDay(1), m.atEndOfMonth()) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val budgets: StateFlow<List<Budget>> =
        repo.budgets().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
}

private val ShortMonth: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM", Locale.FRENCH)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatsScreen(onBudgets: () -> Unit) {
    val repo = repository()
    val vm = viewModel { StatsViewModel(repo) }
    val month by vm.month.collectAsStateWithLifecycle()
    val operations by vm.operations.collectAsStateWithLifecycle()
    val year by vm.year.collectAsStateWithLifecycle()
    val budgets by vm.budgets.collectAsStateWithLifecycle()
    var yearly by rememberSaveable { mutableStateOf(false) }
    var kind by rememberSaveable { mutableStateOf(Kind.EXPENSE) }
    var expanded by remember { mutableStateOf<Long?>(-2L) }

    Scaffold(
        topBar = {
            Column {
                TopAppBar(
                    title = { Text("Statistiques") },
                    actions = { TextButton(onClick = onBudgets) { Text("Budgets") } },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
                )
                MonthBar(month) { vm.month.value = it }
            }
        },
    ) { padding ->
        val list = operations ?: return@Scaffold
        LazyColumn(Modifier.padding(padding), contentPadding = PaddingValues(bottom = 24.dp)) {
            item {
                Segmented(
                    listOf(false, true), yearly, { if (it) "12 derniers mois" else "Ce mois" }, { yearly = it },
                    Modifier.background(MaterialTheme.colorScheme.surface).padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }
            if (yearly) {
                yearItems(year, month)
            } else {
                monthItems(list, kind, { kind = it }, budgets, expanded, { expanded = if (expanded == it) -2L else it })
            }
        }
    }
}

private fun LazyListScope.monthItems(
    list: List<OperationDetails>,
    kind: Kind,
    onKind: (Kind) -> Unit,
    budgets: List<Budget>,
    expanded: Long?,
    onToggle: (Long?) -> Unit,
) {
    val totals = Analytics.totals(list)
    val slices = Forecast.breakdown(list, kind)
    val total = slices.sumOf { it.cents }
    val budgetOf = budgets.associate { it.categoryId to it.amountCents }
    item {
        Column(
            Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Segmented(
                options = listOf(Kind.INCOME, Kind.EXPENSE),
                selected = kind,
                label = {
                    if (it == Kind.INCOME) "Revenus ${Money.format(totals.income)}"
                    else "Dépenses ${Money.format(totals.expense)}"
                },
                onSelect = onKind,
            )
            val fallback = MaterialTheme.colorScheme.outline
            Donut(
                values = slices.map { (it.color?.let { c -> Color(c) } ?: fallback) to it.cents },
                modifier = Modifier.padding(top = 24.dp, bottom = 8.dp).size(220.dp),
                thickness = 36.dp,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Overline(if (kind == Kind.EXPENSE) "Dépenses" else "Revenus")
                    Text(Money.format(total), style = MaterialTheme.typography.titleLarge, color = kindColor(kind))
                }
            }
            Text(
                "Touchez une catégorie pour le détail par sous-catégorie.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    }
    if (slices.isEmpty()) {
        item {
            Text(
                if (kind == Kind.EXPENSE) "Aucune dépense ce mois-ci." else "Aucun revenu ce mois-ci.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(32.dp),
            )
        }
    }
    items(slices, key = { "slice-${it.categoryId}" }) { slice ->
        val fallback = MaterialTheme.colorScheme.outline
        val color = slice.color?.let { Color(it) } ?: fallback
        Column(
            Modifier
                .background(MaterialTheme.colorScheme.surface)
                .clickable { onToggle(slice.categoryId) }
        ) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    "${slice.cents * 100 / total} %",
                    color = Color.White,
                    style = MaterialTheme.typography.labelLarge,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.width(52.dp).background(color, RoundedCornerShape(6.dp)).padding(vertical = 4.dp),
                )
                CategoryBadge(slice.emoji, slice.color, size = 32)
                Text(slice.name, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(Money.format(slice.cents), style = MaterialTheme.typography.bodyLarge)
            }
            val budget = slice.categoryId?.let { budgetOf[it] }
            if (kind == Kind.EXPENSE && budget != null) {
                BudgetProgress(slice.cents, budget, Modifier.padding(start = 80.dp, end = 16.dp, bottom = 8.dp))
            }
            if (expanded == slice.categoryId) {
                Analytics.subBreakdown(list, slice.categoryId, kind).forEach { (name, cents) ->
                    Row(Modifier.fillMaxWidth().padding(start = 80.dp, end = 16.dp, top = 2.dp, bottom = 6.dp)) {
                        Text(name ?: "${slice.name} (sans sous-catégorie)", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                        Text("${cents * 100 / slice.cents} %  ", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(Money.format(cents), style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        }
    }
}

private fun LazyListScope.yearItems(operations: List<OperationDetails>, last: YearMonth) {
    val months = (11 downTo 0).map { last.minusMonths(it.toLong()) }
    val monthly = Analytics.monthly(operations, months)
    val income = monthly.sumOf { it.totals.income }
    val expense = monthly.sumOf { it.totals.expense }
    item {
        Column(
            Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("${months.first().label()} – ${months.last().label()}", style = MaterialTheme.typography.titleSmall)
            MonthlyBars(monthly) { it.month.atDay(1).format(ShortMonth).take(3) }
            Row {
                Figure("Revenus / mois", Money.format(income / 12), incomeColor(), Modifier.weight(1f))
                Figure("Dépenses / mois", Money.format(expense / 12), expenseColor(), Modifier.weight(1f))
                Figure("Épargne", Money.format(income - expense), amountColor(income - expense), Modifier.weight(1f))
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(horizontal = 16.dp, vertical = 8.dp)) {
            Overline("Mois", Modifier.weight(1f))
            Overline("Revenus", Modifier.weight(1f))
            Overline("Dépenses", Modifier.weight(1f))
            Overline("Bilan", Modifier.weight(1f))
        }
    }
    items(monthly.reversed(), key = { "m-${it.month}" }) { MonthRow(it) }
}

@Composable
private fun MonthRow(m: MonthTotals) {
    Row(
        Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Text(m.month.label(), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f), maxLines = 1)
        Text(Money.plain(m.totals.income), color = incomeColor(), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        Text(Money.plain(m.totals.expense), color = expenseColor(), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        Text(Money.plain(m.totals.net), color = amountColor(m.totals.net), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
}

@Composable
private fun Figure(label: String, value: String, color: Color, modifier: Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Overline(label)
        Text(value, color = color, style = MaterialTheme.typography.titleMedium, maxLines = 1)
    }
}
