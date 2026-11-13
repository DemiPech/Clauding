package net.demipech.budget.ui.installments

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import net.demipech.budget.data.Account
import net.demipech.budget.data.BudgetRepository
import net.demipech.budget.data.Category
import net.demipech.budget.data.Frequency
import net.demipech.budget.data.Kind
import net.demipech.budget.data.ScheduledOperation
import net.demipech.budget.domain.Installments
import net.demipech.budget.domain.Money
import net.demipech.budget.domain.Recurrence
import net.demipech.budget.ui.components.AmountField
import net.demipech.budget.ui.components.CategorySelector
import net.demipech.budget.ui.components.ConfirmDialog
import net.demipech.budget.ui.components.DateField
import net.demipech.budget.ui.components.DayFormat
import net.demipech.budget.ui.components.EmptyState
import net.demipech.budget.ui.components.FormTopBar
import net.demipech.budget.ui.components.IntField
import net.demipech.budget.ui.components.KindSelector
import net.demipech.budget.ui.components.Selector
import net.demipech.budget.ui.components.unit
import net.demipech.budget.ui.repository
import net.demipech.budget.domain.DeferredDebit
import net.demipech.budget.ui.components.DeferredSwitch
import net.demipech.budget.ui.theme.expenseColor
import java.time.LocalDate

/** Une ligne de l'échéancier ; les payées ne se modifient plus ici. */
class InstallmentRow(date: LocalDate, amount: String, val paid: Boolean = false) {
    var date by mutableStateOf(date)
    var amount by mutableStateOf(amount)
    val cents: Long? get() = Money.parse(amount)?.takeIf { it > 0 }
}

/** Valeurs reprises du formulaire d'opération (« Payer en plusieurs fois… »). */
data class InstallmentPreset(
    val amountCents: Long? = null,
    val accountId: Long? = null,
    val categoryId: Long? = null,
    val note: String? = null,
)

