package net.demipech.budget.ui.forecast

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import net.demipech.budget.data.DeferredDebitTotal
import net.demipech.budget.data.ScheduledDetails
import net.demipech.budget.data.title
import net.demipech.budget.data.Kind
import net.demipech.budget.domain.BalancePoint
import net.demipech.budget.domain.Fallback
import net.demipech.budget.domain.PlannedMove
import net.demipech.budget.domain.Forecast
import net.demipech.budget.domain.Money
import net.demipech.budget.ui.components.AmountText
import net.demipech.budget.ui.components.BalanceChart
import net.demipech.budget.ui.components.DayFormat
import net.demipech.budget.ui.components.FormTopBar
import net.demipech.budget.ui.components.Overline
import net.demipech.budget.ui.components.Segmented
import net.demipech.budget.ui.components.Selector
import net.demipech.budget.ui.repository
import androidx.compose.foundation.clickable
import androidx.compose.material3.Switch
import java.time.YearMonth
import net.demipech.budget.domain.Estimation
import net.demipech.budget.data.OperationDetails
import net.demipech.budget.ui.theme.amountColor
import net.demipech.budget.ui.theme.expenseColor
import java.time.LocalDate

private const val MAX_DAYS = 365

class ForecastViewModel(repo: BudgetRepository) : ViewModel() {
    val today: LocalDate = LocalDate.now()
    val accounts: StateFlow<List<AccountWithBalance>?> =
        repo.accountsWithBalance().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val scheduled: StateFlow<List<ScheduledDetails>> =
        repo.scheduled().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    /** 12 mois terminés et mois en cours : pour estimer les dépenses courantes de chaque compte. */
    val history: StateFlow<List<OperationDetails>> =
        YearMonth.from(today).let { m -> repo.operationsBetween(m.minusMonths(12).atDay(1), m.minusMonths(1).atEndOfMonth()) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val currentMonth: StateFlow<List<OperationDetails>> =
        YearMonth.from(today).let { m -> repo.operationsBetween(m.atDay(1), m.atEndOfMonth()) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val debits: StateFlow<List<DeferredDebitTotal>> =
        repo.deferredDebits(today.plusDays(1), today.plusDays(MAX_DAYS.toLong()))
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
}

/** Un mouvement prévu : échéance planifiée ou débit différé. */
private data class Movement(val date: LocalDate, val title: String, val detail: String, val cents: Long)

/** Solde prévu jour par jour, avec les échéances planifiées et les débits différés à venir. */
@Composable
fun ForecastScreen(onBack: () -> Unit) {
    val repo = repository()
    val vm = viewModel { ForecastViewModel(repo) }
    val accounts by vm.accounts.collectAsStateWithLifecycle()
    val scheduled by vm.scheduled.collectAsStateWithLifecycle()
    val debits by vm.debits.collectAsStateWithLifecycle()
    val history by vm.history.collectAsStateWithLifecycle()
    val currentMonth by vm.currentMonth.collectAsStateWithLifecycle()
    var withVariable by rememberSaveable { mutableStateOf(true) }
    var accountId by rememberSaveable { mutableStateOf<Long?>(null) }
    var days by rememberSaveable { mutableStateOf(90) }

    Scaffold(topBar = { FormTopBar("Solde prévisionnel", onBack) }) { padding ->
        val list = accounts ?: return@Scaffold
        val today = vm.today
        val end = today.plusDays(days.toLong())
        val start = if (accountId == null) list.sumOf { it.balanceCents } else list.find { it.account.id == accountId }?.balanceCents ?: 0
        val movements = remember(scheduled, debits, accountId, days) {
            val planned = Forecast.upcoming(scheduled, today, end, accountId)
                .filter { it.signedCents != 0L }
                .map { Movement(it.date, it.details.title.ifBlank { "Opération planifiée" }, it.details.accountName, it.signedCents) }
            val cards = debits.filter { (accountId == null || it.accountId == accountId) && !it.debitDate.isAfter(end) }
                .map { Movement(it.debitDate, "💳 Débit différé", it.accountName, -it.cents) }
            (planned + cards).sortedBy { it.date }
        }
        // Dépenses courantes (non planifiées) estimées par compte : moyenne des 6 derniers mois terminés.
        val variableByAccount = remember(history, currentMonth, list) {
            val months = Estimation.window(history, YearMonth.from(today), 6)
            list.associate { a ->
                val id = a.account.id
                val monthly = Estimation.estimate(history.filter { it.operation.accountId == id }, months).variableCents
                val spent = currentMonth.filter {
                    it.operation.accountId == id && Estimation.counted(it) && !Estimation.isFixed(it)
                }.sumOf { it.operation.amountCents }
                id to (monthly to spent)
            }
        }
        val variableMonthly = variableByAccount.filterKeys { accountId == null || it == accountId }.values.sumOf { it.first }
        // Simulation compte par compte, pour appliquer les compléments depuis les comptes de secours.
        val points = remember(list, scheduled, debits, accountId, days, withVariable, variableByAccount) {
            val moves = Forecast.upcoming(scheduled, today, end).flatMap { u ->
                val s = u.details.scheduled
                val target = s.toAccountId
                when {
                    target != null -> listOf(
                        PlannedMove(u.date, s.accountId, -s.amountCents),
                        PlannedMove(u.date, target, s.amountCents),
                    )
                    s.kind == Kind.INCOME -> listOf(PlannedMove(u.date, s.accountId, s.amountCents))
                    else -> {
                        val card = list.find { it.account.id == s.accountId }?.account?.deferredDebit == true && s.deferred
                        listOf(PlannedMove(u.date, s.accountId, -s.amountCents, coverable = !card))
                    }
                }
            } + debits.filter { !it.debitDate.isAfter(end) }.map { PlannedMove(it.debitDate, it.accountId, -it.cents) } +
                if (withVariable) {
                    variableByAccount.flatMap { (id, values) ->
                        Estimation.variableMoves(id, values.first, values.second, today, end)
                    }
                } else emptyList()
            val series = Fallback.simulate(
                start = list.associate { it.account.id to it.balanceCents },
                moves = moves,
                fallbackOf = list.mapNotNull { a -> a.account.fallbackAccountId?.let { a.account.id to it } }.toMap(),
                from = today,
                days = days,
            )
            if (accountId != null) {
                series[accountId].orEmpty()
            } else {
                (0..days).map { i ->
                    BalancePoint(today.plusDays(i.toLong()), series.values.sumOf { it.getOrNull(i)?.cents ?: 0 })
                }
            }
        }
        val lowest = points.minByOrNull { it.cents }
        val firstNegative = points.firstOrNull { it.cents < 0 }

        LazyColumn(Modifier.padding(padding), contentPadding = PaddingValues(bottom = 32.dp)) {
            item {
                Column(
                    Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Selector(
                        label = "Compte",
                        options = listOf<AccountWithBalance?>(null) + list,
                        selected = list.find { it.account.id == accountId },
                        optionLabel = { it?.let { a -> "${a.account.icon} ${a.account.name}" } ?: "Tous les comptes" },
                        onSelect = { accountId = it?.account?.id },
                        emptyLabel = "Tous les comptes",
                    )
                    Segmented(listOf(30, 90, 180, 365), days, { if (it == 365) "1 an" else "$it j" }, { days = it })
                    Row {
                        Column(Modifier.weight(1f)) {
                            Overline("Aujourd'hui")
                            Text(Money.format(start), style = MaterialTheme.typography.titleMedium, color = amountColor(start))
                        }
                        Column(Modifier.weight(1f)) {
                            Overline("Au plus bas")
                            Text(
                                lowest?.let { Money.format(it.cents) } ?: "—",
                                style = MaterialTheme.typography.titleMedium,
                                color = amountColor(lowest?.cents ?: 0),
                            )
                            lowest?.let { Text("le ${it.date.format(DayFormat)}", style = MaterialTheme.typography.bodySmall) }
                        }
                        Column(Modifier.weight(1f), horizontalAlignment = Alignment.End) {
                            Overline("Le ${end.format(DayFormat)}")
                            val last = points.lastOrNull()?.cents ?: start
                            Text(Money.format(last), style = MaterialTheme.typography.titleMedium, color = amountColor(last))
                        }
                    }
                    Row(
                        Modifier.fillMaxWidth().clickable { withVariable = !withVariable },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text("Dépenses courantes estimées", style = MaterialTheme.typography.bodyLarge)
                            Text(
                                if (variableMonthly > 0) "≈ ${Money.format(variableMonthly)} par mois (courses, sorties…), " +
                                    "réparties jour par jour ; moyenne des 6 derniers mois."
                                else "Pas encore assez d'historique pour les estimer.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Switch(checked = withVariable, onCheckedChange = { withVariable = it })
                    }
                    BalanceChart(points, Modifier.fillMaxWidth().height(180.dp))
                    if (firstNegative != null) {
                        Text(
                            "⚠️ Le solde passe sous zéro le ${firstNegative.date.format(DayFormat)} " +
                                "(${Money.format(firstNegative.cents)}).",
                            color = expenseColor(),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                    Text(
                        "Compte les opérations planifiées, virements, débits différés, compléments automatiques " +
                            "depuis les comptes de secours" +
                            if (withVariable) " et les dépenses courantes estimées." else " ; pas les dépenses courantes.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }
            items(movements) { m ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surface)
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(m.date.format(DayFormat), style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(0.3f))
                    Column(Modifier.weight(0.5f)) {
                        Text(m.title, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(m.detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    AmountText(m.cents)
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }
        }
    }
}
