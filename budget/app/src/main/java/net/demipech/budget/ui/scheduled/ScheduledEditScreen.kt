package net.demipech.budget.ui.scheduled

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import net.demipech.budget.domain.Money
import net.demipech.budget.domain.Recurrence
import net.demipech.budget.ui.components.AmountField
import net.demipech.budget.ui.components.ColorDot
import net.demipech.budget.ui.components.ConfirmDialog
import net.demipech.budget.ui.components.DateField
import net.demipech.budget.ui.components.EmptyState
import net.demipech.budget.ui.components.FormTopBar
import net.demipech.budget.ui.components.IntField
import net.demipech.budget.ui.components.KindSelector
import net.demipech.budget.ui.components.Segmented
import net.demipech.budget.ui.components.Selector
import net.demipech.budget.ui.components.describeRhythm
import net.demipech.budget.ui.components.label
import net.demipech.budget.ui.components.unit
import net.demipech.budget.ui.repository
import java.time.LocalDate

class ScheduledEditViewModel(private val repo: BudgetRepository, private val id: Long?) : ViewModel() {
    var kind by mutableStateOf(Kind.EXPENSE)
        private set
    var amount by mutableStateOf("")
    var accountId by mutableStateOf<Long?>(null)
    var categoryId by mutableStateOf<Long?>(null)
    var note by mutableStateOf("")
    var date: LocalDate by mutableStateOf(LocalDate.now())
    var frequency by mutableStateOf(Frequency.MONTHLY)
    var interval by mutableStateOf("1")
    var endless by mutableStateOf(true)
    var count by mutableStateOf("12")
    var loaded by mutableStateOf(id == null)
        private set
    private var original: ScheduledOperation? = null

    val accounts: StateFlow<List<Account>?> =
        repo.accounts().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val categories: StateFlow<List<Category>> =
        repo.categories().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    init {
        if (id != null) viewModelScope.launch {
            repo.scheduled(id)?.let { s ->
                original = s
                kind = s.kind
                amount = Money.toInput(s.amountCents)
                accountId = s.accountId
                categoryId = s.categoryId
                note = s.note
                frequency = s.frequency
                interval = s.interval.toString()
                // On modifie la suite de la série : la date affichée est la prochaine
                // échéance et le nombre est celui des échéances restantes.
                date = Recurrence.nextDate(s) ?: LocalDate.now()
                val remaining = Recurrence.remaining(s)
                endless = remaining == null
                count = (remaining?.takeIf { it > 0 } ?: 1).toString()
            }
            loaded = true
        }
    }

    val isNew get() = id == null
    val amountCents get() = Money.parse(amount)?.takeIf { it > 0 }
    private val intervalValue get() = interval.toIntOrNull()?.takeIf { it >= 1 }
    private val countValue get() = count.toIntOrNull()?.takeIf { it >= 1 }

    val canSave
        get() = amountCents != null && accountId != null &&
            (frequency == Frequency.NONE || (intervalValue != null && (endless || countValue != null)))

    fun changeKind(value: Kind) {
        kind = value
        if (categories.value.find { it.id == categoryId }?.kind != value) categoryId = null
    }

    fun save(onDone: () -> Unit) = viewModelScope.launch {
        val cents = amountCents ?: return@launch
        val account = accountId ?: return@launch
        val once = frequency == Frequency.NONE
        // À la création comme à la modification, la date choisie devient l'échéance n° 0 :
        // les opérations déjà créées par la série ne sont ni dupliquées ni supprimées.
        repo.save(
            ScheduledOperation(
                id = id ?: 0,
                accountId = account,
                categoryId = categoryId,
                kind = kind,
                amountCents = cents,
                note = note.trim(),
                startDate = date,
                frequency = frequency,
                interval = if (once) 1 else intervalValue ?: return@launch,
                occurrences = when {
                    once -> 1
                    endless -> null
                    else -> countValue ?: return@launch
                },
                generatedCount = 0,
            )
        )
        onDone()
    }

    fun delete(onDone: () -> Unit) = viewModelScope.launch {
        original?.let { repo.delete(it) }
        onDone()
    }
}

