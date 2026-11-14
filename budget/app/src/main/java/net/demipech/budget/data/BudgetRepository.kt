package net.demipech.budget.data

import androidx.room.withTransaction
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import net.demipech.budget.domain.DeferredDebit
import net.demipech.budget.domain.Fallback
import net.demipech.budget.domain.Recurrence
import java.time.LocalDate

class BudgetRepository(private val db: BudgetDatabase) {
    private val accounts = db.accountDao()
    private val categories = db.categoryDao()
    private val operations = db.operationDao()
    private val scheduled = db.scheduledDao()
    private val budgets = db.budgetDao()
    private val materializeLock = Mutex()

    // Annulation d'une suppression : on garde la base telle qu'elle était juste avant.
    private val undoEvents = MutableSharedFlow<String>(extraBufferCapacity = 1)
    private var undoSnapshot: BackupData? = null

    /** Message à afficher (« Opération supprimée ») avec un bouton Annuler. */
    val undoMessages: SharedFlow<String> = undoEvents

    /** Contenu complet de la base (sauvegarde, annulation). */
    suspend fun snapshot(): BackupData = db.withTransaction {
        BackupData(accounts.getAll(), categories.getAll(), scheduled.getAll(), operations.getAll(), budgets.getAll())
    }

    /** Remplace tout le contenu de la base par [data]. */
    suspend fun restore(data: BackupData) {
        db.withTransaction {
            budgets.deleteAll()
            operations.deleteAll()
            scheduled.deleteAll()
            categories.deleteAll()
            accounts.deleteAll()
            accounts.insertAll(data.accounts)
            categories.insertAll(data.categories)
            scheduled.insertAll(data.scheduled)
            operations.insertAll(data.operations)
            budgets.insertAll(data.budgets)
        }
        undoSnapshot = null
    }

    /**
     * Fait une suppression qu'on peut annuler : l'état d'avant est gardé jusqu'à la
     * suppression suivante, et [message] est proposé avec un bouton Annuler.
     */
    private suspend fun undoable(message: String, block: suspend () -> Unit) {
        val before = snapshot()
        block()
        undoSnapshot = before
        undoEvents.tryEmit(message)
    }

    /** Annule la dernière suppression. */
    suspend fun undo() {
        val before = undoSnapshot ?: return
        restore(before)
    }

    // Budgets
    fun budgets(): Flow<List<Budget>> = budgets.observeAll()

    /** Fixe le budget mensuel d'une catégorie ; null ou 0 le retire. */
    suspend fun setBudget(categoryId: Long, amountCents: Long?) {
        if (amountCents == null || amountCents <= 0) budgets.delete(categoryId)
        else budgets.upsert(Budget(categoryId, amountCents))
    }

    /** Opérations dont le libellé commence par [prefix], une par libellé (la plus récente). */
    suspend fun suggestions(prefix: String, limit: Int = 5): List<Operation> =
        if (prefix.isBlank()) emptyList()
        else operations.findByNotePrefix(prefix.trim()).distinctBy { it.note.lowercase() }.take(limit)

    // Pointage
    fun unreconciled(accountId: Long): Flow<List<OperationDetails>> = operations.observeUnreconciled(accountId)

    suspend fun setCleared(operation: Operation, cleared: Boolean) =
        operations.setStatus(operation.id, if (cleared) ClearStatus.CLEARED.name else ClearStatus.NONE.name)

    suspend fun setDeferredDebitCleared(accountId: Long, debitDate: LocalDate, cleared: Boolean) =
        operations.setDeferredDebitStatus(
            accountId, debitDate, if (cleared) ClearStatus.CLEARED.name else ClearStatus.NONE.name,
        )

    /** Verrouille les opérations pointées du compte ; renvoie leur nombre. */
    suspend fun reconcile(accountId: Long): Int = operations.reconcile(accountId)

    /** Déverrouille une opération rapprochée (elle redevient simplement pointée). */
    suspend fun unlock(operation: Operation) = operations.unlock(operation.id)

    // Comptes
    fun accountsWithBalance(today: LocalDate = LocalDate.now()): Flow<List<AccountWithBalance>> =
        accounts.observeWithBalance(today)
    fun accounts(): Flow<List<Account>> = accounts.observeAll()
    suspend fun account(id: Long): Account? = accounts.get(id)
    /** Enregistre le compte et recalcule la date de débit de ses opérations. */
    suspend fun save(account: Account): Long = db.withTransaction {
        if (account.id == 0L) {
            accounts.insert(account)
        } else {
            accounts.update(account)
            operations.getByAccount(account.id).forEach { op ->
                val debit = DeferredDebit.effectiveDate(op, account)
                if (debit != op.debitDate) operations.update(op.copy(debitDate = debit))
            }
            account.id
        }
    }
    /**
     * Supprime aussi ses opérations, ses planifications et les virements planifiés
     * vers lui. L'autre côté d'un virement passé reste, comme simple opération.
     */
    suspend fun delete(account: Account) = undoable("Compte « ${account.name} » supprimé") {
        db.withTransaction {
            scheduled.deleteTransfersTo(account.id)
            accounts.clearFallbackTo(account.id)
            accounts.delete(account)
        }
    }

