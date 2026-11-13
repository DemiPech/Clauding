package net.demipech.budget.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class BackupJsonTest {
    private val data = BackupData(
        accounts = listOf(
            Account(1, "Boursorama", -37974, 0xFFC2185B, "🏦", deferredDebit = true, cutoffDay = 20, debitDay = DebitDay.LAST_BUSINESS_DAY),
            Account(2, "Fortuneo", 478),
        ),
        categories = listOf(
            Category(1, "Loisirs", Kind.EXPENSE, 0xFFFB8C00, "🎮"),
            Category(2, "Abonnements", Kind.EXPENSE, 0xFFFB8C00, "📺", parentId = 1),
        ),
        scheduled = listOf(
            ScheduledOperation(
                id = 5, accountId = 1, categoryId = 2, kind = Kind.EXPENSE, amountCents = 1199, note = "Twitch",
                startDate = LocalDate.of(2026, 1, 13), frequency = Frequency.MONTHLY, occurrences = null,
                generatedCount = 10, dayRule = DayRule.LAST_BUSINESS_DAY, adjust = DateAdjust.PREVIOUS_BUSINESS_DAY,
                deferred = true,
            ),
            ScheduledOperation(
                id = 6, accountId = 1, categoryId = null, kind = Kind.EXPENSE, amountCents = 20000,
                startDate = LocalDate.of(2026, 1, 1), frequency = Frequency.MONTHLY, occurrences = 12, toAccountId = 2,
            ),
        ),
        operations = listOf(
            Operation(
                id = 10, accountId = 1, categoryId = 2, kind = Kind.EXPENSE, amountCents = 1199,
                date = LocalDate.of(2026, 11, 13), note = "Twitch « Turbo »", scheduledId = 5, deferred = true,
                debitDate = LocalDate.of(2026, 11, 30), status = ClearStatus.CLEARED,
            ),
            Operation(11, 1, null, Kind.EXPENSE, 20000, LocalDate.of(2026, 11, 1), transferId = 11, status = ClearStatus.RECONCILED),
            Operation(12, 2, null, Kind.INCOME, 20000, LocalDate.of(2026, 11, 1), transferId = 11),
        ),
    )

    @Test
    fun roundTripKeepsEverything() {
        val text = BackupJson.write(data, "2026-11-13T15:00:00")
        val back = BackupJson.read(text)
        assertEquals(data.accounts, back.accounts)
        assertEquals(data.categories, back.categories)
        assertEquals(data.scheduled, back.scheduled)
        assertEquals(data.operations, back.operations)
        assertEquals("2026-11-13T15:00:00", back.exportedAt)
    }

    @Test
    fun olderBackupWithoutNewFieldsUsesDefaults() {
        val text = """
            {"app":"net.demipech.budget","format":1,
             "accounts":[{"id":1,"name":"Compte"}],
             "operations":[{"id":3,"accountId":1,"kind":"INCOME","amountCents":500,"date":"2026-01-02"}]}
        """.trimIndent()
        val back = BackupJson.read(text)
        assertEquals(Account(1, "Compte"), back.accounts.single())
        val op = back.operations.single()
        assertEquals(LocalDate.of(2026, 1, 2), op.debitDate)
        assertEquals(ClearStatus.NONE, op.status)
        assertNull(op.transferId)
        assertTrue(back.categories.isEmpty())
    }

    @Test(expected = BackupJson.InvalidBackup::class)
    fun rejectsOtherFiles() {
        BackupJson.read("""{"hello":"world"}""")
    }
}