@Composable
fun ScheduledEditScreen(id: Long?, onDone: () -> Unit) {
    val repo = repository()
    val vm = viewModel(key = "scheduled-$id") { ScheduledEditViewModel(repo, id) }
    val accounts by vm.accounts.collectAsStateWithLifecycle()
    val categories by vm.categories.collectAsStateWithLifecycle()
    var confirmDelete by remember { mutableStateOf(false) }

    LaunchedEffect(accounts, vm.loaded) {
        if (vm.loaded && vm.accountId == null) vm.accountId = accounts?.firstOrNull()?.id
    }

    Scaffold(
        topBar = {
            FormTopBar(
                title = if (vm.isNew) "Planifier" else "Modifier la planification",
                onBack = onDone,
                onDelete = if (vm.isNew) null else ({ confirmDelete = true }),
            )
        },
    ) { padding ->
        val accountList = accounts ?: return@Scaffold
        if (accountList.isEmpty()) {
            EmptyState("Créez d'abord un compte dans l'onglet Comptes.", Modifier.padding(padding))
            return@Scaffold
        }
        val kindCategories = categories.filter { it.kind == vm.kind }
        val repeats = vm.frequency != Frequency.NONE

        Column(
            Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            KindSelector(vm.kind, vm::changeKind)
            AmountField(
                value = vm.amount,
                onValueChange = { vm.amount = it },
                label = "Montant",
                isError = vm.amount.isNotEmpty() && vm.amountCents == null,
            )
            Selector(
                label = "Compte",
                options = accountList,
                selected = accountList.find { it.id == vm.accountId },
                optionLabel = { it.name },
                onSelect = { vm.accountId = it.id },
            )
            Selector(
                label = "Catégorie",
                options = listOf<Category?>(null) + kindCategories,
                selected = kindCategories.find { it.id == vm.categoryId },
                optionLabel = { it?.name ?: "Sans catégorie" },
                onSelect = { vm.categoryId = it?.id },
                leading = { ColorDot(it?.color) },
                emptyLabel = "Sans catégorie",
            )
            OutlinedTextField(
                value = vm.note,
                onValueChange = { vm.note = it },
                label = { Text("Libellé (ex. Loyer, Netflix…)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            Text("Répétition", style = MaterialTheme.typography.titleSmall)
            Selector(
                label = "Répéter",
                options = Frequency.entries,
                selected = vm.frequency,
                optionLabel = { it.label() },
                onSelect = { vm.frequency = it },
            )
            if (repeats) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    IntField(vm.interval, { vm.interval = it }, "Tous les", Modifier.width(120.dp))
                    Text(vm.frequency.unit())
                }
            }

            DateField(
                label = when {
                    !repeats -> "Date"
                    vm.isNew -> "Première échéance"
                    else -> "Prochaine échéance"
                },
                date = vm.date,
                onDateChange = { vm.date = it },
            )

            if (repeats) {
                Text("Fin", style = MaterialTheme.typography.titleSmall)
                Segmented(
                    options = listOf(true, false),
                    selected = vm.endless,
                    label = { if (it) "Jamais" else "Après N fois" },
                    onSelect = { vm.endless = it },
                )
                if (!vm.endless) {
                    IntField(
                        vm.count,
                        { vm.count = it },
                        if (vm.isNew) "Nombre d'échéances" else "Échéances restantes",
                        Modifier.fillMaxWidth(),
                    )
                }
            }

            Summary(vm)

            Button(onClick = { vm.save(onDone) }, enabled = vm.canSave, modifier = Modifier.fillMaxWidth()) {
                Text("Enregistrer")
            }
        }
    }

    if (confirmDelete) {
        ConfirmDialog(
            title = "Supprimer la planification ?",
            text = "Les échéances à venir ne seront pas créées. Les opérations déjà passées sont conservées.",
            onConfirm = {
                confirmDelete = false
                vm.delete(onDone)
            },
            onDismiss = { confirmDelete = false },
        )
    }
}

@Composable
private fun Summary(vm: ScheduledEditViewModel) {
    val interval = vm.interval.toIntOrNull()?.coerceAtLeast(1) ?: 1
    val lines = buildList {
        if (vm.frequency == Frequency.NONE) {
            add("Une seule fois.")
        } else {
            add(describeRhythm(vm.frequency, interval) + if (vm.endless) ", sans fin." else ", ${vm.count} fois.")
        }
        if (vm.date.isBefore(LocalDate.now())) {
            add("Les échéances déjà passées seront ajoutées tout de suite aux opérations.")
        }
    }
    Text(
        lines.joinToString("\n"),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}
