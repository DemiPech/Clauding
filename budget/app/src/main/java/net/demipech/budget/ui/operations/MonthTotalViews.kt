package net.demipech.budget.ui.operations

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import net.demipech.budget.data.AccountWithBalance
import net.demipech.budget.data.Budget
import net.demipech.budget.data.Kind
import net.demipech.budget.data.OperationDetails
import net.demipech.budget.data.isTransfer
import net.demipech.budget.domain.Analytics
import net.demipech.budget.domain.Forecast
import net.demipech.budget.domain.Money
import net.demipech.budget.domain.MonthTotals
import net.demipech.budget.ui.components.BudgetProgress
import net.demipech.budget.ui.components.Overline
import net.demipech.budget.ui.components.SectionCard
import net.demipech.budget.ui.components.label
import net.demipech.budget.ui.theme.amountColor
import net.demipech.budget.ui.theme.expenseColor
import net.demipech.budget.ui.theme.incomeColor
import java.time.LocalDate
import java.time.YearMonth

/** Vue « Mois » : les 12 mois de l'année, toucher un mois l'ouvre en liste. */
fun LazyListScope.yearMonthsItems(yearOps: List<OperationDetails>, current: YearMonth, onPick: (YearMonth) -> Unit) {
    val months = (1..12).map { YearMonth.of(current.year, it) }
    val monthly = Analytics.monthly(yearOps, months)
    val year = Analytics.totals(yearOps)
    item(key = "year-total") {
        Column(Modifier.background(MaterialTheme.colorScheme.surface)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp)) {
                Text("Année ${current.year}", fontWeight = FontWeight.Bold, modifier = Modifier.weight(1.2f))
                Amounts(year.income, year.expense)
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        }
    }
    items(monthly.reversed(), key = { "month-${it.month}" }) { m -> MonthLine(m, m.month == current, onPick) }
}

@Composable
private fun MonthLine(m: MonthTotals, isCurrent: Boolean, onPick: (YearMonth) -> Unit) {
    Column(
        Modifier
            .background(
                if (isCurrent) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f)
                else MaterialTheme.colorScheme.surface
            )
            .clickable { onPick(m.month) }
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1.2f)) {
                Text(m.month.label().substringBefore(' '), style = MaterialTheme.typography.bodyLarge)
                Text(
                    "${m.month.atDay(1).format(ShortDate)} – ${m.month.atEndOfMonth().format(ShortDate)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Amounts(m.totals.income, m.totals.expense)
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    }
}

private val ShortDate = java.time.format.DateTimeFormatter.ofPattern("dd/MM")

@Composable
private fun androidx.compose.foundation.layout.RowScope.Amounts(income: Long, expense: Long) {
    Text(Money.plain(income), color = incomeColor(), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
    Text(Money.plain(expense), color = expenseColor(), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
    Text(Money.plain(income - expense), color = amountColor(income - expense), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
}

/** Vue « Total » : budget, comparaison avec le mois précédent, moyennes, comptes, plus grosses dépenses. */
fun LazyListScope.monthTotalItems(
    month: YearMonth,
    ops: List<OperationDetails>,
    previousOps: List<OperationDetails>,
    budgets: List<Budget>,
    balances: List<AccountWithBalance>,
    showBudgets: Boolean,
    onBudgets: () -> Unit,
    onEdit: (Long) -> Unit,
) {
    val now = Analytics.totals(ops)
    val before = Analytics.totals(previousOps)
    item(key = "total-cards") {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (showBudgets) {
                SectionCard(title = "Budget") {
                    val budgetOf = budgets.associate { it.categoryId to it.amountCents }
                    if (budgetOf.isEmpty()) {
                        Text("Aucun budget défini.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(horizontal = 16.dp))
                    } else {
                        val spent = Forecast.breakdown(ops, Kind.EXPENSE).filter { it.categoryId in budgetOf }.sumOf { it.cents }
                        BudgetProgress(spent, budgetOf.values.sum(), Modifier.padding(horizontal = 16.dp))
                    }
                    TextButton(onClick = onBudgets, modifier = Modifier.padding(horizontal = 8.dp)) { Text("Voir et modifier les budgets") }
                }
            }
            SectionCard(title = "Par rapport à ${month.minusMonths(1).label().substringBefore(' ').lowercase()}") {
                Compare("Revenus", now.income, before.income, higherIsBetter = true)
                Compare("Dépenses", now.expense, before.expense, higherIsBetter = false)
                Compare("Bilan", now.net, before.net, higherIsBetter = true)
            }
            SectionCard(title = "Moyennes") {
                val today = LocalDate.now()
                val days = when {
                    YearMonth.from(today) == month -> today.dayOfMonth
                    month.isAfter(YearMonth.from(today)) -> 1
                    else -> month.lengthOfMonth()
                }
                Line("Dépense moyenne par jour", Money.format(now.expense / days))
                Line("Nombre d'opérations", ops.count { !it.operation.isTransfer }.toString())
                val expenses = ops.filter { it.operation.kind == Kind.EXPENSE && !it.operation.isTransfer }
                if (expenses.isNotEmpty()) Line("Dépense moyenne", Money.format(expenses.sumOf { it.operation.amountCents } / expenses.size))
            }
            SectionCard(title = "Comptes") {
                balances.forEach { b ->
                    Line("${b.account.icon} ${b.account.name}", Money.format(b.balanceCents), amountColor(b.balanceCents))
                    if (b.pendingCents != 0L) Line("    encours carte", Money.format(b.pendingCents))
                    if (b.clearedCents != b.balanceCents) Line("    solde pointé", Money.format(b.clearedCents))
                }
                if (balances.size > 1) {
                    val total = balances.sumOf { it.balanceCents }
                    Line("Total", Money.format(total), amountColor(total), bold = true)
                }
            }
            val top = ops.filter { it.operation.kind == Kind.EXPENSE && !it.operation.isTransfer }
                .sortedByDescending { it.operation.amountCents }.take(5)
            if (top.isNotEmpty()) {
                SectionCard(title = "Plus grosses dépenses") {
                    top.forEach { op -> OperationCardRow(op, onClick = { onEdit(op.operation.id) }) }
                }
            }
        }
    }
}

@Composable
private fun Line(label: String, value: String, color: androidx.compose.ui.graphics.Color? = null, bold: Boolean = false) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
        Text(
            label, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
        )
        Text(
            value, color = color ?: MaterialTheme.colorScheme.onSurface,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
        )
    }
}

/** « Dépenses  1 100,19 €  (+12 %) » — vert si l'évolution est favorable. */
@Composable
private fun Compare(label: String, now: Long, before: Long, higherIsBetter: Boolean) {
    val diff = now - before
    val percent = if (before != 0L) " (${if (diff >= 0) "+" else ""}${diff * 100 / kotlin.math.abs(before)} %)" else ""
    val good = if (higherIsBetter) diff >= 0 else diff <= 0
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
        Overline(label, Modifier.weight(1f).align(Alignment.CenterVertically))
        Column(horizontalAlignment = Alignment.End) {
            Text(Money.format(now), style = MaterialTheme.typography.bodyLarge)
            Text(
                "${Money.formatSigned(diff)}$percent",
                style = MaterialTheme.typography.bodySmall,
                color = if (diff == 0L) MaterialTheme.colorScheme.onSurfaceVariant else if (good) incomeColor() else expenseColor(),
            )
        }
    }
}
