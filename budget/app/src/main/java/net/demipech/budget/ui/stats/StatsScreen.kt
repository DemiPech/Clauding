package net.demipech.budget.ui.stats

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
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
import net.demipech.budget.data.BudgetRepository
import net.demipech.budget.data.Kind
import net.demipech.budget.data.OperationDetails
import net.demipech.budget.data.isTransfer
import net.demipech.budget.domain.Forecast
import net.demipech.budget.domain.Money
import net.demipech.budget.ui.components.CategoryBadge
import net.demipech.budget.ui.components.Donut
import net.demipech.budget.ui.components.MonthSwitcher
import net.demipech.budget.ui.components.Overline
import net.demipech.budget.ui.components.Segmented
import net.demipech.budget.ui.theme.kindColor
import net.demipech.budget.ui.repository

@OptIn(ExperimentalCoroutinesApi::class)
class StatsViewModel(repo: BudgetRepository) : ViewModel() {
    val month = MutableStateFlow(java.time.YearMonth.now())
    val operations: StateFlow<List<OperationDetails>?> =
        month.flatMapLatest { m -> repo.operationsBetween(m.atDay(1), m.atEndOfMonth()) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatsScreen() {
    val repo = repository()
    val vm = viewModel { StatsViewModel(repo) }
    val month by vm.month.collectAsStateWithLifecycle()
    val operations by vm.operations.collectAsStateWithLifecycle()
    var kind by rememberSaveable { mutableStateOf(Kind.EXPENSE) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { MonthSwitcher(month, { vm.month.value = it }) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
    ) { padding ->
        val list = operations ?: return@Scaffold
        val incomeTotal = remember(list) { list.filter { it.operation.kind == Kind.INCOME && !it.operation.isTransfer }.sumOf { it.operation.amountCents } }
        val expenseTotal = remember(list) { list.filter { it.operation.kind == Kind.EXPENSE && !it.operation.isTransfer }.sumOf { it.operation.amountCents } }
        val slices = remember(list, kind) { Forecast.breakdown(list, kind) }
        val total = slices.sumOf { it.cents }
        val fallback = MaterialTheme.colorScheme.outline

        LazyColumn(Modifier.padding(padding), contentPadding = PaddingValues(bottom = 24.dp)) {
            item {
                Column {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surface)
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Segmented(
                        options = listOf(Kind.INCOME, Kind.EXPENSE),
                        selected = kind,
                        label = {
                            if (it == Kind.INCOME) "Revenus ${Money.format(incomeTotal)}"
                            else "Dépenses ${Money.format(expenseTotal)}"
                        },
                        onSelect = { kind = it },
                    )
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
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                }
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
            items(slices, key = { it.categoryId ?: -1L }) { slice ->
                val color = slice.color?.let { Color(it) } ?: fallback
                Column(Modifier.background(MaterialTheme.colorScheme.surface)) {
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
                            modifier = Modifier
                                .width(52.dp)
                                .background(color, RoundedCornerShape(6.dp))
                                .padding(vertical = 4.dp),
                        )
                        CategoryBadge(slice.emoji, slice.color, size = 32)
                        Text(slice.name, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(Money.format(slice.cents), style = MaterialTheme.typography.bodyLarge)
                    }
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                }
            }
        }
    }
}
