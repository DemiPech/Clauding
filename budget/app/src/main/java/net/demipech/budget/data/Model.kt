package net.demipech.budget.data

import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import java.time.LocalDate

/** Sens d'une opération. Les montants sont toujours positifs ; c'est le sens qui signe. */
enum class Kind { EXPENSE, INCOME }

/** Rythme d'une opération planifiée. NONE = une seule échéance (opération future ponctuelle). */
enum class Frequency { NONE, DAILY, WEEKLY, MONTHLY, YEARLY }

@Entity(tableName = "accounts")
data class Account(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    /** Solde du compte au moment où on commence à le suivre, en centimes. */
    val initialBalanceCents: Long = 0,
    /** Couleur ARGB de la tuile du compte. */
    val color: Long = DEFAULT_ACCOUNT_COLOR,
    /** Emoji affiché sur la tuile. */
    val icon: String = DEFAULT_ACCOUNT_ICON,
)

const val DEFAULT_ACCOUNT_COLOR = 0xFF1E88E5
const val DEFAULT_ACCOUNT_ICON = "🏦"

@Entity(tableName = "categories")
data class Category(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val kind: Kind,
    /** Couleur ARGB (0xFFRRGGBB). */
    val color: Long,
    val emoji: String = "",
    /**
     * Catégorie parente pour une sous-catégorie (un seul niveau), null pour une
     * catégorie principale. Sans clé étrangère : la suppression en cascade est
     * faite par le dépôt, ce qui garde la migration simple.
     */
    val parentId: Long? = null,
)

/**
 * Opération planifiée : une échéance unique (frequency = NONE) ou une série,
 * limitée à [occurrences] échéances ou infinie (occurrences = null).
 *
 * Les échéances arrivées à terme deviennent de vraies [Operation] ;
 * [generatedCount] compte celles déjà créées.
 */
@Entity(
    tableName = "scheduled",
    foreignKeys = [
        ForeignKey(
            entity = Account::class,
            parentColumns = ["id"],
            childColumns = ["accountId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = Category::class,
            parentColumns = ["id"],
            childColumns = ["categoryId"],
            onDelete = ForeignKey.SET_NULL,
        ),
    ],
    indices = [Index("accountId"), Index("categoryId")],
)
data class ScheduledOperation(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val accountId: Long,
    val categoryId: Long?,
    val kind: Kind,
    val amountCents: Long,
    val note: String = "",
    /** Date de la première échéance (index 0). */
    val startDate: LocalDate,
    val frequency: Frequency,
    /** « Tous les N » jours / semaines / mois / ans. */
    val interval: Int = 1,
    /** Nombre total d'échéances, null = sans fin. */
    val occurrences: Int?,
    val generatedCount: Int = 0,
)

@Entity(
    tableName = "operations",
    foreignKeys = [
        ForeignKey(
            entity = Account::class,
            parentColumns = ["id"],
            childColumns = ["accountId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = Category::class,
            parentColumns = ["id"],
            childColumns = ["categoryId"],
            onDelete = ForeignKey.SET_NULL,
        ),
        ForeignKey(
            entity = ScheduledOperation::class,
            parentColumns = ["id"],
            childColumns = ["scheduledId"],
            onDelete = ForeignKey.SET_NULL,
        ),
    ],
    indices = [Index("accountId"), Index("categoryId"), Index("scheduledId"), Index("date")],
)
data class Operation(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val accountId: Long,
    val categoryId: Long?,
    val kind: Kind,
    val amountCents: Long,
    val date: LocalDate,
    val note: String = "",
    /** Planification qui a créé cette opération, le cas échéant. */
    val scheduledId: Long? = null,
)

val Operation.signedCents: Long get() = if (kind == Kind.INCOME) amountCents else -amountCents

data class AccountWithBalance(
    @Embedded val account: Account,
    val balanceCents: Long,
)

/**
 * Opération avec ce qu'il faut pour l'afficher. Pour une sous-catégorie,
 * [categoryName], [categoryEmoji] et [categoryColor] sont ceux de la catégorie
 * principale et [subcategoryName] le nom de la sous-catégorie.
 */
data class OperationDetails(
    @Embedded val operation: Operation,
    val accountName: String,
    val accountColor: Long,
    val categoryName: String?,
    val subcategoryName: String?,
    val categoryEmoji: String?,
    val categoryColor: Long?,
    val rootCategoryId: Long?,
    val scheduledFrequency: Frequency?,
    val scheduledInterval: Int?,
)

data class ScheduledDetails(
    @Embedded val scheduled: ScheduledOperation,
    val accountName: String,
    val categoryName: String?,
    val subcategoryName: String?,
    val categoryEmoji: String?,
    val categoryColor: Long?,
)

val ScheduledOperation.signedCents: Long get() = if (kind == Kind.INCOME) amountCents else -amountCents

/** Libellé d'une planification : sa note, à défaut sa (sous-)catégorie. */
val ScheduledDetails.title: String
    get() = scheduled.note.ifBlank { subcategoryName ?: categoryName ?: "" }
