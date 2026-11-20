package net.demipech.budget.ui.accounts

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Switch
import androidx.compose.ui.Alignment
import java.time.LocalDate
import java.time.YearMonth
import net.demipech.budget.data.DebitDay
import net.demipech.budget.domain.DeferredDebit
import net.demipech.budget.ui.components.DayFormat
import net.demipech.budget.ui.components.IntField
import net.demipech.budget.ui.components.Selector
import net.demipech.budget.ui.components.label
import androidx.compose.material3.MaterialTheme
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
import net.demipech.budget.data.DEFAULT_ACCOUNT_COLOR
import net.demipech.budget.data.DEFAULT_ACCOUNT_ICON
import net.demipech.budget.data.BudgetRepository
import net.demipech.budget.domain.Money
import net.demipech.budget.ui.components.AccountIcons
import net.demipech.budget.ui.components.AmountField
import net.demipech.budget.ui.components.ColorPicker
import net.demipech.budget.ui.components.EmojiPicker
import net.demipech.budget.ui.components.ConfirmDialog
import net.demipech.budget.ui.components.FormTopBar
import net.demipech.budget.ui.repository
import net.demipech.budget.ui.components.DateField
import androidx.compose.material3.OutlinedButton
import androidx.compose.ui.platform.LocalContext
import android.widget.Toast
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.SharingStarted

class AccountEditViewModel(private val repo: BudgetRepository, private val id: Long?) : ViewModel() {
    var name by mutableStateOf("")
    var initialBalance by mutableStateOf("0")
    var color by mutableStateOf(DEFAULT_ACCOUNT_COLOR)
    var icon by mutableStateOf(DEFAULT_ACCOUNT_ICON)
    var deferredDebit by mutableStateOf(false)
    var cutoffDay by mutableStateOf("20")
    var debitDay by mutableStateOf(DebitDay.LAST_DAY)
    var debitDayOfMonth by mutableStateOf("5")
    var fallbackAccountId by mutableStateOf<Long?>(null)
    val accounts: StateFlow<List<Account>> =
        repo.accounts().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    private var original: Account? = null

    init {
        if (id != null) viewModelScope.launch {
            repo.account(id)?.let {
                original = it
                name = it.name
                initialBalance = Money.toInput(it.initialBalanceCents)
                color = it.color
                icon = it.icon
                deferredDebit = it.deferredDebit
                cutoffDay = it.cutoffDay.toString()
                debitDay = it.debitDay
                debitDayOfMonth = it.debitDayOfMonth.toString()
                fallbackAccountId = it.fallbackAccountId
            }
        }
    }

    val isNew get() = id == null
    val balanceValid get() = Money.parse(initialBalance) != null
    val cutoffValue get() = cutoffDay.toIntOrNull()?.takeIf { it in 1..31 }
    val debitDayValue get() = debitDayOfMonth.toIntOrNull()?.takeIf { it in 1..31 }
    val deferredValid get() = !deferredDebit ||
        (cutoffValue != null && (debitDay != DebitDay.DAY_OF_MONTH || debitDayValue != null))
    val canSave get() = name.isNotBlank() && balanceValid && deferredValid

    /** Exemple concret pour le mois en cours : (date de dépense, date de débit). */
    fun examples(): List<Pair<LocalDate, LocalDate>> {
        val cutoff = cutoffValue ?: return emptyList()
        val month = YearMonth.now()
        val last = month.atDay(cutoff.coerceAtMost(month.lengthOfMonth()))
        val dates = listOfNotNull(last, last.plusDays(1).takeIf { cutoff < 31 })
        return dates.map { it to DeferredDebit.debitDate(it, cutoff, debitDay, debitDayValue ?: 1) }
    }

    fun save(onDone: () -> Unit) = viewModelScope.launch {
        val cents = Money.parse(initialBalance) ?: return@launch
        repo.save(
            Account(
                id = id ?: 0,
                name = name.trim(),
                initialBalanceCents = cents,
                color = color,
                icon = icon,
                deferredDebit = deferredDebit,
                cutoffDay = cutoffValue ?: 31,
                debitDay = debitDay,
                debitDayOfMonth = debitDayValue ?: 5,
                fallbackAccountId = fallbackAccountId?.takeIf { it != id },
            )
        )
        onDone()
    }