    // Catégories
    fun categories(): Flow<List<Category>> = categories.observeAll()
    suspend fun category(id: Long): Category? = categories.get(id)
    suspend fun save(category: Category): Long = db.withTransaction {
        if (category.id == 0L) {
            categories.insert(category)
        } else {
            categories.update(category)
            if (category.parentId == null) categories.updateChildrenKind(category.id, category.kind.name)
            category.id
        }
    }

    /** Supprime aussi ses sous-catégories ; les opérations restent, sans catégorie. */
    suspend fun delete(category: Category) = undoable("Catégorie « ${category.name} » supprimée") {
        db.withTransaction {
            categories.deleteChildren(category.id)
            categories.delete(category)
        }
    }

    // Opérations
    fun operationsBetween(from: LocalDate, to: LocalDate, accountId: Long? = null): Flow<List<OperationDetails>> =
        operations.observeBetween(from, to, accountId)
    fun recentOperations(limit: Int): Flow<List<OperationDetails>> = operations.observeRecent(limit)
    suspend fun operation(id: Long): Operation? = operations.get(id)
    suspend fun save(operation: Operation): Long {
        val op = withDebitDate(operation, accounts.get(operation.accountId))
        return if (op.id == 0L) operations.insert(op) else op.id.also { operations.update(op) }
    }

    // Virements
    suspend fun transferLegs(transferId: Long): List<Operation> = operations.getTransfer(transferId)

    /**
     * Crée ou met à jour un virement de [fromAccountId] vers [toAccountId] : une sortie
     * et une entrée liées par le même transferId. Renvoie ce transferId.
     */
    suspend fun saveTransfer(
        transferId: Long?,
        fromAccountId: Long,
        toAccountId: Long,
        amountCents: Long,
        date: LocalDate,
        note: String,
    ): Long = db.withTransaction {
        val legs = transferId?.let { operations.getTransfer(it) }.orEmpty()
        writeTransfer(legs, fromAccountId, toAccountId, amountCents, date, note, scheduledId = legs.firstOrNull()?.scheduledId)
    }

    /** [undoable] = false quand le virement est remplacé (changement de type), pas supprimé. */
    suspend fun deleteTransfer(transferId: Long, undoable: Boolean = true) {
        if (undoable) undoable("Virement supprimé") { operations.deleteTransfer(transferId) }
        else operations.deleteTransfer(transferId)
    }

    /** Écrit les deux côtés d'un virement (à appeler dans une transaction). */
    private suspend fun writeTransfer(
        legs: List<Operation>,
        fromAccountId: Long,
        toAccountId: Long,
        amountCents: Long,
        date: LocalDate,
        note: String,
        scheduledId: Long?,
    ): Long {
        val out = legs.find { it.kind == Kind.EXPENSE }
        val inn = legs.find { it.kind == Kind.INCOME }
        val outOp = Operation(
            id = out?.id ?: 0, accountId = fromAccountId, categoryId = null, kind = Kind.EXPENSE,
            amountCents = amountCents, date = date, note = note, scheduledId = scheduledId,
            transferId = out?.transferId, status = out?.status ?: ClearStatus.NONE,
        )
        val outId = if (out == null) operations.insert(outOp) else out.id.also { operations.update(outOp) }
        val transferId = out?.transferId ?: outId
        if (out == null) operations.update(outOp.copy(id = outId, transferId = transferId))
        val inOp = Operation(
            id = inn?.id ?: 0, accountId = toAccountId, categoryId = null, kind = Kind.INCOME,
            amountCents = amountCents, date = date, note = note, scheduledId = scheduledId,
            transferId = transferId, status = inn?.status ?: ClearStatus.NONE,
        )
        if (inn == null) operations.insert(inOp) else operations.update(inOp)
        return transferId
    }

    private fun withDebitDate(op: Operation, account: Account?): Operation =
        op.copy(debitDate = account?.let { DeferredDebit.effectiveDate(op, it) } ?: op.date)

    /** Totaux des débits différés entre deux dates ([accountId] null = tous les comptes). */
    fun deferredDebits(from: LocalDate, to: LocalDate, accountId: Long? = null): Flow<List<DeferredDebitTotal>> =
        operations.observeDeferredDebits(from, to, accountId)
    suspend fun delete(operation: Operation, undoable: Boolean = true) {
        if (undoable) undoable("Opération supprimée") { operations.delete(operation) }
        else operations.delete(operation)
    }

