package net.demipech.budget.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import net.demipech.budget.data.Category
import net.demipech.budget.data.Kind

/** Catégories principales d'un sens, chacune suivie de ses sous-catégories. */
fun List<Category>.ordered(kind: Kind): List<Category> {
    val ofKind = filter { it.kind == kind }
    val roots = ofKind.filter { it.parentId == null }
    return roots.flatMap { root -> listOf(root) + ofKind.filter { it.parentId == root.id } }
}

/** « Loisirs › Abonnements » pour une sous-catégorie, le nom sinon. */
fun List<Category>.fullName(category: Category): String =
    category.parentId?.let { pid -> find { it.id == pid } }?.let { "${it.name} › ${category.name}" } ?: category.name

/** Emoji à afficher : celui de la catégorie, à défaut celui de sa parente. */
fun List<Category>.emojiOf(category: Category): String =
    category.emoji.ifBlank { category.parentId?.let { pid -> find { it.id == pid }?.emoji }.orEmpty() }

@Composable
fun CategorySelector(
    categories: List<Category>,
    kind: Kind,
    selectedId: Long?,
    onSelect: (Long?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val options = remember(categories, kind) { categories.ordered(kind) }
    Selector(
        label = "Catégorie",
        options = listOf<Category?>(null) + options,
        selected = options.find { it.id == selectedId },
        optionLabel = { c ->
            when {
                c == null -> "Sans catégorie"
                c.parentId != null -> "      " + c.name
                else -> c.name
            }
        },
        onSelect = { onSelect(it?.id) },
        leading = { c -> CategoryBadge(c?.let { categories.emojiOf(it) }, c?.color, size = 28) },
        emptyLabel = "Sans catégorie",
        modifier = modifier,
    )
}
