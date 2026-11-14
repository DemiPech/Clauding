package net.demipech.budget.ui.operations

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.TextButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import net.demipech.budget.data.Kind
import net.demipech.budget.data.Operation
import net.demipech.budget.domain.Money
import net.demipech.budget.ui.components.AmountField
import net.demipech.budget.ui.components.CategorySelector
import net.demipech.budget.ui.components.ConfirmDialog
import net.demipech.budget.ui.components.DateField
import net.demipech.budget.ui.components.EmptyState
import net.demipech.budget.ui.components.FormTopBar
import net.demipech.budget.ui.components.KindSelector
import net.demipech.budget.ui.components.Selector
import net.demipech.budget.ui.installments.InstallmentPreset
import net.demipech.budget.ui.repository
import net.demipech.budget.ui.components.CategoryGrid
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.SuggestionChip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import net.demipech.budget.ui.components.SectionCard
import net.demipech.budget.data.isLocked
import net.demipech.budget.data.ClearStatus
import androidx.compose.material3.MaterialTheme
import net.demipech.budget.ui.components.kind
import net.demipech.budget.ui.components.EntryTypeSelector
import net.demipech.budget.ui.components.EntryType
import net.demipech.budget.domain.DeferredDebit
import net.demipech.budget.ui.components.DeferredSwitch
import java.time.LocalDate

