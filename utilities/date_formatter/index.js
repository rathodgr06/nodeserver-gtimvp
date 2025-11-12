const moment = require("moment");
// const moment = require("moment-timezone");
// moment.tz.setDefault('Asia/Dubai')
var date_format = {
   
    created_date_time: async () => {
        // for current date 
        var format_date = moment().format('YYYY-MM-DD HH:mm:ss');
        return format_date;
    },
    insert_date_time: async (date) => {
        // Insert into DB 
        var format_date = moment(date).format('YYYY-MM-DD HH:mm:ss');
        return format_date;
    },
    get_date_time: async (date) => {
          // Fetched from DB
        var format_date = moment(date).format('DD-MM-YYYY HH:mm:ss');
        return format_date;
    },

    // For Date only //

    current_date: async () => {
        // for current date 
        var format_date = moment().format('YYYY-MM-DD');
        return format_date;
    },
    get_date: async (date) => {
        // Fetched from DB
        var format_date = moment(date).format('DD-MM-YYYY');
        return format_date;
    },
    insert_date: async (date) => {
        // Insert into DB 
        var format_date = moment(date).format('YYYY-MM-DD');
        return format_date;
    },
    utc_date: async () => {
        var format_date =  moment().utc().format("YYYY-MM-DD");
        return format_date;
    },
    get_utc_date: async (date) => {
        var format_date =  moment(date).utc().format("YYYY-MM-DD");
        return format_date;
    },
    convert_date_by_seconds:async(seconds)=>{
        var format_date = moment().add(seconds, "seconds").format("DD-MM-YYYY hh:mm A");
        return format_date;

    },
    convert_date_by_days:async(days)=>{
        var format_date = moment().subtract(days, "day").format("YYYY-MM-DD");
        return format_date;

    },
    get_date_by_days:async(days)=>{
        var format_date = moment().subtract(days, "day").format("DD-MM-YYYY");
        return format_date;

    },

    add_days_by_days:async(days,format='YYYY-MM-DD')=>{
        var format_date = moment().add(days, 'days').format(format);
        return format_date;

    },
    get_default_date:async(date)=>{
        var format_date = moment(date);
        return format_date;
    },
    default_date:async()=>{
        var format_date = moment();
        return format_date;
    },
    get_diff_date:async(date)=>{
        var current_date = moment();
        let format_date = current_date.diff(date, "days");
        return format_date;
    },
    convert_start_date_by_weeks:async(week)=>{
        var format_date = moment()
        .subtract(week, "weeks")
        .startOf("week")
        .format("YYYY-MM-DD");;
        return format_date;

    },
    convert_end_date_by_weeks:async(week)=>{
        var format_date = moment()
        .subtract(week, "weeks")
        .endOf("week")
        .format("YYYY-MM-DD");
        return format_date;

    },
    checkBetween: async (current_date, start_date, end_date) => {
        return moment(current_date).isBetween(start_date, end_date);
    }
}
module.exports = date_format;