package net.demipech.budget.ui.categories

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
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
import net.demipech.budget.data.BudgetRepository
import net.demipech.budget.data.Category
import net.demipech.budget.data.Kind
import net.demipech.budget.ui.components.CategoryPalette
import net.demipech.budget.ui.components.ColorDot
import net.demipech.budget.ui.components.ConfirmDialog
import net.demipech.budget.ui.components.EmptyState
import net.demipech.budget.ui.components.KindSelector
import net.demipech.budget.ui.repository

class CategoriesViewModel(private val repo: BudgetRepository) : ViewModel() {
    val categories: StateFlow<List<Category>?> =
        repo.categories().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun save(category: Category) = viewModelScope.launch { repo.save(category) }
    fun delete(category: Category) = viewModelScope.launch { repo.delete(category) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoriesScreen() {
    val repo = repository()
    val vm = viewModel { CategoriesViewModel(repo) }
    val categories by vm.categories.collectAsStateWithLifecycle()
    // Catégorie en cours d'édition ; id = 0 pour une nouvelle.
    var editing by remember { mutableStateOf<Category?>(null) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Catégories") }) },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { editing = Category(name = "", kind = Kind.EXPENSE, color = CategoryPalette.first()) },
                icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                text = { Text("Catégorie") },
            )
        },
    ) { padding ->
        val list = categories ?: return@Scaffold
        if (list.isEmpty()) {
            EmptyState("Aucune catégorie.", Modifier.padding(padding))
            return@Scaffold
        }
        LazyColumn(contentPadding = PaddingValues(bottom = 88.dp), modifier = Modifier.padding(padding)) {
            for (kind in listOf(Kind.EXPENSE, Kind.INCOME)) {
                val ofKind = list.filter { it.kind == kind }
                if (ofKind.isEmpty()) continue
                item(key = "title-$kind") {
                    Text(
                        if (kind == Kind.EXPENSE) "Dépenses" else "Rentrées",
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 4.dp),
                    )
                }
                items(ofKind, key = { it.id }) { category ->
                    ListItem(
                        leadingContent = { ColorDot(category.color, size = 20) },
                        headlineContent = { Text(category.name) },
                        modifier = Modifier.clickable { editing = category },
                    )
                    HorizontalDivider()
                }
            }
        }
    }

    editing?.let { category ->
        CategoryDialog(
            initial = category,
            onSave = {
                vm.save(it)
                editing = null
            },
            onDelete = {
                vm.delete(category)
                editing = null
            },
            onDismiss = { editing = null },
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CategoryDialog(
    initial: Category,
    onSave: (Category) -> Unit,
    onDelete: () -> Unit,
    onDismiss: () -> Unit,
) {
    var name by remember { mutableStateOf(initial.name) }
    var kind by remember { mutableStateOf(initial.kind) }
    var color by remember { mutableStateOf(initial.color) }
    var confirmDelete by remember { mutableStateOf(false) }
    val isNew = initial.id == 0L

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (isNew) "Nouvelle catégorie" else "Modifier la catégorie") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nom") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                KindSelector(kind, { kind = it })
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    CategoryPalette.forEach { option ->
                        ColorDot(
                            option,
                            size = 32,
                            modifier = Modifier
                                .then(
                                    if (option == color) {
                                        Modifier.border(3.dp, MaterialTheme.colorScheme.onSurface, CircleShape)
                                    } else {
                                        Modifier
                                    }
                                )
                                .clickable { color = option },
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(initial.copy(name = name.trim(), kind = kind, color = color)) },
                enabled = name.isNotBlank(),
            ) { Text("Enregistrer") }
        },
        dismissButton = {
            if (!isNew) {
                TextButton(onClick = { confirmDelete = true }) { Text("Supprimer") }
            } else {
                TextButton(onClick = onDismiss) { Text("Annuler") }
            }
        },
    )

    if (confirmDelete) {
        ConfirmDialog(
            title = "Supprimer « ${initial.name} » ?",
            text = "Les opérations de cette catégorie sont conservées, sans catégorie.",
            onConfirm = onDelete,
            onDismiss = { confirmDelete = false },
        )
    }
}
