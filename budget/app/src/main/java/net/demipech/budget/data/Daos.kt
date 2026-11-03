package net.demipech.budget.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface AccountDao {
    @Query(
        """
        SELECT a.*, a.initialBalanceCents + COALESCE((
            SELECT SUM(CASE WHEN o.kind = 'INCOME' THEN o.amountCents ELSE -o.amountCents END)
            FROM operations o WHERE o.accountId = a.id
        ), 0) AS balanceCents
        FROM accounts a
        ORDER BY a.name COLLATE NOCASE
        """
    )
    fun observeWithBalance(): Flow<List<AccountWithBalance>>

    @Query("SELECT * FROM accounts ORDER BY name COLLATE NOCASE")
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
}

@Dao
interface OperationDao {
    /** Opérations, les plus récentes d'abord ; [accountId] null = tous les comptes. */
    @Query(
        """
        SELECT o.*, a.name AS accountName, c.name AS categoryName, c.color AS categoryColor
        FROM operations o
        JOIN accounts a ON a.id = o.accountId
        LEFT JOIN categories c ON c.id = o.categoryId
        WHERE (:accountId IS NULL OR o.accountId = :accountId)
        ORDER BY o.date DESC, o.id DESC
        """
    )
    fun observeDetails(accountId: Long?): Flow<List<OperationDetails>>

    @Query("SELECT * FROM operations WHERE id = :id")
    suspend fun get(id: Long): Operation?

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
        SELECT s.*, a.name AS accountName, c.name AS categoryName, c.color AS categoryColor
        FROM scheduled s
        JOIN accounts a ON a.id = s.accountId
        LEFT JOIN categories c ON c.id = s.categoryId
        ORDER BY s.startDate
        """
    )
    fun observeDetails(): Flow<List<ScheduledDetails>>

    @Query("SELECT * FROM scheduled")
    suspend fun getAll(): List<ScheduledOperation>

    @Query("SELECT * FROM scheduled WHERE id = :id")
    suspend fun get(id: Long): ScheduledOperation?

    @Insert
    suspend fun insert(scheduled: ScheduledOperation): Long

    @Update
    suspend fun update(scheduled: ScheduledOperation)

    @Delete
    suspend fun delete(scheduled: ScheduledOperation)
}
