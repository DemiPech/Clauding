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
    private var original: Operation? = null

    val accounts: StateFlow<List<Account>?> =
        repo.accounts().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val categories: StateFlow<List<Category>> =
        repo.categories().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    init {
        if (id != null) viewModelScope.launch {
            repo.operation(id)?.let { op ->
                original = op
                amount = Money.toInput(op.amountCents)
                date = op.date
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
            if (previous != null && previousTransfer == null) repo.delete(previous)
            repo.saveTransfer(previousTransfer, account, target, cents, date, note.trim())
        } else {
            // Un virement devenu opération simple : on retire ses deux côtés.
            if (previousTransfer != null) repo.deleteTransfer(previousTransfer)
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
                )
            )
        }
        onDone()
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
) {
    val repo = repository()
    val vm = viewModel(key = "operation-$id-$presetAccountId-$presetDate") {
        OperationEditViewModel(repo, id, presetAccountId, presetDate)
    }
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
                onDelete = if (vm.isNew) null else ({ confirmDelete = true }),
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
            EntryTypeSelector(vm.type, vm::changeType)
            AmountField(
                value = vm.amount,
                onValueChange = { vm.amount = it },
                label = "Montant",
                isError = vm.amount.isNotEmpty() && vm.amountCents == null,
            )
            OutlinedTextField(
                value = vm.note,
                onValueChange = { vm.note = it },
                label = { Text("Libellé (facultatif)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
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
                CategorySelector(categories, vm.kind, vm.categoryId, { vm.categoryId = it })
                accountList.find { it.id == vm.accountId }?.takeIf { it.deferredDebit && vm.kind == Kind.EXPENSE }?.let { account ->
                    DeferredSwitch(vm.deferred, { vm.deferred = it }, DeferredDebit.debitDate(vm.date, account))
                }
            }
            DateField("Date", vm.date, { vm.date = it })
            Button(onClick = { vm.save(onDone) }, enabled = vm.canSave, modifier = Modifier.fillMaxWidth()) {
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
