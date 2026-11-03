package net.demipech.budget.ui.accounts

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch
import net.demipech.budget.data.Account
import net.demipech.budget.data.BudgetRepository
import net.demipech.budget.domain.Money
import net.demipech.budget.ui.components.AmountField
import net.demipech.budget.ui.components.ConfirmDialog
import net.demipech.budget.ui.components.FormTopBar
import net.demipech.budget.ui.repository

class AccountEditViewModel(private val repo: BudgetRepository, private val id: Long?) : ViewModel() {
    var name by mutableStateOf("")
    var initialBalance by mutableStateOf("0")
    private var original: Account? = null

    init {
        if (id != null) viewModelScope.launch {
            repo.account(id)?.let {
                original = it
                name = it.name
                initialBalance = Money.toInput(it.initialBalanceCents)
            }
        }
    }

    val isNew get() = id == null
    val balanceValid get() = Money.parse(initialBalance) != null
    val canSave get() = name.isNotBlank() && balanceValid

    fun save(onDone: () -> Unit) = viewModelScope.launch {
        val cents = Money.parse(initialBalance) ?: return@launch
        repo.save(Account(id = id ?: 0, name = name.trim(), initialBalanceCents = cents))
        onDone()
    }

    fun delete(onDone: () -> Unit) = viewModelScope.launch {
        original?.let { repo.delete(it) }
        onDone()
    }
}

@Composable
fun AccountEditScreen(id: Long?, onDone: () -> Unit, onDeleted: () -> Unit) {
    val repo = repository()
    val vm = viewModel(key = "account-$id") { AccountEditViewModel(repo, id) }
    var confirmDelete by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            FormTopBar(
                title = if (vm.isNew) "Nouveau compte" else "Modifier le compte",
                onBack = onDone,
                onDelete = if (vm.isNew) null else ({ confirmDelete = true }),
            )
        },
    ) { padding ->
        Column(
            Modifier.padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            OutlinedTextField(
                value = vm.name,
                onValueChange = { vm.name = it },
                label = { Text("Nom du compte") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            AmountField(
                value = vm.initialBalance,
                onValueChange = { vm.initialBalance = it },
                label = "Solde initial",
                isError = !vm.balanceValid,
            )
            Text(
                "Le solde du compte au moment où vous commencez à le suivre ici. " +
                    "Il peut être négatif (ex. -150).",
            )
            Button(onClick = { vm.save(onDone) }, enabled = vm.canSave, modifier = Modifier.fillMaxWidth()) {
                Text("Enregistrer")
            }
        }
    }

    if (confirmDelete) {
        ConfirmDialog(
            title = "Supprimer le compte ?",
            text = "Toutes ses opérations et planifications seront supprimées aussi.",
            onConfirm = {
                confirmDelete = false
                vm.delete(onDeleted)
            },
            onDismiss = { confirmDelete = false },
        )
    }
}
