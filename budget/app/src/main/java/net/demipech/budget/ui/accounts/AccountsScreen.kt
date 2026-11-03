package net.demipech.budget.ui.accounts

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import net.demipech.budget.data.AccountWithBalance
import net.demipech.budget.data.BudgetRepository
import net.demipech.budget.domain.Money
import net.demipech.budget.ui.components.AmountText
import net.demipech.budget.ui.components.EmptyState
import net.demipech.budget.ui.repository
import net.demipech.budget.ui.theme.amountColor

class AccountsViewModel(repo: BudgetRepository) : ViewModel() {
    val accounts: StateFlow<List<AccountWithBalance>?> =
        repo.accountsWithBalance().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountsScreen(onOpenAccount: (Long) -> Unit, onAddAccount: () -> Unit) {
    val repo = repository()
    val vm = viewModel { AccountsViewModel(repo) }
    val accounts by vm.accounts.collectAsStateWithLifecycle()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Comptes") }) },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onAddAccount,
                icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                text = { Text("Compte") },
            )
        },
    ) { padding ->
        val list = accounts ?: return@Scaffold
        if (list.isEmpty()) {
            EmptyState("Aucun compte.\nAjoutez votre premier compte bancaire avec le bouton +.", Modifier.padding(padding))
            return@Scaffold
        }
        val total = list.sumOf { it.balanceCents }
        LazyColumn(contentPadding = PaddingValues(bottom = 88.dp), modifier = Modifier.padding(padding)) {
            item {
                Card(Modifier.fillMaxWidth().padding(16.dp)) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Solde total", style = MaterialTheme.typography.labelLarge)
                        Text(
                            Money.format(total),
                            style = MaterialTheme.typography.headlineMedium,
                            color = amountColor(total),
                        )
                    }
                }
            }
            items(list, key = { it.account.id }) { item ->
                ListItem(
                    headlineContent = { Text(item.account.name) },
                    trailingContent = { AmountText(item.balanceCents, signed = false) },
                    modifier = Modifier.clickable { onOpenAccount(item.account.id) },
                )
                HorizontalDivider()
            }
        }
    }
}
