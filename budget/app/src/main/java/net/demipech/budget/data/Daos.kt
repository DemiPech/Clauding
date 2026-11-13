package net.demipech.budget.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate

@Dao
interface AccountDao {
    /**
     * Soldes au [today] : une dépense en débit différé ne compte qu'à partir de sa
     * date de débit ; d'ici là elle est dans pendingCents (l'encours).
     */
    @Query(
        """
        SELECT a.*, a.initialBalanceCents + COALESCE((
            SELECT SUM(CASE WHEN o.kind = 'INCOME' THEN o.amountCents ELSE -o.amountCents END)
            FROM operations o
            WHERE o.accountId = a.id
                AND NOT (a.deferredDebit = 1 AND o.deferred = 1 AND o.kind = 'EXPENSE' AND o.debitDate > :today)
        ), 0) AS balanceCents,
        COALESCE((
            SELECT -SUM(o.amountCents) FROM operations o
            WHERE o.accountId = a.id
                AND a.deferredDebit = 1 AND o.deferred = 1 AND o.kind = 'EXPENSE' AND o.debitDate > :today
        ), 0) AS pendingCents
        FROM accounts a
        ORDER BY a.id
        """
    )
    fun observeWithBalance(today: LocalDate): Flow<List<AccountWithBalance>>

    @Query("SELECT * FROM accounts")
    suspend fun getAll(): List<Account>

    @Query("SELECT * FROM accounts ORDER BY id")
    fun observeAll(): Flow<List<Account>>

    @Query("SELECT * FROM accounts WHERE id = :id")
    suspend fun get(id: Long): Account?

    @Insert
    suspend fun insert(account: Account): Long

    @Update
    suspend fun update(account: Account)

    @Delete
    suspend fun delete(account: Account)
}

@Dao
interface CategoryDao {
    @Query("SELECT * FROM categories ORDER BY kind, name COLLATE NOCASE")
    fun observeAll(): Flow<List<Category>>

    @Query("SELECT * FROM categories WHERE id = :id")
    suspend fun get(id: Long): Category?

    @Insert
    suspend fun insert(category: Category): Long

    @Update
    suspend fun update(category: Category)

    @Delete
    suspend fun delete(category: Category)

    /** Une sous-catégorie a toujours le sens de sa catégorie principale. */
    @Query("UPDATE categories SET kind = :kind WHERE parentId = :parentId")
    suspend fun updateChildrenKind(parentId: Long, kind: String)

    @Query("DELETE FROM categories WHERE parentId = :parentId")
    suspend fun deleteChildren(parentId: Long)
}

private const val OPERATION_DETAILS = """
    SELECT o.*, a.name AS accountName, a.color AS accountColor,
        COALESCE(p.name, c.name) AS categoryName,
        CASE WHEN p.id IS NULL THEN NULL ELSE c.name END AS subcategoryName,
        COALESCE(p.emoji, c.emoji) AS categoryEmoji,
        COALESCE(p.color, c.color) AS categoryColor,
        COALESCE(p.id, c.id) AS rootCategoryId,
        s.frequency AS scheduledFrequency, s.interval AS scheduledInterval,
        s.planIndex AS scheduledPlanIndex, s.planSize AS scheduledPlanSize,
        a.deferredDebit AS accountDeferred,
        ta.name AS transferAccountName
    FROM operations o
    JOIN accounts a ON a.id = o.accountId
    LEFT JOIN operations t ON o.transferId IS NOT NULL AND t.transferId = o.transferId AND t.id != o.id
    LEFT JOIN accounts ta ON ta.id = t.accountId
    LEFT JOIN categories c ON c.id = o.categoryId
    LEFT JOIN categories p ON p.id = c.parentId
    LEFT JOIN scheduled s ON s.id = o.scheduledId
"""

@Dao
interface OperationDao {
    /** Opérations entre deux dates incluses ; [accountId] null = tous les comptes. */
    @Query(
        OPERATION_DETAILS + """
        WHERE o.date BETWEEN :from AND :to AND (:accountId IS NULL OR o.accountId = :accountId)
            AND (:accountId IS NOT NULL OR o.transferId IS NULL OR o.kind = 'EXPENSE')
        ORDER BY o.date DESC, o.id DESC
        """
    )
    fun observeBetween(from: LocalDate, to: LocalDate, accountId: Long?): Flow<List<OperationDetails>>

