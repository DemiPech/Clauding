package net.demipech.budget.ui.more

import android.content.Context
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import net.demipech.budget.data.BackupData
import net.demipech.budget.data.BackupJson
import net.demipech.budget.data.BudgetRepository
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit

/** Écriture et lecture des fichiers de sauvegarde, et date de la dernière sauvegarde. */
object Backups {
    private const val PREFS = "budget"
    private const val LAST_BACKUP = "lastBackup"

    fun suggestedFileName(): String = "budget-${LocalDate.now()}.json"

    fun lastBackup(context: Context): LocalDate? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(LAST_BACKUP, null)
            ?.let { runCatching { LocalDate.parse(it) }.getOrNull() }

    /** Écrit toute la base dans [uri] ; renvoie ce qui a été sauvegardé. */
    suspend fun export(context: Context, repo: BudgetRepository, uri: Uri): BackupData {
        val data = repo.snapshot()
        val text = BackupJson.write(data, LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS).toString())
        withContext(Dispatchers.IO) {
            val out = context.contentResolver.openOutputStream(uri, "wt")
                ?: throw IllegalStateException("Impossible d'écrire le fichier.")
            out.use { it.write(text.toByteArray(Charsets.UTF_8)) }
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(LAST_BACKUP, LocalDate.now().toString()).apply()
        return data
    }

    /** Lit une sauvegarde sans rien modifier (la restauration est confirmée ensuite). */
    suspend fun read(context: Context, uri: Uri): BackupData = withContext(Dispatchers.IO) {
        val input = context.contentResolver.openInputStream(uri)
            ?: throw IllegalStateException("Impossible de lire le fichier.")
        BackupJson.read(input.use { it.readBytes().toString(Charsets.UTF_8) })
    }
}
