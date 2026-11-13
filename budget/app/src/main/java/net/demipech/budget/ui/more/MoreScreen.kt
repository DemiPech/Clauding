package net.demipech.budget.ui.more

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import net.demipech.budget.ui.components.SectionCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoreScreen(onScheduled: () -> Unit, onCategories: () -> Unit, onAddAccount: () -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Plus") },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(12.dp),
        ) {
            SectionCard {
                Entry("🔁", "Opérations planifiées", "Récurrences et paiements à venir", onScheduled)
                Entry("🏷️", "Catégories", "Catégories, sous-catégories, emojis et couleurs", onCategories)
                Entry("🏦", "Ajouter un compte", "Les comptes se modifient depuis leur page (crayon)", onAddAccount)
            }
        }
    }
}

@Composable
private fun Entry(emoji: String, title: String, subtitle: String, onClick: () -> Unit) {
    ListItem(
        leadingContent = { Text(emoji, fontSize = 24.sp) },
        headlineContent = { Text(title) },
        supportingContent = { Text(subtitle) },
        modifier = Modifier.clickable(onClick = onClick),
        colors = androidx.compose.material3.ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surface),
    )
}
