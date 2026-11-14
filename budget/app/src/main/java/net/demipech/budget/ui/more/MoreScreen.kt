package net.demipech.budget.ui.more

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import net.demipech.budget.data.BackupData
import net.demipech.budget.ui.components.ConfirmDialog
import net.demipech.budget.ui.components.DayFormat
import net.demipech.budget.ui.components.SectionCard
import net.demipech.budget.ui.repository
import net.demipech.budget.BudgetApp
import net.demipech.budget.ui.components.Segmented
import net.demipech.budget.ui.theme.ThemeMode
import androidx.compose.runtime.collectAsState
import java.time.LocalDateTime

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoreScreen(
    onBudgets: () -> Unit,
    onForecast: () -> Unit,
    onScheduled: () -> Unit,
    onCategories: () -> Unit,
    onAddAccount: () -> Unit,
) {
    val context = LocalContext.current
    val repo = repository()
    val scope = rememberCoroutineScope()
    var lastBackup by remember { mutableStateOf(Backups.lastBackup(context)) }
    var pendingRestore by remember { mutableStateOf<BackupData?>(null) }

    fun toast(text: String) = Toast.makeText(context, text, Toast.LENGTH_LONG).show()

    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) scope.launch {
            runCatching { Backups.export(context, repo, uri) }
                .onSuccess {
                    lastBackup = Backups.lastBackup(context)
                    toast("Sauvegarde enregistrée : ${it.accounts.size} comptes, ${it.operations.size} opérations.")
                }
                .onFailure { toast("Échec de la sauvegarde : ${it.message}") }
        }
    }
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) scope.launch {
            runCatching { Backups.read(context, uri) }
                .onSuccess { pendingRestore = it }
                .onFailure { toast(it.message ?: "Fichier illisible.") }
        }
    }

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
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            SectionCard {
                Entry("🎯", "Budgets", "Budget mensuel par catégorie", onBudgets)
                Entry("📈", "Solde prévisionnel", "Courbe du solde avec les échéances à venir", onForecast)
                Entry("🔁", "Opérations planifiées", "Récurrences, virements et paiements à venir", onScheduled)
                Entry("🏷️", "Catégories", "Catégories, sous-catégories, emojis et couleurs", onCategories)
                Entry("🏦", "Ajouter un compte", "Les comptes se modifient depuis leur page (crayon)", onAddAccount)
            }
            SectionCard(title = "Apparence") {
                val themeSettings = (context.applicationContext as BudgetApp).themeSettings
                val mode by themeSettings.mode.collectAsState()
                Segmented(ThemeMode.entries, mode, { it.label }, themeSettings::set, Modifier.padding(horizontal = 16.dp))
                Text(
                    "« Système » suit le réglage du téléphone ; « Noir » est un sombre en noir pur, " +
                        "plus économe sur les écrans OLED.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }
            SectionCard(title = "Données") {
                Entry(
                    "💾",
                    "Sauvegarder",
                    "Dernière sauvegarde : " + (lastBackup?.format(DayFormat) ?: "jamais"),
                ) { exportLauncher.launch(Backups.suggestedFileName()) }
                Entry("♻️", "Restaurer une sauvegarde", "Remplace toutes les données de l'app") {
                    importLauncher.launch(arrayOf("*/*"))
                }
                Text(
                    "Les données ne sont que sur ce téléphone. Enregistrez la sauvegarde sur Google Drive " +
                        "(ou envoyez-la-vous) pour la retrouver si vous changez de téléphone.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        }
    }

    pendingRestore?.let { data ->
        val date = data.exportedAt?.let { runCatching { LocalDateTime.parse(it).toLocalDate().format(DayFormat) }.getOrNull() }
        ConfirmDialog(
            title = "Restaurer cette sauvegarde ?",
            text = "Sauvegarde" + (date?.let { " du $it" } ?: "") + " : ${data.accounts.size} comptes, " +
                "${data.operations.size} opérations, ${data.scheduled.size} planifications, " +
                "${data.categories.size} catégories.\n\nToutes les données actuelles seront remplacées.",
            confirmLabel = "Restaurer",
            onConfirm = {
                pendingRestore = null
                scope.launch {
                    runCatching { repo.restore(data) }
                        .onSuccess { toast("Données restaurées.") }
                        .onFailure { toast("Échec de la restauration : ${it.message}") }
                }
            },
            onDismiss = { pendingRestore = null },
        )
    }
}

@Composable
private fun Entry(emoji: String, title: String, subtitle: String, onClick: () -> Unit) {
    ListItem(
        leadingContent = { Text(emoji, fontSize = 24.sp) },
        headlineContent = { Text(title) },
        supportingContent = { Text(subtitle) },
        modifier = Modifier.clickable(onClick = onClick),
        colors = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surface),
    )
}
