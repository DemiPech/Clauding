package net.demipech.budget.data

import androidx.room.withTransaction
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import net.demipech.budget.domain.Recurrence
import java.time.LocalDate

class BudgetRepository(private val db: BudgetDatabase) {
    private val accounts = db.accountDao()
    private val categories = db.categoryDao()
    private val operations = db.operationDao()
    private val scheduled = db.scheduledDao()
    private val materializeLock = Mutex()

    // Comptes
    fun accountsWithBalance(): Flow<List<AccountWithBalance>> = accounts.observeWithBalance()
    fun accounts(): Flow<List<Account>> = accounts.observeAll()
    suspend fun account(id: Long): Account? = accounts.get(id)
    suspend fun save(account: Account): Long =
        if (account.id == 0L) accounts.insert(account) else account.id.also { accounts.update(account) }
    /** Supprime aussi ses opérations et ses planifications. */
    suspend fun delete(account: Account) = accounts.delete(account)

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
    suspend fun save(operation: Operation): Long =
        if (operation.id == 0L) operations.insert(operation) else operation.id.also { operations.update(operation) }
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
            for (item in scheduled.getAll()) {
                val dates = Recurrence.dueDates(item, today)
                if (dates.isEmpty()) continue
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
                        )
                    }
                )
                scheduled.update(item.copy(generatedCount = item.generatedCount + dates.size))
                created += dates.size
            }
            created
        }
    }
}