    // Planifications
    fun scheduled(): Flow<List<ScheduledDetails>> = scheduled.observeDetails()
    suspend fun scheduled(id: Long): ScheduledOperation? = scheduled.get(id)
    suspend fun save(item: ScheduledOperation): Long {
        val id = if (item.id == 0L) scheduled.insert(item) else item.id.also { scheduled.update(item) }
        materializeDue()
        return id
    }
    // Paiements en plusieurs fois
    suspend fun plan(planId: Long): List<ScheduledOperation> = scheduled.getPlan(planId)

    /**
     * Enregistre l'échéancier d'un paiement en plusieurs fois. [rows] sont les
     * échéances pas encore payées (ponctuelles, dans l'ordre) ; pour un plan existant
     * elles remplacent les échéances non payées, les payées restent. Les échéances
     * datées d'aujourd'hui ou avant deviennent tout de suite des opérations.
     */
    suspend fun saveInstallments(planId: Long?, rows: List<ScheduledOperation>): Long? {
        val id = db.withTransaction {
            val paidCount = planId?.let { pid -> scheduled.getPlan(pid).count { it.generatedCount > 0 } } ?: 0
            if (planId != null) scheduled.deleteUnpaid(planId)
            val size = paidCount + rows.size
            var id = planId
            rows.forEachIndexed { i, row ->
                val item = row.copy(id = 0, planId = id, planIndex = paidCount + i + 1, planSize = size)
                val inserted = scheduled.insert(item)
                if (id == null) {
                    id = inserted
                    scheduled.update(item.copy(id = inserted, planId = inserted))
                }
            }
            id?.also { scheduled.updatePlan(it, size, rows.firstOrNull()?.note.orEmpty()) }
        }
        materializeDue()
        return id
    }

    /** Supprime l'échéancier ; les paiements déjà passés restent dans les opérations. */
    suspend fun deletePlan(planId: Long) = undoable("Paiement en plusieurs fois supprimé") {
        scheduled.deletePlan(planId)
    }

    /** Les opérations déjà créées par cette planification sont conservées. */
    suspend fun delete(item: ScheduledOperation) = undoable("Planification supprimée") { scheduled.delete(item) }

    /**
     * Transforme en opérations toutes les échéances planifiées arrivées à terme
     * (date <= [today]). Idempotent : à appeler à chaque ouverture de l'app.
     * Renvoie le nombre d'opérations créées.
     */
    suspend fun materializeDue(today: LocalDate = LocalDate.now()): Int = materializeLock.withLock {
        db.withTransaction {
            val accountsById = accounts.getAll().associateBy { it.id }
            // Toutes les échéances dues, dans l'ordre des dates : le solde vu par le compte
            // de secours à une date tient compte des échéances précédentes.
            val due = scheduled.getAll()
                .flatMap { item -> Recurrence.dueDates(item, today).map { item to it } }
                .sortedWith(compareBy({ it.second }, { it.first.id }))
            for ((item, date) in due) {
                val target = item.toAccountId
                if (target != null) {
                    // Virement planifié : les deux côtés, si le compte cible existe encore.
                    if (target in accountsById) {
                        writeTransfer(emptyList(), item.accountId, target, item.amountCents, date, item.note, item.id)
                    }
                    continue
                }
                val account = accountsById[item.accountId]
                val op = withDebitDate(
                    Operation(
                        accountId = item.accountId,
                        categoryId = item.categoryId,
                        kind = item.kind,
                        amountCents = item.amountCents,
                        date = date,
                        note = item.note,
                        scheduledId = item.id,
                        deferred = item.deferred,
                    ),
                    account,
                )
                // Compte de secours : si le solde ne suffit pas, le manque arrive par virement.
                val backup = account?.fallbackAccountId?.takeIf { it != item.accountId && it in accountsById }
                if (backup != null && op.kind == Kind.EXPENSE && op.debitDate == op.date) {
                    val missing = Fallback.shortfall(accounts.balanceAt(item.accountId, date), op.amountCents)
                    if (missing > 0) {
                        writeTransfer(
                            emptyList(), backup, item.accountId, missing, date,
                            "Complément automatique · " + item.note.ifBlank { "paiement planifié" }, scheduledId = null,
                        )
                    }
                }
                operations.insert(op)
            }
            due.groupingBy { it.first }.eachCount().forEach { (item, count) ->
                scheduled.update(item.copy(generatedCount = item.generatedCount + count))
            }
            due.size
        }
    }
}
