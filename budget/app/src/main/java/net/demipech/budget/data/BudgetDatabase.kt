package net.demipech.budget.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [Account::class, Category::class, Operation::class, ScheduledOperation::class],
    version = 2,
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
                .addMigrations(MIGRATION_1_2)
                .build()
    }
}

/** Couleurs données aux comptes existants lors de la migration, à tour de rôle. */
private val accountColors = listOf(0xFF1E88E5, 0xFFC2185B, 0xFF43A047, 0xFFFB8C00, 0xFF5E35B1, 0xFF00897B)

/** Emojis des catégories créées au premier lancement de la version 1. */
private val v1Emojis = mapOf(
    "Alimentation" to "🛒", "Logement" to "🏠", "Transport" to "🚗", "Abonnements" to "📺",
    "Santé" to "💊", "Loisirs" to "🎮", "Divers" to "📦", "Salaire" to "💼",
    "Remboursement" to "↩️", "Autre revenu" to "💰",
)

/** v2 : couleur et icône des comptes, emoji et sous-catégories. */
val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE accounts ADD COLUMN color INTEGER NOT NULL DEFAULT $DEFAULT_ACCOUNT_COLOR")
        db.execSQL("ALTER TABLE accounts ADD COLUMN icon TEXT NOT NULL DEFAULT '$DEFAULT_ACCOUNT_ICON'")
        db.execSQL("ALTER TABLE categories ADD COLUMN emoji TEXT NOT NULL DEFAULT ''")
        db.execSQL("ALTER TABLE categories ADD COLUMN parentId INTEGER")
        val cases = accountColors.mapIndexed { i, c -> "WHEN $i THEN $c" }.joinToString(" ")
        db.execSQL("UPDATE accounts SET color = CASE ((id - 1) % ${accountColors.size}) $cases END")
        v1Emojis.forEach { (name, emoji) ->
            db.execSQL("UPDATE categories SET emoji = ? WHERE name = ?", arrayOf<Any>(emoji, name))
        }
    }
}

private class Seed(val name: String, val kind: Kind, val color: Long, val emoji: String, val children: List<Pair<String, String>> = emptyList())

/** Catégories proposées au premier lancement ; elles restent modifiables. */
private object SeedCategories : RoomDatabase.Callback() {
    private val defaults = listOf(
        Seed("Alimentation", Kind.EXPENSE, 0xFF43A047, "🛒", listOf("Courses" to "🧺", "Restaurant" to "🍽️")),
        Seed("Logement", Kind.EXPENSE, 0xFF8D6E63, "🏠", listOf("Loyer" to "🔑", "Factures" to "💡", "Assurance" to "🛡️")),
        Seed("Transport", Kind.EXPENSE, 0xFF1E88E5, "🚗", listOf("Carburant" to "⛽", "Transports en commun" to "🚆")),
        Seed("Loisirs", Kind.EXPENSE, 0xFFFB8C00, "🎮", listOf("Abonnements" to "📺", "Sorties" to "🎬")),
        Seed("Santé", Kind.EXPENSE, 0xFFE53935, "💊"),
        Seed("Shopping", Kind.EXPENSE, 0xFFD81B60, "🛍️"),
        Seed("Dons", Kind.EXPENSE, 0xFF8E24AA, "❤️"),
        Seed("Divers", Kind.EXPENSE, 0xFF757575, "📦"),
        Seed("Salaire", Kind.INCOME, 0xFF00897B, "💼"),
        Seed("Remboursement", Kind.INCOME, 0xFF3949AB, "↩️"),
        Seed("Autre revenu", Kind.INCOME, 0xFF7CB342, "💰"),
    )

    override fun onCreate(db: SupportSQLiteDatabase) {
        defaults.forEach { seed ->
            db.execSQL(
                "INSERT INTO categories (name, kind, color, emoji, parentId) VALUES (?, ?, ?, ?, NULL)",
                arrayOf<Any>(seed.name, seed.kind.name, seed.color, seed.emoji),
            )
            seed.children.forEach { (name, emoji) ->
                db.execSQL(
                    "INSERT INTO categories (name, kind, color, emoji, parentId) " +
                        "VALUES (?, ?, ?, ?, (SELECT id FROM categories WHERE name = ? AND parentId IS NULL))",
                    arrayOf<Any>(name, seed.kind.name, seed.color, emoji, seed.name),
                )
            }
        }
    }
}
