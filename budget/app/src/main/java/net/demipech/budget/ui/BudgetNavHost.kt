package net.demipech.budget.ui

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import net.demipech.budget.ui.accounts.AccountEditScreen
import net.demipech.budget.ui.categories.CategoriesScreen
import net.demipech.budget.ui.budgets.BudgetsScreen
import net.demipech.budget.ui.forecast.ForecastScreen
import net.demipech.budget.ui.home.HomeScreen
import net.demipech.budget.ui.search.SearchScreen
import net.demipech.budget.ui.installments.InstallmentEditScreen
import net.demipech.budget.ui.installments.InstallmentPreset
import net.demipech.budget.ui.more.MoreScreen
import net.demipech.budget.ui.operations.OperationEditScreen
import net.demipech.budget.ui.operations.TransactionsScreen
import net.demipech.budget.ui.reconcile.ReconcileScreen
import net.demipech.budget.ui.scheduled.ScheduledEditScreen
import net.demipech.budget.ui.scheduled.ScheduledScreen
import net.demipech.budget.ui.stats.StatsScreen
import java.time.LocalDate

/** Icône « camembert » (absente du jeu d'icônes de base). */
private val PieChartIcon: ImageVector = ImageVector.Builder(
    name = "PieChart", defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f,
).addPath(
    pathData = addPathNodes(
        "M11,2v20c-5.07,-0.5 -9,-4.79 -9,-10s3.93,-9.5 9,-10zM13.03,2v8.99L22,10.99" +
            "c-0.47,-4.74 -4.24,-8.52 -8.97,-8.99zM13.03,13.01L13.03,22c4.74,-0.47 8.5,-4.25 8.97,-8.99h-8.97z"
    ),
    fill = SolidColor(Color.Black),
).build()

private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab(Routes.HOME, "Accueil", Icons.Filled.Home),
    Tab(Routes.OPERATIONS, "Opérations", Icons.AutoMirrored.Filled.List),
    Tab(Routes.STATS, "Stats", PieChartIcon),
    Tab(Routes.MORE, "Plus", Icons.Filled.Menu),
)

/** -1 dans une route = argument absent. */
private fun Long.orNull(): Long? = takeIf { it >= 0 }