class OperationEditViewModel(
    private val repo: BudgetRepository,
    private val id: Long?,
    presetAccountId: Long?,
    presetDate: LocalDate?,
    /** Dupliquer : on part de cette opération, datée d'aujourd'hui. */
    copyOf: Long? = null,
) : ViewModel() {
    var type by mutableStateOf(EntryType.EXPENSE)
        private set
    val kind: Kind get() = type.kind
    var amount by mutableStateOf("")
    /** Compte de l'opération, ou compte débité pour un virement. */
    var accountId by mutableStateOf(presetAccountId)
    /** Compte crédité d'un virement. */
    var toAccountId by mutableStateOf<Long?>(null)
    var categoryId by mutableStateOf<Long?>(null)
    var date: LocalDate by mutableStateOf(presetDate ?: LocalDate.now())
    var note by mutableStateOf("")
    /** Dépense par carte à débit différé (si le compte en a une). */
    var deferred by mutableStateOf(true)
    var loaded by mutableStateOf(id == null)
        private set
    private var original: Operation? by mutableStateOf(null)

    val accounts: StateFlow<List<Account>?> =
        repo.accounts().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val categories: StateFlow<List<Category>> =
        repo.categories().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    /** Opérations passées dont le libellé commence comme celui saisi. */
    var suggestions by mutableStateOf<List<Operation>>(emptyList())
        private set
    private var suggestionJob: Job? = null

    init {
        val sourceId = id ?: copyOf
        if (sourceId != null) viewModelScope.launch {
            repo.operation(sourceId)?.let { op ->
                if (id != null) original = op
                amount = Money.toInput(op.amountCents)
                date = if (id != null) op.date else presetDate ?: LocalDate.now()
                note = op.note
                deferred = op.deferred
                val transferId = op.transferId
                if (transferId != null) {
                    // Un virement s'ouvre depuis l'un ou l'autre côté : on retrouve les deux.
                    val legs = repo.transferLegs(transferId)
                    type = EntryType.TRANSFER
                    accountId = legs.find { it.kind == Kind.EXPENSE }?.accountId
                    toAccountId = legs.find { it.kind == Kind.INCOME }?.accountId
                } else {
                    type = if (op.kind == Kind.INCOME) EntryType.INCOME else EntryType.EXPENSE
                    accountId = op.accountId
                    categoryId = op.categoryId
                }
            }
            loaded = true
        }
    }

    val isNew get() = id == null

    fun changeNote(value: String) {
        note = value
        suggestionJob?.cancel()
        if (!isNew || isTransfer || value.trim().length < 2) {
            suggestions = emptyList()
            return
        }
        suggestionJob = viewModelScope.launch {
            delay(150)
            suggestions = repo.suggestions(value).filter { it.note != value.trim() }
        }
    }

    /** Reprend libellé, sens, catégorie, compte (et montant s'il est vide) d'une opération passée. */
    fun applySuggestion(op: Operation) {
        note = op.note
        type = if (op.kind == Kind.INCOME) EntryType.INCOME else EntryType.EXPENSE
        categoryId = op.categoryId
        accountId = op.accountId
        deferred = op.deferred
        if (amountCents == null) amount = Money.toInput(op.amountCents)
        suggestions = emptyList()
    }
    val isTransfer get() = type == EntryType.TRANSFER
    val amountCents get() = Money.parse(amount)?.takeIf { it > 0 }
    val canSave
        get() = amountCents != null && accountId != null &&
            (!isTransfer || (toAccountId != null && toAccountId != accountId))

    fun changeType(value: EntryType) {
        type = value
        // Une catégorie de dépense n'a pas de sens sur une rentrée, et inversement.
        if (value == EntryType.TRANSFER || categories.value.find { it.id == categoryId }?.kind != value.kind) categoryId = null
    }

    fun save(onDone: () -> Unit) = viewModelScope.launch {
        val cents = amountCents ?: return@launch
        val account = accountId ?: return@launch
        val previous = original
        val previousTransfer = previous?.transferId
        if (isTransfer) {
            val target = toAccountId ?: return@launch
            // Une opération simple devenue virement : on la remplace.
            if (previous != null && previousTransfer == null) repo.delete(previous, undoable = false)
            repo.saveTransfer(previousTransfer, account, target, cents, date, note.trim())
        } else {
            // Un virement devenu opération simple : on retire ses deux côtés.
            if (previousTransfer != null) repo.deleteTransfer(previousTransfer, undoable = false)
            repo.save(
                Operation(
                    id = if (previousTransfer != null) 0 else id ?: 0,
                    accountId = account,
                    categoryId = categoryId,
                    kind = kind,
                    amountCents = cents,
                    date = date,
                    note = note.trim(),
                    scheduledId = previous?.scheduledId,
                    deferred = deferred,
                    status = if (previousTransfer != null) ClearStatus.NONE else previous?.status ?: ClearStatus.NONE,
                )
            )
        }
        onDone()
    }

    /** Opération rapprochée : verrouillée tant qu'on ne la déverrouille pas. */
    val isLocked get() = original?.isLocked == true

    /** Échéance à montant variable pas encore confirmée : enregistrer la confirme. */
    val isEstimated get() = original?.toConfirm == true

    fun unlock() = viewModelScope.launch {
        val op = original ?: return@launch
        repo.unlock(op)
        original = op.copy(status = ClearStatus.CLEARED)
    }

    fun delete(onDone: () -> Unit) = viewModelScope.launch {
        original?.let { op ->
            val transferId = op.transferId
            if (transferId != null) repo.deleteTransfer(transferId) else repo.delete(op)
        }
        onDone()
    }
}

