package net.demipech.budget.ui.home

import net.demipech.budget.data.isTransfer
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import net.demipech.budget.data.AccountWithBalance
import net.demipech.budget.data.BudgetRepository
import net.demipech.budget.data.Kind
import net.demipech.budget.data.OperationDetails
import net.demipech.budget.data.ScheduledDetails
import net.demipech.budget.data.title
import net.demipech.budget.domain.Forecast
import net.demipech.budget.domain.Money
import net.demipech.budget.domain.Upcoming
import net.demipech.budget.ui.components.AmountText
import net.demipech.budget.ui.components.CategoryBadge
import net.demipech.budget.ui.components.DayFormat
import net.demipech.budget.ui.components.Donut
import net.demipech.budget.ui.components.Overline
import net.demipech.budget.ui.components.SectionCard
import net.demipech.budget.ui.components.describeSchedule
import net.demipech.budget.ui.operations.OperationCardRow
import net.demipech.budget.ui.repository
import net.demipech.budget.data.DeferredDebitTotal
import net.demipech.budget.ui.theme.amountColor
import java.time.LocalDate
import java.time.YearMonth

class HomeViewModel(repo: BudgetRepository) : ViewModel() {
    private val month = YearMonth.now()

    val accounts: StateFlow<List<AccountWithBalance>?> =
        repo.accountsWithBalance().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val monthOperations: StateFlow<List<OperationDetails>> =
        repo.operationsBetween(month.atDay(1), month.atEndOfMonth())
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val recent: StateFlow<List<OperationDetails>> =
        repo.recentOperations(5).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val scheduled: StateFlow<List<ScheduledDetails>> =
        repo.scheduled().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    /** Débits différés pas encore passés (deux mois à venir). */
    val debits: StateFlow<List<DeferredDebitTotal>> =
        LocalDate.now().let { today -> repo.deferredDebits(today.plusDays(1), today.plusMonths(2)) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
}

@Composable
fun HomeScreen(
    onOpenAccount: (Long) -> Unit,
    onAddAccount: () -> Unit,
    onAddOperation: () -> Unit,
    onEditOperation: (Long) -> Unit,
    onShowOperations: () -> Unit,
    onShowStats: () -> Unit,
    onShowScheduled: () -> Unit,
) {
    val repo = repository()
    val vm = viewModel { HomeViewModel(repo) }
    val accounts by vm.accounts.collectAsStateWithLifecycle()
    val monthOps by vm.monthOperations.collectAsStateWithLifecycle()
    val recent by vm.recent.collectAsStateWithLifecycle()
    val scheduled by vm.scheduled.collectAsStateWithLifecycle()
    val debits by vm.debits.collectAsStateWithLifecycle()

    val today = LocalDate.now()
    val upcoming = remember(scheduled, today) { Forecast.upcoming(scheduled, today, today.plusDays(30)) }
    val untilMonthEnd = remember(scheduled, today) {
        Forecast.upcoming(scheduled, today, YearMonth.from(today).atEndOfMonth()).sumOf { it.signedCents }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        floatingActionButton = {
            FloatingActionButton(
                onClick = onAddOperation,
                shape = CircleShape,
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ) { Icon(Icons.Filled.Add, contentDescription = "Ajouter une opération") }
        },
    ) { padding ->
        val accountList = accounts ?: return@Scaffold
        val total = accountList.sumOf { it.balanceCents }
        LazyColumn(
            modifier = Modifier.padding(padding),
            contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(16.dp))
                        .padding(12.dp),
                ) {
                    Text(
                        "Mes comptes",
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.padding(start = 4.dp, bottom = 12.dp),
                    )
                    AccountTiles(accountList, onOpenAccount, onAddAccount)
                }
            }
            item {
                val monthEnd = YearMonth.from(today).atEndOfMonth()
                val debitsThisMonth = debits.filter { !it.debitDate.isAfter(monthEnd) }.sumOf { it.cents }
                BalanceCard(total, total + untilMonthEnd - debitsThisMonth, debits.take(3))
            }
            item { SpendingCard(monthOps, onShowStats) }
            item { RecentCard(recent, onEditOperation, onShowOperations) }
            item { UpcomingCard(upcoming.take(5), onShowScheduled) }
        }
    }
}