@Composable
fun BudgetNavHost(nav: NavHostController = rememberNavController()) {
    val backStack by nav.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route
    val showTabs = tabs.any { it.route == currentRoute }

    // Bandeau « … supprimé · Annuler » après chaque suppression, quel que soit l'écran.
    val repo = repository()
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    LaunchedEffect(repo) {
        repo.undoMessages.collectLatest { message ->
            val result = snackbar.showSnackbar(
                message = message,
                actionLabel = "Annuler",
                withDismissAction = true,
                duration = SnackbarDuration.Long,
            )
            if (result == SnackbarResult.ActionPerformed) scope.launch { repo.undo() }
        }
    }

    val openTab: (String) -> Unit = { route ->
        nav.navigate(route) {
            popUpTo(nav.graph.findStartDestination().id) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    Scaffold(
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            if (showTabs) {
                NavigationBar(containerColor = MaterialTheme.colorScheme.surface, tonalElevation = 0.dp) {
                    tabs.forEach { tab ->
                        NavigationBarItem(
                            selected = currentRoute == tab.route,
                            onClick = { openTab(tab.route) },
                            icon = { Icon(tab.icon, contentDescription = null) },
                            label = { Text(tab.label) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = MaterialTheme.colorScheme.primary,
                                selectedTextColor = MaterialTheme.colorScheme.primary,
                                indicatorColor = MaterialTheme.colorScheme.primaryContainer,
                            ),
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = nav,
            startDestination = Routes.HOME,
            modifier = Modifier
                .padding(padding)
                .consumeWindowInsets(padding),
        ) {
            val back: () -> Unit = { nav.popBackStack() }
            val idArg = navArgument("id") { type = NavType.LongType; defaultValue = -1L }
            val editOperation: (Long) -> Unit = { nav.navigate(Routes.operationEdit(id = it)) }

            composable(Routes.HOME) {
                HomeScreen(
                    onOpenAccount = { nav.navigate(Routes.account(it)) },
                    onAddAccount = { nav.navigate(Routes.accountEdit()) },
                    onAddOperation = { nav.navigate(Routes.operationEdit()) },
                    onEditOperation = editOperation,
                    onShowOperations = { openTab(Routes.OPERATIONS) },
                    onShowStats = { openTab(Routes.STATS) },
                    onShowScheduled = { nav.navigate(Routes.SCHEDULED) },
                    onShowBudgets = { nav.navigate(Routes.BUDGETS) },
                    onShowForecast = { nav.navigate(Routes.FORECAST) },
                )
            }
            composable(Routes.OPERATIONS) {
                TransactionsScreen(
                    accountId = null,
                    onEditOperation = editOperation,
                    onAddOperation = { date -> nav.navigate(Routes.operationEdit(date = date)) },
                    onShowScheduled = { nav.navigate(Routes.SCHEDULED) },
                    onSearch = { nav.navigate(Routes.SEARCH) },
                    onBudgets = { nav.navigate(Routes.BUDGETS) },
                )
            }
            composable(Routes.STATS) { StatsScreen(onBudgets = { nav.navigate(Routes.BUDGETS) }) }
            composable(Routes.BUDGETS) { BudgetsScreen(onBack = back) }
            composable(Routes.FORECAST) { ForecastScreen(onBack = back) }
            composable(Routes.SEARCH) { SearchScreen(onBack = back, onEditOperation = editOperation) }
            composable(Routes.MORE) {
                MoreScreen(
                    onBudgets = { nav.navigate(Routes.BUDGETS) },
                    onForecast = { nav.navigate(Routes.FORECAST) },
                    onScheduled = { nav.navigate(Routes.SCHEDULED) },
                    onCategories = { nav.navigate(Routes.CATEGORIES) },
                    onAddAccount = { nav.navigate(Routes.accountEdit()) },
                )
            }

            composable(Routes.SCHEDULED) {
                ScheduledScreen(
                    onEdit = { nav.navigate(Routes.scheduledEdit(it)) },
                    onAdd = { nav.navigate(Routes.scheduledEdit()) },
                    onEditPlan = { nav.navigate(Routes.installmentsEdit(planId = it)) },
                    onAddPlan = { nav.navigate(Routes.installmentsEdit()) },
                    onBack = back,
                )
            }
            composable(Routes.CATEGORIES) { CategoriesScreen(onBack = back) }

            composable(Routes.ACCOUNT, arguments = listOf(navArgument("id") { type = NavType.LongType })) { entry ->
                val accountId = entry.arguments!!.getLong("id")
                TransactionsScreen(
                    accountId = accountId,
                    onEditOperation = editOperation,
                    onAddOperation = { date -> nav.navigate(Routes.operationEdit(accountId = accountId, date = date)) },
                    onShowScheduled = { nav.navigate(Routes.SCHEDULED) },
                    onBack = back,
                    onEditAccount = { nav.navigate(Routes.accountEdit(accountId)) },
                    onReconcile = { nav.navigate(Routes.reconcile(accountId)) },
                    onSearch = { nav.navigate(Routes.SEARCH) },
                )
            }
            composable(Routes.RECONCILE, arguments = listOf(navArgument("id") { type = NavType.LongType })) { entry ->
                ReconcileScreen(accountId = entry.arguments!!.getLong("id"), onBack = back)
            }
            composable(Routes.ACCOUNT_EDIT, arguments = listOf(idArg)) { entry ->
                AccountEditScreen(
                    id = entry.arguments!!.getLong("id").orNull(),
                    onDone = back,
                    onDeleted = { nav.popBackStack(Routes.HOME, inclusive = false) },
                )
            }
            composable(
                Routes.OPERATION_EDIT,
                arguments = listOf(
                    idArg,
                    navArgument("accountId") { type = NavType.LongType; defaultValue = -1L },
                    navArgument("date") { type = NavType.LongType; defaultValue = Long.MIN_VALUE },
                    navArgument("copyOf") { type = NavType.LongType; defaultValue = -1L },
                ),
            ) { entry ->
                val args = entry.arguments!!
                OperationEditScreen(
                    id = args.getLong("id").orNull(),
                    presetAccountId = args.getLong("accountId").orNull(),
                    presetDate = args.getLong("date").takeIf { it != Long.MIN_VALUE }?.let(LocalDate::ofEpochDay),
                    copyOf = args.getLong("copyOf").orNull(),
                    onDuplicate = { sourceId ->
                        nav.navigate(Routes.operationEdit(copyOf = sourceId)) {
                            popUpTo(Routes.OPERATION_EDIT) { inclusive = true }
                        }
                    },
                    onDone = back,
                    onSplit = { preset ->
                        nav.navigate(
                            Routes.installmentsEdit(
                                amountCents = preset.amountCents,
                                accountId = preset.accountId,
                                categoryId = preset.categoryId,
                                note = preset.note,
                            )
                        ) { popUpTo(Routes.OPERATION_EDIT) { inclusive = true } }
                    },
                )
            }
            composable(
                Routes.INSTALLMENTS_EDIT,
                arguments = listOf(
                    navArgument("planId") { type = NavType.LongType; defaultValue = -1L },
                    navArgument("amount") { type = NavType.LongType; defaultValue = -1L },
                    navArgument("accountId") { type = NavType.LongType; defaultValue = -1L },
                    navArgument("categoryId") { type = NavType.LongType; defaultValue = -1L },
                    navArgument("note") { type = NavType.StringType; nullable = true; defaultValue = null },
                ),
            ) { entry ->
                val args = entry.arguments!!
                InstallmentEditScreen(
                    planId = args.getLong("planId").orNull(),
                    preset = InstallmentPreset(
                        amountCents = args.getLong("amount").orNull(),
                        accountId = args.getLong("accountId").orNull(),
                        categoryId = args.getLong("categoryId").orNull(),
                        note = args.getString("note"),
                    ),
                    onDone = back,
                )
            }
            composable(Routes.SCHEDULED_EDIT, arguments = listOf(idArg)) { entry ->
                ScheduledEditScreen(id = entry.arguments!!.getLong("id").orNull(), onDone = back)
            }
        }
    }
}