@Composable
fun OperationEditScreen(
    id: Long?,
    presetAccountId: Long?,
    presetDate: LocalDate?,
    onDone: () -> Unit,
    onSplit: (InstallmentPreset) -> Unit,
    copyOf: Long? = null,
    onDuplicate: (Long) -> Unit = {},
) {
    val repo = repository()
    val vm = viewModel(key = "operation-$id-$presetAccountId-$presetDate-$copyOf") {
        OperationEditViewModel(repo, id, presetAccountId, presetDate, copyOf)
    }
    val amountFocus = remember { FocusRequester() }
    val accounts by vm.accounts.collectAsStateWithLifecycle()
    val categories by vm.categories.collectAsStateWithLifecycle()
    var confirmDelete by remember { mutableStateOf(false) }

    LaunchedEffect(accounts, vm.loaded) {
        if (vm.loaded && vm.accountId == null) vm.accountId = accounts?.firstOrNull()?.id
    }

    Scaffold(
        topBar = {
            FormTopBar(
                title = when {
                    vm.isNew -> "Nouvelle opération"
                    vm.isTransfer -> "Modifier le virement"
                    else -> "Modifier l'opération"
                },
                onBack = onDone,
                onDelete = if (vm.isNew || vm.isLocked) null else ({ confirmDelete = true }),
                extraActions = {
                    if (id != null) TextButton(onClick = { onDuplicate(id) }) { Text("Dupliquer") }
                },
            )
        },
    ) { padding ->
        val accountList = accounts ?: return@Scaffold
        if (accountList.isEmpty()) {
            EmptyState("Créez d'abord un compte dans l'onglet Comptes.", Modifier.padding(padding))
            return@Scaffold
        }
        Column(
            Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (vm.isLocked) {
                SectionCard {
                    Text(
                        "🔒 Opération rapprochée : elle a été vérifiée sur le relevé et ne se modifie plus.",
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                    TextButton(onClick = { vm.unlock() }, modifier = Modifier.padding(horizontal = 8.dp)) {
                        Text("Déverrouiller pour la modifier")
                    }
                }
            }
            if (vm.isEstimated) {
                Text(
                    "≈ Montant estimé : corrigez-le si besoin, enregistrer le confirme.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            EntryTypeSelector(vm.type, vm::changeType)
            AmountField(
                value = vm.amount,
                onValueChange = { vm.amount = it },
                label = "Montant",
                isError = vm.amount.isNotEmpty() && vm.amountCents == null,
                modifier = Modifier.focusRequester(amountFocus),
            )
            // Nouvelle opération : le clavier s'ouvre directement sur le montant.
            LaunchedEffect(Unit) { if (vm.isNew && copyOf == null) runCatching { amountFocus.requestFocus() } }
            OutlinedTextField(
                value = vm.note,
                onValueChange = vm::changeNote,
                label = { Text("Libellé (facultatif)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            if (vm.suggestions.isNotEmpty()) {
                Row(
                    Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    vm.suggestions.forEach { op ->
                        SuggestionChip(
                            onClick = { vm.applySuggestion(op) },
                            label = { Text("${op.note} · ${Money.format(op.amountCents)}") },
                        )
                    }
                }
            }
            Selector(
                label = if (vm.isTransfer) "Depuis le compte" else "Compte",
                options = accountList,
                selected = accountList.find { it.id == vm.accountId },
                optionLabel = { "${it.icon} ${it.name}" },
                onSelect = { vm.accountId = it.id },
            )
            if (vm.isTransfer) {
                Selector(
                    label = "Vers le compte",
                    options = accountList.filter { it.id != vm.accountId },
                    selected = accountList.find { it.id == vm.toAccountId && it.id != vm.accountId },
                    optionLabel = { "${it.icon} ${it.name}" },
                    onSelect = { vm.toAccountId = it.id },
                )
                if (accountList.size < 2) {
                    Text(
                        "Il faut au moins deux comptes pour faire un virement.",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            } else {
                CategoryGrid(categories, vm.kind, vm.categoryId, { vm.categoryId = it })
                accountList.find { it.id == vm.accountId }?.takeIf { it.deferredDebit && vm.kind == Kind.EXPENSE }?.let { account ->
                    DeferredSwitch(vm.deferred, { vm.deferred = it }, DeferredDebit.debitDate(vm.date, account))
                }
            }
            DateField("Date", vm.date, { vm.date = it })
            Button(onClick = { vm.save(onDone) }, enabled = vm.canSave && !vm.isLocked, modifier = Modifier.fillMaxWidth()) {
                Text("Enregistrer")
            }
            if (vm.isNew && !vm.isTransfer) {
                // Le 1er paiement tout de suite, les suivants en échéancier.
                TextButton(
                    onClick = {
                        onSplit(InstallmentPreset(vm.amountCents, vm.accountId, vm.categoryId, vm.note.trim()))
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Payer en plusieurs fois…") }
            }
        }
    }

    if (confirmDelete) {
        ConfirmDialog(
            title = if (vm.isTransfer) "Supprimer le virement ?" else "Supprimer l'opération ?",
            text = if (vm.isTransfer) "Ses deux côtés sont supprimés et les soldes recalculés." else "Le solde du compte sera recalculé.",
            onConfirm = {
                confirmDelete = false
                vm.delete(onDone)
            },
            onDismiss = { confirmDelete = false },
        )
    }
}
