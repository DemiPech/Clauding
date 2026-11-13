package net.demipech.budget.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import net.demipech.budget.domain.Analytics
import net.demipech.budget.domain.BalancePoint
import net.demipech.budget.domain.BudgetLevel
import net.demipech.budget.domain.Money
import net.demipech.budget.domain.MonthTotals
import net.demipech.budget.ui.theme.expenseColor
import net.demipech.budget.ui.theme.incomeColor

val WarningColor = Color(0xFFFB8C00)

@Composable
fun budgetColor(level: BudgetLevel): Color = when (level) {
    BudgetLevel.OK -> MaterialTheme.colorScheme.secondary
    BudgetLevel.WARNING -> WarningColor
    BudgetLevel.OVER -> expenseColor()
}

/** Barre de budget : dépensé / budget, orange à 80 %, rouge au-delà de 100 %. */
@Composable
fun BudgetProgress(spentCents: Long, budgetCents: Long, modifier: Modifier = Modifier) {
    val level = Analytics.budgetLevel(spentCents, budgetCents)
    val ratio = if (budgetCents > 0) (spentCents.toFloat() / budgetCents).coerceIn(0f, 1f) else 0f
    Column(modifier) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Box(
                Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(ratio)
                    .clip(RoundedCornerShape(4.dp))
                    .background(budgetColor(level))
            )
        }
        val rest = budgetCents - spentCents
        Text(
            "${Money.format(spentCents)} sur ${Money.format(budgetCents)} · " +
                if (rest >= 0) "reste ${Money.format(rest)}" else "dépassé de ${Money.format(-rest)}",
            style = MaterialTheme.typography.bodySmall,
            color = if (level == BudgetLevel.OK) MaterialTheme.colorScheme.onSurfaceVariant else budgetColor(level),
        )
    }
}

/** Courbe du solde prévu, avec la ligne du zéro en pointillés. */
@Composable
fun BalanceChart(points: List<BalancePoint>, modifier: Modifier = Modifier) {
    if (points.size < 2) return
    val line = MaterialTheme.colorScheme.primary
    val negative = expenseColor()
    val zeroColor = MaterialTheme.colorScheme.outline
    Canvas(modifier) {
        val min = minOf(points.minOf { it.cents }, 0L)
        val max = maxOf(points.maxOf { it.cents }, 0L)
        val span = (max - min).coerceAtLeast(1L).toFloat()
        fun x(i: Int) = size.width * i / (points.size - 1)
        fun y(cents: Long) = size.height * (1f - (cents - min) / span)
        val zeroY = y(0)
        drawLine(
            zeroColor, Offset(0f, zeroY), Offset(size.width, zeroY), strokeWidth = 1.dp.toPx(),
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f)),
        )
        val path = Path()
        points.forEachIndexed { i, p -> if (i == 0) path.moveTo(x(i), y(p.cents)) else path.lineTo(x(i), y(p.cents)) }
        drawPath(path, line, style = Stroke(width = 2.5.dp.toPx()))
        points.forEachIndexed { i, p ->
            if (p.cents < 0) drawCircle(negative, radius = 2.dp.toPx(), center = Offset(x(i), y(p.cents)))
        }
    }
}

/** Barres revenus (bleu) / dépenses (rouge) par mois. */
@Composable
fun MonthlyBars(months: List<MonthTotals>, modifier: Modifier = Modifier, labelOf: (MonthTotals) -> String) {
    val income = incomeColor()
    val expense = expenseColor()
    val max = months.maxOfOrNull { maxOf(it.totals.income, it.totals.expense) }?.coerceAtLeast(1L) ?: 1L
    Column(modifier) {
        Canvas(Modifier.fillMaxWidth().height(160.dp)) {
            val slot = size.width / months.size.coerceAtLeast(1)
            val bar = slot * 0.32f
            months.forEachIndexed { i, m ->
                val left = slot * i + slot * 0.15f
                val hi = size.height * m.totals.income / max
                val he = size.height * m.totals.expense / max
                drawRect(income, Offset(left, size.height - hi), androidx.compose.ui.geometry.Size(bar, hi))
                drawRect(expense, Offset(left + bar + slot * 0.06f, size.height - he), androidx.compose.ui.geometry.Size(bar, he))
            }
        }
        Row(Modifier.fillMaxWidth()) {
            months.forEach { m ->
                Text(
                    labelOf(m),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    maxLines = 1,
                )
            }
        }
    }
}