    /** Sans l'entrée des virements (une ligne par virement). */
    @Query(
        OPERATION_DETAILS + """
        WHERE o.transferId IS NULL OR o.kind = 'EXPENSE'
        ORDER BY o.date DESC, o.id DESC LIMIT :limit
        """
    )
    fun observeRecent(limit: Int): Flow<List<OperationDetails>>

    @Query("SELECT * FROM operations WHERE id = :id")
    suspend fun get(id: Long): Operation?

    @Query("SELECT * FROM operations WHERE accountId = :accountId")
    suspend fun getByAccount(accountId: Long): List<Operation>

    @Query("SELECT * FROM operations WHERE transferId = :transferId")
    suspend fun getTransfer(transferId: Long): List<Operation>

    @Query("DELETE FROM operations WHERE transferId = :transferId")
    suspend fun deleteTransfer(transferId: Long)

    /** Débits différés (par compte et date de débit) entre deux dates incluses. */
    @Query(
        """
        SELECT o.accountId AS accountId, a.name AS accountName, o.debitDate AS debitDate,
            SUM(o.amountCents) AS cents, COUNT(*) AS count
        FROM operations o
        JOIN accounts a ON a.id = o.accountId
        WHERE a.deferredDebit = 1 AND o.deferred = 1 AND o.kind = 'EXPENSE'
            AND o.debitDate BETWEEN :from AND :to
            AND (:accountId IS NULL OR o.accountId = :accountId)
        GROUP BY o.accountId, o.debitDate
        ORDER BY o.debitDate
        """
    )
    fun observeDeferredDebits(from: LocalDate, to: LocalDate, accountId: Long?): Flow<List<DeferredDebitTotal>>

    @Insert
    suspend fun insert(operation: Operation): Long

    @Insert
    suspend fun insertAll(operations: List<Operation>)

    @Update
    suspend fun update(operation: Operation)

    @Delete
    suspend fun delete(operation: Operation)
}

@Dao
interface ScheduledDao {
    @Query(
        """
        SELECT s.*, a.name AS accountName, ta.name AS toAccountName,
            COALESCE(p.name, c.name) AS categoryName,
            CASE WHEN p.id IS NULL THEN NULL ELSE c.name END AS subcategoryName,
            COALESCE(p.emoji, c.emoji) AS categoryEmoji,
            COALESCE(p.color, c.color) AS categoryColor
        FROM scheduled s
        JOIN accounts a ON a.id = s.accountId
        LEFT JOIN accounts ta ON ta.id = s.toAccountId
        LEFT JOIN categories c ON c.id = s.categoryId
        LEFT JOIN categories p ON p.id = c.parentId
        ORDER BY s.startDate
        """
    )
    fun observeDetails(): Flow<List<ScheduledDetails>>

    @Query("SELECT * FROM scheduled")
    suspend fun getAll(): List<ScheduledOperation>

    @Query("SELECT * FROM scheduled WHERE id = :id")
    suspend fun get(id: Long): ScheduledOperation?

    @Query("SELECT * FROM scheduled WHERE planId = :planId ORDER BY planIndex")
    suspend fun getPlan(planId: Long): List<ScheduledOperation>

    @Query("DELETE FROM scheduled WHERE planId = :planId AND generatedCount = 0")
    suspend fun deleteUnpaid(planId: Long)

    @Query("DELETE FROM scheduled WHERE planId = :planId")
    suspend fun deletePlan(planId: Long)

    @Query("DELETE FROM scheduled WHERE toAccountId = :accountId")
    suspend fun deleteTransfersTo(accountId: Long)

    @Query("UPDATE scheduled SET planSize = :size, note = :note WHERE planId = :planId")
    suspend fun updatePlan(planId: Long, size: Int, note: String)

    @Insert
    suspend fun insert(scheduled: ScheduledOperation): Long

    @Update
    suspend fun update(scheduled: ScheduledOperation)

    @Delete
    suspend fun delete(scheduled: ScheduledOperation)
}