    /** Rattrape le complément des dépenses déjà saisies depuis [from]. */
    fun coverExisting(from: LocalDate, onResult: (Int) -> Unit) = viewModelScope.launch {
        val accountId = id ?: return@launch
        onResult(repo.coverExisting(accountId, from))
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
    val accounts by vm.accounts.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var coverFrom by remember { mutableStateOf(YearMonth.now().atDay(1)) }

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
            Modifier.padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
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
            Text("Icône", style = MaterialTheme.typography.titleSmall)
            EmojiPicker(AccountIcons, vm.icon, { vm.icon = it })
            Text("Couleur", style = MaterialTheme.typography.titleSmall)
            ColorPicker(vm.color, { vm.color = it })
            HorizontalDivider()
            val others = accounts.filter { it.id != id }
            if (others.isNotEmpty()) {
                Text("Compte de secours", style = MaterialTheme.typography.titleSmall)
                Selector(
                    label = "Si le solde ne suffit pas pour une dépense",
                    options = listOf<Account?>(null) + others,
                    selected = others.find { it.id == vm.fallbackAccountId },
                    optionLabel = { it?.let { a -> "Compléter depuis ${a.icon} ${a.name}" } ?: "Ne rien faire (le solde peut devenir négatif)" },
                    onSelect = { vm.fallbackAccountId = it?.id },
                    emptyLabel = "Ne rien faire (le solde peut devenir négatif)",
                )
                others.find { it.id == vm.fallbackAccountId }?.let { backup ->
                    Text(
                        "Pour chaque dépense (saisie ou planifiée), le manque est viré automatiquement depuis " +
                            "${backup.name}. Exemple : paiement de 20 € avec 15 € sur ce compte → 15 € pris ici, " +
                            "5 € virés depuis ${backup.name}. Avec un solde à zéro, tout vient de ${backup.name}.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (id != null && backup.id == accounts.find { it.id == id }?.fallbackAccountId) {
                        // Rattrapage des dépenses saisies avant (ou sans) le compte de secours.
                        DateField("Compléter les dépenses depuis le", coverFrom, { coverFrom = it })
                        OutlinedButton(
                            onClick = {
                                vm.coverExisting(coverFrom) { count ->
                                    Toast.makeText(
                                        context,
                                        if (count == 0) "Aucune dépense à compléter." else "$count dépense(s) complétée(s) depuis ${backup.name}.",
                                        Toast.LENGTH_LONG,
                                    ).show()
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text("Compléter les dépenses existantes") }
                    } else if (id != null) {
                        Text(
                            "Enregistrez le compte pour pouvoir compléter les dépenses déjà saisies.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                HorizontalDivider()
            }
            Row(
                Modifier.fillMaxWidth().clickable { vm.deferredDebit = !vm.deferredDebit },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Carte à débit différé", style = MaterialTheme.typography.titleSmall)
                    Text(
                        "Les dépenses par carte sont débitées en une fois chaque mois. " +
                            "Elles gardent leur date dans l'historique.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Switch(checked = vm.deferredDebit, onCheckedChange = { vm.deferredDebit = it })
            }
            if (vm.deferredDebit) {
                IntField(vm.cutoffDay, { vm.cutoffDay = it }, "Dépenses arrêtées le (jour, 31 = fin de mois)", Modifier.fillMaxWidth())
                Selector(
                    label = "Débitées",
                    options = DebitDay.entries,
                    selected = vm.debitDay,
                    optionLabel = { it.label() },
                    onSelect = { vm.debitDay = it },
                )
                if (vm.debitDay == DebitDay.DAY_OF_MONTH) {
                    IntField(vm.debitDayOfMonth, { vm.debitDayOfMonth = it }, "Jour du débit", Modifier.fillMaxWidth())
                }
                val examples = vm.examples()
                if (examples.isNotEmpty()) {
                    Text(
                        examples.joinToString("\n") { (spent, debit) ->
                            "Une dépense du ${spent.format(DayFormat)} est débitée le ${debit.format(DayFormat)}."
                        } + "\nVous pourrez exclure une dépense précise (ex. un prélèvement) dans son formulaire.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
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
