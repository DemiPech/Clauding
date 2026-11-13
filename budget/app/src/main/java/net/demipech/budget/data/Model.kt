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

/**
 * Jour retenu dans le mois d'une échéance mensuelle ou annuelle.
 * SAME_DAY = le jour de la date de départ (comportement de base).
 */
enum class DayRule {
    SAME_DAY,
    LAST_DAY,
    FIRST_BUSINESS_DAY,
    LAST_BUSINESS_DAY,
    /** Nᵉ jour ouvré du mois (N = ruleN). */
    NTH_BUSINESS_DAY,
    /** Nᵉ jour de la semaine ruleWeekday du mois (N = 1 à 4, 5 = le dernier). */
    NTH_WEEKDAY,
}

/** Que faire quand l'échéance tombe un week-end ou un jour férié. */
enum class DateAdjust { NONE, NEXT_BUSINESS_DAY, PREVIOUS_BUSINESS_DAY }

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
    /** Règle de jour pour une série mensuelle ou annuelle. */
    val dayRule: DayRule = DayRule.SAME_DAY,
    /** N de NTH_BUSINESS_DAY et NTH_WEEKDAY. */
    val ruleN: Int = 1,
    /** Jour de la semaine de NTH_WEEKDAY, 1 = lundi … 7 = dimanche. */
    val ruleWeekday: Int = 1,
    /** Décalage si l'échéance tombe un jour non ouvré. */
    val adjust: DateAdjust = DateAdjust.NONE,
    /**
     * Paiement en plusieurs fois : chaque échéance est une planification ponctuelle
     * ; elles partagent [planId] (l'id de la première), [planIndex] va de 1 à [planSize].
     */
    val planId: Long? = null,
    val planIndex: Int = 0,
    val planSize: Int = 0,
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
    val scheduledPlanIndex: Int? = null,
    val scheduledPlanSize: Int? = null,
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
