package net.demipech.budget.ui.stats

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import net.demipech.budget.data.Budget
import net.demipech.budget.data.Kind
import net.demipech.budget.data.OperationDetails
import net.demipech.budget.domain.Analytics
import net.demipech.budget.domain.CategoryAverage
import net.demipech.budget.domain.Estimation
import net.demipech.budget.domain.Forecast
import net.demipech.budget.domain.Money
import net.demipech.budget.ui.components.BudgetProgress
import net.demipech.budget.ui.components.CategoryBadge
import net.demipech.budget.ui.components.Overline
import net.demipech.budget.ui.components.Segmented
import net.demipech.budget.ui.components.label
import net.demipech.budget.ui.theme.expenseColor
import java.time.YearMonth

/**
 * Mode « Estimation » : dépenses moyennes par mois sur les derniers mois terminés,
 * globales et par catégorie (sans les dépenses sans catégorie ni les virements).
 */
fun LazyListScope.estimateItems(
    history: List<OperationDetails>,
    currentOps: List<OperationDetails>,
    windowSize: Int,
    onWindowSize: (Int) -> Unit,
    budgets: List<Budget>,
    expanded: Long?,
    onToggle: (Long?) -> Unit,
    onCreateBudgets: (Map<Long, Long>) -> Unit,
) {
    val current = YearMonth.now()
    val months = Estimation.window(history, current, windowSize)
    val estimate = Estimation.estimate(history, months)
    val spentNow = Forecast.breakdown(currentOps, Kind.EXPENSE).filter { it.categoryId != null }
        .associate { it.categoryId!! to it.cents }
    val budgetOf = budgets.associate { it.categoryId to it.amountCents }
    val missing = estimate.categories.filter { it.categoryId !in budgetOf && it.averageCents > 0 }
        .associate { it.categoryId to Estimation.suggestedBudget(it.averageCents) }

    item(key = "estimate-header") {
        Column {
            Column(
                Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Segmented(listOf(3, 6, 12), windowSize, { "$it mois" }, onWindowSize)
                if (months.isEmpty()) {
                    Text(
                        "Pas encore de mois terminé avec des opérations : l'estimation apparaîtra le mois prochain.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    Overline("Dépenses estimées par mois")
                    Text(Money.format(estimate.totalCents), style = MaterialTheme.typography.headlineMedium, color = expenseColor())
                    Text(
                        "Moyenne " + (if (months.size == 1) "de ${months.first().label()}" else
                            "de ${months.first().label()} à ${months.last().label()} (${months.size} mois)") +
                            ", hors dépenses sans catégorie et virements.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Overline("${current.label()} jusqu'ici")
                    BudgetProgress(spentNow.values.sum(), estimate.totalCents)
                    if (missing.isNotEmpty()) {
                        OutlinedButton(onClick = { onCreateBudgets(missing) }, modifier = Modifier.fillMaxWidth()) {
                            Text("Créer les budgets manquants (${missing.size})")
                        }
                    }
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        }
    }
    val max = estimate.categories.maxOfOrNull { it.averageCents }?.coerceAtLeast(1L) ?: 1L
    items(estimate.categories, key = { "avg-${it.categoryId}" }) { category ->
        AverageRow(
            category = category,
            monthsCount = months.size,
            max = max,
            spentNow = spentNow[category.categoryId] ?: 0,
            budget = budgetOf[category.categoryId],
            expanded = expanded == category.categoryId,
            details = if (expanded == category.categoryId) {
                val set = months.toSet()
                Analytics.subBreakdown(history.filter { YearMonth.from(it.operation.date) in set }, category.categoryId, Kind.EXPENSE)
                    .map { (name, cents) -> name to (cents * 2 + months.size) / (months.size * 2) }
            } else emptyList(),
            onClick = { onToggle(category.categoryId) },
        )
    }
}

@Composable
private fun AverageRow(
    category: CategoryAverage,
    monthsCount: Int,
    max: Long,
    spentNow: Long,
    budget: Long?,
    expanded: Boolean,
    details: List<Pair<String?, Long>>,
    onClick: () -> Unit,
) {
    val color = category.color?.let { Color(it) } ?: MaterialTheme.colorScheme.outline
    Column(Modifier.background(MaterialTheme.colorScheme.surface).clickable(onClick = onClick)) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            CategoryBadge(category.emoji, category.color, size = 36)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(category.name, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("${Money.format(category.averageCents)} / mois", style = MaterialTheme.typography.bodyLarge)
                }
                Box(
                    Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Box(
                        Modifier.fillMaxHeight().fillMaxWidth(category.averageCents.toFloat() / max)
                            .clip(RoundedCornerShape(3.dp)).background(color)
                    )
                }
                val notes = buildList {
                    if (category.activeMonths < monthsCount) add("dépenses ${category.activeMonths} mois sur $monthsCount")
                    add("ce mois-ci ${Money.format(spentNow)}")
                    if (budget != null) add("budget ${Money.format(budget)}")
                }
                Text(
                    notes.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        if (expanded) {
            details.forEach { (name, cents) ->
                Row(Modifier.fillMaxWidth().padding(start = 64.dp, end = 16.dp, top = 2.dp, bottom = 6.dp)) {
                    Text(name ?: "${category.name} (sans sous-catégorie)", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                    Text("${Money.format(cents)} / mois", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    }
}
