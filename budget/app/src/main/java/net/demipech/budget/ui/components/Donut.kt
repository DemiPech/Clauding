package net.demipech.budget.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Anneau de répartition ; gris quand il n'y a rien à montrer. */
@Composable
fun Donut(
    values: List<Pair<Color, Long>>,
    modifier: Modifier = Modifier,
    thickness: Dp = 28.dp,
    center: @Composable BoxScope.() -> Unit = {},
) {
    val empty = MaterialTheme.colorScheme.surfaceVariant
    val total = values.sumOf { it.second }
    Box(modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val stroke = thickness.toPx()
            val diameter = size.minDimension - stroke
            val arcSize = Size(diameter, diameter)
            val topLeft = Offset((size.width - diameter) / 2, (size.height - diameter) / 2)
            if (total <= 0) {
                drawArc(
                    color = empty, startAngle = 0f, sweepAngle = 360f, useCenter = false,
                    topLeft = topLeft, size = arcSize, style = Stroke(width = stroke),
                )
                return@Canvas
            }
            val gap = if (values.count { it.second > 0 } > 1) 1.5f else 0f
            var start = -90f
            values.forEach { (color, value) ->
                if (value <= 0) return@forEach
                val sweep = 360f * value / total
                drawArc(
                    color = color, startAngle = start + gap / 2, sweepAngle = (sweep - gap).coerceAtLeast(0.5f),
                    useCenter = false, topLeft = topLeft, size = arcSize, style = Stroke(width = stroke),
                )
                start += sweep
            }
        }
        center()
    }
}
