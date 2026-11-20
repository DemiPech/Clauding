package net.demipech.budget.data

import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

/** Contenu complet de la base : sert à la sauvegarde et à l'annulation d'une suppression. */
data class BackupData(
    val accounts: List<Account>,
    val categories: List<Category>,
    val scheduled: List<ScheduledOperation>,
    val operations: List<Operation>,
    val budgets: List<Budget> = emptyList(),
    val exportedAt: String? = null,
)

/**
 * Sauvegarde au format JSON. La lecture tolère les champs absents (valeurs par
 * défaut) pour qu'une sauvegarde d'une version plus ancienne reste lisible.
 */
object BackupJson {
    private const val APP = "net.demipech.budget"
    const val FORMAT = 1

    class InvalidBackup(message: String) : Exception(message)

    fun write(data: BackupData, exportedAt: String): String = JSONObject().apply {
        put("app", APP)
        put("format", FORMAT)
        put("exportedAt", exportedAt)
        put("accounts", JSONArray(data.accounts.map(::accountJson)))
        put("categories", JSONArray(data.categories.map(::categoryJson)))
        put("scheduled", JSONArray(data.scheduled.map(::scheduledJson)))
        put("operations", JSONArray(data.operations.map(::operationJson)))
        put("budgets", JSONArray(data.budgets.map { b -> JSONObject().put("categoryId", b.categoryId).put("amountCents", b.amountCents) }))
    }.toString(1)

    fun read(text: String): BackupData {
        val root = try {
            JSONObject(text)
        } catch (e: Exception) {
            throw InvalidBackup("Ce fichier n'est pas une sauvegarde Budget.")
        }
        if (root.optString("app") != APP) throw InvalidBackup("Ce fichier n'est pas une sauvegarde Budget.")
        if (root.optInt("format", 0) > FORMAT) {
            throw InvalidBackup("Sauvegarde faite avec une version plus récente de l'app : mettez l'app à jour.")
        }
        return BackupData(
            accounts = root.objects("accounts").map(::account),
            categories = root.objects("categories").map(::category),
            scheduled = root.objects("scheduled").map(::scheduled),
            operations = root.objects("operations").map(::operation),
            budgets = root.objects("budgets").map { Budget(it.getLong("categoryId"), it.getLong("amountCents")) },
            exportedAt = root.optString("exportedAt").ifBlank { null },
        )
    }

    // Écriture

    private fun accountJson(a: Account) = JSONObject().apply {
        put("id", a.id); put("name", a.name); put("initialBalanceCents", a.initialBalanceCents)
        put("color", a.color); put("icon", a.icon); put("deferredDebit", a.deferredDebit)
        put("cutoffDay", a.cutoffDay); put("debitDay", a.debitDay.name); put("debitDayOfMonth", a.debitDayOfMonth)
        put("fallbackAccountId", a.fallbackAccountId ?: JSONObject.NULL)
    }

    private fun categoryJson(c: Category) = JSONObject().apply {
        put("id", c.id); put("name", c.name); put("kind", c.kind.name); put("color", c.color)
        put("emoji", c.emoji); put("parentId", c.parentId ?: JSONObject.NULL)
    }

    private fun scheduledJson(s: ScheduledOperation) = JSONObject().apply {
        put("id", s.id); put("accountId", s.accountId); put("categoryId", s.categoryId ?: JSONObject.NULL)
        put("kind", s.kind.name); put("amountCents", s.amountCents); put("note", s.note)
        put("startDate", s.startDate.toString()); put("frequency", s.frequency.name); put("interval", s.interval)
        put("occurrences", s.occurrences ?: JSONObject.NULL); put("generatedCount", s.generatedCount)
        put("dayRule", s.dayRule.name); put("ruleN", s.ruleN); put("ruleWeekday", s.ruleWeekday)
        put("adjust", s.adjust.name); put("planId", s.planId ?: JSONObject.NULL); put("planIndex", s.planIndex)
        put("planSize", s.planSize); put("deferred", s.deferred); put("toAccountId", s.toAccountId ?: JSONObject.NULL)
        put("variableAmount", s.variableAmount)
    }

