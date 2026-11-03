package net.demipech.budget.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [Account::class, Category::class, Operation::class, ScheduledOperation::class],
    version = 1,
)
@TypeConverters(Converters::class)
abstract class BudgetDatabase : RoomDatabase() {
    abstract fun accountDao(): AccountDao
    abstract fun categoryDao(): CategoryDao
    abstract fun operationDao(): OperationDao
    abstract fun scheduledDao(): ScheduledDao

    companion object {
        fun create(context: Context): BudgetDatabase =
            Room.databaseBuilder(context, BudgetDatabase::class.java, "budget.db")
                .addCallback(SeedCategories)
                .build()
    }
}

/** Catégories proposées au premier lancement ; elles restent modifiables. */
private object SeedCategories : RoomDatabase.Callback() {
    private val defaults = listOf(
        Triple("Alimentation", Kind.EXPENSE, 0xFF43A047),
        Triple("Logement", Kind.EXPENSE, 0xFF8D6E63),
        Triple("Transport", Kind.EXPENSE, 0xFF1E88E5),
        Triple("Abonnements", Kind.EXPENSE, 0xFF8E24AA),
        Triple("Santé", Kind.EXPENSE, 0xFFE53935),
        Triple("Loisirs", Kind.EXPENSE, 0xFFFB8C00),
        Triple("Divers", Kind.EXPENSE, 0xFF757575),
        Triple("Salaire", Kind.INCOME, 0xFF00897B),
        Triple("Remboursement", Kind.INCOME, 0xFF3949AB),
        Triple("Autre revenu", Kind.INCOME, 0xFF7CB342),
    )

    override fun onCreate(db: SupportSQLiteDatabase) {
        defaults.forEach { (name, kind, color) ->
            db.execSQL(
                "INSERT INTO categories (name, kind, color) VALUES (?, ?, ?)",
                arrayOf<Any>(name, kind.name, color),
            )
        }
    }
}
