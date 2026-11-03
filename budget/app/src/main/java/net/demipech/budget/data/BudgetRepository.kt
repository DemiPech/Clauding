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
    suspend fun save(category: Category): Long =
        if (category.id == 0L) categories.insert(category) else category.id.also { categories.update(category) }
    /** Les opérations de la catégorie restent, sans catégorie. */
    suspend fun delete(category: Category) = categories.delete(category)

    // Opérations
    fun operations(accountId: Long? = null): Flow<List<OperationDetails>> = operations.observeDetails(accountId)
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
