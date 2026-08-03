export interface HourlyKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  closeTime: number;
}

export interface DailyExtremeRecord {
  date: string;
  high: string;
  highHour: number;
  low: string;
  lowHour: number;
  complete: boolean;
  candleCount: number;
}

export interface ExcludedDay {
  date: string;
  reason: string;
}

export interface DistributionPoint {
  index: number;
  bucket: string;
  highCount: number;
  lowCount: number;
  highProbability: number;
  lowProbability: number;
}

export interface WeeklyExtremeRecord {
  weekStart: string;
  weekEnd: string;
  high: string;
  highDate: string;
  highWeekday: number;
  low: string;
  lowDate: string;
  lowWeekday: number;
  dayCount: number;
}

export interface ExcludedWeek {
  weekStart: string;
  weekEnd: string;
  reason: string;
}

export interface WeeklyStatisticsResult {
  selectedCalendarWeeks: number;
  effectiveWeeks: number;
  records: WeeklyExtremeRecord[];
  excludedWeeks: ExcludedWeek[];
  distribution: DistributionPoint[];
}

export interface MonthlyExtremeRecord {
  month: string;
  rangeStart: string;
  rangeEnd: string;
  high: string;
  highDate: string;
  highDay: number;
  highWeek: number;
  low: string;
  lowDate: string;
  lowDay: number;
  lowWeek: number;
  dayCount: number;
}

export interface ExcludedMonth {
  month: string;
  rangeStart: string;
  rangeEnd: string;
  reason: string;
}

export interface MonthlyStatisticsResult {
  selectedCalendarMonths: number;
  effectiveMonths: number;
  records: MonthlyExtremeRecord[];
  excludedMonths: ExcludedMonth[];
  dayDistribution: DistributionPoint[];
  weekDistribution: DistributionPoint[];
}

export interface StatisticsResult {
  selectedCalendarDays: number;
  effectiveDays: number;
  records: DailyExtremeRecord[];
  excludedDays: ExcludedDay[];
  distribution: DistributionPoint[];
}

export interface MarketDataProvider {
  getHourlyKlines(params: {
    symbol: string;
    startTime: number;
    endTime: number;
  }): Promise<HourlyKline[]>;
  getEarliestAvailableTime(symbol: string): Promise<number>;
}
