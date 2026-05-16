export const APP_TIME_ZONE = "Asia/Kolkata"
export const APP_TIME_LOCALE = "en-IN"
export const APP_TIME_ZONE_LABEL = "IST"

type DateInput = string | number | Date

const clockTimeFormatter = new Intl.DateTimeFormat(APP_TIME_LOCALE, {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
})

const notificationTimeFormatter = new Intl.DateTimeFormat(APP_TIME_LOCALE, {
    timeZone: APP_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
})

const appDateFormatter = new Intl.DateTimeFormat(APP_TIME_LOCALE, {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
})

const appTimestampFormatter = new Intl.DateTimeFormat(APP_TIME_LOCALE, {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
})

const reportDatePartsFormatter = new Intl.DateTimeFormat(APP_TIME_LOCALE, {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
})

function toValidDate(input: DateInput) {
    const date = input instanceof Date ? input : new Date(input)
    return Number.isNaN(date.getTime()) ? null : date
}

function getDateParts(formatter: Intl.DateTimeFormat, input: DateInput) {
    const date = toValidDate(input)
    if (!date) {
        return null
    }

    return Object.fromEntries(
        formatter
            .formatToParts(date)
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, part.value])
    )
}

export function formatAppClockTime(input: DateInput) {
    const parts = getDateParts(clockTimeFormatter, input)
    return parts?.hour && parts.minute ? `${parts.hour}:${parts.minute}` : "--:--"
}

export function formatAppNotificationTime(input: DateInput) {
    const parts = getDateParts(notificationTimeFormatter, input)
    if (!parts?.month || !parts.day || !parts.hour || !parts.minute) {
        return "unknown time"
    }

    return `${parts.day} ${parts.month}, ${parts.hour}:${parts.minute} ${APP_TIME_ZONE_LABEL}`
}

export function formatAppDate(input: DateInput) {
    const parts = getDateParts(appDateFormatter, input)
    if (!parts?.day || !parts.month || !parts.year) {
        return "unknown date"
    }

    return `${parts.day} ${parts.month} ${parts.year}`
}

export function formatAppTimestamp(input: DateInput) {
    const parts = getDateParts(appTimestampFormatter, input)
    if (!parts?.day || !parts.month || !parts.year || !parts.hour || !parts.minute || !parts.second) {
        return "unknown time"
    }

    return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}:${parts.second} ${APP_TIME_ZONE_LABEL}`
}

export function formatAppReportDate(input: DateInput = new Date()) {
    const parts = getDateParts(reportDatePartsFormatter, input)
    if (!parts?.year || !parts.month || !parts.day) {
        return "unknown-date"
    }

    return `${parts.year}-${parts.month}-${parts.day}`
}
