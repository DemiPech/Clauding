package net.demipech.budget.ui.operations

import net.demipech.budget.data.isTransfer
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import net.demipech.budget.data.AccountWithBalance
import net.demipech.budget.data.BudgetRepository
import net.demipech.budget.data.Kind
import net.demipech.budget.data.OperationDetails
import net.demipech.budget.data.ScheduledDetails
import net.demipech.budget.data.title
import net.demipech.budget.domain.Forecast
import net.demipech.budget.domain.Money
import net.demipech.budget.ui.components.EmptyState
import net.demipech.budget.ui.components.MonthSwitcher
import net.demipech.budget.ui.components.ShortDayFormat
import net.demipech.budget.ui.components.TotalsRow
import net.demipech.budget.ui.repository
import androidx.compose.material3.TextButton
import net.demipech.budget.data.DeferredDebitTotal
import net.demipech.budget.ui.theme.amountColor
import net.demipech.budget.ui.theme.expenseColor
import net.demipech.budget.ui.theme.incomeColor
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth

@OptIn(ExperimentalCoroutinesApi::class)
class TransactionsViewModel(repo: BudgetRepository, private val accountId: Long?) : ViewModel() {
    val month = MutableStateFlow(YearMonth.now())

    val operations: StateFlow<List<OperationDetails>?> =
        month.flatMapLatest { m -> repo.operationsBetween(m.atDay(1), m.atEndOfMonth(), accountId) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    val scheduled: StateFlow<List<ScheduledDetails>> =
        repo.scheduled()
            .map { list ->
                list.filter { accountId == null || it.scheduled.accountId == accountId || it.scheduled.toAccountId == accountId }
            }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val debits: StateFlow<List<DeferredDebitTotal>> =
        month.flatMapLatest { m -> repo.deferredDebits(m.atDay(1), m.atEndOfMonth(), accountId) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val account: StateFlow<AccountWithBalance?> =
        (if (accountId == null) flowOf(null)
        else repo.accountsWithBalance().map { list -> list.find { it.account.id == accountId } })
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
}

private data class DayTotals(val income: Long, val expense: Long)

/** Revenus et dépenses, sans les virements (ni l'un ni l'autre). */
private fun List<OperationDetails>.totals() = filter { !it.operation.isTransfer }.let { ops ->
    DayTotals(
        income = ops.filter { it.operation.kind == Kind.INCOME }.sumOf { it.operation.amountCents },
        expense = ops.filter { it.operation.kind == Kind.EXPENSE }.sumOf { it.operation.amountCents },
    )
}

/**
 * Opérations d'un mois, façon Money Manager : vue Liste (groupée par jour) ou
 * Calendrier. [accountId] null = tous les comptes, sinon celles d'un compte.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionsScreen(
    accountId: Long?,
    onEditOperation: (Long) -> Unit,
    onAddOperation: (LocalDate?) -> Unit,
    onShowScheduled: () -> Unit,
    onBack: (() -> Unit)? = null,
    onEditAccount: (() -> Unit)? = null,
    onReconcile: (() -> Unit)? = null,
) {
    val repo = repository()
    val vm = viewModel(key = "transactions-$accountId") { TransactionsViewModel(repo, accountId) }
    val month by vm.month.collectAsStateWithLifecycle()
    val operations by vm.operations.collectAsStateWithLifecycle()
    val scheduled by vm.scheduled.collectAsStateWithLifecycle()
    val account by vm.account.collectAsStateWithLifecycle()
    val debits by vm.debits.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableStateOf(0) }
    var selectedDay by remember(month) {
        mutableStateOf(if (YearMonth.now() == month) LocalDate.now() else month.atDay(1))
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        account?.let {
                            Text(
                                "${it.account.icon} ${it.account.name} · ${Money.format(it.balanceCents)}" +
                                    if (it.pendingCents != 0L) " · encours ${Money.format(it.pendingCents)}" else "",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        MonthSwitcher(month, { vm.month.value = it })
                    }
                },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                        }
                    }
                },
                actions = {
                    if (onReconcile != null) {
                        TextButton(onClick = onReconcile) { Text("Pointer") }
                    }
                    if (onEditAccount != null) {
                        IconButton(onClick = onEditAccount) {
                            Icon(Icons.Filled.Edit, contentDescription = "Modifier le compte")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { onAddOperation(if (tab == 1) selectedDay else null) },
                shape = CircleShape,
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ) { Icon(Icons.Filled.Add, contentDescription = "Ajouter une opération") }
        },
    ) { padding ->
        val list = operations ?: return@Scaffold
        val monthTotals = remember(list) { list.totals() }
        val byDay = remember(list) { list.groupBy { it.operation.date } }
        val recurrences = remember(scheduled, month) {
            Forecast.upcoming(scheduled, month.atDay(1), month.atEndOfMonth(), accountId)
        }

        LazyColumn(
            modifier = Modifier.padding(padding),
            contentPadding = PaddingValues(bottom = 96.dp),
        ) {
            item {
                Column(Modifier.background(MaterialTheme.colorScheme.surface)) {
                    TabRow(
                        selectedTabIndex = tab,
                        containerColor = MaterialTheme.colorScheme.surface,
                    ) {
                        listOf("Liste", "Calendrier").forEachIndexed { index, label ->
                            Tab(selected = tab == index, onClick = { tab = index }, text = { Text(label) })
                        }
                    }
                    TotalsRow(monthTotals.income, monthTotals.expense)
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    if (recurrences.isNotEmpty()) {
                        RecurrenceBanner(
                            names = recurrences.map { it.details.title }.distinct(),
                            dates = recurrences.map { it.date }.distinct(),
                            total = recurrences.sumOf { it.signedCents },
                            onClick = onShowScheduled,
                        )
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    }
                    debits.forEach { debit ->
                        DeferredDebitBanner(debit)
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    }
                }
            }
            if (tab == 0) {
                if (list.isEmpty()) {
                    item { EmptyState("Aucune opération ce mois-ci.\nTouchez + pour en ajouter une.") }
                }
                byDay.forEach { (date, ops) ->
                    item(key = "day-$date") {
                        Column {
                            Spacer(Modifier.height(10.dp))
                            val t = ops.totals()
                            DayHeader(date, t.income, t.expense)
                            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        }
                    }
                    operationItems(ops, onEditOperation, accountId != null)
                }
            } else {
                item(key = "calendar") {
                    MonthCalendar(
                        month = month,
                        totals = remember(byDay) { byDay.mapValues { it.value.totals() } },
                        selected = selectedDay,
                        onSelect = { selectedDay = it },
                    )
                }
                val dayOps = byDay[selectedDay].orEmpty()
                item(key = "selected-day") {
                    Column {
                        Spacer(Modifier.height(10.dp))
                        val t = dayOps.totals()
                        DayHeader(selectedDay, t.income, t.expense)
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    }
                }
                operationItems(dayOps, onEditOperation, accountId != null)
            }
        }
    }
}

private fun LazyListScope.operationItems(ops: List<OperationDetails>, onEdit: (Long) -> Unit, accountView: Boolean) {
    items(ops, key = { it.operation.id }) { op ->
        OperationLine(op, onClick = { onEdit(op.operation.id) }, accountView = accountView)
    }
}

/** « Récurrences  Téléphone, Google One…  17/11, 18/11  -136,65 € ». */
@Composable
private fun RecurrenceBanner(names: List<String>, dates: List<LocalDate>, total: Long, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "Récurrences",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(104.dp),
        )
        Column(Modifier.weight(1f).padding(end = 8.dp)) {
            Text(names.joinToString(", "), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(
                dates.joinToString(", ") { it.format(ShortDayFormat) },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Text(Money.formatSigned(total), color = amountColor(total), style = MaterialTheme.typography.bodyLarge)
    }
}

/** « Débit différé  Boursorama · 12 dépenses, le 30/11  -412,30 € ». */
@Composable
private fun DeferredDebitBanner(debit: DeferredDebitTotal) {
    val done = !debit.debitDate.isAfter(LocalDate.now())
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "Débit différé",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(104.dp),
        )
        Column(Modifier.weight(1f).padding(end = 8.dp)) {
            Text(
                "💳 ${debit.accountName} · ${debit.count} dépense" + if (debit.count > 1) "s" else "",
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                (if (done) "débité le " else "à débiter le ") + debit.debitDate.format(ShortDayFormat),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(Money.format(-debit.cents), color = expenseColor(), style = MaterialTheme.typography.bodyLarge)
    }
}

private val weekdayInitials = listOf("L", "M", "M", "J", "V", "S", "D")

/** Grille du mois (semaines commençant le lundi), avec les totaux de chaque jour. */
@Composable
private fun MonthCalendar(
    month: YearMonth,
    totals: Map<LocalDate, DayTotals>,
    selected: LocalDate,
    onSelect: (LocalDate) -> Unit,
) {
    val offset = month.atDay(1).dayOfWeek.value - DayOfWeek.MONDAY.value
    val cells = offset + month.lengthOfMonth()
    val rows = (cells + 6) / 7
    val today = LocalDate.now()
    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(horizontal = 4.dp, vertical = 8.dp),
    ) {
        Row {
            weekdayInitials.forEachIndexed { i, label ->
                Text(
                    label,
                    style = MaterialTheme.typography.labelMedium,
                    color = when (i) {
                        5 -> incomeColor()
                        6 -> expenseColor()
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    modifier = Modifier.weight(1f).padding(vertical = 4.dp),
                    textAlign = TextAlign.Center,
                )
            }
        }
        for (row in 0 until rows) {
            Row {
                for (col in 0 until 7) {
                    val dayNumber = row * 7 + col - offset + 1
                    val cellModifier = Modifier.weight(1f).height(60.dp).padding(1.dp)
                    if (dayNumber < 1 || dayNumber > month.lengthOfMonth()) {
                        Spacer(cellModifier)
                    } else {
                        val date = month.atDay(dayNumber)
                        DayCell(date, totals[date], date == selected, date == today, { onSelect(date) }, cellModifier)
                    }
                }
            }
        }
    }
}

@Composable
private fun DayCell(
    date: LocalDate,
    totals: DayTotals?,
    selected: Boolean,
    isToday: Boolean,
    onClick: () -> Unit,
    modifier: Modifier,
) {
    Column(
        modifier
            .background(
                if (selected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.6f)
                else MaterialTheme.colorScheme.surfaceContainerHigh,
                RoundedCornerShape(6.dp),
            )
            .then(
                if (isToday) Modifier.border(1.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(6.dp))
                else Modifier
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 3.dp, vertical = 2.dp),
    ) {
        Text(
            date.dayOfMonth.toString(),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal,
        )
        Spacer(Modifier.weight(1f))
        if (totals != null && totals.income > 0) {
            Text(Money.plain(totals.income), color = incomeColor(), fontSize = 9.sp, maxLines = 1, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.End)
        }
        if (totals != null && totals.expense > 0) {
            Text(Money.plain(totals.expense), color = expenseColor(), fontSize = 9.sp, maxLines = 1, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.End)
        }
    }
}

