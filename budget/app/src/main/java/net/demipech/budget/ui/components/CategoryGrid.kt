package net.demipech.budget.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import net.demipech.budget.data.Category
import net.demipech.budget.data.Kind

/**
 * Choix de catégorie en un geste : grille d'emojis des catégories principales, puis,
 * si elle en a, la rangée de ses sous-catégories. Toucher à nouveau désélectionne.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CategoryGrid(
    categories: List<Category>,
    kind: Kind,
    selectedId: Long?,
    onSelect: (Long?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val roots = categories.filter { it.kind == kind && it.parentId == null }
    val selected = categories.find { it.id == selectedId }
    val activeRoot = selected?.let { it.parentId ?: it.id }
    val children = categories.filter { it.parentId != null && it.parentId == activeRoot }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Catégorie", style = MaterialTheme.typography.titleSmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            roots.forEach { root ->
                CategoryChip(root.emoji, root.name, activeRoot == root.id) {
                    onSelect(if (activeRoot == root.id) null else root.id)
                }
            }
        }
        if (children.isNotEmpty()) {
            val root = categories.find { it.id == activeRoot }
            Text("Sous-catégorie", style = MaterialTheme.typography.titleSmall)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                children.forEach { child ->
                    CategoryChip(child.emoji.ifBlank { root?.emoji.orEmpty() }, child.name, selectedId == child.id) {
                        onSelect(if (selectedId == child.id) activeRoot else child.id)
                    }
                }
            }
        }
    }
}

@Composable
private fun CategoryChip(emoji: String, name: String, selected: Boolean, onClick: () -> Unit) {
    Column(
        Modifier
            .width(76.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(
                if (selected) MaterialTheme.colorScheme.primaryContainer
                else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            )
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(emoji.ifBlank { "🏷️" }, fontSize = 22.sp)
        Text(
            name,
            style = MaterialTheme.typography.labelSmall,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            color = if (selected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface,
        )
    }
}