class InstallmentEditViewModel(
    private val repo: BudgetRepository,
    private val planId: Long?,
    preset: InstallmentPreset,
) : ViewModel() {
    var kind by mutableStateOf(Kind.EXPENSE)
        private set
    var note by mutableStateOf(preset.note.orEmpty())
    var deferred by mutableStateOf(true)
    var accountId by mutableStateOf(preset.accountId)
    var categoryId by mutableStateOf(preset.categoryId)
    var total by mutableStateOf(preset.amountCents?.let(Money::toInput).orEmpty())
        private set
    var count by mutableStateOf("3")
        private set
    var firstDate: LocalDate by mutableStateOf(LocalDate.now())
        private set
    var nextDate: LocalDate by mutableStateOf(LocalDate.now().plusMonths(1))
        private set
    var frequency by mutableStateOf(Frequency.MONTHLY)
        private set
    var interval by mutableStateOf("1")
        private set

    val paidRows = mutableStateListOf<InstallmentRow>()
    val rows = mutableStateListOf<InstallmentRow>()

    /**
     * Vrai dès qu'une ligne a été modifiée à la main : l'échéancier n'est alors plus
     * recalculé quand on change le total ou le rythme (bouton « Recalculer »).
     */
    var customized by mutableStateOf(false)
        private set
    var loaded by mutableStateOf(planId == null)
        private set

    val accounts: StateFlow<List<Account>?> =
        repo.accounts().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val categories: StateFlow<List<Category>> =
        repo.categories().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    init {
        if (planId == null) {
            regenerate()
        } else viewModelScope.launch {
            val plan = repo.plan(planId)
            plan.firstOrNull()?.let { first ->
                kind = first.kind
                note = first.note
                deferred = first.deferred
                accountId = first.accountId
                categoryId = first.categoryId
            }
            plan.forEach { s ->
                val row = InstallmentRow(s.startDate, Money.toInput(s.amountCents), paid = s.generatedCount > 0)
                if (row.paid) paidRows += row else rows += row
            }
            total = Money.toInput(plan.sumOf { it.amountCents })
            count = plan.size.toString()
            firstDate = plan.firstOrNull()?.startDate ?: LocalDate.now()
            nextDate = rows.firstOrNull()?.date ?: LocalDate.now().plusMonths(1)
            customized = true
            loaded = true
        }
    }

    val isNew get() = planId == null
    private val totalCents get() = Money.parse(total)?.takeIf { it > 0 }
    private val intervalValue get() = interval.toIntOrNull()?.takeIf { it >= 1 } ?: 1
    val scheduleCents get() = (paidRows + rows).sumOf { it.cents ?: 0 }
    val totalMismatch get() = totalCents != null && rows.isNotEmpty() && scheduleCents != totalCents

    val canSave get() = accountId != null && rows.isNotEmpty() && rows.all { it.cents != null }

    fun changeTotal(value: String) { total = value; autoRegenerate() }
    fun changeCount(value: String) { count = value; autoRegenerate() }
    fun changeFirstDate(value: LocalDate) { firstDate = value; autoRegenerate() }
    fun changeNextDate(value: LocalDate) { nextDate = value; autoRegenerate() }
    fun changeFrequency(value: Frequency) { frequency = value; autoRegenerate() }
    fun changeInterval(value: String) { interval = value; autoRegenerate() }

    fun changeKind(value: Kind) {
        kind = value
        if (categories.value.find { it.id == categoryId }?.kind != value) categoryId = null
    }

    /** Modification d'un seul paiement : les autres ne bougent pas. */
    fun editRow(row: InstallmentRow, date: LocalDate = row.date, amount: String = row.amount) {
        row.date = date
        row.amount = amount
        customized = true
    }

    fun removeRow(row: InstallmentRow) {
        rows.remove(row)
        customized = true
    }

    fun addRow() {
        val last = (paidRows + rows).maxOfOrNull { it.date } ?: LocalDate.now()
        rows += InstallmentRow(Recurrence.occurrenceDate(last, frequency, intervalValue, 1), "")
        customized = true
    }

    private fun autoRegenerate() {
        if (!customized) regenerate()
    }

    /** Recalcule les paiements non payés à partir du total, du nombre et du rythme. */
    fun regenerate() {
        customized = false
        val n = count.toIntOrNull()?.takeIf { it >= 1 } ?: return
        val remainingCount = n - paidRows.size
        rows.clear()
        if (remainingCount < 1) return
        val remainingCents = (totalCents ?: 0) - paidRows.sumOf { it.cents ?: 0 }
        val amounts = Installments.split(remainingCents.coerceAtLeast(0), remainingCount)
        val dates = Installments.dates(
            first = if (paidRows.isEmpty()) firstDate else null,
            next = nextDate,
            count = remainingCount,
            frequency = frequency,
            interval = intervalValue,
        )
        dates.zip(amounts).forEach { (date, cents) ->
            rows += InstallmentRow(date, if (cents > 0) Money.toInput(cents) else "")
        }
    }

    fun save(onDone: () -> Unit) = viewModelScope.launch {
        val account = accountId ?: return@launch
        val items = rows.sortedBy { it.date }.map { row ->
            ScheduledOperation(
                accountId = account,
                categoryId = categoryId,
                kind = kind,
                amountCents = row.cents ?: return@launch,
                note = note.trim(),
                startDate = row.date,
                frequency = Frequency.NONE,
                occurrences = 1,
                deferred = deferred,
            )
        }
        repo.saveInstallments(planId, items)
        onDone()
    }

    fun delete(onDone: () -> Unit) = viewModelScope.launch {
        planId?.let { repo.deletePlan(it) }
        onDone()
    }
}

