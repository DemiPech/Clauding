package net.demipech.budget.ui

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.AccountBox
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import net.demipech.budget.ui.accounts.AccountEditScreen
import net.demipech.budget.ui.accounts.AccountsScreen
import net.demipech.budget.ui.categories.CategoriesScreen
import net.demipech.budget.ui.operations.OperationEditScreen
import net.demipech.budget.ui.operations.OperationsScreen
import net.demipech.budget.ui.scheduled.ScheduledEditScreen
import net.demipech.budget.ui.scheduled.ScheduledScreen

private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab(Routes.ACCOUNTS, "Comptes", Icons.Filled.AccountBox),
    Tab(Routes.OPERATIONS, "Opérations", Icons.AutoMirrored.Filled.List),
    Tab(Routes.SCHEDULED, "Planifié", Icons.Filled.DateRange),
    Tab(Routes.CATEGORIES, "Catégories", Icons.Filled.ShoppingCart),
)

/** -1 dans une route = argument absent. */
private fun Long.orNull(): Long? = takeIf { it >= 0 }

@Composable
fun BudgetNavHost(nav: NavHostController = rememberNavController()) {
    val backStack by nav.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route
    val showTabs = tabs.any { it.route == currentRoute }

    Scaffold(
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        bottomBar = {
            if (showTabs) {
                NavigationBar {
                    tabs.forEach { tab ->
                        NavigationBarItem(
                            selected = currentRoute == tab.route,
                            onClick = {
                                nav.navigate(tab.route) {
                                    popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(tab.icon, contentDescription = null) },
                            label = { Text(tab.label) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = nav,
            startDestination = Routes.ACCOUNTS,
            modifier = Modifier
                .padding(padding)
                .consumeWindowInsets(padding),
        ) {
            val back: () -> Unit = { nav.popBackStack() }
            val idArg = navArgument("id") { type = NavType.LongType; defaultValue = -1L }

            composable(Routes.ACCOUNTS) {
                AccountsScreen(
                    onOpenAccount = { nav.navigate(Routes.account(it)) },
                    onAddAccount = { nav.navigate(Routes.accountEdit()) },
                )
            }
            composable(Routes.OPERATIONS) {
                OperationsScreen(
                    accountId = null,
                    onEditOperation = { nav.navigate(Routes.operationEdit(id = it)) },
                    onAddOperation = { nav.navigate(Routes.operationEdit()) },
                )
            }
            composable(Routes.SCHEDULED) {
                ScheduledScreen(
                    onEdit = { nav.navigate(Routes.scheduledEdit(it)) },
                    onAdd = { nav.navigate(Routes.scheduledEdit()) },
                )
            }
            composable(Routes.CATEGORIES) { CategoriesScreen() }

            composable(Routes.ACCOUNT, arguments = listOf(navArgument("id") { type = NavType.LongType })) { entry ->
                val accountId = entry.arguments!!.getLong("id")
                OperationsScreen(
                    accountId = accountId,
                    onEditOperation = { nav.navigate(Routes.operationEdit(id = it)) },
                    onAddOperation = { nav.navigate(Routes.operationEdit(accountId = accountId)) },
                    onBack = back,
                    onEditAccount = { nav.navigate(Routes.accountEdit(accountId)) },
                )
            }
            composable(Routes.ACCOUNT_EDIT, arguments = listOf(idArg)) { entry ->
                AccountEditScreen(
                    id = entry.arguments!!.getLong("id").orNull(),
                    onDone = back,
                    onDeleted = { nav.popBackStack(Routes.ACCOUNTS, inclusive = false) },
                )
            }
            composable(
                Routes.OPERATION_EDIT,
                arguments = listOf(idArg, navArgument("accountId") { type = NavType.LongType; defaultValue = -1L }),
            ) { entry ->
                OperationEditScreen(
                    id = entry.arguments!!.getLong("id").orNull(),
                    presetAccountId = entry.arguments!!.getLong("accountId").orNull(),
                    onDone = back,
                )
            }
            composable(Routes.SCHEDULED_EDIT, arguments = listOf(idArg)) { entry ->
                ScheduledEditScreen(id = entry.arguments!!.getLong("id").orNull(), onDone = back)
            }
        }
    }
}
