package net.demipech.budget.ui.categories

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
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
import net.demipech.budget.ui.components.CategoryBadge
import net.demipech.budget.ui.components.CategoryEmojis
import net.demipech.budget.ui.components.CategoryPalette
import net.demipech.budget.ui.components.ColorPicker
import net.demipech.budget.ui.components.ConfirmDialog
import net.demipech.budget.ui.components.EmojiPicker
import net.demipech.budget.ui.components.EmptyState
import net.demipech.budget.ui.components.KindSelector
import net.demipech.budget.ui.components.Segmented
import net.demipech.budget.ui.components.Selector
import net.demipech.budget.ui.components.emojiOf
import net.demipech.budget.ui.components.ordered
import net.demipech.budget.ui.repository

class CategoriesViewModel(private val repo: BudgetRepository) : ViewModel() {
    val categories: StateFlow<List<Category>?> =
        repo.categories().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun save(category: Category) = viewModelScope.launch { repo.save(category) }
    fun delete(category: Category) = viewModelScope.launch { repo.delete(category) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoriesScreen(onBack: () -> Unit) {
    val repo = repository()
    val vm = viewModel { CategoriesViewModel(repo) }
    val categories by vm.categories.collectAsStateWithLifecycle()
    var kind by rememberSaveable { mutableStateOf(Kind.EXPENSE) }
    // Catégorie en cours d'édition ; id = 0 pour une nouvelle.
    var editing by remember { mutableStateOf<Category?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Catégories") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { editing = Category(name = "", kind = kind, color = CategoryPalette.first()) },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ) { Icon(Icons.Filled.Add, contentDescription = "Nouvelle catégorie") }
        },
    ) { padding ->
        val all = categories ?: return@Scaffold
        val list = remember(all, kind) { all.ordered(kind) }
        LazyColumn(contentPadding = PaddingValues(bottom = 88.dp), modifier = Modifier.padding(padding)) {
            item {
                Segmented(
                    options = listOf(Kind.EXPENSE, Kind.INCOME),
                    selected = kind,
                    label = { if (it == Kind.EXPENSE) "Dépenses" else "Revenus" },
                    onSelect = { kind = it },
                    modifier = Modifier.padding(16.dp),
                )
            }
            if (list.isEmpty()) item { EmptyState("Aucune catégorie.") }
            items(list, key = { it.id }) { category ->
                val isChild = category.parentId != null
                ListItem(
                    leadingContent = {
                        CategoryBadge(all.emojiOf(category), category.color, size = if (isChild) 32 else 40)
                    },
                    headlineContent = { Text(category.name) },
                    trailingContent = if (isChild) null else ({
                        IconButton(onClick = {
                            editing = Category(
                                name = "", kind = category.kind, color = category.color, parentId = category.id,
                            )
                        }) { Icon(Icons.Filled.Add, contentDescription = "Ajouter une sous-catégorie") }
                    }),
                    colors = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier
                        .clickable { editing = category }
                        .padding(start = if (isChild) 32.dp else 0.dp),
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }
        }
    }

    editing?.let { category ->
        CategoryDialog(
            initial = category,
            all = categories.orEmpty(),
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

@Composable
private fun CategoryDialog(
    initial: Category,
    all: List<Category>,
    onSave: (Category) -> Unit,
    onDelete: () -> Unit,
    onDismiss: () -> Unit,
) {
    var name by remember { mutableStateOf(initial.name) }
    var kind by remember { mutableStateOf(initial.kind) }
    var color by remember { mutableStateOf(initial.color) }
    var emoji by remember { mutableStateOf(initial.emoji) }
    var parentId by remember { mutableStateOf(initial.parentId) }
    var confirmDelete by remember { mutableStateOf(false) }
    val isNew = initial.id == 0L
    val hasChildren = all.any { it.parentId == initial.id && initial.id != 0L }
    // Un seul niveau : une catégorie qui a des sous-catégories reste principale.
    val parents = all.filter { it.kind == kind && it.parentId == null && it.id != initial.id }
    val parent = all.find { it.id == parentId }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                when {
                    !isNew -> "Modifier la catégorie"
                    parentId != null -> "Nouvelle sous-catégorie"
                    else -> "Nouvelle catégorie"
                }
            )
        },
        text = {
            Column(
                Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nom") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (parent == null) KindSelector(kind, { kind = it })
                if (!hasChildren) {
                    Selector(
                        label = "Catégorie parente",
                        options = listOf<Category?>(null) + parents,
                        selected = parent,
                        optionLabel = { it?.name ?: "Aucune (catégorie principale)" },
                        onSelect = { parentId = it?.id },
                        emptyLabel = "Aucune (catégorie principale)",
                    )
                }
                Text("Emoji", style = MaterialTheme.typography.titleSmall)
                OutlinedTextField(
                    value = emoji,
                    onValueChange = { emoji = it.take(8) },
                    label = { Text("Emoji (ou choisir ci-dessous)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                EmojiPicker(CategoryEmojis, emoji, { emoji = it })
                Text("Couleur", style = MaterialTheme.typography.titleSmall)
                ColorPicker(color, { color = it })
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(
                        initial.copy(
                            name = name.trim(),
                            kind = parent?.kind ?: kind,
                            color = color,
                            emoji = emoji.trim(),
                            parentId = parentId,
                        )
                    )
                },
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
            text = if (hasChildren) {
                "Ses sous-catégories seront supprimées aussi. Les opérations sont conservées, sans catégorie."
            } else {
                "Les opérations de cette catégorie sont conservées, sans catégorie."
            },
            onConfirm = onDelete,
            onDismiss = { confirmDelete = false },
        )
    }
}