@Composable
fun InstallmentEditScreen(planId: Long?, preset: InstallmentPreset, onDone: () -> Unit) {
    val repo = repository()
    val vm = viewModel(key = "installments-$planId-$preset") { InstallmentEditViewModel(repo, planId, preset) }
    val accounts by vm.accounts.collectAsStateWithLifecycle()
    val categories by vm.categories.collectAsStateWithLifecycle()
    var confirmDelete by remember { mutableStateOf(false) }

    LaunchedEffect(accounts, vm.loaded) {
        if (vm.loaded && vm.accountId == null) vm.accountId = accounts?.firstOrNull()?.id
    }

    Scaffold(
        topBar = {
            FormTopBar(
                title = "Paiement en plusieurs fois",
                onBack = onDone,
                onDelete = if (vm.isNew) null else ({ confirmDelete = true }),
            )
        },
    ) { padding ->
        val accountList = accounts ?: return@Scaffold
        if (accountList.isEmpty()) {
            EmptyState("Créez d'abord un compte.", Modifier.padding(padding))
            return@Scaffold
        }
        Column(
            Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            KindSelector(vm.kind, vm::changeKind)
            OutlinedTextField(
                value = vm.note,
                onValueChange = { vm.note = it },
                label = { Text("Libellé (ex. Canapé, Téléphone)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Selector(
                label = "Compte",
                options = accountList,
                selected = accountList.find { it.id == vm.accountId },
                optionLabel = { "${it.icon} ${it.name}" },
                onSelect = { vm.accountId = it.id },
            )
            CategorySelector(categories, vm.kind, vm.categoryId, { vm.categoryId = it })
            accountList.find { it.id == vm.accountId }?.takeIf { it.deferredDebit && vm.kind == Kind.EXPENSE }?.let { account ->
                DeferredSwitch(vm.deferred, { vm.deferred = it }, DeferredDebit.debitDate(vm.rows.firstOrNull()?.date ?: vm.firstDate, account))
            }

            Text("Calcul de l'échéancier", style = MaterialTheme.typography.titleSmall)
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                AmountField(vm.total, vm::changeTotal, "Montant total", Modifier.weight(1f))
                IntField(vm.count, vm::changeCount, "En … fois", Modifier.width(110.dp))
            }
            if (vm.paidRows.isEmpty()) {
                DateField("1er paiement", vm.firstDate, vm::changeFirstDate)
            }
            DateField(if (vm.paidRows.isEmpty()) "Paiement suivant" else "Prochain paiement", vm.nextDate, vm::changeNextDate)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                IntField(vm.interval, vm::changeInterval, "Puis tous les", Modifier.width(130.dp))
                Selector(
                    label = "Unité",
                    options = listOf(Frequency.DAILY, Frequency.WEEKLY, Frequency.MONTHLY),
                    selected = vm.frequency,
                    optionLabel = { it.unit() },
                    onSelect = vm::changeFrequency,
                    modifier = Modifier.weight(1f),
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Échéancier", style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                if (vm.customized) TextButton(onClick = vm::regenerate) { Text("Recalculer") }
            }
            Text(
                "Chaque paiement se modifie séparément (date, montant) sans toucher aux autres. " +
                    "Un paiement daté d'aujourd'hui ou avant est enregistré tout de suite dans les opérations.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            val size = vm.paidRows.size + vm.rows.size
            vm.paidRows.forEachIndexed { i, row ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${i + 1}/$size", modifier = Modifier.width(44.dp))
                    Text(row.date.format(DayFormat), modifier = Modifier.weight(1f))
                    Text(Money.format(row.cents ?: 0))
                    Text("  ✓ payé", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            if (vm.paidRows.isNotEmpty()) HorizontalDivider()
            vm.rows.forEachIndexed { i, row ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("${vm.paidRows.size + i + 1}/$size", modifier = Modifier.width(44.dp))
                    DateField("Date", row.date, { vm.editRow(row, date = it) }, Modifier.weight(1f))
                    AmountField(
                        row.amount,
                        { vm.editRow(row, amount = it) },
                        "Montant",
                        Modifier.width(118.dp),
                        isError = row.cents == null,
                    )
                    IconButton(onClick = { vm.removeRow(row) }) {
                        Icon(Icons.Filled.Close, contentDescription = "Retirer ce paiement")
                    }
                }
            }
            TextButton(onClick = vm::addRow) {
                Icon(Icons.Filled.Add, contentDescription = null)
                Text(" Ajouter un paiement")
            }
            Text(
                "Total de l'échéancier : ${Money.format(vm.scheduleCents)}",
                style = MaterialTheme.typography.bodyMedium,
            )
            if (vm.totalMismatch) {
                Text(
                    "Différent du montant total saisi (${Money.format(Money.parse(vm.total) ?: 0)}).",
                    color = expenseColor(),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Button(onClick = { vm.save(onDone) }, enabled = vm.canSave, modifier = Modifier.fillMaxWidth()) {
                Text("Enregistrer")
            }
        }
    }

    if (confirmDelete) {
        ConfirmDialog(
            title = "Supprimer ce paiement en plusieurs fois ?",
            text = "Les paiements à venir ne seront pas créés. Ceux déjà passés restent dans les opérations.",
            onConfirm = {
                confirmDelete = false
                vm.delete(onDone)
            },
            onDismiss = { confirmDelete = false },
        )
    }
}
