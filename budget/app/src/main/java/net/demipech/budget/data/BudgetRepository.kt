package net.demipech.budget.data

import androidx.room.withTransaction
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import net.demipech.budget.domain.DeferredDebit
import net.demipech.budget.domain.Recurrence
import java.time.LocalDate

class BudgetRepository(private val db: BudgetDatabase) {
    private val accounts = db.accountDao()
    private val categories = db.categoryDao()
    private val operations = db.operationDao()
    private val scheduled = db.scheduledDao()
    private val materializeLock = Mutex()

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
    suspend fun delete(account: Account) = db.withTransaction {
        scheduled.deleteTransfersTo(account.id)
        accounts.delete(account)
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
    suspend fun delete(category: Category) = db.withTransaction {
        categories.deleteChildren(category.id)
        categories.delete(category)
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

    suspend fun deleteTransfer(transferId: Long) = operations.deleteTransfer(transferId)

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
            transferId = out?.transferId,
        )
        val outId = if (out == null) operations.insert(outOp) else out.id.also { operations.update(outOp) }
        val transferId = out?.transferId ?: outId
        if (out == null) operations.update(outOp.copy(id = outId, transferId = transferId))
        val inOp = Operation(
            id = inn?.id ?: 0, accountId = toAccountId, categoryId = null, kind = Kind.INCOME,
            amountCents = amountCents, date = date, note = note, scheduledId = scheduledId,
            transferId = transferId,
        )
        if (inn == null) operations.insert(inOp) else operations.update(inOp)
        return transferId
    }

    private fun withDebitDate(op: Operation, account: Account?): Operation =
        op.copy(debitDate = account?.let { DeferredDebit.effectiveDate(op, it) } ?: op.date)

    /** Totaux des débits différés entre deux dates ([accountId] null = tous les comptes). */
    fun deferredDebits(from: LocalDate, to: LocalDate, accountId: Long? = null): Flow<List<DeferredDebitTotal>> =
        operations.observeDeferredDebits(from, to, accountId)
    suspend fun delete(operation: Operation) = operations.delete(operation)

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
    suspend fun deletePlan(planId: Long) = scheduled.deletePlan(planId)

    /** Les opérations déjà créées par cette planification sont conservées. */
    suspend fun delete(item: ScheduledOperation) = scheduled.delete(item)

    /**
     * Transforme en opérations toutes les échéances planifiées arrivées à terme
     * (date <= [today]). Idempotent : à appeler à chaque ouverture de l'app.
     * Renvoie le nombre d'opérations créées.
     */
    suspend fun materializeDue(today: LocalDate = LocalDate.now()): Int = materializeLock.withLock {
        db.withTransaction {
            var created = 0
            val accountsById = accounts.getAll().associateBy { it.id }
            for (item in scheduled.getAll()) {
                val dates = Recurrence.dueDates(item, today)
                if (dates.isEmpty()) continue
                val target = item.toAccountId
                if (target != null) {
                    // Virement planifié : les deux côtés, si le compte cible existe encore.
                    if (target in accountsById) {
                        dates.forEach { date ->
                            writeTransfer(emptyList(), item.accountId, target, item.amountCents, date, item.note, item.id)
                        }
                    }
                    scheduled.update(item.copy(generatedCount = item.generatedCount + dates.size))
                    created += dates.size
                    continue
                }
                operations.insertAll(
                    dates.map { date ->
                        Operation(
                            accountId = item.accountId,
                            categoryId = item.categoryId,
                            kind = item.kind,
                            amountCents = item.amountCents,
                            date = date,
                            note = item.note,
                            scheduledId = item.id,
                            deferred = item.deferred,
                        ).let { withDebitDate(it, accountsById[item.accountId]) }
                    }
                )
                scheduled.update(item.copy(generatedCount = item.generatedCount + dates.size))
                created += dates.size
            }
            created
        }
    }
}
