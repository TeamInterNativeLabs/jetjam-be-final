const MONTHS = [`January`, `February`, `March`, `April`, `May`, `June`, `July`, `August`, `September`, `October`, `November`, `December`]

const BPM = [
    {
        label: "100 BPM",
        value: 100
    },
    {
        label: "110 BPM",
        value: 110
    },
    {
        label: "120 BPM",
        value: 120
    },
    {
        label: "124 BPM",
        value: 124
    },
    {
        label: "126 BPM",
        value: 126
    },
    {
        label: "128 BPM",
        value: 128
    },
    {
        label: "130 BPM",
        value: 130
    },
    {
        label: "132 BPM",
        value: 132
    },
    {
        label: "136 BPM",
        value: 136
    },
    {
        label: "138 BPM",
        value: 138
    },
    {
        label: "140 BPM",
        value: 140
    },
    {
        label: "142 BPM",
        value: 142
    },
    {
        label: "148 BPM",
        value: 148
    },
    {
        label: "156 BPM",
        value: 156
    },
];

const TIMES = [
    {
        label: "7 mins",
        value: 7 * 60
    },
    {
        label: "16 mins",
        value: 16 * 60
    },
    {
        label: "32 mins",
        value: 32 * 60
    },
    {
        label: "48 mins",
        value: 48 * 60
    },
];

const ROLES = {
    USER: "user",
    ADMIN: "admin"
}

const SUBSCRIPTION_INTERVALS = {
    WEEKLY: "weekly",
    MONTHLY: "monthly",
    YEARLY: "yearly"
}

const ERRORS = {
    NULL_FIELD: "Fields cannot be empty or null",
    UNKNOWN_FIELD: "Unknown Field Error",
    REQUIRED_FIELD: "All Fields are Required",
    USER_NOTEXIST: "User doesn't exist",
    USER_EXIST: "User already exists",
    INVALID_CREDENTIALS: "Invalid Credentials",
    BLOCKEDBY_ADMIN: "You are blocked by Admin. Please contact admin",
    UNAUTHORIZED: "Access denied"
}

const ENUM_ROLES = Object.values(ROLES)
const ENUM_SUBSCRIPTION_INTERVALS = Object.values(SUBSCRIPTION_INTERVALS)

const generateOTP = async () => {
    var digits = '0123456789'
    let OTP = ''
    for (let i = 0; i < 4; i++) {
        OTP += digits[Math.floor(Math.random() * 10)]
    }

    return OTP
}

const paginationHandler = (page, rowsPerPage) => {

    let paginationOptions = {}

    if (page && typeof page !== 'undefined' && rowsPerPage && typeof rowsPerPage !== 'undefined') {

        const pageNumber = parseInt(page);
        const limit = parseInt(rowsPerPage);
        const skip = (pageNumber - 1) * limit;

        paginationOptions = { limit, skip }

    }

    return paginationOptions

}

const objectValidator = (object) => {

    if (object) {

        let result = Object.entries(object).map(item => {
            if ((typeof item[1] !== 'boolean' && !item[1]) || item[1] === null || item[1] === undefined) {
                return false
            } else {
                return true
            }
        })

        return !result.includes(false)

    }

    return false

}

const getMonths = (year, month) => {

    let months = MONTHS.slice(0, month)

    return months.map(item => `${item} ${year.toString().slice(2)}`)
}

const getMinMax = (arr) => {

    let min = arr[0]
    let max = arr[0]

    for (let i = 0; i < arr.length; i++) {
        if (min > arr[i]) {
            min = arr[i]
        }

        if (max < arr[i]) {
            max = arr[i]
        }
    }

    return { min, max }

}

const getSearchQuery = (value) => ({ "$regex": value, "$options": "i" })

const getDateRangeQuery = (from, to) => {

    let fromDate, toDate;
    let rangeFilter = {}

    if (from) {
        fromDate = new Date(new Date(from).setHours(0, 0, 0, 0))
        rangeFilter = { ...rangeFilter, $gte: fromDate }
    }

    if (to) {
        toDate = new Date(new Date(to).setHours(23, 59, 59, 999))
        rangeFilter = { ...rangeFilter, $lte: toDate }
    }

    return rangeFilter
}

const getWeek = (week) => {

    let today = new Date();
    let day = today.getDay();
    let t = day - 1;
    let monday, sunday;

    if (week === 'last') {
        monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - t - 6);
        sunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - t);
    } else {
        monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - t + 1);
        sunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (6 - t) + 1);
    }

    return [monday, sunday];

}

const convertToSeconds = (timeString) => {
    const parts = timeString.split(':');
    const hours = parseInt(parts[0]) || 0; // Default to 0 if NaN
    const minutes = parseInt(parts[1]) || 0; // Default to 0 if NaN
    const seconds = parseInt(parts[2]) || 0; // Default to 0 if NaN
    return hours * 3600 + minutes * 60 + seconds;
}

module.exports = {
    MONTHS,
    ROLES,
    SUBSCRIPTION_INTERVALS,
    ERRORS,
    ENUM_ROLES,
    ENUM_SUBSCRIPTION_INTERVALS,
    BPM,
    TIMES,
    generateOTP,
    paginationHandler,
    objectValidator,
    getMonths,
    getMinMax,
    getSearchQuery,
    getDateRangeQuery,
    getWeek,
    convertToSeconds
}; 