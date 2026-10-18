/**
 * Minimal line chart with react-native-svg, standing in for the recharts LineChart on the web
 * dashboard (pages/Admin/Dashboard.tsx): horizontal grid in --border, 11px muted axis labels,
 * 5 "nice" Y ticks, monotone cubic lines (recharts `type="monotone"`), strokeWidth 2, no dots.
 * No tooltip / active dot yet.
 */
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { cn } from '@/lib/utils';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

export interface Series {
  key: string;
  color: string;
}

/**
 * Step for 4 intervals, snapped to the nearest 1 / 2 / 2.5 / 3 / 5 / 10 x 10^n. Like recharts'
 * auto ticks, the top tick may sit slightly below the data maximum.
 */
function niceStep(max: number) {
  if (max <= 0) return 1;
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const nice = [1, 2, 2.5, 3, 5, 10].reduce((best, c) =>
    Math.abs(c - n) < Math.abs(best - n) ? c : best,
  );
  return nice * pow;
}

/** Monotone cubic interpolation (Fritsch-Carlson), the curve recharts/d3 call "monotone". */
export function monotonePath(points: readonly [number, number][]): string {
  const n = points.length;
  if (n === 0) return '';
  const f = (v: number) => v.toFixed(1);
  if (n === 1) return `M${f(points[0]![0])},${f(points[0]![1])}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    dx.push(x1 - x0);
    slope.push((y1 - y0) / (x1 - x0 || 1));
  }
  const t: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i++) {
    const a = slope[i - 1]!;
    const b = slope[i]!;
    t.push(
      a * b <= 0
        ? 0
        : (3 * (dx[i - 1]! + dx[i]!)) /
            ((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b),
    );
  }
  t.push(slope[n - 2]!);
  let d = `M${f(points[0]![0])},${f(points[0]![1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    const h = dx[i]! / 3;
    d += ` C${f(x0 + h)},${f(y0 + h * t[i]!)} ${f(x1 - h)},${f(y1 - h * t[i + 1]!)} ${f(x1)},${f(y1)}`;
  }
  return d;
}

export function LineChart<T extends { name: string }>({
  data,
  series,
  height = 256,
  dimmed,
}: {
  data: T[];
  series: readonly Series[];
  height?: number;
  dimmed?: boolean;
}) {
  const { colors, fontFamilies } = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const left = 36;
  const bottom = 22;
  const top = 4;
  const right = 8;
  const values = data.flatMap((d) =>
    series.map((s) => Number((d as Record<string, unknown>)[s.key]) || 0),
  );
  const dataMax = Math.max(0, ...values);
  const step = niceStep(dataMax);
  const ticks = [0, 1, 2, 3, 4].map((k) => k * step);
  const max = Math.max(4 * step, dataMax);
  const plotW = Math.max(0, width - left - right);
  const plotH = height - top - bottom;
  const x = (i: number) => left + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 56))));

  return (
    <View
      className={cn('w-full', dimmed && 'opacity-60')}
      // Height is a prop; the SVG below takes its colours as props (values from useTheme).
      style={{ height }}
      onLayout={onLayout}
      testID="attendance-chart"
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          {ticks.map((t) => (
            <Line
              key={`g${t}`}
              x1={left}
              x2={width - right}
              y1={y(t)}
              y2={y(t)}
              stroke={colors.border}
              strokeWidth={1}
            />
          ))}
          {ticks.map((t) => (
            <SvgText
              key={`y${t}`}
              x={left - 8}
              y={y(t) + 4}
              fontSize={11}
              fontFamily={fontFamilies.regular}
              fill={colors.mutedForeground}
              textAnchor="end"
            >
              {t}
            </SvgText>
          ))}
          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <SvgText
                key={`x${d.name}`}
                x={x(i)}
                y={height - 4}
                fontSize={11}
                fontFamily={fontFamilies.regular}
                fill={colors.mutedForeground}
                textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
              >
                {d.name}
              </SvgText>
            ) : null,
          )}
          {series.map((s) => {
            const path = monotonePath(
              data.map((d, i): [number, number] => [
                x(i),
                y(Number((d as Record<string, unknown>)[s.key]) || 0),
              ]),
            );
            return (
              <Path
                key={s.key}
                d={path}
                stroke={s.color}
                strokeWidth={2}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}