@Composable
private fun AccountTiles(accounts: List<AccountWithBalance>, onOpen: (Long) -> Unit, onAdd: () -> Unit) {
    val cells: List<AccountWithBalance?> = accounts + listOf(null)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        cells.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { item ->
                    val mod = Modifier.weight(1f).height(72.dp)
                    if (item == null) AddAccountTile(onAdd, mod) else AccountTile(item, { onOpen(item.account.id) }, mod)
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun AccountTile(item: AccountWithBalance, onClick: () -> Unit, modifier: Modifier) {
    Column(
        modifier
            .background(Color(item.account.color), RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            "${item.account.icon} ${item.account.name}",
            color = Color.White,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            Money.format(item.balanceCents),
            color = Color.White,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
        )
        if (item.pendingCents != 0L) {
            Text(
                "encours ${Money.format(item.pendingCents)}",
                color = Color.White.copy(alpha = 0.85f),
                style = MaterialTheme.typography.labelSmall,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun AddAccountTile(onClick: () -> Unit, modifier: Modifier) {
    Row(
        modifier
            .border(BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "Ajouter un compte",
            color = MaterialTheme.colorScheme.secondary,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f),
        )
        Icon(Icons.Filled.Add, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
    }
}

@Composable
private fun BalanceCard(today: Long, endOfMonth: Long, debits: List<DeferredDebitTotal>) {
    SectionCard(title = "Solde réel") {
        Row(Modifier.padding(horizontal = 16.dp)) {
            Column(Modifier.weight(1f)) {
                Overline("Aujourd'hui")
                Text(Money.format(today), style = MaterialTheme.typography.headlineMedium, color = amountColor(today))
            }
            Column(horizontalAlignment = Alignment.End) {
                Overline("Fin du mois prévue")
                Text(Money.format(endOfMonth), style = MaterialTheme.typography.titleLarge, color = amountColor(endOfMonth))
            }
        }
        if (debits.isNotEmpty()) {
            Overline("Débits différés à venir", Modifier.padding(start = 16.dp, top = 12.dp, bottom = 4.dp))
            debits.forEach { debit ->
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 2.dp)) {
                    Text(
                        "💳 ${debit.accountName} · le ${debit.debitDate.format(DayFormat)}",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f),
                    )
                    AmountText(-debit.cents)
                }
            }
        }
    }
}

@Composable
private fun SpendingCard(monthOps: List<OperationDetails>, onShowMore: () -> Unit) {
    val slices = remember(monthOps) { Forecast.breakdown(monthOps, Kind.EXPENSE) }
    val total = slices.sumOf { it.cents }
    val other = MaterialTheme.colorScheme.outline
    SectionCard(title = "Structure des dépenses", onShowMore = onShowMore) {
        Column(Modifier.padding(horizontal = 16.dp)) {
            Overline("Ce mois-ci")
            Text(Money.format(total), style = MaterialTheme.typography.headlineMedium)
        }
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Donut(
                values = slices.map { (it.color?.let { Color(it) } ?: other) to it.cents },
                modifier = Modifier.size(140.dp),
                thickness = 26.dp,
            )
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (slices.isEmpty()) {
                    Text("Aucune dépense ce mois-ci.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                slices.take(5).forEach { slice ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(10.dp).background(slice.color?.let { Color(it) } ?: other, CircleShape))
                        Text(
                            " ${slice.emoji} ${slice.name}".replace("  ", " "),
                            style = MaterialTheme.typography.bodySmall,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            "${slice.cents * 100 / total} %",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RecentCard(recent: List<OperationDetails>, onEdit: (Long) -> Unit, onShowMore: () -> Unit) {
    SectionCard(title = "Derniers enregistrements", onShowMore = onShowMore) {
        if (recent.isEmpty()) {
            Text(
                "Aucune opération pour l'instant. Touchez + pour en ajouter une.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
        }
        recent.forEach { op -> OperationCardRow(op, onClick = { onEdit(op.operation.id) }) }
    }
}

@Composable
private fun UpcomingCard(upcoming: List<Upcoming>, onShowMore: () -> Unit) {
    SectionCard(title = "Paiements planifiés à venir", onShowMore = onShowMore) {
        if (upcoming.isEmpty()) {
            Text(
                "Rien de prévu dans les 30 prochains jours.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
        }
        upcoming.forEach { item ->
            val d = item.details
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                CategoryBadge(if (d.scheduled.isTransfer) "⇄" else d.categoryEmoji, d.categoryColor)
                Column(Modifier.weight(1f)) {
                    Text(d.title.ifBlank { "Opération planifiée" }, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(
                        describeSchedule(d.scheduled) + " · " +
                            if (d.scheduled.isTransfer) "${d.accountName} → ${d.toAccountName}" else d.accountName,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    if (d.scheduled.isTransfer) {
                        Text(Money.format(d.scheduled.amountCents), color = MaterialTheme.colorScheme.onSurfaceVariant)
                    } else {
                        AmountText(item.signedCents)
                    }
                    Text(
                        item.date.format(DayFormat),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
