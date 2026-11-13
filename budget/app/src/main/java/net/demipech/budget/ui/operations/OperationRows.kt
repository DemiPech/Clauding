package net.demipech.budget.ui.operations

import net.demipech.budget.data.Kind
import net.demipech.budget.data.isTransfer
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import net.demipech.budget.data.OperationDetails
import net.demipech.budget.data.isDeferred
import net.demipech.budget.data.signedCents
import net.demipech.budget.domain.Money
import net.demipech.budget.ui.components.AmountText
import net.demipech.budget.ui.components.CategoryBadge
import net.demipech.budget.ui.components.DayFormat
import net.demipech.budget.ui.components.ShortDayFormat
import net.demipech.budget.ui.components.describeRhythm
import net.demipech.budget.ui.components.label
import net.demipech.budget.ui.theme.expenseColor
import net.demipech.budget.ui.theme.incomeColor
import net.demipech.budget.ui.theme.kindColor
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Libellé d'une opération : sa note, à défaut sa (sous-)catégorie. */
val OperationDetails.title: String
    get() = operation.note.ifBlank {
        if (operation.isTransfer) "Virement" else subcategoryName ?: categoryName ?: operation.kind.label()
    }

/** « Boursorama → Fortuneo » pour un virement, quel que soit le côté affiché. */
val OperationDetails.transferRoute: String
    get() {
        val other = transferAccountName ?: "compte supprimé"
        return if (operation.kind == Kind.EXPENSE) "$accountName → $other" else "$other → $accountName"
    }

private val WeekdayFormat = DateTimeFormatter.ofPattern("EEE", Locale.FRENCH)
private val MonthYearFormat = DateTimeFormatter.ofPattern("MM.yyyy", Locale.FRENCH)

/** En-tête de jour : « 13 ven. 11.2026  0,00 €  11,99 € ». */
@Composable
fun DayHeader(date: LocalDate, income: Long, expense: Long, modifier: Modifier = Modifier) {
    Row(
        modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "%02d".format(date.dayOfMonth),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.width(8.dp))
        Text(
            date.format(WeekdayFormat),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier
                .background(MaterialTheme.colorScheme.onSurfaceVariant, RoundedCornerShape(4.dp))
                .padding(horizontal = 6.dp, vertical = 2.dp),
        )
        Spacer(Modifier.width(8.dp))
        Text(
            date.format(MonthYearFormat),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Text(Money.format(income), color = incomeColor(), style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.width(16.dp))
        Text(Money.format(expense), color = expenseColor(), style = MaterialTheme.typography.bodyMedium)
    }
}

/**
 * Ligne façon Money Manager : catégorie (et sous-catégorie) à gauche, libellé et
 * compte (avec le rythme si l'opération vient d'une planification), montant coloré.
 */
@Composable
fun OperationLine(
    op: OperationDetails,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    /** Vue d'un seul compte : un virement y est coloré comme une sortie ou une entrée. */
    accountView: Boolean = false,
) {
    val transfer = op.operation.isTransfer
    Row(
        modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.width(112.dp)) {
            Text(
                if (transfer) "⇄ Virement"
                else listOfNotNull(op.categoryEmoji?.takeIf { it.isNotBlank() }, op.categoryName ?: "Autres").joinToString(" "),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (op.subcategoryName != null) {
                Text(
                    op.subcategoryName,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Column(Modifier.weight(1f).padding(horizontal = 8.dp)) {
            Text(op.title, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
            val planSize = op.scheduledPlanSize ?: 0
            val rhythm = when {
                planSize > 0 -> " (paiement ${op.scheduledPlanIndex}/$planSize)"
                else -> op.scheduledFrequency?.let { " (${describeRhythm(it, op.scheduledInterval ?: 1)})" }.orEmpty()
            }
            val debit = if (op.isDeferred) " · débit le ${op.operation.debitDate.format(ShortDayFormat)}" else ""
            Text(
                (if (transfer) op.transferRoute else op.accountName) + rhythm + debit,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Text(
            Money.format(op.operation.amountCents),
            color = if (transfer && !accountView) MaterialTheme.colorScheme.onSurfaceVariant else kindColor(op.operation.kind),
            style = MaterialTheme.typography.bodyLarge,
        )
    }
}

/** Ligne façon Wallet : pastille de catégorie, libellé, compte, montant signé et date. */
@Composable
fun OperationCardRow(op: OperationDetails, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        val transfer = op.operation.isTransfer
        CategoryBadge(if (transfer) "⇄" else op.categoryEmoji, op.categoryColor)
        Column(Modifier.weight(1f)) {
            Text(op.title, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(
                if (transfer) op.transferRoute
                else listOfNotNull(op.subcategoryName ?: op.categoryName, op.accountName).joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Column(horizontalAlignment = Alignment.End) {
            if (transfer) {
                Text(
                    Money.format(op.operation.amountCents),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyLarge,
                )
            } else {
                AmountText(op.operation.signedCents)
            }
            Text(
                op.operation.date.format(DayFormat),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
