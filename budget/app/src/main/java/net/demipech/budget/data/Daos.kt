package net.demipech.budget.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate

@Dao
interface BudgetDao {
    @Query("SELECT * FROM budgets")
    fun observeAll(): Flow<List<Budget>>

    @Query("SELECT * FROM budgets")
    suspend fun getAll(): List<Budget>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(budget: Budget)

    @Insert
    suspend fun insertAll(budgets: List<Budget>)

    @Query("DELETE FROM budgets WHERE categoryId = :categoryId")
    suspend fun delete(categoryId: Long)

    @Query("DELETE FROM budgets")
    suspend fun deleteAll()
}

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
        ), 0) AS pendingCents,
        a.initialBalanceCents + COALESCE((
            SELECT SUM(CASE WHEN o.kind = 'INCOME' THEN o.amountCents ELSE -o.amountCents END)
            FROM operations o WHERE o.accountId = a.id AND o.status != 'NONE'
        ), 0) AS clearedCents
        FROM accounts a
        ORDER BY a.id
        """
    )
    fun observeWithBalance(today: LocalDate): Flow<List<AccountWithBalance>>

    @Query("SELECT * FROM accounts")
    suspend fun getAll(): List<Account>

    /** Solde du compte au [day] : opérations jusqu'à ce jour, dépenses différées à leur débit. */
    @Query(
        """
        SELECT a.initialBalanceCents + COALESCE((
            SELECT SUM(CASE WHEN o.kind = 'INCOME' THEN o.amountCents ELSE -o.amountCents END)
            FROM operations o
            WHERE o.accountId = a.id AND o.date <= :day
                AND NOT (a.deferredDebit = 1 AND o.deferred = 1 AND o.kind = 'EXPENSE' AND o.debitDate > :day)
        ), 0)
        FROM accounts a WHERE a.id = :accountId
        """
    )
    suspend fun balanceAt(accountId: Long, day: LocalDate): Long

    @Query("UPDATE accounts SET fallbackAccountId = NULL WHERE fallbackAccountId = :accountId")
    suspend fun clearFallbackTo(accountId: Long)

    @Insert
    suspend fun insertAll(accounts: List<Account>)

    @Query("DELETE FROM accounts")
    suspend fun deleteAll()

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

    @Query("SELECT * FROM categories")
    suspend fun getAll(): List<Category>

    @Insert
    suspend fun insertAll(categories: List<Category>)

    @Query("DELETE FROM categories")
    suspend fun deleteAll()

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

    /** Libellés déjà saisis commençant par [prefix] (suggestions), du plus récent au plus ancien. */
    @Query(
        """
        SELECT * FROM operations
        WHERE transferId IS NULL AND note != '' AND note LIKE :prefix || '%'
        ORDER BY date DESC, id DESC LIMIT 50
        """
    )
    suspend fun findByNotePrefix(prefix: String): List<Operation>

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

    /** Supprime le complément automatique (les deux côtés) d'une dépense. */
    @Query("DELETE FROM operations WHERE coverFor = :operationId")
    suspend fun deleteCoverOf(operationId: Long)

    @Query("SELECT COUNT(*) FROM operations WHERE coverFor = :operationId")
    suspend fun getCoverCount(operationId: Long): Int

    /** Dépenses d'un compte à partir d'une date, dans l'ordre (rattrapage des compléments). */
    @Query(
        """
        SELECT * FROM operations
        WHERE accountId = :accountId AND date >= :from AND kind = 'EXPENSE' AND transferId IS NULL
        ORDER BY date, id
        """
    )
    suspend fun expensesSince(accountId: Long, from: LocalDate): List<Operation>

    @Query("SELECT * FROM operations")
    suspend fun getAll(): List<Operation>

    /** Opérations au montant estimé, en attente de confirmation. */
    @Query(OPERATION_DETAILS + " WHERE o.toConfirm = 1 ORDER BY o.date, o.id")
    fun observeToConfirm(): Flow<List<OperationDetails>>

    /** Derniers montants confirmés créés par une planification (le plus récent d'abord). */
    @Query(
        """
        SELECT amountCents FROM operations
        WHERE scheduledId = :scheduledId AND toConfirm = 0
        ORDER BY date DESC, id DESC LIMIT :limit
        """
    )
    suspend fun lastConfirmedAmounts(scheduledId: Long, limit: Int): List<Long>

    @Query("DELETE FROM operations")
    suspend fun deleteAll()

    /** Opérations d'un compte pas encore rapprochées (écran de pointage). */
    @Query(
        OPERATION_DETAILS + """
        WHERE o.accountId = :accountId AND o.status != 'RECONCILED'
        ORDER BY o.debitDate DESC, o.id DESC
        """
    )
    fun observeUnreconciled(accountId: Long): Flow<List<OperationDetails>>

    @Query("UPDATE operations SET status = :status WHERE id = :id AND status != 'RECONCILED'")
    suspend fun setStatus(id: Long, status: String)

    @Query("UPDATE operations SET status = 'CLEARED' WHERE id = :id")
    suspend fun unlock(id: Long)

    /** Pointe (ou dépointe) d'un coup toutes les dépenses d'un débit différé. */
    @Query(
        """
        UPDATE operations SET status = :status
        WHERE accountId = :accountId AND deferred = 1 AND kind = 'EXPENSE' AND debitDate = :debitDate
            AND status != 'RECONCILED'
        """
    )
    suspend fun setDeferredDebitStatus(accountId: Long, debitDate: LocalDate, status: String)

    @Query("UPDATE operations SET status = 'RECONCILED' WHERE accountId = :accountId AND status = 'CLEARED'")
    suspend fun reconcile(accountId: Long): Int

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

    @Insert
    suspend fun insertAll(items: List<ScheduledOperation>)

    @Query("DELETE FROM scheduled")
    suspend fun deleteAll()

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