    private fun operationJson(o: Operation) = JSONObject().apply {
        put("id", o.id); put("accountId", o.accountId); put("categoryId", o.categoryId ?: JSONObject.NULL)
        put("kind", o.kind.name); put("amountCents", o.amountCents); put("date", o.date.toString())
        put("note", o.note); put("scheduledId", o.scheduledId ?: JSONObject.NULL); put("deferred", o.deferred)
        put("debitDate", o.debitDate.toString()); put("transferId", o.transferId ?: JSONObject.NULL)
        put("status", o.status.name); put("toConfirm", o.toConfirm); put("coverFor", o.coverFor ?: JSONObject.NULL)
    }

    // Lecture

    private fun JSONObject.objects(key: String): List<JSONObject> {
        val array = optJSONArray(key) ?: return emptyList()
        return List(array.length()) { array.getJSONObject(it) }
    }

    private fun JSONObject.longOrNull(key: String): Long? = if (has(key) && !isNull(key)) getLong(key) else null
    private fun JSONObject.intOrNull(key: String): Int? = if (has(key) && !isNull(key)) getInt(key) else null
    private fun JSONObject.date(key: String): LocalDate = LocalDate.parse(getString(key))

    private inline fun <reified E : Enum<E>> JSONObject.enum(key: String, default: E): E =
        optString(key).let { name -> enumValues<E>().firstOrNull { it.name == name } } ?: default

    private fun account(j: JSONObject) = Account(
        id = j.getLong("id"),
        name = j.getString("name"),
        initialBalanceCents = j.optLong("initialBalanceCents", 0),
        color = j.optLong("color", DEFAULT_ACCOUNT_COLOR),
        icon = j.optString("icon", DEFAULT_ACCOUNT_ICON),
        deferredDebit = j.optBoolean("deferredDebit", false),
        cutoffDay = j.optInt("cutoffDay", 31),
        debitDay = j.enum("debitDay", DebitDay.LAST_DAY),
        debitDayOfMonth = j.optInt("debitDayOfMonth", 5),
        fallbackAccountId = j.longOrNull("fallbackAccountId"),
    )

    private fun category(j: JSONObject) = Category(
        id = j.getLong("id"),
        name = j.getString("name"),
        kind = j.enum("kind", Kind.EXPENSE),
        color = j.optLong("color", 0xFF757575),
        emoji = j.optString("emoji", ""),
        parentId = j.longOrNull("parentId"),
    )

    private fun scheduled(j: JSONObject) = ScheduledOperation(
        id = j.getLong("id"),
        accountId = j.getLong("accountId"),
        categoryId = j.longOrNull("categoryId"),
        kind = j.enum("kind", Kind.EXPENSE),
        amountCents = j.getLong("amountCents"),
        note = j.optString("note", ""),
        startDate = j.date("startDate"),
        frequency = j.enum("frequency", Frequency.NONE),
        interval = j.optInt("interval", 1),
        occurrences = j.intOrNull("occurrences"),
        generatedCount = j.optInt("generatedCount", 0),
        dayRule = j.enum("dayRule", DayRule.SAME_DAY),
        ruleN = j.optInt("ruleN", 1),
        ruleWeekday = j.optInt("ruleWeekday", 1),
        adjust = j.enum("adjust", DateAdjust.NONE),
        planId = j.longOrNull("planId"),
        planIndex = j.optInt("planIndex", 0),
        planSize = j.optInt("planSize", 0),
        deferred = j.optBoolean("deferred", false),
        toAccountId = j.longOrNull("toAccountId"),
        variableAmount = j.optBoolean("variableAmount", false),
    )

    private fun operation(j: JSONObject): Operation {
        val date = j.date("date")
        return Operation(
            id = j.getLong("id"),
            accountId = j.getLong("accountId"),
            categoryId = j.longOrNull("categoryId"),
            kind = j.enum("kind", Kind.EXPENSE),
            amountCents = j.getLong("amountCents"),
            date = date,
            note = j.optString("note", ""),
            scheduledId = j.longOrNull("scheduledId"),
            deferred = j.optBoolean("deferred", false),
            debitDate = if (j.has("debitDate")) j.date("debitDate") else date,
            transferId = j.longOrNull("transferId"),
            status = j.enum("status", ClearStatus.NONE),
            toConfirm = j.optBoolean("toConfirm", false),
            coverFor = j.longOrNull("coverFor"),
        )
    }
}
