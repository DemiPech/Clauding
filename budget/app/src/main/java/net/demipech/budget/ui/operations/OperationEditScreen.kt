package net.demipech.budget.ui.operations

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
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
import net.demipech.budget.ui.components.ColorDot
import net.demipech.budget.ui.components.ConfirmDialog
import net.demipech.budget.ui.components.DateField
import net.demipech.budget.ui.components.EmptyState
import net.demipech.budget.ui.components.FormTopBar
import net.demipech.budget.ui.components.KindSelector
import net.demipech.budget.ui.components.Selector
import net.demipech.budget.ui.repository
import java.time.LocalDate

class OperationEditViewModel(
    private val repo: BudgetRepository,
    private val id: Long?,
    presetAccountId: Long?,
) : ViewModel() {
    var kind by mutableStateOf(Kind.EXPENSE)
        private set
    var amount by mutableStateOf("")
    var accountId by mutableStateOf(presetAccountId)
    var categoryId by mutableStateOf<Long?>(null)
    var date: LocalDate by mutableStateOf(LocalDate.now())
    var note by mutableStateOf("")
    var loaded by mutableStateOf(id == null)
        private set
    private var original: Operation? = null

    val accounts: StateFlow<List<Account>?> =
        repo.accounts().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val categories: StateFlow<List<Category>> =
        repo.categories().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    init {
        if (id != null) viewModelScope.launch {
            repo.operation(id)?.let {
                original = it
                kind = it.kind
                amount = Money.toInput(it.amountCents)
                accountId = it.accountId
                categoryId = it.categoryId
                date = it.date
                note = it.note
            }
            loaded = true
        }
    }

    val isNew get() = id == null
    val amountCents get() = Money.parse(amount)?.takeIf { it > 0 }
    val canSave get() = amountCents != null && accountId != null

    fun changeKind(value: Kind) {
        kind = value
        // Une catégorie de dépense n'a pas de sens sur une rentrée, et inversement.
        if (categories.value.find { it.id == categoryId }?.kind != value) categoryId = null
    }

    fun save(onDone: () -> Unit) = viewModelScope.launch {
        val cents = amountCents ?: return@launch
        val account = accountId ?: return@launch
        repo.save(
            Operation(
                id = id ?: 0,
                accountId = account,
                categoryId = categoryId,
                kind = kind,
                amountCents = cents,
                date = date,
                note = note.trim(),
                scheduledId = original?.scheduledId,
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
fun OperationEditScreen(id: Long?, presetAccountId: Long?, onDone: () -> Unit) {
    val repo = repository()
    val vm = viewModel(key = "operation-$id-$presetAccountId") { OperationEditViewModel(repo, id, presetAccountId) }
    val accounts by vm.accounts.collectAsStateWithLifecycle()
    val categories by vm.categories.collectAsStateWithLifecycle()
    var confirmDelete by remember { mutableStateOf(false) }

    LaunchedEffect(accounts, vm.loaded) {
        if (vm.loaded && vm.accountId == null) vm.accountId = accounts?.firstOrNull()?.id
    }

    Scaffold(
        topBar = {
            FormTopBar(
                title = if (vm.isNew) "Nouvelle opération" else "Modifier l'opération",
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
            DateField("Date", vm.date, { vm.date = it })
            OutlinedTextField(
                value = vm.note,
                onValueChange = { vm.note = it },
                label = { Text("Note") },
                modifier = Modifier.fillMaxWidth(),
            )
            Button(onClick = { vm.save(onDone) }, enabled = vm.canSave, modifier = Modifier.fillMaxWidth()) {
                Text("Enregistrer")
            }
        }
    }

    if (confirmDelete) {
        ConfirmDialog(
            title = "Supprimer l'opération ?",
            text = "Le solde du compte sera recalculé.",
            onConfirm = {
                confirmDelete = false
                vm.delete(onDone)
            },
            onDismiss = { confirmDelete = false },
        )
    }
}
